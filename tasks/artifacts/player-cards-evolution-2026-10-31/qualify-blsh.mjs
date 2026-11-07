import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const here=path.dirname(fileURLToPath(import.meta.url)),web=path.resolve(here,'../../../web'),require=createRequire(path.join(web,'package.json'));
await require('esbuild').build({absWorkingDir:web,entryPoints:[path.join(here,'qualify-blsh-entry.ts')],bundle:true,platform:'node',format:'cjs',outfile:path.join(here,'qualify-blsh.cjs')});
const r=spawnSync(process.execPath,[path.join(here,'qualify-blsh.cjs')],{cwd:web,stdio:'inherit'});process.exitCode=r.status;
