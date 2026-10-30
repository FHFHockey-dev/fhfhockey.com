// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chmod, mkdtemp, mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { Pool } from "pg";
import { ArtifactReference, CATEGORIES, CONDITIONING, TARGET_VERSION } from "./contracts";
import { canonicalJson } from "./identity";
import { contentHash, sha256 } from "./hash.server";
import { fixtureVintage, fixtureOpportunity, fixtureSource } from "./fixtures";
import { PostgresHistoryStore, SqlConnection } from "./history.server";
import { FileArtifactStore } from "./artifacts.server";
import { PostgresContextReader, PreparedPlayerContext } from "./api.server";
import { normalizeSourceBatch } from "./data";
import { claimRefreshBatch, createRefreshState, enqueueRefresh, planScheduledRefresh, RefreshBounds, RefreshState } from "./refresh";
import { capturePreparedLedger, reconcilePreparedQueueScopes, runPreparedQueueBatch, PreparedIssuance } from "./pipeline.server";
import { DEFAULT_SCORING, targetKey } from "./identity";
import { available, unavailable } from "./contracts";

const exec = promisify(execFile);
const bin = process.env.FORGE_V2_POSTGRES_BIN;
const migration = resolve(__dirname, "../../..", "supabase/migrations/20261029235656_forge_v2_immutable_history.sql");

