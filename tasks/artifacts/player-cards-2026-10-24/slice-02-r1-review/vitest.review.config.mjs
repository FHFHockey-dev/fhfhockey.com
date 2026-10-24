import { fileURLToPath } from 'node:url';
export default {
  root: fileURLToPath(new URL('../../../../web/', import.meta.url)),
  cacheDir: fileURLToPath(new URL('./vite-cache/', import.meta.url)),
  test: {
    environment: 'node',
    include: ['lib/player-cards/domain.test.ts', 'lib/player-cards/aggregation.r1.test.ts'],
    setupFiles: [],
    cache: false,
  },
};
