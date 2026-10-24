import { defineConfig } from '/private/tmp/fhfh-c2-isolated/web/node_modules/vitest/dist/config.js';
import react from '/private/tmp/fhfh-c2-isolated/web/node_modules/@vitejs/plugin-react/dist/index.js';
import tsconfigPaths from '/private/tmp/fhfh-c2-isolated/web/node_modules/vite-tsconfig-paths/dist/index.mjs';
const W = '/private/tmp/fhfh-c2-isolated/web';
// C2 news config: snapshot's own plugins/setup, no env files, one fork worker, cache in scratch.
export default defineConfig({ root: W, envDir: false, cacheDir: '/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/622ce9ac-39ba-4f02-ab8f-0330e32934fd/scratchpad/c2/cache-news-wide', plugins: [tsconfigPaths({ root: W }), react()],
  server: { fs: { allow: [W + '/', '/Users/tim/Code/fhfhockey.com/web/node_modules/', '/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/622ce9ac-39ba-4f02-ab8f-0330e32934fd/scratchpad/c2/'] } },
  test: { environment: 'jsdom', setupFiles: [W + '/__tests__/vitest.setup.js'], maxWorkers: 1, fileParallelism: false, pool: 'forks',
    include: ['lib/homepageNewsCompatibility.test.tsx', 'lib/newsFeed.test.ts', 'lib/sources/tweetNewsAutomation.test.ts', 'lib/sources/tweetPatternReview.test.ts', 'lib/sources/tweetLunaReview.test.ts'] } });
