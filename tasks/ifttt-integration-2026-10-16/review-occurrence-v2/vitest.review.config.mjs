import base from '../review/vitest.review.config.mjs';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url));
const ownerTests = fileURLToPath(new URL('../occurrence-increment/', import.meta.url));
export default { ...base, test: { ...base.test, include: [...base.test.include, `${here}*.test.ts`, `${ownerTests}*.test.ts`] } };
