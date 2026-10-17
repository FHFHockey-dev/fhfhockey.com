// @vitest-environment node
import {execFile} from "node:child_process";
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from "node:fs";
import {createRequire} from "node:module";
import {join} from "node:path";
import {promisify} from "node:util";
import {afterAll,afterEach,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";
import {claimTweetEvents,finishTweetEvents,failTweetEvents} from "../../../web/lib/sources/tweetProcessingJobs";

const {Client}=createRequire(join(__dirname,"../../../web/package.json"))("pg") as typeof import("pg");
describe.runIf(Boolean(process.env.IFTTT_POSTGRES_BIN))("raw job acknowledgment on existing retained job schema",()=>{
 const exec=promisify(execFile),bin=process.env.IFTTT_POSTGRES_BIN!,env={...process.env};
 for(const k of Object.keys(env))if(k.startsWith("PG"))delete env[k];
 let root:string,socket:string,started=false;
 const fault={claimAck:false,completeAck:false,failAck:false,beforeComplete:false,readFailures:0};
 const sql=async(text:string,values:any[]=[],service=true)=>{
  const c=new Client({host:socket,port:65445,user:"ifttt_raw_test",database:"postgres",password:"",ssl:false,options:"",connectionTimeoutMillis:2000});
  await c.connect();try{if(service)await c.query("set role service_role");return (await c.query(text,values)).rows;}finally{await c.end();}
 };
 const db:any={rpc:async(name:string,args:any)=>{
  if(name!=="claim_tweet_pipeline_job")throw new Error("Unexpected fixture RPC");
  const rows=await sql("select public.claim_tweet_pipeline_job($1,$2,$3) result",[args.p_key,args.p_owner,args.p_reprocess]);
  if(fault.claimAck){fault.claimAck=false;throw new Error("claim reply lost after commit");}
  return {data:rows[0].result,error:null};
 },from:(table:string)=>{
  if(table!=="tweet_pipeline_jobs")throw new Error("Unexpected fixture table");
  const query=(values?:Record<string,unknown>)=>{
   const filters:Array<[string,string,unknown]>=[];let single=false;
   const q:any={eq:(k:string,v:unknown)=>{filters.push([k,"=",v]);return q;},gt:(k:string,v:unknown)=>{filters.push([k,">",v]);return q;},
    select:()=>q,maybeSingle:()=>{single=true;return q;},then:async(resolve:any,reject:any)=>{try{
     if(!values&&fault.readFailures>0){fault.readFailures--;throw new Error("job readback unavailable");}
     if(values?.status==="complete"&&fault.beforeComplete){fault.beforeComplete=false;throw new Error("completion rejected before write");}
     const args:any[]=[],identifier=(x:string)=>{if(!/^[a-z_]+$/.test(x))throw new Error("Invalid identifier");return `"${x}"`;};
     const set=values?Object.entries(values).map(([k,v])=>`${identifier(k)}=$${args.push(v)}`).join(","):"";
     const where=filters.map(([k,op,v])=>`${identifier(k)}${op}$${args.push(v)}`).join(" and ");
     const rows=await sql(values?`update public.tweet_pipeline_jobs set ${set} where ${where} returning *`:`select * from public.tweet_pipeline_jobs where ${where}`,args);
     if(values?.status==="complete"&&fault.completeAck){fault.completeAck=false;throw new Error("completion reply lost after commit");}
     if(values?.status==="failed"&&fault.failAck){fault.failAck=false;throw new Error("failure reply lost after commit");}
     return resolve({data:single?(rows[0]??null):rows,error:null});
    }catch(error){return reject(error);}}};return q;
  };
  return {update:(values:Record<string,unknown>)=>query(values),select:()=>query()};
 }};
 const key="ingest:line_source_ifttt_events:local-receipt";
 const claim=async()=>{const e={id:"local-receipt"};expect(await claimTweetEvents(db,"line_source_ifttt_events",[e],false)).toEqual([e]);return e;};
 const row=async()=> (await sql("select * from public.tweet_pipeline_jobs where job_key=$1",[key]))[0];
 beforeAll(async()=>{
  root=mkdtempSync("/tmp/fhf-ifttt-raw-");socket=join(root,"socket");mkdirSync(socket,{mode:0o700});
  await exec(join(bin,"initdb"),["-D",join(root,"data"),"--no-locale","--encoding=UTF8","--auth-local=trust","--auth-host=reject","-U","ifttt_raw_test"],{env});
  await exec(join(bin,"pg_ctl"),["-D",join(root,"data"),"-l",join(root,"server.log"),"-w","-t","10","-o",`-c listen_addresses='' -c unix_socket_directories='${socket}' -p 65445`,"start"],{env});started=true;
  await sql("create role service_role bypassrls;create role anon;create role authenticated",[],false);
 },20000);
 beforeEach(async()=>{
  vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED","true");
  await sql("drop schema public cascade;create schema public;grant usage on schema public to service_role",[],false);
  const migration=readFileSync(join(__dirname,"../../../supabase/migrations/20260919005608_tweet_pipeline_reports_and_review.sql"),"utf8");
  const table=migration.match(/create table public\.tweet_pipeline_jobs \([\s\S]*?\n\);/)![0];
  const fn=migration.match(/create function public\.claim_tweet_pipeline_job\([\s\S]*?end \$\$;/)![0];
  await sql(table+";"+fn+";alter table public.tweet_pipeline_jobs enable row level security;grant select,insert,update on public.tweet_pipeline_jobs to service_role;revoke all on function public.claim_tweet_pipeline_job(text,uuid,boolean) from public;grant execute on function public.claim_tweet_pipeline_job(text,uuid,boolean) to service_role",[],false);
 });
 afterEach(()=>{vi.unstubAllEnvs();Object.assign(fault,{claimAck:false,completeAck:false,failAck:false,beforeComplete:false,readFailures:0});});
 afterAll(async()=>{if(started)await exec(join(bin,"pg_ctl"),["-D",join(root,"data"),"-w","-t","10","stop","-m","fast"],{env});if(root)rmSync(root,{recursive:true,force:true});});
 it("completion reply loss followed by route failure cannot downgrade committed completion",async()=>{
  const e=await claim();fault.completeAck=true;
  try{await finishTweetEvents(db,[e]);}catch{await failTweetEvents(db,[e],"event_finalization");}
  expect((await row()).status).toBe("complete");
 });
 it("recognizes exact committed completion after lost reply",async()=>{
  const e=await claim();fault.completeAck=true;await expect(finishTweetEvents(db,[e])).resolves.toBeUndefined();expect((await row()).status).toBe("complete");
 });
 it("reconciles claim reply loss to the same retained owner without another claim",async()=>{
  fault.claimAck=true;const e=await claim();await finishTweetEvents(db,[e]);expect(await row()).toMatchObject({status:"complete",attempts:1});
 });
 it("rejects completion from a replaced owner without changing the replacement",async()=>{
  const e=await claim();await sql("update public.tweet_pipeline_jobs set owner='00000000-0000-4000-8000-000000000002' where job_key=$1",[key]);
  await expect(finishTweetEvents(db,[e])).rejects.toThrow(/ownership|lease/i);expect((await row()).status).toBe("running");
 });
 it("rejects completion from an expired lease before another owner claims",async()=>{
  const e=await claim();await sql("update public.tweet_pipeline_jobs set lease_expires_at=now()-interval '1 second' where job_key=$1",[key]);
  await expect(finishTweetEvents(db,[e])).rejects.toThrow(/ownership|lease/i);expect((await row()).status).toBe("running");
 });
 it("recognizes a failed-job write after its reply is lost",async()=>{
  const e=await claim();fault.failAck=true;await expect(failTweetEvents(db,[e],"parser")).resolves.toBeUndefined();expect(await row()).toMatchObject({status:"failed",failure_stage:"parser"});
 });
 it("does not acknowledge failed-job updates fenced by a replacement owner",async()=>{
  const e=await claim();await sql("update public.tweet_pipeline_jobs set owner='00000000-0000-4000-8000-000000000002' where job_key=$1",[key]);
  await expect(failTweetEvents(db,[e],"parser")).rejects.toThrow(/ownership|lease/i);expect((await row()).status).toBe("running");
 });
 it("unknown completion and unavailable readbacks stay errors while committed completion survives catch",async()=>{
  const e=await claim();fault.completeAck=true;fault.readFailures=2;
  await expect(finishTweetEvents(db,[e])).rejects.toThrow();await expect(failTweetEvents(db,[e],"event_finalization")).rejects.toThrow();
  expect((await row()).status).toBe("complete");
 });
 it("a definite pre-write failure remains retryable without claiming completion",async()=>{
  const e=await claim();fault.beforeComplete=true;await expect(finishTweetEvents(db,[e])).rejects.toThrow("before write");
  await failTweetEvents(db,[e],"event_finalization");expect(await row()).toMatchObject({status:"failed",failure_stage:"event_finalization",attempts:1});
 });
 it("concurrent acknowledgments preserve one job and one original claim attempt",async()=>{
  const e=await claim();await Promise.all([finishTweetEvents(db,[e]),finishTweetEvents(db,[e])]);
  expect(await row()).toMatchObject({status:"complete",attempts:1});expect(await claimTweetEvents(db,"line_source_ifttt_events",[{id:e.id}],false)).toEqual([]);
 });
 it("nearby uncertain claim with another retained owner rejects without a second claim",async()=>{
  let claims=0;const wrapped={...db,rpc:async(name:string,args:any)=>{claims++;await db.rpc(name,args);await sql("update public.tweet_pipeline_jobs set owner='00000000-0000-4000-8000-000000000002' where job_key=$1",[key]);throw new Error("uncertain claim with replacement");}};
  await expect(claimTweetEvents(wrapped,"line_source_ifttt_events",[{id:"local-receipt"}],false)).rejects.toThrow("uncertain claim");
  expect(claims).toBe(1);expect(await row()).toMatchObject({status:"running",attempts:1,owner:"00000000-0000-4000-8000-000000000002"});
 });
 it("nearby uncertain claim with an expired same-owner lease rejects without a second claim",async()=>{
  let claims=0;const wrapped={...db,rpc:async(name:string,args:any)=>{claims++;await db.rpc(name,args);await sql("update public.tweet_pipeline_jobs set lease_expires_at=now()-interval '1 second' where job_key=$1",[key]);throw new Error("uncertain expired claim");}};
  await expect(claimTweetEvents(wrapped,"line_source_ifttt_events",[{id:"local-receipt"}],false)).rejects.toThrow("uncertain expired claim");
  expect(claims).toBe(1);expect(await row()).toMatchObject({status:"running",attempts:1});
 });
 it("nearby another owner's completed row cannot acknowledge this owner's completion",async()=>{
  const e=await claim();await sql("update public.tweet_pipeline_jobs set owner='00000000-0000-4000-8000-000000000002',status='complete',lease_expires_at=null where job_key=$1",[key]);const before=await row();
  await expect(finishTweetEvents(db,[e])).rejects.toThrow(/ownership|lease/i);expect(await row()).toEqual(before);
 });
 it("nearby a different terminal failure stage cannot acknowledge the requested stage",async()=>{
  const e=await claim();await sql("update public.tweet_pipeline_jobs set status='failed',failure_stage='other-stage',lease_expires_at=null where job_key=$1",[key]);const before=await row();
  await expect(failTweetEvents(db,[e],"parser")).rejects.toThrow(/ownership|lease/i);expect(await row()).toEqual(before);
 });
 it("nearby unavailable completion readback retains reconciliation for a later same-object retry",async()=>{
  const e=await claim();fault.completeAck=true;fault.readFailures=1;
  await expect(finishTweetEvents(db,[e])).rejects.toThrow("readback unavailable");expect((await row()).status).toBe("complete");
  await expect(finishTweetEvents(db,[e])).resolves.toBeUndefined();await failTweetEvents(db,[e],"later catch");expect(await row()).toMatchObject({status:"complete",attempts:1});
 });
 it("nearby a missing job row is never acknowledged as a matched completion",async()=>{
  const e=await claim();await sql("delete from public.tweet_pipeline_jobs where job_key=$1",[key],false);
  await expect(finishTweetEvents(db,[e])).rejects.toThrow(/ownership|lease/i);expect(await sql("select * from public.tweet_pipeline_jobs")).toEqual([]);
 });

});
