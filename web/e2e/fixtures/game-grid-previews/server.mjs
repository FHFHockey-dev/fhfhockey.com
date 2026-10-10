import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(root, '../../..');
const data = path.join(root, 'data.ts');
const mocks = {
  'hooks/useTeams': 'export { useTeamsMap }',
  'hooks/useCurrentSeason': 'export { useCurrentSeason as default }',
  'hooks/useTeamSummary': 'export { useTeamSummary as default }',
  'hooks/useYahooCurrentMatchupWeek': 'export { useMatchupWeek as default }',
  'next/router': 'export { useRouter }',
  'next/link': 'export { Link as default }',
  'next/image': 'export { Image as default }',
  'next/legacy/image': 'export { Image as default }',
};
const cache = await mkdtemp(path.join(tmpdir(), 'fhfh-game-grid-fixture-'));
const server = await createServer({
  configFile: false, root, envDir: cache, cacheDir: cache,
  plugins: [{
    name: 'isolated-game-grid-fixtures', enforce: 'pre',
    resolveId(source) {
      source = source.startsWith(web + '/') ? source.slice(web.length + 1).replace(/\.tsx?$/, '') : source;
      if (source.includes('supabase') || source === 'lib/NHL/client') throw new Error('Production reader attempted in isolated fixture: ' + source);
      if (mocks[source]) return '\0fixture:' + source;
      const seam = source.match(/\/(useSchedule|useFourWeekSchedule|useOpponentMetricsData)(?:\.ts)?$/)?.[1];
      if (seam) return '\0fixture:' + seam;
      if (source.endsWith('/PoissonHeatMap') || source === 'components/PlayerPickupTable/PlayerPickupTable') return '\0fixture:empty';
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/v1/projections/teams?')) return next();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ runId: 'legacy-fixture-run', asOfDate: '2026-10-07', horizonGames: 1,
          data: [{ run_id: 'legacy-fixture-run', game_id: 103, team_id: 1, proj_goals_es: 2, proj_goals_pp: 1, proj_goals_pk: null }] }));
      });
    },
    load(id) {
      if (!id.startsWith('\0fixture:')) return;
      const name = id.slice('\0fixture:'.length);
      if (name === 'empty') return 'export default function Empty() { return null; }';
      return `${mocks[name] ?? `export { ${name} as default }`} from ${JSON.stringify(data)};`;
    },
  }, react()],
  resolve: { alias: Object.fromEntries(['components', 'hooks', 'lib', 'styles', 'utils'].map((key) => [key, path.join(web, key)])) },
  css: { preprocessorOptions: { scss: { loadPaths: [web], quietDeps: true, silenceDeprecations: ['legacy-js-api', 'import', 'global-builtin', 'color-functions'] } } },
  server: { host: '127.0.0.1', port: 3112, strictPort: true, fs: { allow: [web, path.dirname(web), cache] } },
});
await server.listen();
server.printUrls();
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.close(); process.exit(0); });
