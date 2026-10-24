// @vitest-environment node
// C7 controls for SS1-10: wider pool bands, recent-form gating and failure, streaming evidence, read shape and worst-case count.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
const OUT = process.env.C7_SS1T10_OUT; const observed: Record<string, unknown> = {};
afterAll(() => { if (OUT) writeFileSync(OUT, JSON.stringify(observed, null, 2)); });
const m = vi.hoisted(() => ({ schedule: vi.fn(), rates: vi.fn(), players: vi.fn(), recent: vi.fn(), q: [] as any[], respond: null as null | ((table: string) => { data: any[]; count: number }) }));
vi.mock("lib/NHL/server", () => ({ getSchedule: m.schedule }));
vi.mock("lib/socialShare/teamRates", async (o) => ({ ...(await o<object>()), loadShareTeamRates: m.rates }));
vi.mock("lib/socialShare/playerSources", async (o) => ({ ...(await o<object>()), loadSharePlayerSources: m.players, loadSharePlayerRecent: m.recent }));
vi.mock("lib/supabase/public-client", () => ({ default: { from(table: string) { const rec: any = { table, calls: [] as any[] }; m.q.push(rec);
  const q: any = new Proxy({}, { get: (_t, k: string) => k === "then" ? (r: any) => r({ error: null, ...(m.respond?.(table) ?? { data: [], count: 0 }) }) : (...a: any[]) => { rec.calls.push([k, ...a]); return q; } }); return q; } } }));
import { loadScheduleShareSnapshot, shareCacheControl } from "lib/socialShare/server";
import { fictionalLeagueWeek, fictionalTeamStats } from "lib/socialShare/fixtures";
import { fictionalPlayerSources, fictionalPlayerRecent } from "lib/socialShare/pickupsFixture";
import { pickupTiers, specialists, PICKUP_BANDS } from "lib/socialShare/players";
import { streamingNights } from "lib/socialShare/matchups";
const actual = await vi.importActual<any>("lib/socialShare/playerSources");

const WEEK = "2026-10-26", NOW = "2026-10-26T12:00:00Z", season = 20262027;
beforeEach(() => { vi.clearAllMocks(); m.q.length = 0; m.respond = null; vi.useFakeTimers(); vi.setSystemTime(new Date(NOW));
  m.schedule.mockResolvedValue(fictionalLeagueWeek(WEEK, NOW)); m.rates.mockResolvedValue(fictionalTeamStats(season, "2026-10-26T06:00:00Z"));
  m.players.mockImplementation(async () => fictionalPlayerSources(season, "2026-10-26", "2026-10-26T08:00:00Z"));
  m.recent.mockImplementation(async (_s: number, sk: number[], gk: number[]) => fictionalPlayerRecent([...sk.map(nhlId => ({ nhlId, group: "F" as const })), ...gk.map(nhlId => ({ nhlId, group: "G" as const }))], season, "2026-10-26")); });

