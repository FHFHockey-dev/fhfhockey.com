// @vitest-environment node
import { execFile } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { createRequire } from "node:module";
const { Client } = createRequire(join(__dirname,"../../../web/package.json"))("pg") as typeof import("pg");
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { qualifiedFixture } from "../../../web/lib/sources/fixtures/tweetClaimQualificationFixture";
import { retainQualifiedTweetClaimScope } from "../../../web/lib/sources/tweetClaimQualificationStorage";
import { extractDurableTweetClaims, tweetClaimContentHash } from "../../../web/lib/sources/tweetClaimExtraction";
import { TWEET_LEGACY_SINKS } from "../../../web/lib/sources/tweetClaimEvidence";
import { persistTweetProjectionReports } from "../../../web/lib/sources/tweetProjectionStorage";
import { processTweetClaimShadowBatch, retainTweetClaimScope } from "../../../web/lib/sources/tweetClaimRegistry";
import { extractTweetPlayerEvents } from "../../../web/lib/sources/tweetPlayerEvents";
import { explicitTweetClaimGameApplicability } from "../../../web/lib/sources/tweetClaimApplicability";
import { tweetClaimAttribution } from "../../../web/lib/sources/tweetSourceDirectory";
import { claimHash } from "../../../web/lib/sources/tweetClaimExtraction";
import { claimTweetEvents,failTweetEvents } from "../../../web/lib/sources/tweetProcessingJobs";
import { acknowledgeTweetClaimRawEvent } from "../../../web/lib/sources/tweetClaimRawAcknowledgment";
import { isDeepStrictEqual } from "node:util";
const faults={reply:false,readRaw:false,mutateRawClock:false};

