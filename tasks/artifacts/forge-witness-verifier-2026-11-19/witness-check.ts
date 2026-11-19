// Local process only (check_witness.py). The FORGE writer captures the fixture game through PostgREST as service_role,
// then the independent verifier route runs through real PostgREST 16.6 as forge_witness_api. Synthetic claims, each
// with exactly one defect, are inserted as the database owner. Then duplicates, database-side re-checks, the publisher
// gate and the denial matrix. PostgREST serves at its root; supabase-js's /rest/v1 prefix is stripped here.
import assert from "node:assert/strict";
import { createHash, randomUUID, X509Certificate } from "node:crypto";
import { createServer, type Server } from "node:http";
import { Client } from "pg";
import type { NextApiRequest, NextApiResponse } from "next";
import { forgeEnv, withForgeEnv } from "lib/projections/forgeEnvScope";
import { at, syntheticPacket, syntheticWitness } from "lib/projections/pregameCapture/__fixtures__/witnessCustody";
import { mintTimeStampResponse, testTsaTrust } from "lib/projections/pregameCapture/__fixtures__/testTsa";
import { runHostedPregameGame } from "lib/projections/pregameCapture/hostedGame";
import { decodePacket, type CaptureBinding } from "lib/projections/pregameCapture/packet";
import { formatMicros, parseInstantMicros } from "lib/projections/pregameCapture/time";
import { TSA_PROFILES } from "lib/projections/pregameCapture/tsaProfiles";
import route from "pages/api/v1/db/forge-witness-verify";

const GAME = 2099020991;
const FIXTURE_FLAGS = { STARTER_BOARD_COMPUTE_ENABLED: "true", STARTER_BOARD_SERVING_ENABLED: "true", STARTER_BOARD_CANARY_GAME_IDS: String(GAME) };
type Tokens = Record<"anon" | "authenticated" | "service_role" | "witness", string>;

async function listen(server: Server) {
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}

async function call(headers: Record<string, string>, query: Record<string, string> = {}) {
  let status = 0, body: any = null;
  const cache: string[] = [];
  const res = { setHeader(k: string, v: string) { if (k === "Cache-Control") cache.push(v); },
    status(code: number) { status = code; return res; }, json(value: unknown) { body = value; return res; }, end() { return res; } };
  const started = Date.now();
  await route({ method: "GET", query, headers } as unknown as NextApiRequest, res as unknown as NextApiResponse);
  return { status, body, cache: cache[0], wallMs: Date.now() - started };
}