describe.runIf(Boolean(bin))("FORGE v2 native PostgreSQL persistence (T3)", () => {
  let root: string, socket: string, admin: Pool, db: Pool, store: PostgresHistoryStore, started = false;
  const environment: NodeJS.ProcessEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PG"))), NODE_ENV: "test" };
  const sample = (n: number) => fixtureVintage({ id: `db-vintage-${n}`, issuanceKey: `db-issuance-${n}`, sequence: n });

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "forge-v2-pg-")); socket = join(root, "socket");
    await mkdir(socket, { mode: 0o700 });
    await exec(join(bin!, "initdb"), ["-D", join(root, "data"), "--no-locale", "--encoding=UTF8", "--auth-local=trust", "--auth-host=reject", "-U", "forge_v2_fixture"], { env: environment });
    await exec(join(bin!, "pg_ctl"), ["-D", join(root, "data"), "-l", join(root, "server.log"), "-w", "-t", "10", "-o", `-c listen_addresses='' -c unix_socket_directories='${socket}' -c forge_v2.fixture=isolated -p 65441`, "start"], { env: environment });
    started = true;
    admin = new Pool({ host: socket, port: 65441, user: "forge_v2_fixture", database: "postgres", max: 2 });
    expect((await admin.query("select current_setting('forge_v2.fixture') as marker")).rows[0].marker).toBe("isolated");
    await admin.query("create role anon; create role authenticated; create role service_role login");
    await admin.query(await readFile(migration, "utf8"));
    db = new Pool({ host: socket, port: 65441, user: "service_role", database: "postgres", max: 3 });
    store = new PostgresHistoryStore(db as SqlConnection);
  }, 20000);
  afterAll(async () => {
    await db?.end(); await admin?.end();
    if (started) await exec(join(bin!, "pg_ctl"), ["-D", join(root, "data"), "-w", "-t", "10", "stop", "-m", "fast"], { env: environment });
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("publishes once under concurrent retries and preserves exact bytes", async () => {
    const results = await Promise.all([store.publish(sample(1)), store.publish(sample(1)), store.publish(sample(1))]);
    expect(results[0]).toEqual(results[1]); expect(results[1]).toEqual(results[2]);
    await expect(store.publish({ ...sample(1), modelVersion: "changed" })).rejects.toThrow(/Idempotency/);
    expect((await db.query("select count(*)::int as n from forge_v2_private.forge_v2_publication_receipts")).rows[0].n).toBe(1);
    await expect(db.query("update forge_v2_private.forge_v2_vintages set payload='{}' where id='db-vintage-1'")).rejects.toThrow(/permission denied/);
    await expect(admin.query("delete from forge_v2_private.forge_v2_vintages where id='db-vintage-1'")).rejects.toThrow(/IMMUTABLE/);
    await expect(admin.query("truncate forge_v2_private.forge_v2_publication_receipts")).rejects.toThrow(/IMMUTABLE/);
    for (const role of ["anon", "authenticated"]) {
      await expect(admin.query(`set role ${role}; select * from forge_v2_private.forge_v2_vintages`)).rejects.toThrow(/permission denied/);
      await admin.query("reset role");
    }
  });

  it("rejects in-transaction proof, waits for committed output, and cannot backdate acknowledgement", async () => {
    const connection = await db.connect(), vintage = sample(2);
    try {
      await connection.query("begin");
      await connection.query("insert into forge_v2_private.forge_v2_vintages(id,issuance_key,issuance_sequence,player_id,game_id,payload) values($1,$2,$3,$4,$5,$6)", [vintage.id, vintage.issuanceKey, vintage.sequence, vintage.playerId, vintage.gameId, canonicalJson(vintage)]);
      expect(await store.get(vintage.id)).toBeNull();
      await expect(connection.query("insert into forge_v2_private.forge_v2_publication_receipts(vintage_id,output_hash,confirmed_at,witness) values($1,$2,'2000-01-01','committed_readback')", [vintage.id, contentHash(vintage)])).rejects.toThrow(/NOT_COMMITTED/);
      await connection.query("rollback");
      await connection.query("begin; savepoint pending_output");
      await connection.query("insert into forge_v2_private.forge_v2_vintages(id,issuance_key,issuance_sequence,player_id,game_id,payload) values($1,$2,$3,$4,$5,$6)", [vintage.id, vintage.issuanceKey, vintage.sequence, vintage.playerId, vintage.gameId, canonicalJson(vintage)]);
      await connection.query("release savepoint pending_output");
      await expect(connection.query("insert into forge_v2_private.forge_v2_publication_receipts(vintage_id,output_hash,confirmed_at,witness) values($1,$2,'2000-01-01','committed_readback')", [vintage.id, contentHash(vintage)])).rejects.toThrow(/NOT_COMMITTED/);
      await connection.query("rollback");
    } finally { connection.release(); }
    const before = Date.now();
    const published = await store.publish(vintage);
    expect(Date.parse(published.receipt.confirmedAt)).toBeGreaterThanOrEqual(before);
    // A lost response does not authorize a different vintage or earlier timestamp.
    const retry = await store.publish(vintage);
    expect(retry.receipt).toEqual(published.receipt);
    expect(Date.parse(retry.receipt.confirmedAt)).toBeGreaterThan(Date.parse(vintage.scheduledStartAt));
  });

  it("pages beyond 3,000 revisions with a fixed snapshot while new publications arrive", async () => {
    const values = Array.from({ length: 3005 }, (_, i) => sample(i + 100));
    await db.query(`insert into forge_v2_private.forge_v2_vintages(id,issuance_key,issuance_sequence,player_id,game_id,payload)
      select v->>'id',v->>'issuanceKey',(v->>'sequence')::bigint,(v->>'playerId')::bigint,(v->>'gameId')::bigint,p from jsonb_array_elements_text($1::jsonb) p cross join lateral (select p::jsonb v) x`, [JSON.stringify(values.map(canonicalJson))]);
    await db.query("insert into forge_v2_private.forge_v2_publication_receipts(vintage_id,output_hash,confirmed_at,witness) select id,output_hash,clock_timestamp(),'committed_readback' from forge_v2_private.forge_v2_vintages where issuance_sequence>=100");
    let page = await store.history(values[0].playerId, values[0].gameId, 200);
    const ids = page.revisions.map(x => x.vintage.id);
    await store.publish(sample(4000));
    while (page.nextCursor) {
      page = await store.history(values[0].playerId, values[0].gameId, 200, page.nextCursor);
      ids.push(...page.revisions.map(x => x.vintage.id));
    }
    expect(ids).toHaveLength(3007); expect(new Set(ids).size).toBe(3007); expect(ids).not.toContain("db-vintage-4000");
    await expect(store.history(1, 2, 201)).rejects.toThrow();
    await expect(store.history(1, 2, 100, "invalid")).rejects.toThrow();
  }, 15000);

  it("keeps a stable transaction snapshot when an earlier receipt commits between pages", async () => {
    const late = { ...sample(5000), playerId: 9900002 };
    await db.query("insert into forge_v2_private.forge_v2_vintages(id,issuance_key,issuance_sequence,player_id,game_id,payload) values($1,$2,$3,$4,$5,$6)", [late.id, late.issuanceKey, late.sequence, late.playerId, late.gameId, canonicalJson(late)]);
    const held = await db.connect();
    try {
      await held.query("begin");
      await held.query("insert into forge_v2_private.forge_v2_publication_receipts(vintage_id,output_hash,confirmed_at,witness) values($1,$2,clock_timestamp(),'committed_readback')", [late.id, contentHash(late)]);
      await store.publish({ ...sample(5001), playerId: late.playerId });
      await store.publish({ ...sample(5002), playerId: late.playerId });
      const first = await store.history(late.playerId, late.gameId, 1);
      expect(first.revisions.map(r => r.vintage.id)).toEqual(["db-vintage-5001"]);
      await held.query("commit");
      const second = await store.history(late.playerId, late.gameId, 1, first.nextCursor!);
      expect(second.revisions.map(r => r.vintage.id)).toEqual(["db-vintage-5002"]);
      expect(second.nextCursor).toBeNull();
      const fresh = await store.history(late.playerId, late.gameId);
      expect(fresh.revisions.map(r => r.vintage.id)).toEqual(["db-vintage-5000", "db-vintage-5001", "db-vintage-5002"]);
    } finally { await held.query("rollback"); held.release(); }
  });

  it("appends observations/corrections separately and fences mutable queue snapshots", async () => {
    await store.appendRecord("outcome-1", "outcome", "player-game", { value: 1 });
    await store.appendRecord("outcome-2", "outcome", "player-game", { value: 2 }, "outcome-1");
    await expect(store.appendRecord("outcome-1", "outcome", "player-game", { value: 9 })).rejects.toThrow(/conflict/);
    expect((await store.records("player-game", "outcome")).map(x => x.payload)).toEqual([{ value: 1 }, { value: 2 }]);
    expect(await store.saveQueue("daily", 0, { pending: [1] })).toBe(1);
    expect(await store.saveQueue("daily", 1, { pending: [2] })).toBe(2);
    await expect(store.saveQueue("daily", 1, { pending: [] })).rejects.toThrow(/conflict/);
    expect(await store.loadQueue("daily")).toEqual({ revision: 2, state: { pending: [2] } });
  });

  it("atomically fences database publication and retains the original receipt on a new attempt", async () => {
    const startedAt = new Date(Date.now() - 1000).toISOString(), leaseUntil = new Date(Date.now() + 60000).toISOString();
    const vintage = sample(6000), claim = { queueId: "claimed", jobId: "job", attempt: 1 };
    vintage.issuanceAttempt = { ...claim, startedAt };
    const job = { id: "job", attempts: 1, status: "running", startedAt, leaseUntil, issuanceKey: vintage.issuanceKey, scope: { playerId: vintage.playerId, gameId: vintage.gameId } };
    // The fixture output must be generated after its actual claim begins.
    vintage.generatedAt = startedAt;
    await expect(store.publish(vintage)).rejects.toThrow(/requires a current claim/);
    await store.saveQueue(claim.queueId, 0, { jobs: [job] });
    const first = await store.publishClaimed(vintage, claim);
    await store.saveQueue(claim.queueId, 1, { jobs: [{ ...job, attempts: 2, startedAt: new Date().toISOString() }] });
    await expect(store.publishClaimed(vintage, claim)).rejects.toThrow(/claim lost/);
    expect(await store.publishClaimed(vintage, { ...claim, attempt: 2 })).toEqual(first);
    await store.saveQueue(claim.queueId, 2, { jobs: [{ ...job, attempts: 2, status: "expired" }] });
    await expect(store.publishClaimed(vintage, { ...claim, attempt: 2 })).rejects.toThrow(/claim lost/);
    expect(await store.get(vintage.id)).toEqual(first);
  });

  it("runs prepared queue issuance through native claims, private files and immutable records", async () => {
    const now = new Date().toISOString(), start = new Date(Date.now() + 86400000).toISOString();
    const scope = fixtureOpportunity({ id: "native-opportunity", playerId: 9900003, observedAt: now, scheduledStartAt: start, sourceGameDate: start.slice(0, 10) });
    const plan = planScheduledRefresh([scope], now)[0];
    const bounds: RefreshBounds = { maximumJobs: 10, maximumEvents: 10, concurrency: 1, batchSize: 1, maximumAttempts: 3, retryDelayMs: 1000, leaseMs: 60000 };
    const features = { opponent: available(1) }, payload = { features };
    const source = fixtureSource({ observedAt: now, firstReceivedAt: now, publishedAt: now, sha256: contentHash(payload) });
    const accepted = normalizeSourceBatch({ complete: true, expectedCount: 1, pages: [{ index: 0, records: [{ identity: { playerId: scope.playerId, gameId: scope.gameId, seasonId: scope.seasonId, teamId: scope.teamId, mappingRevision: "synthetic-map", verified: true }, source, payload }] }] }, { cutoffAt: now, maximumAgeMs: 1000, maximumRecords: 1, maximumPages: 1, intendedUse: "local_fixture", approvals: [{ source: "fixture", evidenceId: "synthetic-rights", approvedAt: now, intendedUse: "local_fixture" }] }, () => true);
    const prepared: PreparedIssuance = { accepted, context: { ...scope, inputCutoffAt: now, features, sources: [source], limitations: ["native_fixture"] }, episode: { ...scope, id: "native-episode", episode: 1, enteredAt: now, exitedAt: null }, lock: { id: "native-lock", gameId: scope.gameId, adoptedAt: now, lockAt: start, scheduleRevision: scope.scheduleRevision, predecessorId: null, reopened: false, actualStartAt: null, playBegun: false, timingStatus: "provisional" }, model: null, participationModel: null, calibration: null, scoring: DEFAULT_SCORING, featureVersion: "fixture", codeVersion: "fixture", cohort: "synthetic", evidenceClass: "fixture", predecessorId: null };
    await store.saveQueue("pipeline", 0, enqueueRefresh(createRefreshState(), [plan], now, bounds));
    const artifacts = new FileArtifactStore(join(root, "pipeline-online"), join(root, "pipeline-archive"));
    await admin.query("select setval('forge_v2_private.forge_v2_issuance_sequence',7000)");
    const result = await runPreparedQueueBatch({ queueId: "pipeline", store, artifacts, prepared: new Map([[plan.issuanceKey, prepared]]), bounds, clock: () => new Date().toISOString() });
    expect(result.state).toBe("completed");
    const state = (await store.loadQueue("pipeline"))!.state as RefreshState;
    expect(state.jobs[0].status).toBe("published");
    const published = await store.get(state.jobs[0].vintageId!);
    expect(published?.vintage.evidenceClass).toBe("fixture");
    expect(published?.vintage.qualificationId).toBeNull();
    expect((await store.history(scope.playerId, scope.gameId)).revisions).toEqual([published]);
    expect(await store.getDraft(plan.issuanceKey)).toEqual(published?.vintage);
    const closed = { ...prepared.episode, exitedAt: new Date(Date.parse(now) + 1000).toISOString() };
    const reentered = { ...prepared.episode, id: "native-episode-2", episode: 2, enteredAt: new Date(Date.parse(now) + 2000).toISOString() };
    await capturePreparedLedger({ store, opportunities: [], episodes: [{ value: closed, predecessor: prepared.episode }, { value: reentered, predecessor: closed }], locks: [], events: [] });
    const episodes = await store.records(targetKey(scope), "horizon_episode");
    expect(episodes.map(row => row.payload)).toEqual([prepared.episode, closed, reentered]);
    expect(episodes[1].predecessorId).toBe(episodes[0].id); expect(episodes[2].predecessorId).toBe(episodes[1].id);
  });

  it("retains an initial archived-game context lookup after that target leaves the current queue", async () => {
    const game = fixtureOpportunity(), reader = new PostgresContextReader(db as SqlConnection);
    const original: PreparedPlayerContext = { id: "context-old", player: { id: game.playerId, name: "Synthetic" }, publicApproved: true, asOf: "2026-01-12T04:00:00.000Z", games: [{ opportunity: game, epochs: [], latestVintageId: null, finalVintageId: null, outcome: null, events: [], freshness: { state: "unavailable", asOf: "2026-01-12T04:00:00.000Z", reason: "fixture" } }], excluded: [], qualifications: [], accountability: { requested: 0, forecastCount: 0, outcomeCount: 0, abstentions: 0, mae: unavailable("fixture"), rmse: unavailable("fixture"), bias: unavailable("fixture"), evidenceClass: "fixture", limitations: [] } };
    await store.appendRecord(original.id, "read_context", `player:${game.playerId}`, original);
    await store.appendRecord("context-new", "read_context", `player:${game.playerId}`, { ...original, id: "context-new", games: [] }, original.id);
    expect((await reader.read(game.playerId))?.games).toEqual([]);
    expect((await reader.readGame(game.playerId, game.gameId))?.id).toBe(original.id);
    expect(await reader.players("Synthetic")).toEqual([original.player]);
  });
  it("CAS-reconciles a trade before retaining linked observations and denies the former worker", async () => {
    const before = new Date(Date.now() - 5000).toISOString(), claimedAt = new Date(Date.now() - 1000).toISOString(), acceptedAt = new Date().toISOString();
    const scope = fixtureOpportunity({ id: "native-reconcile", playerId: 9900004, observedAt: before, scheduledStartAt: new Date(Date.now() + 86400000).toISOString() });
    const bounds: RefreshBounds = { maximumJobs: 10, maximumEvents: 10, concurrency: 1, batchSize: 1, maximumAttempts: 3, retryDelayMs: 1000, leaseMs: 60000 };
    const plan = planScheduledRefresh([scope], before)[0];
    const claimed = claimRefreshBatch(enqueueRefresh(createRefreshState(), [plan], before, bounds), claimedAt, bounds);
    await store.saveQueue("native-transition", 0, claimed.state);
    const episode = { ...scope, id: "native-transition-episode", enteredAt: before, exitedAt: null, episode: 1 };
    const current = { ...scope, id: "native-traded", teamId: 3, affiliationRevision: "trade", observedAt: acceptedAt };
    const transition = { store, queueId: "native-transition", previous: [{ value: scope, predecessor: null }], current: [current], episodes: [episode], locks: [], acceptedAt, bounds };
    const result = await reconcilePreparedQueueScopes(transition);
    expect(result.state).toBe("captured");
    if (result.state !== "captured") return;
    expect(result.episodes).toEqual([episode]); expect(result.opened).toEqual([current]);
    const state = (await store.loadQueue(transition.queueId))!.state as RefreshState;
    expect(state.jobs.find(j => j.id === claimed.jobs[0].id)).toMatchObject({ status: "expired", leaseUntil: null });
    const draft = fixtureVintage({ ...scope, id: "stale-native-worker", issuanceKey: plan.issuanceKey, sequence: 8000, inputCutoffAt: before, generatedAt: acceptedAt, issuanceAttempt: { queueId: transition.queueId, jobId: claimed.jobs[0].id, attempt: 1, startedAt: claimedAt } });
    await expect(store.publishClaimed(draft, { queueId: transition.queueId, jobId: claimed.jobs[0].id, attempt: 1 })).rejects.toThrow(/claim lost/);
    expect(await store.getDraft(plan.issuanceKey)).toBeNull();
    const observations = await store.records(targetKey(scope), "opportunity");
    expect(observations.map(row => row.payload)).toEqual([scope, current]); expect(observations[1].predecessorId).toBe(observations[0].id);
    expect((await reconcilePreparedQueueScopes(transition)).state).toBe("captured");
    expect(await store.records(targetKey(scope), "opportunity")).toEqual(observations);
  });
});