describe.runIf(Boolean(process.env.IFTTT_POSTGRES_BIN))("actual shadow raw/job settlement integration", () => {
  const exec = promisify(execFile), bin = process.env.IFTTT_POSTGRES_BIN!;
  const env = { ...process.env }; for (const key of Object.keys(env)) if (key.startsWith("PG")) delete env[key];
  let root: string, socket: string, started = false, ackLoss = false;
  const sql = async (query: string, values: any[] = [], service = true) => {
    const db = new Client({ host: socket, port: 65447, user: "ifttt_test", database: "postgres", password: "", ssl: false, options: "", connectionTimeoutMillis: 2000 });
    await db.connect();
    try { if (service) await db.query("set role service_role"); return (await db.query(query, values)).rows; } finally { await db.end(); }
  };
  const rpc = async (name: string, args: Record<string, unknown>) => {
    if (!/^(read_tweet_claim_scope|read_tweet_claim_context|commit_qualified_tweet_claim_scope|register_bounded_tweet_claim_evaluation|read_tweet_claim_dated_roster|reserve_tweet_claim_evaluation_intake|claim_tweet_pipeline_job|settle_tweet_claim_shadow_raw_event)$/.test(name)) throw new Error("Unknown fixture RPC");
    const pairs = Object.entries(args);
    const rows = await sql(`select public.${name}(${pairs.map(([key], i) => `${key}=>$${i + 1}`).join(",")}) result`, pairs.map(([key, value]) => ["p_ids","p_observation_ids"].includes(key) ? value : typeof value === "object" && value !== null ? JSON.stringify(value) : value));
    if (name === "commit_qualified_tweet_claim_scope" && ackLoss) { ackLoss = false; throw new Error("lost qualified commit acknowledgement"); }
    if (name === "settle_tweet_claim_shadow_raw_event" && faults.reply) {
      faults.reply=false;
      if(faults.mutateRawClock){faults.mutateRawClock=false;await sql("update public.line_source_ifttt_events set received_at=received_at+interval '1 microsecond'");}
      throw new Error("atomic raw acknowledgment reply lost after commit");
    }
    return { data: rows[0]!.result, error: null };
  };
  const seedGame = async (id: number, auditId: string) => {
    const f = qualifiedFixture(),row = f.evidence.identities[0]!;
    await sql("insert into public.tweet_claim_legacy_history(audit_id,game_id,team_id,payload) values($1,$2,6,$3)",[auditId,id,JSON.stringify(f.evidence.history)],false);
    await sql("insert into public.nhl_api_game_roster_spots values($1,$2,6,8478499,'Jeremy','Swayman','G',$3,$4)",[id,f.game.date,row.knownAt,row.rawPayloadHash],false);
    await sql("insert into public.nhl_api_game_normalization_status values($1,'complete',$2,$1,$3,$4)",[id,row.knownAt,row.rawPayloadHash,row.normalizationFingerprint],false);
    await sql("insert into public.nhl_api_game_payloads_raw values($1,$1,'play-by-play',$2,$3,$4)",[id,row.rawPayloadHash,`https://api-web.nhle.com/v1/gamecenter/${id}/play-by-play`,row.knownAt],false);
    return { ...f.game,id };
  };
  const isolatedClaims=async(delta:number,origin:string,unicode=false)=>{
    const f=qualifiedFixture(),game=await seedGame(f.game.id+delta,`identity-${origin}`);
    const rawText=unicode?`🧊 ${f.source.rawText}`:f.source.rawText;
    const source={...f.source,rawText,gameId:game.id,tweetId:origin,sourceUrl:`https://x.com/Reporter/status/${origin}`,
      metadata:{interpretation:{...f.source.metadata.interpretation,events:extractTweetPlayerEvents({text:rawText,
        players:[{playerId:8478499,fullName:"Jeremy Swayman",lastName:"Swayman",position:"G",teamId:6}],
        publishedAt:f.source.tweetPostedAt,includeClaimAnchors:true})}}};
    const claims=extractDurableTweetClaims({source,game,interpretedAt:f.asOf});expect(claims).toHaveLength(1);
    return {...f,claims,source,game};
  };
  const installFixtureSchema=async()=>{
    const task = join(__dirname, "../../../tasks/ifttt-integration-2026-10-16");
    await sql(readFileSync(join(task, "migrations/20261016024711_tweet_claim_registry.sql"), "utf8"), [], false);
    await sql(readFileSync(join(task, "next-increment/20261016073000_tweet_claim_qualification.sql"), "utf8"), [], false);
    await sql(readFileSync(join(task, "durable-occurrence-increment/20261016044953_tweet_claim_occurrence_identity.sql"), "utf8"), [], false);
    for (const table of TWEET_LEGACY_SINKS) await sql(`create table public.${table}(game_id bigint,team_id bigint,player_id bigint,published_at timestamptz,payload jsonb,report_key text,event_key text,tweet_id text,quoted_tweet_id text,capture_key text,source_capture_key text,original_identity text,capture_id text,id text,snapshot_id text,claim_id text,source_tweet_id text,original_tweet_id text); grant select on public.${table} to service_role`, [], false);
    await sql(`create table public.nhl_api_game_roster_spots(game_id bigint,game_date date,team_id bigint,player_id bigint,first_name text,last_name text,position_code text,updated_at timestamptz,source_play_by_play_hash text);
      create table public.nhl_api_game_normalization_status(game_id bigint,status text,completed_at timestamptz,pbp_raw_payload_id bigint,pbp_raw_payload_hash text,normalization_fingerprint text);
      create table public.nhl_api_game_payloads_raw(id bigint,game_id bigint,endpoint text,payload_hash text,source_url text,fetched_at timestamptz);
      grant select on public.nhl_api_game_roster_spots,public.nhl_api_game_normalization_status,public.nhl_api_game_payloads_raw to service_role`, [], false);
    const f = qualifiedFixture(), row = f.evidence.identities[0]!;
    await sql("insert into public.tweet_claim_legacy_history(audit_id,game_id,team_id,payload) values('fixture-only-empty-scope',$1,6,$2)", [f.game.id, JSON.stringify(f.evidence.history)], false);
    await sql("insert into public.nhl_api_game_roster_spots values($1,$2,6,8478499,'Jeremy','Swayman','G',$3,$4)", [f.game.id, f.game.date, row.knownAt, row.rawPayloadHash], false);
    await sql("insert into public.nhl_api_game_normalization_status values($1,'complete',$2,25,$3,$4)", [f.game.id, row.knownAt, row.rawPayloadHash, row.normalizationFingerprint], false);
    await sql("insert into public.nhl_api_game_payloads_raw values(25,$1,'play-by-play',$2,$3,$4)", [f.game.id, row.rawPayloadHash, row.sourceUrl, row.knownAt], false);
  };
  beforeAll(async () => {
    root = mkdtempSync(join("/tmp", "fhf-ifttt-raw-pipeline-")); socket = join(root, "socket"); mkdirSync(socket, { mode: 0o700 });
    await exec(join(bin, "initdb"), ["-D", join(root, "data"), "--no-locale", "--encoding=UTF8", "--auth-local=trust", "--auth-host=reject", "-U", "ifttt_test"], { env });
    await exec(join(bin, "pg_ctl"), ["-D", join(root, "data"), "-l", join(root, "server.log"), "-w", "-t", "10", "-o", `-c listen_addresses='' -c unix_socket_directories='${socket}' -p 65447`, "start"], { env }); started = true;
    await sql("create role service_role bypassrls; create role anon; create role authenticated;", [], false);
  
  }, 20000);
  afterAll(async () => {
    vi.unstubAllEnvs();
    if (started) await exec(join(bin, "pg_ctl"), ["-D", join(root, "data"), "-w", "-t", "10", "stop", "-m", "fast"], { env });
    if (root) rmSync(root, { recursive: true, force: true });
  });
  const rawId="00000000-0000-4000-8000-000000008800",rawTweetId="880000",payload={text:"BOS Jeremy Swayman starts tonight.",fixture:"local-shadow-only"};
  let fixture:ReturnType<typeof qualifiedFixture>;
  const db:any={rpc,from:(table:string)=>{
    if(["games","tweet_source_coverage"].includes(table)){
      const rows=table==="games"?[fixture.game]:[];
      const q:any={in:()=>q,eq:()=>q,order:()=>q,limit:()=>q,then:(resolve:any)=>Promise.resolve({data:rows,error:null}).then(resolve)};
      return {select:()=>q};
    }
    if(!["tweet_pipeline_jobs","line_source_ifttt_events","lines_ccc_ifttt_events"].includes(table))throw new Error(`Unexpected fixture table ${table}`);
    const query=(values?:Record<string,unknown>)=>{
      const filters:Array<[string,string,unknown]>=[];let single=false;
      const q:any={eq:(k:string,v:unknown)=>{filters.push([k,"=",v]);return q;},gt:(k:string,v:unknown)=>{filters.push([k,">",v]);return q;},
        select:()=>q,maybeSingle:()=>{single=true;return q;},then:async(resolve:any,reject:any)=>{try{
          if(!values&&table!=="tweet_pipeline_jobs"&&faults.readRaw){faults.readRaw=false;throw new Error("atomic raw readback unavailable");}
          const args:any[]=[],identifier=(key:string)=>{if(!/^[a-z_]+$/.test(key))throw new Error("Invalid fixture column");return `"${key}"`;};
          const set=values?Object.entries(values).map(([k,v])=>`${identifier(k)}=$${args.push(v)}`).join(","):"";
          const where=filters.map(([k,op,v])=>`${identifier(k)}${op}$${args.push(v)}`).join(" and ");
          const records=await sql(values?`update public.${table} as t set ${set} where ${where} returning to_jsonb(t) body`:`select to_jsonb(t) body from public.${table} t where ${where}`,args);
          const rows=records.map(row=>row.body);
          return resolve({data:single?(rows[0]??null):rows,error:null});
        }catch(error){return reject(error);}}};return q;
    };
    return {select:()=>query(),update:(values:Record<string,unknown>)=>query(values)};
  }};
  const rawTable="line_source_ifttt_events" as const;
  const seedBatch=async(table:"line_source_ifttt_events"|"lines_ccc_ifttt_events"=rawTable,eventId=rawId,receivedOffset=0)=>{
    const publishedAt=new Date(Date.now()-120000).toISOString(),receivedAt=new Date(Date.now()-60000+receivedOffset).toISOString().replace(/(\.\d{3})Z$/,(_match,millis)=>`${millis}456Z`);
    const source={...fixture.source,tweetId:rawTweetId,sourceUrl:`https://x.com/Reporter/status/${rawTweetId}`,rawPayload:payload,
      tweetPostedAt:publishedAt,observedAt:receivedAt,metadata:{iftttEventId:eventId,interpretation:{...fixture.source.metadata.interpretation,
        identityContext:{basis:"current_membership",sourcePublishedAt:publishedAt}}}};
    const extra=table==="line_source_ifttt_events"?",source_group,source_key":"",extraValues=table==="line_source_ifttt_events"?",'fixture',$5":"";
    await sql(`insert into public.${table}(id,source_account,tweet_id,raw_payload,received_at${extra}) values($1,'Reporter',$2,$3,$4${extraValues})`,[eventId,rawTweetId,JSON.stringify(payload),receivedAt,...(table===rawTable?[`fixture-${eventId}`]:[])]);
    const event={id:eventId,tweet_id:rawTweetId,raw_payload:payload},pendingEvents=await claimTweetEvents(db,table,[event],false);
    expect(pendingEvents).toEqual([event]);
    return {supabase:db,table,sources:[source],events:[event],pendingEvents,deferredUpdates:[]};
  };
  const inventory=async(table:"line_source_ifttt_events"|"lines_ccc_ifttt_events"=rawTable)=>({raw:(await sql(`select processing_status,raw_payload from public.${table} where id=$1`,[rawId]))[0],
    job:(await sql("select status,attempts,payload from public.tweet_pipeline_jobs where job_key=$1",[`ingest:${table}:${rawId}`]))[0],
    observations:(await sql("select observation_id,payload from public.tweet_claim_observations order by observation_id")),
    deliveries:await sql("select status,requires_review from public.tweet_claim_outbox")});
  beforeEach(async()=>{
    faults.reply=false;faults.readRaw=false;faults.mutateRawClock=false;vi.stubEnv("TWEET_CLAIMS_MODE","shadow");vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED","true");
    await sql("drop schema public cascade;create schema public;grant usage on schema public to service_role",[],false);
    await installFixtureSchema();fixture=qualifiedFixture();
    const legacy=readFileSync(join(__dirname,"dependency-snapshot/supabase/migrations/20260919005608_tweet_pipeline_reports_and_review.sql"),"utf8");
    await sql(legacy.match(/create table public\.tweet_pipeline_jobs \([\s\S]*?\n\);/)![0]+";"+legacy.match(/create function public\.claim_tweet_pipeline_job\([\s\S]*?end \$\$;/)![0]+";alter table public.tweet_pipeline_jobs enable row level security;grant select,insert,update on public.tweet_pipeline_jobs to service_role",[],false);
    const baseline=readFileSync(join(__dirname,"dependency-snapshot/supabase/migrations/20260716112908_production_schema_baseline.sql"),"utf8");
    for(const table of ["line_source_ifttt_events","lines_ccc_ifttt_events"]){
      const ddl=baseline.match(new RegExp(`CREATE TABLE public\\.${table} \\([\\s\\S]*?\\n\\);`))![0];
      await sql(ddl+`;alter table public.${table} add primary key(id);alter table public.${table} enable row level security;grant select,insert,update on public.${table} to service_role`,[],false);
      await sql(baseline.match(new RegExp(`CREATE UNIQUE INDEX [^;]+ ON public\\.${table} [^;]+;`))![0],[],false);
    }
    await sql(readFileSync(join(__dirname,"20261016073503_tweet_claim_shadow_raw_ack.sql"),"utf8"),[],false);
  });
  it.each(["line_source_ifttt_events","lines_ccc_ifttt_events"] as const)("actual %s claim/extraction/context/commit hook completes raw and job atomically, retaining held evidence only",async table=>{
    const batch=await seedBatch(table),result=await processTweetClaimShadowBatch(batch),after=await inventory(table);
    expect(result).toMatchObject({mode:"claim_shadow",eventsProcessed:1,delivery:"not_requested"});
    expect(after.raw.processing_status).toBe("processed");expect(after.job).toMatchObject({status:"complete",attempts:1});
    expect(after.observations.length).toBeGreaterThan(0);expect(after.job.payload.tweetClaimShadowAck.observationIds).toEqual(after.observations.map((o:any)=>o.observation_id));
    expect(after.deliveries.every((row:any)=>row.status==="held"&&row.requires_review)).toBe(true);
  });
  it("separates two raw receipts of the same post while preserving shared claim lineage",async()=>{
    const first=await seedBatch(),second=await seedBatch(rawTable,"00000000-0000-4000-8000-000000008801",1000);
    await expect(processTweetClaimShadowBatch({...first,sources:[...first.sources,...second.sources],events:[...first.events,...second.events],pendingEvents:[...first.pendingEvents,...second.pendingEvents]})).resolves.toMatchObject({eventsProcessed:2});
    expect(await sql("select status,attempts from public.tweet_pipeline_jobs order by job_key")).toEqual([{status:"complete",attempts:1},{status:"complete",attempts:1}]);
    expect(await sql("select processing_status from public.line_source_ifttt_events order by id")).toEqual([{processing_status:"processed"},{processing_status:"processed"}]);
    expect((await inventory()).observations).toHaveLength(2);
  });
  it("source metadata for a different raw event cannot acknowledge this receipt",async()=>{
    const batch=await seedBatch();batch.sources[0]!.metadata.iftttEventId="00000000-0000-4000-8000-000000008899";
    await expect(processTweetClaimShadowBatch(batch)).rejects.toThrow("Exact retained receipt evidence");
    expect((await inventory()).raw.processing_status).toBe("pending");expect((await inventory()).job.status).toBe("running");
  });
  it("overlapping processed/deferred receipt is held before any claim or raw completion write",async()=>{
    const batch=await seedBatch(),before=await inventory();
    await expect(processTweetClaimShadowBatch({...batch,deferredUpdates:[{id:rawId,processing_status:"pending",raw_payload:payload,updated_at:new Date().toISOString()}]})).rejects.toThrow("both processed and deferred");
    expect(await inventory()).toEqual(before);
  });
  it("lost atomic reply uses exact job/raw readback and never calls settlement twice",async()=>{
    const batch=await seedBatch();faults.reply=true;const wrapped={...db,rpc:vi.fn(rpc)};
    await expect(processTweetClaimShadowBatch({...batch,supabase:wrapped})).resolves.toMatchObject({eventsProcessed:1});
    expect(wrapped.rpc.mock.calls.filter((args:any[])=>args[0]==="settle_tweet_claim_shadow_raw_event")).toHaveLength(1);
    const after=await inventory();expect(after.job).toMatchObject({status:"complete",attempts:1});expect(after.raw.processing_status).toBe("processed");
  });
  it("raw readback loss after commit remains unresolved; catch cannot downgrade; restarted claim skips completion",async()=>{
    const batch=await seedBatch();faults.reply=true;faults.readRaw=true;
    await expect(processTweetClaimShadowBatch(batch)).rejects.toThrow("raw readback unavailable");
    const committed=await inventory();await failTweetEvents(db,batch.pendingEvents,"claim_shadow");expect(await inventory()).toEqual(committed);
    expect(await claimTweetEvents(db,rawTable,[{...batch.events[0]!}],false)).toEqual([]);
    expect((await inventory()).job).toMatchObject({status:"complete",attempts:1});
  });
  it("a one-microsecond raw receipt change after commit cannot be accepted by lost-reply readback",async()=>{
    const batch=await seedBatch();faults.reply=true;faults.mutateRawClock=true;
    await expect(processTweetClaimShadowBatch(batch)).rejects.toThrow("Raw event disagrees");
    expect((await inventory()).job.status).toBe("complete");
  });
  it("later job-write failure rolls raw status back while retained observations survive; route catch records retry",async()=>{
    const batch=await seedBatch();await sql("create function public.fixture_job_failure() returns trigger language plpgsql as $$begin if new.status='complete' then raise exception 'injected atomic job failure';end if;return new;end$$;create trigger fixture_job_failure before update on public.tweet_pipeline_jobs for each row execute function public.fixture_job_failure()",[],false);
    await expect(processTweetClaimShadowBatch(batch)).rejects.toThrow("injected atomic job failure");
    const before=await inventory();expect(before.raw).toEqual({processing_status:"pending",raw_payload:payload});expect(before.job.status).toBe("running");expect(before.observations.length).toBeGreaterThan(0);
    await failTweetEvents(db,batch.pendingEvents,"claim_shadow");const after=await inventory();expect(after.job.status).toBe("failed");expect(after.raw).toEqual(before.raw);expect(after.observations).toEqual(before.observations);
    await sql("drop trigger fixture_job_failure on public.tweet_pipeline_jobs;drop function public.fixture_job_failure()",[],false);
    await sql("update public.tweet_pipeline_jobs set next_attempt_at=clock_timestamp()-interval '1 second'");
    const restartedEvent={...batch.events[0]!},reclaimed=await claimTweetEvents(db,rawTable,[restartedEvent],false);
    await expect(processTweetClaimShadowBatch({...batch,events:[restartedEvent],pendingEvents:reclaimed})).resolves.toMatchObject({eventsProcessed:1});
    const recovered=await inventory();expect(recovered.job).toMatchObject({status:"complete",attempts:2});expect(recovered.raw.processing_status).toBe("processed");
    expect(recovered.observations).toEqual(before.observations);expect(recovered.deliveries).toEqual(before.deliveries);
  });
  it("server-expired lease holds despite a backdated application clock",async()=>{
    const batch=await seedBatch();await sql("update public.tweet_pipeline_jobs set lease_expires_at=clock_timestamp()-interval '1 second'");
    vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date(Date.now()-600000));
    try{await expect(processTweetClaimShadowBatch(batch)).rejects.toThrow("lease or state");}finally{vi.useRealTimers();}
    const after=await inventory();expect(after.raw.processing_status).toBe("pending");expect(after.job.status).toBe("running");
  });
  it("default-off acknowledgment and wrong-mode shadow hook do not access storage",async()=>{
    const untouched={from:vi.fn(),rpc:vi.fn()};
    expect(await acknowledgeTweetClaimRawEvent({db:untouched,table:rawTable,eventId:rawId,key:"unset",owner:"unset",expectedPayload:{},observationIds:[]})).toEqual({status:"disabled"});
    vi.stubEnv("TWEET_CLAIMS_MODE","");await expect(processTweetClaimShadowBatch({supabase:untouched,table:rawTable,sources:[],events:[],pendingEvents:[],deferredUpdates:[]})).rejects.toThrow("Explicit claim shadow");
    vi.stubEnv("TWEET_CLAIMS_MODE","shadow");vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED","false");
    await expect(processTweetClaimShadowBatch({supabase:untouched,table:rawTable,sources:[],events:[],pendingEvents:[],deferredUpdates:[]})).rejects.toThrow("Explicit claim shadow");
    expect(untouched.from).not.toHaveBeenCalled();expect(untouched.rpc).not.toHaveBeenCalled();
  });
});
