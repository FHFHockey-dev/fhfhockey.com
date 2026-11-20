// Local process only (check_signed.py), against a restore of the production schema WITH grants (postgres is a
// non-superuser with CREATEROLE/BYPASSRLS; service_role may EXECUTE public.execute_sql). It runs the committed Edge
// bundle (core.bundle.js) through PostgREST as service_role with a fixture NHL schedule and the fixture TSA, then acts
// as the writer (postgres, and service_role via execute_sql) to forge, alter, replay and delete verdicts and change
// custody, and shows the release-side gate and the offline audit refuse every one while the untouched verdict passes.
import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID, sign as nodeSign } from "node:crypto";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import { bindingFor, syntheticPacket, syntheticWitness } from "lib/projections/pregameCapture/__fixtures__/witnessCustody";
import { testTsaTrust } from "lib/projections/pregameCapture/__fixtures__/testTsa";
import { canonicalJson } from "lib/projections/pregameCapture/packet";
import { formatMicros, parseInstantMicros } from "lib/projections/pregameCapture/time";
import { checkSignedVerdict, witnessKeyId, type SignedVerdictPayload } from "lib/projections/pregameCapture/signedVerdict";
import { auditSignedVerdicts, type ExportedVerdict } from "./audit-signed-verdicts";

const importEsm = new Function("url", "return import(url)") as (url: string) => Promise<any>;
const LABEL = "f".repeat(40);

