import base from './vitest.config.mjs';
import {fileURLToPath} from 'node:url';
export default {...base,test:{...base.test,include:[...base.test.include,
 fileURLToPath(new URL('../../../web/lib/sources/lineSourceIftttReceiver.test.ts',import.meta.url)),
 fileURLToPath(new URL('../../../web/lib/sources/iftttIntakePolicy.test.ts',import.meta.url))]}};
