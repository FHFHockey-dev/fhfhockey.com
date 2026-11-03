import { describe, expect, it, vi } from "vitest";

/** Rows per table; filters are ignored except player_id equality on player_stats_unified. */
const tables = vi.hoisted(() => ({ rows: {} as Record<string, Record<string, unknown>[]> }));
vi.mock("lib/supabase/server", () => ({
  default: {
    from: (table: string) => {
      let rows = [...(tables.rows[table] ?? [])];
      const result = () => ({ data: rows, error: null });
      const query: any = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          if (column === "player_id") rows = rows.filter(r => r.player_id === undefined || r.player_id === value);
          return query;
        },
        in: () => query,
        lte: () => query,
        order: () => query,
        limit: async () => result(),
        range: async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }),
        then: (resolve: (v: unknown) => unknown) => resolve(result())
      };
      return query;
    }
  }
}));

import { ebZ_generic, fetchWindowCountsAll, loadPlayersForSnapshot, rebuildBetaWindowZForSnapshot } from "./windows";

describe("loadPlayersForSnapshot", () => {
  it("paginates until a short page and preserves position groups", async () => {
    const pages = [
      [
        { player_id: 1, position_code: "C" },
        { player_id: 2, position_code: "D" },
        { player_id: 4, position_code: "L" }
      ],
      [
        { player_id: 3, position_code: "G" },
        { player_id: 5, position_code: "R" }
      ]
    ];
    const range = vi
      .fn()
      .mockResolvedValueOnce({ data: pages[0], error: null })
      .mockResolvedValueOnce({ data: pages[1], error: null });
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range
    };
    const client = { from: vi.fn().mockReturnValue(query) };

    const result = await loadPlayersForSnapshot("2026-03-21", {
      client,
      pageSize: 3
    });

    expect(range).toHaveBeenNthCalledWith(1, 0, 2);
    expect(range).toHaveBeenNthCalledWith(2, 3, 5);
    expect(result.ids).toEqual([1, 2, 4, 5]);
    expect(result.posMap.get(1)).toBe("F");
    expect(result.posMap.get(2)).toBe("D");
    expect(result.posMap.has(3)).toBe(false);
    expect(result.posMap.get(4)).toBe("F");
    expect(result.posMap.get(5)).toBe("F");
  });
});

describe("fetchWindowCountsAll", () => {
  it("measures IPP as all-situations points over all-situations on-ice goals, skipping games without NST on-ice data", async () => {
    tables.rows.player_stats_unified = [
      { goals: 1, shots: 3, nst_oi_gf: 3, nst_oi_sf: 20, points: 2, points_5v5: 1, pp_goals: 0, pp_shots: 1 },
      { goals: 0, shots: 2, nst_oi_gf: 1, nst_oi_sf: 10, points: 1, points_5v5: 0, pp_goals: 0, pp_shots: 0 },
      // No NST on-ice row for this game: its point must not enter IPP without a matching trial.
      { goals: 1, shots: 2, nst_oi_gf: null, nst_oi_sf: null, points: 1, points_5v5: 1, pp_goals: 1, pp_shots: 1 }
    ];

    const counts = await fetchWindowCountsAll(1, "2026-11-01", 3);

    expect(counts.ipp).toEqual({ s: 3, n: 4 });
    expect(counts.shp).toEqual({ s: 2, n: 7 });
    expect(counts.oishp).toEqual({ s: 4, n: 30 });
  });
});

describe("luck z against the player's own history", () => {
  it("uses the beta-binomial predictive spread, so short windows are not over-read", () => {
    // Baseline Beta(10, 90): mean 0.10. Window 5 goals on 25 shots (0.20).
    const r = ebZ_generic(5, 25, 10, 90);
    // Var = 0.1 * 0.9 * (100 + 25) / (25 * 101) = 0.004455; sd 0.0667.
    expect(r.varMixed).toBeCloseTo(0.004455, 6);
    expect(r.z).toBeCloseTo(1.498, 3);
    expect(r.shrink).toBeCloseTo(0.8, 10);
    expect(ebZ_generic(0, 0, 10, 90).z).toBe(0);
  });

  it("compares each player with their own posterior and falls back to the league prior", async () => {
    tables.rows = {
      sustainability_priors: [{ stat_code: "shp", alpha0: 10, beta0: 90, k: 100 }],
      sustainability_player_priors: [
        // Player 1: an established 15% shooter.
        { player_id: 1, position_group: "F", stat_code: "shp", post_alpha: 30, post_beta: 170 },
        // Player 3's posterior was built as a defenceman; it does not apply to the forward window.
        { player_id: 3, position_group: "D", stat_code: "shp", post_alpha: 5, post_beta: 95 }
      ],
      player_stats_unified: [{ goals: 3, shots: 20, nst_oi_gf: 2, nst_oi_sf: 20, points: 2, pp_goals: 0, pp_shots: 0 }]
    };
    const pos = new Map<number, "F" | "D">([[1, "F"], [2, "F"], [3, "F"]]);

    const { sample } = await rebuildBetaWindowZForSnapshot(20262027, "2026-11-03", [1, 2, 3], pos, [{ code: "l10", n: 10 }], ["shp"], true);
    const byPlayer = new Map(sample.map((row: any) => [row.player_id, row]));

    // A 15% window is exactly normal for player 1, but above the 10% league prior for the others.
    expect(byPlayer.get(1)).toMatchObject({ prior_alpha: 30, prior_beta: 170, prior_mean: 0.15, k: 200, eb_z: 0 });
    expect(byPlayer.get(2)).toMatchObject({ prior_alpha: 10, prior_beta: 90, prior_mean: 0.1, k: 100 });
    expect(byPlayer.get(3)).toMatchObject({ prior_alpha: 10, prior_beta: 90 });
    expect((byPlayer.get(2) as any).eb_z).toBeGreaterThan(0);
  });
});
