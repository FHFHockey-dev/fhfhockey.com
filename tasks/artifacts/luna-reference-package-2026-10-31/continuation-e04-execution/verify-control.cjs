// Offline-only operator rehearsal: temporary ledger/output paths, no credentials or HTTP.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),crypto=require('node:crypto'),Module=require('node:module'),ts=require('typescript');
const root=path.resolve('..'),base=path.join(root,'tasks/artifacts/luna-reference-package-2026-10-31'),dir=path.join(base,'continuation-e04-execution'),frozen=path.join(base,'continuation-v4-e04');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v));
const original=fs.readFileSync(path.join(base,'paid-evaluation/ledger.json')),plan=read(path.join(frozen,'PLAN.json')),start=JSON.parse(original),results=read(path.join(frozen,'OFFLINE-RESULTS.json')),mock=read(path.join(base,'omission-diagnosis/rehearsal/SYNTHETIC-ONLY-ledger.json'));
const code=fs.readFileSync(path.join(dir,'control.ts'),'utf8'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'luna-e04-operator-')),proof=[];
try {
 for(const scenario of ['all-pass','binding-candidate-E06','uncertain-first','cli-error']){
  const p=path.join(temp,scenario);fs.mkdirSync(p);fs.mkdirSync(path.join(p,'reviews'));fs.mkdirSync(path.join(p,'candidates'));
  fs.writeFileSync(path.join(p,'START-LEDGER.json'),original);fs.copyFileSync(path.join(dir,'LIVE-PREFLIGHT.json'),path.join(p,'LIVE-PREFLIGHT.json'));
  const l=structuredClone(start);Object.assign(l,plan.activationProposalOnly.setOnlyAfterReview);const ledger=path.join(p,'SYNTHETIC-ONLY.json');save(ledger,l);
  const source=code.replace('const dir = join(base, "continuation-e04-execution")',`const dir = ${JSON.stringify(p)}`).replace('ledgerPath = join(base, "paid-evaluation/ledger.json")',`ledgerPath = ${JSON.stringify(ledger)}`);
  assert(source!==code && !source.includes('ledgerPath = join(base, "paid-evaluation/ledger.json")'));
  function run(action,id,status){process.argv=[process.execPath,path.join(dir,'control.ts'),action,id,...(status===undefined?[]:[String(status)])];process.exitCode=0;
   const mod=new Module(path.join(dir,'control.ts'),module);mod.filename=path.join(dir,'control.ts');mod.paths=Module._nodeModulePaths(dir);mod._compile(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,mod.filename);return process.exitCode;}
  let reached=0;
  for(const result of results){const id=result.caseId;assert.equal(run('preflight',id),0);reached++;const live=read(ledger),steps=plan.sequence.filter(s=>s.caseId===id);let review=structuredClone(result.review),candidate={candidate:null},exit=0;
   if(scenario==='binding-candidate-E06'&&id==='E06'){steps.splice(1);review=read(path.join(frozen,'binding-stop-E06-original-review.json'));candidate=read(path.join(frozen,'binding-stop-E06-candidate.json'));exit=2;}
   for(const step of steps)live.attempts[step.hash]=structuredClone(mock.attempts[step.hash]);
   if(scenario==='uncertain-first'){live.attempts[steps[0].hash]={reservedNanoUsd:233000000,state:'uncertain',receipt:null,requestId:null};live.blockedReason='unknown_billed_outcome';review.status='held';exit=2;}
   if(scenario==='cli-error')exit=1;
   save(ledger,live);save(path.join(p,'reviews',id+'.json'),review);save(path.join(p,'candidates',id+'.json'),candidate);
   assert.equal(run('grade',id,exit),exit?2:0);
   if(exit)break;
  }
  const final=read(ledger);assert.equal(final.enabled,false);for(const hash of Object.keys(start.attempts))assert.deepEqual(final.attempts[hash],start.attempts[hash]);
  if(scenario==='all-pass'){assert.equal(Object.keys(final.attempts).length,20);assert.equal(final.blockedReason,'bounded_continuation_completed');}
  if(scenario==='binding-candidate-E06'){assert.equal(Object.keys(final.attempts).length,7);assert.equal(reached,3);assert.equal(read(path.join(p,'grade-E06.json')).proceed,false);}
  if(scenario==='uncertain-first'){assert.equal(final.blockedReason,'unknown_billed_outcome');assert.equal(final.attempts[plan.sequence[0].hash].reservedNanoUsd,233000000);}
  proof.push({scenario,reportsReached:reached,attempts:Object.keys(final.attempts).length,enabled:final.enabled,reason:final.blockedReason,priorReceiptsPreserved:true});
 }
 assert.deepEqual(fs.readFileSync(path.join(base,'paid-evaluation/ledger.json')),original);process.exitCode=0;
 fs.writeFileSync(path.join(dir,'OFFLINE-CONTROL-VERIFICATION.json'),JSON.stringify({actualProviderRequests:0,realLedgerUnchanged:true,scenarios:proof},null,2)+'\n',{flag:'wx'});
 console.log('Four offline operator scenarios passed; original ledger unchanged.');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
