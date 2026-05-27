import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./playerStatsLandingServer", () => ({
  buildPlayerStatsLandingAggregationFromState: vi.fn(),
  buildPlayerStatsDetailAggregationFromState: vi.fn(),
  buildPlayerStatsLandingChartFromState: vi.fn(),
}));

import {
  buildPlayerStatsDetailAggregationFromState,
  buildPlayerStatsLandingAggregationFromState,
  buildPlayerStatsLandingChartFromState,
} from "./playerStatsLandingServer";
import {
  buildGoalieStatsDetailAggregationFromState,
  buildGoalieStatsLandingAggregationFromState,
  buildGoalieStatsLandingChartFromState,
} from "./goalieStatsServer";
import {
  createDefaultDetailFilterState,
  createDefaultLandingFilterState,
} from "./playerStatsFilters";

describe("goalieStatsServer", () => {
  beforeEach(() => {
    vi.mocked(buildPlayerStatsLandingAggregationFromState).mockReset();
    vi.mocked(buildPlayerStatsDetailAggregationFromState).mockReset();
    vi.mocked(buildPlayerStatsLandingChartFromState).mockReset();
  });

  it("delegates landing aggregation through the shared player pipeline in goalie mode", async () => {
    vi.mocked(buildPlayerStatsLandingAggregationFromState).mockResolvedValue({
      family: "goalieCounts",
      rows: [],
      sort: { sortKey: "savePct", direction: "desc" },
      pagination: { page: 1, pageSize: 50, totalRows: 0, totalPages: 0 },
    });

    const state = createDefaultLandingFilterState({ currentSeasonId: 20252026 });
    state.primary.statMode = "individual";

    await buildGoalieStatsLandingAggregationFromState(state);

    expect(buildPlayerStatsLandingAggregationFromState).toHaveBeenCalledWith(
      expect.objectContaining({
        primary: expect.objectContaining({
          statMode: "goalies",
        }),
      })
    );
  });

  it("delegates detail aggregation through the shared player pipeline in goalie mode", async () => {
    vi.mocked(buildPlayerStatsDetailAggregationFromState).mockResolvedValue({
      playerId: 8475883,
      family: "goalieCounts",
      rows: [],
      sort: { sortKey: "savePct", direction: "desc" },
      pagination: { page: 1, pageSize: 50, totalRows: 0, totalPages: 0 },
    });

    const state = createDefaultDetailFilterState({ currentSeasonId: 20252026 });
    state.primary.statMode = "individual";

    await buildGoalieStatsDetailAggregationFromState(8475883, state);

    expect(buildPlayerStatsDetailAggregationFromState).toHaveBeenCalledWith(
      8475883,
      expect.objectContaining({
        primary: expect.objectContaining({
          statMode: "goalies",
        }),
      })
    );
  });

  it("delegates landing chart aggregation through the shared player pipeline in goalie mode", async () => {
    vi.mocked(buildPlayerStatsLandingChartFromState).mockResolvedValue({
      playerId: 8475883,
      family: "goalieCounts",
      rows: [],
    });

    const state = createDefaultLandingFilterState({ currentSeasonId: 20252026 });
    state.primary.statMode = "individual";

    await buildGoalieStatsLandingChartFromState({
      playerId: 8475883,
      splitTeamId: 5,
      state,
    });

    expect(buildPlayerStatsLandingChartFromState).toHaveBeenCalledWith({
      playerId: 8475883,
      splitTeamId: 5,
      state: expect.objectContaining({
        primary: expect.objectContaining({
          statMode: "goalies",
        }),
      }),
    });
  });
});
