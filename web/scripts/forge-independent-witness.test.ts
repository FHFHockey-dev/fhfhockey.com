// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import { expect, it } from "vitest";
import { publicationDbAvailable, startPublicationDb } from "../lib/projections/pregameCapture/__fixtures__/publicationConsumerDb";
import { mintTimeStampResponse, testTsaTrust } from "../lib/projections/pregameCapture/__fixtures__/testTsa";
import { buildLeague, TARGET } from "../lib/projections/pregameCapture/__fixtures__/world/league";
import { encodePacket, PACKET_VERSION } from "../lib/projections/pregameCapture/packet";
import { POLICY_ID } from "../lib/projections/pregameCapture/policy";
import { supabaseCaptureRpc } from "../lib/projections/pregameCapture/rpc";
import { tsaProfile, trustFromProfile } from "../lib/projections/pregameCapture/tsaProfiles";
import { verifyAndWitness } from "../lib/projections/pregameCapture/verifier";
import { reviewEvidence, runWitnessOnce } from "./forge-independent-witness";

const sha = "1".repeat(40);
const migration = (name: string) => readFileSync(resolve(__dirname,"../../supabase/migrations",name),"utf8");

it.skipIf(!publicationDbAvailable).each([
  { authority:"named_human", principal:"named_test_witness", verdict:"accepted" },
  { authority:"automated", principal:"forge_independent_verifier", verdict:"accepted" },
  { authority:"automated", principal:"forge_independent_verifier", verdict:"rejected" },
])("records $verdict only under $authority authority for an exact-game committed witness", async ({authority,principal,verdict}) => {
  const db = await startPublicationDb();
  const clients: Client[] = [];
  try {
    const world = buildLeague(), game = TARGET.gameId;
    const start = new Date(Date.now() + 85 * 60_000).toISOString();
    const current = world.tables.games.find(row => row.id === game)!;
    current.startTime = start;
    for (const team of world.tables.roster_optimizer_team_games) team.start_time = start;
    await db.seed(world,game);
    await db.owner.query(migration("20261118210001_forge_hosted_runs.sql"));
    await db.owner.query(migration("20261118210002_forge_independent_witness.sql"));
    await db.owner.query("create role named_test_witness login in role forge_named_witness");
    const { rows: [{ host, port }] } = await db.owner.query("select current_setting('unix_socket_directories') as host, current_setting('port') as port");
    async function login(user: string) {
      const client = new Client({ host, port: Number(port), database: "postgres", user, ssl: false });
      await client.connect();
      clients.push(client);
      return client;
    }
    const machine = await login("forge_independent_verifier"), human = await login("named_test_witness");
    for (const sql of ["select * from forge_pregame_capture.artifacts","select * from forge_pregame_capture.independent_verdicts",
      "select public.forge_pregame_capture_sweep_v1(0,1)"]) {
      await expect(machine.query(sql)).rejects.toMatchObject({code:"42501"});
    }
    await db.owner.query("set role service_role");
    await expect(db.owner.query("select forge_witness_api.independent_read_v1(1,'x')")).rejects.toMatchObject({code:"42501"});
    await db.owner.query("reset role");
    const rpc = supabaseCaptureRpc(db.sdk());
    const binding = { gameId: game, policyId: POLICY_ID, slateDate: current.date, homeTeamId: current.homeTeamId,
      awayTeamId: current.awayTeamId, calendarRevision: "2".repeat(64), scheduledStart: start, requiredMs: 240000, codeVersion: sha };
    const claim = await rpc.claim(binding);
    expect(claim.outcome).toBe("claimed");
    const claimId = claim.claimId!, at = claim.inputCutoff!;
    const abbrev = (id: number) => world.tables.teams.find(t => t.id === id)!.abbreviation;
    const packet = encodePacket({version: PACKET_VERSION, binding: {...binding, claimId, inputCutoff: claim.inputCutoff!,
      homeAbbrev: abbrev(binding.homeTeamId), awayAbbrev: abbrev(binding.awayTeamId)}, readWindow: {start:at,end:at}, statedCutoff:at,
      seasonBootstrapApplied:false, modelEnvironment:{}, candidates:{skaters:[],goalies:[],reserves:[]},
      transport:{calls:1,httpCalls:1,rows:1,bytes:1,stampToleranceMs:0}, reads:[{request:[],result:[],receivedAt:at}]});
    await rpc.save(claimId, packet.bytes.toString("base64"), packet.rawSha256,packet.canonicalSha256,new AbortController().signal);
    const trust = testTsaTrust();
    expect((await verifyAndWitness({rpc,trust,now: Date.now,tsaTimeoutMs:5000,skewToleranceMs:2000,
      tsa:{stamp:async req => mintTimeStampResponse(req,{genTimeMicros:BigInt(Date.now())*BigInt(1000)})}},
    {claimId,gameId:game,policyId:POLICY_ID,rawSha256:packet.rawSha256,canonicalSha256:packet.canonicalSha256})).verdict).toBe("qualified");
    await rpc.recordOutcome(game,POLICY_ID,claimId,"qualified",{});
    await db.owner.query(`insert into forge_pregame_capture.hosted_runs(game_id,expected_code_version,scheduled_start,slate_date,
      open_at,close_at,witness_authority,witness_principal,player_id,context_id,app_origin,phase,claim_id,armed_at)
      values($1,$2,$3,$4,clock_timestamp()-interval '1 minute',clock_timestamp()+interval '10 minutes',
      $6,$7,8471001,'synthetic-single-center-points-v1','https://fixture.invalid','verify',$5,clock_timestamp()-interval '2 minutes')`,
    [game,sha,start,current.date,claimId,authority,principal]);
    const actor = authority === "automated" ? machine : human;
    const other = authority === "automated" ? human : machine;
    // A valid unrelated principal cannot consume the approved witness's one raw read.
    expect(await runWitnessOnce(other,game,sha,trust)).toBe("idle");
    expect(await runWitnessOnce(actor,game+1,sha,trust)).toBe("idle");
    expect(await runWitnessOnce(actor,game,"2".repeat(40),trust)).toBe("idle");

    // Roll back the test-only read to keep the production worker path available below.
    await actor.query("begin");
    const e = (await actor.query("select forge_witness_api.independent_read_v1($1,$2) as e",[game,sha])).rows[0].e;
    expect(e).toBeTruthy();
    expect(reviewEvidence(e,game,sha,trust,Date.now())).toBeNull();
    expect(reviewEvidence({...e,packet_base64:"AA=="},game,sha,trust,Date.now())).toBe("packet_invalid");
    expect(reviewEvidence({...e,canonical_sha256:"0".repeat(64)},game,sha,trust,Date.now())).toBe("packet_binding");
    expect(reviewEvidence({...e,calendar_revision:"0".repeat(64)},game,sha,trust,Date.now())).toBe("packet_binding");
    expect(reviewEvidence({...e,witness_statement_text:e.witness_statement_text+" "},game,sha,trust,Date.now())).toBe("statement_binding");
    expect(reviewEvidence({...e,witness_token_base64:"AA=="},game,sha,trust,Date.now())).toBe("token_invalid");
    expect(reviewEvidence({...e,final_read_at:start},game,sha,trust,Date.now())).toBe("timing_invalid");
    expect(reviewEvidence(e,game,sha,trust,Date.parse(start)-60*60000+1)).toBe("timing_invalid");
    await expect(actor.query("select forge_witness_api.independent_append_v1($1,'accepted',null,$2,$3,$4)",
      [e.challenge,e.raw_sha256,e.canonical_sha256,e.tsa_token_sha256])).rejects.toMatchObject({code:"P0002"});
    await actor.query("rollback");

    // The production trust anchor refuses the fixture signer even with fully qualified primary custody.
    if (authority === "named_human") {
      // A committed check with lost client ACK is recoverable. A same-transaction confirmation is not proof.
      const committed = (await actor.query("select forge_witness_api.independent_read_v1($1,$2) as e",[game,sha])).rows[0].e;
      const params = [committed.challenge,committed.raw_sha256,committed.canonical_sha256,committed.tsa_token_sha256];
      await expect(other.query("select forge_witness_api.independent_append_v1($1,'accepted',null,$2,$3,$4)",params))
        .rejects.toMatchObject({code:"P0002"});
      expect(reviewEvidence(committed,game,sha,trust,Date.now())).toBeNull();
      await actor.query("begin");
      await actor.query("select forge_witness_api.independent_append_v1($1,'accepted',null,$2,$3,$4)",params);
      expect((await actor.query("select forge_witness_api.independent_confirm_v1($1,$2) as result",[game,sha])).rows[0].result).toBe("idle");
      await actor.query("commit");
    }
    const verifierTrust = verdict === "accepted" ? trust : trustFromProfile(tsaProfile("digicert-g4-v1"),"capture");
    expect(await runWitnessOnce(actor,game,sha,verifierTrust)).toBe(verdict);
    expect(await runWitnessOnce(actor,game,sha,verifierTrust)).toBe(verdict);
    expect((await actor.query("select forge_witness_api.independent_read_v1($1,$2) as e",[game,sha])).rows[0].e).toBeNull();
    const receipt = await db.owner.query(`select v.verdict,v.verifier_role,v.reason,v.raw_sha256 = a.raw_sha256 as same_bytes,
      v.verified_at >= k.checked_at and v.verified_at <= c.ack_deadline as before_deadline, count(*) over ()::int as n
      from forge_pregame_capture.independent_verdicts v join forge_pregame_capture.independent_checks k using(claim_id)
      join forge_pregame_capture.artifacts a using(claim_id) join forge_pregame_capture.claims c on c.id = v.claim_id`);
    expect(receipt.rows).toEqual([{verdict,verifier_role:principal,reason:verdict === "accepted" ? null : "token_invalid",same_bytes:true,before_deadline:true,n:1}]);
    await expect(db.owner.query("update forge_pregame_capture.independent_verdicts set reason='x'")).rejects.toThrow();
  } finally {
    await Promise.allSettled(clients.map(client => client.end()));
    await db.close();
  }
},30000);
