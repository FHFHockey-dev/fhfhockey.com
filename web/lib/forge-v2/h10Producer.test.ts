// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { Pool } from "pg";
import { buildDenominator, FrozenDenominator, reconcileDenominators } from "./denominator";
import { contentHash } from "./hash.server";
import { PostgresHistoryStore, SqlConnection } from "./history.server";
import { DET, H10_SEASON, LARKIN, DACH, MONTEMBEAULT, MTL, syntheticLeague, syntheticTrade } from "./h10Fixtures";
import { h10QueueId, h10Scopes, H10_BOUNDS, readbackH10, runH10Issuance, H10RunInput } from "./h10Producer.server";
import { capturePreparedLedger, preparedLedgerRecords } from "./pipeline.server";
import { H10Ledger, H10_BATCH_ROWS } from "./h10Batch.server";
import { targetKey } from "./identity";
import { createRefreshState, enqueueRefresh, planScheduledRefresh } from "./refresh";
import { advanceLock, observeHorizonEpisodes } from "./schedule";

const exec = promisify(execFile);
const bin = process.env.FORGE_V2_POSTGRES_BIN;
const migration = resolve(__dirname, "../../..", "supabase/migrations/20261029235656_forge_v2_immutable_history.sql");
const MIN = 60000;

describe.runIf(Boolean(bin))("FORGE H1–H10 producer on disposable PostgreSQL (synthetic fixture evidence)", () => {
  let root: string, socket: string, admin: Pool, db: Pool, started = false;
  const environment: NodeJS.ProcessEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PG"))), NODE_ENV: "test" };
  const T = Math.floor(Date.now() / 1000) * 1000, iso = (ms: number) => new Date(ms).toISOString();
  const c1 = iso(T - 9 * MIN), tradeAt = iso(T - 8 * MIN), tradeReceived = iso(T - 7 * MIN), c2 = iso(T - 6 * MIN);
  const league = syntheticLeague({ anchor: T, teams: 6 });
  const trade = syntheticTrade(tradeAt, tradeReceived);
  let first: FrozenDenominator, second: FrozenDenominator;
  const count = async (table: string) => (await db.query(`select count(*)::int as n from forge_v2_private.${table}`)).rows[0].n as number;
  const counts = async () => ({ vintages: await count("forge_v2_vintages"), receipts: await count("forge_v2_publication_receipts"), records: await count("forge_v2_records"), queues: await count("forge_v2_work_queue") });
  const run = (denominator: FrozenDenominator, extra: Partial<H10RunInput> = {}) => runH10Issuance({
    db: db as SqlConnection, store: new PostgresHistoryStore(db as SqlConnection), artifacts: { put: async () => { throw new Error("no_artifact_writes_expected"); } },
    denominator, schedule: league.schedule, logs: league.logs, clock: () => new Date().toISOString(), trigger: "daily",
    config: { evidenceClass: "fixture", approvalEvidenceId: "fixture-h10-local-proof", approvedAt: iso(T - 60 * MIN), codeVersion: "local-test", maximumTrainingExamples: 1500 }, ...extra });

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "forge-h10-pg-")); socket = join(root, "socket");
    await mkdir(socket, { mode: 0o700 });
    await exec(join(bin!, "initdb"), ["-D", join(root, "data"), "--no-locale", "--encoding=UTF8", "--auth-local=trust", "--auth-host=reject", "-U", "forge_v2_fixture"], { env: environment });
    await exec(join(bin!, "pg_ctl"), ["-D", join(root, "data"), "-l", join(root, "server.log"), "-w", "-t", "10", "-o", `-c listen_addresses='' -c unix_socket_directories='${socket}' -p 65443`, "start"], { env: environment });
    started = true;
    admin = new Pool({ host: socket, port: 65443, user: "forge_v2_fixture", database: "postgres", max: 2 });
    await admin.query("create role anon; create role authenticated; create role service_role login");
    await admin.query(await readFile(migration, "utf8"));
    db = new Pool({ host: socket, port: 65443, user: "service_role", database: "postgres", max: 3 });
    first = buildDenominator({ evidence: league.evidence, schedule: league.schedule, asOf: c1, seasonId: H10_SEASON, scheduleComplete: true, evidenceClass: "fixture" });
    second = buildDenominator({ evidence: [...league.evidence, ...trade], schedule: league.schedule, asOf: c2, seasonId: H10_SEASON, scheduleComplete: true, evidenceClass: "fixture" });
  }, 30000);
  afterAll(async () => {
    await db?.end(); await admin?.end();
    if (started) await exec(join(bin!, "pg_ctl"), ["-D", join(root, "data"), "-w", "-t", "10", "stop", "-m", "fast"], { env: environment });
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("issues every skater key for all ten horizons after an interrupted first pass; goalies are gaps, not rows", async () => {
    const skaterKeys = first.keys.filter(k => k.playerClass === "skater"), goalieKeys = first.keys.filter(k => k.playerClass === "goalie");
    expect(first.counts).toMatchObject({ players: 150, keys: 1500, shortfallPlayers: 0, unresolved: 0 });
    const partial = await run(first, { maximumQueues: 7 });
    expect(partial.complete).toBe(false);
    expect(partial.queues).toMatchObject({ total: 60, processed: 7, complete: 7 });
    const resumed = await run(first);
    expect(resumed.complete).toBe(true);
    expect(resumed.ledger).toEqual({ episodeRecords: 0, lockRecords: 0 }); // captured once, by the first pass
    expect(resumed.gaps).toEqual([]);
    expect(resumed.goalieKeys).toBe(goalieKeys.length); // issued by the goalie phase, not here
    const back = await readbackH10(db as SqlConnection, first);
    expect(back).toMatchObject({ vintages: skaterKeys.length, latestTargets: skaterKeys.length, receiptMismatches: 0, skaterPlayers: 138 });
    expect(back.spread.players).toBe(138);
    expect(back.spread.distinctForecastsPerPlayer[1]).toBeUndefined(); // no player gets one forecast for all ten games
    expect(back.coverage).toMatchObject({ expected: 1500, numeric: skaterKeys.length, nonNumeric: 0, missing: goalieKeys.length, playersWithAllTen: 138, stray: [] });
    expect(back.coverage.byHorizon.map(h => [h.horizon, h.numeric, h.expected])).toEqual(Array.from({ length: 10 }, (_, i) => [i + 1, 138, 150]));
  }, 240000);

  it("refuses an empty lines read without writing anything", async () => {
    const empty = buildDenominator({ evidence: league.evidence, schedule: league.schedule, asOf: iso(T - 10 * MIN), seasonId: H10_SEASON, scheduleComplete: true, evidenceClass: "fixture" });
    const before = await counts();
    const refused = await run(empty, { logs: [] });
    expect(refused).toMatchObject({ refused: "training_below_minimum_support", complete: false });
    expect(refused.gaps).toHaveLength(1380);
    expect(await counts()).toEqual(before);
  });

  it("dedupes a rerun of the same cutoff (0 new vintages, receipts or records) and keeps rows immutable", async () => {
    const before = await counts();
    const again = await run(first);
    expect(again.complete).toBe(true);
    expect(await counts()).toEqual(before);
    await expect(db.query("update forge_v2_private.forge_v2_vintages set payload='{}'")).rejects.toThrow(/permission denied/);
    await expect(admin.query("delete from forge_v2_private.forge_v2_vintages")).rejects.toThrow(/IMMUTABLE/);
    await expect(admin.query("update forge_v2_private.forge_v2_records set payload='{}'")).rejects.toThrow(/IMMUTABLE/);
  }, 240000);

  it("issues the trade as a material revision: Larkin's future keys follow MTL; Detroit history is byte-identical", async () => {
    const stored = async (playerId: number) => (await db.query("select id, payload, output_hash from forge_v2_private.forge_v2_vintages where player_id=$1 order by id", [playerId])).rows;
    const larkinBefore = await stored(LARKIN), teammate = first.keys.find(k => k.teamId === DET && k.playerClass === "skater" && k.playerId !== LARKIN && k.playerId !== DACH)!;
    const teammateBefore = (await db.query("select id, payload from forge_v2_private.forge_v2_vintages where player_id=$1 and game_id=$2", [teammate.playerId, teammate.gameId])).rows;
    expect(larkinBefore).toHaveLength(10);
    expect(larkinBefore.every(row => JSON.parse(row.payload).teamId === DET)).toBe(true);
    const delta = reconcileDenominators(first, second);
    expect(delta.closed.filter(k => k.playerId === LARKIN)).toHaveLength(10);
    const event = { id: `trade:${tradeAt}`, kind: "affiliation" as const, receivedAt: tradeReceived, acceptedAt: c2, payloadHash: contentHash(trade), affected: { teamIds: [DET, MTL] } };
    const previousKeys = first.keys.map(k => `${k.playerId}:${k.gameId}:${k.seasonId}:nhl-official-skater-appearance-v1:official_appearance_given_game_occurs`);
    const material = await run(second, { trigger: { material: [event] }, previousKeys });
    expect(material.complete).toBe(true);
    // Larkin's Detroit vintages are untouched; his ten Montréal keys are new vintages naming the second denominator.
    const larkinAfter = await stored(LARKIN);
    expect(larkinAfter.filter(row => larkinBefore.some(old => old.id === row.id))).toEqual(larkinBefore);
    const montreal = larkinAfter.filter(row => JSON.parse(row.payload).teamId === MTL).map(row => JSON.parse(row.payload));
    expect(montreal.map(v => v.horizon).sort((a: number, b: number) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(montreal.every(v => v.trigger === "material" && v.sourceManifest.some((s: { id: string }) => s.id === `forge-h10-denominator:${second.denominatorSha256}`))).toBe(true);
    // A new target has no predecessor; a game Larkin already had as a Detroit key (DET vs MTL) is revised in place of
    // the same player/game target, naming the Detroit vintage, whose bytes stay unchanged.
    for (const v of montreal) {
      const prior = larkinBefore.find(row => JSON.parse(row.payload).gameId === v.gameId);
      expect(v.predecessorId).toBe(prior ? prior.id : null);
    }
    expect(montreal.filter(v => v.predecessorId !== null).length).toBeGreaterThan(0);
    // A Detroit teammate gets a material revision that names his cutoff-1 vintage; that vintage's bytes are unchanged.
    const revisions = (await db.query("select payload from forge_v2_private.forge_v2_vintages where player_id=$1 and game_id=$2 order by issuance_sequence", [teammate.playerId, teammate.gameId])).rows.map(row => JSON.parse(row.payload));
    expect(revisions).toHaveLength(2);
    expect(revisions[1].predecessorId).toBe(revisions[0].id);
    expect(JSON.parse(teammateBefore[0].payload)).toEqual(revisions[0]);
    // Larkin's Detroit horizon episodes are closed at cutoff 2 by appended snapshots, never edited.
    const closed = (await db.query("select payload from forge_v2_private.forge_v2_records where kind='horizon_episode' and scope_key like $1 and predecessor_id is not null", [`${LARKIN}:%`])).rows.map(row => JSON.parse(row.payload));
    // Episodes belong to the player/game target, so games Larkin still has on MTL (DET vs MTL) stay open.
    const stillCurrent = new Set(second.keys.filter(k => k.playerId === LARKIN).map(k => k.gameId));
    const leaving = first.keys.filter(k => k.playerId === LARKIN && !stillCurrent.has(k.gameId)).map(k => k.gameId).sort();
    expect(leaving.length).toBeGreaterThan(0);
    expect(closed.filter(e => e.exitedAt === c2).map(e => e.gameId).sort()).toEqual(leaving);
    // Readback over both cutoffs: full coverage of the new denominator; the traded players' old-team rows are stray.
    const back = await readbackH10(db as SqlConnection, second, [first]);
    expect(back.coverage).toMatchObject({ numeric: second.keys.filter(k => k.playerClass === "skater").length, nonNumeric: 0 });
    expect(new Set(back.coverage.stray.map(row => `${row.playerId}:${row.reason}`))).toEqual(new Set([`${LARKIN}:no_denominator_key`, `${DACH}:no_denominator_key`]));
    expect(back.coverage.stray.every(row => row.playerId !== MONTEMBEAULT)).toBe(true); // goalies were never rows
    // A repeated material event is deduplicated by the queue's event ledger.
    const before = await counts();
    await run(second, { trigger: { material: [event] }, previousKeys });
    expect(await counts()).toEqual(before);
  }, 240000);
});

describe.runIf(Boolean(bin))("FORGE H1–H10 night two: queue rotation and the nightly episode turnover (seeded previous night)", () => {
  let root: string, socket: string, admin: Pool, db: Pool, started = false;
  const environment: NodeJS.ProcessEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PG"))), NODE_ENV: "test" };
  const T = Math.floor(Date.now() / 1000) * 1000, iso = (ms: number) => new Date(ms).toISOString();
  const yesterday = iso(T - 24 * 60 * MIN - 9 * MIN), tonight = iso(T - 9 * MIN);
  const league = syntheticLeague({ anchor: T, teams: 6 });

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "forge-h10-n2-")); socket = join(root, "socket");
    await mkdir(socket, { mode: 0o700 });
    await exec(join(bin!, "initdb"), ["-D", join(root, "data"), "--no-locale", "--encoding=UTF8", "--auth-local=trust", "--auth-host=reject", "-U", "forge_v2_fixture"], { env: environment });
    await exec(join(bin!, "pg_ctl"), ["-D", join(root, "data"), "-l", join(root, "server.log"), "-w", "-t", "10", "-o", `-c listen_addresses='' -c unix_socket_directories='${socket}' -p 65446`, "start"], { env: environment });
    started = true;
    admin = new Pool({ host: socket, port: 65446, user: "forge_v2_fixture", database: "postgres", max: 2 });
    await admin.query("create role anon; create role authenticated; create role service_role login");
    await admin.query(await readFile(migration, "utf8"));
    db = new Pool({ host: socket, port: 65446, user: "service_role", database: "postgres", max: 3 });
  }, 30000);
  afterAll(async () => {
    await db?.end(); await admin?.end();
    if (started) await exec(join(bin!, "pg_ctl"), ["-D", join(root, "data"), "-w", "-t", "10", "stop", "-m", "fast"], { env: environment });
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("rotates yesterday's terminal queues and closes and reopens every episode whose horizon moved", async () => {
    const store = new PostgresHistoryStore(db as SqlConnection);
    // Yesterday's view: games after yesterday's cutoff had not started yet.
    const scheduleYesterday = league.schedule.map(g => Date.parse(g.scheduledStartAt!) > Date.parse(yesterday) ? { ...g, status: "scheduled" as const, actualStartAt: null } : g);
    const before = buildDenominator({ evidence: league.evidence, schedule: scheduleYesterday, asOf: yesterday, seasonId: H10_SEASON, scheduleComplete: true, evidenceClass: "fixture" });
    const { scopes } = h10Scopes(before, new Map(scheduleYesterday.map(g => [g.gameId, g])));
    const episodes = observeHorizonEpisodes([], scopes, yesterday);
    for (let i = 0; i < episodes.length; i += 200) await capturePreparedLedger({ store, opportunities: [], episodes: episodes.slice(i, i + 200).map(value => ({ value, predecessor: null })), locks: [], events: [] });
    const locks = [...new Set(scopes.map(s => s.gameId))].map(id => advanceLock(null, scheduleYesterday.find(g => g.gameId === id)!, yesterday).epoch!);
    await capturePreparedLedger({ store, opportunities: [], episodes: [], locks: locks.map(value => ({ value, predecessor: null })), events: [] });
    const queues = new Map<string, typeof scopes>();
    for (const s of scopes) queues.set(h10QueueId(s.teamId, s.horizon), [...(queues.get(h10QueueId(s.teamId, s.horizon)) ?? []), s]);
    for (const [id, qs] of queues) {
      const state = enqueueRefresh(createRefreshState(), planScheduledRefresh(qs, yesterday).filter(p => p.trigger === "daily"), yesterday, H10_BOUNDS);
      for (const job of state.jobs) Object.assign(job, { status: "expired", finishedAt: iso(Date.parse(yesterday) + 60 * MIN), reason: "missing_refresh:fixture_previous_night" });
      await store.saveQueue(id, 0, state);
    }
    const after = buildDenominator({ evidence: league.evidence, schedule: league.schedule, asOf: tonight, seasonId: H10_SEASON, scheduleComplete: true, evidenceClass: "fixture" });
    const previousKeys = before.keys.map(k => `${k.playerId}:${k.gameId}:${k.seasonId}:nhl-official-skater-appearance-v1:official_appearance_given_game_occurs`);
    const report = await runH10Issuance({ db: db as SqlConnection, store, artifacts: { put: async () => { throw new Error("no_artifact_writes_expected"); } },
      denominator: after, schedule: league.schedule, logs: league.logs, clock: () => new Date().toISOString(), trigger: "daily", previousKeys,
      config: { evidenceClass: "fixture", approvalEvidenceId: "fixture-h10-night-two", approvedAt: iso(T - 48 * 60 * MIN), codeVersion: "local-test", maximumTrainingExamples: 1500 } });
    expect(report.complete).toBe(true);
    expect(report.queues).toMatchObject({ total: 60, processed: 60, complete: 60, rotated: 60 });
    // Every skater episode from yesterday closes at tonight's cutoff; every current target opens at its new horizon.
    const closed = (await db.query("select count(*)::int n from forge_v2_private.forge_v2_records where kind='horizon_episode' and payload::jsonb->>'exitedAt' = $1", [tonight])).rows[0].n;
    expect(closed).toBe(episodes.length);
    expect(report.ledger.episodeRecords).toBe(episodes.length + after.keys.filter(k => k.playerClass === "skater").length);
    const yesterdayGames = new Set(before.keys.map(k => k.gameId));
    expect(report.ledger.lockRecords).toBe([...new Set(after.keys.map(k => k.gameId))].filter(id => !yesterdayGames.has(id)).length);
    const back = await readbackH10(db as SqlConnection, after);
    expect(back.coverage).toMatchObject({ numeric: 1380, stray: [] });
  }, 300000);
});

