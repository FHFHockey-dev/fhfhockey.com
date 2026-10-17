// @vitest-environment node
/** Actual outbox worker/RPC; explicit synthetic consumer protocol, never a production caller. */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll,beforeAll,beforeEach,describe,expect,it } from "vitest";
import { deliverTweetClaim,type TweetClaimSink } from "../../../web/lib/sources/tweetClaimRegistry";
import { claimCanonicalJson } from "../../../web/lib/sources/tweetClaimExtraction";

const {Client}=createRequire(join(__dirname,"../../../web/package.json"))("pg") as typeof import("pg");
const task=join(__dirname,".."),oracleText=readFileSync(join(task,"handoff/extracted-reviewed/ifttt-claim-replay-tests-2026-10-15/acceptance-cases.json"),"utf8");
const oracle=JSON.parse(oracleText),parentTemplate=JSON.parse(readFileSync(join(__dirname,"retained-parent.json"),"utf8"));
const results:any[]=[],digest=(v:any)=>createHash("sha256").update(claimCanonicalJson(v)).digest("hex");
const assertOriginal=(c:any,result:any)=>c.assertions.map((assertion:any)=>{
  expect(assertion.op).toBe("equals");const actual=assertion.path.split(".").reduce((v:any,k:string)=>v?.[k],{result});
  expect(actual).toEqual(assertion.value);return {assertion,actual,pass:true};
});

