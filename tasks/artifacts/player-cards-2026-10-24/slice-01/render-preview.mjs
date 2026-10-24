import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, '../../../../web');
const require = createRequire(path.join(web, 'package.json'));
const { build } = require('esbuild');
const sass = require('sass');
const result = await build({
  absWorkingDir: web,
  alias: { react: path.dirname(require.resolve('react/package.json')), 'react-dom': path.dirname(require.resolve('react-dom/package.json')) },
  entryPoints: [path.join(here, 'preview-entry.tsx')],
  bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'fixture-sass', setup(build) {
    build.onLoad({ filter: /\.module\.scss$/ }, async ({ path: filename }) => {
      const css = sass.compile(filename, { loadPaths: [web], style: 'compressed', silenceDeprecations: ['legacy-js-api'] }).css;
      const names = [...new Set([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(match => match[1]))];
      return { contents: `const s=document.createElement('style');s.textContent=${JSON.stringify(css)};document.head.append(s);export default ${JSON.stringify(Object.fromEntries(names.map(name => [name,name])))};`, loader: 'js' };
    });
  }}],
});
const script = result.outputFiles[0].text.replaceAll('</script', '<\\/script');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'"><title>FHFH player cards · synthetic preview</title><style>*{box-sizing:border-box}body{margin:0;background:#101214;color:#f4f8fb;font-family:Arial,sans-serif;-webkit-font-smoothing:antialiased}button,input,select{font:inherit}button{cursor:pointer}</style></head><body><div id="root"></div><script>${script}</script></body></html>`;
await writeFile(path.join(here, 'preview.html'), html);
console.log(JSON.stringify({ artifact: path.join(here,'preview.html'), bytes: Buffer.byteLength(html), sourceEntry: path.join(here,'preview-entry.tsx') }));

