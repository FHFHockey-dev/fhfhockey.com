import base from '../consumer-binding-increment/vitest.config.mjs';
import {fileURLToPath} from 'node:url';
export default {...base,test:{...base.test,include:[fileURLToPath(new URL('./*.test.ts',import.meta.url))]}};
