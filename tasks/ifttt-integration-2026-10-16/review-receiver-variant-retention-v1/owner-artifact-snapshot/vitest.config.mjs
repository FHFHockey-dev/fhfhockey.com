import base from '../review/vitest.review.config.mjs';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const snapshot=fileURLToPath(new URL('./dependency-snapshot/web/',import.meta.url));
export default {...base,resolve:{...base.resolve,alias:{...base.resolve?.alias,
 'moment-timezone':createRequire(new URL('../../../web/package.json',import.meta.url)).resolve('moment-timezone'),
 'lib/sources/lineSourceIftttReceiver':fileURLToPath(new URL('../../../web/lib/sources/lineSourceIftttReceiver.ts',import.meta.url)),
 'lib/supabase/server':fileURLToPath(new URL('../../../web/lib/supabase/server.ts',import.meta.url)),
 'lib/projections/evidenceTime':snapshot+'lib/projections/evidenceTime.ts',
 'lib/projections/starterBoardFlags':snapshot+'lib/projections/starterBoardFlags.ts'}},
 test:{...base.test,maxWorkers:1,include:[fileURLToPath(new URL('./*.test.ts',import.meta.url))]}};
