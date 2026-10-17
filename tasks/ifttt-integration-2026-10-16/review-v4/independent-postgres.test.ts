// Uses frozen v4 fixture schema; R8 hook assertion/body unchanged from review-v3.
// @vitest-environment node
import { execFile } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { Client } from "../../../web/node_modules/pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "../../../web/node_modules/vitest";
import { qualifiedFixture } from "../../../web/lib/sources/fixtures/tweetClaimQualificationFixture";
import { retainQualifiedTweetClaimScope } from "../../../web/lib/sources/tweetClaimQualificationStorage";
import { extractDurableTweetClaims, tweetClaimContentHash } from "../../../web/lib/sources/tweetClaimExtraction";
import { TWEET_LEGACY_SINKS } from "../../../web/lib/sources/tweetClaimEvidence";
import { persistTweetProjectionReports } from "../../../web/lib/sources/tweetProjectionStorage";
import { processTweetClaimShadowBatch, retainTweetClaimScope } from "../../../web/lib/sources/tweetClaimRegistry";

describe.runIf(Boolean(process.env.IFTTT_POSTGRES_BIN))("durable qualified IFTTT scope integration", () => {
  const exec = promisify(execFile), bin = process.env.IFTTT_POSTGRES_BIN!;
  const env = { ...process.env }; for (const key of Object.keys(env)) if (key.startsWith("PG")) delete env[key];
  let root: string, socket: string, started = false, ackLoss = false;
  const sql = async (query: string, values: any[] = [], service = true) => {
    const db = new Client({ host: socket, port: 65438, user: "ifttt_test", database: "postgres", password: "", ssl: false, options: "", connectionTimeoutMillis: 2000 });
    await db.connect();
    try { if (service) await db.query("set role service_role"); return (await db.query(query, values)).rows; } finally { await db.end(); }
  };
  const rpc = async (name: string, args: Record<string, unknown>) => {
    if (!/^(read_tweet_claim_scope|read_tweet_claim_context|commit_qualified_tweet_claim_scope|register_bounded_tweet_claim_evaluation|read_tweet_claim_dated_roster|reserve_tweet_claim_evaluation_intake)$/.test(name)) throw new Error("Unknown fixture RPC");
    const pairs = Object.entries(args);
    const rows = await sql(`select public.${name}(${pairs.map(([key], i) => `${key}=>$${i + 1}`).join(",")}) result`, pairs.map(([key, value]) => key === "p_ids" ? value : typeof value === "object" && value !== null ? JSON.stringify(value) : value));
    if (name === "commit_qualified_tweet_claim_scope" && ackLoss) { ackLoss = false; throw new Error("lost qualified commit acknowledgement"); }
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
  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "fhfh-ifttt-qualified-pg-")); socket = join(root, "socket"); mkdirSync(socket, { mode: 0o700 });
    await exec(join(bin, "initdb"), ["-D", join(root, "data"), "--no-locale", "--encoding=UTF8", "--auth-local=trust", "--auth-host=reject", "-U", "ifttt_test"], { env });
    await exec(join(bin, "pg_ctl"), ["-D", join(root, "data"), "-l", join(root, "server.log"), "-w", "-t", "10", "-o", `-c listen_addresses='' -c unix_socket_directories='${socket}' -p 65438`, "start"], { env }); started = true;
    await sql("create role service_role bypassrls; create role anon; create role authenticated;", [], false);
    const task = join(process.cwd(), "../tasks/ifttt-integration-2026-10-16");
    await sql(readFileSync(join(task, "migrations/20261016024711_tweet_claim_registry.sql"), "utf8"), [], false);
    await sql(readFileSync(join(task, "next-increment/20261016073000_tweet_claim_qualification.sql"), "utf8"), [], false);
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
  }, 20000);
  afterAll(async () => {
    vi.unstubAllEnvs();
    if (started) await exec(join(bin, "pg_ctl"), ["-D", join(root, "data"), "-w", "-t", "10", "stop", "-m", "fast"], { env });
    if (root) rmSync(root, { recursive: true, force: true });
  });
  it("atomically converges provisional/verified and cross-root receipts with one held action, including commit ack loss", async () => {
    const f = qualifiedFixture();
    const provisional = extractDurableTweetClaims({ source: { ...f.source, gameId: null, sourceUrl: "https://x.com/GameDayLines/status/1000" }, game: null, interpretedAt: f.asOf });
    await retainQualifiedTweetClaimScope({ rpc }, provisional, f.asOf);
    ackLoss = true; vi.stubEnv("TWEET_CLAIMS_MODE", "shadow");
    const db = { rpc, from: (table: string) => {
      if (!["games", "tweet_source_coverage"].includes(table)) throw new Error(`Unexpected publisher table: ${table}`);
      const result = { data: table === "games" ? [f.game] : [], error: null };
      return { select: () => ({ in: () => ({ ...result, limit: async () => result, then: (resolve: any) => Promise.resolve(result).then(resolve) }) }) };
    } };
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(f.asOf);
    try { await persistTweetProjectionReports(db, [f.source]); } finally { vi.useRealTimers(); vi.unstubAllEnvs(); }
    const relay = extractDurableTweetClaims({ source: { ...f.source, tweetId: "2000", sourceUrl: "https://x.com/GameDayLines/status/2000",
      primaryTextSource: "quoted_oembed", quotedRawText: f.source.rawText, quotedTweetId: "1000", quotedAuthorHandle: "Reporter", quotedTweetUrl: f.source.sourceUrl }, game: f.game, interpretedAt: f.asOf });
    await Promise.all([retainQualifiedTweetClaimScope({ rpc }, relay, f.asOf), retainQualifiedTweetClaimScope({ rpc }, relay, f.asOf)]);
    const scope = f.claims[0]!.scopeKey;
    const rows = await sql("select qualification_state from public.tweet_claim_scopes where scope_key=$1", [scope]);
    const q = rows[0]!.qualification_state;
    expect(q.bindings).toHaveLength(3); expect(new Set(q.bindings.map((b: any) => b.occurrenceId)).size).toBe(1);
    expect(q.plan.nextState.registry.claims).toHaveLength(1); expect(q.plan.holds).toEqual([]); expect(q.plan.reviewableEffects).toHaveLength(1);
    expect(await sql("select status,requires_review from public.tweet_claim_outbox where scope_key=$1", [scope])).toEqual([{ status: "held", requires_review: true }]);
    expect(await sql("select observation_id from public.tweet_claim_observations where scope_key=$1", [scope])).toHaveLength(2);
    expect(await sql("select * from public.tweet_claim_lineage_links")).toHaveLength(2);
  });
  it("retains exact partial legacy effects and suppresses new reservations without replaying them", async () => {
    const f = qualifiedFixture();
    const legacyKey = f.claims[0]!.aliases.find(a => a.key.startsWith("report:"))!.key.slice(7);
    await sql("insert into public.tweet_projection_reports(report_key,payload) values($1,'{\"qualifier\":\"without\"}')", [legacyKey], false);
    await sql("insert into public.player_forecast_goalie_start_observations(game_id,team_id,payload) values($1,6,'{\"receipt\":\"existing-partial-effect\"}')", [f.game.id], false);
    await retainQualifiedTweetClaimScope({ rpc }, f.claims, f.asOf);
    const q = (await sql("select qualification_state from public.tweet_claim_scopes where scope_key=$1", [f.claims[0]!.scopeKey]))[0]!.qualification_state;
    expect(q.legacy.retained.find((r: any) => r.sink === "tweet_projection_reports").rows[0].report_key).toBe(legacyKey);
    expect(q.legacy.status).toBe("present"); expect(q.plan.reviewableEffects).toEqual([]);
    expect(q.legacy.retained.find((r: any) => r.sink === "player_forecast_goalie_start_observations").rows[0].payload.receipt).toBe("existing-partial-effect");
  });
  it("preserves retained r3 occurrence allocations and first planning cutoff through the real RPC", async () => {
    const f = qualifiedFixture();
    const first = (await sql("select qualification_state from public.tweet_claim_scopes where scope_key=$1",[f.claims[0]!.scopeKey]))[0]!.qualification_state;
    await retainQualifiedTweetClaimScope({ rpc },f.claims,"2026-10-16T15:03:00Z");
    const next = (await sql("select qualification_state from public.tweet_claim_scopes where scope_key=$1",[f.claims[0]!.scopeKey]))[0]!.qualification_state;
    expect(next.plan.nextState.registry.effects).toEqual(first.plan.nextState.registry.effects);
    expect(next.plan.nextState.registry.claims).toEqual(first.plan.nextState.registry.claims);
  });
  it("rejects same-ID changed raw payload and alias membership on the real integrated storage path", async () => {
    const f = qualifiedFixture();
    for (const kind of ["raw", "alias"]) {
      const changed = structuredClone(f.claims);
      if (kind === "raw") changed[0]!.source.rawPayload = { changed: true };
      else changed[0]!.aliases.push({ key: "event:foreign:8478499:0", version: 1 });
      await expect(retainTweetClaimScope({ rpc }, changed, f.asOf)).rejects.toThrow("Immutable claim identity collision");
    }
  });
  it("recovers shadow raw-status acknowledgement loss after evidence committed without another action", async () => {
    const f = qualifiedFixture(); let loseAck = true;
    await sql("create table public.line_source_ifttt_events(id text primary key,processing_status text,updated_at timestamptz,raw_payload jsonb); grant select,update on public.line_source_ifttt_events to service_role; insert into public.line_source_ifttt_events values('shadow','pending',now(),'{}')", [], false);
    const db = { rpc, from: (table: string): any => {
      if (table === "line_source_ifttt_events") return { update: (value: any) => ({ eq: async () => {
        await sql("update public.line_source_ifttt_events set processing_status=$1,updated_at=$2,raw_payload=$3 where id='shadow'", [value.processing_status,value.updated_at,JSON.stringify(value.raw_payload)]);
        if (loseAck) { loseAck = false; throw new Error("raw status acknowledgement lost"); } return { error: null };
      } }) };
      if (!["games", "tweet_source_coverage"].includes(table)) throw new Error(`Unexpected publisher table ${table}`);
      const result = { data: table === "games" ? [f.game] : [], error: null };
      return { select: () => ({ in: () => ({ ...result, limit: async () => result, then: (resolve: any) => Promise.resolve(result).then(resolve) }) }) };
    } };
    const batch = { supabase: db, table: "line_source_ifttt_events" as const, sources: [f.source], events: [{ id: "shadow",raw_payload: {} }], pendingEvents: [], deferredUpdates: [] };
    vi.stubEnv("TWEET_CLAIMS_MODE", "shadow"); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(f.asOf);
    try {
      await expect(processTweetClaimShadowBatch(batch)).rejects.toThrow("raw status acknowledgement lost");
      expect(await processTweetClaimShadowBatch(batch)).toMatchObject({ eventsProcessed: 1,delivery: "not_requested" });
    } finally { vi.useRealTimers(); vi.unstubAllEnvs(); }
    expect(await sql("select status,requires_review from public.tweet_claim_outbox where scope_key=$1", [f.claims[0]!.scopeKey])).toEqual([{ status: "held",requires_review: true }]);
  });
  it("rolls back raw and qualification versions together when a later qualification write fails", async () => {
    const f = qualifiedFixture();
    const changed = extractDurableTweetClaims({ source: { ...f.source, tweetId: "3000", sourceUrl: "https://x.com/Reporter/status/3000" }, game: f.game, interpretedAt: f.asOf });
    await sql("create function fixture_fail_qualification() returns trigger language plpgsql as $$ begin raise exception 'qualification fault'; end $$; create trigger fixture_fail before insert on public.tweet_claim_qualification_versions for each row execute function fixture_fail_qualification()", [], false);
    try { await expect(retainQualifiedTweetClaimScope({ rpc }, changed, f.asOf)).rejects.toThrow("qualification fault"); }
    finally { await sql("drop trigger fixture_fail on public.tweet_claim_qualification_versions; drop function fixture_fail_qualification()", [], false); }
    expect(await sql("select observation_id from public.tweet_claim_observations where observation_id=$1", [changed[0]!.semantic.id])).toEqual([]);
    expect(await sql("select occurrence_id from public.tweet_claim_occurrence_meanings where root_key='tweet-original-v1:3000'")).toEqual([]);
  });
  it("does not misclassify a failed refresh of already retained evidence as commit acknowledgement loss", async () => {
    const f = qualifiedFixture();
    await sql("create function fixture_fail_refresh() returns trigger language plpgsql as $$ begin raise exception 'refresh fault'; end $$; create trigger fixture_fail_refresh before insert on public.tweet_claim_qualification_versions for each row execute function fixture_fail_refresh()", [], false);
    try { await expect(retainQualifiedTweetClaimScope({ rpc }, f.claims, f.asOf)).rejects.toThrow("refresh fault"); }
    finally { await sql("drop trigger fixture_fail_refresh on public.tweet_claim_qualification_versions; drop function fixture_fail_refresh()", [], false); }
  });
  it("serializes finite evaluation budgets and stops on clock expiry without failing raw retention", async () => {
    const start = new Date(Date.now() + 3600_000).toISOString(), end = new Date(Date.now() + 7200_000).toISOString();
    await rpc("register_bounded_tweet_claim_evaluation", { p_id: "future-bounded", p_start: start, p_end: end, p_max: 2, p_version: "v1" });
    await expect(rpc("register_bounded_tweet_claim_evaluation", { p_id: "future-bounded", p_start: start, p_end: end, p_max: 3, p_version: "v1" })).rejects.toThrow("immutable");
    // Fixture-only clock setup, not a claim of prospective production capture.
    await sql("insert into public.tweet_claim_evaluation_cohorts(cohort_id,starts_at,registered_at,extraction_version,ends_at,max_samples) values('clock-fixture',now()-interval '1 minute',now()-interval '2 minutes','v1',now()+interval '1 hour',2)", [], false);
    const insert = (i: number) => {
      const time = new Date(Date.now() - 1000).toISOString();
      return sql("insert into public.tweet_claim_evaluation_samples(sample_id,cohort_id,lineage_key,origin_id,document_hash,payload) values($1,'clock-fixture',$1,$1,'hash',$2)", [`s${i}`, JSON.stringify({ capturedAt: time, receivedAt: time, publishedAt: time })]);
    };
    await Promise.all(Array.from({ length: 8 }, (_, i) => insert(i)));
    expect(await sql("select count(*)::int n from public.tweet_claim_evaluation_samples where cohort_id='clock-fixture'")).toEqual([{ n: 2 }]);
    await sql("update public.tweet_claim_evaluation_cohorts set ends_at=now()-interval '1 second' where cohort_id='clock-fixture'", [], false);
    await insert(99); expect(await sql("select sample_id from public.tweet_claim_evaluation_samples where sample_id='s99'")).toEqual([]);
  });
  it("rejects the reviewer's invalid prospective clocks at the SQL boundary without retaining a sample", async () => {
    const f = qualifiedFixture(), start = new Date(Date.now() + 3600_000).toISOString();
    await rpc("register_bounded_tweet_claim_evaluation", { p_id: "clock-rejection", p_start: start,
      p_end: new Date(Date.now() + 7200_000).toISOString(), p_max: 2, p_version: f.claims[0]!.extractionVersion });
    const sample = { id: "invalid-review-clock", cohortId: "clock-rejection", publishedAt: new Date(Date.now() + 3700_000).toISOString(),
      receivedAt: new Date(Date.now() + 3800_000).toISOString(), capturedAt: new Date().toISOString(), extractionVersion: f.claims[0]!.extractionVersion,
      documentHash: "invalid", originId: "1000" };
    const fresh = extractDurableTweetClaims({ source: { ...f.source, tweetId: "4000", sourceUrl: "https://x.com/Reporter/status/4000" }, game: f.game, interpretedAt: f.asOf });
    const claim = { ...fresh[0]!, evaluation: sample };
    const snapshot = (await rpc("read_tweet_claim_scope", { p_scope: claim.scopeKey })).data;
    await expect(sql("select public.commit_tweet_claim_scope($1,$2,$3,$4,$5)", [claim.scopeKey,snapshot.version,
      JSON.stringify([claim]),JSON.stringify({ actions: [] }),JSON.stringify({ state: snapshot.reviewedState })])).rejects.toThrow("sample outside prospective cohort");
    expect(await sql("select sample_id from public.tweet_claim_evaluation_samples where sample_id=$1", [sample.id])).toEqual([]);
  });
  it("uses dated source hints through the actual hook while preserving complete-schedule ambiguity", async () => {
    const f = qualifiedFixture(), source = { ...f.source,tweetId: "5000",sourceUrl: "https://x.com/Reporter/status/5000",
      team: null,gameId: null,rawText: "Jeremy Swayman starts tonight.",nhlFilterStatus: "rejected_ambiguous",nhlFilterReason: "no_single_nhl_team_match",detectedLeague: null,
      metadata: { interpretation: { ...f.source.metadata.interpretation,events: [],unresolved: [] } } };
    const coverage = { id: "fixture-beat",account: { accountKey: "x:handle:reporter",accountId: null,handle: "reporter" },
      handleValidFrom: "2020-01-01T00:00:00Z",handleValidUntil: null,effectiveFrom: "2026-10-01T00:00:00Z",effectiveUntil: null,
      knownAt: "2026-10-10T00:00:00Z",teamIds: [6],leagues: ["NHL"],scope: "team",status: "verified",confidence: 1,
      evidence: { url: "https://example.test/fixture",excerpt: "fixture-only verified assignment",basis: "fixture only" } };
    const schedule = [f.game];
    const db = { rpc,from: (table: string) => {
      if (!["teams","games","tweet_source_coverage"].includes(table)) throw new Error(`Unexpected publisher ${table}`);
      let byDate = false;
      const result = () => ({ data: table === "teams" ? [{ id: 6,name: "Boston Bruins",abbreviation: "BOS" }] : table === "games" ? byDate ? schedule : [f.game] : [{ payload: coverage }],error: null });
      const query: any = { select: () => query,in: () => query,eq: () => { byDate = true; return query; },or: () => query,limit: async () => result(),then: (resolve: any) => Promise.resolve(result()).then(resolve) }; return query;
    } };
    vi.stubEnv("TWEET_CLAIMS_MODE","shadow"); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(f.asOf);
    try { await persistTweetProjectionReports(db,[source]); } finally { vi.useRealTimers();vi.unstubAllEnvs(); }
    const raw = await sql("select payload from public.tweet_claim_observations where origin_id='5000'");
    expect(raw).toHaveLength(1);expect(raw[0]!.payload.source.team.id).toBe(6);
    expect(raw[0]!.payload.source.metadata.tweetSourceDirectoryHint.bindingAuthority).toBe(false);
    const q = (await sql("select qualification_state from public.tweet_claim_scopes where scope_key=$1",[raw[0]!.payload.scopeKey]))[0]!.qualification_state;
    expect(q.plan.nextState.derivations.some((d: any) => d.ingress.immutable.source.originalTweetId === "5000" && d.ingress.immutable.binding.status === "verified")).toBe(true);
    schedule.push(await seedGame(f.game.id+1000,"hint-ambiguous-schedule"));
    const ambiguous = { ...source,tweetId: "5001",sourceUrl: "https://x.com/Reporter/status/5001" };
    const explicit = { ...f.source,tweetId: "5002",sourceUrl: "https://x.com/Reporter/status/5002" };
    vi.stubEnv("TWEET_CLAIMS_MODE","shadow"); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(f.asOf);
    try { await persistTweetProjectionReports(db,[explicit,ambiguous]); } finally { vi.useRealTimers();vi.unstubAllEnvs(); }
    const unresolved = await sql("select payload from public.tweet_claim_observations where origin_id='5001'");
    expect(unresolved).toHaveLength(1); expect(unresolved[0]!.payload.source.gameId).toBeNull();
    expect(unresolved[0]!.payload.source.metadata.tweetSourceDirectoryHint).toBeUndefined();
  });
  it("blocks both game scopes on global material rebind in both arrival orders and under contention", async () => {
    const f = qualifiedFixture();
    for (const [index,order] of ["forward","reverse","race"].entries()) {
      const gameB = await seedGame(f.game.id+index+10,`rebind-${index}`),origin = `${8100+index}`;
      const sources = [f.game,gameB].map(game => extractDurableTweetClaims({ source: { ...f.source,tweetId: origin,
        sourceUrl: `https://x.com/Reporter/status/${origin}`,gameId: game.id },game,interpretedAt: f.asOf }));
      if (order === "race") await Promise.all(sources.map(c => retainQualifiedTweetClaimScope({ rpc },c,f.asOf)));
      else for (const c of order === "reverse" ? [...sources].reverse() : sources) await retainQualifiedTweetClaimScope({ rpc },c,f.asOf);
      const rows = await sql("select qualification_state from public.tweet_claim_scopes where scope_key=any($1)",[sources.map(c => c[0]!.scopeKey)]);
      expect(rows).toHaveLength(2); expect(rows.flatMap(r => r.qualification_state.plan.reviewableEffects)).toEqual([]);
      expect(await sql("select distinct status from public.tweet_claim_outbox where scope_key=any($1)",[sources.map(c => c[0]!.scopeKey)])).toEqual([{ status: "blocked" }]);
      expect(await sql("select occurrence_id from public.tweet_claim_occurrence_meanings where root_key=$1",[`tweet-original-v1:${origin}`])).toHaveLength(2);
    }
  });
  it("uses the newest incomplete audit as unknown through the real SQL evidence reader", async () => {
    const f = qualifiedFixture(), game = await seedGame(f.game.id+30,"history-complete");
    await sql("insert into public.tweet_claim_legacy_history(audit_id,game_id,team_id,known_at,payload) values('history-incomplete',$1,6,'2026-10-16T15:01:00Z',$2)",[game.id,JSON.stringify({ ...f.evidence.history,status: "incomplete" })],false);
    const claims = extractDurableTweetClaims({ source: { ...f.source,tweetId: "9100",sourceUrl: "https://x.com/Reporter/status/9100",gameId: game.id },game,interpretedAt: f.asOf });
    await retainQualifiedTweetClaimScope({ rpc },claims,f.asOf);
    const q = (await sql("select qualification_state from public.tweet_claim_scopes where scope_key=$1",[claims[0]!.scopeKey]))[0]!.qualification_state;
    expect(q.legacy.status).toBe("unknown"); expect(q.plan.reviewableEffects).toEqual([]);
  });
  it("durably retains a canonical alignment exception instead of dropping its immutable observation", async () => {
    const f = qualifiedFixture(), claim = structuredClone(f.claims[0]!);
    const predicate = claim.claimAnchor!.predicateSpan;
    claim.extractionVersion = "fixture-reparse-v2";
    const end = predicate.end-1;
    claim.claimAnchor!.predicateSpan = { start: predicate.start,end,text: f.source.rawText.slice(predicate.start,end) };
    claim.contentHash = tweetClaimContentHash(claim); claim.semantic = { ...claim.semantic,id: `tweet-observation-v2:${claim.contentHash}` };
    await retainTweetClaimScope({ rpc },[claim],f.asOf);
    expect(await sql("select observation_id from public.tweet_claim_observations where observation_id=$1",[claim.semantic.id])).toHaveLength(1);
    const q = (await sql("select qualification_state from public.tweet_claim_scopes where scope_key=$1",[claim.scopeKey]))[0]!.qualification_state;
    expect(q.plan.accepted).toBe(false);expect(q.holds.some((h: any) => h.reason.startsWith("canonical_adapter_rejected:"))).toBe(true);
    expect(q.plan.reviewableEffects).toEqual([]);
  });
  it("bounds all raw pilot intake across both handlers and stops before more enrichment after expiry", async () => {
    await sql("insert into public.tweet_claim_evaluation_cohorts(cohort_id,starts_at,registered_at,extraction_version,ends_at,max_samples) values('intake-clock',now()-interval '1 minute',now()-interval '2 minutes','v1',now()+interval '1 hour',2)",[],false);
    const reserve = (i: number) => rpc("reserve_tweet_claim_evaluation_intake",{ p_id: "intake-clock",p_table: i%2 ? "lines_ccc_ifttt_events" : "line_source_ifttt_events",p_ids: [`raw-${i}`] });
    const results = await Promise.all(Array.from({ length: 8 },(_,i) => reserve(i)));
    expect(results.flatMap(r => r.data.allowed)).toHaveLength(2);
    expect(await sql("select count(*)::int n from public.tweet_claim_evaluation_intake where cohort_id='intake-clock'")).toEqual([{ n: 2 }]);
    await sql("update public.tweet_claim_evaluation_cohorts set ends_at=now()-interval '1 second' where cohort_id='intake-clock'",[],false);
    expect((await reserve(99)).data).toEqual({ status: "ended",allowed: [] });
  });  it("independent: actual hook preserves game ambiguity when its initial game-ID cache is partial", async () => {
    const f = qualifiedFixture(), secondGame = await seedGame(f.game.id+999,"review-hint-second-game");
    const coverage = { id: "review-dated-coverage", account: { accountKey: "x:handle:reporter",accountId: null,handle: "reporter" },
      handleValidFrom: "2020-01-01T00:00:00Z",handleValidUntil: null,effectiveFrom: "2026-10-01T00:00:00Z",effectiveUntil: null,
      knownAt: "2026-10-10T00:00:00Z",teamIds: [6],leagues: ["NHL"],scope: "team",status: "verified",confidence: 1,
      evidence: { url: "https://example.test/review-only",excerpt: "Synthetic dated assignment",basis: "fixture only" } };
    const hinted = { ...f.source,tweetId: "6100",sourceUrl: "https://x.com/Reporter/status/6100",team: null,gameId: null,
      rawText: "Jeremy Swayman starts tonight.",nhlFilterStatus: "rejected_ambiguous",nhlFilterReason: "no_single_nhl_team_match",detectedLeague: null,
      metadata: { interpretation: { ...f.source.metadata.interpretation,events: [],unresolved: [] } } };
    const db: any = { rpc,from: (table: string) => {
      let byDate = false;
      const result = () => ({ data: table === "teams" ? [{id:6,name:"Boston Bruins",abbreviation:"BOS"}]
        : table === "tweet_source_coverage" ? [{payload:coverage}]
        : table === "games" ? byDate ? [f.game,secondGame] : [f.game] : [],error:null });
      const q: any = {select:()=>q,in:()=>q,eq:()=>{byDate=true;return q;},or:()=>q,limit:async()=>result(),then:(resolve:any)=>Promise.resolve(result()).then(resolve)};
      if (!["teams","games","tweet_source_coverage"].includes(table)) throw new Error(`Unexpected legacy consumer ${table}`);
      return q;
    } };
    vi.stubEnv("TWEET_CLAIMS_MODE","shadow");vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(f.asOf);
    try {await persistTweetProjectionReports(db,[f.source,hinted]);} finally {vi.useRealTimers();vi.unstubAllEnvs();}
    const raw = await sql("select payload from public.tweet_claim_observations where origin_id='6100'");
    expect(raw).toHaveLength(1);expect(raw[0].payload.source.gameId).toBeNull();
  });

});
