import { defineConfig } from '/Users/tim/Code/fhfhockey.com/web/node_modules/vitest/dist/config.js';
const W = '/Users/tim/Code/fhfhockey.com/web';
const S = '/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7';
// C7 reviewer config: owner's settings (envDir=false, one fork worker) with cache kept in scratch, not web/.
export default defineConfig({ root: W, envDir: false, cacheDir: S + '/cache',
  server: { fs: { allow: ['/Users/tim/Code/fhfhockey.com/', S + '/'] } },
  resolve: { alias: [
    ...['lib', 'utils', 'components', 'pages', 'hooks', 'contexts'].map(n => ({ find: n, replacement: W + '/' + n })),
    { find: /^vitest$/, replacement: W + '/node_modules/vitest/dist/index.js' },
  ] },
  test: { environment: 'node', setupFiles: [], maxWorkers: 1, fileParallelism: false, pool: 'forks',
    dir: '/', include: [W + '/lib/sources/tweetLunaReview.test.ts', S + '/controls/**/*.test.ts'] } });
