const cp=require('child_process'),vm=require('vm'),assert=require('assert'),fs=require('fs'),crypto=require('crypto');
const ts=require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript');
const pin='29451c57304866d54abd2a3302625f0696472ab0';
const source=cp.execFileSync('git',['show',pin+':web/lib/projections/pregameCapture/custody.ts']).toString();
const m={exports:{}},timers=[];
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{
 module:m,exports:m.exports,AbortController,Buffer,console,
 setTimeout:(fn,ms)=>{timers.push(ms);return timers.length},clearTimeout:()=>{},
 require:(name)=>{
  if(name==='./packet')return{};
  if(name==='./rpc')return{DEFINITIVE_SAVE_REFUSALS:[]};
  if(name==='./verifier')return{verifyAndWitness:()=>{throw Error('unexpected verifier')}};
  if(name==='./time')return{};
  throw Error('Unexpected import '+name);
 }
},{timeout:2000});
(async()=>{
 let now=0,resolveClaim,claimCalls=0,finished=false;
 const pending=new Promise(resolve=>{resolveClaim=resolve});
 const b={readMs:1,saveWaitMs:1,tsaTimeoutMs:1,skewToleranceMs:0,rpcMs:10,requiredMs:100};
 const work=m.exports.runPregameCapture({now:()=>now,budget:b,
  pin:async()=>({gameId:1,slateDate:'2026-11-15',homeTeamId:1,awayTeamId:2,homeAbbrev:'A',awayAbbrev:'B',scheduledStart:'2026-11-15T23:00:00Z',calendarRevision:'a'.repeat(64)}),
  writer:{claim:()=>{claimCalls++;return pending},recordOutcome:async()=>{}},
 },{gameId:1,slateDate:'2026-11-15',policyId:'pregame-native-v1',codeVersion:pin}).then(r=>{finished=true;return r});
 await new Promise(resolve=>setImmediate(resolve));
 now=10_000;
 assert.equal(claimCalls,1);assert.equal(finished,false);assert.deepEqual(timers,[]);
 resolveClaim({outcome:'late_start',claimId:null,inputCutoff:null});
 const report=await work;assert.equal(report.timings.claimMs,10_000);
 const out={pin,sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),passed:true,configuredRpcMs:10,simulatedClaimWaitMs:report.timings.claimMs,custodyTimersWhileWaiting:timers,report,boundary:'Exact custody module, stubbed imports and manually controlled pending claim. No network, DB, real credentials, live runner, or clock/env mutation.'};
 fs.writeFileSync('tasks/artifacts/calculation-inventory-2026-11-10/master/astra-full-audit-20261114/capture-294-budget-probe-output.json',JSON.stringify(out,null,2)+'\n');console.log({passed:true,rpcMs:10,simulatedWaitMs:report.timings.claimMs,timers:timers.length});
})().catch(e=>{console.error(e);process.exitCode=1});
