// Review harness. Run from web/: npx vitest --run --config <this>.
// TESTS=<comma-separated absolute test paths> picks the files (default: the LIVE route test, unedited).
// MUTANT=<name> redirects `pages/api/v1/db/replay-player-aliases` to ../mutants/<name>/replay-player-aliases.ts;
// without MUTANT the live route bytes are used. No live file is edited; only module resolution is redirected.
import base from '../../../../web/vitest.config.mts';
import { fileURLToPath } from 'node:url';
const repo = fileURLToPath(new URL('../../../../', import.meta.url));
const web = `${repo}web/`;
const mutant = process.env.MUTANT;
const route = mutant ? fileURLToPath(new URL(`../mutants/${mutant}/replay-player-aliases.ts`, import.meta.url)) : `${web}pages/api/v1/db/replay-player-aliases`;
const tests = (process.env.TESTS ?? `${web}__tests__/pages/api/v1/db/replay-player-aliases.test.ts`).split(',');
export default {
  ...base,
  root: web,
  server: { fs: { allow: [repo] } },
  resolve: { ...base.resolve, alias: [
    { find: /^pages\/api\/v1\/db\/replay-player-aliases$/, replacement: route },
    // Importers outside web/ (mutant copies, review tests) need the web/ path mapping explicitly.
    { find: /^(lib|utils|pages)\/(.*)$/, replacement: `${web}$1/$2` },
  ] },
  test: { ...base.test, include: tests, maxWorkers: 1, setupFiles: [...base.test.setupFiles, fileURLToPath(new URL('./deny-network.ts', import.meta.url))] },
};
