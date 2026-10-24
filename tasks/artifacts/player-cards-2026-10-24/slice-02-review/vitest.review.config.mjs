import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../web/', import.meta.url));
export default {
  root,
  cacheDir: fileURLToPath(new URL('./vite-cache/', import.meta.url)),
  test: {
    environment: 'node',
    include: ['lib/player-cards/domain.test.ts'],
    setupFiles: [],
    cache: false,
  },
};
