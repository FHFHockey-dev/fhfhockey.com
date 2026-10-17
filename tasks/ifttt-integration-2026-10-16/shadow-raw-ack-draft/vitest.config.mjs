import base from '../consumer-binding-increment/vitest.config.mjs';
import {fileURLToPath} from 'node:url';
export default {...base,test:{...base.test,include:[fileURLToPath(new URL('./raw-settlement.test.ts',import.meta.url))]}};
