import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryResponse = {
  data: any;
  error: null | { message: string };
};

const {
  mockSupabase,
  fromMock,
  offenseRangeMock,
  defenseRangeMock,
  totalsMaybeSingleMock
} = vi.hoisted(() => {
  const offenseRangeMock = vi.fn();
  const defenseRangeMock = vi.fn();
  const totalsMaybeSingleMock = vi.fn();

  const offenseGtMock = vi.fn(() => ({
    range: offenseRangeMock
  }));
  const offenseOrderMock = vi.fn(() => ({
    gt: offenseGtMock
  }));
  const offenseEqMock = vi.fn(() => ({
    order: offenseOrderMock
  }));

  const defenseOrderMock = vi.fn(() => ({
    range: defenseRangeMock
  }));
  const defenseEqMock = vi.fn(() => ({
    order: defenseOrderMock
  }));

  const fromMock = vi.fn((table: string) => {
    if (table.includes("_offense")) {
      return {
        select: vi.fn(() => ({
          eq: offenseEqMock
        }))
      };
    }

    if (table.includes("_defense")) {
      return {
        select: vi.fn(() => ({
          eq: defenseEqMock
        }))
      };
    }

    if (table === "wgo_skater_stats_totals") {
      const totalsLimitMock = vi.fn(() => ({
        maybeSingle: totalsMaybeSingleMock
      }));
      const totalsOrderMock = vi.fn(() => ({
        limit: totalsLimitMock,
        maybeSingle: totalsMaybeSingleMock
      }));
      const totalsEqMock = vi.fn((column: string) => {
        if (column === "player_id") {
          return {
            eq: totalsEqMock
          };
        }

        if (column === "season") {
          return {
            order: totalsOrderMock,
            maybeSingle: totalsMaybeSingleMock
          };
        }

        throw new Error(`Unexpected totals eq column ${column}`);
      });

      return {
        select: vi.fn(() => ({
          eq: totalsEqMock
        }))
      };
    }

    throw new Error(`Unexpected table ${table}`);
  });

  return {
    mockSupabase: { from: fromMock },
    fromMock,
    offenseRangeMock,
    defenseRangeMock,
    totalsMaybeSingleMock
  };
});

vi.mock("lib/supabase", () => ({
  default: mockSupabase
}));

import {
  fetchAllPlayerStatsForStrength,
  fetchPercentileCohortForPlayer
} from "./fetchWigoPercentiles";

