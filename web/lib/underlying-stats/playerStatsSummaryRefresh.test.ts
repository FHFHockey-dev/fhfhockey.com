import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildPlayerStatsLandingAggregationFromStateMock } = vi.hoisted(() => ({
  buildPlayerStatsLandingAggregationFromStateMock: vi.fn(),
}));

vi.mock("./playerStatsLandingServer", async () => {
  const actual = await vi.importActual<typeof import("./playerStatsLandingServer")>(
    "./playerStatsLandingServer"
  );

  return {
    ...actual,
    buildPlayerStatsLandingAggregationFromState:
      buildPlayerStatsLandingAggregationFromStateMock,
    invalidatePlayerStatsSeasonAggregateCache: vi.fn(),
  };
});

import { warmPlayerStatsLandingSeasonAggregateCache } from "./playerStatsSummaryRefresh";

describe("warmPlayerStatsLandingSeasonAggregateCache", () => {
  beforeEach(() => {
    buildPlayerStatsLandingAggregationFromStateMock.mockReset();
    buildPlayerStatsLandingAggregationFromStateMock.mockResolvedValue({
      family: "onIceCounts",
      rows: [],
      pagination: {
        page: 1,
        pageSize: 50,
        totalRows: 0,
        totalPages: 0,
      },
      sort: {
        sortKey: "xgfPct",
        direction: "desc",
      },
    });
  });

  it("warms the default skater landing aggregate cache by default", async () => {
    await warmPlayerStatsLandingSeasonAggregateCache({
      seasonId: 20252026,
      gameType: 2,
    });

    expect(buildPlayerStatsLandingAggregationFromStateMock).toHaveBeenCalledTimes(1);
    expect(buildPlayerStatsLandingAggregationFromStateMock.mock.calls[0]?.[0]).toMatchObject({
      primary: {
        seasonRange: {
          fromSeasonId: 20252026,
          throughSeasonId: 20252026,
        },
        seasonType: "regularSeason",
        statMode: "onIce",
        displayMode: "counts",
      },
      view: {
        sort: {
          sortKey: "xgfPct",
          direction: "desc",
        },
      },
    });
  });

  it("can warm a dedicated goalie aggregate cache profile", async () => {
    await warmPlayerStatsLandingSeasonAggregateCache({
      seasonId: 20252026,
      gameType: 2,
      statModes: ["goalies"],
    });

    expect(buildPlayerStatsLandingAggregationFromStateMock).toHaveBeenCalledTimes(1);
    expect(buildPlayerStatsLandingAggregationFromStateMock.mock.calls[0]?.[0]).toMatchObject({
      primary: {
        statMode: "goalies",
        displayMode: "counts",
      },
      view: {
        sort: {
          sortKey: "savePct",
          direction: "desc",
        },
      },
    });
  });

  it("warms each requested stat mode once", async () => {
    await warmPlayerStatsLandingSeasonAggregateCache({
      seasonId: 20252026,
      gameType: 2,
      statModes: ["onIce", "goalies", "goalies"],
    });

    expect(buildPlayerStatsLandingAggregationFromStateMock).toHaveBeenCalledTimes(2);
    expect(
      buildPlayerStatsLandingAggregationFromStateMock.mock.calls.map(
        (call) => call[0]?.primary.statMode
      )
    ).toEqual(["onIce", "goalies"]);
  });
});
