import { defineConfig } from '/private/tmp/fhfh-c2-isolated/web/node_modules/vitest/dist/config.js';
const W = '/private/tmp/fhfh-c2-isolated/web';
const S = '/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/622ce9ac-39ba-4f02-ab8f-0330e32934fd/scratchpad/c2';
// C2 fixer config: snapshot root, no env files, one fork worker, cache in scratch.
export default defineConfig({ root: W, envDir: false, cacheDir: S + '/cache',
  server: { fs: { allow: [W + '/', '/Users/tim/Code/fhfhockey.com/web/node_modules/', S + '/'] } },
  resolve: { alias: [
    ...['lib', 'utils', 'components', 'pages', 'hooks', 'contexts'].map(n => ({ find: n, replacement: W + '/' + n })),
  ] },
  test: { environment: 'node', setupFiles: [], maxWorkers: 1, fileParallelism: false, pool: 'forks',
    include: ['lib/sources/tweetLunaReview.test.ts'] } });
