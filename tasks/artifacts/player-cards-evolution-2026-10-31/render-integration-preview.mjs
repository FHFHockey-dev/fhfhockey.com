import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, '../../../web');
const require = createRequire(path.join(web, 'package.json'));
const { build } = require('esbuild');
const sass = require('sass');
const result = await build({
  absWorkingDir: web,
  alias: { react: path.dirname(require.resolve('react/package.json')), 'react-dom': path.dirname(require.resolve('react-dom/package.json')) },
  entryPoints: [path.join(here, 'preview-entry.tsx')],
  bundle: true, metafile: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'review-only-integration', setup(build) { build.onLoad({ filter: /CurrentPlayerCardStudio\.tsx$/ }, async ({ path: filename }) => ({ contents: await readFile(path.join(here, 'integration/CurrentPlayerCardStudio.tsx'), 'utf8'), loader: 'tsx', resolveDir: path.dirname(filename) })); } }, { name: 'fixture-sass', setup(build) {
    build.onLoad({ filter: /\.module\.scss$/ }, async ({ path: filename }) => {
      const css = sass.compile(filename, { loadPaths: [web], style: 'compressed', silenceDeprecations: ['legacy-js-api'] }).css;
      const names = [...new Set([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(match => match[1]))];
      const prefix = path.basename(filename).replace(/\W/g, '_');
      const scoped = css.replace(/\.([a-zA-Z_][\w-]*)/g, (_, name) => '.' + prefix + '_' + name);
      return { contents: `const s=document.createElement('style');s.textContent=${JSON.stringify(scoped)};document.head.append(s);export default ${JSON.stringify(Object.fromEntries(names.map(name => [name, prefix + "_" + name])))};`, loader: 'js' };
    });
  }}],
});
const browserInputs = Object.keys(result.metafile.inputs);
if (browserInputs.some(p => p.endsWith('lib/supabase/server.ts') || p.endsWith('projections/dailyBoardEvidence.ts'))) throw new Error('Server evidence loader crossed the browser boundary');
await writeFile(path.join(here, 'INTEGRATION-BROWSER-IMPORTS.json'), JSON.stringify({ serverEvidenceAndCredentialsExcluded: true, inputs: browserInputs }, null, 2) + '\n');
const css = await readFile(path.join(here, 'preview.css'), 'utf8');
const script = result.outputFiles[0].text.replaceAll('</script', '<\\/script');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'"><title>FHFH · editorial card checkpoint</title><style>${css}</style></head><body><div id="root"></div><script>${script}</script></body></html>`;
await writeFile(path.join(here, 'integration-preview.html'), html);
console.log(JSON.stringify({ artifact: path.join(here,'integration-preview.html'), bytes: Buffer.byteLength(html), sourceEntry: path.join(here,'preview-entry.tsx') }));
