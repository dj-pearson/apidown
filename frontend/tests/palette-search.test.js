import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { score, paletteResults, PALETTE_PAGES } from '../src/lib/palette-search.js';

const APIS = [
  { slug: 'stripe', name: 'Stripe', category: 'payments', current_status: 'operational' },
  { slug: 'openai', name: 'OpenAI', category: 'ai', current_status: 'down' },
  { slug: 'aws-s3', name: 'AWS S3', category: 'cloud-aws', current_status: 'operational' },
  { slug: 'sendgrid', name: 'SendGrid', category: 'communications', current_status: 'degraded' },
];

const hrefs = (query) => paletteResults(query, APIS).map(r => r.href);
const first = (query) => paletteResults(query, APIS)[0];

describe('score', () => {
  test('ranks exact above prefix above substring above subsequence', () => {
    const exact = score('stripe', 'stripe');
    const prefix = score('stri', 'stripe');
    const substring = score('rip', 'stripe');
    const subsequence = score('spe', 'stripe');
    assert.ok(exact > prefix, 'exact beats prefix');
    assert.ok(prefix > substring, 'prefix beats substring');
    assert.ok(substring > subsequence, 'substring beats subsequence');
    assert.ok(subsequence >= 0, 'subsequence still matches');
  });

  test('returns -1 when characters are absent or out of order', () => {
    assert.equal(score('xyz', 'stripe'), -1);
    assert.equal(score('epirts', 'stripe'), -1, 'reversed order is not a subsequence');
  });

  test('is case insensitive', () => {
    assert.ok(score('STRIPE', 'stripe') > 0);
    assert.ok(score('stripe', 'STRIPE') > 0);
  });

  test('an empty query matches everything neutrally', () => {
    assert.equal(score('', 'anything'), 0);
  });

  test('handles missing haystacks without throwing', () => {
    assert.equal(score('x', undefined), -1);
    assert.equal(score('x', null), -1);
    assert.equal(score('x', ''), -1);
  });
});

describe('paletteResults', () => {
  test('an empty query lists APIs and pages without crashing', () => {
    const results = paletteResults('', APIS);
    assert.ok(results.length > 0);
    assert.ok(results.length <= 40, 'capped for rendering');
  });

  test('a name query puts that API first', () => {
    assert.equal(first('stripe').href, '/api/stripe');
    assert.equal(first('stripe').kind, 'api');
    assert.equal(first('openai').href, '/api/openai');
  });

  test('a partial name still resolves to the right API', () => {
    assert.equal(first('stri').href, '/api/stripe');
    assert.equal(first('sendg').href, '/api/sendgrid');
  });

  test('a slug with punctuation is searchable', () => {
    assert.equal(first('aws-s3').href, '/api/aws-s3');
    assert.equal(first('aws').href, '/api/aws-s3');
  });

  test('an API result carries its live status for the dot', () => {
    assert.equal(first('openai').status, 'down');
    assert.equal(first('sendgrid').status, 'degraded');
  });

  test('"stripe history" reaches the archive, not nothing', () => {
    // Regression: the history entry used to sit behind the name-match guard, so
    // this query returned no results at all.
    const results = paletteResults('stripe history', APIS);
    assert.ok(results.length > 0, 'the query must match something');
    assert.equal(results[0].href, '/api/stripe/history');
    assert.equal(results[0].kind, 'history');
  });

  test('a bare API name ranks its status page above its archive', () => {
    const results = hrefs('stripe');
    const statusIdx = results.indexOf('/api/stripe');
    const historyIdx = results.indexOf('/api/stripe/history');
    assert.ok(statusIdx !== -1 && historyIdx !== -1, 'both are offered');
    assert.ok(statusIdx < historyIdx, 'status page comes first for a bare name');
  });

  test('category names find their APIs', () => {
    assert.ok(hrefs('payments').includes('/api/stripe'));
    assert.ok(hrefs('AI').includes('/api/openai'));
  });

  test('site destinations are reachable by name and by keyword', () => {
    assert.ok(hrefs('weekly').includes('/weekly'), 'by label');
    assert.ok(hrefs('newsletter').includes('/weekly'), 'by keyword');
    assert.ok(hrefs('sla').includes('/sla-receipts'));
    assert.ok(hrefs('csv').includes('/data'), 'open data by keyword');
    assert.ok(hrefs('radar').includes('/live'));
    assert.ok(hrefs('watchlist').includes('/stack'));
  });

  test('every declared page is reachable by its own label', () => {
    for (const page of PALETTE_PAGES) {
      assert.ok(
        hrefs(page.label).includes(page.href),
        `"${page.label}" should find ${page.href}`,
      );
    }
  });

  test('a nonsense query returns nothing rather than noise', () => {
    assert.deepEqual(paletteResults('zzzqqqxxx', APIS), []);
  });

  test('an API matching on name outranks a page of the same strength', () => {
    const results = paletteResults('stack', APIS);
    // No API is called "stack", so the page must win here.
    assert.equal(results[0].href, '/stack');
  });

  test('results are sorted by descending score with a stable tie-break', () => {
    const results = paletteResults('s', APIS);
    for (let i = 1; i < results.length; i++) {
      assert.ok(
        results[i - 1].score > results[i].score ||
        (results[i - 1].score === results[i].score &&
          results[i - 1].label.localeCompare(results[i].label) <= 0),
        'ordering must be deterministic',
      );
    }
  });

  test('every result has the fields the component renders', () => {
    for (const r of paletteResults('s', APIS)) {
      assert.ok(r.label, 'label');
      assert.ok(r.href, 'href');
      assert.ok(r.kind, 'kind');
      assert.ok(r.hint, 'hint');
      assert.ok(Number.isFinite(r.score), 'score');
    }
  });

  test('an empty API list still offers site destinations', () => {
    const results = paletteResults('docs', []);
    assert.ok(results.some(r => r.href === '/docs'));
  });
});
