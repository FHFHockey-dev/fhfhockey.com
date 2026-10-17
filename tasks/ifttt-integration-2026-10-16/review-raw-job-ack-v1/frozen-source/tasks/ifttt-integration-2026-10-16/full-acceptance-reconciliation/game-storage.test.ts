// @vitest-environment node
import {execFile} from "node:child_process";
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from "node:fs";
import {createRequire} from "node:module";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {promisify} from "node:util";
import {afterAll,beforeAll,beforeEach,describe,expect,it} from "vitest";
import {qualifiedFixture} from "../../../web/lib/sources/fixtures/tweetClaimQualificationFixture";
import {retainQualifiedTweetClaimScope} from "../../../web/lib/sources/tweetClaimQualificationStorage";
import {claimHash,tweetClaimContentHash} from "../../../web/lib/sources/tweetClaimExtraction";
import {TWEET_LEGACY_SINKS} from "../../../web/lib/sources/tweetClaimEvidence";
import {explicitTweetClaimGameApplicability} from "../../../web/lib/sources/tweetClaimApplicability";
import {tweetClaimAttribution} from "../../../web/lib/sources/tweetSourceDirectory";
import {easternReportDate} from "../../../web/lib/sources/projectedLineups";

const {Client}=createRequire(join(__dirname,"../../../web/package.json"))("pg") as typeof import("pg");
const task=join(__dirname,".."),original=JSON.parse(readFileSync(join(task,"handoff/extracted-reviewed/ifttt-claim-replay-tests-2026-10-15/acceptance-cases.json"),"utf8"));
const fixtures=JSON.parse(readFileSync(join(task,"game-scope-fixtures-v2/cases.json"),"utf8")),results:any[]=[];
describe.runIf(Boolean(process.env.IFTTT_POSTGRES_BIN))("actual durable game policy reconciliation",()=>{
 const exec=promisify(execFile),bin=process.env.IFTTT_POSTGRES_BIN!,env={...process.env};for(const key of Object.keys(env))if(key.startsWith("PG"))delete env[key];
 let root:string,socket:string,started=false;
 const sql=async(text:string,values:any[]=[],service=true)=>{const db=new Client({host:socket,port:65443,user:"ifttt_reconcile_test",database:"postgres",password:"",ssl:false,options:"",connectionTimeoutMillis:2000});
  await db.connect();try{if(service)await db.query("set role service_role");return (await db.query(text,values)).rows;}finally{await db.end();}};
 const rpc=async(name:string,args:Record<string,unknown>)=>{
  if(!["read_tweet_claim_context","read_tweet_claim_scope","commit_qualified_tweet_claim_scope"].includes(name))throw new Error("Unexpected RPC");
  const entries=Object.entries(args),rows=await sql(`select public.${name}(${entries.map(([k],i)=>`${k}=>$${i+1}`).join(",")}) result`,entries.map(([,v])=>typeof v==="object"&&v!==null?JSON.stringify(v):v));return {data:rows[0]!.result,error:null};
 };
 beforeAll(async()=>{
  root=mkdtempSync(join(tmpdir(),"fhfh-ifttt-reconcile-pg-"));socket=join(root,"socket");mkdirSync(socket,{mode:0o700});
  await exec(join(bin,"initdb"),["-D",join(root,"data"),"--no-locale","--encoding=UTF8","--auth-local=trust","--auth-host=reject","-U","ifttt_reconcile_test"],{env});
  await exec(join(bin,"pg_ctl"),["-D",join(root,"data"),"-l",join(root,"server.log"),"-w","-t","10","-o",`-c listen_addresses='' -c unix_socket_directories='${socket}' -p 65443` ,"start"],{env});started=true;
  await sql("create role service_role bypassrls;create role anon;create role authenticated",[],false);
 },20000);
 beforeEach(async()=>{
  await sql("drop schema public cascade;create schema public;grant usage on schema public to service_role",[],false);
  for(const name of ["migrations/20261016024711_tweet_claim_registry.sql","next-increment/20261016073000_tweet_claim_qualification.sql","durable-occurrence-increment/20261016044953_tweet_claim_occurrence_identity.sql"])
   await sql(readFileSync(join(task,name),"utf8"),[],false);
  for(const name of TWEET_LEGACY_SINKS)await sql(`create table public.${name}(game_id bigint,team_id bigint,player_id bigint,published_at timestamptz,payload jsonb,report_key text,event_key text,tweet_id text,quoted_tweet_id text,capture_key text,source_capture_key text,original_identity text,capture_id text,id text,snapshot_id text,claim_id text,source_tweet_id text,original_tweet_id text);grant select on public.${name} to service_role`,[],false);
  await sql(`create table public.nhl_api_game_roster_spots(game_id bigint,game_date date,team_id bigint,player_id bigint,first_name text,last_name text,position_code text,updated_at timestamptz,source_play_by_play_hash text);
   create table public.nhl_api_game_normalization_status(game_id bigint,status text,completed_at timestamptz,pbp_raw_payload_id bigint,pbp_raw_payload_hash text,normalization_fingerprint text);
   create table public.nhl_api_game_payloads_raw(id bigint,game_id bigint,endpoint text,payload_hash text,source_url text,fetched_at timestamptz);
   grant select on public.nhl_api_game_roster_spots,public.nhl_api_game_normalization_status,public.nhl_api_game_payloads_raw to service_role`,[],false);
 });
 afterAll(async()=>{
  if(started)await exec(join(bin,"pg_ctl"),["-D",join(root,"data"),"-w","-t","10","stop","-m","fast"],{env});if(root)rmSync(root,{recursive:true,force:true});
  writeFileSync(join(__dirname,"outputs/game-storage-results.json"),JSON.stringify({explicitSyntheticIdentityAndCompleteHistory:true,preboundEnvelopes:true,nlpOrAuthenticSourceAcceptance:false,noHostedActions:true,noDispatch:true,results},null,2)+"\n");
 });
 const prepare=async(c:any,explicit:boolean)=>{
  const f=qualifiedFixture(),asOf=c.steps.find((s:any)=>s.asOf).asOf,claims:any[]=[],seeded=new Set<number>();
  for(const r of c.records){
   const gameId=r.interpretation.scope.gameId,teamId=r.interpretation.scope.teamId,date=easternReportDate(r.time.effectiveAt)!;
   const knownAt=new Date(Date.parse(r.time.originalPublishedAt)-3600000).toISOString(),hash="c".repeat(64),normalization="d".repeat(64);
   if(!seeded.has(gameId)){
    await sql("insert into public.nhl_api_game_roster_spots values($1,$2,$3,$4,'Jordan','Staal','C',$5,$6)",[gameId,date,teamId,r.interpretation.subject.playerId,knownAt,hash],false);
    await sql("insert into public.nhl_api_game_normalization_status values($1,'complete',$2,$1,$3,$4)",[gameId,knownAt,hash,normalization],false);
    await sql("insert into public.nhl_api_game_payloads_raw values($1,$1,'play-by-play',$2,$3,$4)",[gameId,hash,`https://api-web.nhle.com/v1/gamecenter/${gameId}/play-by-play`,knownAt],false);
    await sql("insert into public.tweet_claim_legacy_history(audit_id,game_id,team_id,known_at,payload) values($1,$2,$3,$4,$5)",
     [`isolated-${c.id}-${gameId}`,gameId,teamId,knownAt,JSON.stringify({status:"complete",from:knownAt,through:asOf,basis:"synthetic complete private scope",retentionEvidence:"new disposable schema retains all writes",writerFenceEvidence:"single isolated test writer"})],false);seeded.add(gameId);
   }
   const source={...f.source,snapshotDate:easternReportDate(r.time.originalPublishedAt)!,team:{id:teamId,abbreviation:"CAR",name:"Carolina Hurricanes"},gameId,
    tweetId:r.source.originalId,sourceHandle:r.source.originalAuthor,sourceUrl:`https://x.com/${r.source.originalAuthor}/status/${r.source.originalId}`,
    rawText:r.sourceText.text,tweetPostedAt:r.time.originalPublishedAt,observedAt:r.time.receivedAt,metadata:{}};
   const {date:_date,status:_status,...scope}=r.interpretation.scope;
   const semantic={...f.claims[0]!.semantic,original:{tweetId:r.source.originalId,author:r.source.originalAuthor,publishedAt:r.time.originalPublishedAt},
    reportId:r.source.retainedSourceId,sourceKey:r.source.namespace,receivedAt:r.time.receivedAt,interpretedAt:r.time.interpretedAt,evidence:r.occurrence.governingClauseSpan,
    scope,fact:r.interpretation.fact,effectiveAt:r.time.effectiveAt,modality:r.interpretation.modality,
    support:{status:"supported" as const,basis:r.interpretation.validation.basis,validUntil:r.time.validUntil}};
   const game={id:gameId,date,startTime:r.time.effectiveAt,homeTeamId:teamId,awayTeamId:6};
   const gameApplicability=explicit?explicitTweetClaimGameApplicability({game,teamId,publishedAt:r.time.originalPublishedAt,text:source.rawText,governingClause:semantic.evidence}):null;
   if(explicit)expect(gameApplicability).not.toBeNull();
   const claim:any={...f.claims[0],source,attribution:tweetClaimAttribution(source),semantic,gameApplicability,
    lineageKey:r.source.retainedSourceId,scopeKey:`tweet-scope-v1:${claimHash(scope)}`,directoryEvidence:[],aliases:[],claimAnchor:{subjectSpan:r.occurrence.subjectSpan,predicateSpan:r.occurrence.predicateSpan}};
   claim.contentHash=tweetClaimContentHash(claim);claim.semantic={...semantic,id:`tweet-observation-v2:${claim.contentHash}`};claims.push(claim);
  }
  return {claims,asOf};
 };
 for(const c of fixtures.positiveCases as any[])it(`${c.id} satisfies every versioned game-separation assertion through actual RPC storage`,async()=>{
  const {claims,asOf}=await prepare(c,true);for(const claim of claims)await retainQualifiedTweetClaimScope({rpc},[claim],asOf);
  const outputs:any={};
  for(const [i,claim] of claims.entries()){
   const q=(await sql("select qualification_state from public.tweet_claim_scopes where scope_key=$1",[claim.scopeKey]))[0]!.qualification_state;
   expect(q.plan.reviewableEffects).toHaveLength(1);const effect=q.plan.reviewableEffects[0],native=q.plan.nextState.registry.effects.find((e:any)=>e.effectKey===effect.effectKey);
   const binding=q.bindings.find((b:any)=>b.observationId===claim.semantic.id);
   outputs[c.records[i].recordId]={sourceClaimId:binding?.occurrenceId,scenarioId:effect.scenarioKey,scenarioRevisionId:native.revisionId,effectId:effect.effectKey};
  }
  const result={scenarioCount:new Set(Object.values(outputs).map((r:any)=>r.scenarioId)).size,newEffectProposalCount:(await sql("select * from public.tweet_claim_outbox")).length};
  const outcome={records:outputs,result},assertions=c.assertions.map((a:any)=>{
   const actual=a.op==="equals"?a.path.split(".").reduce((v:any,k:string)=>v?.[k],outcome):a.records.map((id:string)=>outputs[id]?.[a.field]);
   if(a.op==="equals")expect(actual).toEqual(a.value);else{expect(actual.every((v:any)=>v!==undefined&&v!==null)).toBe(true);expect(new Set(actual).size).toBe(actual.length);}
   return {assertion:a,actual,pass:true};
  });
  expect(await sql("select distinct status,requires_review from public.tweet_claim_outbox")).toEqual([{status:"held",requires_review:true}]);
  results.push({id:c.id,status:"passed_actual_rpc",assertions,outcome});
 });
 for(const id of ["CR011","CR051"])it(`${id} original ambiguous variants retain one allocation and hold additional independent effects`,async()=>{
  const c=original.cases.find((r:any)=>r.id===id),{claims,asOf}=await prepare(c,false);
  for(const claim of claims)await retainQualifiedTweetClaimScope({rpc},[claim],asOf);
  const context=(await rpc("read_tweet_claim_context",{p_scope:claims[1].scopeKey,p_incoming:[claims[1]],p_asof:asOf})).data,q=context.qualificationState;
  expect(q.plan.reviewableEffects).toEqual([]);expect(q.plan.dispatchInstructions).toEqual([]);expect(q.holds.length+q.plan.holds.length).toBeGreaterThan(0);
  expect(context.occurrenceContext.state.occurrences).toHaveLength(1);
  const outbox=await sql("select action_key,status,requires_review from public.tweet_claim_outbox");
  const states=await sql("select qualification_state from public.tweet_claim_scopes");
  const nativeEffects=[...new Set(states.flatMap(row=>row.qualification_state.plan.nextState.registry.effects.map((e:any)=>e.effectKey)))];
  // Raw semantic outbox rows are review-only carriers, not canonical effect
  // allocations. Preserve their retained evidence while testing the native ledger.
  expect(nativeEffects.length).toBeLessThanOrEqual(1);
  expect(outbox.every(row=>row.status==="held"&&row.requires_review)).toBe(true);
  expect(await sql("select count(*)::int n from public.tweet_claim_observations")).toEqual([{n:2}]);
  results.push({id:`${id}-AMBIGUOUS-NEGATIVE-durable`,status:"passed_actual_rpc",holdReasons:[...q.holds,...q.plan.holds],canonicalOccurrences:1,nativeEffects,outbox,
   carrierMapping:"Review-only raw semantic carrier rows are not counted as native r3 effect identities."});
 });
});
