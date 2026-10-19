import base from '../review/vitest.review.config.mjs';
import {fileURLToPath} from 'node:url';
export default {...base,test:{...base.test,maxWorkers:1,include:[fileURLToPath(new URL('./*.test.ts',import.meta.url)),fileURLToPath(new URL('../../../web/lib/sources/tweetReviewSidecar.test.ts',import.meta.url))]}};
