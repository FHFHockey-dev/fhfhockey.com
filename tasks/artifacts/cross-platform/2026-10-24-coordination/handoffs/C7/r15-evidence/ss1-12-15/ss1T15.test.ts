// @vitest-environment node
// C7 controls for SS1-12..15: TJ's colour rule, tier trim/cap/leak, ranking pool bounds, L5 score (Vilardi/Iafallo), paging shape.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
const OUT = process.env.C7_SS1T15_OUT; const observed: Record<string, unknown> = {};
afterAll(() => { if (OUT) writeFileSync(OUT, JSON.stringify(observed, null, 2)); });
const m = vi.hoisted(() => ({ schedule: vi.fn(), rates: vi.fn(), players: vi.fn(), recent: vi.fn(), q: [] as any[], respond: null as null | ((table: string, calls: any[]) => { data: any[]; count: number }) }));
vi.mock("lib/NHL/server", () => ({ getSchedule: m.schedule }));
vi.mock("lib/socialShare/teamRates", async (o) => ({ ...(await o<object>()), loadShareTeamRates: m.rates }));
vi.mock("lib/socialShare/playerSources", async (o) => ({ ...(await o<object>()), loadSharePlayerSources: m.players, loadSharePlayerRecent: m.recent }));
vi.mock("lib/supabase/public-client", () => ({ default: { from(table: string) { const rec: any = { table, calls: [] as any[] }; m.q.push(rec);
  const q: any = new Proxy({}, { get: (_t, k: string) => k === "then" ? (r: any) => r({ error: null, ...(m.respond?.(table, rec.calls) ?? { data: [], count: 0 }) }) : (...a: any[]) => { rec.calls.push([k, ...a]); return q; } }); return q; } } }));
import { loadScheduleShareSnapshot, shareCacheControl } from "lib/socialShare/server";
import { fictionalLeagueWeek, fictionalTeamStats } from "lib/socialShare/fixtures";
import { fictionalPlayerSources, fictionalPlayerRecent } from "lib/socialShare/pickupsFixture";
import { pickupTiers, specialists, scoreOrder } from "lib/socialShare/players";
import { countTiers } from "lib/socialShare/mondayGrid";
import { streamingTiers, schedulePairs, tierPairs, TRIMMED_PLAYERS_MAX, RANK_POOL_MAX, TIER_LIST_ROWS } from "lib/socialShare/tiers";
import { playerScore, fantasyPointsPerGame, opportunityMultiplier, SCORE_FORMULA } from "lib/socialShare/score";
const actual = await vi.importActual<any>("lib/socialShare/playerSources");

const WEEK = "2026-10-26", NOW = "2026-10-26T12:00:00Z", season = 20262027;
const SENT = "Zqx Pool-Hidden";
beforeEach(() => { vi.clearAllMocks(); m.q.length = 0; m.respond = null; vi.useFakeTimers(); vi.setSystemTime(new Date(NOW));
  m.schedule.mockResolvedValue(fictionalLeagueWeek(WEEK, NOW)); m.rates.mockResolvedValue(fictionalTeamStats(season, "2026-10-26T06:00:00Z"));
  m.players.mockImplementation(async () => fictionalPlayerSources(season, "2026-10-26", "2026-10-26T08:00:00Z"));
  m.recent.mockImplementation(async (_s: number, sk: number[], gk: number[]) => fictionalPlayerRecent([...sk.map(nhlId => ({ nhlId, group: "F" as const })), ...gk.map(nhlId => ({ nhlId, group: "G" as const }))], season, "2026-10-26")); });

// TJ (CLAUDE-040): highest green, second-highest white, lowest red, anything between yellow; per column.
function tjRule(values: number[]) { const d = [...new Set(values)].sort((a, b) => b - a);
  return new Map(d.map((v, i) => [v, d.length === 1 ? "neutral" : i === 0 ? "high" : i === d.length - 1 ? "low" : i === 1 ? "second" : "between"])); }
