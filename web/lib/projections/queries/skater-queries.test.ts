import { describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], calls: [] as Array<[string, unknown[]]> }));
vi.mock("lib/supabase/server", () => ({ default: {
  from(table: string) {
    dbState.calls.push(["from", [table]]);
    const query: Record<string, unknown> = { then(resolve: (value: unknown) => void) {
      resolve({ data: dbState.rows, error: null });
    } };
    for (const name of ["select", "in", "lte", "gte", "order", "limit"]) {
      query[name] = (...args: unknown[]) => { dbState.calls.push([name, args]); return query; };
    }
    return query;
  },
} }));

import { ROLLING_ROW_SELECT_CLAUSE, fetchLatestSkaterContextProfiles } from "./skater-queries";

describe("fetchRollingRows compatibility select clause", () => {
  it("includes both canonical and legacy fallback columns for promised /60 consumers", () => {
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("sog_per_60_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("sog_per_60_all");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("sog_per_60_avg_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("sog_per_60_avg_all");

    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("hits_per_60_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("hits_per_60_all");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("hits_per_60_avg_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("hits_per_60_avg_all");

    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("blocks_per_60_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("blocks_per_60_all");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("blocks_per_60_avg_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("blocks_per_60_avg_all");
  });

  it("keeps weighted-rate fields canonical-first while leaving TOI and additive totals on their authoritative legacy surfaces", () => {
    expect(ROLLING_ROW_SELECT_CLAUSE.indexOf("sog_per_60_last5")).toBeLessThan(
      ROLLING_ROW_SELECT_CLAUSE.indexOf("sog_per_60_avg_last5")
    );
    expect(ROLLING_ROW_SELECT_CLAUSE.indexOf("hits_per_60_last5")).toBeLessThan(
      ROLLING_ROW_SELECT_CLAUSE.indexOf("hits_per_60_avg_last5")
    );
    expect(ROLLING_ROW_SELECT_CLAUSE.indexOf("blocks_per_60_last5")).toBeLessThan(
      ROLLING_ROW_SELECT_CLAUSE.indexOf("blocks_per_60_avg_last5")
    );

    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("toi_seconds_avg_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("toi_seconds_avg_all");
    expect(ROLLING_ROW_SELECT_CLAUSE).not.toContain("toi_seconds_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).not.toContain("toi_seconds_all");

    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("goals_total_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("shots_total_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("assists_total_last5");
  });
});

describe("combined skater context read", () => {
  it("uses one cutoff-bounded query and preserves both latest-player maps with missing fields", async () => {
    dbState.calls = [];
    dbState.rows = [
      { player_id: 7, date: "2026-09-28", nst_shots_per_60: 12, nst_ixg_per_60: 1.1,
        nst_oi_xgf_per_60: 3.2, nst_oi_cf_pct_rates: 0.55, possession_pct_safe: 0.54 },
      { player_id: 7, date: "2026-09-27", nst_shots_per_60: 99, nst_oi_xgf_per_60: 99 },
      { player_id: 8, date: "2026-09-28", nst_oi_cf_pct: 0.49 },
    ];
    const result = await fetchLatestSkaterContextProfiles([7, 8], "2026-09-29");
    expect(dbState.calls.filter(([name]) => name === "from")).toEqual([["from", ["player_stats_unified"]]]);
    expect(dbState.calls).toContainEqual(["lte", ["date", "2026-09-29"]]);
    expect(dbState.calls).toContainEqual(["gte", ["date", "2025-09-29"]]);
    expect(dbState.calls).toContainEqual(["limit", [5000]]);
    expect(result.shotQuality.get(7)).toEqual({ sourceDate: "2026-09-28", nstShotsPer60: 12,
      nstIxgPer60: 1.1, nstRushAttemptsPer60: null, nstReboundsCreatedPer60: null });
    expect(result.onIceContext.get(7)).toEqual({ sourceDate: "2026-09-28", nstOiXgfPer60: 3.2,
      nstOiXgaPer60: null, nstOiCfPct: 0.55, possessionPctSafe: 0.54 });
    expect(result.shotQuality.get(8)?.nstShotsPer60).toBeNull();
    expect(result.onIceContext.get(8)?.nstOiCfPct).toBe(0.49);
  });
});
