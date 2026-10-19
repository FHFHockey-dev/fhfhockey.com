import base from '../../../web/vitest.config.mts';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url));
export default {
  ...base,
  server: { fs: { allow: [fileURLToPath(new URL('../../../', import.meta.url))] } },
  test: {
    ...base.test,
    include: ['**/*.{test,spec}.?(c|m)[jt]s?(x)', `${here}*.test.ts`],
    setupFiles: [...base.test.setupFiles, `${here}deny-network.ts`],
  },
};
