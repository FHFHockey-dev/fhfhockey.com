import { describe, expect, it, vi } from "vitest";

const supabaseRows = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));
vi.mock("lib/supabase/server", () => {
  const query = {
    select: () => query,
    eq: () => query,
    lte: () => query,
    order: () => query,
    limit: async () => ({ data: supabaseRows.rows, error: null })
  };
  return { default: { from: () => query } };
});

import { fetchWindowCountsAll, loadPlayersForSnapshot } from "./windows";

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
    supabaseRows.rows = [
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
