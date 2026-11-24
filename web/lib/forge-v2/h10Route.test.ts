// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { Pool } from "pg";
import { SqlConnection } from "./history.server";
import { DET, H10_SEASON, LARKIN, MTL, seedH10Public, syntheticLeague } from "./h10Fixtures";
import { CALIBRATION_RESERVE_MS, runIntervalPhase } from "./h10IntervalStore.server";
import { handleH10Shadow, h10DenominatorGuard, h10RouteConfig, H10RouteConfig, shortfallOf } from "./h10Route.server";
import { buildDenominator } from "./denominator";
import { easternDailyDeadline, easternDate } from "./refresh";

describe("h10 denominator guard", () => {
  const league = syntheticLeague({ anchor: Date.UTC(2026, 10, 23, 15), teams: 6, futureDays: 5 });
  const short = buildDenominator({ evidence: league.evidence, schedule: league.schedule, asOf: new Date(Date.UTC(2026, 10, 23, 14)).toISOString(), seasonId: H10_SEASON, scheduleComplete: true, evidenceClass: "fixture" });
  it("refuses shortfalls mid-season but accepts an exhausted schedule at season end", () => {
    expect(short.counts.shortfallPlayers).toBeGreaterThan(0);
    expect(h10DenominatorGuard(short, null, 100, 6)).toMatch(/^shortfall_players_/);
    expect(h10DenominatorGuard(short, null, 100, 6, true)).toBeNull();
    expect(h10DenominatorGuard(short, null, 1000, 6, true)).toBe("players_150_below_1000");
    expect(h10DenominatorGuard(short, null, 100, 32, true)).toBe("teams_6_not_32");
  });
});

describe("h10 route configuration", () => {
  it("counts a night short unless every expected key is published or reused (any gap, failure or unaccounted goalie key)", () => {
    const clean = { jobs: { published: 20 }, gaps: [] };
    expect(shortfallOf(clean, { keys: 4, published: 3, reused: 1, gaps: [] }, 4)).toEqual({});
    // A goalie key neither published nor reported (an unreported gap) is caught by the accounting.
    expect(shortfallOf(clean, { keys: 4, published: 3, reused: 0, gaps: [] }, 4)).toEqual({ goalieKeysUnaccounted: 1 });
    // A lock passing before issuance, as in rehearsal B, is a declared gap and still short.
    expect(shortfallOf(clean, { keys: 4, published: 2, reused: 0, gaps: [{ reason: "issuance_lock_closed" }, { reason: "issuance_lock_closed" }] }, 4))
      .toEqual({ goalieGaps: { issuance_lock_closed: 2 } });
    expect(shortfallOf({ jobs: { published: 18, failed: 1, expired: 1 }, gaps: [{ reason: "schedule_fields_missing" }] }, { keys: 4, published: 4, reused: 0, gaps: [] }, 4))
      .toEqual({ skaterJobsFailed: 1, skaterJobsExpired: 1, skaterGaps: { schedule_fields_missing: 1 } });
    // No goalie phase result at all (it never ran) leaves every expected goalie key unaccounted.
    expect(shortfallOf(clean, null, 4)).toEqual({ goalieKeysUnaccounted: 4 });
  });

  it("is off by default and fails closed without an approval id or code version", () => {
    expect(h10RouteConfig({})).toEqual({ error: "disabled" });
    expect(h10RouteConfig({ FORGE_H10_SHADOW_ENABLED: "true", VERCEL_GIT_COMMIT_SHA: "abc" })).toEqual({ error: "approval_or_code_version_missing" });
    expect(h10RouteConfig({ FORGE_H10_SHADOW_ENABLED: "true", FORGE_H10_SHADOW_APPROVAL_ID: "tj-2026-11-24", FORGE_H10_SHADOW_APPROVED_AT: "2026-11-24T12:00:00Z" })).toEqual({ error: "approval_or_code_version_missing" });
  });
});

const exec = promisify(execFile);
const bin = process.env.FORGE_V2_POSTGRES_BIN;
const migrations = ["20261029235656_forge_v2_immutable_history.sql", "20261123200000_forge_v2_goalie_h10.sql", "20261123210000_forge_v2_h10_partitions_archive.sql", "20261124000000_forge_h10_interval_editions.sql"].map(name => resolve(__dirname, "../../..", "supabase/migrations", name));
const MIN = 60000;

