import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { renderComponent, hasNestedAnchor } from './helpers/ssr.js';

const MODAL = 'src/lib/components/Modal.svelte';

describe('Modal markup', () => {
  let open, labelled, closed;

  before(async () => {
    open = await renderComponent(MODAL, { open: true, title: 'Upgrade' });
    labelled = await renderComponent(MODAL, { open: true, labelledBy: 'heading-id' });
    closed = await renderComponent(MODAL, { open: false, title: 'Upgrade' });
  });

  test('renders nothing while closed', () => {
    assert.ok(!closed.includes('modal-dialog'));
    assert.ok(!closed.includes('modal-backdrop'));
  });

  test('announces itself as a modal dialog', () => {
    assert.match(open, /role="dialog"/);
    assert.match(open, /aria-modal="true"/);
  });

  test('is focusable so focus can be moved into it', () => {
    assert.match(open, /tabindex="-1"/);
  });

  test('takes its accessible name from the title prop', () => {
    assert.match(open, /aria-label="Upgrade"/);
  });

  test('prefers an in-dialog heading when labelledBy is given', () => {
    assert.match(labelled, /aria-labelledby="heading-id"/);
    assert.ok(!/aria-label="/.test(labelled), 'should not also set aria-label');
  });

  test('marks the backdrop as presentational', () => {
    assert.match(open, /class="modal-backdrop[^"]*"[^>]*role="presentation"/);
  });

  test('renders the backdrop outside the dialog, not wrapping it', () => {
    const backdrop = open.indexOf('modal-backdrop');
    const dialog = open.indexOf('modal-dialog');
    assert.ok(backdrop < dialog, 'backdrop should precede the dialog');
    assert.ok(!hasNestedAnchor(open));
  });

  test('applies a caller-supplied class alongside its own', async () => {
    const custom = await renderComponent(MODAL, { open: true, title: 'X', dialogClass: 'upgrade-modal' });
    assert.match(custom, /class="modal-dialog upgrade-modal[^"]*"/);
  });

  test('emits no stray separator when no extra class is given', () => {
    assert.ok(!/class="modal-dialog {2}/.test(open), open);
  });
});
