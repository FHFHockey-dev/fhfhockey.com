import base from '../vitest.config.mjs';
import {fileURLToPath} from 'node:url';
const here=fileURLToPath(new URL('.',import.meta.url));
export default {...base,test:{...base.test,maxWorkers:1,include:[`${here}*.test.ts`]}};
