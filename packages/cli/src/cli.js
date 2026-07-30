#!/usr/bin/env node
/**
 * apidown — check whether a third-party API is actually down, from the terminal.
 *
 * Reads the public APIdown /v1 API. No key, no account, no config.
 * Exit codes are meant to be used in scripts:
 *   0  the API is operational (or the command was informational)
 *   1  usage error, unknown API, or the request failed
 *   2  the API is degraded
 *   3  the API is down
 */

const BASE = process.env.APIDOWN_API_BASE || 'https://apidown.net';
const VERSION = '1.0.0';

const EXIT = { ok: 0, error: 1, degraded: 2, down: 3 };

// Colour only when stdout is a TTY and the user has not opted out.
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s) => c('1', s);
const dim = (s) => c('2', s);
const green = (s) => c('32', s);
const yellow = (s) => c('33', s);
const red = (s) => c('31', s);

const STATUS_STYLE = {
  operational: { colour: green, label: 'OPERATIONAL', exit: EXIT.ok },
  degraded: { colour: yellow, label: 'DEGRADED', exit: EXIT.degraded },
  down: { colour: red, label: 'DOWN', exit: EXIT.down },
};

const HELP = `${bold('apidown')} — is that API actually down, or is it your code?

${bold('Usage')}
  npx apidown <api-slug>        Status, latency, uptime, and any open incident
  npx apidown list [--down]     Every tracked API and its current status
  npx apidown incidents [slug]  Recent incidents, newest first

${bold('Options')}
  --json        Machine-readable output
  --limit <n>   Number of incidents to show (default 10)
  --down        With "list", show only APIs that are down or degraded
  -h, --help    This help
  -v, --version Print the version

${bold('Exit codes')}
  0 operational   2 degraded   3 down   1 usage error or request failure

${bold('Examples')}
  npx apidown stripe
  npx apidown list --down
  npx apidown incidents openai --limit 3
  npx apidown openai --json | jq .status

${dim(`Data from ${BASE} — measured from real client-side traffic, not vendor status pages.`)}
`;

function parseArgs(argv) {
  const flags = { json: false, down: false, limit: 10 };
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') flags.json = true;
    else if (arg === '--down') flags.down = true;
    else if (arg === '--limit') {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n < 1) throw new Error('--limit needs a positive number');
      flags.limit = Math.min(Math.floor(n), 100);
    } else if (arg === '-h' || arg === '--help') flags.help = true;
    else if (arg === '-v' || arg === '--version') flags.version = true;
    else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    else positional.push(arg);
  }

  return { flags, positional };
}

async function get(path) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { Accept: 'application/json', 'User-Agent': `apidown-cli/${VERSION}` },
    });
  } catch (err) {
    throw new Error(`Could not reach ${BASE}: ${err.message}`);
  }

  let body;
  try {
    body = await res.json();
  } catch {
    throw new Error(`${BASE} returned a non-JSON response (HTTP ${res.status})`);
  }

  if (!res.ok) {
    throw new Error(body?.error?.message || `Request failed with HTTP ${res.status}`);
  }
  return body;
}

function ms(v) {
  return v === null || v === undefined ? '—' : `${v}ms`;
}

function pct(v) {
  return v === null || v === undefined ? '—' : `${v}%`;
}

