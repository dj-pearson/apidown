import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { unassociatedLabels, unnamedWidgets, pageReloads } from '../src/lib/markup-lint.js';

describe('unassociatedLabels', () => {
  test('flags a label with no for and no nested control', () => {
    assert.equal(unassociatedLabels('<label>Title</label><input />').length, 1);
  });

  test('accepts a label with a for attribute', () => {
    assert.equal(unassociatedLabels('<label for="t">Title</label><input id="t" />').length, 0);
  });

  test('accepts a label wrapping its control', () => {
    assert.equal(unassociatedLabels('<label>Title <input /></label>').length, 0);
    assert.equal(unassociatedLabels('<label>Pick <select></select></label>').length, 0);
    assert.equal(unassociatedLabels('<label>Notes <textarea></textarea></label>').length, 0);
  });

  test('reports the line number', () => {
    const [hit] = unassociatedLabels('\n\n<label>Title</label>');
    assert.equal(hit.line, 3);
  });

  test('finds several offenders', () => {
    assert.equal(unassociatedLabels('<label>A</label><label>B</label>').length, 2);
  });
});

describe('unnamedWidgets', () => {
  test('flags a switch with no accessible name', () => {
    assert.equal(unnamedWidgets('<button role="switch"><span></span></button>').length, 1);
  });

  test('accepts aria-labelledby, aria-label and title', () => {
    assert.equal(unnamedWidgets('<button role="switch" aria-labelledby="x"><span></span></button>').length, 0);
    assert.equal(unnamedWidgets('<button role="switch" aria-label="On"><span></span></button>').length, 0);
    assert.equal(unnamedWidgets('<button role="switch" title="On"><span></span></button>').length, 0);
  });

  test('accepts a widget whose own text names it', () => {
    assert.equal(unnamedWidgets('<button role="switch">Enabled</button>').length, 0);
  });

  test('ignores roles it is not asked about', () => {
    assert.equal(unnamedWidgets('<button role="button"></button>').length, 0);
  });
});

describe('every Svelte component in the app', () => {
  const files = globSync('src/**/*.svelte');

  test('there are components to check', () => {
    assert.ok(files.length > 10, `only found ${files.length}`);
  });

  test('has no <label> that names nothing', () => {
    const offenders = [];
    for (const file of files) {
      for (const hit of unassociatedLabels(readFileSync(file, 'utf8'))) {
        offenders.push(`${file}:${hit.line}  ${hit.text}`);
      }
    }
    assert.deepEqual(offenders, [], `\n${offenders.join('\n')}\n`);
  });

  test('has no unnamed switch, tab, checkbox or radio widget', () => {
    const offenders = [];
    for (const file of files) {
      for (const hit of unnamedWidgets(readFileSync(file, 'utf8'))) {
        offenders.push(`${file}:${hit.line}  ${hit.text}`);
      }
    }
    assert.deepEqual(offenders, [], `\n${offenders.join('\n')}\n`);
  });
});

describe('comments are not markup', () => {
  test('a <label> mentioned inside a comment is not flagged', () => {
    const src = '<!-- a <label for> cannot name a button -->\n<label for="t">T</label><input id="t" />';
    assert.deepEqual(unassociatedLabels(src), []);
  });

  test('a commented-out switch is not flagged', () => {
    assert.deepEqual(unnamedWidgets('<!-- <button role="switch"><span></span></button> -->'), []);
  });
});

describe('pageReloads', () => {
  test('flags location.reload and window.location.reload', () => {
    assert.equal(pageReloads('location.reload()').length, 1);
    assert.equal(pageReloads('window.location.reload()').length, 1);
  });

  test('tolerates whitespace', () => {
    assert.equal(pageReloads('window . location . reload ()').length, 1);
  });

  test('ignores unrelated code and comments', () => {
    assert.equal(pageReloads('invalidateAll()').length, 0);
    assert.equal(pageReloads('// location.reload() is banned').length, 0);
  });

  test('reports the line', () => {
    assert.equal(pageReloads('\na\nlocation.reload()')[0].line, 3);
  });
});

describe('no component reloads the page', () => {
  // A reload discards client state. The dashboard used to call it straight
  // after minting an API key, throwing the key away before the user could
  // copy it — and the server never returns that key again.
  test('src/**/*.svelte uses invalidateAll() instead of location.reload()', () => {
    const offenders = [];
    for (const file of globSync('src/**/*.svelte')) {
      for (const hit of pageReloads(readFileSync(file, 'utf8'))) {
        offenders.push(`${file}:${hit.line}  ${hit.text}`);
      }
    }
    assert.deepEqual(offenders, [], `\n${offenders.join('\n')}\n`);
  });
});

describe('code-comment stripping preserves URLs', () => {
  test('a https:// URL is not treated as a comment', () => {
    const src = 'const u = "https://example.com/x";\nlocation.reload()';
    assert.equal(pageReloads(src).length, 1, 'the real call after a URL must still be found');
  });

  test('a block comment is stripped', () => {
    assert.equal(pageReloads('/* location.reload() */').length, 0);
  });
});
