// @vitest-environment node
import { execFile } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { Client } from "pg";
import moment from "moment-timezone";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { deliverTweetClaim, retainTweetClaimScope, type TweetClaimSink } from "./tweetClaimRegistry";
import { extractDurableTweetClaims, type TweetClaimGame } from "./tweetClaimExtraction";
import { extractTweetPlayerEvents } from "./tweetPlayerEvents";
import { persistTweetProjectionReports } from "./tweetProjectionStorage";

const exec = promisify(execFile);
describe("claim rollout defaults", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("does not query a sink or claim work when delivery is disabled", async () => {
    const db = { rpc: vi.fn() }, sink = { idempotency: "durable_action_key" as const, send: vi.fn(), reconcile: vi.fn() };
    expect(await deliverTweetClaim({ db, key: "none", sink })).toEqual({ status: "disabled" });
    expect(db.rpc).not.toHaveBeenCalled(); expect(sink.send).not.toHaveBeenCalled();
  });
});

// Explicit local binary opt-in. No DATABASE_URL, TCP port or hosted database is used.
describe.runIf(Boolean(process.env.IFTTT_POSTGRES_BIN))("disposable Postgres claim integration and fault recovery", () => {
  const bin = process.env.IFTTT_POSTGRES_BIN!;
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith("PG")) delete env[key];
  let root: string, socket: string, started = false, serial = 0;
  const now = () => new Date().toISOString();
  const client = async () => {
    const db = new Client({ host: socket, port: 65437, user: "ifttt_test", database: "postgres", password: "", ssl: false, options: "", connectionTimeoutMillis: 2000 });
    await db.connect(); return db;
  };
  const sql = async (text: string, values: any[] = [], service = false) => {
    const db = await client();
    try { if (service) await db.query("set role service_role"); return (await db.query(text, values)).rows; }
    finally { await db.end(); }
  };
  const fault = { commitAck: false, settleAck: false };
  const rpc = async (name: string, args: Record<string, unknown>) => {
    if (!/^(read_tweet_claim_scope|commit_tweet_claim_scope|claim_tweet_claim_delivery|settle_tweet_claim_delivery|register_tweet_claim_evaluation)$/.test(name)) throw new Error("Unknown fixture RPC");
    const entries = Object.entries(args);
    const rows = await sql(`select public.${name}(${entries.map(([key], i) => `${key} => $${i + 1}`).join(",")}) as result`, entries.map(([, value]) => typeof value === "object" && value !== null ? JSON.stringify(value) : value), true);
    if (name === "commit_tweet_claim_scope" && fault.commitAck) { fault.commitAck = false; throw new Error("injected lost commit acknowledgement"); }
    if (name === "settle_tweet_claim_delivery" && fault.settleAck) { fault.settleAck = false; throw new Error("injected lost settle acknowledgement"); }
    return { data: rows[0]!.result, error: null };
  };
  const fixture = (player = 100, gameId = ++serial + 9000) => {
    const publishedAt = new Date(Date.now() - 60_000).toISOString(), receivedAt = new Date(Date.now() - 30_000).toISOString();
    const date = moment(publishedAt).tz("America/New_York").format("YYYY-MM-DD");
    const game: TweetClaimGame = { id: gameId, date, startTime: moment().tz("America/New_York").endOf("day").toISOString(), homeTeamId: 6, awayTeamId: 10 };
    const text = `BOS Goalie${player} starts tonight.`;
    const source: any = { snapshotDate: date, team: { id: 6, abbreviation: "BOS", name: "Boston Bruins" }, gameId, tweetId: `${++serial + 1000}`,
      sourceUrl: `https://x.com/Reporter/status/${serial + 1000}`, sourceHandle: "Reporter", rawText: text,
      tweetPostedAt: publishedAt, observedAt: receivedAt, nhlFilterStatus: "accepted", detectedLeague: "NHL", metadata: {
        interpretation: { version: "fixture", context: "game", certainty: "confirmed", units: [], unresolved: [], identityContext: {
          basis: "current_membership", sourcePublishedAt: publishedAt, eventRosterRevision: "fixture" },
        events: extractTweetPlayerEvents({ text, players: [{ playerId: player, fullName: `Goalie${player}`, lastName: `Goalie${player}`, position: "G", teamId: 6 }], publishedAt, includeClaimAnchors: true }) } } };
    const claims = extractDurableTweetClaims({ source, game, interpretedAt: now() });
    return { game, source, claims };
  };
  const actionFor = async (scope: string) => (await sql("select * from public.tweet_claim_outbox where scope_key=$1", [scope]))[0]!;
  // Fixture-only release exercises the generic sink protocol. It is not proof
  // of deployed legacy history, and production has no automatic release path.
  const release = (key: string) => sql("update public.tweet_claim_outbox set status='pending',requires_review=false,next_attempt_at=now(),lease_until=null where action_key=$1", [key]);
  const due = (key: string) => sql("update public.tweet_claim_outbox set next_attempt_at=now(),lease_until=now()-interval '1 second' where action_key=$1", [key]);
  let sends = 0, reconciles = 0;
  const sink: TweetClaimSink = { idempotency: "durable_action_key", send: async key => {
    sends++; await sql("insert into fixture_sink(action_key) values($1) on conflict do nothing", [key]);
    return { status: "applied", receipt: { key } };
  }, reconcile: async key => {
    reconciles++; const rows = await sql("select action_key from fixture_sink where action_key=$1", [key]);
    return rows.length ? { status: "applied", receipt: { key } } : { status: "not_applied" };
  } };
  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "fhfh-ifttt-pg-")); socket = join(root, "socket"); mkdirSync(socket, { mode: 0o700 });
    await exec(join(bin, "initdb"), ["-D", join(root, "data"), "--no-locale", "--encoding=UTF8", "--auth-local=trust", "--auth-host=reject", "-U", "ifttt_test"], { env });
    await exec(join(bin, "pg_ctl"), ["-D", join(root, "data"), "-l", join(root, "server.log"), "-w", "-t", "10", "-o",
      `-c listen_addresses='' -c unix_socket_directories='${socket}' -p 65437`, "start"], { env }); started = true;
    await sql("create role service_role bypassrls; create role anon; create role authenticated; create table fixture_sink(action_key text primary key)");
    await sql(readFileSync(join(__dirname, "../../../tasks/ifttt-integration-2026-10-16/migrations/20261016024711_tweet_claim_registry.sql"), "utf8"));
  }, 20000);
  afterEach(() => { vi.unstubAllEnvs(); fault.commitAck = false; fault.settleAck = false; sends = 0; reconciles = 0; });
  afterAll(async () => {
    if (started) await exec(join(bin, "pg_ctl"), ["-D", join(root, "data"), "-w", "-t", "10", "stop", "-m", "fast"], { env });
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("wires the actual projection-storage hook to durable evidence and held proposals, without legacy publication", async () => {
    const value = fixture(); vi.stubEnv("TWEET_CLAIMS_MODE", "shadow");
    const db = { rpc, from: (table: string) => {
      if (!["games", "tweet_source_coverage"].includes(table)) throw new Error(`Unexpected legacy write: ${table}`);
      const result = { data: table === "games" ? [value.game] : [], error: null };
      return { select: () => ({ in: () => ({ ...result, limit: async () => result, then: (resolve: any) => Promise.resolve(result).then(resolve) }) }) };
    } };
    await persistTweetProjectionReports(db, [value.source]); await persistTweetProjectionReports(db, [value.source]);
    const retained = (await rpc("read_tweet_claim_scope", { p_scope: value.claims[0]!.scopeKey })).data;
    expect(retained.observations).toHaveLength(1); expect((await actionFor(value.claims[0]!.scopeKey)).status).toBe("held");
    expect(retained.reviewedState.derivations).toHaveLength(1);
    expect(retained.reviewedState.registry.claims).toHaveLength(1); expect(retained.reviewedState.registry.effects).toEqual([]);
    const action = await actionFor(value.claims[0]!.scopeKey);
    expect(action.requires_review).toBe(true);
    expect(await deliverTweetClaim({ db: { rpc }, key: action.action_key, sink, enabled: true })).toEqual({ status: "held_or_busy" });
    expect(sends).toBe(0);
    expect(await sql("select count(*)::int as n from fixture_sink")).toEqual([{ n: 0 }]);
  });
  it("rolls back observations, aliases, state and outbox together on a mid-transaction failure", async () => {
    const { claims } = fixture();
    await sql("create function fixture_fail_outbox() returns trigger language plpgsql as $$ begin raise exception 'injected outbox failure'; end $$; create trigger fixture_fail before insert on public.tweet_claim_outbox for each row execute function fixture_fail_outbox()");
    try { await expect(retainTweetClaimScope({ rpc }, claims, now())).rejects.toThrow("injected outbox failure"); }
    finally { await sql("drop trigger fixture_fail on public.tweet_claim_outbox; drop function fixture_fail_outbox()"); }
    expect((await rpc("read_tweet_claim_scope", { p_scope: claims[0]!.scopeKey })).data).toEqual({ version: 0, observations: [], reviewedState: null });
    expect(await sql("select alias_key from public.tweet_claim_aliases where observation_id=$1", [claims[0]!.semantic.id])).toEqual([]);
    await retainTweetClaimScope({ rpc }, claims, now()); expect((await actionFor(claims[0]!.scopeKey)).status).toBe("held");
  });
  it("recovers a committed write whose acknowledgement was lost, preserving first admission and one outbox row", async () => {
    const { claims } = fixture(); fault.commitAck = true;
    await retainTweetClaimScope({ rpc }, claims, now());
    const result = (await rpc("read_tweet_claim_scope", { p_scope: claims[0]!.scopeKey })).data;
    expect(result.observations).toHaveLength(1); expect(result.observations[0].semantic.interpretedAt).toBe(claims[0]!.semantic.interpretedAt);
    expect(await sql("select action_key from public.tweet_claim_outbox where scope_key=$1", [claims[0]!.scopeKey])).toHaveLength(1);
  });
  it("serializes competing processors; differing starters block the proposal instead of dispatching a correction", async () => {
    const first = fixture(), second = fixture(101, first.game.id);
    // Both processors read the same scope; CAS admits one then recomputes the other.
    await Promise.all([retainTweetClaimScope({ rpc }, first.claims, now()), retainTweetClaimScope({ rpc }, second.claims, now())]);
    const snapshot = (await rpc("read_tweet_claim_scope", { p_scope: first.claims[0]!.scopeKey })).data;
    expect(snapshot.observations).toHaveLength(2);
    const proposals = await sql("select status,requires_review from public.tweet_claim_outbox where scope_key=$1", [first.claims[0]!.scopeKey]);
    expect(proposals).toEqual([{ status: "blocked", requires_review: true }]);
  });
  it("never resends after an uncertain successful sink write; reconciliation supplies the durable receipt", async () => {
    const { claims } = fixture(); await retainTweetClaimScope({ rpc }, claims, now()); const action = await actionFor(claims[0]!.scopeKey); await release(action.action_key);
    const losing: TweetClaimSink = { ...sink, send: async (key, payload) => { await sink.send(key, payload); throw new Error("injected sink acknowledgement loss"); } };
    expect(await deliverTweetClaim({ db: { rpc }, key: action.action_key, sink: losing, enabled: true })).toMatchObject({ status: "unknown", mode: "send" });
    await due(action.action_key);
    expect(await deliverTweetClaim({ db: { rpc }, key: action.action_key, sink, enabled: true })).toMatchObject({ status: "applied", mode: "reconcile" });
    expect(sends).toBe(1); expect(reconciles).toBe(1);
    expect(await sql("select * from fixture_sink where action_key=$1", [action.action_key])).toHaveLength(1);
  });
  it("reconciles an expired worker lease and fences its late acknowledgement", async () => {
    const { claims } = fixture(); await retainTweetClaimScope({ rpc }, claims, now()); const action = await actionFor(claims[0]!.scopeKey); await release(action.action_key);
    const owner = "00000000-0000-4000-8000-000000000001";
    expect((await rpc("claim_tweet_claim_delivery", { p_key: action.action_key, p_owner: owner })).data.mode).toBe("send");
    await sink.send(action.action_key, action.payload); await due(action.action_key);
    expect(await deliverTweetClaim({ db: { rpc }, key: action.action_key, sink, enabled: true })).toMatchObject({ mode: "reconcile", status: "applied" });
    expect((await rpc("settle_tweet_claim_delivery", { p_key: action.action_key, p_owner: owner, p_outcome: "not_applied", p_receipt: null, p_error: null })).data).toBe(false);
    expect((await actionFor(claims[0]!.scopeKey)).status).toBe("delivered"); expect(sends).toBe(1);
  });
  it("does not duplicate a sink write after delivery-state acknowledgement loss", async () => {
    const { claims } = fixture(); await retainTweetClaimScope({ rpc }, claims, now()); const action = await actionFor(claims[0]!.scopeKey); await release(action.action_key);
    fault.settleAck = true;
    await expect(deliverTweetClaim({ db: { rpc }, key: action.action_key, sink, enabled: true })).rejects.toThrow("lost settle acknowledgement");
    expect(await deliverTweetClaim({ db: { rpc }, key: action.action_key, sink, enabled: true })).toEqual({ status: "held_or_busy" }); expect(sends).toBe(1);
  });
  it("permits a bounded retry only after the sink proves that no effect was applied", async () => {
    const { claims } = fixture(); await retainTweetClaimScope({ rpc }, claims, now()); const action = await actionFor(claims[0]!.scopeKey); await release(action.action_key);
    await rpc("claim_tweet_claim_delivery", { p_key: action.action_key, p_owner: "00000000-0000-4000-8000-000000000002" });
    await due(action.action_key);
    expect(await deliverTweetClaim({ db: { rpc }, key: action.action_key, sink, enabled: true })).toMatchObject({ mode: "reconcile", status: "not_applied" });
    expect(sends).toBe(0); await due(action.action_key);
    await Promise.all([deliverTweetClaim({ db: { rpc }, key: action.action_key, sink, enabled: true }), deliverTweetClaim({ db: { rpc }, key: action.action_key, sink, enabled: true })]);
    expect(sends).toBe(1); expect((await actionFor(claims[0]!.scopeKey)).status).toBe("delivered");
  });
  it("stops a repeatedly rejected send after three attempts", async () => {
    const { claims } = fixture(); await retainTweetClaimScope({ rpc }, claims, now()); const action = await actionFor(claims[0]!.scopeKey); await release(action.action_key);
    const rejecting: TweetClaimSink = { ...sink, send: async () => { sends++; return { status: "not_applied" }; } };
    for (let i = 0; i < 5; i++) { await due(action.action_key); await deliverTweetClaim({ db: { rpc }, key: action.action_key, sink: rejecting, enabled: true }); }
    expect(sends).toBe(3); expect((await actionFor(claims[0]!.scopeKey)).status).toBe("exhausted");
  });
  it("bounds deterministic retry and uncertain reconciliation separately", async () => {
    const { claims } = fixture(); await retainTweetClaimScope({ rpc }, claims, now()); const action = await actionFor(claims[0]!.scopeKey); await release(action.action_key);
    const unknown: TweetClaimSink = { idempotency: "durable_action_key", send: async () => { sends++; return { status: "unknown" }; },
      reconcile: async () => { reconciles++; return { status: "unknown" }; } };
    for (let i = 0; i < 5; i++) { await due(action.action_key); await deliverTweetClaim({ db: { rpc }, key: action.action_key, sink: unknown, enabled: true }); }
    expect(sends).toBe(1); expect(reconciles).toBe(3); expect((await actionFor(claims[0]!.scopeKey)).requires_review).toBe(true);
  });
  it("enforces service-role-only RPCs and append-only observations", async () => {
    const { claims } = fixture(); await retainTweetClaimScope({ rpc }, claims, now());
    await expect(sql("update public.tweet_claim_observations set payload='{}'", [], true)).rejects.toThrow("permission denied");
    const db = await client();
    try { await db.query("set role anon"); await expect(db.query("select public.read_tweet_claim_scope('x')")).rejects.toThrow("permission denied"); }
    finally { await db.end(); }
  });
  it("rejects same-ID changed payloads in both the adapter boundary and the SQL transaction", async () => {
    const { claims } = fixture(); await retainTweetClaimScope({ rpc }, claims, now());
    const altered = { ...claims[0]!, semantic: { ...claims[0]!.semantic, fact: { kind: "starter" as const, playerId: 999 } } };
    await expect(retainTweetClaimScope({ rpc }, [altered], now())).rejects.toThrow("fingerprint mismatch");
    const snapshot = (await rpc("read_tweet_claim_scope", { p_scope: claims[0]!.scopeKey })).data;
    await expect(rpc("commit_tweet_claim_scope", { p_scope: claims[0]!.scopeKey, p_expected: snapshot.version, p_observations: [altered],
      p_reduction: { actions: [] }, p_reviewed: { state: snapshot.reviewedState } })).rejects.toThrow("immutable claim identity collision");
    expect((await rpc("read_tweet_claim_scope", { p_scope: claims[0]!.scopeKey })).data).toEqual(snapshot);
  });
  it("keeps provisional provenance upgrades held rather than claiming durable convergence", async () => {
    const value = fixture();
    const pendingSource = { ...value.source, sourceUrl: `https://x.com/GameDayLines/status/${value.source.tweetId}` };
    const pending = extractDurableTweetClaims({ source: pendingSource, game: value.game, interpretedAt: now() });
    await retainTweetClaimScope({ rpc }, pending, now());
    const snapshot = (await rpc("read_tweet_claim_scope", { p_scope: pending[0]!.scopeKey })).data;
    const verified = extractDurableTweetClaims({ source: { ...pendingSource, primaryTextSource: "quoted_oembed", quotedRawText: value.source.rawText,
      quotedTweetUrl: "https://x.com/Reporter/status/99", quotedTweetId: "99", quotedAuthorHandle: "Reporter",
      metadata: { ...pendingSource.metadata, wrapperPostedAt: new Date(Date.parse(value.source.tweetPostedAt) + 1000).toISOString() } }, game: value.game, interpretedAt: now() });
    await expect(retainTweetClaimScope({ rpc }, verified, now())).rejects.toThrow("source_root_identity_collision");
    expect((await rpc("read_tweet_claim_scope", { p_scope: pending[0]!.scopeKey })).data).toEqual(snapshot);
    expect(await sql("select action_key from public.tweet_claim_outbox where scope_key=$1", [pending[0]!.scopeKey])).toEqual([]);
  });
  it("holds an unproved cross-root relay alias without another proposal or changed parent", async () => {
    const value = fixture(); await retainTweetClaimScope({ rpc }, value.claims, now());
    const snapshot = (await rpc("read_tweet_claim_scope", { p_scope: value.claims[0]!.scopeKey })).data;
    const relay = { ...value.source, tweetId: `${++serial + 2000}`, sourceHandle: "GameDayGoalies", primaryTextSource: "quoted_oembed",
      sourceUrl: `https://x.com/GameDayGoalies/status/${serial + 2000}`, quotedRawText: value.source.rawText,
      quotedTweetUrl: value.source.sourceUrl, quotedTweetId: value.source.tweetId, quotedAuthorHandle: "Reporter",
      metadata: { ...value.source.metadata, wrapperPostedAt: new Date(Date.parse(value.source.tweetPostedAt) + 1000).toISOString() } };
    const claims = extractDurableTweetClaims({ source: relay, game: value.game, interpretedAt: now() });
    await expect(retainTweetClaimScope({ rpc }, claims, now())).rejects.toThrow("source_root_alias_unresolved");
    expect((await rpc("read_tweet_claim_scope", { p_scope: value.claims[0]!.scopeKey })).data).toEqual(snapshot);
    expect(await sql("select action_key from public.tweet_claim_outbox where scope_key=$1", [value.claims[0]!.scopeKey])).toHaveLength(1);
  });
  it("rejects retrospective cohort registration and changed frozen parser versions", async () => {
    await expect(rpc("register_tweet_claim_evaluation", { p_id: "old", p_start: "2020-01-01T00:00:00Z", p_version: "v1" })).rejects.toThrow("before its future start");
    const start = new Date(Date.now() + 86400_000).toISOString();
    await rpc("register_tweet_claim_evaluation", { p_id: "future", p_start: start, p_version: "v1" });
    await expect(rpc("register_tweet_claim_evaluation", { p_id: "future", p_start: start, p_version: "v2" })).rejects.toThrow("immutable");
    await expect(sql("insert into public.tweet_claim_evaluation_cohorts(cohort_id,starts_at,extraction_version,registered_at) values('forged','2020-01-02','v1','2020-01-01')", [], true)).rejects.toThrow("permission denied");
  });
});
