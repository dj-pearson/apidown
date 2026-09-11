import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  orderPair,
  isCanonicalOrder,
  comparePath,
  peersForApi,
  allComparePairs,
  featuredComparisons,
} from '../src/lib/compare-pairs.js';

const APIS = [
  { slug: 'stripe', name: 'Stripe', category: 'payments', current_status: 'operational' },
  { slug: 'adyen', name: 'Adyen', category: 'payments', current_status: 'down' },
  { slug: 'braintree', name: 'Braintree', category: 'payments', current_status: 'operational' },
  { slug: 'openai', name: 'OpenAI', category: 'ai', current_status: 'operational' },
  { slug: 'anthropic', name: 'Anthropic', category: 'ai', current_status: 'degraded' },
  { slug: 'acme-internal', name: 'Acme', category: 'ai', current_status: 'operational', owner_id: 'u1' },
  { slug: 'lonely', name: 'Lonely', category: 'search', current_status: 'operational' },
  { slug: 'uncategorised', name: 'Uncategorised', category: null, current_status: 'operational' },
];

describe('orderPair / comparePath', () => {
  test('orders slugs ascending regardless of input order', () => {
    assert.deepEqual(orderPair('stripe', 'adyen'), ['adyen', 'stripe']);
    assert.deepEqual(orderPair('adyen', 'stripe'), ['adyen', 'stripe']);
  });

  test('both orientations produce one canonical path', () => {
    assert.equal(comparePath('stripe', 'adyen'), '/compare/adyen/vs/stripe');
    assert.equal(comparePath('adyen', 'stripe'), comparePath('stripe', 'adyen'));
  });

  test('isCanonicalOrder flags the orientation that should redirect', () => {
    assert.equal(isCanonicalOrder('adyen', 'stripe'), true);
    assert.equal(isCanonicalOrder('stripe', 'adyen'), false);
    assert.equal(isCanonicalOrder('stripe', 'stripe'), true);
  });

  test('tolerates missing slugs without throwing', () => {
    assert.equal(comparePath(undefined, 'stripe'), '/compare//vs/stripe');
  });
});

describe('peersForApi', () => {
  test('returns same-category peers only', () => {
    const peers = peersForApi('stripe', APIS);
    assert.deepEqual(peers.map(p => p.slug).sort(), ['adyen', 'braintree']);
  });

  test('excludes private (owner_id) APIs', () => {
    const peers = peersForApi('openai', APIS);
    assert.deepEqual(peers.map(p => p.slug), ['anthropic']);
  });

  test('ranks a differing status above a matching one', () => {
    const peers = peersForApi('stripe', APIS);
    assert.equal(peers[0].slug, 'adyen', 'the down peer should lead');
  });

  test('attaches the canonical compare path', () => {
    const peers = peersForApi('stripe', APIS);
    assert.equal(peers.find(p => p.slug === 'adyen').comparePath, '/compare/adyen/vs/stripe');
  });

  test('never includes the API itself', () => {
    assert.ok(!peersForApi('stripe', APIS).some(p => p.slug === 'stripe'));
  });

  test('empty for an unknown slug, a lone-in-category API, and limit 0', () => {
    assert.deepEqual(peersForApi('nope', APIS), []);
    assert.deepEqual(peersForApi('lonely', APIS), []);
    assert.deepEqual(peersForApi('stripe', APIS, 0), []);
  });

  test('respects the limit', () => {
    assert.equal(peersForApi('stripe', APIS, 1).length, 1);
  });

  test('is deterministic across calls', () => {
    assert.deepEqual(peersForApi('stripe', APIS), peersForApi('stripe', APIS));
  });
});

describe('allComparePairs', () => {
  const pairs = allComparePairs(APIS);

  test('produces every same-category combination once', () => {
    assert.deepEqual(pairs, [
      ['anthropic', 'openai'],
      ['adyen', 'braintree'],
      ['adyen', 'stripe'],
      ['braintree', 'stripe'],
    ]);
  });

  test('every pair is in canonical order', () => {
    for (const [a, b] of pairs) assert.ok(a < b, `${a} < ${b}`);
  });

  test('skips private and uncategorised APIs', () => {
    const flat = pairs.flat();
    assert.ok(!flat.includes('acme-internal'));
    assert.ok(!flat.includes('uncategorised'));
  });

  test('caps per category', () => {
    assert.equal(allComparePairs(APIS, { perCategory: 1 }).length, 2); // one per category
    assert.deepEqual(allComparePairs(APIS, { perCategory: 0 }), []);
  });

  test('handles empty and nullish input', () => {
    assert.deepEqual(allComparePairs([]), []);
    assert.deepEqual(allComparePairs(null), []);
  });

  test('deduplicates repeated slugs', () => {
    const dup = [...APIS, { slug: 'stripe', name: 'Stripe', category: 'payments' }];
    assert.equal(allComparePairs(dup).length, pairs.length);
  });
});

describe('featuredComparisons', () => {
  test('groups by category, largest group first', () => {
    const groups = featuredComparisons(APIS);
    assert.deepEqual(groups.map(g => g.category), ['payments', 'ai']);
    assert.equal(groups[0].comparisons.length, 3);
  });

  test('carries display names and canonical paths', () => {
    const first = featuredComparisons(APIS)[0].comparisons[0];
    assert.equal(first.a.name, 'Adyen');
    assert.equal(first.b.name, 'Braintree');
    assert.equal(first.path, '/compare/adyen/vs/braintree');
  });

  test('respects perCategory and maxCategories', () => {
    assert.equal(featuredComparisons(APIS, { perCategory: 1 })[0].comparisons.length, 1);
    assert.equal(featuredComparisons(APIS, { maxCategories: 1 }).length, 1);
  });

  test('drops categories with no pairs', () => {
    assert.ok(!featuredComparisons(APIS).some(g => g.category === 'search'));
  });
});
