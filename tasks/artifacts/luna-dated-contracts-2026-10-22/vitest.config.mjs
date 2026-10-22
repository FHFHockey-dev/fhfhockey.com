import base from '../luna-ifttt-readiness-2026-10-22/vitest.config.mjs';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url));
export default {
  ...base,
  cacheDir: '/tmp/fhfh-luna-dated-contracts-vite-cache',
  resolve: { alias: { vitest: fileURLToPath(new URL('../../../web/node_modules/vitest', import.meta.url)) } },
  test: { ...base.test, include: [`${here}*.test.ts`] },
};
