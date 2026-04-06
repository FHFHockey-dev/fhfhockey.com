import {
  buildPlayerStatsDetailAggregationFromState,
  buildPlayerStatsLandingAggregationFromState,
  buildPlayerStatsLandingChartFromState,
} from "./playerStatsLandingServer";
import {
  toGoalieDetailFilterState,
  toGoalieLandingFilterState,
} from "./goalieStatsQueries";
import type {
  PlayerStatsDetailFilterState,
  PlayerStatsLandingFilterState,
} from "./playerStatsTypes";

export async function buildGoalieStatsLandingAggregationFromState(
  state: PlayerStatsLandingFilterState
) {
  return buildPlayerStatsLandingAggregationFromState(
    toGoalieLandingFilterState(state)
  );
}

export async function buildGoalieStatsDetailAggregationFromState(
  playerId: number,
  state: PlayerStatsDetailFilterState
) {
  return buildPlayerStatsDetailAggregationFromState(
    playerId,
    toGoalieDetailFilterState(state)
  );
}

export async function buildGoalieStatsLandingChartFromState(args: {
  playerId: number;
  splitTeamId?: number | null;
  state: PlayerStatsLandingFilterState;
}) {
  return buildPlayerStatsLandingChartFromState({
    ...args,
    splitTeamId: args.splitTeamId ?? null,
    state: toGoalieLandingFilterState(args.state)
  });
}