describe("C7 SS1-12..15", () => {
  it("K1 colour tiers equal TJ's rule on TJ's examples and 500 random columns", () => {
    const ex = { a: [4, 3, 2, 1], b: [4, 3, 2], c: [5, 4, 3, 2, 1], two: [3, 2], one: [3, 3, 3], ties: [4, 4, 2, 0, 0] };
    const got = Object.fromEntries(Object.entries(ex).map(([k, v]) => [k, v.map(x => countTiers(v).get(x))]));
    let bad = 0; for (let n = 0; n < 500; n++) { const v = Array.from({ length: 32 }, (_, i) => Math.floor(Math.abs(Math.sin(n * 97 + i * 13)) * (2 + (n % 5))));
      const a = countTiers(v), b = tjRule(v); for (const x of v) if (a.get(x) !== b.get(x)) bad++; }
    observed.K1 = { got, bad };
    expect(got.a).toEqual(["high", "second", "between", "low"]); expect(got.b).toEqual(["high", "second", "low"]); expect(got.c).toEqual(["high", "second", "between", "between", "low"]); expect(bad).toBe(0);
  });
  it("T1 strict tiers are exact (GP, OFF) pairs; widened folds the next pairs; no team in two tiers", async () => {
    const s = await loadScheduleShareSnapshot("game-grid", WEEK); const pairs = schedulePairs(s); const bad: string[] = [];
    for (const mode of ["strict", "widened"] as const) { const tp = tierPairs(pairs, mode); const seen = new Set<string>();
      if (mode === "strict" && tp.some(t => t.length !== 1)) bad.push("strict multi-pair");
      for (const t of tp) for (const p of t) for (const r of p.teams) { if (r.remainingGames !== p.gp || r.offNightGames !== p.off) bad.push(`pair ${r.team.abbreviation}`); if (seen.has(r.team.abbreviation)) bad.push(`dup ${r.team.abbreviation}`); seen.add(r.team.abbreviation); } }
    observed.T1 = { bad, pairs: pairs.slice(0, 6).map(p => `${p.gp}/${p.off}:${p.teams.map(t => t.team.abbreviation).join(",")}@${p.bestScore.toFixed(1)}`) };
    expect(bad).toEqual([]);
  });
  it("P1 server: one recent read over a pool ≤ RANK_POOL_MAX; shown ≤ 66; client tiers equal the server's ranking; pool-only players never leave", async () => {
    let poolIds: number[] = [];
    m.recent.mockImplementation(async (_s: number, sk: number[], gk: number[]) => { poolIds = [...sk, ...gk];
      const rec: any = fictionalPlayerRecent([...sk.map(nhlId => ({ nhlId, group: "F" as const })), ...gk.map(nhlId => ({ nhlId, group: "G" as const }))], season, "2026-10-26"); return rec; });
    m.players.mockImplementation(async () => { const src: any = fictionalPlayerSources(season, "2026-10-26", "2026-10-26T08:00:00Z"); return src; });
    const s = await loadScheduleShareSnapshot("game-grid", WEEK); const shown = s.players!.players; const json = JSON.stringify(s);
    const shownIds = new Set(shown.map(p => p.nhlId));
    const poolOnly = poolIds.filter(id => !shownIds.has(id));
    const src: any = fictionalPlayerSources(season, "2026-10-26", "2026-10-26T08:00:00Z"); const nameOf = (id: number) => (src.yahoo.find((y: any) => src.map.find((mm: any) => mm.nhl_player_id === String(id))?.yahoo_player_id === y.player_key)?.player_name);
    const leakedPoolNames = poolOnly.map(nameOf).filter(n => n && json.includes(`"${n}"`));
    // Every displayed player must be in the scored pool.
    const lists = [...pickupTiers(s, true).flatMap(t => Object.values(t.groups).flat()), ...Object.values(specialists(s, true)).flat(), ...(["strict", "widened"] as const).flatMap(mode => streamingTiers(s, true, mode).flatMap(t => t.shown))];
    const notInPool = lists.filter(p => !poolIds.includes(p.nhlId)).length;
    const orderBad = (["strict", "widened"] as const).flatMap(mode => streamingTiers(s, true, mode).flatMap(t => t.shown.slice(1).filter((p, i) => p.group === t.shown[i].group && scoreOrder(t.shown[i], p) > 0).map(p => `${mode}:${p.nhlId}`)));
    observed.P1 = { recentCalls: m.recent.mock.calls.length, pool: poolIds.length, RANK_POOL_MAX, shown: shown.length, TRIMMED_PLAYERS_MAX, poolOnly: poolOnly.length, leakedPoolNames, notInPool, orderBad, tierCounts: s.players!.tierCounts, cache: shareCacheControl(s),
      tiers: (["strict", "widened"] as const).map(mode => streamingTiers(s, true, mode).map(t => [t.shown.length, t.more])) };
    expect(m.recent.mock.calls.length).toBe(1); expect(poolIds.length).toBeLessThanOrEqual(RANK_POOL_MAX); expect(shown.length).toBeLessThanOrEqual(TRIMMED_PLAYERS_MAX);
    expect(leakedPoolNames).toEqual([]); expect(notInPool).toBe(0); expect(orderBad).toEqual([]);
  });
  it("P2 failure paths: recent read failure → unavailable + 60 s; schedule fail/partial/Tuesday/stale → no recent read", async () => {
    m.recent.mockRejectedValueOnce(new Error("SECRET")); const f = await loadScheduleShareSnapshot("game-grid", WEEK);
    const before = m.recent.mock.calls.length;
    m.schedule.mockRejectedValueOnce(new Error("down")); await loadScheduleShareSnapshot("game-grid", WEEK).catch(() => 0);
    const partial: any = fictionalLeagueWeek(WEEK, NOW); partial.coveredDates = partial.coveredDates.slice(1); m.schedule.mockResolvedValueOnce(partial); await loadScheduleShareSnapshot("game-grid", WEEK);
    await loadScheduleShareSnapshot("tuesday-trends", WEEK);
    m.players.mockImplementationOnce(async () => fictionalPlayerSources(season, "2026-10-10", "2026-10-26T08:00:00Z")); const st = await loadScheduleShareSnapshot("game-grid", WEEK);
    observed.P2 = { recentState: f.players!.recentState, cache: shareCacheControl(f), leak: JSON.stringify(f).includes("SECRET"), otherRecentCalls: m.recent.mock.calls.length - before, staleShown: st.players!.players.length, staleCounts: st.players!.tierCounts ?? null };
    expect(f.players!.recentState).toBe("unavailable"); expect(shareCacheControl(f)).toMatch(/s-maxage=60\b/); expect(m.recent.mock.calls.length - before).toBe(0); expect(st.players!.players.length).toBe(0);
  });
  it("V1 TJ's case: Vilardi (1G 2A 8 SOG 1 PPP 18:20) outranks Iafallo (2G 1A 10 SOG 0 PPP 14:29); independent arithmetic from fantasyPointsConfig", () => {
    const mk = (nhlId: number, name: string, r: any, line: string | null = null, pp: string | null = null): any => ({ nhlId, name, team: "LAK", group: "F", positions: "C", ownership: 30, pointsPerGame: 0.8, gamesPlayed: 10, weekRank: 3, remainingGames: 4, offNightGames: 2, widened: false,
      recent: { kind: "skater", games: 5, through: "2026-10-25", hitsPerGame: 0, blocksPerGame: 0, line, ppUnit: pp, toiSeasonSeconds: null, ...r } });
    const vil = mk(1, "Vilardi", { goals: 1, assists: 2, points: 3, shots: 8, ppPoints: 1, toiSeconds: 18 * 60 + 20 }), iaf = mk(2, "Iafallo", { goals: 2, assists: 1, points: 3, shots: 10, ppPoints: 0, toiSeconds: 14 * 60 + 29 });
    // Mine: G3 A2 PPP1 SOG0.2 per game; TOI ±2%/min vs 16:00, cap ±10%.
    const mine = (g: number, a: number, ppp: number, sog: number, toi: number) => ((3 * g + 2 * a + ppp + 0.2 * sog) / 5) * (1 + Math.max(-0.1, Math.min(0.1, (toi - 960) / 60 * 0.02)));
    const ref = { vil: mine(1, 2, 1, 8, 1100), iaf: mine(2, 1, 0, 10, 869) };
    const roles = { vil: playerScore(mk(1, "V", { goals: 1, assists: 2, points: 3, shots: 8, ppPoints: 1, toiSeconds: 1100 }, "L1", "PP1")), iaf: playerScore(mk(2, "I", { goals: 2, assists: 1, points: 3, shots: 10, ppPoints: 0, toiSeconds: 869 }, "L3", null)) };
    const noToi = { vil: fantasyPointsPerGame(vil), iaf: fantasyPointsPerGame(iaf) };
    observed.V1 = { vil: playerScore(vil), iaf: playerScore(iaf), ref, roles, noToiFpPerGame: noToi, multipliers: [opportunityMultiplier(vil), opportunityMultiplier(iaf)], order: [vil, iaf].sort(scoreOrder).map(p => p.name), formula: SCORE_FORMULA };
    expect(Math.abs(playerScore(vil)! - ref.vil)).toBeLessThan(1e-9); expect(Math.abs(playerScore(iaf)! - ref.iaf)).toBeLessThan(1e-9);
    expect([iaf, vil].sort(scoreOrder)[0].name).toBe("Vilardi"); expect(SCORE_FORMULA).toMatch(/G 3 · A 2 · PPP 1 · SOG 0\.2 · HIT 0\.2 · BLK 0\.25; goalies W 4 · SV 0\.2 · GA −1 · SO 3/);
  });
  it("Q1 real recent loader at pool size: limit ids×14, pages ≤ 1000 with the exact count, order keys recorded", async () => {
    const sk = Array.from({ length: 120 }, (_, i) => 8470000 + i), gk = Array.from({ length: 12 }, (_, i) => 8480000 + i);
    m.respond = (table, calls) => { const r = calls.find((c: any) => c[0] === "range"); const total = table === "rolling_player_game_metrics" ? 1500 : 100;
      const n = Math.max(0, Math.min(r[2], total - 1) - r[1] + 1); return { data: Array.from({ length: n }, (_, i) => ({ i: r[1] + i })), count: total }; };
    const out = await actual.loadSharePlayerRecent(season, sk, gk, "2026-10-05");
    const shape = m.q.map((r: any) => ({ table: r.table, range: r.calls.find((c: any) => c[0] === "range")?.slice(1), order: r.calls.filter((c: any) => c[0] === "order").map((c: any) => c[1]), select: r.calls.find((c: any) => c[0] === "select")?.[1], writes: r.calls.filter((c: any) => ["insert", "update", "upsert", "delete", "rpc"].includes(c[0])).length }));
    observed.Q1 = { shape, rows: [out.rolling.length, out.goalieGames.length] };
    expect(out.rolling.length).toBe(1500); expect(shape.filter(s => s.table === "rolling_player_game_metrics").map(s => s.range)).toEqual([[0, 999], [1000, 1679]]);
    for (const s of shape) expect(s.writes).toBe(0);
  });
});
