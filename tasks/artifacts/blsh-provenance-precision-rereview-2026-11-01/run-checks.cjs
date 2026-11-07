const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=__dirname;const web='/Users/tim/Code/fhfhockey.com/web';const lock='/private/tmp/fhfh-heavy.lock';const owner={owner:'codex-blsh-provenance-precision-independent-rereview',pid:process.pid};
fs.mkdirSync(lock);fs.writeFileSync(path.join(lock,'owner.json'),JSON.stringify(owner));
const pins=JSON.parse(fs.readFileSync(path.join(root,'PINS.json'),'utf8'));const checks=[];
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const verify=()=>{for(const[p,h]of Object.entries(pins))assert.equal(hash(p),h,p);};
const env={...process.env,NODE_OPTIONS:'--require=/Users/tim/Code/fhfhockey.com/tasks/artifacts/rso-settlement-audit-2026-11-01/network-deny.cjs'};
function run(name,args,extra={}){const fd=fs.openSync(path.join(root,name+'.log'),'w');const r=spawnSync(process.execPath,args,{cwd:web,env:{...env,...extra},stdio:['ignore',fd,fd]});fs.closeSync(fd);checks.push({name,exitCode:r.status,error:r.error?.message||null});assert.equal(r.status,0,name);}
try{verify();run('TESTS-UTC',[web+'/node_modules/vitest/vitest.mjs','run','--config',root+'/vitest.config.mjs','--configLoader','native'],{TZ:'UTC'});run('TESTS-New-York',[web+'/node_modules/vitest/vitest.mjs','run','--config',root+'/vitest.config.mjs','--configLoader','native','-t','exact timing boundary regressions'],{TZ:'America/New_York'});run('TYPES',[web+'/node_modules/typescript/bin/tsc','-p',root+'/tsconfig.json']);
 const source='/Users/tim/Documents/Codex/2026-10-27/task-3/current-process-provenance-gate-20261101-01/precision-fix-01/compiled-02';
 for(const f of ['currentInput.js','currentProcessEvidence.server.js'])assert.equal(hash(path.join(root,'compiled',f)),hash(path.join(source,f)),f+' compile lineage');
 run('TIMING-UTC',[root+'/timing-probes.cjs'],{TZ:'UTC'});run('TIMING-New-York',[root+'/timing-probes.cjs'],{TZ:'America/New_York'});verify();
}finally{fs.writeFileSync(path.join(root,'CHECKS.json'),JSON.stringify(checks,null,2)+'\n');assert.deepEqual(JSON.parse(fs.readFileSync(path.join(lock,'owner.json'),'utf8')),owner);fs.renameSync(lock,path.join(root,'RELEASED-CHECK-LOCK'));}
