/**
 * Compile a .svelte component for the server and render it to HTML, so tests
 * can assert on real markup without a browser or any new dependency.
 *
 * Compiled output is written under .svelte-kit/ (already gitignored) rather
 * than a temp dir, so that `import 'svelte/server'` inside the generated code
 * resolves against the project's own node_modules.
 */
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = resolve(root, '.svelte-kit/ssr-tests');

/** Compile `path` and any .svelte components it imports; return the built file. */
function build(path, seen = new Map()) {
  const abs = resolve(root, path);
  if (seen.has(abs)) return seen.get(abs);

  const { js } = compile(readFileSync(abs, 'utf8'), {
    generate: 'server',
    filename: abs,
    runes: true,
  });

  let code = js.code;
  const out = resolve(outDir, relative(root, abs).replace(/[\\/]/g, '__') + '.js');
  seen.set(abs, out);

  // Rewrite relative .svelte imports to their compiled siblings, and $lib to a
  // real path — the compiled module is loaded by node, not by Vite.
  for (const [, spec] of code.matchAll(/from ['"]([^'"]+\.svelte)['"]/g)) {
    const childAbs = spec.startsWith('$lib/')
      ? resolve(root, 'src/lib', spec.slice('$lib/'.length))
      : resolve(dirname(abs), spec);
    const childOut = build(childAbs, seen);
    code = code.split(`'${spec}'`).join(`'${pathToFileURL(childOut).href}'`);
    code = code.split(`"${spec}"`).join(`"${pathToFileURL(childOut).href}"`);
  }
  code = code.replace(/from (['"])\$lib\//g, (m, q) => `from ${q}${pathToFileURL(resolve(root, 'src/lib')).href}/`);

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, code);
  return out;
}

/** Render a component to its server-side HTML string. */
export async function renderComponent(path, props = {}) {
  const mod = await import(pathToFileURL(build(path)).href);
  return render(mod.default, { props }).body;
}

/**
 * True when the HTML contains an <a> opened while another <a> is still open.
 * Browsers silently un-nest these, which desynchronises the DOM from what
 * Svelte hydrates.
 */
export function hasNestedAnchor(html) {
  let depth = 0;
  for (const [, closing] of html.matchAll(/<(\/?)a[\s>]/g)) {
    if (closing) {
      depth = Math.max(0, depth - 1);
    } else {
      if (depth > 0) return true;
      depth++;
    }
  }
  return false;
}
