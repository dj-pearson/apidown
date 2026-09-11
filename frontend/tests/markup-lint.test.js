import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { unassociatedLabels, unnamedWidgets } from '../src/lib/markup-lint.js';

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