function ago(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

async function cmdStatus(slug, flags) {
  const { data } = await get(`/v1/apis/${encodeURIComponent(slug)}`);

  if (flags.json) {
    console.log(JSON.stringify(data, null, 2));
    return STATUS_STYLE[data.status]?.exit ?? EXIT.ok;
  }

  const style = STATUS_STYLE[data.status] || STATUS_STYLE.operational;
  const w = data.window_24h || {};
  const m = data.window_30d || {};

  console.log('');
  console.log(`  ${bold(data.name)}  ${style.colour(style.label)}`);
  console.log('');
  console.log(`  ${dim('p50 / p95 (24h)')}  ${ms(w.p50_ms)} / ${ms(w.p95_ms)}`);
  console.log(`  ${dim('error rate (24h)')}  ${w.error_rate === null || w.error_rate === undefined ? '—' : `${(w.error_rate * 100).toFixed(2)}%`}`);
  console.log(`  ${dim('uptime (24h)')}     ${pct(w.uptime_pct)}`);
  console.log(`  ${dim('uptime (30d)')}     ${pct(m.uptime_pct)}   ${dim(`${m.incident_count ?? 0} incidents`)}`);

  const open = data.open_incidents || [];
  if (open.length > 0) {
    console.log('');
    console.log(`  ${bold('Open incidents')}`);
    for (const inc of open) {
      console.log(`  ${style.colour('•')} ${inc.title} ${dim(`(${inc.severity}, started ${ago(inc.started_at)})`)}`);
      console.log(`    ${dim(inc.url)}`);
    }
  }

  console.log('');
  console.log(`  ${dim(data.url)}`);
  console.log('');

  return style.exit;
}

async function cmdList(flags) {
  const { data, meta } = await get('/v1/apis?limit=200');
  const rows = flags.down ? data.filter(a => a.status !== 'operational') : data;

  if (flags.json) {
    console.log(JSON.stringify({ data: rows, meta }, null, 2));
    return EXIT.ok;
  }

  if (rows.length === 0) {
    console.log(flags.down ? green('\n  Everything is operational.\n') : '\n  No APIs tracked.\n');
    return EXIT.ok;
  }

  const width = Math.max(...rows.map(a => a.name.length));
  console.log('');
  for (const api of rows) {
    const style = STATUS_STYLE[api.status] || STATUS_STYLE.operational;
    const latency = api.p95_ms === null ? '' : dim(`  p95 ${api.p95_ms}ms`);
    console.log(`  ${style.colour('●')} ${api.name.padEnd(width)}  ${style.colour(api.status)}${latency}`);
  }
  const s = meta?.summary;
  if (s) {
    console.log('');
    console.log(`  ${dim(`${s.operational} operational · ${s.degraded} degraded · ${s.down} down`)}`);
  }
  console.log('');

  // Exit non-zero when anything is impaired so `apidown list --down` can gate a script.
  if (rows.some(a => a.status === 'down')) return EXIT.down;
  if (rows.some(a => a.status === 'degraded')) return EXIT.degraded;
  return EXIT.ok;
}

async function cmdIncidents(slug, flags) {
  const params = new URLSearchParams({ limit: String(flags.limit) });
  if (slug) params.set('api', slug);
  const { data } = await get(`/v1/incidents?${params}`);

  if (flags.json) {
    console.log(JSON.stringify(data, null, 2));
    return EXIT.ok;
  }

  if (data.length === 0) {
    console.log(`\n  ${green('No incidents recorded')}${slug ? ` for ${slug}` : ''}.\n`);
    return EXIT.ok;
  }

  console.log('');
  for (const inc of data) {
    const open = inc.status !== 'resolved';
    const mark = open ? red('●') : green('○');
    console.log(`  ${mark} ${bold(inc.api)}  ${inc.title}`);
    console.log(`    ${dim(`${inc.severity} · ${inc.status} · started ${ago(inc.started_at)}`)}`);
  }
  console.log('');
  return EXIT.ok;
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(red(err.message));
    console.error(dim('Run `apidown --help` for usage.'));
    return EXIT.error;
  }

  const { flags, positional } = parsed;

  if (flags.version) {
    console.log(VERSION);
    return EXIT.ok;
  }
  if (flags.help || positional.length === 0) {
    console.log(HELP);
    return positional.length === 0 && !flags.help ? EXIT.error : EXIT.ok;
  }

  const [command, arg] = positional;

  try {
    if (command === 'list') return await cmdList(flags);
    if (command === 'incidents') return await cmdIncidents(arg, flags);
    // Anything else is treated as an API slug.
    return await cmdStatus(command, flags);
  } catch (err) {
    console.error(red(err.message));
    if (/No tracked API/.test(err.message)) {
      console.error(dim('Run `apidown list` to see valid slugs.'));
    }
    return EXIT.error;
  }
}

main().then(code => process.exit(code));
