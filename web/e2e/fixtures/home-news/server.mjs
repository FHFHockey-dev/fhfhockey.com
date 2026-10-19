import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(root, '../../..');
const data = path.join(root, 'data.tsx');
const mocks = { 'hooks/useCurrentSeason': 'useCurrentSeason', 'lib/supabase/public-client': 'supabase', 'next/image': 'Image', 'next/legacy/image': 'Image' };
const cache = await mkdtemp(path.join(tmpdir(), 'fhfh-home-news-fixture-'));
const server = await createServer({
  configFile: false, root, publicDir: path.join(web, 'public'), envDir: cache, cacheDir: cache,
  plugins: [{
    name: 'offline-home-news', enforce: 'pre',
    resolveId(source) {
      const key = source.startsWith(web + '/') ? source.slice(web.length + 1).replace(/\.tsx?$/, '') : source;
      if (mocks[key]) return '\0fixture:' + key;
      if (key.includes('supabase')) throw new Error('Production reader blocked in fixture: ' + key);
    },
    load(id) {
      if (id.startsWith('\0fixture:')) return `export { ${mocks[id.slice(9)]} as default } from ${JSON.stringify(data)};`;
    },
  }, react()],
  resolve: { alias: Object.fromEntries(['components', 'hooks', 'lib', 'styles', 'utils', 'pages'].map((key) => [key, path.join(web, key)])) },
  css: { preprocessorOptions: { scss: { loadPaths: [web], quietDeps: true, silenceDeprecations: ['legacy-js-api', 'import', 'global-builtin', 'color-functions'] } } },
  server: { host: '127.0.0.1', port: 3114, strictPort: true, fs: { allow: [web, cache] } },
});
await server.listen();
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.close(); process.exit(0); });