describe.runIf(Boolean(bin))("h10 hosted handler on disposable PostgreSQL (reader SQL, nightly freeze, resume, material)", () => {
  let root: string, socket: string, admin: Pool, started = false;
  const environment: NodeJS.ProcessEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PG"))), NODE_ENV: "test" };
  const now = Date.now(), cutoff = Date.parse(easternDailyDeadline(easternDate(new Date(now).toISOString()))) - 4 * 3600000;
  const league = syntheticLeague({ anchor: now, teams: 6, pastDays: 40 });
  const config: H10RouteConfig = { enabled: true, approvalEvidenceId: "fixture-route-proof", approvedAt: new Date(cutoff - 3600000).toISOString(), codeVersion: "local-route-test",
    seasonId: H10_SEASON, logIngestUtcMinute: 450, gameHours: 3.5, rosterMaxAgeHours: 36, maximumTrainingExamples: 1500, budgetMs: 120000, logsWindowDays: 60, minimumPlayers: 100, expectedTeams: 6 };
  const call = (mode: "nightly" | "material", extra: Partial<Parameters<typeof handleH10Shadow>[0]> = {}) => handleH10Shadow({ mode, now: Date.now(), db: admin as unknown as SqlConnection, config, ...extra });

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "forge-h10-route-")); socket = join(root, "socket");
    await mkdir(socket, { mode: 0o700 });
    await exec(join(bin!, "initdb"), ["-D", join(root, "data"), "--no-locale", "--encoding=UTF8", "--auth-local=trust", "--auth-host=reject", "-U", "forge_v2_fixture"], { env: environment });
    await exec(join(bin!, "pg_ctl"), ["-D", join(root, "data"), "-l", join(root, "server.log"), "-w", "-t", "10", "-o", `-c listen_addresses='' -c unix_socket_directories='${socket}' -p 65445`, "start"], { env: environment });
    started = true;
    admin = new Pool({ host: socket, port: 65445, user: "forge_v2_fixture", database: "postgres", max: 3 });
    await admin.query("create role anon; create role authenticated; create role service_role login");
    for (const file of migrations) await admin.query(await readFile(file, "utf8"));
    await seedH10Public(admin, league, cutoff);
  }, 120000);
  afterAll(async () => {
    await admin?.end();
    if (started) await exec(join(bin!, "pg_ctl"), ["-D", join(root, "data"), "-w", "-t", "10", "stop", "-m", "fast"], { env: environment });
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("skips before the 04:00 ET cutoff without touching the database", async () => {
    expect(await call("nightly", { now: cutoff - MIN, db: { query: async () => { throw new Error("no_db_expected"); } } })).toMatchObject({ status: 200, body: { status: "skipped", reason: "before_nightly_cutoff" } });
    // Material mode before 04:00 ET works against the previous night's freeze instead of skipping.
    const previousNight = easternDate(new Date(cutoff - 6 * 3600000).toISOString());
    expect(await call("material", { now: cutoff - MIN })).toMatchObject({ status: 409, body: { reason: "nightly_not_frozen", nightly: previousNight } });
  });

  // A refusal happens before any official roster request: no fetch, no record.
  let fetches = 0;
  const fetchRoster = async () => { fetches += 1; throw new Error("no_fetch_expected"); };
  it("refuses to freeze an empty lines read: 409, nothing fetched or written", async () => {
    const realRows = await import("./h10Reader.server").then(m => m.readH10Rows);
    const empty = await call("nightly", { fetchRoster, readRows: async (db, season, from) => ({ ...(await realRows(db, season, from)), logs: [] }) });
    expect(empty).toMatchObject({ status: 409, body: { reason: "training_below_minimum_support" } });
    expect((await admin.query("select count(*)::int n from forge_v2_private.forge_v2_records")).rows[0].n).toBe(0);
    expect(fetches).toBe(0);
  });

  it("refuses to freeze a short roster read: 409, nothing fetched or written", async () => {
    const realRows = await import("./h10Reader.server").then(m => m.readH10Rows);
    const short = await call("nightly", { fetchRoster, readRows: async (db, season, from) => { const rows = await realRows(db, season, from); return { ...rows, rosters: rows.rosters.slice(0, 40) }; } });
    expect(short).toMatchObject({ status: 409, body: { reason: expect.stringMatching(/^denominator_guard:/) } });
    expect((await admin.query("select count(*)::int n from forge_v2_private.forge_v2_records")).rows[0].n).toBe(0);
    expect(fetches).toBe(0);
  });

  it("freezes the nightly denominator once, continues under a tight budget, and completes on resume", async () => {
    // The nightly freeze happens 20 minutes ago, so later roster changes and events arrive after it.
    const night = Date.now() - 20 * MIN;
    const first = await call("nightly", { now: night, config: { ...config, budgetMs: 1 } });
    expect(first).toMatchObject({ status: 200, body: { status: "continued" } });
    let last = first;
    // Tight budgets throughout; the interval calibration defers until a call has its reserve (hosted-budget guard).
    let deferrals = 0;
    for (let i = 0; i < 80 && last.body.status !== "complete"; i++) {
      const deferred = Boolean((last.body.intervals as { deferred?: string } | null | undefined)?.deferred);
      if (deferred) deferrals += 1;
      last = await call("nightly", { now: night, config: { ...config, budgetMs: Date.now() - night + 1500 + (deferred ? CALIBRATION_RESERVE_MS : 0) } });
    }
    expect(deferrals).toBeGreaterThan(0);
    expect(last.body).toMatchObject({ status: "complete", scopes: 1380, goalieKeys: 120, jobs: { published: 1380 } });
    // Goalies run once the skater queues are done; every goalie key is issued under the goalie target.
    expect((await admin.query("select count(*)::int n from forge_v2_private.forge_v2_goalie_vintages")).rows[0].n).toBe(120);
    expect(last.body.denominatorSha256).toBe(first.body.denominatorSha256);
    const frozen = await admin.query("select count(*)::int n from forge_v2_private.forge_v2_records where kind='affiliation' and scope_key like 'forge-h10-nightly:%'");
    expect(frozen.rows[0].n).toBe(1);
    const vintages = await admin.query("select count(*)::int n, count(distinct payload::jsonb->>'evidenceClass')::int classes, min(payload::jsonb->>'evidenceClass') class from forge_v2_private.forge_v2_vintages");
    expect(vintages.rows[0]).toEqual({ n: 1380, classes: 1, class: "prospective_shadow" });
    let reads = 0;
    const counting = { query: (text: string, values?: unknown[]) => { reads += 1; return admin.query(text, values); } } as unknown as SqlConnection;
    const again = await call("nightly", { db: counting });
    expect(again.body).toMatchObject({ status: "complete", cached: true });
    expect(reads).toBe(1);
    expect((await admin.query("select count(*)::int n from forge_v2_private.forge_v2_vintages")).rows[0].n).toBe(1380);
    // Uncertainty: one immutable interval edition per published vintage, naming the night's one stored calibration.
    const calibrations = (await admin.query("select id, payload from forge_v2_private.forge_v2_records where kind = 'evaluation' and scope_key like 'forge-h10-interval-calibration:%'")).rows;
    expect(calibrations).toHaveLength(1);
    const editions = (await admin.query("select player_class, payload from forge_v2_private.forge_h10_interval_editions")).rows.map(r => ({ cls: r.player_class, e: JSON.parse(r.payload) }));
    expect(editions.filter(x => x.cls === "skater")).toHaveLength(1380);
    expect(editions.filter(x => x.cls === "goalie")).toHaveLength(120);
    expect(new Set(editions.map(x => x.e.calibration.id))).toEqual(new Set([calibrations[0].id]));
    const sample = editions.find(x => x.cls === "skater")!.e, vintage = JSON.parse((await admin.query("select payload from forge_v2_private.forge_v2_vintages where id = $1", [sample.vintageId])).rows[0].payload);
    expect(sample).toMatchObject({ conditionalOn: "official_appearance", combination: "marginal_per_category_not_summable", inputCutoffAt: vintage.inputCutoffAt, modelVersion: vintage.modelVersion, horizon: vintage.horizon });
    for (const c of Object.keys(vintage.means)) expect(sample.categories[c].point).toEqual(vintage.means[c]);
    const bands = editions.flatMap(x => Object.values(x.e.categories as Record<string, { intervals: { state: string; value?: Array<{ level: number; lower: number; upper: number }>; reason?: string };
      candidateIntervals: { state: string; reason?: string }; methods: Record<string, string> }>));
    expect(bands.filter(b => b.intervals.state === "available").every(b => b.intervals.value![0].lower <= b.intervals.value![0].upper && b.intervals.value![1].lower <= b.intervals.value![0].lower && b.intervals.value![1].upper >= b.intervals.value![0].upper)).toBe(true);
    expect(bands.filter(b => b.intervals.state !== "available").every(b => typeof b.intervals.reason === "string" && b.intervals.reason.length > 0)).toBe(true);
    // The rebuilt kernel reproduces every stored point forecast and model version (no silent drift).
    expect(bands.some(b => ["point_forecast_mismatch", "model_version_mismatch", "model_unavailable_at_cutoff"].includes(b.candidateIntervals.reason ?? ""))).toBe(false);
    // Every issued band names its method; goalie 50% bands are the labelled baseline (TJ policy).
    expect(bands.filter(b => b.intervals.state === "available").every(b => b.methods["0.5"] && b.methods["0.9"])).toBe(true);
    expect(editions.filter(x => x.cls === "goalie").every(x => Object.values(x.e.categories as Record<string, { methods: Record<string, string> }>).every(c => /_baseline$/.test(c.methods["0.5"])))).toBe(true);
    expect(bands.filter(b => b.intervals.state === "available").length).toBeGreaterThan(bands.length / 2);
    const marker = JSON.parse((await admin.query("select payload from forge_v2_private.forge_v2_records where scope_key like 'forge-h10-nightly-complete:%'")).rows[0].payload);
    expect(marker.intervals).toMatchObject({ calibrationId: calibrations[0].id, skater: { keys: 1380, editions: 1380, keysWithoutEdition: 0 }, goalie: { keys: 120, editions: 120, keysWithoutEdition: 0 } });
    // Editions are immutable, first-write-wins, and must name an existing vintage with its hash.
    await expect(admin.query("update forge_v2_private.forge_h10_interval_editions set payload = payload")).rejects.toThrow(/IMMUTABLE/);
    const copy = { ...sample, vintageId: "vintage:missing", id: "h10-interval:vintage:missing" };
    await expect(admin.query("insert into forge_v2_private.forge_h10_interval_editions (id, vintage_id, player_class, player_id, game_id, payload) values ($1, $2, 'skater', $3, $4, $5)",
      [copy.id, copy.vintageId, copy.playerId, copy.gameId, JSON.stringify(copy)])).rejects.toThrow(/INTERVAL_VINTAGE_MISSING/);
    await admin.query("insert into forge_v2_private.forge_h10_interval_editions (id, vintage_id, player_class, player_id, game_id, payload) values ($1, $2, 'skater', $3, $4, $5)",
      [sample.id, sample.vintageId, sample.playerId, sample.gameId, JSON.stringify({ ...sample, generatedAt: new Date().toISOString() })]);
    expect((await admin.query("select count(*)::int n from forge_v2_private.forge_h10_interval_editions where vintage_id = $1", [sample.vintageId])).rows[0].n).toBe(1);
    // Hosted budget: the uncalibrated replay never starts without its reserve; the dispatch ends "continued" instead.
    const tight = await runIntervalPhase({ db: admin as unknown as SqlConnection, denominator: { denominatorSha256: last.body.denominatorSha256 as string, asOf: marker.asOf, keys: [] },
      date: "reserve-test", calibrationAsOf: marker.asOf, logs: league.logs, goalieLogs: league.goalieLogs, schedule: league.schedule, seasonId: H10_SEASON, maximumTrainingExamples: 1500,
      clock: () => new Date().toISOString(), stopAfterMs: Date.now() + CALIBRATION_RESERVE_MS - 1000 });
    expect(tight).toMatchObject({ complete: false, deferred: "calibration_needs_budget_reserve", written: 0 });
    expect((await admin.query("select count(*)::int n from forge_v2_private.forge_v2_records where scope_key = 'forge-h10-interval-calibration:reserve-test'")).rows[0].n).toBe(0);
  }, 600000);

  it("turns a roster move and an injury event into material revisions for exactly those players", async () => {
    expect((await call("material")).body.status).toBe("no_change");
    const moved = new Date(Date.now() - 7 * MIN).toISOString();
    await admin.query("update public.rosters set \"teamId\" = $1, official_seen_at = $2 where \"playerId\" = $3", [MTL, moved, LARKIN]);
    const injured = league.roster.find(p => p.teamId === DET && p.position === "D")!.playerId;
    await admin.query("insert into public.forge_roster_events (created_at, event_type, player_id, team_id) values ($1, 'INJURY', $2, $3)", [moved, injured, DET]);
    const result = await call("material");
    expect(result.body).toMatchObject({ status: "complete", moved: 1, availability: 1 });
    // The injury revision names its roster event; the move names the roster change.
    const sources = (await admin.query("select payload from forge_v2_private.forge_v2_vintages where payload::jsonb->>'trigger' = 'material'")).rows
      .map(r => JSON.parse(r.payload)).map(v => [v.playerId, v.sourceManifest.map((x: { source: string }) => x.source)]);
    expect(sources.filter(([id]) => id === injured).every(([, names]) => names.includes("public.forge_roster_events"))).toBe(true);
    expect(sources.filter(([id]) => id === LARKIN).every(([, names]) => names.includes("public.rosters"))).toBe(true);
    const larkin = (await admin.query("select payload from forge_v2_private.forge_v2_vintages where player_id = $1", [LARKIN])).rows.map(r => JSON.parse(r.payload));
    expect(larkin.filter(v => v.trigger === "material" && v.teamId === MTL)).toHaveLength(10);
    const hurt = (await admin.query("select payload from forge_v2_private.forge_v2_vintages where player_id = $1 and payload::jsonb->>'trigger' = 'material'", [injured])).rows;
    expect(hurt).toHaveLength(10);
    const others = (await admin.query("select count(*)::int n from forge_v2_private.forge_v2_vintages where payload::jsonb->>'trigger' = 'material' and player_id not in ($1, $2)", [LARKIN, injured])).rows[0].n;
    expect(others).toBe(0);
    const before = (await admin.query("select count(*)::int n from forge_v2_private.forge_v2_vintages")).rows[0].n;
    expect((await call("material")).body.status).toBe("complete");
    expect((await admin.query("select count(*)::int n from forge_v2_private.forge_v2_vintages")).rows[0].n).toBe(before);
    // A second, later injury re-issues only that player, never the earlier ones.
    const second = league.roster.find(p => p.teamId === MTL && p.position === "D")!.playerId;
    await admin.query("insert into public.forge_roster_events (created_at, event_type, player_id, team_id) values ($1, 'DTD', $2, $3)", [new Date(Date.now() - 6 * MIN).toISOString(), second, MTL]);
    expect((await call("material")).body).toMatchObject({ status: "complete" });
    const added = (await admin.query("select player_id::int, count(*)::int n from forge_v2_private.forge_v2_vintages where payload::jsonb->>'trigger' = 'material' group by 1 order by 1")).rows;
    expect(added).toEqual([LARKIN, injured, second].sort((a, b) => a - b).map(id => ({ player_id: id, n: 10 })));
    // Material revisions get their own editions; earlier editions stay as issued.
    const material = (await admin.query("select count(*)::int n from forge_v2_private.forge_h10_interval_editions e join forge_v2_private.forge_v2_vintages v on v.id = e.vintage_id where v.payload::jsonb->>'trigger' = 'material'")).rows[0].n;
    expect(material).toBe(30);
    expect((await admin.query("select count(*)::int n from forge_v2_private.forge_v2_records where kind = 'evaluation' and scope_key like 'forge-h10-interval-calibration:%'")).rows[0].n).toBe(1);
  }, 900000);
});

