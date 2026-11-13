import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(root, '../../..');
const data = path.join(root, 'data.tsx');
const mocks = {
  'lib/supabase': 'export { supabase as default }',
  'lib/supabase/server': 'export { blockedServer as default }',
  'lib/NHL/server': 'export { getTeamLogo }',
  'utils/fetchCurrentSeason': 'export { fetchCurrentSeason, fetchSeasonById }',
  'next/image': 'export { Image as default }',
  'next/legacy/image': 'export { Image as default }',
};
const cache = await mkdtemp(path.join(tmpdir(), 'fhfh-drm-fixture-'));
const server = await createServer({
  configFile: false, root, envDir: cache, cacheDir: cache,
  plugins: [{
    name: 'isolated-drm-fixtures', enforce: 'pre',
    resolveId(source) {
      source = source.startsWith(web + '/') ? source.slice(web.length + 1).replace(/\.tsx?$/, '') : source;
      if (mocks[source]) return '\0fixture:' + source;
      if (source === 'lib/cors-fetch' || source === 'lib/NHL/client') {
        throw new Error('Production reader attempted in isolated fixture: ' + source);
      }
    },
    load(id) {
      if (id.startsWith('\0fixture:')) return `${mocks[id.slice('\0fixture:'.length)]} from ${JSON.stringify(data)};`;
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/v1/drm')) return next();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        try {
          const url = new URL(req.url, 'http://127.0.0.1:3114');
          const referer = new URL(req.headers.referer || '/', url);
          const scenario = url.searchParams.get('scenario') ?? referer.searchParams.get('scenario') ?? '';
          const { createFixtureDatabase } = await server.ssrLoadModule(data);
          const { readDeploymentMatrix } = await server.ssrLoadModule(path.join(web, 'lib/drm/readMatrix.ts'));
          const value = key => url.searchParams.get(key);
          const result = await readDeploymentMatrix(createFixtureDatabase(scenario), {
            teamId: Number(value('teamId')), seasonId: Number(value('seasonId')),
            startDate: value('startDate') ?? '', endDate: value('endDate') ?? '',
            seasonType: value('seasonType') ?? 'regularSeason', homeOrAway: value('homeOrAway') ?? '',
            opponentTeamAbbreviation: value('opponent') ?? '',
          });
          res.end(JSON.stringify(result));
        } catch {
          res.statusCode = 503;
          res.end(JSON.stringify({ error: 'Qualified matrix data is temporarily unavailable.' }));
        }
      });
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/teamLogos/')) return next();
        res.setHeader('Content-Type', 'image/svg+xml');
        res.end('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="14" fill="#327da8"/></svg>');
      });
    },
  }, react()],
  resolve: { alias: Object.fromEntries(['components', 'hooks', 'lib', 'styles', 'utils', 'public'].map(key => [key, path.join(web, key)])) },
  css: { preprocessorOptions: { scss: { loadPaths: [web], quietDeps: true, silenceDeprecations: ['legacy-js-api', 'import', 'global-builtin', 'color-functions'] } } },
  server: { host: '127.0.0.1', port: 3114, strictPort: true, fs: { allow: [web, path.dirname(web), cache] } },
});
await server.listen();
server.printUrls();
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.close(); process.exit(0); });
