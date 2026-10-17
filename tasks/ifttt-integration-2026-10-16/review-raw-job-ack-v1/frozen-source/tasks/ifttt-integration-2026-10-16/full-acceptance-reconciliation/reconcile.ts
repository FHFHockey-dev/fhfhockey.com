/** Read-only reconciliation of original assertions and separately approved fixtures. */
import {createHash} from "node:crypto";
import {readFileSync,writeFileSync} from "node:fs";
import {join,resolve} from "node:path";
import {isDeepStrictEqual} from "node:util";

const originalHash="d9fe45ca44042673ff0381cd0f1981074b196da99fb6fdf9da573ac5df84fd8b";
const task=resolve(__dirname,".."),repo=resolve(task,"../..");
const canonical=(v:any):string=>v&&typeof v==="object"?Array.isArray(v)?`[${v.map(canonical).join(",")}]`
 :`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`:JSON.stringify(v);
const sha=(path:string)=>createHash("sha256").update(readFileSync(path).toString("utf8")).digest("hex");
const read=(path:string)=>JSON.parse(readFileSync(path,"utf8"));
const requireFact=(condition:unknown,message:string):void=>{if(!condition)throw new Error(message);};
const paths={
 original:"handoff/extracted-reviewed/ifttt-claim-replay-tests-2026-10-15/acceptance-cases.json",
 pure:"full-acceptance-reconciliation/outputs/acceptance-identity-candidate-results.json",
 mutation:"full-acceptance-reconciliation/outputs/acceptance-identity-negative-control-results.json",
 durable:"review-durable-occurrence-v3/exact-persistence-results.json",
 parent:"review-parent-recovery-v1/exact-parent-persistence-results.json",
 consumer:"review-consumer-binding-v2/correction-v2/consumer-binding-results.json",
 corrections:"game-scope-fixtures-v2/cases.json",
 versioned:"full-acceptance-reconciliation/outputs/versioned-game-results.json",
 gameStorage:"full-acceptance-reconciliation/outputs/game-storage-results.json",
};
export function loadEvidence():Record<string,any>{
 const own=read(join(__dirname,"owned-source-sha256.json"));
 for(const f of own.files)requireFact(sha(join(repo,f.path))===f.sha256,`Reconciliation source changed: ${f.path}`);
 const seal=read(join(__dirname,"read-only-inputs-sha256.json"));
 for(const f of seal.files)requireFact(sha(join(repo,f.path))===f.sha256,`Sealed input changed: ${f.path}`);
 requireFact(sha(join(task,paths.original))===originalHash,"Original oracle bytes changed");
 const pins=read(join(task,"consumer-binding-increment/owned-source-v2-sha256.json"));
 for(const f of pins.files)requireFact(sha(join(repo,f.path))===f.sha256,`Accepted source changed: ${f.path}`);
 const liveDependencies=pins.readOnlyDependencies.map((f:any)=>{
  requireFact(sha(join(repo,f.snapshotPath))===f.sha256,`Accepted dependency snapshot changed: ${f.snapshotPath}`);
  const liveSha256=sha(join(repo,f.path));return {path:f.path,acceptedSha256:f.sha256,liveSha256,liveMatchesAccepted:liveSha256===f.sha256};
 });
 return {...Object.fromEntries(Object.entries(paths).map(([key,path])=>[key,read(join(task,path))])),liveDependencies};
}
const indexed=(items:any[],label:string)=>{
 requireFact(Array.isArray(items),`${label}: rows missing`);const map=new Map<string,any>();
 for(const item of items){requireFact(typeof item.id==="string"&&!map.has(item.id),`${label}: duplicate/missing case ID`);map.set(item.id,item);}
 return map;
};
function checkedAssertions(c:any,result:any){
 requireFact(Array.isArray(result.assertions)&&result.assertions.length===c.assertions.length,`${c.id}: assertion count mismatch`);
 return c.assertions.map((a:any,index:number)=>{
  const observed=result.assertions[index];requireFact(isDeepStrictEqual(a,observed.assertion),`${c.id}: original assertion changed at ${index}`);
  const actual=observed.actual;
  const pass=a.op==="equals"?isDeepStrictEqual(actual,a.value):Array.isArray(actual)&&actual.length===a.records.length
   &&actual.every((v:any)=>v!==null&&v!==undefined)&&(a.op==="same"?actual.every((v:any)=>isDeepStrictEqual(v,actual[0]))
    :a.op==="pairwise_distinct"&&new Set(actual.map(canonical)).size===actual.length);
  requireFact(observed.pass===pass,`${c.id}: forged/stale pass flag at ${index}`);
  return {index,assertion:a,actual,pass};
 });
}
export function reconcile(data:any){
 const spec=data.original;requireFact(spec.caseCount===52&&spec.cases.length===52,"Original case count must be52");
 const cases=indexed(spec.cases,"original"),pure=indexed(data.pure.results,"pure");
 requireFact(pure.size===52&&[...pure.keys()].every(id=>cases.has(id)),"Pure catalog missing/extra cases");
 requireFact(data.pure.fixtureSha256===originalHash&&data.pure.identityCandidate===true&&!data.pure.mutationControl,"Wrong pure run identity");
 const groups=[
  {name:"durable",ids:["CR036","CR039","CR040","CR052"],scope:"Actual occurrence/context/commit RPCs; held/reserved effects, not delivered effects.",review:"review-durable-occurrence-v3/REVIEW.md"},
  {name:"parent",ids:["CR037","CR041"],scope:"Actual legacy producer/parent readback; fixture children. CR041 evidence version metric is legacy report_key uniqueness, not native r3 evidenceVersions.",review:"review-parent-recovery-v1/REVIEW.md"},
  {name:"consumer",ids:["CR042","CR043","CR044"],scope:"Actual single injury-out native consumer and outbox; explicit synthetic retained history/fence. Original expired CR042 holds; CR043 partial history stays unknown; CR044 exact receipt suppresses replay. No external transport/receiver guarantee.",review:"review-consumer-binding-v2/REVIEW.md"},
 ];
 const persistence=new Map<string,any>();
 for(const group of groups){
  const evidence=data[group.name];requireFact(evidence.originalOracleSha256===originalHash,`${group.name}: wrong original hash`);
  const results=indexed(evidence.results,group.name);
  for(const id of group.ids){requireFact(results.has(id),`${id}: missing actual persistence evidence`);persistence.set(id,{group,result:results.get(id)});}
 }
 const corrected=indexed(data.corrections.positiveCases,"approved positives"),versioned=indexed(data.versioned.results,"versioned results"),gameStorage=indexed(data.gameStorage.results,"durable games");
 requireFact(data.corrections.originalOracleSha256===originalHash&&data.versioned.originalOracleSha256===originalHash,"Correction oracle mismatch");
 const replacements:any[]=[];
 for(const id of ["CR011","CR051"]){
  const correction=corrected.get(`${id}-POSITIVE-v2`),positive=versioned.get(`${id}-POSITIVE-v2`),negative=versioned.get(`${id}-AMBIGUOUS-NEGATIVE-v2`);
  requireFact(correction&&positive?.status==="passed"&&negative?.status==="passed",`${id}: missing approved positive/negative evidence`);
  for(const a of cases.get(id).assertions)requireFact(correction.assertions.some((v:any)=>isDeepStrictEqual(v,a)),`${id}: positive dropped original assertion`);
  const assertions=checkedAssertions(correction,positive);requireFact(assertions.every((a:any)=>a.pass),`${id}: corrected positive failed`);
  const durablePositive=gameStorage.get(correction.id),durableNegative=gameStorage.get(`${id}-AMBIGUOUS-NEGATIVE-durable`);
  requireFact(durablePositive?.status==="passed_actual_rpc"&&durableNegative?.status==="passed_actual_rpc",`${id}: durable game evidence missing`);
  const durableAssertions=checkedAssertions(correction,durablePositive);requireFact(durableAssertions.every((a:any)=>a.pass),`${id}: durable corrected positive failed`);
  requireFact(durableNegative.canonicalOccurrences===1&&durableNegative.nativeEffects.length<=1&&durableNegative.holdReasons.length>0
   &&durableNegative.outbox.every((r:any)=>r.status==="held"&&r.requires_review),`${id}: durable ambiguous variants escaped review`);
  const q=negative.outcome;requireFact(q.holds.length===2&&q.holds.every((h:any)=>h.reason==="original_lineage_evidence_conflict")
   &&q.plan.reviewableEffects.length===0&&q.plan.dispatchInstructions.length===0,`${id}: ambiguous original was not held`);
  replacements.push({originalCaseId:id,approvedPositiveId:correction.id,originalAssertionsRetained:cases.get(id).assertions.length,
   positiveAssertions:assertions,ambiguousOriginalNegative:{id:negative.id,holds:q.holds,effectProposals:0,dispatchInstructions:0},
   durable:{source:paths.gameStorage,positiveAssertions:durableAssertions,ambiguousOriginal:durableNegative},
   scope:"Separate user-approved version2 fixture and interpretation; original positive fixture/results remain unchanged."});
 }
 const edit=data.corrections.revisionCases[0],editResult=versioned.get(edit.id);requireFact(editResult?.status==="passed","Authenticated edit evidence missing");
 const editAssertions=checkedAssertions(edit,editResult);requireFact(editAssertions.every((a:any)=>a.pass),"Authenticated edit assertions failed");
 const rows=spec.cases.map((c:any)=>{
  const p=pure.get(c.id);let assertions:any[],status:string,source:string,scope:string,review:string|null=null;
  if(c.layer==="future_persistence_gate"){
   requireFact(p.status==="deferred_persistence"&&p.assertions.length===0,`${c.id}: pure result improperly scores persistence`);
   const found=persistence.get(c.id);requireFact(found,`${c.id}: persistence case unimplemented`);
   assertions=checkedAssertions(c,found.result);requireFact(assertions.every((a:any)=>a.pass),`${c.id}: actual persistence assertion failed`);
   status="passed_bounded_local_persistence_projection";source=(paths as any)[found.group.name];scope=found.group.scope;review=found.group.review;
  }else{
   assertions=checkedAssertions(c,p);const pass=assertions.every((a:any)=>a.pass);
   requireFact(p.status===(pass?"passed":"failed"),`${c.id}: incorrect pure case status`);
   requireFact(pass||["CR011","CR051"].includes(c.id),`${c.id}: unexpected original failure`);
   status=pass?"passed_pure_projection":"original_positive_conflicts_with_approved_ambiguous_variant_policy";
   source=paths.pure;scope="Pure registry/reducer/qualification projection with declared synthetic prebound inputs; no persistence or real-source extraction proof.";
  }
  return {id:c.id,title:c.title??c.name,layer:c.layer,status,assertions,source,sourceSha256:null,review,scope,
   approvedReplacement:replacements.find(r=>r.originalCaseId===c.id)?.approvedPositiveId??null};
 });
 const assertions=rows.flatMap((r:any)=>r.assertions),pureRows=rows.filter((r:any)=>r.layer!=="future_persistence_gate");
 requireFact(assertions.length===227&&assertions.filter((a:any)=>a.pass).length===225,"Original assertion accounting changed");
 requireFact(persistence.size===9&&pureRows.length===43,"Original layer accounting changed");
 const mutant=indexed(data.mutation.results,"mutation"),negative=mutant.get("CR019"),normal=pure.get("CR019");
 requireFact(data.mutation.mutationControl===true&&negative?.status==="failed"&&normal?.status==="passed","Immutable-row mutation control not detected");
 requireFact(negative.assertions[2]?.pass===false&&negative.assertions[2]?.actual===1&&normal.assertions[2]?.actual===0,"CR019 full immutable-row audit control mismatch");
 return {originalOracleSha256:originalHash,scope:"Heterogeneous bounded local evidence ledger; not one integrated full52 run or production acceptance.",
  original:{cases:52,assertions:227,caseRowsWithAllAssertionsMatching:50,matchingAssertions:225,nonmatchingAssertions:2,
   pure:{cases:43,passedCases:41,failedCases:2,assertions:196,matchingAssertions:194,persistenceDeferred:9},
   separatePersistence:{cases:9,assertions:31,matchingAssertions:31}},
  approvedVersionedFixtures:{positiveCases:2,positiveAssertions:replacements.reduce((n,r)=>n+r.positiveAssertions.length,0),originalAssertionsRetained:7,
   ambiguousOriginalNegativeControls:2,authenticatedEditRevision:{id:edit.id,assertions:editAssertions},replacements},
  mutationControl:{caseId:"CR019",normalImmutableReplacementCount:0,injectedRewriteCount:1,unchangedOriginalAssertionRejectedMutation:true},
  dependencyStatus:{acceptedSnapshotsVerified:data.liveDependencies.length,liveDrift:data.liveDependencies.filter((d:any)=>!d.liveMatchesAccepted),
   interpretation:"Historical accepted evidence uses retained snapshots. Root-owned live dependency changes are reported separately and never overwritten or silently accepted."},
  rows,full52EndToEndAccepted:false,currentCombinedRuntimeAccepted:false,productionAccepted:false,authenticFutureOutcomesRead:false};
}
function main(){
 const result=reconcile(loadEvidence());
 for(const row of result.rows)row.sourceSha256=sha(join(task,row.source));
 const report={...result,reconciliationSourceManifest:"owned-source-sha256.json",reconciliationSourceManifestSha256:sha(join(__dirname,"owned-source-sha256.json"))};
 writeFileSync(join(__dirname,"outputs/full52-reconciliation.json"),JSON.stringify(report,null,2)+"\n");
 console.log(JSON.stringify({original:result.original,approvedVersionedFixtures:{positiveCases:2,positiveAssertions:result.approvedVersionedFixtures.positiveAssertions,
  originalAssertionsRetained:7,negativeControls:2},full52EndToEndAccepted:false},null,2));
}
if(typeof require!=="undefined"&&typeof module!=="undefined"&&require.main===module)main();
