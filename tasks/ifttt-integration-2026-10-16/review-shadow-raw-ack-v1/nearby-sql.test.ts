// @vitest-environment node
import {execFile} from "node:child_process";
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from "node:fs";
import {createRequire} from "node:module";
import {join} from "node:path";
import {promisify} from "node:util";
import {afterAll,beforeAll,beforeEach,describe,expect,it} from "vitest";
const {Client}=createRequire(join(__dirname,"../../../web/package.json"))("pg") as typeof import("pg");
describe.runIf(Boolean(process.env.IFTTT_POSTGRES_BIN))("unwired draft atomic shadow raw/job RPC",()=>{
 const exec=promisify(execFile),bin=process.env.IFTTT_POSTGRES_BIN!,env={...process.env};for(const k of Object.keys(env))if(k.startsWith("PG"))delete env[k];
 let root:string,socket:string,started=false,receivedAt:string,interpretedAt:string;
 const id="00000000-0000-4000-8000-000000000001",owner="00000000-0000-4000-8000-000000000002",other="00000000-0000-4000-8000-000000000003";
 const expected={text:"isolated synthetic retained fixture",receipt:"local-only"},tweetId="fixture-raw-post";
 const sql=async(text:string,values:any[]=[],role:string|null="service_role")=>{
  const c=new Client({host:socket,port:65446,user:"ifttt_raw_atomic",database:"postgres",password:"",ssl:false,options:"",connectionTimeoutMillis:2000});
  await c.connect();try{if(role)await c.query(`set role ${role}`);return (await c.query(text,values)).rows;}finally{await c.end();}
 };
 const jobKey=(table:string)=>`ingest:${table}:${id}`;
 const observation=(name:string)=>({semantic:{id:name,reportId:`tweet-receipt-v2:${tweetId}`,receivedAt,interpretedAt},source:{tweetId,rawPayload:expected,metadata:{iftttEventId:id}}});
 const seedObservation=async(name:string)=>sql("insert into public.tweet_claim_observations(observation_id,scope_key,content_hash,lineage_key,payload) values($1,'fixture-scope','fixture-hash',$2,$3)",[name,`tweet-receipt-v2:${tweetId}`,JSON.stringify(observation(name))]);
 const seedRaw=async(table="line_source_ifttt_events")=>{
  const columns=table==="line_source_ifttt_events"?",source_group,source_key":"",values=table==="line_source_ifttt_events"?",'fixture','fixture'":"";
  await sql(`insert into public.${table}(id,tweet_id,source_account,raw_payload,received_at${columns}) values($1,$2,'fixture',$3,$4${values})`,[id,tweetId,JSON.stringify(expected),receivedAt]);
  expect((await sql("select public.claim_tweet_pipeline_job($1,$2,false) claimed",[jobKey(table),owner]))[0].claimed).toBe(true);
 };
 const settle=async(options:{table?:string;who?:string;payload?:any;ids?:string[];role?:string}={})=>(await sql("select public.settle_tweet_claim_shadow_raw_event($1,$2,$3,$4,$5) receipt",[options.table??"line_source_ifttt_events",id,options.who??owner,JSON.stringify(options.payload??expected),options.ids??["observation-a"]],options.role??"service_role"))[0].receipt;
 const inventory=async(table="line_source_ifttt_events")=>({raw:(await sql(`select processing_status,raw_payload from public.${table} where id=$1`,[id]))[0],job:(await sql("select status,attempts,payload from public.tweet_pipeline_jobs where job_key=$1",[jobKey(table)]))[0],outbox:(await sql("select count(*)::int n from public.tweet_claim_outbox"))[0].n});
 beforeAll(async()=>{
  root=mkdtempSync("/tmp/fhf-ifttt-atomic-");socket=join(root,"socket");mkdirSync(socket,{mode:0o700});
  await exec(join(bin,"initdb"),["-D",join(root,"data"),"--no-locale","--encoding=UTF8","--auth-local=trust","--auth-host=reject","-U","ifttt_raw_atomic"],{env});
  await exec(join(bin,"pg_ctl"),["-D",join(root,"data"),"-l",join(root,"server.log"),"-w","-t","10","-o",`-c listen_addresses='' -c unix_socket_directories='${socket}' -p 65446`,"start"],{env});started=true;
  await sql("create role service_role bypassrls;create role anon;create role authenticated",[],null);
 },20000);
 beforeEach(async()=>{
  receivedAt=new Date(Date.now()-60000).toISOString();interpretedAt=new Date(Date.now()-30000).toISOString();
  await sql("drop schema public cascade;create schema public;grant usage on schema public to service_role,anon,authenticated",[],null);
  await sql(readFileSync(join(__dirname,"../migrations/20261016024711_tweet_claim_registry.sql"),"utf8"),[],null);
  const legacy=readFileSync(join(__dirname,"dependency-snapshot/supabase/migrations/20260919005608_tweet_pipeline_reports_and_review.sql"),"utf8");
  const table=legacy.match(/create table public\.tweet_pipeline_jobs \([\s\S]*?\n\);/)![0],claim=legacy.match(/create function public\.claim_tweet_pipeline_job\([\s\S]*?end \$\$;/)![0];
  await sql(table+";"+claim+";alter table public.tweet_pipeline_jobs enable row level security;grant select,insert,update on public.tweet_pipeline_jobs to service_role",[],null);
  const baseline=readFileSync(join(__dirname,"dependency-snapshot/supabase/migrations/20260716112908_production_schema_baseline.sql"),"utf8");
  for(const tableName of ["line_source_ifttt_events","lines_ccc_ifttt_events"]){
   const ddl=baseline.match(new RegExp(`CREATE TABLE public\\.${tableName} \\([\\s\\S]*?\\n\\);`))![0];
   await sql(ddl+`;alter table public.${tableName} add primary key(id);alter table public.${tableName} enable row level security;grant select,insert,update on public.${tableName} to service_role`,[],null);
  }
  await sql(readFileSync(join(__dirname,"20261016073503_tweet_claim_shadow_raw_ack.sql"),"utf8"),[],null);
  await sql("insert into public.tweet_claim_scopes(scope_key,version) values('fixture-scope',1)");await seedObservation("observation-a");await seedRaw();
 });
 afterAll(async()=>{if(started)await exec(join(bin,"pg_ctl"),["-D",join(root,"data"),"-w","-t","10","stop","-m","fast"],{env});if(root)rmSync(root,{recursive:true,force:true});});
 it("commits raw completion and the exact job acknowledgment together without a dispatch",async()=>{
  const receipt=await settle(),after=await inventory();expect(after.raw).toEqual({processing_status:"processed",raw_payload:{...expected,tweetClaimShadow:receipt.marker}});
  expect(after.job).toEqual({status:"complete",attempts:1,payload:{tweetClaimShadowAck:receipt}});expect(after.outbox).toBe(0);
  expect(receipt).toMatchObject({version:"shadow-raw-ack-v1",owner,delivery:"not_requested",observationIds:["observation-a"]});
 });
 it("rolls back the earlier raw update if the later job update fails",async()=>{
  const before=await inventory();await sql("create function public.fixture_reject_job() returns trigger language plpgsql as $$begin raise exception 'injected final job failure';end$$;create trigger fixture_reject before update on public.tweet_pipeline_jobs for each row execute function public.fixture_reject_job()",[],null);
  await expect(settle()).rejects.toThrow("injected final job failure");expect(await inventory()).toEqual(before);
 });
 it("recovers a lost transaction response with the same retained receipt and no second attempt",async()=>{
  let retained:any;const loseReply=async()=>{retained=await settle();throw new Error("ack reply lost after commit");};
  await expect(loseReply()).rejects.toThrow("after commit");expect(await settle()).toEqual(retained);expect((await inventory()).job.attempts).toBe(1);
 });
 it("serializes concurrent duplicate acknowledgments to the same receipt",async()=>{
  const receipts=await Promise.all([settle(),settle()]);expect(receipts[0]).toEqual(receipts[1]);expect((await inventory()).job.attempts).toBe(1);
 });
 it.each(["replaced","expired"])("holds %s owners and leaves both rows unchanged",async mode=>{
  await sql(mode==="replaced"?"update public.tweet_pipeline_jobs set owner=$2 where job_key=$1":"update public.tweet_pipeline_jobs set lease_expires_at=clock_timestamp()-interval '1 second' where job_key=$1",mode==="replaced"?[jobKey("line_source_ifttt_events"),other]:[jobKey("line_source_ifttt_events")]);
  const before=await inventory();await expect(settle()).rejects.toThrow(/ownership|lease/);expect(await inventory()).toEqual(before);
 });
 it("holds raw payload conflicts without overwriting the retained input",async()=>{
  await sql("update public.line_source_ifttt_events set raw_payload='{}'");const before=await inventory();await expect(settle()).rejects.toThrow("Raw event changed");expect(await inventory()).toEqual(before);
 });
 it.each([{ids:["missing-observation"]},{ids:["observation-a","observation-a"]},{ids:[]}])("holds missing/duplicate/empty identity set $ids",async({ids})=>{
  const before=await inventory();await expect(settle({ids})).rejects.toThrow();expect(await inventory()).toEqual(before);
 });
 it("holds omitted retained observations for the same receipt",async()=>{
  await seedObservation("observation-b");const before=await inventory();await expect(settle()).rejects.toThrow("observations omitted");expect(await inventory()).toEqual(before);
 });
 it.each(["tweetId","receivedAt","interpretedAt","eventId"])("holds inconsistent evidence %s",async field=>{
  const body:any=observation("invalid-observation");if(field==="tweetId")body.source.tweetId="foreign";else if(field==="eventId")body.source.metadata.iftttEventId=other;else body.semantic[field]=field==="receivedAt"?new Date(Date.parse(receivedAt)-1000).toISOString():new Date(Date.now()+60000).toISOString();
  await sql("insert into public.tweet_claim_observations(observation_id,scope_key,content_hash,lineage_key,payload) values('invalid-observation','fixture-scope','fixture-hash',$1,$2)",[`tweet-receipt-v2:${tweetId}`,JSON.stringify(body)]);
  const before=await inventory();await expect(settle({ids:["invalid-observation"]})).rejects.toThrow("evidence incomplete");expect(await inventory()).toEqual(before);
 });
 it("holds complete jobs without a retained protocol receipt",async()=>{
  await sql("update public.tweet_pipeline_jobs set status='complete'");const before=await inventory();await expect(settle()).rejects.toThrow("Conflicting retained");expect(await inventory()).toEqual(before);
 });
 it.each(["null","[]","1"])("holds incompatible retained job payload %s without partial raw completion",async body=>{
  await sql("update public.tweet_pipeline_jobs set payload=$1::jsonb",[body]);const before=await inventory();
  await expect(settle()).rejects.toThrow("payload must retain");expect(await inventory()).toEqual(before);
 });
 it("holds raw changes after a committed acknowledgment",async()=>{
  await settle();await sql("update public.line_source_ifttt_events set processing_status='pending'");const before=await inventory();await expect(settle()).rejects.toThrow("disagrees");expect(await inventory()).toEqual(before);
 });
 it("supports the second allowlisted raw table with its exact separate job key",async()=>{
  await seedRaw("lines_ccc_ifttt_events");const receipt=await settle({table:"lines_ccc_ifttt_events"});expect(receipt.jobKey).toBe(jobKey("lines_ccc_ifttt_events"));expect((await inventory("lines_ccc_ifttt_events")).job.status).toBe("complete");
 });
 it("keeps another retained receipt clock separate from this raw acknowledgment",async()=>{
  const otherReceipt=observation("other-receipt");otherReceipt.semantic.receivedAt=new Date(Date.parse(receivedAt)-1000).toISOString();otherReceipt.source.metadata.iftttEventId=other;
  await sql("insert into public.tweet_claim_observations(observation_id,scope_key,content_hash,lineage_key,payload) values('other-receipt','fixture-scope','fixture-hash',$1,$2)",[`tweet-receipt-v2:${tweetId}`,JSON.stringify(otherReceipt)]);
  expect((await settle()).observationIds).toEqual(["observation-a"]);
 });
 it("holds an omitted conflicting clock retained for the same raw event",async()=>{
  const prior=observation("prior-clock");prior.semantic.receivedAt=new Date(Date.parse(receivedAt)-1000).toISOString();
  await sql("insert into public.tweet_claim_observations(observation_id,scope_key,content_hash,lineage_key,payload) values('prior-clock','fixture-scope','fixture-hash',$1,$2)",[`tweet-receipt-v2:${tweetId}`,JSON.stringify(prior)]);
  const before=await inventory();await expect(settle()).rejects.toThrow("observations omitted");expect(await inventory()).toEqual(before);
 });
 it("holds a microsecond raw receipt-clock mutation after completion",async()=>{
  await settle();await sql("update public.line_source_ifttt_events set received_at=received_at+interval '1 microsecond'");const before=await inventory();
  await expect(settle()).rejects.toThrow("Conflicting retained");expect(await inventory()).toEqual(before);
 });
 it.each(["anon","authenticated"])("denies the %s role without changing rows",async role=>{
  const before=await inventory();await expect(settle({role})).rejects.toThrow("permission denied");expect(await inventory()).toEqual(before);
 });
 it.each(["expiry","owner"])("nearby mid-transaction %s change rolls raw and job writes back",async mode=>{
  const before=await inventory();
  const change=mode==="expiry"?"lease_expires_at=clock_timestamp()-interval '1 second'":`owner='${other}'`;
  await sql(`create function public.fixture_mid_raw_change() returns trigger language plpgsql as $$begin update public.tweet_pipeline_jobs set ${change} where job_key='${jobKey("line_source_ifttt_events")}';return new;end$$;create trigger fixture_mid_raw_change before update on public.line_source_ifttt_events for each row execute function public.fixture_mid_raw_change()`,[],null);
  await expect(settle()).rejects.toThrow(/expired during settlement/);expect(await inventory()).toEqual(before);
 });
 it("nearby R18 rejects an in-transaction raw receipt-clock rewrite before certifying completion",async()=>{
  await sql("create function public.fixture_rewrite_raw_clock() returns trigger language plpgsql as $$begin new.received_at=old.received_at+interval '1 microsecond';return new;end$$;create trigger fixture_rewrite_raw_clock before update on public.line_source_ifttt_events for each row execute function public.fixture_rewrite_raw_clock()",[],null);
  let rejected=false,receipt:any=null;try{receipt=await settle();}catch{rejected=true;}
  const raw=(await sql("select to_jsonb(r) body from public.line_source_ifttt_events r where id=$1",[id]))[0].body;
  const job=(await sql("select to_jsonb(j) body from public.tweet_pipeline_jobs j where job_key=$1",[jobKey("line_source_ifttt_events")]))[0].body;
  writeFileSync(join(__dirname,"evidence/R18-sql-raw-clock.json"),JSON.stringify({rejected,receipt,raw,job},null,2)+"\n");
  expect(rejected,"The RPC must reject a raw row whose post-trigger receipt clock contradicts its acknowledgment").toBe(true);
 });
 it("nearby R18 rejects a final job trigger that drops the supposedly persisted protocol receipt",async()=>{
  await sql("create function public.fixture_drop_job_ack() returns trigger language plpgsql as $$begin new.payload=new.payload-'tweetClaimShadowAck';return new;end$$;create trigger fixture_drop_job_ack before update on public.tweet_pipeline_jobs for each row execute function public.fixture_drop_job_ack()",[],null);
  let rejected=false,receipt:any=null;try{receipt=await settle();}catch{rejected=true;}
  const after=await inventory();writeFileSync(join(__dirname,"evidence/R18-sql-job-ack.json"),JSON.stringify({rejected,receipt,after},null,2)+"\n");
  expect(rejected,"Matched update must verify the actual persisted same-owner terminal acknowledgment after triggers").toBe(true);
 });

});
