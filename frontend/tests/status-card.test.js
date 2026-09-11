import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { renderComponent, hasNestedAnchor } from './helpers/ssr.js';

const CARD = 'src/lib/components/StatusCard.svelte';
const api = { slug: 'stripe', name: 'Stripe', current_status: 'down', logo_url: null };

describe('hasNestedAnchor', () => {
  test('detects an anchor inside an anchor', () => {
    assert.equal(hasNestedAnchor('<a href="/x">t <a href="/y">u</a></a>'), true);
  });

  test('accepts sibling anchors', () => {
    assert.equal(hasNestedAnchor('<a href="/x">t</a><a href="/y">u</a>'), false);
  });

  test('accepts markup with no anchors', () => {
    assert.equal(hasNestedAnchor('<div><span>hi</span></div>'), false);
  });

  test('is not fooled by tag names starting with "a"', () => {
    assert.equal(hasNestedAnchor('<a href="/x"><article>t</article></a>'), false);
  });
});

describe('StatusCard markup', () => {
  let withGrade, withoutGrade;

  before(async () => {
    withGrade = await renderComponent(CARD, { api, sparkline: [1, 2, 3], grade: 'B', gradeColor: '#22c55e' });
    withoutGrade = await renderComponent(CARD, { api, sparkline: [1, 2, 3] });
  });

  test('never nests the grade link inside the card link', () => {
    assert.equal(hasNestedAnchor(withGrade), false, withGrade);
  });

  test('is anchor-free of nesting without a grade too', () => {
    assert.equal(hasNestedAnchor(withoutGrade), false);
  });

  test('links the card to the API detail page', () => {
    assert.match(withGrade, /href="\/api\/stripe"/);
  });

  test('links the grade badge to the report card', () => {
    assert.match(withGrade, /href="\/api\/stripe\/report-card"/);
  });

  test('omits the grade badge when no grade is supplied', () => {
    assert.ok(!withoutGrade.includes('/report-card'));
  });

  test('gives the grade badge a descriptive accessible name', () => {
    assert.match(withGrade, /aria-label="Reliability grade B[^"]*Stripe/);
  });

  test('exposes the status in the card link for screen readers', () => {
    assert.match(withGrade, /Stripe<span class="sr-only">\s*—\s*Down<\/span>/);
  });

  test('renders the status label and a placeholder for a missing logo', () => {
    assert.ok(withGrade.includes('Down'));
    assert.match(withGrade, /logo-placeholder/);
  });
});
