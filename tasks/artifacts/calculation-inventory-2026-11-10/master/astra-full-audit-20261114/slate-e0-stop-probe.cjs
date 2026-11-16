const cp=require('child_process'),fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const ts=require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript');const pin='e0cbb19a8',hashes={},cache={};
function source(name){const s=cp.execFileSync('git',['show',pin+':web/lib/projections/pregameCapture/'+name+'.ts']).toString();hashes[name]=crypto.createHash('sha256').update(s).digest('hex');return s}
function load(name){name=name.replace(/^\.\//,'');if(cache[name])return cache[name];let s=source(name);
 if(name==='custody'){const ast=ts.createSourceFile('custody.ts',s,ts.ScriptTarget.Latest,true);s=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='minimumRequiredMs').getText(ast);}
 if(!['slateQueue','custody','deadline','time'].includes(name))throw Error('Unexpected module '+name);
 const m={exports:{}};vm.runInNewContext(ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:m,exports:m.exports,require:load},{timeout:3000});return cache[name]=m.exports;
}
(async()=>{
 const queue=load('slateQueue');let now=Date.parse('2026-11-20T20:00:00Z'),resolveFirst,gates=0;const events=[],launched=[];
 const first=new Promise(r=>resolveFirst=r);const report=(outcome,id)=>({outcome,reason:null,claimId:'claim-'+id,outcomeRecorded:true,timings:{},saveCalls:1});
 const result=await queue.runSlate({policyId:'p',codeVersion:'test',config:{budget:{readMs:120000,saveWaitMs:20000,tsaTimeoutMs:10000,skewToleranceMs:2000,rpcMs:10000,requiredMs:240000},concurrency:2,leadMs:600000,staggerMs:30000},
  now:()=>now,sleepUntil:async t=>{now=t},custody:{lookup:async()=>({claimId:null,outcome:null}),recordOutcome:async()=>{},sweep:async()=>[]},captureDeps:()=>({}),
  loadGate:async()=>{gates++;if(gates===2){resolveFirst(report('save_unknown',1));await new Promise(r=>setImmediate(r));}return{open:true}},
  run:async(_d,r)=>{launched.push(r.gameId);return r.gameId===1?first:report('qualified',2)},log:e=>events.push(e)
 },[1,2].map(gameId=>({gameId,slateDate:'2026-11-20',scheduledStart:'2026-11-21T00:30:00Z',status:'FUT'})));
 assert.equal(result.stopped.trigger,'save_unknown');assert.deepEqual(launched,[1,2]);
 const stopIndex=events.findIndex(e=>e.event==='queue_stopped');const secondIndex=events.findIndex(e=>e.event==='dispatch'&&e.gameId===2);assert(stopIndex<secondIndex);
 const out={pin,hashes,passed:true,launched,stopBeforeSecondDispatch:true,events:events.filter(e=>['dispatch','queue_stopped','terminal'].includes(e.event)),boundary:'Exact queue/deadline/time and extracted minimumRequiredMs; injected virtual clock and custody/capture/gate doubles. No network, DB, real launcher, env, or production writes.'};
 fs.writeFileSync('tasks/artifacts/calculation-inventory-2026-11-10/master/astra-full-audit-20261114/slate-e0-stop-probe-output.json',JSON.stringify(out,null,2)+'\n');console.log({passed:true,launched,stopBeforeSecondDispatch:true});
})().catch(e=>{console.error(e);process.exitCode=1});
