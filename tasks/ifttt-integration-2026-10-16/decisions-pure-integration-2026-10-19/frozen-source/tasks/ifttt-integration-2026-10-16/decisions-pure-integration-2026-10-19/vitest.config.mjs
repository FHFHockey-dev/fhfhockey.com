import base from '../review/vitest.review.config.mjs';
import { fileURLToPath } from 'node:url';
export default { ...base, test: { ...base.test, maxWorkers: 1, include: [fileURLToPath(new URL('../../../web/lib/sources/tweetDecisionReview.test.ts', import.meta.url))] } };
