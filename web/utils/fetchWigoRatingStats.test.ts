import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetchPaginatedData = vi.hoisted(() => vi.fn());

vi.mock("./fetchWigoPlayerStats", () => ({
  fetchPaginatedData: mockFetchPaginatedData
}));

import { fetchRawStatsForAllStrengths, fetchSkaterPositionGroups } from "./fetchWigoRatingStats";

describe("fetchRawStatsForAllStrengths", () => {
  beforeEach(() => {
    mockFetchPaginatedData.mockReset();
  });

  it("requests all weighted offense and defense tables for the selected season", async () => {
    mockFetchPaginatedData
      .mockResolvedValueOnce([{ player_id: 1, gp: 10 }])
      .mockResolvedValueOnce([{ player_id: 1, gp: 10 }])
      .mockResolvedValueOnce([{ player_id: 1, gp: 10 }])
      .mockResolvedValueOnce([{ player_id: 1, gp: 10 }])
      .mockResolvedValueOnce([{ player_id: 1, gp: 10 }])
      .mockResolvedValueOnce([{ player_id: 1, gp: 10 }])
      .mockResolvedValueOnce([{ player_id: 1, gp: 10 }])
      .mockResolvedValueOnce([{ player_id: 1, gp: 10 }]);

    const result = await fetchRawStatsForAllStrengths(20242025);

    expect(mockFetchPaginatedData).toHaveBeenCalledTimes(6);
    expect(mockFetchPaginatedData).toHaveBeenNthCalledWith(
      1,
      "nst_percentile_as_offense",
      expect.stringContaining("total_points_per_60"),
      { column: "season", value: 20242025 }
    );
    expect(mockFetchPaginatedData).toHaveBeenNthCalledWith(
      2,
      "nst_percentile_as_defense",
      expect.stringContaining("xga_per_60"),
      { column: "season", value: 20242025 }
    );
    expect(mockFetchPaginatedData.mock.calls.map(call => call[0])).not.toContain("nst_percentile_pp_defense");
    expect(mockFetchPaginatedData.mock.calls.map(call => call[0])).not.toContain("nst_percentile_pk_offense");
    expect(result.pp?.defense).toEqual([]);
    expect(result.pk?.offense).toEqual([]);
    expect(result.as?.offense).toHaveLength(1);
    expect(result.pk?.defense).toHaveLength(1);
  });
});

describe("fetchSkaterPositionGroups", () => {
  beforeEach(() => mockFetchPaginatedData.mockReset());

  it("maps season totals to F/D and leaves unknown or conflicting positions out", async () => {
    mockFetchPaginatedData.mockResolvedValueOnce([
      { player_id: 1, position_code: "C" },
      { player_id: 2, position_code: "D" },
      { player_id: 3, position_code: null },
      { player_id: 4, position_code: "D" },
      { player_id: 4, position_code: "RW" }
    ]);
    const groups = await fetchSkaterPositionGroups(20252026);
    expect(mockFetchPaginatedData).toHaveBeenCalledWith(
      "wgo_skater_stats_totals", "player_id, position_code", { column: "season", value: "20252026" }
    );
    expect([...groups.entries()]).toEqual([[1, "F"], [2, "D"]]);
  });
});