describe("fetchWigoPercentiles", () => {
  beforeEach(() => {
    fromMock.mockClear();
    offenseRangeMock.mockReset();
    defenseRangeMock.mockReset();
    totalsMaybeSingleMock.mockReset();
  });

  it("filters both percentile tables to the requested season and merges gp/toi fallbacks", async () => {
    offenseRangeMock.mockResolvedValueOnce({
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
    } satisfies QueryResponse);
    defenseRangeMock.mockResolvedValueOnce({
      data: [
        {
          player_id: 1,
          season: 20242025,
          gp: 14,
          toi_seconds: 900
        }
      ],
      error: null
    } satisfies QueryResponse);

    const rows = await fetchAllPlayerStatsForStrength("as", 20242025);

    expect(rows).toEqual([
      expect.objectContaining({
        player_id: 1,
        gp: 14,
        toi: 900,
        goals_per_60: 2.1
      })
    ]);
  });

  it("falls back to the prior season cohort when the requested season percentile data is stale", async () => {
    offenseRangeMock
      .mockResolvedValueOnce({
        data: [
          {
            player_id: 8476453,
            season: 20252026,
            gp: 4,
            toi_seconds: 4916,
            goals_per_60: 2.1
          }
        ],
        error: null
      } satisfies QueryResponse)
      .mockResolvedValueOnce({
        data: [
          {
            player_id: 8476453,
            season: 20242025,
            gp: 78,
            toi_seconds: 7000,
            goals_per_60: 1.9
          }
        ],
        error: null
      } satisfies QueryResponse);
    defenseRangeMock
      .mockResolvedValueOnce({
        data: [
          {
            player_id: 8476453,
            season: 20252026,
            gp: 4,
            toi_seconds: 4916
          }
        ],
        error: null
      } satisfies QueryResponse)
      .mockResolvedValueOnce({
        data: [
          {
            player_id: 8476453,
            season: 20242025,
            gp: 78,
            toi_seconds: 7000
          }
        ],
        error: null
      } satisfies QueryResponse);
    totalsMaybeSingleMock
      .mockResolvedValueOnce({
        data: { games_played: 72 },
        error: null
      } satisfies QueryResponse)
      .mockResolvedValueOnce({
        data: { games_played: 80 },
        error: null
      } satisfies QueryResponse);

    const result = await fetchPercentileCohortForPlayer("as", 20252026, 8476453);

    expect(result.appliedSeasonId).toBe(20242025);
    expect(result.canonicalPlayerGp).toBe(72);
    expect(result.fallbackReason).toContain("Showing 20242025 player values and league cohort");
    expect(result.stats[0]).toEqual(
      expect.objectContaining({
        player_id: 8476453,
        gp: 78
      })
    );
  });
  it("propagates source failures instead of interpreting them as an incomplete season", async () => {
    const error = { message: "source unavailable" };
    offenseRangeMock.mockResolvedValue({ data: null, error });
    defenseRangeMock.mockResolvedValue({ data: [], error: null });
    totalsMaybeSingleMock.mockResolvedValue({ data: { games_played: 80 }, error: null });
    await expect(fetchPercentileCohortForPlayer("as", 20252026, 1)).rejects.toEqual(error);
    expect(offenseRangeMock).toHaveBeenCalledTimes(1);
  });

  it("propagates canonical coverage lookup failures", async () => {
    offenseRangeMock.mockResolvedValue({ data: [], error: null });
    defenseRangeMock.mockResolvedValue({ data: [], error: null });
    const error = { message: "coverage unavailable" };
    totalsMaybeSingleMock.mockResolvedValue({ data: null, error });
    await expect(fetchPercentileCohortForPlayer("as", 20252026, 1)).rejects.toEqual(error);
    expect(offenseRangeMock).toHaveBeenCalledTimes(1);
  });

  it("reuses league rows across players and coverage lookups across strengths", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    offenseRangeMock.mockResolvedValue({
      data: [1, 2].map(player_id => ({ player_id, season: 20252026, gp: 72, toi_seconds: 7000 })),
      error: null
    });
    defenseRangeMock.mockResolvedValue({ data: [], error: null });
    totalsMaybeSingleMock.mockResolvedValue({ data: { games_played: 72 }, error: null });

    await fetchPercentileCohortForPlayer("as", 20252026, 1, client);
    await fetchPercentileCohortForPlayer("as", 20252026, 2, client);
    expect(offenseRangeMock).toHaveBeenCalledTimes(1);
    expect(defenseRangeMock).toHaveBeenCalledTimes(1);
    // One season maximum and one canonical lookup for each selected player.
    expect(totalsMaybeSingleMock).toHaveBeenCalledTimes(3);

    await fetchPercentileCohortForPlayer("es", 20252026, 2, client);
    expect(offenseRangeMock).toHaveBeenCalledTimes(2);
    expect(totalsMaybeSingleMock).toHaveBeenCalledTimes(3);

    await fetchPercentileCohortForPlayer("as", 20252026, 1, client);
    expect(offenseRangeMock).toHaveBeenCalledTimes(2);
    client.clear();
  });

  it("shares requested and fallback cohorts without sharing player-specific fallback decisions", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    offenseRangeMock
      .mockResolvedValueOnce({
        data: [
          { player_id: 1, season: 20252026, gp: 4, toi_seconds: 100 },
          { player_id: 2, season: 20252026, gp: 72, toi_seconds: 7000 }
        ], error: null
      })
      .mockResolvedValueOnce({
        data: [{ player_id: 1, season: 20242025, gp: 78, toi_seconds: 8000 }], error: null
      });
    defenseRangeMock.mockResolvedValue({ data: [], error: null });
    totalsMaybeSingleMock.mockResolvedValue({ data: { games_played: 72 }, error: null });

    const first = await fetchPercentileCohortForPlayer("as", 20252026, 1, client);
    const second = await fetchPercentileCohortForPlayer("as", 20252026, 2, client);
    const revisit = await fetchPercentileCohortForPlayer("as", 20252026, 1, client);
    expect(first.appliedSeasonId).toBe(20242025);
    expect(second.appliedSeasonId).toBe(20252026);
    expect(revisit.appliedSeasonId).toBe(20242025);
    expect(offenseRangeMock).toHaveBeenCalledTimes(2);
    expect(defenseRangeMock).toHaveBeenCalledTimes(2);
    client.clear();
  });

});
