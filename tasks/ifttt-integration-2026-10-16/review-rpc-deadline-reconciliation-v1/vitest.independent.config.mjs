import base from './vitest.config.mjs';
import {fileURLToPath} from 'node:url';
const here=fileURLToPath(new URL('.',import.meta.url));
export default {...base,test:{...base.test,maxWorkers:1,
 setupFiles:base.test.setupFiles.filter(file=>!String(file).endsWith('deny-network.ts')).concat(`${here}loopback-only-network.ts`),
 include:[`${here}independent-deadline.test.ts`]}};
