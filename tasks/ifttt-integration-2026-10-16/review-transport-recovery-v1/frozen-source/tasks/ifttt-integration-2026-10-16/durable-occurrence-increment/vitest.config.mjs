import base from '../review/vitest.review.config.mjs';
import { fileURLToPath } from 'node:url';
export default {...base,test:{...base.test,include:[...base.test.include,
  fileURLToPath(new URL('../offline-completion/*.test.ts',import.meta.url)),
  fileURLToPath(new URL('../game-scope-fixtures-v2/*.test.ts',import.meta.url))]}};