// Regression (Chef, 2026-11-24): a night with any key not issued (a failed or expired skater job, or a goalie gap such
// as a publication that failed all its retries) must never mark itself complete; transient errors retry to one edition.
describe.runIf(Boolean(bin))("h10 nightly with failed skater jobs never completes", () => {
  let root: string, socket: string, admin: Pool, started = false;
  const environment: NodeJS.ProcessEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PG"))), NODE_ENV: "test" };
  const now = Date.now(), cutoff = Date.parse(easternDailyDeadline(easternDate(new Date(now).toISOString()))) - 4 * 3600000;
  const league = syntheticLeague({ anchor: now, teams: 6, pastDays: 40 });
  const config: H10RouteConfig = { enabled: true, approvalEvidenceId: "fixture-route-failure", approvedAt: new Date(cutoff - 3600000).toISOString(), codeVersion: "local-route-test",
    seasonId: H10_SEASON, logIngestUtcMinute: 450, gameHours: 3.5, rosterMaxAgeHours: 36, maximumTrainingExamples: 1500, budgetMs: 120000, logsWindowDays: 60, minimumPlayers: 100, expectedTeams: 6 };

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "forge-h10-route-fail-")); socket = join(root, "socket");
    await mkdir(socket, { mode: 0o700 });
    await exec(join(bin!, "initdb"), ["-D", join(root, "data"), "--no-locale", "--encoding=UTF8", "--auth-local=trust", "--auth-host=reject", "-U", "forge_v2_fixture"], { env: environment });
    await exec(join(bin!, "pg_ctl"), ["-D", join(root, "data"), "-l", join(root, "server.log"), "-w", "-t", "10", "-o", `-c listen_addresses='' -c unix_socket_directories='${socket}' -p 65446`, "start"], { env: environment });
    started = true;
    admin = new Pool({ host: socket, port: 65446, user: "forge_v2_fixture", database: "postgres", max: 3 });
    await admin.query("create role anon; create role authenticated; create role service_role login");
    for (const file of migrations) await admin.query(await readFile(file, "utf8"));
    await seedH10Public(admin, league, cutoff);
  }, 120000);
  afterAll(async () => {
    await admin?.end();
    if (started) await exec(join(bin!, "pg_ctl"), ["-D", join(root, "data"), "-w", "-t", "10", "stop", "-m", "fast"], { env: environment });
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("retries transient publish errors to one edition, and reports persistent ones as incomplete (never complete); later ticks repeat it", async () => {
    // Skaters: every receipt for one player in nine fails on every attempt; for another one in nine, only the first.
    // Goalies: every receipt of one goalie fails (all three in-call attempts); another goalie's first receipt fails once.
    const [persistentGoalie, transientGoalie] = league.roster.filter(p => p.position === "G").map(p => p.playerId);
    const failedOnce = new Set<string>();
    const flaky = { query: async (text: string, values?: unknown[]) => {
      if (/insert into forge_v2_private\.forge_v2_publication_receipts/.test(text)) {
        const player = Number(values?.[3]), id = String(values?.[0]);
        if (player % 9 === 0) throw new Error("injected_persistent_database_error");
        if (player % 9 === 1 && !failedOnce.has(id)) { failedOnce.add(id); throw new Error("injected_transient_database_error"); }
      }
      if (/insert into forge_v2_private\.forge_v2_goalie_publication_receipts/.test(text)) {
        const id = String(values?.[0]), player = Number((await admin.query("select player_id from forge_v2_private.forge_v2_goalie_vintages where id = $1", [id])).rows[0]?.player_id);
        if (player === persistentGoalie) throw new Error("injected_persistent_database_error");
        if (player === transientGoalie && !failedOnce.has(id)) { failedOnce.add(id); throw new Error("injected_transient_database_error"); }
      }
      return admin.query(text, values);
    } } as unknown as SqlConnection;
    const night = Date.now() - 20 * MIN;
    let last = await handleH10Shadow({ mode: "nightly", now: night, db: flaky, config });
    // Skater retries are due 60 s apart (three attempts); until the night finishes it is "continued", never complete.
    for (let i = 0; i < 60 && last.body.status === "continued"; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      last = await handleH10Shadow({ mode: "nightly", now: night, db: flaky, config: { ...config, budgetMs: Date.now() - night + 120000 } });
    }
    const keys = JSON.parse((await admin.query("select payload from forge_v2_private.forge_v2_records where scope_key like 'forge-h10-nightly:%'")).rows[0].payload).denominator.keys as Array<{ playerId: number; playerClass: string }>;
    const persistentSkaterKeys = keys.filter(k => k.playerClass === "skater" && k.playerId % 9 === 0).length, persistentGoalieKeys = keys.filter(k => k.playerId === persistentGoalie).length;
    expect(persistentSkaterKeys).toBeGreaterThan(0);
    expect(last.body).toMatchObject({ success: false, status: "incomplete", reason: "keys_not_issued", finished: true, complete: false,
      shortfall: { skaterJobsFailed: persistentSkaterKeys, goalieGaps: { "publish_failed:injected_persistent_database_error": persistentGoalieKeys } } });
    expect((await admin.query("select count(*)::int n from forge_v2_private.forge_v2_records where scope_key like 'forge-h10-nightly-complete:%'")).rows[0].n).toBe(0);
    const marker = (await admin.query("select payload from forge_v2_private.forge_v2_records where scope_key like 'forge-h10-nightly-incomplete:%'")).rows;
    expect(marker).toHaveLength(1);
    expect(JSON.parse(marker[0].payload)).toMatchObject({ reason: "keys_not_issued", shortfall: { skaterJobsFailed: persistentSkaterKeys } });
    // Transient failures were retried to exactly one edition per key: one vintage, one receipt, every key published.
    for (const [V, R, players] of [["forge_v2_vintages", "forge_v2_publication_receipts", "player_id % 9 = 1"], ["forge_v2_goalie_vintages", "forge_v2_goalie_publication_receipts", `player_id = ${transientGoalie}`]]) {
      const row = (await admin.query(`select count(*)::int vintages, count(distinct (player_id, game_id))::int keys, count(r.vintage_id)::int receipts
        from forge_v2_private.${V} v left join forge_v2_private.${R} r on r.vintage_id = v.id where ${players}`)).rows[0];
      expect(row.vintages).toBeGreaterThan(0);
      expect(row).toEqual({ vintages: row.keys, keys: row.keys, receipts: row.keys });
    }
    expect(failedOnce.size).toBeGreaterThan(0);
    let reads = 0;
    const counting = { query: (text: string, values?: unknown[]) => { reads += 1; return admin.query(text, values); } } as unknown as SqlConnection;
    const again = await handleH10Shadow({ mode: "nightly", now: Date.now(), db: counting, config });
    expect(again.body).toMatchObject({ success: false, status: "incomplete", cached: true, reason: "keys_not_issued" });
    expect(reads).toBe(2);
  }, 900000);
});

