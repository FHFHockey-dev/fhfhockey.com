import { fileURLToPath } from 'node:url';
const audit = fileURLToPath(new URL('./', import.meta.url));
const web = fileURLToPath(new URL('../../../web/', import.meta.url));
export default {
  root: audit, envDir: audit, cacheDir: `${audit}.vite`,
  resolve: { alias: { lib: `${web}lib`, vitest: `${web}node_modules/vitest/dist/index.js` } },
  test: { environment: 'node', include: ['synthetic.test.ts'], setupFiles: ['./offline-guard.mjs'],
    maxWorkers: 1, minWorkers: 1, fileParallelism: false, cache: false }
};
