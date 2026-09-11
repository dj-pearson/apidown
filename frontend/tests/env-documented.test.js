import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Every environment variable the code reads should be in .env.example.
 *
 * This is not tidiness. IP_HASH_SALT was read by two request handlers, absent
 * from .env.example, and silently fell back to a constant published in this
 * repository — so nobody deploying the project had any way to know it existed,
 * and the rate-limit identifier it protected was reversible. The same was true
 * of PROBE_ENCRYPTION_KEY and every Stripe secret.
 */
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Read by the code but intentionally not in .env.example. */
const ALLOWED_UNDOCUMENTED = new Set([
  'NO_COLOR',        // conventional, set by the user's terminal, never by us
  'VAPID_PUBLIC_KEY', // legacy alias for PUBLIC_VAPID_PUBLIC_KEY, already documented
  'APIDOWN_KEY',      // appears only in /docs code samples — it is the reader's
                      // own variable in their own app, not one we read
]);

const SEARCH_ROOTS = ['services', 'packages', 'frontend/src'];
const SKIP_DIRS = new Set(['node_modules', '.svelte-kit', 'dist', 'build', '.git']);

function jsFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) jsFiles(full, out);
    else if (/\.(js|svelte)$/.test(entry)) out.push(full);
  }
  return out;
}

function referencedVars() {
  const names = new Set();
  for (const root of SEARCH_ROOTS) {
    for (const file of jsFiles(resolve(repo, root))) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/process\.env\.([A-Z0-9_]+)/g)) names.add(m[1]);
      for (const m of src.matchAll(/getEnv\(\s*['"]([A-Z0-9_]+)['"]\s*\)/g)) names.add(m[1]);
    }
  }
  return names;
}

function documentedVars() {
  const src = readFileSync(resolve(repo, '.env.example'), 'utf8');
  return new Set([...src.matchAll(/^([A-Z0-9_]+)=/gm)].map(m => m[1]));
}

describe('.env.example', () => {
  test('finds the code to scan', () => {
    assert.ok(referencedVars().size > 15, 'the scan should reach the services and frontend');
  });

  test('documents every environment variable the code reads', () => {
    const documented = documentedVars();
    const missing = [...referencedVars()]
      .filter(name => !documented.has(name) && !ALLOWED_UNDOCUMENTED.has(name))
      .sort();
    assert.deepEqual(missing, [], `\nUndocumented env vars:\n  ${missing.join('\n  ')}\n`);
  });

  test('documents the secrets that silently degrade when unset', () => {
    const documented = documentedVars();
    for (const name of ['IP_HASH_SALT', 'PROBE_ENCRYPTION_KEY', 'STRIPE_WEBHOOK_SECRET']) {
      assert.ok(documented.has(name), `${name} must be documented`);
    }
  });

  test('ships no real-looking secret values', () => {
    const src = readFileSync(resolve(repo, '.env.example'), 'utf8');
    assert.ok(!/sk_live_[A-Za-z0-9]{10,}/.test(src), 'looks like a real Stripe key');
    assert.ok(!/^IP_HASH_SALT=.+$/m.test(src), 'the salt must ship empty, never with a default');
    assert.ok(!/^PROBE_ENCRYPTION_KEY=.+$/m.test(src), 'the probe key must ship empty');
  });
});
