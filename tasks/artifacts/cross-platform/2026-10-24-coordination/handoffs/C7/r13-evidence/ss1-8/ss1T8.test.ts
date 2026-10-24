// @vitest-environment node
// C7 controls for SS1-8 (first live player read): read gating, exposure trim, cache ceilings, loader query shape.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
const OUT = process.env.C7_SS1T8_OUT; const observed: Record<string, unknown> = {};
afterAll(() => { if (OUT) writeFileSync(OUT, JSON.stringify(observed, null, 2)); });
const m = vi.hoisted(() => ({ schedule: vi.fn(), rates: vi.fn(), players: vi.fn(), q: [] as any[] }));
vi.mock("lib/NHL/server", () => ({ getSchedule: m.schedule }));
vi.mock("lib/socialShare/teamRates", async (o) => ({ ...(await o<object>()), loadShareTeamRates: m.rates }));
vi.mock("lib/socialShare/playerSources", async (o) => ({ ...(await o<object>()), loadSharePlayerSources: m.players }));
vi.mock("lib/supabase/public-client", () => ({ default: { from(table: string) { const rec: any = { table, calls: [] as any[] }; m.q.push(rec);
  const q: any = new Proxy({}, { get: (_t, k: string) => k === "then" ? (r: any) => r({ data: [], error: null, count: 0 }) : (...a: any[]) => { rec.calls.push([k, ...a]); return q; } }); return q; } } }));
import { loadScheduleShareSnapshot, shareCacheControl } from "lib/socialShare/server";
import { fictionalLeagueWeek, fictionalTeamStats } from "lib/socialShare/fixtures";
import { fictionalPlayerSources } from "lib/socialShare/pickupsFixture";
import { pickupTiers, specialists } from "lib/socialShare/players";
const { loadSharePlayerSources: realLoader } = await vi.importActual<any>("lib/socialShare/playerSources");

const WEEK = "2026-10-26", NOW = "2026-10-26T12:00:00Z", season = 20262027;
const SENT = "Zqx Sentinel-Hidden";
beforeEach(() => { vi.clearAllMocks(); m.q.length = 0; vi.useFakeTimers(); vi.setSystemTime(new Date(NOW));
  m.schedule.mockResolvedValue(fictionalLeagueWeek(WEEK, NOW)); m.rates.mockResolvedValue(fictionalTeamStats(season, "2026-10-26T06:00:00Z"));
  m.players.mockImplementation(async () => { const src: any = fictionalPlayerSources(season, "2026-10-26", "2026-10-26T08:00:00Z");
    // Rename a low-rate skater: real data that the cards will not show.
    const low = [...src.skaters].sort((a: any, b: any) => a.points_per_game - b.points_per_game)[0]; low.player_name = SENT; return src; }); });

