/**
 * Small static checks over Svelte markup, for defects that are easy to
 * reintroduce and invisible until someone uses a screen reader.
 */

/** Comments are not markup — strip them before matching tags. */
function stripComments(source) {
  return source.replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * Every <label> in `source` that names nothing: no `for` attribute, and no form
 * control nested inside it. Such a label is decoration — assistive technology
 * reads the input as unlabelled.
 *
 * Returns `{ line, text }` for each offender.
 */
export function unassociatedLabels(input) {
  const source = stripComments(input);
  const found = [];
  const re = /<label\b([^>]*)>([\s\S]*?)<\/label>/g;

  for (const match of source.matchAll(re)) {
    const [full, attrs, inner] = match;
    if (/\bfor=/.test(attrs)) continue;
    if (/<(input|select|textarea)\b/.test(inner)) continue;

    found.push({
      line: source.slice(0, match.index).split('\n').length,
      text: full.slice(0, 80).replace(/\s+/g, ' '),
    });
  }
  return found;
}

/**
 * Elements carrying an interactive ARIA role that give no accessible name via
 * aria-label, aria-labelledby or title, and hold no text of their own.
 */
export function unnamedWidgets(input, roles = ['switch', 'tab', 'checkbox', 'radio']) {
  const source = stripComments(input);
  const found = [];
  const rolePattern = roles.join('|');
  const re = new RegExp(`<(button|div|span)\\b([^>]*role="(?:${rolePattern})"[^>]*)>([\\s\\S]*?)</\\1>`, 'g');

  for (const match of source.matchAll(re)) {
    const [full, , attrs, inner] = match;
    if (/\baria-label(ledby)?=|title=/.test(attrs)) continue;
    // Text that is not inside a nested tag counts as the accessible name.
    if (inner.replace(/<[^>]*>/g, '').trim()) continue;

    found.push({
      line: source.slice(0, match.index).split('\n').length,
      text: full.slice(0, 80).replace(/\s+/g, ' '),
    });
  }
  return found;
}