describe("C7 SS1-10", () => {
  it("B1 wider pool keeps every band literally true; widened only fills after top-10 and only from rank 11+", async () => {
    const s = await loadScheduleShareSnapshot("game-grid", WEEK); const bad: string[] = []; let widened = 0, shown = 0;
    for (const tier of pickupTiers(s, true)) for (const [g, list] of Object.entries(tier.groups)) { let seenWide = false;
      for (const p of list) { shown++; if (!(p.ownership >= tier.min && p.ownership < tier.max)) bad.push(`band ${tier.label} ${p.nhlId} ${p.ownership}`);
        if (p.widened) { widened++; seenWide = true; if (p.weekRank <= 10) bad.push(`wide-rank ${p.nhlId}`); } else { if (seenWide) bad.push(`order ${tier.label} ${g}`); if (p.weekRank > 10) bad.push(`top-rank ${p.nhlId}`); }
        if (p.remainingGames <= 0) bad.push(`nogames ${p.nhlId}`); } }
    for (const list of Object.values(specialists(s, true))) for (const p of list) { shown++; if (p.ownership >= 50) bad.push(`spec ${p.nhlId}`); if (p.widened) widened++; }
    observed.B1 = { bad, shown, widened, bands: PICKUP_BANDS.map(b => [b.min, b.max]), firstCallTeams: m.players.mock.calls[0][1].length, teamsWithGames: s.rows.filter(r => r.remainingGames > 0).length };
    expect(bad).toEqual([]); expect(m.players.mock.calls[0][1].length).toBe(s.rows.filter(r => r.remainingGames > 0).length);
  });
  it("R1 recent read gating: once, only the shown ids (split by group), never on blocked/failed/partial/Tuesday/stale", async () => {
    const s = await loadScheduleShareSnapshot("game-grid", WEEK); const [, sk, gk, since] = m.recent.mock.calls[0];
    const shown = s.players!.players; const out: Record<string, number> = { ready: m.recent.mock.calls.length };
    const before = m.recent.mock.calls.length;
    await loadScheduleShareSnapshot("tuesday-trends", WEEK);
    m.schedule.mockRejectedValueOnce(new Error("down")); await loadScheduleShareSnapshot("game-grid", WEEK).catch(() => 0);
    const partial: any = fictionalLeagueWeek(WEEK, NOW); partial.coveredDates = partial.coveredDates.slice(1); m.schedule.mockResolvedValueOnce(partial); await loadScheduleShareSnapshot("game-grid", WEEK);
    m.players.mockImplementationOnce(async () => fictionalPlayerSources(season, "2026-10-10", "2026-10-26T08:00:00Z")); await loadScheduleShareSnapshot("game-grid", WEEK);
    m.players.mockRejectedValueOnce(new Error("x")); await loadScheduleShareSnapshot("game-grid", WEEK);
    await loadScheduleShareSnapshot("player-spotlight" as any, WEEK);
    out.otherCases = m.recent.mock.calls.length - before;
    const sameIds = JSON.stringify([...sk, ...gk].sort()) === JSON.stringify(shown.map(p => p.nhlId).sort());
    const groupsOk = sk.every((id: number) => shown.find(p => p.nhlId === id)!.group !== "G") && gk.every((id: number) => shown.find(p => p.nhlId === id)!.group === "G");
    observed.R1 = { out, shown: shown.length, skaters: sk.length, goalies: gk.length, since, sameIds, groupsOk };
    expect(out).toEqual({ ready: 1, otherCases: 0 }); expect(sameIds && groupsOk).toBe(true); expect(shown.length).toBeLessThanOrEqual(36); expect(since).toBe("2026-10-05");
  });
  it("R2 recent read failure: what the cards and cache say (observation)", async () => {
    m.recent.mockRejectedValueOnce(new Error("SECRET recent failure"));
    const s = await loadScheduleShareSnapshot("game-grid", WEEK);
    observed.R2 = { playersState: s.players!.state, allRecentNull: s.players!.players.every(p => p.recent === null), count: s.players!.players.length, cache: shareCacheControl(s), leak: JSON.stringify(s).includes("SECRET"),
      recentField: s.players!.players.map(p => p.recent) .slice(0, 2) };
    expect(JSON.stringify(s)).not.toContain("SECRET");
  });
  it("L1 no raw-row leak: recent objects carry only derived fields; no source column names in JSON", async () => {
    const s = await loadScheduleShareSnapshot("game-grid", WEEK); const json = JSON.stringify(s);
    const keys = [...new Set(s.players!.players.flatMap(p => Object.keys(p.recent ?? {})))].sort();
    observed.L1 = { keys, hits: ["strength_state", "goalie_id", "season_games_played", "goals_total_last5", "465.p.", "player_key", "ownership_timeline"].filter(t => json.includes(t)) };
    expect(observed.L1).toMatchObject({ hits: [] });
  });
  it("S1 streaming chips: storms are both-sides top-third on independently recomputed GF/GA/SF/SA per GP ranks; tired from schedule", async () => {
    const s = await loadScheduleShareSnapshot("game-grid", WEEK); const teams = s.opponents!.teams as any; const bad: string[] = [];
    const rank = (key: string, abbr: string) => { const v = Object.entries(teams).filter(([, r]: any) => r.gp > 0 && r[key] !== undefined).map(([t, r]: any) => [t, r[key] / r.gp] as const).sort((a, b) => b[1] - a[1]);
      const me = v.find(([t]) => t === abbr); return me ? { rank: 1 + v.findIndex(x => x[1] === me[1]), of: v.length } : null; };
    const top = (r: any) => !!r && r.rank <= Math.ceil(r.of / 3);
    const nights = streamingNights(s, true);
    for (const n of nights) { const e = n.evidence, o = n.opponent.abbreviation, t = n.team.abbreviation;
      if (e.goals.storm !== (top(rank("gf", t)) && top(rank("ga", o)))) bad.push(`goals ${t}`);
      if (e.shots.storm !== (top(rank("sf", t)) && top(rank("sa", o)))) bad.push(`shots ${t}`);
      const prev = new Date(Date.parse(n.date + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
      const played = (id: number) => s.games.some(g => g.date === prev && g.gameType === 2 && !["postponed", "cancelled"].includes(g.status) && (g.homeTeam.id === id || g.awayTeam.id === id));
      const tired = prev >= s.weekStart && played(n.opponent.id) && !played(n.team.id);
      if (e.flags.includes("tired") !== tired) bad.push(`tired ${t}`);
      if (!(n.oppDef !== null && n.oppDef <= 33) && !e.flags.some(f => f !== "tired")) bad.push(`qualify ${t}`); }
    observed.S1 = { bad, nights: nights.map(n => ({ team: n.team.abbreviation, opp: n.opponent.abbreviation, date: n.date, flags: n.evidence.flags, oppDef: n.oppDef })) };
    expect(bad).toEqual([]); expect(nights.length).toBeGreaterThan(0);
  });
  it("Q1 real recent loader: anon select-only, two tables, exact columns, filters, limits ids×14", async () => {
    await actual.loadSharePlayerRecent(season, [1, 2, 3], [9], "2026-10-05");
    const shape = m.q.map((r: any) => ({ table: r.table, select: r.calls.find((c: any) => c[0] === "select")?.[1], filters: r.calls.filter((c: any) => ["eq", "in", "gte", "range"].includes(c[0])), writes: r.calls.filter((c: any) => ["insert", "update", "upsert", "delete", "rpc"].includes(c[0])).length }));
    observed.Q1 = shape;
    expect(shape.map(s => s.table).sort()).toEqual(["rolling_player_game_metrics", "wgo_goalie_stats"]); for (const s of shape) expect(s.writes).toBe(0);
    expect(JSON.stringify(shape)).toContain('["range",0,41]'); expect(JSON.stringify(shape)).toContain('["range",0,13]');
  });
  it("Q2 real sources loader at the limits: 32 teams, ranges 2000/1500/200, map chunk reads at a full 2000-row Yahoo page", async () => {
    const teams = [...new Set(fictionalLeagueWeek(WEEK, NOW).games?.flatMap((g: any) => [g.homeTeam.abbrev, g.awayTeam.abbrev]) ?? [])];
    m.respond = (table) => table === "yahoo_players" ? { data: Array.from({ length: 2000 }, (_, i) => ({ player_key: `465.p.${i}`, player_id: String(i) })), count: 2000 } : { data: [], count: 0 };
    await actual.loadSharePlayerSources(season, teams);
    const counts = m.q.reduce((a: any, r: any) => (a[r.table] = (a[r.table] ?? 0) + 1, a), {});
    const ranges = m.q.filter((r: any) => r.table !== "yahoo_nhl_player_map_read").map((r: any) => [r.table, r.calls.find((c: any) => c[0] === "range")?.slice(1)]);
    observed.Q2 = { teams: teams.length, counts, ranges, writes: m.q.flatMap((r: any) => r.calls).filter((c: any) => ["insert", "update", "upsert", "delete", "rpc"].includes(c[0])).length };
    expect(counts.yahoo_nhl_player_map_read).toBe(Math.ceil(4000 / 150));
  });
});
