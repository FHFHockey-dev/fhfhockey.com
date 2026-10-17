// Runs the LIVE lineSourceIftttReceiver.test.ts (and a byte copy of iftttIntakePolicy.test.ts) against one mutant tree.
// MUTANT=<name> selects ./mutants/<name>. The live test file is never edited; only module resolution is redirected.
import base from '../vitest.config.mjs';
import {fileURLToPath} from 'node:url';
const mutant=process.env.MUTANT;
if(!mutant)throw new Error('MUTANT is required');
const dir=fileURLToPath(new URL(`./mutants/${mutant}/`,import.meta.url));
export default {...base,resolve:{...base.resolve,alias:{...base.resolve.alias,
 'lib/sources/lineSourceIftttReceiver':`${dir}lineSourceIftttReceiver.ts`}},
 test:{...base.test,include:[fileURLToPath(new URL('../../../../web/lib/sources/lineSourceIftttReceiver.test.ts',import.meta.url)),`${dir}iftttIntakePolicy.test.ts`]}};
