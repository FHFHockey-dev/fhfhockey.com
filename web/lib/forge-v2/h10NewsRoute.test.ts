// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { Pool } from "pg";
import { SqlConnection } from "./history.server";
import { DET, H10_SEASON, MONTEMBEAULT, MTL, seedH10Public, syntheticLeague } from "./h10Fixtures";
import { handleH10Shadow, H10RouteConfig } from "./h10Route.server";
import { H10NewsReadOverflow, newsStep, readNewsRows } from "./h10NewsRoute.server";
import { resolveAvailability } from "./h10News";
import { easternDailyDeadline, easternDate } from "./refresh";
import { teamsInfo } from "../teamsInfo";

const exec = promisify(execFile);
const bin = process.env.FORGE_V2_POSTGRES_BIN;
const migrations = ["20261029235656_forge_v2_immutable_history.sql", "20261123200000_forge_v2_goalie_h10.sql", "20261123210000_forge_v2_h10_partitions_archive.sql"].map(name => resolve(__dirname, "../../..", "supabase/migrations", name));
const MIN = 60000;

/** FxTwitter/News material path end to end on disposable PostgreSQL: the real news SQL over the production column
 * names, a fake official roster endpoint (no network), the nightly sweep, the recheck and the overlay. */
describe.runIf(Boolean(bin))("h10 FxTwitter material path on disposable PostgreSQL", () => {
  let root: string, socket: string, admin: Pool, started = false;
  const environment: NodeJS.ProcessEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PG"))), NODE_ENV: "test" };
  const now = Date.now(), cutoff = Date.parse(easternDailyDeadline(easternDate(new Date(now).toISOString()))) - 4 * 3600000;
  const league = syntheticLeague({ anchor: now, teams: 6, pastDays: 40 });
  const config: H10RouteConfig = { enabled: true, approvalEvidenceId: "fixture-news-proof", approvedAt: new Date(cutoff - 3600000).toISOString(), codeVersion: "local-news-test",
    seasonId: H10_SEASON, logIngestUtcMinute: 450, gameHours: 3.5, rosterMaxAgeHours: 36, maximumTrainingExamples: 1500, budgetMs: 120000, logsWindowDays: 60, minimumPlayers: 100, expectedTeams: 6 };
  // The official roster: the league roster with overrides; every request is logged.
  const official = new Map<number, number>(), fetched: string[] = [];
  const fetchRoster = async (abbrev: string) => {
    fetched.push(abbrev);
    const teamId = Object.values(teamsInfo).find(team => team.abbrev === abbrev)!.id;
    const players = league.roster.filter(p => (official.get(p.playerId) ?? p.teamId) === teamId);
    const group = (position: string) => players.filter(p => p.position === position).map(p => ({ id: p.playerId }));
    return { forwards: group("F"), defensemen: group("D"), goalies: group("G") };
  };
  const call = (mode: "nightly" | "material", extra: Partial<Parameters<typeof handleH10Shadow>[0]> = {}) =>
    handleH10Shadow({ mode, now: Date.now(), db: admin as unknown as SqlConnection, config, readNews: readNewsRows, fetchRoster, ...extra });
  const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
  const post = async (playerId: number, teamId: number, category: string, subcategory: string, postedAt: string) => {
    const id = (await admin.query(`insert into public.news_feed_items (source_tweet_id, original_tweet_id, tweet_url, source_account, team_id, headline, category, subcategory, card_status, observed_at, published_at, updated_at)
      values ($1, $1, $2, 'canadiensmtl', $3, $4, $5, $6, 'published', $7, now(), now()) returning id::text`,
      [`${playerId}-${category}-${subcategory}-${postedAt}`, `https://x.com/CanadiensMTL/status/${playerId}${Date.parse(postedAt)}`, teamId, `${category} ${playerId}`, category, subcategory, postedAt])).rows[0].id;
    await admin.query("insert into public.news_feed_item_players (news_item_id, player_id, player_name, team_id) values ($1, $2, $3, $4)", [id, playerId, `P${playerId}`, teamId]);
    return id as string;
  };
  const count = async (sql: string, values: unknown[] = []) => (await admin.query(sql, values)).rows[0].n as number;
  const overlays = async (playerId: number) => (await admin.query("select id, predecessor_id, payload from forge_v2_private.forge_h10_evidence where scope_key = 'forge-h10-overlay' and (payload::jsonb->'overlay'->>'playerId')::int = $1 order by ordinal", [playerId])).rows
    .map(r => ({ id: r.id as string, predecessor: r.predecessor_id as string | null, ...JSON.parse(r.payload) }));
  const nightlyMover = league.roster.find(p => p.teamId === DET && p.position === "D")!.playerId;
  const forward = league.roster.filter(p => p.teamId === MTL && p.position === "F")[0].playerId, other = league.roster.filter(p => p.teamId === MTL && p.position === "F")[1].playerId;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "forge-h10-news-")); socket = join(root, "socket");
    await mkdir(socket, { mode: 0o700 });
    await exec(join(bin!, "initdb"), ["-D", join(root, "data"), "--no-locale", "--encoding=UTF8", "--auth-local=trust", "--auth-host=reject", "-U", "forge_v2_fixture"], { env: environment });
    await exec(join(bin!, "pg_ctl"), ["-D", join(root, "data"), "-l", join(root, "server.log"), "-w", "-t", "10", "-o", `-c listen_addresses='' -c unix_socket_directories='${socket}' -p 65449`, "start"], { env: environment });
    started = true;
    admin = new Pool({ host: socket, port: 65449, user: "forge_v2_fixture", database: "postgres", max: 3 });
    await admin.query("create role anon; create role authenticated; create role service_role login");
    for (const file of migrations) await admin.query(await readFile(file, "utf8"));
    await seedH10Public(admin, league, cutoff);
  }, 120000);
  afterAll(async () => {
    await admin?.end();
    if (started) await exec(join(bin!, "pg_ctl"), ["-D", join(root, "data"), "-w", "-t", "10", "stop", "-m", "fast"], { env: environment });
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("nightly reads every club's official roster without any tweet, and a move it shows needs no report", async () => {
    official.set(nightlyMover, MTL); // the official roster moved him; `rosters` still says DET
    const night = Date.now() - 20 * MIN;
    const first = await call("nightly", { now: night, readNews: undefined, config: { ...config, budgetMs: 1 } });
    expect(first.body).toMatchObject({ status: "continued", official: { clubs: 6, failures: [], newMoves: [{ playerId: nightlyMover, from: DET, to: MTL }] } });
    expect([...fetched].sort()).toEqual(league.teams.map(id => Object.values(teamsInfo).find(t => t.id === id)!.abbrev).sort());
    let last = first;
    for (let i = 0; i < 80 && last.body.status !== "complete"; i++) last = await call("nightly", { now: night, readNews: undefined, config: { ...config, budgetMs: Date.now() - night + 1500 } });
    expect(last.body.status).toBe("complete");
    expect(fetched).toHaveLength(6); // resumed calls reuse the freeze and read nothing again
    const keys = (await admin.query("select payload from forge_v2_private.forge_v2_vintages where player_id = $1", [nightlyMover])).rows.map(r => JSON.parse(r.payload));
    expect(keys.map(v => v.teamId)).toEqual(Array(10).fill(MTL));
  }, 600000);

  it("a trade report prompts a bounded recheck but cannot move a player by itself", async () => {
    fetched.length = 0;
    await post(MONTEMBEAULT, DET, "TRADE", "COMPLETED TRADE", iso(10 * MIN));
    const result = await call("material");
    expect(result.body).toMatchObject({ status: "no_change", news: { added: 1, pendingReports: 1, confirmedReports: 0, recheck: { clubs: [MTL, DET], failures: [], newMoves: [] } } });
    expect(fetched).toEqual(["MTL", "DET"]);
    expect(await count("select count(*)::int n from forge_v2_private.forge_v2_goalie_vintages where player_id = $1 and payload::jsonb->>'teamId' = $2", [MONTEMBEAULT, String(DET)])).toBe(0);
  }, 120000);

  it("once the official roster confirms it, the player's next ten targets are rebuilt under the new club, once", async () => {
    official.set(MONTEMBEAULT, DET);
    fetched.length = 0;
    const result = await call("material");
    expect(result.body).toMatchObject({ status: "complete", moved: 1, news: { added: 0, duplicates: 1, confirmedReports: 1, recheck: { newMoves: [{ playerId: MONTEMBEAULT, from: MTL, to: DET }] } } });
    const detroit = (await admin.query("select payload from forge_v2_private.forge_v2_goalie_vintages where player_id = $1", [MONTEMBEAULT])).rows.map(r => JSON.parse(r.payload)).filter(v => v.teamId === DET);
    expect(detroit.map(v => v.horizon).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // Each revision carries the official observation and the post that prompted the recheck.
    expect(detroit.every(v => ["api-web.nhle.com", "public.news_feed_items"].every(name => v.sourceManifest.some((s: { source: string }) => s.source === name)))).toBe(true);
    const before = await count("select count(*)::int n from forge_v2_private.forge_v2_goalie_vintages");
    fetched.length = 0;
    expect((await call("material")).body).toMatchObject({ status: "complete", news: { added: 0, pendingReports: 0 } });
    expect(fetched).toEqual([]); // confirmed reports are never rechecked
    expect(await count("select count(*)::int n from forge_v2_private.forge_v2_goalie_vintages")).toBe(before);
  }, 300000);

  it("an out report withholds the stored forecast; a late confirmed return restores the same vintage", async () => {
    const vintagesBefore = await count("select count(*)::int n from forge_v2_private.forge_v2_vintages");
    await post(forward, MTL, "INJURY", "OUT", iso(8 * MIN));
    const out = await call("material");
    expect(out.body).toMatchObject({ overlay: { written: 10 } });
    const injured = await overlays(forward);
    expect(injured.map(o => o.overlay.availability)).toEqual(Array(10).fill("out"));
    const stored = new Map(injured.map(o => [o.overlay.gameId, o.vintage]));
    expect([...stored.values()].every(v => v && v.id.length > 0)).toBe(true);
    // A projected return changes nothing for availability.
    await post(forward, MTL, "RETURN", "PROJECTED RETURN", iso(6 * MIN));
    await call("material");
    expect((await overlays(forward)).filter(o => o.overlay.availability !== "out")).toEqual([]);
    // The explicit return (posted 5 min ago) lifts the overlay: the same stored vintage is served, nothing is re-issued.
    await post(forward, MTL, "RETURN", "RETURNING", iso(5 * MIN));
    const back = await call("material");
    expect(back.body).toMatchObject({ overlay: { written: 10 } });
    const latest = new Map((await overlays(forward)).map(o => [o.overlay.gameId, o]));
    expect([...latest.values()].map(o => o.overlay.availability)).toEqual(Array(10).fill("available"));
    expect([...latest.values()].every(o => o.vintage.id === stored.get(o.overlay.gameId).id && o.vintage.outputHash === stored.get(o.overlay.gameId).outputHash)).toBe(true);
    expect([...latest.values()].every(o => o.predecessor !== null)).toBe(true);
    expect(await count("select count(*)::int n from forge_v2_private.forge_v2_vintages")).toBe(vintagesBefore);
  }, 300000);

  it("stale, conflicting and duplicate reports never overwrite newer evidence", async () => {
    const revisions = async () => count("select count(*)::int n from forge_v2_private.forge_h10_evidence where scope_key = 'forge-h10-overlay'");
    const before = await revisions();
    // Redelivery: nothing new is stored and no overlay changes.
    expect((await call("material")).body).toMatchObject({ news: { added: 0 }, overlay: { written: 0 } });
    // A stale out report (posted before the return, first seen now) changes nothing.
    await post(forward, MTL, "INJURY", "OUT", iso(9 * MIN));
    expect((await call("material")).body).toMatchObject({ news: { added: 1 }, overlay: { written: 0 } });
    expect(await revisions()).toBe(before);
    // Same-time contradiction: recorded as a conflict, the player stays available.
    const same = iso(4 * MIN);
    await post(other, MTL, "SCRATCHES", "CONFIRMED SCRATCH", same);
    await post(other, MTL, "RETURN", "RETURNING", same);
    await call("material");
    const conflicted = await overlays(other);
    expect(conflicted.length).toBeGreaterThan(0);
    expect(conflicted.every(o => o.overlay.availability === "available" && o.overlay.conflicts.length === 2)).toBe(true);
  }, 300000);

  it("an OUT report followed by real ice time is lifted from FORGE's first observation, with play assumed (approved rule)", async () => {
    const fourth = league.roster.filter(p => p.teamId === MTL && p.position === "F")[3].playerId;
    // Reported out 50 h ago; the fixture has him playing games since, with ice time and box scores already ingested.
    await post(fourth, MTL, "INJURY", "OUT", iso(50 * 3600000));
    const first = await call("material");
    expect((first.body.overlay as { appearances: number }).appearances).toBeGreaterThan(0);
    const lifted = (await overlays(fourth)).map(o => o.overlay);
    expect(lifted.length).toBeGreaterThan(0);
    expect(lifted.every(o => o.availability === "available" && o.annotations.includes("participation_assumed_not_confirmed") && o.evidence.every((e: string) => e.startsWith("forge-h10-appearance:")))).toBe(true);
    const stamps = async () => (await admin.query("select id, payload::jsonb->>'firstObservedAt' as t from forge_v2_private.forge_h10_evidence where scope_key = 'forge-h10-appearance' and (payload::jsonb->>'playerId')::int = $1 order by id", [fourth])).rows;
    const before = await stamps();
    expect(before.length).toBeGreaterThan(0);
    await call("material");
    expect(await stamps()).toEqual(before); // first observation kept
    // A teammate reported out whose only lines have no ice time (dressed, did not play) stays out.
    const fifth = league.roster.filter(p => p.teamId === MTL && p.position === "F")[4].playerId;
    await admin.query("update public.wgo_skater_stats set toi_per_game = 0 where player_id = $1", [fifth]);
    await post(fifth, MTL, "INJURY", "OUT", iso(50 * 3600000));
    await call("material");
    expect((await overlays(fifth)).map(o => o.overlay.availability).every(a => a === "out")).toBe(true);
  }, 120000);

  it("out, then a box-score appearance: lifted as a new revision restoring the same stored forecast; out, then practice or projected lines: still out", async () => {
    const [sixth, seventh] = league.roster.filter(p => p.teamId === MTL && p.position === "F").slice(5, 7).map(p => p.playerId);
    // Hold his box-score lines back (no ice time yet), so the OUT is recorded first.
    await admin.query("update public.wgo_skater_stats set toi_per_game = 0 where player_id = $1", [sixth]);
    await post(sixth, MTL, "INJURY", "OUT", iso(50 * 3600000));
    await call("material");
    const held = await overlays(sixth);
    expect(held.length).toBeGreaterThan(0);
    expect(held.every(o => o.overlay.availability === "out")).toBe(true);
    // The official box score arrives (ice time recorded): a new revision lifts the hold, citing the box score.
    await admin.query("update public.wgo_skater_stats set toi_per_game = 900 where player_id = $1", [sixth]);
    await call("material");
    const all = await overlays(sixth), latest = new Map(all.map(o => [o.overlay.gameId, o]));
    for (const [gameId, o] of latest) {
      const before = held.find(h => h.overlay.gameId === gameId)!;
      expect(o.id).not.toBe(before.id);
      expect(o.predecessor).toBe(before.id);
      expect(o.overlay).toMatchObject({ availability: "available", annotations: ["participation_assumed_not_confirmed"] });
      expect(o.overlay.evidence.every((e: string) => e.startsWith("forge-h10-appearance:"))).toBe(true);
      expect(o.vintage).toEqual(before.vintage); // the stored if-playing forecast, unchanged
    }
    // Practice lines and a projected return are not box scores: the teammate stays out.
    await admin.query("update public.wgo_skater_stats set toi_per_game = 0 where player_id = $1", [seventh]);
    await post(seventh, MTL, "INJURY", "OUT", iso(50 * 3600000));
    await post(seventh, MTL, "LINE COMBINATION", "PRACTICE LINES", iso(2 * 3600000));
    await post(seventh, MTL, "RETURN", "PROJECTED RETURN", iso(3600000));
    await call("material");
    expect((await overlays(seventh)).map(o => o.overlay.availability).every(a => a === "out")).toBe(true);
  }, 120000);

  it("too many cards for one read: the news step is refused as a reported gap; membership still runs", async () => {
    const before = await count("select count(*)::int n from forge_v2_private.forge_h10_evidence");
    const overflow = async () => { throw new H10NewsReadOverflow("2026-11-20T00:00:00.000Z", { updatedAt: "2026-11-21T00:00:00.000Z", id: "x" }, 5000); };
    const result = await call("material", { readNews: overflow });
    expect(result.body).toMatchObject({ success: true, news: { status: "refused", reason: "h10_news_read_cap_exceeded", read: 5000 } });
    expect(result.body).not.toHaveProperty("overlay");
    expect(await count("select count(*)::int n from forge_v2_private.forge_h10_evidence")).toBe(before);
  }, 120000);

  it("an out overlay never lapses with age: only an explicit return lifts it", async () => {
    const third = league.roster.filter(p => p.teamId === MTL && p.position === "F")[2].playerId;
    await post(third, MTL, "INJURY", "OUT", iso(3 * MIN));
    await call("material");
    // Eight days on, the card is far outside the 72 h read window, yet its snapshot is still loaded and he stays out.
    const later = new Date(Date.now() + 8 * 86400000).toISOString();
    const step = await newsStep(admin as unknown as SqlConnection, async () => [], later, 72);
    const keys = [{ playerId: third, gameId: 1, teamId: MTL, scheduledStartAt: new Date(Date.now() + 9 * 86400000).toISOString(), playerClass: "skater" as const }];
    expect(resolveAvailability(keys, step.snapshots, later).map(o => o.availability)).toEqual(["out"]);
  }, 120000);
});
