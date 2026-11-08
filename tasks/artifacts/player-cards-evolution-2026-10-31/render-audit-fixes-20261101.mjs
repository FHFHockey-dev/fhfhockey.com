import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url)), web = path.resolve(here, '../../../web');
const require = createRequire(path.join(web, 'package.json'));
const result = await require('esbuild').build({
  absWorkingDir: web, entryPoints: [path.join(here, 'audit-fixes-entry-20261101.tsx')],
  alias: { react: path.dirname(require.resolve('react/package.json')), 'react-dom': path.dirname(require.resolve('react-dom/package.json')) },
  bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
});
await writeFile(path.join(here, 'audit-fixes-repro-20261101.html'), '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; connect-src \'none\'"></head><body style="margin:0"><div id="root"></div><script>' + result.outputFiles[0].text.replaceAll('</script', '<\\/script') + '</script></body></html>');
console.log('Offline exact-case reproduction compiled.');