async function main() {
  const rest = process.env.FORGE_REST_URL!;
  const tokens = JSON.parse(process.env.FORGE_TEST_TOKENS!) as Record<"anon" | "service_role", string>;
  const owner = new Client(JSON.parse(process.env.FORGE_OWNER_DSN!));   // supabase_admin: test setup only
  await owner.connect();
  const q = async (sql: string, args: unknown[] = []) => (await owner.query(sql, args)).rows;
  const one = async (sql: string, args: unknown[] = []) => (await q(sql, args))[0];
  /** Runs statements as a role in one committed transaction; returns "ok" or the SQLSTATE and message. */
  const asRole = async (role: string, sql: string, args: unknown[] = []) => {
    await q("begin");
    try {
      await q(`set local role ${role}`);
      const rows = args.length ? await q(sql, args) : (await owner.query(sql) as any).rows ?? [];
      await q("commit");
      return { ok: true as const, rows };
    } catch (e: any) {
      await q("rollback");
      return { ok: false as const, error: `${e.code} ${String(e.message).slice(0, 90)}` };
    }
  };

  // The witness key (would be the Edge secret) and an attacker's key.
  const real = generateKeyPairSync("ed25519"), attacker = generateKeyPairSync("ed25519");
  const pkcs8 = real.privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
  const x = real.publicKey.export({ format: "jwk" }).x!, attackerX = attacker.publicKey.export({ format: "jwk" }).x!;
  const PINNED = { [witnessKeyId(x)]: x };   // what witnessSigningKeys.ts would hold after the operator pins it

  // Synthetic committed custody, one claim per game, inserted as the platform owner (setup, not an attack).
  const now = parseInstantMicros(String((await one("select to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') t")).t));
  const iso = (ms: number) => formatMicros(now + BigInt(ms) * BigInt(1000));
  const NORMAL = 120 * 60_000, PAST_DEADLINE = 59.5 * 60_000;
  let next = 2099040001;
  type Seeded = { game: number; claimId: string; start: string; raw: string; canonical: string; tokenSha: string };
  const games: Record<string, Seeded> = {};
  async function seed(name: string, startMs: number, opts: { flipToken?: boolean; arm?: boolean } = {}) {
    const game = next++, claimId = randomUUID(), start = iso(startMs), cutoff = iso(-300_000), inserted = iso(-298_000), read = iso(-297_500);
    await q(`insert into forge_pregame_capture.claims (id, game_id, policy_id, slate_date, home_team_id, away_team_id, calendar_revision,
      scheduled_start, input_cutoff, ack_deadline, required_ms, code_version, claimed_at)
      values ($1, $2, 'pregame-native-v1', $3, 1, 2, $4, $5, $6, $5::timestamptz - interval '60 minutes', 240000, $7, $6)`,
      [claimId, game, start.slice(0, 10), "c".repeat(64), start, cutoff, LABEL]);
    const packet = syntheticPacket(bindingFor({ gameId: game, claimId, scheduledStart: start, inputCutoff: cutoff, codeVersion: LABEL }));
    const row = await one(`insert into forge_pregame_capture.artifacts (claim_id, packet, raw_sha256, canonical_sha256, byte_length, inserted_at)
      values ($1, $2, $3, $4, $5, $6) returning xmin::text v`, [claimId, packet.bytes, packet.rawSha256, packet.canonicalSha256, packet.bytes.length, inserted]);
    const w = syntheticWitness({ claimId, gameId: game, rawSha256: packet.rawSha256, canonicalSha256: packet.canonicalSha256,
      byteLength: packet.bytes.length, rowVersion: row.v, calendarRevision: "c".repeat(64), scheduledStart: start, dbReadAt: read,
      genTimeMicros: now - BigInt(296_500_000) });
    const token = Buffer.from(w.token);
    if (opts.flipToken) token[400] ^= 0x01;
    const stored = await one(`insert into forge_pregame_capture.witnesses (claim_id, statement_text, statement, statement_sha256, tsa_token, tsa_gen_time,
      tsa_accuracy_us, tsa_resolution_us, tsa_accuracy_source, tsa_signer_sha256, ack_upper, db_read_at, final_read_at, verdict, verdict_reason)
      values ($1, $2::text, $2::text::jsonb, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'qualified', null) returning tsa_token_sha256`,
      [claimId, w.statementText, w.statementSha256, token, w.genTime, w.accuracyUs, w.resolutionUs, w.accuracySource, w.signerSha256,
        w.ackUpper, read, iso(-296_000)]);
    await q("insert into forge_pregame_capture.outcomes (game_id, policy_id, claim_id, outcome) values ($1, 'pregame-native-v1', $2, 'qualified')", [game, claimId]);
    if (opts.arm !== false) await q("insert into forge_witness.targets (game_id) values ($1)", [game]);
    games[name] = { game, claimId, start, raw: packet.rawSha256, canonical: packet.canonicalSha256, tokenSha: stored.tsa_token_sha256 };
    return games[name];
  }
  await seed("good", NORMAL);
  await seed("tamperedToken", NORMAL, { flipToken: true });
  await seed("officialStartDiffers", NORMAL);
  await seed("officialUnavailable", NORMAL);
  await seed("verifiedLate", PAST_DEADLINE);
  await seed("goodToBeAltered", NORMAL);
  await seed("untouched", NORMAL);
  await seed("forgeTarget", NORMAL, { arm: false });
  await seed("forgeTargetViaExecuteSql", NORMAL, { arm: false });

  // The fixture NHL schedule: official start equals the claim's, except for two games.
  const landing = (s: Seeded, start = s.start) => ({ id: s.game, startTimeUTC: start, gameDate: s.start.slice(0, 10), gameState: "FUT",
    gameScheduleState: "OK", homeTeam: { id: 1, abbrev: "NJD" }, awayTeam: { id: 2, abbrev: "NYI" } });
  const official = new Map<number, unknown>(Object.values(games).map(s => [s.game, landing(s)]));
  official.set(games.officialStartDiffers.game, landing(games.officialStartDiffers, iso(NORMAL + 15 * 60_000)));
  official.delete(games.officialUnavailable.game);

  const traffic: Record<string, number> = {};
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.origin === "https://api-web.nhle.com") {
      const id = Number(url.pathname.split("/")[3]);
      traffic["nhl"] = (traffic["nhl"] ?? 0) + 1;
      return official.has(id) ? Response.json(official.get(id)) : new Response("unavailable", { status: 503 });
    }
    assert.equal(url.origin, new URL(rest).origin, `unexpected request ${url.origin}`);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("authorization"), `Bearer ${tokens.service_role}`);
    const key = `service_role@${headers.get("content-profile")}`;
    traffic[key] = (traffic[key] ?? 0) + 1;
    url.pathname = url.pathname.replace(/^\/rest\/v1/, "");
    return fetch(url, init);
  }) as typeof fetch;
  const edge = await importEsm(pathToFileURL(process.env.FORGE_EDGE_BUNDLE!).href);
  const env: Record<string, string> = { SUPABASE_URL: rest, SUPABASE_SERVICE_ROLE_KEY: tokens.service_role, FORGE_WITNESS_SIGNING_KEY: pkcs8 };
  const invoke = async () => {
    const response: Response = await edge.handleWitnessEdgeRequest(new Request("https://edge.local/forge-witness-verify", { method: "POST" }),
      (name: string) => env[name], { fetch: fetchImpl, trust: testTsaTrust() });
    return { status: response.status, body: await response.json() };
  };
  const rowCount = async () => Number((await one("select count(*) n from forge_witness.signed_verdicts")).n);

  try {
    // 1. The witness: the committed bundle, as the Edge Function runs it.
    const first = await invoke();
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.deepEqual(first.body.selfTest, { tsa: true, packet: true, signature: true });
    assert.ok(!JSON.stringify(first.body).includes(pkcs8.slice(20, 60)));
    const by = new Map<number, any>((first.body.results as any[]).map(r => [r.gameId, r]));
    const got = (n: string) => { const r = by.get(games[n].game); return r?.status === "recorded" ? `${r.verdict}${r.reason ? ":" + r.reason : ""}` : r?.status; };
    const witnessResults = Object.fromEntries(["good", "tamperedToken", "officialStartDiffers", "officialUnavailable", "verifiedLate",
      "goodToBeAltered", "untouched"].map(n => [n, got(n)]));
    assert.deepEqual(witnessResults, { good: "accepted", tamperedToken: "rejected:token_invalid", officialStartDiffers: "rejected:schedule_changed",
      officialUnavailable: "official_unavailable", verifiedLate: "rejected:verification_late", goodToBeAltered: "accepted", untouched: "accepted" });
    assert.equal(first.body.keyId, witnessKeyId(x));
    const rowsAfterFirst = await rowCount();
    const second = await invoke();
    assert.equal(await rowCount(), rowsAfterFirst, "a second run created a verdict");
    assert.ok((second.body.results as any[]).every((r: any) => r.status === "official_unavailable"), JSON.stringify(second.body));

    // 2. The release-side gate reads through service_role and verifies with the pinned key only.
    // The gate's read is the Data API path the publish route and readers use (supabase-js, schema forge_witness_api).
    const signedRow = async (claimId: string) => {
      const response = await fetch(`${rest}/rpc/signed_verdict_v1`, { method: "POST", body: JSON.stringify({ p_claim_id: claimId }),
        headers: { apikey: tokens.anon, authorization: `Bearer ${tokens.service_role}`, "content-type": "application/json",
          "content-profile": "forge_witness_api" } });
      assert.equal(response.status, 200, await response.clone().text());
      return (await response.json()) as { payload: string; signature: string } | null;
    };
    const anonRead = await fetch(`${rest}/rpc/signed_verdict_v1`, { method: "POST", body: JSON.stringify({ p_claim_id: games.good.claimId }),
      headers: { apikey: tokens.anon, authorization: `Bearer ${tokens.anon}`, "content-type": "application/json", "content-profile": "forge_witness_api" } });
    assert.ok(anonRead.status >= 400 && anonRead.status < 500, `anon read ${anonRead.status}`);
    const custodyNow = async (s: Seeded) => {
      const c = await one(`select a.raw_sha256, a.canonical_sha256, w.tsa_token_sha256 from forge_pregame_capture.artifacts a
        join forge_pregame_capture.witnesses w using (claim_id) where a.claim_id = $1`, [s.claimId]);
      return { claimId: s.claimId, gameId: s.game, rawSha256: c.raw_sha256, canonicalSha256: c.canonical_sha256, tsaTokenSha256: c.tsa_token_sha256 };
    };
    const gate = async (name: string) => checkSignedVerdict(await signedRow(games[name].claimId), await custodyNow(games[name]), PINNED);
    const gatesBefore: Record<string, unknown> = {};
    for (const n of ["good", "tamperedToken", "officialStartDiffers", "officialUnavailable", "verifiedLate", "goodToBeAltered", "untouched"]) {
      const g = await gate(n);
      gatesBefore[n] = g.accepted ? "accepted" : g.reason;
    }
    assert.deepEqual(gatesBefore, { good: "accepted", tamperedToken: "verdict_rejected", officialStartDiffers: "verdict_rejected",
      officialUnavailable: "verdict_missing", verifiedLate: "verdict_rejected", goodToBeAltered: "accepted", untouched: "accepted" });

    // 3. The writer. Plain service_role cannot write the table; postgres (CREATEROLE) and service_role through
    //    public.execute_sql (a postgres-owned definer) can do anything at the database level. Each succeeds; each is caught.
    const genuineGood = (await signedRow(games.good.claimId))!;
    const genuinePayload = JSON.parse(genuineGood.payload) as SignedVerdictPayload;
    const forge = (s: Seeded, key: typeof attacker.privateKey, keyId: string) => {
      const payload = canonicalJson({ ...genuinePayload, keyId, claimId: s.claimId, gameId: s.game, rawSha256: s.raw, canonicalSha256: s.canonical,
        tsaTokenSha256: s.tokenSha, officialStart: s.start, deadline: formatMicros(parseInstantMicros(s.start) - BigInt(3_600_000_000)) });
      return { payload, signature: nodeSign(null, Buffer.from(payload) as unknown as Uint8Array, key).toString("base64"), keyId };
    };
    const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
    const attacks: Record<string, unknown> = {};
    attacks.plainServiceRoleInsert = await asRole("service_role", `insert into forge_witness.signed_verdicts (claim_id, game_id, payload, signature, key_id)
      values ('${games.forgeTarget.claimId}', ${games.forgeTarget.game}, '{}', '${"A".repeat(86)}==', '0000000000000000')`);
    assert.equal((attacks.plainServiceRoleInsert as any).ok, false);
    const asPostgres = (sql: string) => asRole("postgres", `grant forge_witness_owner to postgres; ${sql}`);
    const f1 = forge(games.forgeTarget, attacker.privateKey, witnessKeyId(x));   // pinned key id, attacker's signature
    attacks.postgresForgesVerdict = await asPostgres(`insert into forge_witness.signed_verdicts (claim_id, game_id, payload, signature, key_id)
      values (${lit(games.forgeTarget.claimId)}, ${games.forgeTarget.game}, ${lit(f1.payload)}, ${lit(f1.signature)}, ${lit(f1.keyId)})`);
    attacks.postgresAltersRejectedToAccepted = await asPostgres(`alter table forge_witness.signed_verdicts disable trigger signed_verdicts_immutable;
      update forge_witness.signed_verdicts set payload = replace(replace(payload, '"reason":"verification_late"', '"reason":null'), '"verdict":"rejected"', '"verdict":"accepted"')
        where claim_id = ${lit(games.verifiedLate.claimId)};
      alter table forge_witness.signed_verdicts enable always trigger signed_verdicts_immutable`);
    attacks.postgresReplaysGenuineVerdict = await asPostgres(`alter table forge_witness.signed_verdicts disable trigger signed_verdicts_immutable;
      update forge_witness.signed_verdicts set payload = ${lit(genuineGood.payload)}, signature = ${lit(genuineGood.signature)}
        where claim_id = ${lit(games.tamperedToken.claimId)};
      alter table forge_witness.signed_verdicts enable always trigger signed_verdicts_immutable`);
    attacks.postgresDeletesGenuineVerdict = await asPostgres(`alter table forge_witness.signed_verdicts disable trigger signed_verdicts_immutable;
      delete from forge_witness.signed_verdicts where claim_id = ${lit(games.good.claimId)};
      alter table forge_witness.signed_verdicts enable always trigger signed_verdicts_immutable`);
    // Through execute_sql as service_role: swap the committed packet under a genuine accepted verdict, and forge another.
    const swap = syntheticPacket(bindingFor({ gameId: games.goodToBeAltered.game, claimId: games.goodToBeAltered.claimId,
      scheduledStart: games.goodToBeAltered.start, inputCutoff: iso(-300_000), codeVersion: LABEL }), p => { p.candidates.skaters = [8470000]; });
    attacks.executeSqlSwapsCustodyBytes = await asRole("service_role", "select public.execute_sql($1)", [`
      alter table forge_pregame_capture.artifacts disable trigger artifacts_immutable;
      update forge_pregame_capture.artifacts set packet = decode('${swap.bytes.toString("hex")}', 'hex'), raw_sha256 = '${swap.rawSha256}',
        canonical_sha256 = '${swap.canonicalSha256}', byte_length = ${swap.bytes.length} where claim_id = '${games.goodToBeAltered.claimId}';
      alter table forge_pregame_capture.artifacts enable always trigger artifacts_immutable`]);
    const f2 = forge(games.forgeTargetViaExecuteSql, attacker.privateKey, witnessKeyId(attackerX));   // attacker's own key id
    attacks.executeSqlForgesVerdict = await asRole("service_role", "select public.execute_sql($1)", [`
      grant forge_witness_owner to postgres;
      insert into forge_witness.signed_verdicts (claim_id, game_id, payload, signature, key_id) values (${lit(games.forgeTargetViaExecuteSql.claimId)},
        ${games.forgeTargetViaExecuteSql.game}, ${lit(f2.payload)}, ${lit(f2.signature)}, ${lit(f2.keyId)})`]);
    for (const name of ["postgresForgesVerdict", "postgresAltersRejectedToAccepted", "postgresReplaysGenuineVerdict", "postgresDeletesGenuineVerdict",
      "executeSqlSwapsCustodyBytes", "executeSqlForgesVerdict"]) {
      assert.ok((attacks[name] as any).ok, `${name} did not even succeed at the database level: ${JSON.stringify(attacks[name])}`);
    }

    // 4. After the attacks: the gate (release code, pinned key) refuses every touched claim; the untouched one still passes.
    const gatesAfter: Record<string, unknown> = {};
    for (const n of ["forgeTarget", "verifiedLate", "tamperedToken", "good", "goodToBeAltered", "forgeTargetViaExecuteSql", "untouched"]) {
      const g = await gate(n);
      gatesAfter[n] = g.accepted ? "accepted" : g.reason;
    }
    assert.deepEqual(gatesAfter, { forgeTarget: "signature_invalid", verifiedLate: "signature_invalid", tamperedToken: "binding_mismatch",
      good: "verdict_missing", goodToBeAltered: "binding_mismatch", forgeTargetViaExecuteSql: "key_unpinned", untouched: "accepted" });

    // 5. Offline acceptance audit on a read-only export (as postgres), with the pinned key; and with the release default
    //    (nothing pinned yet), where everything fails closed.
    const exported = spawnSync(process.env.FORGE_PSQL!, ["-X", "-At", "-h", process.env.FORGE_PGHOST!, "-p", process.env.FORGE_PGPORT!, "-U", "postgres",
      "-v", `games=${Object.values(games).map(s => s.game).join(",")}`, "-f", join(__dirname, "export-signed-verdicts.sql"), "postgres"], { encoding: "utf8" });
    assert.equal(exported.status, 0, exported.stderr);
    const records = JSON.parse(exported.stdout.trim().split("\n").pop()!) as ExportedVerdict[];
    const audit = auditSignedVerdicts(records, PINNED);
    const auditByName = Object.fromEntries(Object.entries(games).map(([n, s]) => [n, (r => (r.pass ? "pass" : r.reason))(audit.find(r => r.gameId === s.game)!)]));
    assert.deepEqual(auditByName, { good: "verdict_missing", tamperedToken: "binding_mismatch", officialStartDiffers: "verdict_rejected",
      officialUnavailable: "verdict_missing", verifiedLate: "signature_invalid", goodToBeAltered: "binding_mismatch", untouched: "pass",
      forgeTarget: "signature_invalid", forgeTargetViaExecuteSql: "key_unpinned" });
    const exportFile = join(process.env.FORGE_WORKDIR!, "signed-verdicts.json");
    writeFileSync(exportFile, JSON.stringify(records));
    const cli = spawnSync(process.execPath, ["-r", "ts-node/register/transpile-only", join(__dirname, "audit-signed-verdicts.ts"), exportFile],
      { encoding: "utf8", env: process.env });
    const cliOut = JSON.parse(cli.stdout);
    assert.ok(cli.status === 2 && cliOut.pinnedKeys.length === 0 && cliOut.results.every((r: any) => !r.pass), cli.stdout.slice(0, 500));

    // 6. The private key is nowhere in the database.
    const leak = await one(`select (select count(*) from forge_witness.signed_verdicts where payload like $1 or signature like $1)
      + (select count(*) from pg_proc where prosrc like $1) n`, [`%${pkcs8.slice(20, 60)}%`]);
    assert.equal(Number(leak.n), 0);

    console.log(JSON.stringify({ games: Object.fromEntries(Object.entries(games).map(([n, s]) => [n, s.game])), gateReadPath: "PostgREST /rpc/signed_verdict_v1 as service_role (anon refused)",
      selfTest: first.body.selfTest, keyId: witnessKeyId(x), release: first.body.release, witnessResults, secondRun: second.body.results,
      traffic, gatesBefore, attacks, gatesAfter, audit: auditByName, auditCliWithReleaseDefault: { exit: cli.status, pinnedKeys: cliOut.pinnedKeys,
        reasons: [...new Set(cliOut.results.map((r: any) => r.reason))] }, privateKeyInDatabase: false }));
  } finally {
    await owner.end();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