describe("FORGE v2 pinned artifact retention (T3)", () => {
  let root: string, archive: string, store: FileArtifactStore;
  const payload = { schemaVersion: "fixture-joint-v1", outcomes: [[0, 1], [1, 0]] };
  const reference: ArtifactReference = { id: "fixture:joint", version: "1", sha256: contentHash(payload), kind: "joint_distribution", schemaVersion: "fixture-joint-v1", decoderVersion: "fixture-decoder-v1", calculationVersion: "fixture-calculation-v1", categories: [...CATEGORIES], horizons: [1, 2], cohorts: ["synthetic-skater"], profileIds: [], targetVersion: TARGET_VERSION, conditioning: CONDITIONING };
  beforeAll(async () => { root = await mkdtemp(join(tmpdir(), "forge-v2-artifacts-")); archive = join(root, "archive"); store = new FileArtifactStore(join(root, "online"), archive); });
  afterAll(async () => { await rm(root, { recursive: true, force: true }); });
  it("retains immutable bytes through archive read and restoration", async () => {
    await store.put(reference, payload); await store.put(reference, payload);
    const original = await store.read(reference);
    await store.archive(reference);
    const archived = await store.read(reference);
    expect(archived).toMatchObject({ state: "available", location: "archived", bytes: canonicalJson(payload) });
    await store.restore(reference);
    expect(await store.read(reference)).toEqual(original);
    await expect(store.put({ ...reference, version: "2" }, payload)).rejects.toThrow(/conflict/);
  });
  it("reports altered/missing/non-file artifacts without substituting archive bytes", async () => {
    const content = join(root, "online/content", `${reference.sha256}.json`);
    await writeFile(content, "{}");
    expect(await store.read(reference)).toMatchObject({ state: "unavailable", reason: "artifact_hash_mismatch", incident: { artifactId: reference.id } });
    await unlink(content);
    await unlink(join(archive, "content", `${reference.sha256}.json`));
    expect(await store.read(reference)).toMatchObject({ state: "unavailable", reason: "artifact_missing" });
    await mkdir(content);
    expect(await store.read(reference)).toMatchObject({ state: "unavailable", reason: "artifact_size_limit" });
    expect(await store.read({ ...reference, id: "missing" })).toMatchObject({ state: "unavailable", reason: "artifact_missing" });
    expect(sha256(canonicalJson(payload))).toBe(reference.sha256);
  });
  it("reports actual permission failures and hash-pinned undecodable bytes", async () => {
    const restricted = { ...reference, id: "restricted", sha256: contentHash({ restricted: true }) };
    await store.put(restricted, { restricted: true });
    const path = join(root, "online/content", `${restricted.sha256}.json`);
    await chmod(path, 0);
    try { expect(await store.read(restricted)).toMatchObject({ state: "unavailable", reason: "artifact_inaccessible" }); }
    finally { await chmod(path, 0o600); }
    const bytes = "not json", undecodable = { ...reference, id: "undecodable", sha256: sha256(bytes) };
    await writeFile(join(root, "online/manifests", `${sha256(undecodable.id)}.json`), canonicalJson(undecodable));
    await writeFile(join(root, "online/content", `${undecodable.sha256}.json`), bytes);
    expect(await store.read(undecodable)).toMatchObject({ state: "unavailable", reason: "artifact_undecodable" });
  });
});
