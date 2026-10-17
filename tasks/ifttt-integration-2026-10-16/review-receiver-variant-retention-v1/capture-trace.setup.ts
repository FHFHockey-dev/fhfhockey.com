import {afterAll,expect} from 'vitest';
import {writeFileSync} from 'node:fs';
import {basename,join} from 'node:path';
afterAll(()=>{
 const rows=(globalThis as any)[Symbol.for('ifttt.review.captured.execution')]??[];
 writeFileSync(join(__dirname,'execution-traces',`${basename(expect.getState().testPath??'unknown')}.json`),JSON.stringify(rows,null,2)+'\n');
});
