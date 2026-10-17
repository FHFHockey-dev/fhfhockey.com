// @vitest-environment node
import {execFile} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from "node:fs";
import {createRequire} from "node:module";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {promisify} from "node:util";
import {afterAll,afterEach,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";
import {prepareTweetClaimForecastDelivery,bindTweetClaimForecastDelivery,recoverTweetClaimForecastDelivery,type TweetForecastConsumerPlan,type TweetForecastPriorProof} from "../../../web/lib/sources/tweetClaimForecastDelivery";
import {capturePlayerForecastSourceRows} from "../../../web/lib/player-forecasts/sourceObservations";
import {extractTweetPlayerEvents} from "../../../web/lib/sources/tweetPlayerEvents";
import {claimHash,extractDurableTweetClaims} from "../../../web/lib/sources/tweetClaimExtraction";
import {qualifyTweetClaimScope} from "../../../web/lib/sources/tweetClaimLineage";
import {TWEET_LEGACY_SINKS} from "../../../web/lib/sources/tweetClaimEvidence";

const {Client}=createRequire(join(__dirname,"../../../web/package.json"))("pg") as typeof import("pg");
const task=join(__dirname,".."),repo=join(__dirname,"../../.."),oracleText=readFileSync(join(task,"handoff/extracted-reviewed/ifttt-claim-replay-tests-2026-10-15/acceptance-cases.json"),"utf8");
const oracle=JSON.parse(oracleText),results:any[]=[];
const assertOriginal=(c:any,result:any)=>c.assertions.map((a:any)=>{const actual=a.path.split(".").reduce((v:any,k:string)=>v?.[k],{result});expect(actual).toEqual(a.value);return {assertion:a,actual,pass:true};});

describe("forecast consumer default",()=>{
 it("does no work unless explicitly enabled",async()=>{
  const db={from:vi.fn(),rpc:vi.fn()};expect(await prepareTweetClaimForecastDelivery({db,source:{} as any})).toEqual({status:"disabled"});
  expect(await recoverTweetClaimForecastDelivery({db,key:"none"})).toEqual({status:"disabled"});expect(db.from).not.toHaveBeenCalled();expect(db.rpc).not.toHaveBeenCalled();
 });
});
describe.runIf(Boolean(process.env.IFTTT_POSTGRES_BIN))("real forecast capture, queue and retained action binding",()=>{
 const exec=promisify(execFile),bin=process.env.IFTTT_POSTGRES_BIN!,env={...process.env};for(const key of Object.keys(env))if(key.startsWith("PG"))delete env[key];
 let root:string,socket:string,started=false;
 const client=async(service=false)=>{const db=new Client({host:socket,port:65442,user:"ifttt_consumer_test",database:"postgres",password:"",ssl:false,options:"",connectionTimeoutMillis:2000});await db.connect();if(service)await db.query("set role service_role");return db;};
 const sql=async(text:string,values:any[]=[],service=false)=>{const db=await client(service);try{return (await db.query(text,values)).rows;}finally{await db.end();}};
 const ddl=(source:string,table:string)=>{const match=source.match(new RegExp(`create table public\\.${table} \\([\\s\\S]*?\\n\\);`,"i"))?.[0];if(!match)throw new Error(`Missing retained DDL ${table}`);return match;};
 const fault={applyAck:false,settleAck:false,captureAck:false,receiptAck:false};
 const rpc=async(name:string,args:Record<string,unknown>)=>{
  if(!["bind_tweet_claim_forecast_delivery","read_tweet_claim_forecast_delivery","apply_tweet_claim_forecast_delivery","acknowledge_tweet_claim_forecast_delivery","claim_tweet_claim_delivery","settle_tweet_claim_delivery","capture_starter_board_lineup","enqueue_player_forecast_job"].includes(name))throw new Error(`Unexpected fixture RPC ${name}`);
  const entries=Object.entries(args),rows=await sql(`select to_jsonb(public.${name}(${entries.map(([key],i)=>`${key}=>$${i+1}`).join(",")})) result`,entries.map(([,v])=>v!==null&&typeof v==="object"?JSON.stringify(v):v),true);
  if(name==="apply_tweet_claim_forecast_delivery"&&fault.applyAck){fault.applyAck=false;throw new Error("consumer commit acknowledgement lost");}
  if(name==="settle_tweet_claim_delivery"&&fault.settleAck){fault.settleAck=false;throw new Error("queue caller acknowledgement lost");}
  if(name==="capture_starter_board_lineup"&&fault.captureAck){fault.captureAck=false;throw new Error("legacy capture committed before dispatch acknowledgement");}
  if(name==="acknowledge_tweet_claim_forecast_delivery"&&fault.receiptAck){fault.receiptAck=false;throw new Error("retained receipt acknowledged before worker queue reply lost");}
  return {data:rows[0]!.result,error:null};
 };
 const tables={line_source_snapshots:"capture_key",lines_ccc:"capture_key",tweet_projection_reports:"report_key",tweet_player_events:"event_key",games:"id",roster_optimizer_team_games:"id"};
 const insert=async(table:keyof typeof tables,row:any)=>{
  const e=Object.entries(row).filter(([,v])=>v!==undefined);if(e.some(([k])=>!/^[A-Za-z_][A-Za-z_0-9]*$/.test(k)))throw new Error("Invalid fixture key");
  await sql(`insert into public.${table}(${e.map(([k])=>`"${k}"`).join(",")}) values(${e.map((_,i)=>`$${i+1}`).join(",")}) on conflict("${tables[table]}") do nothing`,e.map(([,v])=>v),true);
 };
 const from=(name:string)=>{
  if(!(name in tables))throw new Error(`Unexpected fixture table ${name}`);const table=name as keyof typeof tables;
  return {upsert:async(rows:any[],options:any)=>{expect(options).toEqual({onConflict:tables[table],ignoreDuplicates:true});for(const row of rows)await insert(table,row);return {error:null};},select:()=>{
   const filters:Array<(r:any)=>boolean>=[],orders:Array<[string,boolean]>=[];let start=0,end=1000;
   const q:any={eq:(k:string,v:any)=>{filters.push(r=>r[k]===v);return q;},in:(k:string,v:any[])=>{filters.push(r=>v.includes(r[k]));return q;},
    gte:(k:string,v:any)=>{filters.push(r=>r[k]>=v);return q;},lte:(k:string,v:any)=>{filters.push(r=>r[k]<=v);return q;},
    or:(expression:string)=>{const parts=expression.split(",").map(p=>p.split("."));filters.push(r=>parts.some(([k,op,v])=>op==="eq"&&String(r[k!])===v));return q;},
    order:(k:string,o:any={})=>{orders.push([k,o.ascending!==false]);return q;},range:(a:number,b:number)=>{start=a;end=b+1;return q;},limit:(n:number)=>{end=n;return q;},abortSignal:()=>q,
    then:async(resolve:any,reject:any)=>{try{let rows=(await sql(`select to_jsonb(t) body from public.${table} t`,[],true)).map(x=>x.body).filter(r=>filters.every(f=>f(r)));
     rows.sort((a,b)=>{for(const [k,asc] of orders){const n=typeof a[k]==="number"?a[k]-b[k]:String(a[k]).localeCompare(String(b[k]));if(n)return asc?n:-n;}return 0;});return resolve({data:rows.slice(start,end),count:rows.length,error:null});}catch(error){return reject(error);}}};return q;
  }};
 };
 const db={from,rpc};
 const fixture=async(id="CR042",current=false)=>{
  const c=oracle.cases.find((c:any)=>c.id===id),r=structuredClone(c.records[0]);
  const appClock=current?new Date().toISOString():r.time.interpretedAt;
  if(current){const delta=Date.parse(appClock)-Date.parse(r.time.interpretedAt);for(const [k,v] of Object.entries(r.time))if(typeof v==="string")r.time[k]=new Date(Date.parse(v)+delta).toISOString();}
  vi.setSystemTime(appClock);const text=r.sourceText.text,publishedAt=r.time.originalPublishedAt;
  const date=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York"}).format(new Date(publishedAt));
  const interpretation={version:r.interpretation.ruleVersion,context:"game",certainty:"confirmed",units:[],unresolved:[],events:extractTweetPlayerEvents({text,players:[{playerId:8473533,fullName:"Jordan Staal",lastName:"Staal",position:"C",teamId:12}],publishedAt,includeClaimAnchors:true})};
  const source:any={snapshotDate:date,team:{id:12,abbreviation:"CAR",name:"Carolina Hurricanes"},gameId:900012,tweetId:r.source.relayId,sourceUrl:null,
   primaryTextSource:"quoted_oembed",quotedTweetId:r.source.originalId,quotedTweetUrl:`https://x.com/${r.source.originalAuthor}/status/${r.source.originalId}`,quotedAuthorHandle:r.source.originalAuthor,quotedRawText:text,
   tweetPostedAt:publishedAt,observedAt:r.time.receivedAt,nhlFilterStatus:"accepted",detectedLeague:"NHL",rawText:text,metadata:{interpretation}};
  const raw={capture_key:r.source.retainedSourceId,source:"fixture_original",source_group:r.source.namespace,source_key:r.source.namespace,source_account:r.source.originalAuthor,
   snapshot_date:date,tweet_id:r.source.relayId,source_url:null,tweet_url:null,primary_text_source:"quoted_oembed",quoted_tweet_id:r.source.originalId,quoted_tweet_url:source.quotedTweetUrl,quoted_author_handle:r.source.originalAuthor,quoted_raw_text:text,
   game_id:900012,team_id:12,team_abbreviation:"CAR",team_name:"Carolina Hurricanes",status:"observed",nhl_filter_status:"accepted",raw_text:text,observed_at:r.time.receivedAt,tweet_posted_at:publishedAt,updated_at:r.time.receivedAt,metadata:source.metadata,raw_payload:r};
  await insert("line_source_snapshots",raw);
  for(const [i,gameId] of [900012,900013].entries()){
   const start=new Date(Date.parse(r.time.effectiveAt)+i*86400000).toISOString(),gameDate=start.slice(0,10);
   await insert("games",{id:gameId,seasonId:20262027,date:gameDate,startTime:start,homeTeamId:12,awayTeamId:6,type:2});
   for(const [team,opp,ab,opab,side] of [[12,6,"CAR","BOS","home"],[6,12,"BOS","CAR","away"]] as const)
    await insert("roster_optimizer_team_games",{id:gameId*10+team,source_game_id:gameId,source_season_id:20262027,season:"2026",game_type:2,game_date:gameDate,team_id:team,opponent_team_id:opp,team_abbreviation:ab,opponent_abbreviation:opab,home_away:side,start_time:start,game_status:"FUT",schedule_status:"OK",fetched_at:publishedAt});
  }
  let prepared:Awaited<ReturnType<typeof prepareTweetClaimForecastDelivery>>;
  try{prepared=await prepareTweetClaimForecastDelivery({db,source,enabled:true});}catch(error){if(error&&typeof error==="object"&&"receipt" in error)throw new Error(JSON.stringify(error.receipt));throw error;}
  expect(prepared.status).toBe("prepared");if(prepared.status!=="prepared")throw new Error("Missing plan");
  expect(prepared.plan.queues).toHaveLength(2);expect(prepared.plan.assignments).toMatchObject([{player_id:8473533,unit_type:"injury",assignment_status:"ruled_out"}]);
  expect(await sql("select * from public.player_forecast_lineup_snapshots")).toEqual([]);expect(await sql("select * from public.player_forecast_inference_queue")).toEqual([]);
  const key=c.preconditions.durableEffectId,transitionId=c.preconditions.durableTransitionId??"fixture-transition-1";
  const semantic={id:`retained-original:${r.recordId}`,reportId:r.source.retainedSourceId,sourceKey:r.source.namespace,
   original:{tweetId:r.source.originalId,author:r.source.originalAuthor,publishedAt:r.time.originalPublishedAt},
   wrapper:{tweetId:r.source.relayId,publishedAt:r.time.wrapperPublishedAt},receivedAt:r.time.receivedAt,interpretedAt:r.time.interpretedAt,
   evidence:r.occurrence.governingClauseSpan,scope:{kind:"game",teamId:r.interpretation.scope.teamId,gameId:r.interpretation.scope.gameId,phase:"entry",group:null},
   fact:r.interpretation.fact,effectiveAt:r.time.effectiveAt,modality:"asserted",support:{status:"supported",basis:r.interpretation.validation.basis,validUntil:r.time.validUntil},relation:r.interpretation.relation};
  const payload={action:{key,transitionId},observation:{semantic}};
  await sql("insert into public.tweet_claim_scopes(scope_key,reduction) values('consumer-original-scope',$1)",[JSON.stringify({actions:[{key}]})]);
  await sql("insert into public.tweet_claim_outbox(action_key,scope_key,scenario_key,revision_key,payload,status,requires_review) values($1,'consumer-original-scope','original-scenario','original-revision',$2,'pending',false)",[key,JSON.stringify(payload)]);
  const proof=(status:TweetForecastPriorProof["status"]):TweetForecastPriorProof=>({status,basis:c.preconditions.positiveNoDispatchProof??`original ${id} durable prior-state precondition`,retentionEvidence:"fresh private cluster retains complete native rows",writerFenceEvidence:"only local real consumer and test fault writer; no scheduler or other writers",knownAt:r.time.interpretedAt,effectId:key,transitionId,planHash:prepared.planHash});
  return {c,r,key,transitionId,source,plan:prepared.plan,proof};
 };
 const bind=(f:Awaited<ReturnType<typeof fixture>>,status:TweetForecastPriorProof["status"])=>bindTweetClaimForecastDelivery({db,key:f.key,transitionId:f.transitionId,plan:f.plan,proof:f.proof(status),enabled:true});
 const native=async(plan:TweetForecastConsumerPlan,queue=true)=>{
  await rpc("capture_starter_board_lineup",{p_snapshot:plan.snapshot,p_assignments:plan.assignments});
  if(queue)for(const q of plan.queues)await rpc("enqueue_player_forecast_job",q);
 };
 const inventory=async()=>({snapshots:(await sql("select * from public.player_forecast_lineup_snapshots")).length,assignments:(await sql("select * from public.player_forecast_lineup_assignments")).length,
  queues:(await sql("select * from public.player_forecast_inference_queue")).length,receipts:(await sql("select * from public.tweet_claim_forecast_receipts")).length,forgeQueues:(await sql("select * from public.forge_game_update_queue")).length});
 beforeAll(async()=>{
  expect(createHash("sha256").update(oracleText).digest("hex")).toBe("d9fe45ca44042673ff0381cd0f1981074b196da99fb6fdf9da573ac5df84fd8b");
  root=mkdtempSync(join(tmpdir(),"fhfh-ifttt-consumer-pg-"));socket=join(root,"socket");mkdirSync(socket,{mode:0o700});
  await exec(join(bin,"initdb"),["-D",join(root,"data"),"--no-locale","--encoding=UTF8","--auth-local=trust","--auth-host=reject","-U","ifttt_consumer_test"],{env});
  await exec(join(bin,"pg_ctl"),["-D",join(root,"data"),"-l",join(root,"server.log"),"-w","-t","10","-o",`-c listen_addresses='' -c unix_socket_directories='${socket}' -p 65442`,"start"],{env});started=true;
  await sql("create role service_role bypassrls;create role anon;create role authenticated");
 },20000);
 beforeEach(async()=>{
  await sql("drop schema public cascade;drop schema if exists fhfh_internal cascade;create schema public;create schema fhfh_internal;grant usage on schema public,fhfh_internal to service_role");
  for(const migration of ["migrations/20261016024711_tweet_claim_registry.sql","next-increment/20261016073000_tweet_claim_qualification.sql","durable-occurrence-increment/20261016044953_tweet_claim_occurrence_identity.sql"])
   await sql(readFileSync(join(task,migration),"utf8"));
  await sql('create table public.teams(id bigint primary key);create table public.players(id bigint primary key);create table public.games(id bigint primary key,"seasonId" bigint,date date,"startTime" timestamptz,"homeTeamId" bigint,"awayTeamId" bigint,type integer);insert into public.teams values(12),(6);insert into public.players values(8473533);create table public.forge_runs(run_id uuid primary key)');
  const baseline=readFileSync(join(repo,"supabase/migrations/20260716112908_production_schema_baseline.sql"),"utf8"),reports=readFileSync(join(repo,"supabase/migrations/20260919005608_tweet_pipeline_reports_and_review.sql"),"utf8"),foundation=readFileSync(join(repo,"supabase/migrations/20260802163747_add_player_forecast_foundation.sql"),"utf8");
  for(const table of ["line_source_snapshots","lines_ccc"]){await sql(ddl(baseline,table));await sql(`alter table public.${table} add primary key(capture_key)`);}
  for(const table of ["tweet_projection_reports","tweet_player_events"])await sql(ddl(reports,table));
  for(const table of ["player_forecast_lineup_snapshots","player_forecast_lineup_assignments","player_forecast_inference_queue","player_forecast_goalie_start_observations"])await sql(ddl(foundation,table));
  const enqueue=foundation.match(/create or replace function public\.enqueue_player_forecast_job\([\s\S]*?\n\$\$;/)?.[0];expect(enqueue).toBeDefined();await sql(enqueue!);
  await sql(readFileSync(join(repo,"supabase/migrations/20260916044919_starter_board_atomic_lineup_capture.sql"),"utf8"));
  const news=readFileSync(join(repo,"supabase/migrations/20260916014510_starter_board_news_queue.sql"),"utf8").split("create function fhfh_internal.enqueue_starter_board_resolution")[0];await sql(news+"\ncommit;");
  await sql("create table public.roster_optimizer_team_games(id bigint primary key,source_game_id bigint,source_season_id bigint,season text,game_type integer,game_date date,team_id bigint,opponent_team_id bigint,team_abbreviation text,opponent_abbreviation text,home_away text,start_time timestamptz,game_status text,schedule_status text,fetched_at timestamptz);grant select,insert,update on all tables in schema public to service_role;grant usage,select on all sequences in schema public to service_role;grant execute on all functions in schema public,fhfh_internal to service_role");
  await sql(readFileSync(join(__dirname,"20261016060900_tweet_claim_forecast_delivery.sql"),"utf8"));
  vi.stubEnv("TWEET_CLAIMS_MODE","");vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED","true");vi.stubEnv("TWEET_PIPELINE_PUBLISHING_ENABLED","true");vi.useFakeTimers({toFake:["Date"]});
 });
 afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();fault.applyAck=false;fault.settleAck=false;fault.captureAck=false;fault.receiptAck=false;});
 afterAll(async()=>{
  if(started)await exec(join(bin,"pg_ctl"),["-D",join(root,"data"),"-w","-t","10","stop","-m","fast"],{env});if(root)rmSync(root,{recursive:true,force:true});
  writeFileSync(join(__dirname,"consumer-binding-results.json"),JSON.stringify({originalOracleSha256:createHash("sha256").update(oracleText).digest("hex"),
   candidateManifest:"owned-source-v1-sha256.json",candidateManifestSha256:createHash("sha256").update(readFileSync(join(__dirname,"owned-source-v1-sha256.json"),"utf8")).digest("hex"),
   noHostedActions:true,noProductionDispatch:true,actualProducerAndConsumer:true,fullOriginalAcceptance:false,independentReviewPending:true,results},null,2)+"\n");
 });
 it("CR042 original clocks recover the real retained binding and proof without a new identity or expired dispatch",async()=>{
  const f=await fixture();await bind(f,"verified_not_dispatched");const before=await inventory();const recovered=await recoverTweetClaimForecastDelivery({db,key:f.key,enabled:true});
  expect(recovered.status).toBe("held");expect(await inventory()).toEqual(before);
  const result={effectIdAfterRetry:(recovered as any).effectId,transitionIdAfterRetry:(recovered as any).transitionId,newEffectIdentityCount:(await sql("select action_key from public.tweet_claim_outbox where action_key<>$1",[f.key])).length};
  results.push({id:f.c.id,originalClocksPreserved:true,result,assertions:assertOriginal(f.c,result),recovered,plan:f.plan});
 });
 it("CR043 original clocks keep actual partial consumer history unknown without a send or new identity",async()=>{
  const f=await fixture("CR043");fault.captureAck=true;await expect(native(f.plan)).rejects.toThrow("before dispatch acknowledgement");await bind(f,"unknown");const before=await inventory();const recovered=await recoverTweetClaimForecastDelivery({db,key:f.key,enabled:true});
  expect(recovered.status).toBe("unknown");expect(await inventory()).toEqual(before);
  const result={resendPlanCount:(recovered as any).resendPlanCount,newEffectIdentityCount:(await sql("select action_key from public.tweet_claim_outbox where action_key<>$1",[f.key])).length,holdReasons:(recovered as any).holdReasons};
  results.push({id:f.c.id,originalClocksPreserved:true,result,assertions:assertOriginal(f.c,result),recovered,inventory:before});
 });
 it("CR044 original clocks adopt verified real native capture and queue receipts then suppress replay after caller loss",async()=>{
  const f=await fixture("CR044");await native(f.plan);await bind(f,"verified_delivered");const before=await inventory();
  fault.receiptAck=true;await expect(recoverTweetClaimForecastDelivery({db,key:f.key,enabled:true})).rejects.toThrow("worker queue reply lost");
  const second=await recoverTweetClaimForecastDelivery({db,key:f.key,enabled:true});expect(second.status).toBe("applied");expect(await inventory()).toEqual(before);
  const result={resendPlanCount:(second as any).resendPlanCount,newEffectIdentityCount:(await sql("select action_key from public.tweet_claim_outbox where action_key<>$1",[f.key])).length,effectId:(second as any).effectId};
  results.push({id:f.c.id,originalClocksPreserved:true,result,assertions:assertOriginal(f.c,result),recovered:second,inventory:before});
 });
 it("atomically captures actual native snapshot, assignments, both queue scopes, news trigger and receipt",async()=>{
  const f=await fixture("CR042",true);await bind(f,"verified_not_dispatched");const result=await recoverTweetClaimForecastDelivery({db,key:f.key,enabled:true});
  writeFileSync(join(__dirname,"evidence/atomic-probe.json"),JSON.stringify({result,outbox:await sql("select * from public.tweet_claim_outbox"),inventory:await inventory()},null,2)+"\n");expect(result.status).toBe("applied");
  expect(await inventory()).toEqual({snapshots:1,assignments:1,queues:2,receipts:1,forgeQueues:1});
  const before=await inventory();expect(await recoverTweetClaimForecastDelivery({db,key:f.key,enabled:true})).toEqual(result);expect(await inventory()).toEqual(before);
  results.push({id:"current_atomic_consumer",status:"passed",result,inventory:before});
 });
 it("recovers exact receipt after actual consumer commit acknowledgement loss",async()=>{
  const f=await fixture("CR042",true);await bind(f,"verified_not_dispatched");fault.applyAck=true;
  const first=await recoverTweetClaimForecastDelivery({db,key:f.key,enabled:true});expect(first.status).toBe("applied");
  expect((await sql("select status from public.tweet_claim_outbox"))[0]!.status).toBe("delivered");
  const after=await inventory();expect(await recoverTweetClaimForecastDelivery({db,key:f.key,enabled:true})).toEqual(first);expect(await inventory()).toEqual(after);
 });
 it("retains receipt and suppresses replay after outbox settlement reply is lost",async()=>{
  const f=await fixture("CR042",true);await bind(f,"verified_not_dispatched");fault.settleAck=true;
  const first=await recoverTweetClaimForecastDelivery({db,key:f.key,enabled:true});expect(first.status).toBe("applied");const before=await inventory();
  expect(await recoverTweetClaimForecastDelivery({db,key:f.key,enabled:true})).toEqual(first);expect(await inventory()).toEqual(before);
 });
 it("rolls back snapshot, assignments, first queue and news trigger when the second queue fails",async()=>{
  const f=await fixture("CR042",true);await bind(f,"verified_not_dispatched");
  await sql("create function fixture_fail_second_queue() returns trigger language plpgsql as $$begin if new.game_id=900013 then raise exception 'second queue fault';end if;return new;end$$;create trigger fixture_fail_second_queue before insert on public.player_forecast_inference_queue for each row execute function fixture_fail_second_queue()");
  expect((await recoverTweetClaimForecastDelivery({db,key:f.key,enabled:true})).status).toBe("unknown");
  expect(await inventory()).toEqual({snapshots:0,assignments:0,queues:0,receipts:0,forgeQueues:0});
  await sql("drop trigger fixture_fail_second_queue on public.player_forecast_inference_queue;drop function fixture_fail_second_queue();update public.tweet_claim_outbox set next_attempt_at=now()");
  expect((await recoverTweetClaimForecastDelivery({db,key:f.key,enabled:true})).status).toBe("retry_ready");await sql("update public.tweet_claim_outbox set next_attempt_at=now()");
  expect((await recoverTweetClaimForecastDelivery({db,key:f.key,enabled:true})).status).toBe("applied");
 });
 it("rejects same-action changed parent/assignments and incomplete delivered adoption without adding bindings",async()=>{
  const f=await fixture("CR044");await native(f.plan,false);await expect(bind(f,"verified_delivered")).rejects.toThrow("complete native consumer delivery receipt missing");
  expect(await sql("select * from public.tweet_claim_forecast_bindings")).toEqual([]);
  const altered=structuredClone(f.plan);altered.assignments[0]!.player_id=1;
  await expect(bindTweetClaimForecastDelivery({db,key:f.key,transitionId:f.transitionId,plan:altered,proof:{...f.proof("unknown"),planHash:claimHash(altered)},enabled:true})).rejects.toThrow("retained semantic action mismatch");
 });
 it("serializes two actual consumer workers",async()=>{
  const f=await fixture("CR042",true);await bind(f,"verified_not_dispatched");
  const results=await Promise.all([recoverTweetClaimForecastDelivery({db,key:f.key,enabled:true}),recoverTweetClaimForecastDelivery({db,key:f.key,enabled:true})]);expect(results.some(r=>r.status==="applied")).toBe(true);
  expect(await inventory()).toEqual({snapshots:1,assignments:1,queues:2,receipts:1,forgeQueues:1});
 });
 it("fences stale apply ownership before any native side effect",async()=>{
  const f=await fixture("CR042",true);await bind(f,"verified_not_dispatched");
  const old="00000000-0000-4000-8000-000000000001",replacement="00000000-0000-4000-8000-000000000002";
  await rpc("claim_tweet_claim_delivery",{p_key:f.key,p_owner:old});await sql("update public.tweet_claim_outbox set lease_until=now()-interval '1 second'");
  expect((await rpc("claim_tweet_claim_delivery",{p_key:f.key,p_owner:replacement})).data.mode).toBe("reconcile");
  await expect(rpc("apply_tweet_claim_forecast_delivery",{p_key:f.key,p_owner:old})).rejects.toThrow("not safely dispatchable");
  expect(await inventory()).toEqual({snapshots:0,assignments:0,queues:0,receipts:0,forgeQueues:0});
 });
 it("leaves uncertain acknowledgement/readback failure recoverable without another native application",async()=>{
  const f=await fixture("CR042",true);await bind(f,"verified_not_dispatched");let committed=false;
  const broken={...db,rpc:async(name:string,args:Record<string,unknown>)=>{if(committed&&name==="read_tweet_claim_forecast_delivery")throw new Error("readback unavailable");const r=await rpc(name,args);if(name==="apply_tweet_claim_forecast_delivery"){committed=true;throw new Error("commit response lost");}return r;}};
  await expect(recoverTweetClaimForecastDelivery({db:broken,key:f.key,enabled:true})).rejects.toThrow("readback unavailable");
  const before=await inventory();expect(before).toEqual({snapshots:1,assignments:1,queues:2,receipts:1,forgeQueues:1});
  expect((await recoverTweetClaimForecastDelivery({db,key:f.key,enabled:true})).status).toBe("applied");expect(await inventory()).toEqual(before);
 });
 it("rejects forged native receipts and immutable receipt/binding changes; denies public RPC access",async()=>{
  const f=await fixture("CR042",true);await bind(f,"verified_not_dispatched");
  await expect(sql("insert into public.tweet_claim_forecast_receipts(action_key,plan_hash,payload) values($1,$2,'{}')",[f.key,claimHash(f.plan)],true)).rejects.toThrow("receipt lacks exact native consumer evidence");
  await expect(sql("update public.tweet_claim_forecast_bindings set transition_id='changed'")).rejects.toThrow("immutable forecast action evidence");
  const connection=await client();try{await connection.query("set role anon");await expect(connection.query("select public.read_tweet_claim_forecast_delivery($1)",[f.key])).rejects.toThrow("permission denied");}finally{await connection.end();}
  await recoverTweetClaimForecastDelivery({db,key:f.key,enabled:true});await expect(sql("delete from public.tweet_claim_forecast_receipts")).rejects.toThrow("immutable forecast action evidence");
 });
 it("holds unknown coverage and changed retained payload without invoking consumers",async()=>{
  const f=await fixture("CR042",true);await bind(f,"unknown");const before=await inventory();
  expect((await recoverTweetClaimForecastDelivery({db,key:f.key,enabled:true})).status).toBe("unknown");expect(await inventory()).toEqual(before);
  await sql("update public.tweet_claim_outbox set payload=jsonb_set(payload,'{action,transitionId}','\"another-transition\"')");
  expect((await recoverTweetClaimForecastDelivery({db,key:f.key,enabled:true})).status).toBe("unknown");expect(await inventory()).toEqual(before);
 });
 it("retains real r3 effect and transition IDs separately from the delivery carrier key",async()=>{
  const f=await fixture("CR042",true),knownAt=new Date(Date.parse(f.r.time.originalPublishedAt)-3600000).toISOString();
  // Explicit synthetic directory prior supplements the retained dated roster;
  // it is not binding authority and does not modify the original DSL fixture.
  const nativeSource={...f.source,metadata:{...f.source.metadata,tweetSourceDirectoryHint:{status:"consistent_prior",teamId:12,bindingAuthority:false}}};
  const claims=extractDurableTweetClaims({source:nativeSource,game:{id:900012,date:f.source.snapshotDate,startTime:f.r.time.effectiveAt,homeTeamId:12,awayTeamId:6},interpretedAt:f.r.time.interpretedAt});
  expect(claims).toHaveLength(1);const qualified=qualifyTweetClaimScope(claims[0]!.scopeKey,claims,{readAt:f.r.time.interpretedAt,
   identities:[{gameId:900012,date:f.source.snapshotDate,playerId:8473533,teamId:12,league:"NHL",fullName:"Jordan Staal",role:"skater",knownAt,sourceUrl:"https://api-web.nhle.com/v1/gamecenter/900012/play-by-play",rawPayloadId:"1",rawPayloadHash:"a".repeat(64),normalizationFingerprint:"b".repeat(64)}],
   sinks:TWEET_LEGACY_SINKS.map(sink=>({sink,complete:true,rows:[]})),history:{status:"complete",from:knownAt,through:f.r.time.interpretedAt,basis:"synthetic retained pre-consumer canonical state",retentionEvidence:"complete private fixture",writerFenceEvidence:"single fixture writer"}},[],f.r.time.interpretedAt);
  expect(qualified.plan.reviewableEffects,JSON.stringify(qualified.holds)).toHaveLength(1);const native=qualified.plan.reviewableEffects[0]!;
  expect(native.effectKey).not.toBe(f.key);
  await sql("update public.tweet_claim_scopes set qualification_state=$1",[JSON.stringify(qualified)]);
  await sql("update public.tweet_claim_outbox set scenario_key=$1,payload=payload#-'{action,transitionId}'",[native.scenarioKey]);
  const before=(await sql("select qualification_state from public.tweet_claim_scopes"))[0]!.qualification_state;
  await bindTweetClaimForecastDelivery({db,key:f.key,transitionId:native.transitionId,plan:f.plan,proof:{...f.proof("verified_not_dispatched"),effectId:native.effectKey,transitionId:native.transitionId},enabled:true});
  const recovered=await recoverTweetClaimForecastDelivery({db,key:f.key,enabled:true});expect(recovered).toMatchObject({status:"applied",effectId:native.effectKey,transitionId:native.transitionId});
  expect((recovered as any).receipt.actionKey).toBe(f.key);expect((await sql("select action_key from public.tweet_claim_outbox"))[0]!.action_key).toBe(f.key);
  expect((await sql("select qualification_state from public.tweet_claim_scopes"))[0]!.qualification_state).toEqual(before);
  results.push({id:"native_r3_identity_compatibility",native,carrierKey:f.key,recovered});
 });
});