describe.runIf(Boolean(process.env.IFTTT_POSTGRES_BIN))("retained opaque action protocol with private consumer fixture",()=>{
  const exec=promisify(execFile),bin=process.env.IFTTT_POSTGRES_BIN!,env={...process.env};
  for(const key of Object.keys(env))if(key.startsWith("PG"))delete env[key];
  let root:string,socket:string,started=false,sends=0,reconciles=0;
  const client=async()=>{const db=new Client({host:socket,port:65441,user:"ifttt_transport_test",database:"postgres",password:"",ssl:false,options:"",connectionTimeoutMillis:2000});await db.connect();return db;};
  const sql=async(text:string,values:any[]=[],service=false)=>{const db=await client();try{if(service)await db.query("set role service_role");return (await db.query(text,values)).rows;}finally{await db.end();}};
  const rpc=async(name:string,args:Record<string,unknown>)=>{
    if(!["claim_tweet_claim_delivery","settle_tweet_claim_delivery"].includes(name))throw new Error("Unexpected fixture RPC");
    const entries=Object.entries(args),rows=await sql(`select public.${name}(${entries.map(([key],i)=>`${key}=>$${i+1}`).join(",")}) result`,entries.map(([,v])=>v!==null&&typeof v==="object"?JSON.stringify(v):v),true);
    return {data:rows[0]!.result,error:null};
  };
  const action=async()=>(await sql("select * from public.tweet_claim_outbox"))[0]!;
  const due=()=>sql("update public.tweet_claim_outbox set next_attempt_at=now(),lease_until=now()-interval '1 second'");
  const seed=async(c:any,clock:"original"|"operational-v1",options:{missingCoverage?:boolean;parentMismatch?:boolean}={})=>{
    const source=structuredClone(c.records[0]),asOf=c.steps.find((s:any)=>s.asOf)?.asOf;
    // Production still enforces DB now(). Original historical inputs are never
    // made dispatchable. A separately named fixture shifts ALL source clocks.
    const delta=clock==="operational-v1"?Date.now()-Date.parse(asOf):0;
    if(delta)for(const [key,value] of Object.entries(source.time))if(typeof value==="string")source.time[key]=new Date(Date.parse(value)+delta).toISOString();
    const parent=structuredClone(parentTemplate);parent.capture_key=`${clock}:retained-parent:${parentTemplate.capture_key}`;
    // Transport fixture provenance is explicit; no assertion this is a native
    // newly issued producer key or an authenticated current source document.
    parent.raw_payload={fixtureVersion:clock,originalParent:parentTemplate,source};
    const effectId=c.preconditions.durableEffectId,transitionId=c.preconditions.durableTransitionId??"fixture-transition-1";
    const payload={action:{key:effectId,transitionId},observation:{semantic:{support:{validUntil:source.time.validUntil}}},
      parent:{captureKey:parent.capture_key,sha256:options.parentMismatch?"0".repeat(64):digest(parent)},source,clockFixture:clock};
    await sql("insert into fixture_parents values($1,$2)",[parent.capture_key,JSON.stringify(parent)]);
    await sql("insert into public.tweet_claim_scopes(scope_key,reduction) values('retained-fixture-scope',$1)",[JSON.stringify({actions:[{key:effectId}]})]);
    // The IDs are the DSL's pre-existing durable reservation, never renamed
    // content-derived/native r3 IDs. No test calls an allocator or ingress here.
    await sql("insert into public.tweet_claim_outbox(action_key,scope_key,scenario_key,revision_key,payload,status,requires_review) values($1,'retained-fixture-scope','retained-fixture-scenario','retained-fixture-revision',$2,'pending',false)",[effectId,JSON.stringify(payload)]);
    if(!options.missingCoverage)await sql("insert into fixture_transport_coverage values($1,$2,$3,$4)",[effectId,transitionId,digest(payload),JSON.stringify({status:"complete",basis:c.preconditions.positiveNoDispatchProof??"fresh isolated synthetic transport",writerFence:"only fixture sink may append invocations",sourceRecord:c.records[0]})]);
    return {source,payload,effectId,transitionId,parent,asOf,delta};
  };
  const sink=(fault:"none"|"unknown-after-apply"="none"):TweetClaimSink=>({
    idempotency:"durable_action_key",
    send:async(key,payload)=>{
      sends++;const body=payload as any,coverage=(await sql("select * from fixture_transport_coverage where action_key=$1",[key]))[0];
      expect(coverage?.payload_hash).toBe(digest(body));expect(coverage?.transition_id).toBe(body.action.transitionId);
      const retained=(await sql("select body from fixture_parents where capture_key=$1",[body.parent.captureKey]))[0];
      expect(digest(retained?.body)).toBe(body.parent.sha256);
      // Invocation start is durable before attempting the fixture effect. An
      // absent receipt alone never proves no attempt or authorizes a resend.
      await sql("insert into fixture_transport_invocations(action_key,payload_hash) values($1,$2)",[key,digest(body)]);
      const db=await client();let receipt:any;
      try{
        await db.query("begin");
        const old=(await db.query("select payload_hash from fixture_external_effects where action_key=$1 for update",[key])).rows[0];
        if(old&&old.payload_hash!==digest(body))throw new Error("Fixture sink immutable action collision");
        await db.query("insert into fixture_external_effects values($1,$2) on conflict do nothing",[key,digest(body)]);
        receipt={actionKey:key,payloadSha256:digest(body),parentSha256:body.parent.sha256};
        if(fault!=="unknown-after-apply")await db.query("insert into fixture_transport_receipts values($1,$2) on conflict do nothing",[key,JSON.stringify(receipt)]);
        await db.query("commit");
      }catch(error){await db.query("rollback");throw error;}finally{await db.end();}
      if(fault==="unknown-after-apply")throw new Error("CR043 fixture effect committed; dispatch acknowledgement lost");
      return {status:"applied",receipt};
    },
    reconcile:async key=>{
      const row=await action(),body=row.payload,coverage=(await sql("select * from fixture_transport_coverage where action_key=$1",[key]))[0];
      const retained=(await sql("select body from fixture_parents where capture_key=$1",[body.parent.captureKey]))[0];
      if(row.action_key!==key||coverage?.payload_hash!==digest(body)||coverage.transition_id!==body.action.transitionId
        ||!retained||digest(retained.body)!==body.parent.sha256)return {status:"unknown"};
      reconciles++;const receipt=(await sql("select body from fixture_transport_receipts where action_key=$1",[key]))[0];
      if(receipt)return receipt.body.actionKey===key&&receipt.body.payloadSha256===digest(body)&&receipt.body.parentSha256===body.parent.sha256
        ?{status:"applied",receipt:receipt.body}:{status:"unknown"};
      const attempts=await sql("select invocation_id from fixture_transport_invocations where action_key=$1",[key]);
      return !attempts.length&&coverage.proof.status==="complete"&&coverage.proof.writerFence==="only fixture sink may append invocations"
        ?{status:"not_applied"}:{status:"unknown"};
    },
  });
  beforeAll(async()=>{
    expect(createHash("sha256").update(oracleText).digest("hex")).toBe("d9fe45ca44042673ff0381cd0f1981074b196da99fb6fdf9da573ac5df84fd8b");
    root=mkdtempSync(join(tmpdir(),"fhfh-ifttt-transport-pg-"));socket=join(root,"socket");mkdirSync(socket,{mode:0o700});
    await exec(join(bin,"initdb"),["-D",join(root,"data"),"--no-locale","--encoding=UTF8","--auth-local=trust","--auth-host=reject","-U","ifttt_transport_test"],{env});
    await exec(join(bin,"pg_ctl"),["-D",join(root,"data"),"-l",join(root,"server.log"),"-w","-t","10","-o",`-c listen_addresses='' -c unix_socket_directories='${socket}' -p 65441`,"start"],{env});started=true;
    await sql("create role service_role bypassrls;create role anon;create role authenticated");
  },20000);
  beforeEach(async()=>{
    sends=0;reconciles=0;await sql("drop schema public cascade;create schema public;grant usage on schema public to service_role");
    for(const migration of ["migrations/20261016024711_tweet_claim_registry.sql","next-increment/20261016073000_tweet_claim_qualification.sql","durable-occurrence-increment/20261016044953_tweet_claim_occurrence_identity.sql"])
      await sql(readFileSync(join(task,migration),"utf8"));
    await sql(`create table fixture_parents(capture_key text primary key,body jsonb not null);
      create table fixture_transport_coverage(action_key text primary key,transition_id text not null,payload_hash text not null,proof jsonb not null);
      create table fixture_transport_invocations(invocation_id bigint generated always as identity primary key,action_key text not null,payload_hash text not null);
      create table fixture_external_effects(action_key text primary key,payload_hash text not null);
      create table fixture_transport_receipts(action_key text primary key,body jsonb not null);`);
    await sql(`create function fixture_append_only() returns trigger language plpgsql as $$begin raise exception 'fixture immutable transport evidence';end$$;
      create trigger immutable_parent before update or delete on fixture_parents for each row execute function fixture_append_only();
      create trigger immutable_coverage before update or delete on fixture_transport_coverage for each row execute function fixture_append_only();
      create trigger immutable_invocation before update or delete on fixture_transport_invocations for each row execute function fixture_append_only();
      create trigger immutable_receipt before update or delete on fixture_transport_receipts for each row execute function fixture_append_only();`);
  });
  afterAll(async()=>{
    if(started)await exec(join(bin,"pg_ctl"),["-D",join(root,"data"),"-w","-t","10","stop","-m","fast"],{env});
    if(root)rmSync(root,{recursive:true,force:true});
    writeFileSync(join(__dirname,"transport-protocol-results.json"),JSON.stringify({originalOracleSha256:createHash("sha256").update(oracleText).digest("hex"),
      candidateManifest:"owned-source-v1-sha256.json",candidateManifestSha256:createHash("sha256").update(readFileSync(join(__dirname,"owned-source-v1-sha256.json"),"utf8")).digest("hex"),
      parentCandidateManifestSha256:"827c373d5fb4dc80d2dbe5b5b5c624ff6d62a78e4f826c6aad7abaa123697863",noHostedActions:true,noProductionDispatch:true,
      originalExactContractsAccepted:false,fullOriginalAcceptance:false,consumer:"synthetic private durable transport adapter; production caller/legacy import not implemented",results},null,2)+"\n");
  });
  for(const id of ["CR042","CR043","CR044"])it(`${id} original expired source cannot be dispatched by the actual DB-clock worker`,async()=>{
    const c=oracle.cases.find((c:any)=>c.id===id),f=await seed(c,"original"),before=await action();
    expect(Date.parse(f.source.time.validUntil)).toBeLessThan(Date.now());
    expect(await deliverTweetClaim({db:{rpc},key:f.effectId,sink:sink(),enabled:true})).toEqual({status:"held_or_busy"});
    const after=await action();expect(sends).toBe(0);expect(after.requires_review).toBe(true);expect(after.payload).toEqual(before.payload);
    expect(await sql("select * from fixture_transport_invocations")).toEqual([]);
    results.push({id,variant:"original_clocks_negative",status:"held_expired_no_dispatch",originalExactCaseScored:false,source:c.records[0],after});
  });
  it("CR042 operational-v1 reuses the retained opaque reservation after positive no-attempt proof",async()=>{
    const c=oracle.cases.find((c:any)=>c.id==="CR042"),f=await seed(c,"operational-v1"),before=await action();
    // Crash before transport: a fresh worker sees a durable reservation plus a
    // fenced complete fixture log, not a status/zero-attempt inference alone.
    expect(await sink().reconcile(f.effectId)).toEqual({status:"not_applied"});
    await Promise.all([deliverTweetClaim({db:{rpc},key:f.effectId,sink:sink(),enabled:true}),deliverTweetClaim({db:{rpc},key:f.effectId,sink:sink(),enabled:true})]);
    const after=await action(),rows=await sql("select action_key from public.tweet_claim_outbox");
    expect(sends).toBe(1);expect(after.status).toBe("delivered");expect(after.payload).toEqual(before.payload);
    const result={effectIdAfterRetry:after.action_key,transitionIdAfterRetry:after.payload.action.transitionId,newEffectIdentityCount:rows.filter(r=>r.action_key!==before.action_key).length};
    results.push({id:c.id,variant:"operational-v1",originalExactCaseScored:false,clockShiftMilliseconds:f.delta,result,assertions:assertOriginal(c,result),before,after});
  });
  it("CR043 operational-v1 holds unknown outcome after actual fixture effect commit and lost send acknowledgement",async()=>{
    const c=oracle.cases.find((c:any)=>c.id==="CR043"),f=await seed(c,"operational-v1"),before=await action();
    expect(await deliverTweetClaim({db:{rpc},key:f.effectId,sink:sink("unknown-after-apply"),enabled:true})).toMatchObject({status:"unknown",mode:"send"});
    await due();expect(await deliverTweetClaim({db:{rpc},key:f.effectId,sink:sink(),enabled:true})).toMatchObject({status:"unknown",mode:"reconcile"});
    const after=await action();expect(sends).toBe(1);expect(reconciles).toBe(1);expect(after.payload).toEqual(before.payload);
    expect(await sql("select * from fixture_external_effects")).toHaveLength(1);expect(await sql("select * from fixture_transport_receipts")).toEqual([]);
    const result={resendPlanCount:sends-1,newEffectIdentityCount:(await sql("select action_key from public.tweet_claim_outbox where action_key<>$1",[before.action_key])).length,
      holdReasons:after.status==="uncertain"?["delivery_outcome_unknown"]:[]};
    results.push({id:c.id,variant:"operational-v1",originalExactCaseScored:false,clockShiftMilliseconds:f.delta,result,assertions:assertOriginal(c,result),before,after});
  });
  it("CR044 operational-v1 suppresses retry after durable delivery receipt and queue acknowledgement loss",async()=>{
    const c=oracle.cases.find((c:any)=>c.id==="CR044"),f=await seed(c,"operational-v1");let lost=false;
    const losing={rpc:async(name:string,args:Record<string,unknown>)=>{const result=await rpc(name,args);if(name==="settle_tweet_claim_delivery"&&!lost){lost=true;throw new Error("CR044 durable delivery committed before queue ack");}return result;}};
    await expect(deliverTweetClaim({db:losing,key:f.effectId,sink:sink(),enabled:true})).rejects.toThrow("before queue ack");
    const before=await action();expect(before.status).toBe("delivered");expect(before.receipt.actionKey).toBe(f.effectId);
    expect(await deliverTweetClaim({db:{rpc},key:f.effectId,sink:sink(),enabled:true})).toEqual({status:"held_or_busy"});
    const after=await action();expect(after.payload).toEqual(before.payload);expect(sends).toBe(1);expect(reconciles).toBe(0);
    expect(await sql("select * from fixture_transport_receipts")).toHaveLength(1);expect(await sql("select * from fixture_external_effects")).toHaveLength(1);
    const result={resendPlanCount:sends-1,newEffectIdentityCount:(await sql("select action_key from public.tweet_claim_outbox where action_key<>$1",[before.action_key])).length,effectId:after.action_key};
    results.push({id:c.id,variant:"operational-v1",originalExactCaseScored:false,clockShiftMilliseconds:f.delta,result,assertions:assertOriginal(c,result),before,after});
  });
  it("requires positive complete transport coverage instead of treating an empty invocation log as no attempt",async()=>{
    const f=await seed(oracle.cases.find((c:any)=>c.id==="CR042"),"operational-v1",{missingCoverage:true});
    await sql("update public.tweet_claim_outbox set status='uncertain'");
    expect(await deliverTweetClaim({db:{rpc},key:f.effectId,sink:sink(),enabled:true})).toMatchObject({status:"unknown",mode:"reconcile"});
    expect(sends).toBe(0);expect((await action()).status).toBe("uncertain");expect(await sql("select * from fixture_transport_invocations")).toEqual([]);
    results.push({id:"missing_no_attempt_coverage",status:"held_unknown",originalExactCaseScored:false});
  });
  it("rejects a receipt whose retained action or payload does not match",async()=>{
    const f=await seed(oracle.cases.find((c:any)=>c.id==="CR044"),"operational-v1");
    await sql("update public.tweet_claim_outbox set status='uncertain'");
    await sql("insert into fixture_transport_receipts values($1,$2)",[f.effectId,JSON.stringify({actionKey:"another-effect",payloadSha256:"0".repeat(64),parentSha256:f.payload.parent.sha256})]);
    expect(await deliverTweetClaim({db:{rpc},key:f.effectId,sink:sink(),enabled:true})).toMatchObject({status:"unknown",mode:"reconcile"});
    expect(sends).toBe(0);expect((await action()).status).toBe("uncertain");
    results.push({id:"receipt_identity_mismatch",status:"held_unknown",originalExactCaseScored:false});
  });
  it("holds a retained parent fingerprint mismatch before any fixture invocation or effect",async()=>{
    const f=await seed(oracle.cases.find((c:any)=>c.id==="CR042"),"operational-v1",{parentMismatch:true});
    expect(await deliverTweetClaim({db:{rpc},key:f.effectId,sink:sink(),enabled:true})).toMatchObject({status:"unknown",mode:"send"});
    expect(await sql("select * from fixture_transport_invocations")).toEqual([]);expect(await sql("select * from fixture_external_effects")).toEqual([]);
    expect((await action()).status).toBe("uncertain");
    results.push({id:"parent_fingerprint_mismatch",status:"held_before_invocation",originalExactCaseScored:false});
  });
  it("retains fixture invocation, proof, parent and receipt rows append-only",async()=>{
    const f=await seed(oracle.cases.find((c:any)=>c.id==="CR042"),"operational-v1");
    expect(await deliverTweetClaim({db:{rpc},key:f.effectId,sink:sink(),enabled:true})).toMatchObject({status:"applied"});
    for(const table of ["fixture_parents","fixture_transport_coverage","fixture_transport_invocations","fixture_transport_receipts"])
      await expect(sql(`delete from ${table}`)).rejects.toThrow("fixture immutable transport evidence");
    expect(await sql("select * from fixture_transport_invocations")).toHaveLength(1);expect(await sql("select * from fixture_transport_receipts")).toHaveLength(1);
    results.push({id:"fixture_evidence_append_only",status:"four_delete_attempts_rejected",originalExactCaseScored:false});
  });
});
