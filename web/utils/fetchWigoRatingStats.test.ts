import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetchPaginatedData = vi.hoisted(() => vi.fn());

vi.mock("./fetchWigoPlayerStats", () => ({
  fetchPaginatedData: mockFetchPaginatedData
}));

import { fetchRawStatsForAllStrengths } from "./fetchWigoRatingStats";

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
