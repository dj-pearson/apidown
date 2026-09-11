import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Endpoints named on /docs should exist.
 *
 * /docs advertised POST /v1/keys (the route is /v1/api-keys) and
 * GET /v1/reports/sla (the route is /api-status/{slug}/sla). Both 404, and
 * both were the documented way to do something the product charges for.
 */
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DOCS = resolve(repo, 'frontend/src/routes/docs/+page.svelte');

/** Paths mentioned on /docs that are prose, not endpoint references. */
const NOT_ENDPOINTS = new Set([
  '/v1', // named when describing the public API as a whole
]);

/** Turn a SvelteKit route directory into a comparable path pattern. */
function svelteKitRoutes() {
  const root = resolve(repo, 'frontend/src/routes');
  const found = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === '+server.js') {
        const path = '/' + relative(root, dir).split(/[\\/]/).join('/');
        found.push(path === '/.' ? '/' : path);
      }
    }
  })(root);
  return found;
}

/** Fastify routes declared in the ingest service. */
function ingestRoutes() {
  const dir = resolve(repo, 'services/ingest/src/routes');
  const found = [];
  for (const file of readdirSync(dir)) {
    const src = readFileSync(join(dir, file), 'utf8');
    for (const m of src.matchAll(/fastify\.(?:get|post|put|delete)\(\s*['"]([^'"]+)['"]/g)) {
      found.push(m[1]);
    }
  }
  return found;
}

/** Normalise :id, [slug] and {slug} to one placeholder so they compare. */
function normalise(path) {
  return path
    .replace(/&#123;[^&]*&#125;/g, '{p}')
    .replace(/\{[^}]*\}/g, '{p}')
    .replace(/\[+[^\]]*\]+/g, '{p}')
    .replace(/:[^/]+/g, '{p}')
    .replace(/\?.*$/, '')
    .replace(/\/+$/, '') || '/';
}

function documentedPaths() {
  const src = readFileSync(DOCS, 'utf8');
  return [...src.matchAll(/<code>(\/(?:v1|api-status)[^<]*)<\/code>/g)]
    .map(m => m[1].trim())
    .filter(p => !NOT_ENDPOINTS.has(p));
}

/**
 * A documented path matches a route when they have the same shape and every
 * segment agrees — a `{p}` segment in the route matches any single literal, so
 * a documented /v1/weekly/latest is satisfied by the route /v1/weekly/[week].
 */
function matches(docPath, routePath) {
  const a = normalise(docPath).split('/');
  const b = normalise(routePath).split('/');
  if (a.length !== b.length) return false;
  return a.every((seg, i) => b[i] === '{p}' || b[i] === seg);
}

describe('/docs endpoint references', () => {
  const known = [...svelteKitRoutes(), ...ingestRoutes()];

  test('finds routes on both sides to compare', () => {
    assert.ok(known.length > 10, `only found ${known.length} routes`);
    assert.ok(documentedPaths().length > 5, 'expected several documented endpoints');
  });

  test('every documented endpoint resolves to a real route', () => {
    const missing = documentedPaths()
      .filter(p => !known.some(route => matches(p, route)))
      .map(p => `${p}  (normalised: ${normalise(p)})`);
    assert.deepEqual(missing, [], `\nDocumented but not implemented:\n  ${missing.join('\n  ')}\n`);
  });

  test('the matcher accepts a literal in a parameter slot but not a wrong path', () => {
    assert.ok(matches('/v1/weekly/latest', '/v1/weekly/[week]'));
    assert.ok(matches('/api-status/&#123;slug&#125;/sla', '/api-status/[slug]/sla'));
    assert.ok(!matches('/v1/keys', '/v1/api-keys'));
    assert.ok(!matches('/v1/apis', '/v1/apis/[slug]'));
  });

  test('the two endpoints that were wrong are now right', () => {
    const src = readFileSync(DOCS, 'utf8');
    assert.ok(src.includes('/v1/api-keys'), 'key creation endpoint');
    assert.ok(!/<code>\/v1\/keys<\/code>/.test(src), '/v1/keys does not exist');
    assert.ok(!/\/v1\/reports\/sla/.test(src), '/v1/reports/sla does not exist');
  });
});
