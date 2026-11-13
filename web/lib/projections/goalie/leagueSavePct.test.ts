import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  reads: [] as Array<{ from: string; before: string; lo: number; hi: number }>,
  rows: [] as Array<{ game_date: string; shots_against: unknown; goals_allowed: unknown }>,
  error: null as null | { message: string },
}));
vi.mock("lib/supabase/server", () => ({ default: { from: () => {
  let from = "", before = "";
  const query: any = {
    select: () => query, order: () => query,
    gte: (_: string, value: string) => { from = value; return query; },
    lt: (_: string, value: string) => { before = value; return query; },
    range: async (lo: number, hi: number) => {
      state.reads.push({ from, before, lo, hi });
      return { data: state.rows.filter(row => row.game_date >= from && row.game_date < before).slice(lo, hi + 1), error: state.error };
    },
  };
  return query;
} } }));
import { getSeasonLeagueSavePct, primeSeasonLeagueSavePctCache, type SeasonLeagueSavePctCache } from "./leagueSavePct";
import { LEAGUE_SAVE_PCT_FALLBACK } from "./goalieOutcomes";

describe("season league save percentage", () => {
  beforeEach(() => {
    state.reads = []; state.error = null;
    state.rows = [{ game_date: "2025-12-01", shots_against: 20000, goals_allowed: 2000 },
      { game_date: "2026-10-10", shots_against: 30, goals_allowed: 3 }];
  });
  it("memoizes within a run but captures fresh reads in a different run", async () => {
    const cache: SeasonLeagueSavePctCache = new Map();
    const first = await getSeasonLeagueSavePct("2026-10-22", cache);
    expect(await getSeasonLeagueSavePct("2026-10-22", cache)).toBe(first);
    expect(first.source).toBe("observed"); expect(state.reads).toHaveLength(1);
    await getSeasonLeagueSavePct("2026-10-22", new Map()); expect(state.reads).toHaveLength(2);
  });
  it.each([[30, null], [null, 3], [30, -1], [30, 31], [-1, 0], [0, 1], [1.5, 0], [30, 0.5], ["", 0], [30, Infinity], [NaN, 0], [true, 0]])(
    "excludes the incomplete or invalid pair SA=%s GA=%s without treating it as zero", async (shots, goals) => {
      state.rows.push({ game_date: "2026-10-11", shots_against: shots, goals_allowed: goals });
      const result = await getSeasonLeagueSavePct("2026-10-22", new Map());
      expect(result.currentSeasonShots).toBe(30); expect(result.savePct).toBeCloseTo(0.9);
      expect(result.excludedRows).toBe(1); expect(result.warning).toContain("excluded 1");
    });
  it("does not promote an all-unknown or zero-shot sample to observed evidence", async () => {
    state.rows = [{ game_date: "2026-10-10", shots_against: 30, goals_allowed: null }, { game_date: "2026-10-10", shots_against: 0, goals_allowed: 0 }];
    const result = await getSeasonLeagueSavePct("2026-10-22", new Map());
    expect(result).toMatchObject({ source: "fallback", savePct: LEAGUE_SAVE_PCT_FALLBACK, currentSeasonShots: 0, previousSeasonSavePct: null });
    expect(result.warning).toContain("no usable");
  });
  it("loads a 30-date catch-up once and keeps every cutoff strictly pregame", async () => {
    state.rows = Array.from({ length: 1000 }, () => ({ game_date: "2025-12-01", shots_against: 20, goals_allowed: 2 }));
    state.rows.push({ game_date: "2026-10-10", shots_against: 30, goals_allowed: 3 },
      { game_date: "2026-10-11", shots_against: 40, goals_allowed: 10 }, { game_date: "2026-10-30", shots_against: 100, goals_allowed: 90 });
    const dates = Array.from({ length: 30 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
    const cache: SeasonLeagueSavePctCache = new Map();
    await primeSeasonLeagueSavePctCache(dates, cache);
    const results = await Promise.all(dates.map(date => getSeasonLeagueSavePct(date, cache)));
    expect(state.reads).toEqual([{ from: "2025-07-01", before: "2026-10-30", lo: 0, hi: 999 }, { from: "2025-07-01", before: "2026-10-30", lo: 1000, hi: 1999 }]);
    expect(results[9].currentSeasonShots).toBe(0); expect(results[10].currentSeasonShots).toBe(30);
    expect(results[11].currentSeasonShots).toBe(70); expect(results[11].savePct).toBeCloseTo((18000 + 27 + 30) / 20070);
    expect(results[29].currentSeasonShots).toBe(70);
  });
  it("does not expose a partial observed baseline when pagination reaches its cap", async () => {
    state.rows = Array.from({ length: 12000 }, () => ({ game_date: "2026-10-10", shots_against: 30, goals_allowed: 3 }));
    const result = await getSeasonLeagueSavePct("2026-10-22", new Map());
    expect(state.reads).toHaveLength(12); expect(result.source).toBe("fallback");
    expect(result.warning).toContain("bound"); expect(result.currentSeasonShots).toBe(0);
  });
  it("rejects oversized or invalid cutoff sets before reading", async () => {
    await expect(primeSeasonLeagueSavePctCache(Array.from({ length: 31 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`), new Map())).rejects.toThrow("30");
    await expect(primeSeasonLeagueSavePctCache(["2026-02-30"], new Map())).rejects.toThrow("date");
    expect(state.reads).toEqual([]);
  });
  it("labels a failed read as fallback without keeping partial evidence", async () => {
    state.error = { message: "unavailable" };
    expect(await getSeasonLeagueSavePct("2026-10-22", new Map())).toMatchObject({ source: "fallback", currentSeasonShots: 0, previousSeasonSavePct: null });
  });
});
