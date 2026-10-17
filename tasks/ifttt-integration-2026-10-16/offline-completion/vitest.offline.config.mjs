import base from '../review-v4/vitest.review.config.mjs';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.',import.meta.url));
export default { ...base,test: { ...base.test,include: [`${here}*.test.ts`] } };
