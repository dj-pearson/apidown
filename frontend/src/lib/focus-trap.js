/**
 * Keyboard containment for modal dialogs.
 *
 * A dialog that does not move focus into itself is a dialog a keyboard user
 * cannot reach or dismiss: Escape handlers bound to the overlay never fire,
 * because the key event is dispatched at whatever still has focus outside it.
 * And a dialog that does not contain Tab lets focus wander behind the backdrop
 * onto controls the user cannot see.
 */

/** Elements that can hold focus, in document order. */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  '[tabindex]',
].join(',');

/** Rendered and not disabled — the default visibility test in a browser. */
function renderedInBrowser(el) {
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects?.().length);
}

/**
 * Focusable descendants of `root`, skipping anything disabled, hidden from
 * assistive technology, or removed from the tab order.
 */
export function focusableIn(root, isRendered = renderedInBrowser) {
  if (!root?.querySelectorAll) return [];
  return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter(el => {
    if (el.hasAttribute('disabled')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    if (el.getAttribute('tabindex') === '-1') return false;
    return isRendered(el);
  });
}

/**
 * Where Tab should land next, wrapping at both ends so focus never escapes.
 * `current` is -1 when focus is not on any of the trapped elements — Tab then
 * enters at the start and Shift+Tab at the end.
 */
export function nextFocusIndex(count, current, shift = false) {
  if (count <= 0) return -1;
  if (current < 0 || current >= count) return shift ? count - 1 : 0;
  return shift ? (current - 1 + count) % count : (current + 1) % count;
}
