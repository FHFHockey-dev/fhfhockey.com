// @vitest-environment node
/** Original already-bound DSL -> actual local replacement RPC. No hosted clients or dispatch. */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll,beforeAll,beforeEach,describe,expect,it } from "../../../web/node_modules/vitest";
import { Client } from "../../../web/node_modules/pg";
import { project } from "./run-acceptance";
import { qualifiedFixture } from "../../../web/lib/sources/fixtures/tweetClaimQualificationFixture";
import { claimHash,tweetClaimContentHash,type TweetClaimEnvelope } from "../../../web/lib/sources/tweetClaimExtraction";
import { tweetClaimAttribution } from "../../../web/lib/sources/tweetSourceDirectory";
import { retainTweetClaimScope } from "../../../web/lib/sources/tweetClaimRegistry";
import { TWEET_LEGACY_SINKS } from "../../../web/lib/sources/tweetClaimEvidence";

const task=join(__dirname,".."),oracleBytes=readFileSync(join(task,"handoff/extracted-reviewed/ifttt-claim-replay-tests-2026-10-15/acceptance-cases.json"));
const oracle=JSON.parse(oracleBytes.toString()),results:any[]=[];
const pending:Record<string,string>={
  CR037:"Legacy capture-parent exact immutability contract/fan-out is not wired to this held scope RPC; four variants require the actual parent writer.",
  CR041:"Legacy parent-commit ack-loss/readback-before-children boundary is outside this atomic held scope transaction.",
  CR042:"Opaque pre-existing effect/transition identities and positive durable no-attempt transport proof need an approved sink adapter contract.",
  CR043:"Opaque retained external effect and unknown transport outcome require the actual consumer/reconciliation adapter; no live send authorized.",
  CR044:"Opaque durable delivery receipt/queue-ack boundary requires the actual consumer receipt adapter; generic local sink tests are not this exact DSL case.",
};