describe("C7 SS1-8 live player path (mocked)", () => {
  it("G1 read gating across formats and schedule states", async () => {
    const out: Record<string, number> = {};
    await loadScheduleShareSnapshot("game-grid", WEEK); out.mondayReady = m.players.mock.calls.length;
    await loadScheduleShareSnapshot("remaining-week", WEEK); out.wednesdayReady = m.players.mock.calls.length - out.mondayReady;
    const before = m.players.mock.calls.length;
    await loadScheduleShareSnapshot("tuesday-trends", WEEK); out.tuesday = m.players.mock.calls.length - before;
    m.schedule.mockRejectedValueOnce(new Error("down")); await loadScheduleShareSnapshot("game-grid", WEEK).catch(() => 0); out.schedule503 = m.players.mock.calls.length - before;
    const partial: any = fictionalLeagueWeek(WEEK, NOW); partial.coveredDates = partial.coveredDates.slice(1); m.schedule.mockResolvedValueOnce(partial);
    await loadScheduleShareSnapshot("game-grid", WEEK); out.partial = m.players.mock.calls.length - before;
    await loadScheduleShareSnapshot("game-grid", "2099-01-05").catch(() => 0); out.outOfSeason = m.players.mock.calls.length - before;
    await loadScheduleShareSnapshot("player-spotlight" as any, WEEK); out.blocked = m.players.mock.calls.length - before;
    const teams = m.players.mock.calls[0][1];
    observed.G1 = { out, firstCallTeams: teams, teamCount: teams.length };
    expect(out).toEqual({ mondayReady: 1, wednesdayReady: 1, tuesday: 0, schedule503: 0, partial: 0, outOfSeason: 0, blocked: 0 }); expect(teams.length).toBeLessThanOrEqual(10);
  });
  it("E1 exposure: only shown players leave the server; a never-shown player's name never appears", async () => {
    const s = await loadScheduleShareSnapshot("game-grid", WEEK); const json = JSON.stringify(s);
    const shown = new Set([...pickupTiers(s, true).flatMap(t => Object.values(t.groups).flat()), ...Object.values(specialists(s, true)).flat()].map((p: any) => p.nhlId));
    const extra = s.players!.players.filter(p => !shown.has(p.nhlId)).length;
    observed.E1 = { state: s.players!.state, count: s.players!.players.length, extra, sentinel: json.includes(SENT), yahooKeys: /465\.p\.|player_key|ownership_timeline/.test(json), keys: Object.keys(s.players!.players[0] ?? {}) };
    expect(s.players!.players.length).toBeLessThanOrEqual(36); expect(extra).toBe(0); expect(json).not.toContain(SENT); expect(json).not.toMatch(/465\.p\.|player_key|ownership_timeline/);
  });
  it("C1 cache ceilings: ready → 300; players stale/missing → 60 with no swr; schedule not ready → no-store", async () => {
    const ready = shareCacheControl(await loadScheduleShareSnapshot("game-grid", WEEK));
    m.players.mockImplementationOnce(async () => fictionalPlayerSources(season, "2026-10-10", "2026-10-26T08:00:00Z"));
    const stale = shareCacheControl(await loadScheduleShareSnapshot("game-grid", WEEK));
    m.players.mockRejectedValueOnce(new Error("SECRET pg detail")); const missingSnap = await loadScheduleShareSnapshot("game-grid", WEEK); const missing = shareCacheControl(missingSnap);
    const partial: any = fictionalLeagueWeek(WEEK, NOW); partial.coveredDates = partial.coveredDates.slice(1); m.schedule.mockResolvedValueOnce(partial);
    const notReady = shareCacheControl(await loadScheduleShareSnapshot("game-grid", WEEK));
    observed.C1 = { ready, stale, missing, notReady, missingLeak: JSON.stringify(missingSnap).includes("SECRET") };
    expect(ready).toMatch(/s-maxage=300/); expect(stale).toBe("public, max-age=0, s-maxage=60"); expect(missing).toBe("public, max-age=0, s-maxage=60"); expect(notReady).toBe("no-store");
    expect(JSON.stringify(missingSnap)).not.toContain("SECRET");
  });
  it("F1 live-shaped freshness: percent_ownership dated by last_updated; old last_updated rows excluded, majority → stale", async () => {
    const shape = (lastUpdated: (i: number) => string) => async () => { const src: any = fictionalPlayerSources(season, "2026-10-26", "2026-10-26T08:00:00Z");
      src.yahoo.forEach((r: any, i: number) => { r.ownership_timeline = null; r.last_updated = lastUpdated(i); }); return src; };
    m.players.mockImplementationOnce(shape(() => "2026-10-26T05:00:00Z")); const fresh = (await loadScheduleShareSnapshot("game-grid", WEEK)).players!;
    m.players.mockImplementationOnce(shape(i => i % 4 === 0 ? "2026-10-15T05:00:00Z" : "2026-10-26T05:00:00Z")); const some = (await loadScheduleShareSnapshot("game-grid", WEEK)).players!;
    m.players.mockImplementationOnce(shape(i => i % 4 === 0 ? "2026-10-26T05:00:00Z" : "2026-10-15T05:00:00Z")); const most = (await loadScheduleShareSnapshot("game-grid", WEEK)).players!;
    observed.F1 = { fresh: [fresh.state, fresh.ownershipAsOf, fresh.players.length], someStale: [some.state, some.reasons], mostStale: [most.state, most.players.length] };
    expect(fresh.state).toBe("ready"); expect(some.state).toBe("ready"); expect(most.state).toBe("stale"); expect(most.players.length).toBe(0);
  });
  it("Q1 real loader query shape: anon select-only, filters, explicit limits, no timeline/notes/headshot columns", async () => {
    m.q.length = 0; await realLoader(season, ["NJD", "TBL", "TOR"]);
    const shape = m.q.map((r: any) => ({ table: r.table, select: r.calls.find((c: any) => c[0] === "select")?.[1], filters: r.calls.filter((c: any) => ["eq", "lt", "in", "range"].includes(c[0])), writes: r.calls.filter((c: any) => ["insert", "update", "upsert", "delete", "rpc"].includes(c[0])).length }));
    observed.Q1 = shape;
    for (const s of shape) { expect(s.writes).toBe(0); expect(s.select).not.toMatch(/ownership_timeline|note|headshot|full_name|injury/); }
    const yahoo = shape.find((s: any) => s.table === "yahoo_players")!;
    expect(yahoo.filters).toEqual(expect.arrayContaining([["eq", "season", 2026], ["lt", "percent_ownership", 50]]));
    expect(JSON.stringify(yahoo.filters)).toMatch(/"NJ"|"TB"/);
    expect(m.q.map((r: any) => r.table).sort()).toEqual(["wgo_goalie_stats_totals", "wgo_skater_stats_totals", "yahoo_players"]);
  });
});
