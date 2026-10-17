import base from './vitest.config.mjs';
import {fileURLToPath} from 'node:url';
const files=['../../../web/lib/sources/tweetClaimRegistry.test.ts','../../../web/lib/sources/tweetClaimQualificationStorage.test.ts',
 '../../../web/__tests__/pages/api/v1/db/update-line-sources.test.ts','../../../web/__tests__/pages/api/v1/db/update-lines-ccc.test.ts'];
export default {...base,test:{...base.test,maxWorkers:2,include:[...base.test.include,...files.map(p=>fileURLToPath(new URL(p,import.meta.url)))]}};
