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
import { handleH10Shadow, h10DenominatorGuard, h10RouteConfig, H10RouteConfig } from "./h10Route.server";
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
  it("is off by default and fails closed without an approval id or code version", () => {
    expect(h10RouteConfig({})).toEqual({ error: "disabled" });
    expect(h10RouteConfig({ FORGE_H10_SHADOW_ENABLED: "true", VERCEL_GIT_COMMIT_SHA: "abc" })).toEqual({ error: "approval_or_code_version_missing" });
    expect(h10RouteConfig({ FORGE_H10_SHADOW_ENABLED: "true", FORGE_H10_SHADOW_APPROVAL_ID: "tj-2026-11-24", FORGE_H10_SHADOW_APPROVED_AT: "2026-11-24T12:00:00Z" })).toEqual({ error: "approval_or_code_version_missing" });
  });
});

const exec = promisify(execFile);
const bin = process.env.FORGE_V2_POSTGRES_BIN;
const migrations = ["20261029235656_forge_v2_immutable_history.sql", "20261123200000_forge_v2_goalie_h10.sql", "20261123210000_forge_v2_h10_partitions_archive.sql"].map(name => resolve(__dirname, "../../..", "supabase/migrations", name));
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
    for (let i = 0; i < 80 && last.body.status !== "complete"; i++) last = await call("nightly", { now: night, config: { ...config, budgetMs: Date.now() - night + 1500 } });
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
  }, 600000);
});
