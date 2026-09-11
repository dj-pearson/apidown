import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { focusableIn, nextFocusIndex, FOCUSABLE_SELECTOR } from '../src/lib/focus-trap.js';

/** Minimal stand-in for a DOM element. */
function el(attrs = {}) {
  const store = { ...attrs };
  return {
    hasAttribute: name => store[name] !== undefined,
    getAttribute: name => (store[name] === undefined ? null : store[name]),
    name: store.name,
  };
}

const root = children => ({ querySelectorAll: () => children });
const allRendered = () => true;

describe('nextFocusIndex', () => {
  test('moves forward through the list', () => {
    assert.equal(nextFocusIndex(3, 0), 1);
    assert.equal(nextFocusIndex(3, 1), 2);
  });

  test('wraps from the last element back to the first', () => {
    assert.equal(nextFocusIndex(3, 2), 0);
  });

  test('moves backward with shift', () => {
    assert.equal(nextFocusIndex(3, 2, true), 1);
  });

  test('wraps backward from the first element to the last', () => {
    assert.equal(nextFocusIndex(3, 0, true), 2);
  });

  test('enters at the start when focus is outside the trap', () => {
    assert.equal(nextFocusIndex(3, -1), 0);
  });

  test('enters at the end when shift-tabbing in from outside', () => {
    assert.equal(nextFocusIndex(3, -1, true), 2);
  });

  test('handles a single focusable element by staying on it', () => {
    assert.equal(nextFocusIndex(1, 0), 0);
    assert.equal(nextFocusIndex(1, 0, true), 0);
  });

  test('reports -1 when there is nothing to focus', () => {
    assert.equal(nextFocusIndex(0, -1), -1);
    assert.equal(nextFocusIndex(0, 0), -1);
  });

  test('recovers from an out-of-range current index', () => {
    assert.equal(nextFocusIndex(3, 99), 0);
    assert.equal(nextFocusIndex(3, 99, true), 2);
  });

  test('a full forward cycle returns to the start', () => {
    let i = 0;
    for (let n = 0; n < 4; n++) i = nextFocusIndex(4, i);
    assert.equal(i, 0);
  });
});

describe('focusableIn', () => {
  test('keeps ordinary focusable elements', () => {
    const items = [el({ name: 'a' }), el({ name: 'b' })];
    assert.deepEqual(focusableIn(root(items), allRendered).map(e => e.name), ['a', 'b']);
  });

  test('drops disabled elements', () => {
    const items = [el({ name: 'a' }), el({ name: 'b', disabled: '' })];
    assert.deepEqual(focusableIn(root(items), allRendered).map(e => e.name), ['a']);
  });

  test('drops elements hidden from assistive technology', () => {
    const items = [el({ name: 'a', 'aria-hidden': 'true' }), el({ name: 'b' })];
    assert.deepEqual(focusableIn(root(items), allRendered).map(e => e.name), ['b']);
  });

  test('drops elements taken out of the tab order', () => {
    const items = [el({ name: 'a', tabindex: '-1' }), el({ name: 'b', tabindex: '0' })];
    assert.deepEqual(focusableIn(root(items), allRendered).map(e => e.name), ['b']);
  });

  test('drops elements that are not rendered', () => {
    const items = [el({ name: 'a' }), el({ name: 'b' })];
    const visible = e => e.name !== 'a';
    assert.deepEqual(focusableIn(root(items), visible).map(e => e.name), ['b']);
  });

  test('returns an empty list for a missing root', () => {
    assert.deepEqual(focusableIn(null), []);
    assert.deepEqual(focusableIn({}), []);
  });

  test('the selector covers the standard interactive elements', () => {
    for (const s of ['a[href]', 'button', 'input', 'select', 'textarea', '[tabindex]']) {
      assert.ok(FOCUSABLE_SELECTOR.includes(s), s);
    }
  });
});
