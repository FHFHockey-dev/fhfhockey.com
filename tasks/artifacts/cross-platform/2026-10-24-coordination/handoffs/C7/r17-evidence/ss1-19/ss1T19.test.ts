// @vitest-environment node
// C7 controls for SS1-19 (17+18+low-year): streak rules vs an oracle written from TJ's words; per-game derivation; source isolation; grain caps.
import { afterAll, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
const observed: Record<string, unknown> = {};
afterAll(() => { if (process.env.C7_SS1T19_OUT) writeFileSync(process.env.C7_SS1T19_OUT, JSON.stringify(observed, null, 2)); });
const m = vi.hoisted(() => ({ fail: {} as Record<string, any>, rows: {} as Record<string, any[]> }));
vi.mock("lib/supabase/public-client", () => ({ default: { from(table: string) {
  const q: any = new Proxy({}, { get: (_t, k: string) => k === "then" ? (r: any) => r(m.fail[table] ? { data: null, error: m.fail[table], count: null } : { data: m.rows[table] ?? [], error: null, count: (m.rows[table] ?? []).length }) : () => q }); return q; } } }));
import { streakOf, STREAK } from "lib/socialShare/streak";
import { attachRecent } from "lib/socialShare/players";
import { RECENT_LIMITS, loadSharePlayerRecent } from "lib/socialShare/playerSources";

// Oracle from CLAUDE-065 + RECEIPT-18 pop-up answers (TOI 15%, cold mirrored, goalie rules), written without reading streak.ts' branches.
// run1: no tolerance → 0.15 computed as 0.1499… (reviewer error); "≥ 15%" is inclusive, so compare with a 1e-9 tolerance.
const E = 1e-9;
function oracle(r: any, ctx: string) {
  if (!r || r.games < 5) return null;
  if (r.kind === "goalie") { const sv = r.shotsAgainst > 0 ? r.saves / r.shotsAgainst : null;
    if (r.qualityStarts >= 4 || (sv !== null && sv >= 0.93 - E)) return "hot"; if (r.qualityStarts <= 1 || (sv !== null && sv <= 0.87 + E)) return "cold"; return null; }
  const ppg = r.points == null ? null : r.points / 5; const ch = (a: any, b: any, floor: number) => a == null || b == null || b < floor ? null : a / b - 1;
  const toi = ch(r.toiSeconds, r.toiPreSeconds, 1), pp = ch(r.ppToiSeconds, r.ppToiPreSeconds, 30);
  const hot = (r.pointGames != null && r.pointGames >= 4) || (ppg != null && ppg >= 0.85 - E) || (toi != null && toi >= 0.15 - E) || (pp != null && pp >= 0.35 - E)
    || (ctx === "specialist" && ((r.hitsPerGame != null && r.hitsPerGame > 2 + E) || (r.blocksPerGame != null && r.blocksPerGame > 2 + E) || (r.shots != null && r.shots / 5 > 2.5 + E) || (r.ppPoints != null && r.ppPoints / 5 > 0.5 + E)));
  if (hot) return "hot";
  const cold = (r.pointGames != null && r.pointGames <= 1) || (ppg != null && ppg <= 0.25 + E) || (toi != null && toi <= -0.15 + E) || (pp != null && pp <= -0.35 + E);
  return cold ? "cold" : null;
}
describe("C7 SS1-19", () => {
  it("S1 streakOf equals the spec oracle on 20,000 boundary-weighted skater/goalie cases in all 3 contexts", () => {
    let seed = 11; const r = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648); const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
    const bad: string[] = []; const counts: Record<string, number> = { hot: 0, cold: 0, none: 0 };
    for (let i = 0; i < 20000; i++) {
      const ctx = pick(["pickup", "specialist", "tier"]);
      const rec: any = r() < 0.2
        ? { kind: "goalie", games: pick([3, 4, 5]), wins: 2, saves: pick([93, 87, 90, 100]), shotsAgainst: 100, goalsAgainst: 5, qualityStarts: pick([0, 1, 2, 3, 4, 5]), shutouts: 0 }
        : { kind: "skater", games: pick([4, 5, 5, 5]), points: pick([null, 0, 1, 2, 3, 4, 5, 6]), pointGames: pick([null, 0, 1, 2, 3, 4, 5]), shots: pick([null, 10, 12, 13, 15]), ppPoints: pick([null, 0, 2, 3, 4]),
          hitsPerGame: pick([null, 1.5, 2, 2.01, 3]), blocksPerGame: pick([null, 2, 2.2]), toiSeconds: pick([null, 850, 851, 1000, 1149, 1150]), toiPreSeconds: pick([null, 0, 1000]),
          ppToiSeconds: pick([null, 65, 66, 100, 134, 135]), ppToiPreSeconds: pick([null, 20, 100]), goals: 0, assists: 0, line: null, ppUnit: null, toiSeasonSeconds: 1000, through: "2026-10-24" };
      const got = streakOf({ group: rec.kind === "goalie" ? "G" : "F", recent: rec } as any, ctx as any)?.kind ?? null, want = oracle(rec, ctx);
      counts[got ?? "none"]++; if (got !== want) bad.push(JSON.stringify({ ctx, rec, got, want }));
    }
    observed.S1 = { counts, mismatches: bad.length, first: bad.slice(0, 3), STREAK };
    expect(bad).toEqual([]); expect(counts.hot && counts.cold && counts.none).toBeTruthy();
  });
  it("P1 per-game points: 4/5 only from six provably consecutive rows; a GP gap or a missing cumulative → null; pre-L5 baselines exclude L5", () => {
    const row = (d: number, gp: number, cum: number | null, extra: any = {}) => ({ player_id: 1, season: 20262027, strength_state: "all", game_date: `2026-10-${String(d).padStart(2, "0")}`, season_games_played: gp, goals_total_all: cum, assists_total_all: cum == null ? null : 0,
      goals_total_last5: 2, assists_total_last5: 2, points_total_last5: 4, shots_total_last5: 10, hits_avg_last5: null, blocks_avg_last5: null, toi_seconds_avg_last5: 1100, pp_points_total_last5: 1, toi_seconds_avg_season: 1000, line_combo_slot: 1, line_combo_group: "forward", pp_unit: 1,
      toi_seconds_total_last5: 5500, pp_toi_seconds_total_last5: 500, pp_toi_seconds_avg_season: 80, ...extra });
    const layer = (rows: any[]) => attachRecent({ season: 20262027, state: "ready", players: [{ nhlId: 1, group: "F" }] } as any, { rolling: rows, goalieGames: [] }, "2026-10-24T16:00:00Z").players[0].recent as any;
    const good = layer([row(23, 20, 10), row(21, 19, 9), row(19, 18, 8), row(17, 17, 8), row(15, 16, 7), row(13, 15, 6)]);
    const gap = layer([row(23, 20, 10), row(21, 19, 9), row(19, 17, 8), row(17, 16, 8), row(15, 15, 7), row(13, 14, 6)]);
    const missing = layer([row(23, 20, 10), row(21, 19, null), row(19, 18, 8), row(17, 17, 8), row(15, 16, 7), row(13, 15, 6)]);
    const five = layer([row(23, 20, 10), row(21, 19, 9), row(19, 18, 8), row(17, 17, 8), row(15, 16, 7)]);
    // pre-L5 TOI = (1000×20 − 5500) ÷ 15 = 966.67; PP pre = (80×20 − 500) ÷ 15 = 73.33; L5 PP = 100.
    observed.P1 = { good: [good.pointGames, good.toiPreSeconds, good.ppToiPreSeconds, good.ppToiSeconds], gap: gap.pointGames, missing: missing.pointGames, five: five.pointGames };
    expect(good.pointGames).toBe(4); expect(gap.pointGames).toBeNull(); expect(missing.pointGames).toBeNull(); expect(five.pointGames).toBeNull();
    expect(good.toiPreSeconds).toBeCloseTo(14500 / 15, 6); expect(good.ppToiPreSeconds).toBeCloseTo(1100 / 15, 6);
  });
  it("R1 isolation + grain caps: a goalie error leaves skater rows; a skater error leaves goalie rows; reasons logged without ids", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    m.rows = { rolling_player_game_metrics: [{ player_id: 8470001 }], wgo_goalie_stats: [{ goalie_id: 8480001 }] };
    m.fail = { wgo_goalie_stats: { code: "57014", message: "canceling statement due to statement timeout" } };
    const a = await loadSharePlayerRecent(20262027, [8470001], [8480001], "2026-10-03");
    m.fail = { rolling_player_game_metrics: { code: "42703", message: "column x does not exist" } };
    const b = await loadSharePlayerRecent(20262027, [8470001], [8480001], "2026-10-03");
    const logs = warn.mock.calls.map(c => String(c[0])); warn.mockRestore();
    observed.R1 = { a: [a.rolling?.length ?? null, a.goalieGames], b: [b.rolling, b.goalieGames?.length ?? null], logs, caps: RECENT_LIMITS };
    expect(a.rolling).toHaveLength(1); expect(a.goalieGames).toBeNull(); expect(b.rolling).toBeNull(); expect(b.goalieGames).toHaveLength(1);
    expect(logs.join("\n")).not.toMatch(/8470001|8480001/); expect(RECENT_LIMITS.skaterRowsPerPlayer).toBe(RECENT_LIMITS.lookbackDays + 1);
  });
});