// Ambiguous publication (TJ, 2026-11-24): the receipt write commits, then the response is lost, so the worker sees an
// error and retries through its normal path (skaters: the queue, at a later tick; goalies: the in-call retry). The retry
// must reuse the original edition: exactly one vintage and one receipt per key, same id and bytes, no extra sequence,
// and the night's status must reflect what actually published.
describe.runIf(Boolean(bin))("h10 nightly after a lost publication response", () => {
  let root: string, socket: string, admin: Pool, started = false;
  const environment: NodeJS.ProcessEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PG"))), NODE_ENV: "test" };
  const now = Date.now(), cutoff = Date.parse(easternDailyDeadline(easternDate(new Date(now).toISOString()))) - 4 * 3600000;
  const league = syntheticLeague({ anchor: now, teams: 6, pastDays: 40 });
  const config: H10RouteConfig = { enabled: true, approvalEvidenceId: "fixture-route-lost-response", approvedAt: new Date(cutoff - 3600000).toISOString(), codeVersion: "local-route-test",
    seasonId: H10_SEASON, logIngestUtcMinute: 450, gameHours: 3.5, rosterMaxAgeHours: 36, maximumTrainingExamples: 1500, budgetMs: 120000, logsWindowDays: 60, minimumPlayers: 100, expectedTeams: 6 };

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "forge-h10-route-lost-")); socket = join(root, "socket");
    await mkdir(socket, { mode: 0o700 });
    await exec(join(bin!, "initdb"), ["-D", join(root, "data"), "--no-locale", "--encoding=UTF8", "--auth-local=trust", "--auth-host=reject", "-U", "forge_v2_fixture"], { env: environment });
    await exec(join(bin!, "pg_ctl"), ["-D", join(root, "data"), "-l", join(root, "server.log"), "-w", "-t", "10", "-o", `-c listen_addresses='' -c unix_socket_directories='${socket}' -p 65463`, "start"], { env: environment });
    started = true;
    admin = new Pool({ host: socket, port: 65463, user: "forge_v2_fixture", database: "postgres", max: 3 });
    await admin.query("create role anon; create role authenticated; create role service_role login");
    for (const file of migrations) await admin.query(await readFile(file, "utf8"));
    await seedH10Public(admin, league, cutoff);
  }, 120000);
  afterAll(async () => {
    await admin?.end();
    if (started) await exec(join(bin!, "pg_ctl"), ["-D", join(root, "data"), "-w", "-t", "10", "stop", "-m", "fast"], { env: environment });
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("retries a committed-but-unacknowledged publication to the original edition (skaters via the queue, goalies in call) and completes", async () => {
    const goalie = league.roster.find(p => p.position === "G")!.playerId;
    const lost = new Map<string, { cls: string; outputHash: string }>(); // vintage id → what the first (committed) write stored
    const lossy = { query: async (text: string, values?: unknown[]) => {
      const skater = /insert into forge_v2_private\.forge_v2_publication_receipts/.test(text), goalieReceipt = /insert into forge_v2_private\.forge_v2_goalie_publication_receipts/.test(text);
      const id = String(values?.[0]);
      const target = skater ? Number(values?.[3]) % 11 === 2
        : goalieReceipt ? Number((await admin.query("select player_id from forge_v2_private.forge_v2_goalie_vintages where id = $1", [id])).rows[0]?.player_id) === goalie : false;
      const result = await admin.query(text, values); // the write commits (autocommit)
      if (target && !lost.has(id)) {
        const table = skater ? "forge_v2_vintages" : "forge_v2_goalie_vintages";
        const stored = (await admin.query(`select output_hash from forge_v2_private.${table} where id = $1`, [id])).rows[0];
        lost.set(id, { cls: skater ? "skater" : "goalie", outputHash: stored.output_hash });
        throw new Error("injected_lost_response_after_commit");
      }
      return result;
    } } as unknown as SqlConnection;
    const night = Date.now() - 20 * MIN;
    let last = await handleH10Shadow({ mode: "nightly", now: night, db: lossy, config });
    for (let i = 0; i < 60 && last.body.status === "continued"; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      last = await handleH10Shadow({ mode: "nightly", now: night, db: lossy, config: { ...config, budgetMs: Date.now() - night + 120000 } });
    }
    const skaterLost = [...lost.values()].filter(x => x.cls === "skater").length, goalieLost = [...lost.values()].filter(x => x.cls === "goalie").length;
    expect(skaterLost).toBeGreaterThan(0);
    expect(goalieLost).toBeGreaterThan(0);
    // The status reflects what published: every key issued, so complete, with no failed job and no gap.
    expect(last.body).toMatchObject({ status: "complete", complete: true, jobs: { published: 1380 } });
    expect(last.body.jobs).not.toHaveProperty("failed");
    expect((last.body.goalies as { gaps: unknown[]; published: number; reused: number }).gaps).toEqual([]);
    expect((await admin.query("select count(*)::int n from forge_v2_private.forge_v2_records where scope_key like 'forge-h10-nightly-complete:%'")).rows[0].n).toBe(1);
    // By key: one vintage, one receipt, the original edition (same id and bytes), one issuance sequence.
    for (const [id, first] of lost) {
      const [V, R] = first.cls === "skater" ? ["forge_v2_vintages", "forge_v2_publication_receipts"] : ["forge_v2_goalie_vintages", "forge_v2_goalie_publication_receipts"];
      const key = (await admin.query(`select player_id, game_id from forge_v2_private.${V} where id = $1`, [id])).rows[0];
      const rows = (await admin.query(`select v.id, v.output_hash, v.issuance_key, v.issuance_sequence, r.vintage_id as receipt, r.output_hash as receipt_hash
        from forge_v2_private.${V} v left join forge_v2_private.${R} r on r.vintage_id = v.id where v.player_id = $1 and v.game_id = $2`, [key.player_id, key.game_id])).rows;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ id, output_hash: first.outputHash, receipt: id, receipt_hash: first.outputHash });
      expect((await admin.query(`select count(*)::int n from forge_v2_private.${R} where vintage_id = $1`, [id])).rows[0].n).toBe(1);
    }
    // The skater retries went through the queue's normal path: attempt 2 published the original edition, recognised as a
    // publication that predates the attempt (pipeline.server.ts recoveredPublication, refresh.ts validation).
    const skaterIds = [...lost].filter(([, x]) => x.cls === "skater").map(([id]) => id);
    const jobs = (await admin.query("select state from forge_v2_private.forge_v2_work_queue")).rows.flatMap(r => (typeof r.state === "string" ? JSON.parse(r.state) : r.state).jobs as Array<{ vintageId: string | null; status: string; attempts: number; recoveredPublication?: { vintage: { id: string } } }>);
    const retried = jobs.filter(j => j.vintageId && skaterIds.includes(j.vintageId));
    expect(retried).toHaveLength(skaterIds.length);
    expect(retried.every(j => j.status === "published" && j.attempts === 2 && j.recoveredPublication?.vintage.id === j.vintageId)).toBe(true);
    // Overall: no second edition anywhere (one vintage per issued key) and every vintage has its one receipt.
    for (const [V, R, n] of [["forge_v2_vintages", "forge_v2_publication_receipts", 1380], ["forge_v2_goalie_vintages", "forge_v2_goalie_publication_receipts", 120]] as const) {
      expect((await admin.query(`select count(*)::int v, count(distinct (player_id, game_id))::int k, count(distinct issuance_sequence)::int s,
        (select count(*)::int from forge_v2_private.${R}) r from forge_v2_private.${V}`)).rows[0]).toEqual({ v: n, k: n, s: n, r: n });
    }
  }, 900000);
});
