import base from '../../../web/vitest.config.mts';
import { fileURLToPath } from 'node:url';

// Reuse repository transforms/setup; never load canonical .env files.
export default {
  ...base,
  root: fileURLToPath(new URL('../../../web', import.meta.url)),
  envDir: false,
  cacheDir: '/tmp/fhfh-luna-readiness-vite-cache',
  test: { ...base.test, minWorkers: 1, maxWorkers: 1 },
};
