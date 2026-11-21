// @vitest-environment node
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import type { NextApiRequest, NextApiResponse } from "next";
import { afterEach, expect, it, vi } from "vitest";
import capture from "pages/api/v1/db/forge-pregame-capture-v2";
import stage from "pages/api/v1/db/forge-pregame-stage";
import * as server from "lib/supabase/server";
import * as hosted from "lib/projections/pregameCapture/hostedGame";
import * as publish from "lib/projections/pregameCapture/hostedPublication";
import * as readers from "lib/projections/pregameCapture/hostedReaders";
import { publishQualifiedPregameCapture } from "lib/projections/pregameCapture/publication";
import { runPregameCapture } from "lib/projections/pregameCapture/custody";
import { captureDeps } from "lib/projections/pregameCapture/runner";
import { scheduleReader } from "lib/projections/pregameCapture/scheduleReader";
import { supabaseCaptureRpc } from "lib/projections/pregameCapture/rpc";
import { HOSTED_V2_BUDGET, PILOT_TRANSPORT_LIMITS } from "lib/projections/pregameCapture/policy";
import { publicationDbAvailable, startPublicationDb } from "lib/projections/pregameCapture/__fixtures__/publicationConsumerDb";
import { prospectiveLeague } from "lib/projections/pregameCapture/__fixtures__/prospectiveLeague";
import { mintTimeStampResponse, testTsaTrust } from "lib/projections/pregameCapture/__fixtures__/testTsa";
import { createWorldClient } from "lib/projections/pregameCapture/__fixtures__/world/store";
import { runWitnessOnce } from "../../../../../scripts/forge-independent-witness";

const sha = "0123456789abcdef0123456789abcdef01234567";
const game = 2099020991;
const syntheticSecret = "local-disposable-signer-123456789012345";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it.each([
  ["false",String(game),"compute_off"],
  ["true",String(game+1),"wrong_game_scope"],
  ["true",undefined,"wrong_game_scope"],
])("records the effective preflight refusal before a capture slot (%s,%s)", async (compute,ids,reason) => {
  vi.stubEnv("VERCEL_ENV","production");
  vi.stubEnv("VERCEL_GIT_COMMIT_SHA",sha);
  vi.stubEnv("FORGE_PREGAME_CAPTURE_ENABLED","true");
  vi.stubEnv("STARTER_BOARD_CAPTURE_ENABLED","true");
  vi.stubEnv("STARTER_BOARD_COMPUTE_ENABLED",compute);
  vi.stubEnv("STARTER_BOARD_CANARY_GAME_IDS",ids);
  vi.stubEnv("FORGE_PREGAME_DISPATCH_SECRET",syntheticSecret);
  const id = randomUUID();
  const rpc = vi.fn((name: string, _args: unknown) => ({ abortSignal: async () => ({error:null,
    data:name==="forge_hosted_stage_begin_v2" ? {stage:"preflight",codeVersion:sha,gameId:game} : "skipped"}) }));
  vi.spyOn(server,"getServiceRoleClient").mockReturnValue({rpc} as unknown as ReturnType<typeof server.getServiceRoleClient>);
  const res = {setHeader:vi.fn(),status:vi.fn().mockReturnThis(),end:vi.fn(),json:vi.fn()};
  await stage({method:"POST",query:{},body:{dispatchId:id},headers:{"x-forge-dispatch-signature":
    createHmac("sha256",syntheticSecret).update("stage:"+id).digest("hex")}} as unknown as NextApiRequest,res as unknown as NextApiResponse);
  expect(rpc.mock.calls).toEqual([
    ["forge_hosted_stage_begin_v2",{p_dispatch_id:id,p_code_version:sha}],
    ["forge_hosted_stage_finish_v2",{p_dispatch_id:id,p_code_version:sha,p_reason:reason,p_readers:null}],
  ]);
  expect(res.json).toHaveBeenCalledWith({status:"skipped"});
});