describe.runIf(Boolean(process.env.IFTTT_POSTGRES_BIN))("exact original persistence cases against disposable storage",()=>{
  const exec=promisify(execFile),bin=process.env.IFTTT_POSTGRES_BIN!;
  const env={...process.env};for(const key of Object.keys(env))if(key.startsWith("PG"))delete env[key];
  let root:string,socket:string,started=false;
  const sql=async(query:string,values:any[]=[],service=true)=>{
    const db=new Client({host:socket,port:65439,user:"ifttt_exact_test",database:"postgres",password:"",ssl:false,options:"",connectionTimeoutMillis:2000});
    await db.connect();try{if(service)await db.query("set role service_role");return (await db.query(query,values)).rows;}finally{await db.end();}
  };
  const rpc=async(name:string,args:Record<string,unknown>)=>{
    if(!["read_tweet_claim_scope","read_tweet_claim_context","commit_qualified_tweet_claim_scope"].includes(name))throw new Error("Unapproved fixture RPC");
    const entries=Object.entries(args),rows=await sql(`select public.${name}(${entries.map(([key],i)=>`${key}=>$${i+1}`).join(",")}) result`,
      entries.map(([,v])=>v!==null && typeof v==="object"?JSON.stringify(v):v));
    return {data:rows[0]!.result,error:null};
  };
  const fixture=(c:any,recordIndex=0)=>{
    const r=c.records[recordIndex],f=qualifiedFixture(),p=project(r,c.records),scope=p.observation.scope;
    // Already-bound DSL fields remain authoritative. Only the storage envelope is translated.
    // No historical source acquisition, parser accuracy or genuine identity is asserted.
    const source:any={...f.source,snapshotDate:r.time.originalPublishedAt.slice(0,10),
      team:{id:scope.teamId,abbreviation:"CAR",name:"Carolina Hurricanes"},gameId:scope.gameId,
      tweetId:r.source.originalId,sourceHandle:r.source.originalAuthor,sourceUrl:`https://x.com/${r.source.originalAuthor}/status/${r.source.originalId}`,
      rawText:r.sourceText.text,tweetPostedAt:r.time.originalPublishedAt,observedAt:r.time.receivedAt,
      metadata:{interpretation:{version:r.interpretation.ruleVersion,context:"game",certainty:"confirmed",units:[],events:[],unresolved:[]}}};
    const claim:TweetClaimEnvelope={...f.claims[0]!,semantic:p.observation,source,attribution:tweetClaimAttribution(source),
      lineageKey:r.source.retainedSourceId,scopeKey:`tweet-scope-v1:${claimHash(scope)}`,
      claimAnchor:{subjectSpan:r.occurrence.subjectSpan,predicateSpan:r.occurrence.predicateSpan},aliases:[],directoryEvidence:[]};
    claim.contentHash=tweetClaimContentHash(claim);claim.semantic={...claim.semantic,id:`tweet-observation-v2:${claim.contentHash}`};
    expect(claim.source.rawText).toBe(r.sourceText.text);expect(claim.semantic.scope).toEqual(scope);
    expect(claim.semantic.fact).toEqual(r.interpretation.fact);expect(claim.attribution.status).toBe("resolved");
    return {r,claim,asOf:c.steps.find((s:any)=>s.asOf)?.asOf??r.time.interpretedAt};
  };
  const seed=async(c:any)=>{
    const f=fixture(c),r=f.r,scope=r.interpretation.scope,known="2026-10-15T11:00:00Z",hash="a".repeat(64);
    await sql("insert into public.tweet_claim_legacy_history(audit_id,game_id,team_id,payload,known_at) values($1,$2,$3,$4,$5)",[c.id,scope.gameId,scope.teamId,JSON.stringify({status:c.preconditions.durablePriorEffect==="verified_absent"?"complete":"incomplete",from:"2026-10-15T00:00:00Z",through:"2026-10-16T04:00:00Z",basis:"explicit original DSL history precondition in fresh cluster",retentionEvidence:"fresh schema, no deleted rows",writerFenceEvidence:"no other fixture writers"}),known],false);
    await sql("insert into public.nhl_api_game_roster_spots values($1,'2026-10-15',$2,$3,'Jordan','Staal','C',$4,$5)",[scope.gameId,scope.teamId,r.interpretation.subject.playerId,known,hash],false);
    await sql("insert into public.nhl_api_game_normalization_status values($1,'complete',$2,1,$3,$4)",[scope.gameId,known,hash,"b".repeat(64)],false);
    await sql("insert into public.nhl_api_game_payloads_raw values(1,$1,'play-by-play',$2,$3,$4)",[scope.gameId,hash,`https://api-web.nhle.com/v1/gamecenter/${scope.gameId}/play-by-play`,known],false);
    return f;
  };
  const read=(f:ReturnType<typeof fixture>)=>rpc("read_tweet_claim_context",{p_scope:f.claim.scopeKey,p_incoming:[f.claim],p_asof:f.asOf}).then(r=>r.data);
  const assertOriginal=(c:any,result:any,evidence:any)=>{
    const assertions=c.assertions.map((a:any)=>{expect(a.op).toBe("equals");const actual=a.path.split(".").reduce((v:any,k:string)=>v?.[k],{result});
      expect(actual).toEqual(a.value);return {assertion:a,actual,pass:true};});
    results.push({id:c.id,status:"passed_local_actual_rpc",assertions,evidence});
  };
  beforeAll(async()=>{
    expect(createHash("sha256").update(oracleBytes).digest("hex")).toBe("d9fe45ca44042673ff0381cd0f1981074b196da99fb6fdf9da573ac5df84fd8b");
    root=mkdtempSync(join(tmpdir(),"fhfh-ifttt-exact-pg-"));socket=join(root,"socket");mkdirSync(socket,{mode:0o700});
    await exec(join(bin,"initdb"),["-D",join(root,"data"),"--no-locale","--encoding=UTF8","--auth-local=trust","--auth-host=reject","-U","ifttt_exact_test"],{env});
    await exec(join(bin,"pg_ctl"),["-D",join(root,"data"),"-l",join(root,"server.log"),"-w","-t","10","-o",`-c listen_addresses='' -c unix_socket_directories='${socket}' -p 65439`,"start"],{env});started=true;
    await sql("create role service_role bypassrls;create role anon;create role authenticated;",[],false);
  },20000);
  beforeEach(async()=>{
    await sql("drop schema public cascade;create schema public;grant usage on schema public to service_role",[],false);
    for(const migration of ["migrations/20261016024711_tweet_claim_registry.sql","next-increment/20261016073000_tweet_claim_qualification.sql","durable-occurrence-increment/20261016044953_tweet_claim_occurrence_identity.sql"])
      await sql(readFileSync(join(task,migration),"utf8"),[],false);
    for(const table of TWEET_LEGACY_SINKS)await sql(`create table public.${table}(game_id bigint,team_id bigint,player_id bigint,published_at timestamptz,payload jsonb,report_key text,event_key text,tweet_id text,quoted_tweet_id text,capture_key text,source_capture_key text,original_identity text,capture_id text,id text,snapshot_id text,claim_id text,source_tweet_id text,original_tweet_id text);grant select on public.${table} to service_role`,[],false);
    await sql(`create table public.nhl_api_game_roster_spots(game_id bigint,game_date date,team_id bigint,player_id bigint,first_name text,last_name text,position_code text,updated_at timestamptz,source_play_by_play_hash text);
      create table public.nhl_api_game_normalization_status(game_id bigint,status text,completed_at timestamptz,pbp_raw_payload_id bigint,pbp_raw_payload_hash text,normalization_fingerprint text);
      create table public.nhl_api_game_payloads_raw(id bigint,game_id bigint,endpoint text,payload_hash text,source_url text,fetched_at timestamptz);
      grant select on public.nhl_api_game_roster_spots,public.nhl_api_game_normalization_status,public.nhl_api_game_payloads_raw to service_role`,[],false);
  });
  afterAll(async()=>{
    if(started)await exec(join(bin,"pg_ctl"),["-D",join(root,"data"),"-w","-t","10","stop","-m","fast"],{env});
    if(root)rmSync(root,{recursive:true,force:true});
    writeFileSync(join(__dirname,"exact-persistence-results.json"),JSON.stringify({originalOracleSha256:createHash("sha256").update(oracleBytes).digest("hex"),
      candidateManifest:"../durable-occurrence-increment/owned-source-v2-sha256.json",candidateManifestSha256:createHash("sha256").update(readFileSync(join(task,"durable-occurrence-increment/owned-source-v2-sha256.json"))).digest("hex"),
      privateDisposableStorage:true,noHostedActions:true,noDispatch:true,fullOriginalAcceptance:false,results,
      deferred:Object.entries(pending).map(([id,reason])=>({id,status:"deferred_exact_contract",reason}))},null,2)+"\n");
  });
  it("CR036 rejects the original forced r3 evidence-version key collision at the actual commit boundary",async()=>{
    const c=oracle.cases.find((c:any)=>c.id==="CR036"),f=await seed(c),b=fixture(c,1);
    await retainTweetClaimScope({rpc},[f.claim],f.asOf);const before=await read(f);
    const prior=before.qualificationState.plan.nextState.registry.evidenceVersions[0];expect(prior).toBeDefined();
    expect(c.records[1].forcedIdentityReuse).toEqual({kind:"evidenceVersionId",fromRecordId:"a"});
    let attempted=false,downstreamCalls=0;
    const collision={rpc:async(name:string,args:Record<string,unknown>)=>{
      if(!["read_tweet_claim_scope","read_tweet_claim_context","commit_qualified_tweet_claim_scope"].includes(name))downstreamCalls++;
      if(name!=="commit_qualified_tweet_claim_scope")return rpc(name,args);
      const changed=structuredClone(args) as any,registry=changed.p_qualified.plan.nextState.registry;
      const row=registry.evidenceVersions.find((row:any)=>row.evidenceVersionId===prior.evidenceVersionId);
      expect(row).toBeDefined();attempted=true;
      // This declared forced-key collision bypasses the normal content-derived r3 ID allocator.
      // Keep a's exact ID while supplying b's original different immutable lexical evidence.
      row.anchor.subjectSpan=c.records[1].occurrence.subjectSpan;row.anchor.predicateSpan=c.records[1].occurrence.predicateSpan;
      row.evidence.governingClauseSpan=c.records[1].occurrence.governingClauseSpan;
      row.evidence.displaySpans=[c.records[1].evidence.displaySpan];
      return rpc(name,changed);
    }};
    let conflict:unknown;try{await retainTweetClaimScope(collision,[b.claim],b.asOf);}catch(error){conflict=error;}
    const after=await read(f),retained=after.qualificationState.plan.nextState.registry.evidenceVersions.find((row:any)=>row.evidenceVersionId===prior.evidenceVersionId);
    const result={versionConflict:Boolean(conflict),originalImmutableBytesUnchanged:JSON.stringify(retained)===JSON.stringify(prior),
      newEffectProposalCount:after.qualificationState.plan.nextState.registry.effects.length-before.qualificationState.plan.nextState.registry.effects.length,
      downstreamCallsAfterConflict:downstreamCalls};
    writeFileSync(join(__dirname,"evidence-collision-probe.json"),JSON.stringify({result,attempted,error:String(conflict),prior,retained},null,2)+"\n");
    expect(attempted).toBe(true);assertOriginal(c,result,{before,after,forcedKey:prior.evidenceVersionId});
    expect(after.scope.observations).toEqual(before.scope.observations);
  });
  it("CR039 executes the original before-registry-commit interruption and all unchanged assertions",async()=>{
    const c=oracle.cases.find((c:any)=>c.id==="CR039"),f=await seed(c);
    await sql("create function fixture_before_commit() returns trigger language plpgsql as $$begin raise exception 'CR039 before_registry_commit';end$$;create trigger fixture_before_commit before insert on public.tweet_claim_scopes for each row execute function fixture_before_commit()",[],false);
    await expect(retainTweetClaimScope({rpc},[f.claim],f.asOf)).rejects.toThrow("CR039 before_registry_commit");
    await sql("drop trigger fixture_before_commit on public.tweet_claim_scopes;drop function fixture_before_commit()",[],false);
    const empty=await read(f);expect(empty.occurrenceContext.state).toBeNull();expect(empty.scope.observations).toEqual([]);
    expect(await sql("select action_key from public.tweet_claim_outbox")).toEqual([]);
    // A new call has no retained process state and reads the durable database again.
    await retainTweetClaimScope({rpc},JSON.parse(JSON.stringify([f.claim])),f.asOf);const after=await read(f);
    const orphans=await sql("select action_key from public.tweet_claim_outbox o where not exists(select 1 from public.tweet_claim_scopes s where s.scope_key=o.scope_key)");
    assertOriginal(c,{durableOccurrenceCountAfterRetry:after.occurrenceContext.state.occurrences.length,orphanEffectCount:orphans.length,
      newEffectProposalCountAfterRetry:after.qualificationState.plan.reviewableEffects.length},{source:f.r,after});
  });
  it("CR040 executes the original commit-ack-loss/readback and all unchanged assertions",async()=>{
    const c=oracle.cases.find((c:any)=>c.id==="CR040"),f=await seed(c);let lost=false,readback=false;
    const fault={rpc:async(name:string,args:Record<string,unknown>)=>{
      const result=await rpc(name,args);if(name==="commit_qualified_tweet_claim_scope" && !lost){lost=true;throw new Error("CR040 after_registry_commit_before_ack");}
      if(lost && name==="read_tweet_claim_context"){readback=true;expect(result.data.scope.observations).toEqual([f.claim]);}return result;
    }};
    await retainTweetClaimScope(fault,[f.claim],f.asOf);expect(lost).toBe(true);expect(readback).toBe(true);
    const before=await read(f);await retainTweetClaimScope({rpc},JSON.parse(JSON.stringify([f.claim])),f.asOf);const after=await read(f);
    expect(after.occurrenceContext.state).toEqual(before.occurrenceContext.state);
    assertOriginal(c,{durableOccurrenceCountAfterRetry:after.occurrenceContext.state.occurrences.length,registryReadbackRequired:readback,
      duplicateAllocatedOccurrenceCount:after.occurrenceContext.state.occurrences.length-new Set(after.occurrenceContext.state.occurrences.map((o:any)=>o.id)).size},{source:f.r,before,after});
  });
  it("CR052 executes two original workers from the same actual context with a real CAS loser",async()=>{
    const c=oracle.cases.find((c:any)=>c.id==="CR052"),f=await seed(c);let reads=0,misses=0,reloaded=false,release!:()=>void;
    const barrier=new Promise<void>(resolve=>{release=resolve;}),clocks:number[]=[];
    const worker=(id:string)=>({rpc:async(name:string,args:Record<string,unknown>)=>{
      const result=await rpc(name,args);
      if(name==="read_tweet_claim_context" && reads<2){reads++;clocks.push(result.data.clock);if(reads===2)release();await barrier;}
      else if(name==="read_tweet_claim_context" && misses){reloaded=true;expect(result.data.occurrenceContext.state.occurrences).toHaveLength(1);}
      if(name==="commit_qualified_tweet_claim_scope" && result.data===false){misses++;expect(["worker-1","worker-2"]).toContain(id);}return result;
    }});
    await Promise.all(c.steps[0].workerIds.map((id:string)=>retainTweetClaimScope(worker(id),[f.claim],f.asOf)));
    expect(clocks).toHaveLength(2);expect(clocks[0]).toBe(clocks[1]);expect(misses).toBe(1);
    const after=await read(f),effects=after.qualificationState.plan.nextState.registry.effects;
    assertOriginal(c,{durableOccurrenceCount:after.occurrenceContext.state.occurrences.length,committedTransitionCount:effects.length,
      committedEffectIdentityCount:new Set(effects.map((e:any)=>e.effectKey)).size,losingWriterReconcilesByReadback:reloaded},{source:f.r,clocks,misses,after});
    expect(await sql("select status,requires_review from public.tweet_claim_outbox")).toEqual([{status:"held",requires_review:true}]);
  });
});