// Throughput candidate (Chef, 2026-11-24): the nightly batched runner (h10Batch.server.ts) must issue what the scalar
// runner issues. Two databases, one frozen night each way: the same vintages byte for byte apart from the wall-clock
// stamps (generation time, claim start), the same issuance sequence order, the same ledger records, every job published.
describe.runIf(Boolean(bin))("FORGE H1–H10 nightly batched issuance matches the scalar runner", () => {
  let root: string, socket: string, admin: Pool, started = false;
  const pools: Pool[] = [];
  const environment: NodeJS.ProcessEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PG"))), NODE_ENV: "test" };
  const T = Math.floor(Date.now() / 1000) * 1000, iso = (ms: number) => new Date(ms).toISOString();
  const league = syntheticLeague({ anchor: T, teams: 6 });
  const denominator = buildDenominator({ evidence: league.evidence, schedule: league.schedule, asOf: iso(T - 9 * MIN), seasonId: H10_SEASON, scheduleComplete: true, evidenceClass: "fixture" });

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "forge-h10-parity-")); socket = join(root, "socket");
    await mkdir(socket, { mode: 0o700 });
    await exec(join(bin!, "initdb"), ["-D", join(root, "data"), "--no-locale", "--encoding=UTF8", "--auth-local=trust", "--auth-host=reject", "-U", "forge_v2_fixture"], { env: environment });
    await exec(join(bin!, "pg_ctl"), ["-D", join(root, "data"), "-l", join(root, "server.log"), "-w", "-t", "10", "-o", `-c listen_addresses='' -c unix_socket_directories='${socket}' -p 65465`, "start"], { env: environment });
    started = true;
    admin = new Pool({ host: socket, port: 65465, user: "forge_v2_fixture", database: "postgres", max: 2 });
    await admin.query("create role anon; create role authenticated; create role service_role login");
    for (const name of ["batched", "scalar", "late_batched", "late_scalar", "injected"]) {
      await admin.query(`create database ${name}`);
      const owner = new Pool({ host: socket, port: 65465, user: "forge_v2_fixture", database: name, max: 1 });
      await owner.query(await readFile(migration, "utf8"));
      await owner.end();
      pools.push(new Pool({ host: socket, port: 65465, user: "service_role", database: name, max: 2 }));
    }
  }, 60000);
  afterAll(async () => {
    for (const pool of pools) await pool.end();
    await admin?.end();
    if (started) await exec(join(bin!, "pg_ctl"), ["-D", join(root, "data"), "-w", "-t", "10", "stop", "-m", "fast"], { env: environment });
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("issues byte-identical vintages and ledger records, in the same sequence order, with fewer statements", async () => {
    const statements: number[] = [];
    for (const [index, scalarQueue] of [[0, false], [1, true]] as const) {
      let n = 0;
      const counted = { query: (text: string, values?: unknown[]) => { n += 1; return pools[index].query(text, values); } } as unknown as SqlConnection;
      const report = await runH10Issuance({ db: counted, store: new PostgresHistoryStore(counted), artifacts: { put: async () => { throw new Error("no_artifact_writes_expected"); } },
        denominator, schedule: league.schedule, logs: league.logs, clock: () => new Date().toISOString(), trigger: "daily", scalarQueue,
        config: { evidenceClass: "fixture", approvalEvidenceId: "fixture-h10-parity", approvedAt: iso(T - 60 * MIN), codeVersion: "local-test", maximumTrainingExamples: 1500 } });
      expect(report).toMatchObject({ complete: true, jobs: { published: 1380 }, gaps: [] });
      statements.push(n);
    }
    const read = async (pool: Pool) => {
      const vintages = (await pool.query("select v.issuance_key, v.payload, v.issuance_sequence::int as sequence, r.output_hash from forge_v2_private.forge_v2_vintages v join forge_v2_private.forge_v2_publication_receipts r on r.vintage_id = v.id order by v.issuance_key")).rows
        .map(row => { const p = JSON.parse(row.payload); delete p.generatedAt; delete p.issuanceAttempt.startedAt; return { key: row.issuance_key, sequence: row.sequence, payload: p }; });
      const records = (await pool.query("select id, kind, scope_key, predecessor_id, content_hash from forge_v2_private.forge_v2_records where kind <> 'history_event' order by id")).rows;
      const queues = (await pool.query("select id, state from forge_v2_private.forge_v2_work_queue order by id")).rows.map(row => [row.id, (row.state.jobs as Array<{ status: string; attempts: number }>).map(j => `${j.status}:${j.attempts}`)]);
      return { vintages, records, queues };
    };
    const [batched, scalar] = [await read(pools[0]), await read(pools[1])];
    expect(batched.vintages).toHaveLength(1380);
    expect(batched.vintages).toEqual(scalar.vintages);
    expect(batched.records.length).toBeGreaterThan(1380 * 2);
    expect(batched.records).toEqual(scalar.records);
    expect(batched.queues).toEqual(scalar.queues);
    // The batched runner needs a small fraction of the scalar statements for the same night.
    expect(statements[0] * 5).toBeLessThan(statements[1]);
  }, 600000);

  const issue = (pool: Pool, extra: Partial<H10RunInput> = {}) => runH10Issuance({ db: pool as unknown as SqlConnection, store: new PostgresHistoryStore(pool as unknown as SqlConnection),
    artifacts: { put: async () => { throw new Error("no_artifact_writes_expected"); } }, denominator, schedule: league.schedule, logs: league.logs, clock: () => new Date().toISOString(), trigger: "daily",
    config: { evidenceClass: "fixture", approvalEvidenceId: "fixture-h10-parity", approvedAt: iso(T - 60 * MIN), codeVersion: "local-test", maximumTrainingExamples: 1500 }, ...extra });

  // Chef review 1: a queue whose jobs are all terminal but not published (here enqueued after every lock) is still
  // claimed, so its missing_refresh events are recorded exactly as the scalar runner records them.
  it("records the lock-passed events of a late call, as the scalar runner does", async () => {
    const late = () => new Date(T + 30 * 86400000).toISOString();
    const reports = [await issue(pools[2], { clock: late }), await issue(pools[3], { clock: late, scalarQueue: true })];
    expect(reports[0].jobs).toEqual({ expired: 1380 });
    expect(reports[0]).toEqual(reports[1]);
    const events = async (pool: Pool) => (await pool.query("select id, scope_key, payload from forge_v2_private.forge_v2_records where kind = 'history_event' order by id")).rows;
    const [batched, scalar] = [await events(pools[2]), await events(pools[3])];
    expect(batched).toHaveLength(1380);
    expect(batched.every(row => JSON.parse(row.payload).reason === "missing_refresh:lock_passed")).toBe(true);
    expect(batched).toEqual(scalar);
  }, 600000);

  // Chef review 2: one record whose ledger write always fails (a missing predecessor, say) fails only its own key; the
  // statement that carried it is retried one record at a time, and its 20-odd queue peers publish.
  it("fails only the key whose ledger record cannot be written; its batch peers publish", async () => {
    const { scopes } = h10Scopes(denominator, new Map(league.schedule.map(game => [game.gameId, game])));
    const target = scopes.find(scope => scope.horizon === 3)!, targetScope = targetKey(target), queueId = h10QueueId(target.teamId, target.horizon);
    let refused = 0;
    const injected = { query: (text: string, values?: unknown[]) => {
      if (/insert into forge_v2_private\.forge_v2_records/.test(text) && Array.isArray(values?.[1])) {
        const kinds = values![1] as string[], scopeKeys = values![2] as string[];
        if (kinds.some((kind, i) => kind === "opportunity" && scopeKeys[i] === targetScope)) { refused += 1; return Promise.reject(new Error("injected_FORGE_V2_PREDECESSOR_MISSING")); }
      }
      return pools[4].query(text, values);
    } } as unknown as SqlConnection;
    const report = await runH10Issuance({ db: injected, store: new PostgresHistoryStore(injected), artifacts: { put: async () => { throw new Error("no_artifact_writes_expected"); } },
      denominator, schedule: league.schedule, logs: league.logs, clock: () => new Date().toISOString(), trigger: "daily",
      config: { evidenceClass: "fixture", approvalEvidenceId: "fixture-h10-parity", approvedAt: iso(T - 60 * MIN), codeVersion: "local-test", maximumTrainingExamples: 1500 } });
    expect(refused).toBe(2); // the batch statement, then the record on its own
    expect(report.jobs).toEqual({ published: 1379, pending: 1 });
    const jobs = (await pools[4].query("select state from forge_v2_private.forge_v2_work_queue where id = $1", [queueId])).rows[0].state.jobs as Array<{ scope: { playerId: number }; status: string; attempts: number; reason: string | null }>;
    const bad = jobs.filter(job => job.scope.playerId === target.playerId), peers = jobs.filter(job => job.scope.playerId !== target.playerId);
    expect(bad).toEqual([expect.objectContaining({ status: "pending", attempts: 1, reason: "failed:injected_FORGE_V2_PREDECESSOR_MISSING" })]);
    expect(peers.length).toBeGreaterThan(15);
    expect(peers.every(job => job.status === "published")).toBe(true);
    expect((await pools[4].query("select count(*)::int n from forge_v2_private.forge_v2_vintages where player_id = $1 and game_id = $2", [target.playerId, target.gameId])).rows[0].n).toBe(0);
  }, 600000);

  // Chef review nit: a ledger pass past its budget still writes its first chunk, so every call makes progress.
  it("writes the first ledger chunk even past the budget, then stops", async () => {
    const { scopes } = h10Scopes(denominator, new Map(league.schedule.map(game => [game.gameId, game])));
    const records = preparedLedgerRecords({ opportunities: scopes.slice(0, 30).map(scope => ({ value: { ...scope, observedAt: iso(T - MIN) }, predecessor: null })), episodes: [], locks: [], events: [] });
    const result = await new H10Ledger(pools[4] as unknown as SqlConnection).capture(records, Date.now() - 1);
    expect(result).toEqual({ errors: new Map(), stopped: true });
    expect((await pools[4].query("select count(*)::int n from forge_v2_private.forge_v2_records where id = any($1::text[])", [records.map(r => r.id)])).rows[0].n).toBe(H10_BATCH_ROWS);
  }, 60000);
});