async function main() {
  const rest = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const tokens = JSON.parse(process.env.FORGE_TEST_TOKENS!) as Tokens;
  const request = JSON.parse(process.env.FORGE_REHEARSAL_REQUEST!) as { gameId: number; slateDate: string; scheduledStart: string };
  const label = process.env.VERCEL_GIT_COMMIT_SHA!;
  const owner = new Client(JSON.parse(process.env.FORGE_WITNESS_OWNER_DSN!));
  await owner.connect();
  const q = async (sql: string, args: unknown[] = []) => (await owner.query(sql, args)).rows;
  const one = async (sql: string, args: unknown[] = []) => (await q(sql, args))[0];

  // Fixture TSA in this process only: the released profile object is re-pointed at it, as the sibling rehearsals do.
  const trust = testTsaTrust();
  let tsaCalls = 0;
  const tsa = createServer(async (req, res) => {
    const blocks = [];
    for await (const part of req) blocks.push(part);
    tsaCalls++;
    res.setHeader("content-type", "application/timestamp-reply");
    res.end(mintTimeStampResponse(Buffer.concat(blocks), { genTimeMicros: BigInt(Date.now()) * BigInt(1000) }));
  });
  const tsaUrl = await listen(tsa);
  Object.assign(TSA_PROFILES["digicert-g4-v1"], { ...trust, url: tsaUrl, fallbackAccuracyMicros: undefined,
    anchorSha256: trust.anchorsPem.map(pem => createHash("sha256").update(new X509Certificate(pem).raw).digest("hex")), extraCertsSha256: [] });

  const http = globalThis.fetch;
  let phase: "writer" | "verifier" = "writer";
  const traffic: Record<string, Record<string, number>> = { writer: {}, verifier: {} };
  const routeErrors: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.origin === new URL(rest).origin && url.pathname.startsWith("/rest/v1/")) {
      url.pathname = url.pathname.slice("/rest/v1".length);
      const headers = new Headers(init?.headers);
      const profile = headers.get("accept-profile") ?? headers.get("content-profile") ?? "(none)";
      const who = headers.get("authorization") === `Bearer ${tokens.witness}` ? "witness"
        : headers.get("authorization") === `Bearer ${tokens.service_role}` ? "service_role" : "other";
      const key = `${who}@${profile}`;
      traffic[phase][key] = (traffic[phase][key] ?? 0) + 1;
      if (phase === "verifier") assert.equal(key, "witness@forge_witness_api", "verifier used another credential or schema");
    } else assert.equal(url.origin, tsaUrl, `unexpected network request ${url.origin}${url.pathname}`);
    const response = await http(url, { ...init, redirect: "error" });
    if (!response.ok && url.origin !== tsaUrl && routeErrors.length < 12) {
      routeErrors.push(`${phase} ${init?.method ?? "GET"} ${url.pathname} ${response.status} ${(await response.clone().text()).slice(0, 300)}`);
    }
    return response;
  };

  const raw = async (token: string | null, method: string, path: string, profile: string | null, body?: unknown) => {
    const headers: Record<string, string> = { "content-type": "application/json", apikey: tokens.anon };
    if (token) headers.authorization = `Bearer ${token}`;
    if (profile) headers[method === "GET" || method === "HEAD" ? "accept-profile" : "content-profile"] = profile;
    const response = await http(rest + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.text() };
  };
  const auth = { authorization: `Bearer ${process.env.CRON_SECRET}` };
  const verdictRows = async () => (await one("select count(*)::int n, coalesce(string_agg(id::text || ':' || xmin::text, ',' order by id), '') v from forge_witness.verdicts")) as { n: number; v: string };

  try {
    // 1. The FORGE writer: the real hosted capture as service_role (the live writer's credential), fixture flags scoped.
    const captureStarted = Date.now();
    const capture = await withForgeEnv(FIXTURE_FLAGS, () => runHostedPregameGame(
      { gameId: GAME, slateDate: request.slateDate, scheduledStart: request.scheduledStart, safeStart: request.scheduledStart, codeVersion: label },
      { env: { ...forgeEnv(), NEXT_PUBLIC_SUPABASE_URL: rest, SUPABASE_SERVICE_ROLE_KEY: tokens.service_role } }));
    const captureMs = Date.now() - captureStarted;
    assert.ok(capture.outcome === "qualified" && capture.claimId, JSON.stringify({ capture, routeErrors }));
    const real = await one(`select c.*, a.raw_sha256, a.canonical_sha256, encode(a.packet, 'base64') packet_b64, w.tsa_token_sha256
      from forge_pregame_capture.claims c join forge_pregame_capture.artifacts a on a.claim_id = c.id
      join forge_pregame_capture.witnesses w on w.claim_id = c.id where c.id = $1`, [capture.claimId]);
    const realBinding = decodePacket(Uint8Array.from(Buffer.from(real.packet_b64.replace(/\s/g, ""), "base64"))).packet.binding;
    phase = "verifier";

    // 2. Synthetic claims, one defect each, on cloned schedule rows.
    const now = parseInstantMicros((await one("select clock_timestamp()::text t")).t.replace(" ", "T").replace(/\+00$/, "Z"));
    const iso = (deltaMs: number) => formatMicros(now + BigInt(deltaMs) * BigInt(1000));
    const NORMAL = 120 * 60_000, PAST_DEADLINE = 59.5 * 60_000;
    const cases: Record<string, { game: number; start: number; expect: string; claim?: string }> = {};
    let next = 2099030001;
    async function cloneGame(start: string) {
      const game = next++;
      await q(`do $$ declare cols text; begin
        create temp table g on commit drop as select * from public.games where id = ${GAME};
        update g set id = ${game}, "startTime" = '${start}'; insert into public.games select * from g;
        select string_agg(quote_ident(column_name), ', ') into cols from information_schema.columns
          where table_schema = 'public' and table_name = 'roster_optimizer_team_games' and column_name not in ('id', 'source_game_id', 'game_key')
            and is_generated = 'NEVER' and is_identity = 'NO';
        execute format('insert into public.roster_optimizer_team_games (id, source_game_id, game_key, %s)
          select (select max(id) from public.roster_optimizer_team_games) + row_number() over (), ${game}, game_key || ''-${game}'', %s
          from public.roster_optimizer_team_games where source_game_id = ${GAME}', cols, cols);
      end $$`);
      return game;
    }
    type Defect = { binding?: Partial<CaptureBinding>; canonical?: string; token?: (t: Buffer) => Buffer; tsaPolicy?: string;
      times?: { cutoff: number; read: number; stamp: number; final: number }; outcome?: string | null; artifact?: boolean };
    async function seed(name: string, startMs: number, expect: string, defect: Defect = {}) {
      const start = iso(startMs);
      const game = await cloneGame(start);
      const claimId = randomUUID();
      const t = defect.times ?? { cutoff: -300_000, read: -297_500, stamp: -296_500, final: -295_500 };
      const cutoff = iso(t.cutoff), inserted = iso(t.read - 500), read = iso(t.read);
      cases[name] = { game, start: startMs, expect, claim: claimId };
      await q(`insert into forge_pregame_capture.claims (id, game_id, policy_id, slate_date, home_team_id, away_team_id, calendar_revision,
        scheduled_start, input_cutoff, ack_deadline, required_ms, code_version, claimed_at)
        values ($1, $2, 'pregame-native-v1', $3, $4, $5, $6, $7, $8, $7::timestamptz - interval '60 minutes', 240000, $9, $8)`,
        [claimId, game, real.slate_date, real.home_team_id, real.away_team_id, real.calendar_revision, start, cutoff, label]);
      if (defect.artifact === false) {
        await q("insert into forge_pregame_capture.save_fences (claim_id) values ($1)", [claimId]);
      } else {
        const binding: CaptureBinding = { ...realBinding, claimId, gameId: game, scheduledStart: start, inputCutoff: cutoff, codeVersion: label, ...defect.binding };
        const packet = syntheticPacket(binding);
        const row = await one(`insert into forge_pregame_capture.artifacts (claim_id, packet, raw_sha256, canonical_sha256, byte_length, inserted_at)
          values ($1, $2, $3, $4, $5, $6) returning xmin::text v`,
          [claimId, packet.bytes, packet.rawSha256, defect.canonical ?? packet.canonicalSha256, packet.bytes.length, inserted]);
        const w = syntheticWitness({ claimId, gameId: game, rawSha256: packet.rawSha256, canonicalSha256: packet.canonicalSha256,
          byteLength: packet.bytes.length, rowVersion: row.v, calendarRevision: real.calendar_revision, scheduledStart: start, dbReadAt: read,
          genTimeMicros: now + BigInt(t.stamp) * BigInt(1000), tsa: defect.tsaPolicy ? { policy: defect.tsaPolicy } : undefined });
        const token = defect.token ? defect.token(w.token) : w.token;
        await q(`insert into forge_pregame_capture.witnesses (claim_id, statement_text, statement, statement_sha256, tsa_token, tsa_gen_time,
          tsa_accuracy_us, tsa_resolution_us, tsa_accuracy_source, tsa_signer_sha256, ack_upper, db_read_at, final_read_at, verdict, verdict_reason)
          values ($1, $2::text, $2::text::jsonb, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'qualified', null)`,
          [claimId, w.statementText, w.statementSha256, token, w.genTime, w.accuracyUs, w.resolutionUs, w.accuracySource, w.signerSha256,
            w.ackUpper, read, iso(t.final)]);
      }
      const outcome = defect.outcome === undefined ? (defect.artifact === false ? "source_failed" : "qualified") : defect.outcome;
      if (outcome) await q("insert into forge_pregame_capture.outcomes (game_id, policy_id, claim_id, outcome) values ($1, 'pregame-native-v1', $2, $3)",
        [game, claimId, outcome]);
      return game;
    }
    const flip = (index: number) => (token: Buffer) => { const copy = Buffer.from(token); copy[index] ^= 0x01; return copy; };
    cases.claim_missing = { game: await cloneGame(iso(NORMAL)), start: NORMAL, expect: "claim_missing" };
    await seed("not_terminal", NORMAL, "not_terminal", { outcome: null });
    await seed("artifact_missing", NORMAL, "rejected:artifact_missing", { artifact: false });
    await seed("game_mismatch", NORMAL, "rejected:game_binding", { binding: { gameId: GAME } });
    await seed("claim_mismatch", NORMAL, "rejected:claim_binding", { binding: { claimId: randomUUID() } });
    await seed("hash_mismatch", NORMAL, "rejected:hash_mismatch", { canonical: "0".repeat(64) });
    await seed("cutoff_mismatch", NORMAL, "rejected:cutoff_mismatch", { binding: { inputCutoff: iso(-299_000) } });
    await seed("token_tampered", NORMAL, "rejected:token_invalid", { token: flip(400) });
    await seed("token_wrong_profile", NORMAL, "rejected:token_invalid", { tsaPolicy: "1.3.6.1.4.1.99999.9" });
    await seed("witness_late", PAST_DEADLINE, "rejected:witness_late",
      { times: { cutoff: -45_000, read: -40_000, stamp: -25_000, final: -20_000 } });
    await seed("verification_late", PAST_DEADLINE, "rejected:verification_late");
    for (const name of ["schedule_changed"]) {
      await seed(name, NORMAL, "rejected:schedule_changed");
      await q(`update public.games set "startTime" = "startTime" + interval '15 minutes' where id = $1`, [cases[name].game]);
    }
    await seed("team_rows_missing", NORMAL, "schedule_unavailable");
    cases.real = { game: GAME, start: 0, expect: "accepted", claim: capture.claimId };

    // Arm every case (installer only), then one cron-equivalent GET.
    for (const name of Object.keys(cases)) await q("select forge_witness.arm_v1($1)", [cases[name].game]);
    // After arming (arm requires a readable schedule): the team rows vanish, so the verifier must decide nothing.
    await q("delete from public.roster_optimizer_team_games where source_game_id = $1", [cases.team_rows_missing.game]);
    assert.equal((await call({ authorization: "Bearer wrong" })).status, 401);
    assert.equal((await call(auth, { gameId: String(GAME) })).status, 400);
    const first = await call(auth);
    assert.equal(first.cache, "no-store, max-age=0");
    assert.equal(first.status, 200, JSON.stringify({ body: first.body, routeErrors }));
    const byGame = new Map<number, any>((first.body.results as any[]).map(r => [r.gameId, r]));
    const matrix: Record<string, unknown> = {};
    for (const [name, c] of Object.entries(cases)) {
      const r = byGame.get(c.game);
      assert.ok(r, `no result for ${name}`);
      const got = r.status === "recorded" ? (r.verdict === "accepted" ? "accepted" : `rejected:${r.reason}`) : r.status;
      matrix[name] = { gameId: c.game, expected: c.expect, got, independent: r.independent ?? null, verifiedAt: r.verifiedAt ?? null, deadlineAt: r.deadlineAt ?? null };
      assert.equal(got, c.expect, `${name}: ${JSON.stringify(r)}`);
      if (r.independent) assert.equal(r.verdict, r.independent.verdict, `${name}: database and verifier disagree`);
    }
    const realVerdict = await one("select * from forge_witness.verdicts where claim_id = $1", [capture.claimId]);
    assert.ok(realVerdict.verdict === "accepted" && realVerdict.raw_sha256 === real.raw_sha256 && realVerdict.canonical_sha256 === real.canonical_sha256
      && realVerdict.tsa_token_sha256 === real.tsa_token_sha256 && realVerdict.verifier_role === "forge_witness_api"
      && realVerdict.verifier_release === label && new Date(realVerdict.verified_at) <= new Date(realVerdict.deadline_at));
    assert.equal(new Date(realVerdict.deadline_at).getTime(), new Date(real.scheduled_start).getTime() - 3_600_000);

    // 3. Duplicates: a second GET and a direct second record create nothing; a parallel race on a fresh target yields one row.
    const rowsBefore = await verdictRows();
    const second = await call(auth);
    assert.equal(second.status, 200);
    assert.ok((second.body.results as any[]).every(r => ["claim_missing", "not_terminal", "schedule_unavailable"].includes(r.status)), JSON.stringify(second.body));
    assert.equal((await one("select count(*)::int n from forge_witness.verdicts where game_id = $1", [cases.team_rows_missing.game])).n, 0);
    const replay = await raw(tokens.witness, "POST", "/rpc/record_v1", "forge_witness_api", { p_game_id: GAME, p_claim_id: capture.claimId,
      p_verdict: "accepted", p_reason: null, p_raw_sha256: real.raw_sha256, p_canonical_sha256: real.canonical_sha256,
      p_tsa_token_sha256: real.tsa_token_sha256, p_statement_sha256: realVerdict.statement_sha256, p_input_cutoff: real.input_cutoff, p_release: label });
    assert.equal(replay.status, 200, replay.body);
    assert.ok(JSON.parse(replay.body).created === false && String(JSON.parse(replay.body).verdict.id) === String(realVerdict.id), replay.body);
    assert.deepEqual(await verdictRows(), rowsBefore);
    const race = await seed("race", NORMAL, "accepted");
    await q("select forge_witness.arm_v1($1)", [race]);
    const [r1, r2] = await Promise.all([call(auth), call(auth)]);
    const raceResults = [r1, r2].map(r => (r.body.results as any[]).find(x => x.gameId === race));
    assert.equal((await one("select count(*)::int n from forge_witness.verdicts where game_id = $1", [race])).n, 1);
    assert.equal(raceResults.filter(r => r?.status === "recorded").length, 1, JSON.stringify(raceResults));
    assert.ok(raceResults.every(r => !r || r.status === "recorded" || r.status === "duplicate"), JSON.stringify(raceResults));

    // 4. The database re-checks on its own: a client "accepted" past T−60 or with a wrong hash is stored as rejected.
    const dbChecks: Record<string, unknown> = {};
    for (const [name, startMs, mutate, expect] of [
      ["db_late", PAST_DEADLINE, (x: any) => x, "verification_late"],
      ["db_hash", NORMAL, (x: any) => ({ ...x, p_canonical_sha256: "1".repeat(64) }), "hash_mismatch"],
      ["db_unarmed_claim", NORMAL, (x: any) => ({ ...x, p_claim_id: capture.claimId }), "witness_claim_binding"],
    ] as const) {
      const game = await seed(name, startMs, expect);
      await q("select forge_witness.arm_v1($1)", [game]);
      const e = (await raw(tokens.witness, "POST", "/rpc/evidence_v1", "forge_witness_api", { p_game_id: game })).body;
      const ev = JSON.parse(e);
      const args = mutate({ p_game_id: game, p_claim_id: ev.claim.id, p_verdict: "accepted", p_reason: null, p_raw_sha256: ev.artifact.dbRawSha256,
        p_canonical_sha256: ev.artifact.canonicalSha256, p_tsa_token_sha256: ev.witness.dbTokenSha256, p_statement_sha256: ev.witness.statementSha256,
        p_input_cutoff: ev.claim.inputCutoff, p_release: label });
      const res = await raw(tokens.witness, "POST", "/rpc/record_v1", "forge_witness_api", args);
      if (expect === "witness_claim_binding") {
        assert.ok(res.status >= 400 && res.body.includes(expect), res.body);
        dbChecks[name] = { httpStatus: res.status, stored: (await one("select count(*)::int n from forge_witness.verdicts where game_id = $1", [game])).n };
      } else {
        const stored = JSON.parse(res.body).verdict;
        assert.ok(res.status === 200 && stored.verdict === "rejected" && stored.reason === expect, res.body);
        dbChecks[name] = { clientSaid: "accepted", stored: `${stored.verdict}:${stored.reason}` };
      }
    }

    // 5. Publisher gate as service_role (the writer's credential).
    const gateAs = async (claim: string, h: [string, string, string]) => {
      await q("set role service_role");
      try { return (await one("select forge_witness.publication_gate_v1($1, $2, $3, $4) g", [claim, ...h])).g; } finally { await q("reset role"); }
    };
    const realHashes: [string, string, string] = [real.raw_sha256, real.canonical_sha256, real.tsa_token_sha256];
    const forged = await seed("gate_forged_late", PAST_DEADLINE, "gate:verified_late");
    const forgedRow = await one("select a.raw_sha256, a.canonical_sha256, w.tsa_token_sha256, w.statement_sha256, c.input_cutoff from forge_pregame_capture.artifacts a join forge_pregame_capture.witnesses w using (claim_id) join forge_pregame_capture.claims c on c.id = a.claim_id where a.claim_id = $1", [cases.gate_forged_late.claim]);
    // Superuser forgery (no API path can do this): an "accepted" row whose stored deadline lies. The gate recomputes it.
    await q(`insert into forge_witness.verdicts (claim_id, game_id, policy_id, verdict, reason, raw_sha256, canonical_sha256, tsa_token_sha256,
      statement_sha256, input_cutoff, scheduled_start, deadline_at, verifier_role, verifier_release)
      values ($1, $2, 'pregame-native-v1', 'accepted', null, $3, $4, $5, $6, $7, clock_timestamp() + interval '3 hours', clock_timestamp() + interval '1 hour', 'forged', $8)`,
      [cases.gate_forged_late.claim, forged, forgedRow.raw_sha256, forgedRow.canonical_sha256, forgedRow.tsa_token_sha256, forgedRow.statement_sha256,
        forgedRow.input_cutoff, label]);
    const gates: Record<string, any> = {
      real: await gateAs(capture.claimId, realHashes),
      realWrongCanonical: await gateAs(capture.claimId, [real.raw_sha256, "0".repeat(64), real.tsa_token_sha256]),
      realWrongToken: await gateAs(capture.claimId, [real.raw_sha256, real.canonical_sha256, "0".repeat(64)]),
      rejectedClaim: await gateAs(cases.game_mismatch.claim!, realHashes),
      unverifiedClaim: await gateAs(cases.not_terminal.claim!, realHashes),
      unknownClaim: await gateAs(randomUUID(), realHashes),
      forgedLate: await gateAs(cases.gate_forged_late.claim!, [forgedRow.raw_sha256, forgedRow.canonical_sha256, forgedRow.tsa_token_sha256]),
    };
    // The race game's verdict is accepted; once its games row is invisible the gate must refuse (no fallback start).
    const raceRow = await one("select claim_id, raw_sha256, canonical_sha256, tsa_token_sha256 from forge_witness.verdicts where game_id = $1", [race]);
    const raceBefore = await gateAs(raceRow.claim_id, [raceRow.raw_sha256, raceRow.canonical_sha256, raceRow.tsa_token_sha256]);
    await q("delete from public.games where id = $1", [race]);
    Object.assign(gates, { raceBeforeGamesRowRemoved: raceBefore,
      raceGamesRowInvisible: await gateAs(raceRow.claim_id, [raceRow.raw_sha256, raceRow.canonical_sha256, raceRow.tsa_token_sha256]) });
    assert.equal(raceBefore.accepted, true, JSON.stringify(raceBefore));
    assert.equal(gates.real.accepted, true, JSON.stringify(gates.real));
    for (const [name, reason] of Object.entries({ realWrongCanonical: "hash_mismatch", realWrongToken: "hash_mismatch", rejectedClaim: "verdict_rejected",
      unverifiedClaim: "verdict_missing", unknownClaim: "verdict_missing", forgedLate: "verified_late",
      raceGamesRowInvisible: "schedule_unavailable" })) {
      assert.ok(!(gates as any)[name].accepted && (gates as any)[name].reason === reason, `${name}: ${JSON.stringify((gates as any)[name])}`);
    }
    await q("set role service_role");
    const required = await one("select forge_witness.require_accepted_v1($1, $2, $3, $4) g", [capture.claimId, ...realHashes]);
    const refused = await owner.query("select forge_witness.require_accepted_v1($1, $2, $3, $4)", [cases.game_mismatch.claim, ...realHashes])
      .then(() => "allowed", e => `${e.code} ${e.message} (${e.detail})`);
    await q("reset role");
    assert.ok(required.g.accepted && refused.startsWith("42501 witness_verdict_required"), refused);

    // 6. Nobody but the definers writes verdicts: the writer and every client role is refused, and rows are immutable even
    //    for the owner. Each statement runs in its own transaction as that role.
    const sqlDenials: Record<string, string> = {};
    const attempt = async (role: string, label_: string, sql: string) => {
      await q("begin");
      try {
        await q(`set local role ${role}`);
        await q(sql);
        sqlDenials[`${role}: ${label_}`] = "ALLOWED";
      } catch (e: any) {
        sqlDenials[`${role}: ${label_}`] = `${e.code} ${String(e.message).slice(0, 80)}`;
      } finally {
        await q("rollback");
      }
    };
    const statements: Array<[string, string]> = [
      ["insert verdict", `insert into forge_witness.verdicts (claim_id, game_id, policy_id, verdict, input_cutoff, scheduled_start, deadline_at, verifier_role, verifier_release) values ('${randomUUID()}', 1, 'pregame-native-v1', 'rejected', now(), now(), now() - interval '1 hour', 'x', '${label}')`],
      ["update verdict", "update forge_witness.verdicts set reason = 'x'"],
      ["delete verdict", "delete from forge_witness.verdicts"],
      ["truncate verdicts", "truncate forge_witness.verdicts"],
      ["disable triggers", "alter table forge_witness.verdicts disable trigger all"],
      ["drop verdicts", "drop table forge_witness.verdicts"],
      ["create table in forge_witness", "create table forge_witness.shadow (x int)"],
      ["create function in forge_witness_api", "create function forge_witness_api.shadow() returns int language sql as 'select 1'"],
      ["insert target", "insert into forge_witness.targets (game_id) values (1)"],
      ["call private record", `select forge_witness.record_v1(1, '${randomUUID()}', 'accepted', null, null, null, null, null, now(), '${label}', 'x')`],
      ["call arm", "select forge_witness.arm_v1(1)"],
      ["read custody claims", "select count(*) from forge_pregame_capture.claims"],
    ];
    for (const role of ["service_role", "anon", "authenticated", "authenticator", "forge_witness_api"]) {
      for (const [name, sql] of statements) {
        if (role === "service_role" && name === "read custody claims") continue;
        await attempt(role, name, sql);
      }
      if (role !== "forge_witness_api") {
        await attempt(role, "call API record", `select forge_witness_api.record_v1(${GAME}, '${capture.claimId}', 'accepted', null, null, null, null, null, now(), '${label}')`);
        await attempt(role, "call API evidence", `select forge_witness_api.evidence_v1(${GAME})`);
      }
    }
    for (const [name, sql] of statements.slice(1, 4)) await attempt("forge_witness_owner", name, sql);
    const allowed = Object.entries(sqlDenials).filter(([, v]) => !v.startsWith("42501"));
    assert.deepEqual(allowed, [], JSON.stringify(allowed));
    assert.ok(Object.entries(sqlDenials).filter(([k]) => k.startsWith("forge_witness_owner")).every(([, v]) => v.includes("immutable")));

    // 7. Data API denials. The witness token reaches only its three RPCs; the writer and client tokens reach none of them.
    const httpDenials: Record<string, number> = {};
    const deny = async (name: string, res: Promise<{ status: number }>) => {
      httpDenials[name] = (await res).status;
      assert.ok(httpDenials[name] >= 400 && httpDenials[name] < 500, `${name} was not refused: ${httpDenials[name]}`);
    };
    const recordBody = { p_game_id: GAME, p_claim_id: capture.claimId, p_verdict: "rejected", p_reason: "token_invalid", p_raw_sha256: null,
      p_canonical_sha256: null, p_tsa_token_sha256: null, p_statement_sha256: null, p_input_cutoff: real.input_cutoff, p_release: label };
    for (const who of ["service_role", "anon", "authenticated"] as const) {
      await deny(`${who}: RPC forge_witness_api.record_v1`, raw(tokens[who], "POST", "/rpc/record_v1", "forge_witness_api", recordBody));
      await deny(`${who}: RPC forge_witness_api.evidence_v1`, raw(tokens[who], "POST", "/rpc/evidence_v1", "forge_witness_api", { p_game_id: GAME }));
      await deny(`${who}: RPC forge_witness_api.pending_v1`, raw(tokens[who], "POST", "/rpc/pending_v1", "forge_witness_api", {}));
      await deny(`${who}: Accept-Profile forge_witness`, raw(tokens[who], "GET", "/verdicts?limit=1", "forge_witness"));
      await deny(`${who}: Content-Profile forge_witness (insert)`, raw(tokens[who], "POST", "/verdicts", "forge_witness", { claim_id: randomUUID() }));
    }
    await deny("no token: RPC pending_v1", raw(null, "POST", "/rpc/pending_v1", "forge_witness_api", {}));
    const w = tokens.witness;
    await deny("witness: GET public.games", raw(w, "GET", "/games?limit=1", "public"));
    await deny("witness: POST public.games", raw(w, "POST", "/games", "public", { id: 1 }));
    await deny("witness: RPC public.forge_pregame_capture_read_v1", raw(w, "POST", "/rpc/forge_pregame_capture_read_v1", "public", { p_claim_id: capture.claimId }));
    await deny("witness: RPC public.forge_pregame_capture_record_outcome_v1", raw(w, "POST", "/rpc/forge_pregame_capture_record_outcome_v1", "public",
      { p_game_id: 1, p_policy_id: "pregame-native-v1", p_claim_id: null, p_outcome: "never_dispatched", p_metadata: {} }));
    for (const schema of ["forge_witness", "forge_pregame_capture", "pgsodium", "vault"]) await deny(`witness: Accept-Profile ${schema}`, raw(w, "GET", "/verdicts?limit=1", schema));
    await deny("witness: record for an unarmed game", raw(w, "POST", "/rpc/record_v1", "forge_witness_api", { ...recordBody, p_game_id: 1 }));
    await deny("witness: malformed verdict", raw(w, "POST", "/rpc/record_v1", "forge_witness_api", { ...recordBody, p_verdict: "maybe" }));
    const positive = await raw(w, "POST", "/rpc/pending_v1", "forge_witness_api", {});
    assert.equal(positive.status, 200);

    console.log(JSON.stringify({
      writer: { claimId: capture.claimId, outcome: capture.outcome, captureMs, tsaCalls, traffic: traffic.writer },
      verifier: { firstGet: { httpStatus: first.status, wallMs: first.wallMs, elapsedMs: first.body.elapsedMs }, matrix, realVerdict,
        secondGet: { httpStatus: second.status, results: second.body.results }, duplicateRecord: { httpStatus: replay.status, created: false },
        race: raceResults, verdictRowsUnchangedByDuplicates: true, traffic: traffic.verifier, routeErrors },
      databaseRechecks: dbChecks, gates, requireAccepted: { accepted: required.g.accepted, refused }, sqlDenials, httpDenials,
      positiveControl: positive.status }));
  } finally {
    globalThis.fetch = http;
    tsa.close();
    await owner.end();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
