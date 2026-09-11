#!/usr/bin/env node
/**
 * Audit stored custom-API probe URLs against the safety rules.
 *
 * US-183 added validation to POST /v1/custom-apis and to the probe itself,
 * but rows created before that were never checked. The probe now refuses them
 * at fetch time, so they are inert — they are still stored, though, and
 * anything pointing at the private network is worth knowing about and
 * removing.
 *
 * Read-only by default. Pass --disable to clear the probe_url of every row
 * that fails, which stops the worker attempting them at all.
 *
 *   node scripts/audit-probe-urls.js
 *   node scripts/audit-probe-urls.js --disable
 *
 * Needs SUPABASE_URL and SUPABASE_SERVICE_KEY in the environment, and the
 * Supabase client, which is a dependency of services/ingest — run it from
 * there if the import fails:
 *
 *   cd services/ingest && node ../../scripts/audit-probe-urls.js
 */
import { parseProbeUrl } from '../services/ingest/src/lib/safe-url.js';

/** Loaded lazily so a missing dependency produces advice, not a stack trace. */
async function loadSupabase() {
  try {
    return (await import('@supabase/supabase-js')).createClient;
  } catch {
    console.error(
      'Could not load @supabase/supabase-js.\n' +
      'Run this from a workspace that has it installed:\n' +
      '  cd services/ingest && npm install && node ../../scripts/audit-probe-urls.js',
    );
    process.exit(2);
  }
}

const DISABLE = process.argv.includes('--disable');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Set SUPABASE_URL and SUPABASE_SERVICE_KEY and try again.`);
    process.exit(2);
  }
  return value;
}

async function main() {
  const createClient = await loadSupabase();
  const supabase = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_KEY'));

  const { data: rows, error } = await supabase
    .from('apis')
    .select('id, slug, name, probe_url, owner_id')
    .not('probe_url', 'is', null);

  if (error) {
    console.error('Could not read the apis table:', error.message);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log('No stored probe URLs to audit.');
    return;
  }

  const unsafe = [];
  for (const row of rows) {
    const result = parseProbeUrl(row.probe_url);
    if (!result.ok) unsafe.push({ ...row, reason: result.reason });
  }

  console.log(`Audited ${rows.length} probe URL(s).`);

  if (unsafe.length === 0) {
    console.log('All pass the safety rules.');
    return;
  }

  console.log(`\n${unsafe.length} fail:\n`);
  for (const row of unsafe) {
    console.log(`  ${row.slug}  (owner ${row.owner_id || 'none'})`);
    console.log(`    url:    ${row.probe_url}`);
    console.log(`    reason: ${row.reason}\n`);
  }

  if (!DISABLE) {
    console.log('Read-only run. Re-run with --disable to clear these probe URLs.');
    process.exitCode = 1;
    return;
  }

  let cleared = 0;
  for (const row of unsafe) {
    const { error: updateErr } = await supabase
      .from('apis')
      .update({ probe_url: null })
      .eq('id', row.id);
    if (updateErr) {
      console.error(`  Failed to clear ${row.slug}: ${updateErr.message}`);
    } else {
      cleared++;
    }
  }
  console.log(`Cleared ${cleared} of ${unsafe.length} probe URL(s).`);
  if (cleared < unsafe.length) process.exitCode = 1;
}

main().catch(err => {
  console.error('Audit failed:', err.message);
  process.exit(1);
});
