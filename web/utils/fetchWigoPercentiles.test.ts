import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockSupabase,
  fromMock,
  offenseEqMock,
  offenseGtMock,
  defenseEqMock
} = vi.hoisted(() => {
  const offenseGtMock = vi.fn();
  const offenseEqMock = vi.fn(() => ({
    gt: offenseGtMock
  }));
  const defenseEqMock = vi.fn();
  const fromMock = vi.fn((table: string) => {
    if (table.includes("_offense")) {
      return {
        select: vi.fn(() => ({
          eq: offenseEqMock
        }))
      };
    }

    return {
      select: vi.fn(() => ({
        eq: defenseEqMock
      }))
    };
  });

  return {
    mockSupabase: { from: fromMock },
    fromMock,
    offenseEqMock,
    offenseGtMock,
    defenseEqMock
  };
});

vi.mock("lib/supabase", () => ({
  default: mockSupabase
}));

import { fetchAllPlayerStatsForStrength } from "./fetchWigoPercentiles";

describe("fetchAllPlayerStatsForStrength", () => {
  beforeEach(() => {
    fromMock.mockClear();
    offenseEqMock.mockClear();
    offenseGtMock.mockReset();
    defenseEqMock.mockReset();
  });

  it("filters both percentile tables to the requested season and merges gp/toi fallbacks", async () => {
    offenseGtMock.mockResolvedValue({
      data: [
        {
          player_id: 1,
          season: 20242025,
          gp: null,
          toi_seconds: null,
          goals_per_60: 2.1
        }
      ],
      error: null
    });
    defenseEqMock.mockResolvedValue({
      data: [
        {
          player_id: 1,
          season: 20242025,
          gp: 14,
          toi_seconds: 900
        }
      ],
      error: null
    });

    const rows = await fetchAllPlayerStatsForStrength("as", 20242025);

    expect(offenseEqMock).toHaveBeenCalledWith("season", 20242025);
    expect(offenseGtMock).toHaveBeenCalledWith("gp", 0);
    expect(defenseEqMock).toHaveBeenCalledWith("season", 20242025);
    expect(rows).toEqual([
      expect.objectContaining({
        player_id: 1,
        gp: 14,
        toi: 900,
        goals_per_60: 2.1
      })
    ]);
  });
});