it.skipIf(!publicationDbAvailable)("joins signed hosted stages, independent LOGIN, committed publication and both RSO readers by game", async () => {
  vi.stubGlobal("fetch", () => { throw new Error("unexpected network"); });
  for (const [name,value] of Object.entries({
    VERCEL_ENV:"production", VERCEL_GIT_COMMIT_SHA:sha, FORGE_PREGAME_CAPTURE_ENABLED:"true",
    FORGE_PREGAME_DISPATCH_SECRET:syntheticSecret, STARTER_BOARD_CAPTURE_ENABLED:"true", STARTER_BOARD_COMPUTE_ENABLED:"true",
    STARTER_BOARD_SERVING_ENABLED:"true", STARTER_BOARD_CANARY_GAME_IDS:String(game), RSO_FORGE_DAILY_BRIDGE:"on",
    FORGE_SKATER_MODEL_MODE:"baseline", FORGE_RESERVE_PASS_ENABLED:"false", STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED:"false",
    NEXT_PUBLIC_SUPABASE_URL:"https://fixture.invalid", SUPABASE_SERVICE_ROLE_KEY:"local-fixture", RSO_LATER_IMPACT_SCENARIO:"off",
  })) vi.stubEnv(name,value);
  vi.stubEnv("PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID", undefined);
  const db = await startPublicationDb();
  let witness: Client | undefined;
  try {
    const { world,request } = prospectiveLeague(sha,game);
    await db.seed(world,game);
    const sql = async (command: string,args: unknown[] = []) => (await db.owner.query(command,args)).rows[0];
    await db.owner.query(`create table public.cron_job_audit(job_name text,status text,run_time timestamptz default now(),rows_affected int,details jsonb);
      create table net.deliveries(id bigint generated always as identity,url text,body jsonb,headers jsonb);
      create or replace function net.http_post(url text,body jsonb,params jsonb default '{}',headers jsonb default '{}',
        timeout_milliseconds integer default 2000) returns bigint language sql as $$
        insert into net.deliveries(url,body,headers) values($1,$2,$4) returning id; $$;`);
    for (const migration of ["20261118210001_forge_hosted_runs","20261118210002_forge_independent_witness","20261118210003_forge_hosted_progress"]) {
      await db.owner.query(readFileSync(resolve(process.cwd(),"../supabase/migrations",migration+".sql"),"utf8"));
    }
    await sql("insert into vault.decrypted_secrets values('forge_pregame_dispatch_secret',$1)",[syntheticSecret]);
    await sql(`insert into forge_pregame_capture.hosted_runs(game_id,expected_code_version,slate_date,scheduled_start,open_at,close_at,
      witness_authority,witness_principal,player_id,context_id,app_origin) values($1,$2,$3,$4,clock_timestamp()+interval '0.35 seconds',
      $4::timestamptz-interval '67 minutes','automated','forge_independent_verifier',8471001,$5,'https://fixture.invalid')`,
      [game,sha,request.slateDate,request.scheduledStart,readers.HOSTED_RSO_CONTEXT]);
    await sql("select forge_pregame_capture.hosted_arm_v2($1)",[game]);
    await sql("select pg_sleep(0.36)");
    const tick = async () => (await sql("select forge_pregame_capture.hosted_tick_v2() as phase")).phase;
    const lookup = async () => (await sql("select forge_pregame_capture.hosted_receipt_v2($1) as receipt",[game])).receipt;
    const sdk = db.sdk(), trust = testTsaTrust();
    const socket = await sql("select current_setting('unix_socket_directories') as host,current_setting('port')::int as port");
    witness = new Client({ host:socket.host, port:socket.port, user:"forge_independent_verifier", database:"postgres" });
    await witness.connect();
    // A capture finish RPC lost before transport leaves the durable custody result authoritative.
    const routeDb = Object.create(sdk);
    routeDb.rpc = (name: string, args: Record<string,unknown>) => {
      if (name === "forge_pregame_hosted_finish_v1") throw new Error("lost finish transport");
      return sdk.rpc(name,args);
    };
    vi.spyOn(server,"getServiceRoleClient").mockReturnValue(routeDb);
    const actualCapture = hosted.runHostedPregameGame;
    vi.spyOn(hosted,"runHostedPregameGame").mockImplementation((input,deps) => actualCapture(input,{
      ...deps, readSchedule: async (_url,_key,target) => scheduleReader(createWorldClient(world),[game],target.slateDate)(),
      runCapture: (config,target) => runPregameCapture(captureDeps({
        writer:supabaseCaptureRpc(sdk,5000,config.hostedDispatchId), verifier:supabaseCaptureRpc(db.sdk(),5000), trust,
        tsa:{ stamp: async query => mintTimeStampResponse(query,{ genTimeMicros:BigInt(Date.now())*BigInt(1000) }) },
        createReadClient:() => createWorldClient(world), restBaseUrl:"https://fixture.invalid/rest/v1", collectNative:config.collectNative,
        seasonBootstrap:config.seasonBootstrap,modelEnvironment:config.modelEnvironment,budget:HOSTED_V2_BUDGET,
        transportLimits:PILOT_TRANSPORT_LIMITS, now:Date.now,
      }),target),
    }));
    const realPublish = publish.publishHostedClaim;
    vi.spyOn(publish,"publishHostedClaim").mockImplementation((_db,id,target) => realPublish(db.sdk(async name => {
      if (name==="forge_hosted_publish_v2") throw new Error("lost publication commit response");
    }),id,target,{trust}));
    const realRead = readers.readHostedRsoConsumers;
    vi.spyOn(readers,"readHostedRsoConsumers").mockImplementation(async (_db,target) => {
      const upstream = createWorldClient(await db.readBridgeTables(world));
      const client = { ...upstream, rpc:(name: string,args:Record<string,unknown>) => name==="read_forge_game_revisions"
        ? sdk.rpc(name,args) : upstream.rpc(name,args) };
      return realRead(client as unknown as typeof sdk,target);
    });
    const deliver = async () => {
      const command = await sql("select * from net.deliveries order by id desc limit 1");
      let code = 0;
      const response = { setHeader:vi.fn(),status(value:number) { code=value; return this; },json:vi.fn(),end:vi.fn() };
      const route = command.url.endsWith("/forge-pregame-stage") ? stage : capture;
      await route({ method:"POST",body:command.body,query:{},headers:{ "x-forge-dispatch-signature":command.headers["X-Forge-Dispatch-Signature"] }
      } as unknown as NextApiRequest,response as unknown as NextApiResponse);
      return { code,body:response.json.mock.calls[0]?.[0] };
    };
    expect(await tick()).toBe("preflight");
    expect(await deliver()).toMatchObject({ code:200,body:{status:"ready"} });
    expect(await tick()).toBe("capture");
    expect(await deliver()).toMatchObject({ code:503 });
    expect((await lookup()).dispatch.state).toBe("started");
    expect(await tick()).toBe("verify");
    const claimId = (await lookup()).claim;
    expect(claimId).toBeTruthy();
    const premature = {claimId,gameId:game,codeVersion:sha};
    await expect(publishQualifiedPregameCapture(premature,{db:sdk,trust})).rejects.toThrow();
    expect(await sql("select count(*)::int n from public.forge_runs")).toEqual({n:0});
    expect((await sdk.rpc("read_forge_game_revisions",{p_slate_date:request.slateDate})).data).toEqual([]);
    expect(await runWitnessOnce(witness,game,sha,trust)).toBe("accepted");
    expect(await tick()).toBe("publish");
    expect(await deliver()).toMatchObject({code:200,body:{status:"awaiting_receipt"}});
    expect(await deliver()).toMatchObject({code:409});
    expect(await sql("select count(*)::int n from forge_pregame_capture.publications")).toEqual({n:1});
    expect(await tick()).toBe("readers");
    expect(await deliver()).toMatchObject({code:200,body:{status:"succeeded"}});
    const receipt = await lookup();
    expect(receipt).toMatchObject({gameId:game,phase:"succeeded",claim:claimId,custody:"qualified",
      independent:{claim_id:claimId,verdict:"accepted",verifier_role:"forge_independent_verifier"},publication:{runId:claimId},
      readers:{daily:{selectedRun:claimId,legalSlot:"C#1",points:expect.any(Number),reason:null},
        detailed:{selectedRun:claimId,revisionId:receipt.publication.revisionId,points:null,legalSlot:null,reason:"missing_participation"}}});
    if (process.env.FORGE_PRINT_FIXTURE_RECEIPT === "true") console.log("LOCAL_FIXTURE_RECEIPT",JSON.stringify(receipt));
    expect(await tick()).toBe("idle");
    expect(await sql("select count(*)::int n from net.deliveries")).toEqual({n:4});
    expect(await sql("select details from public.cron_job_audit")).toEqual({details:{gameId:game,phase:"succeeded",reason:"readers_recorded"}});
  } finally { await witness?.end(); await db.close(); }
},40_000);
