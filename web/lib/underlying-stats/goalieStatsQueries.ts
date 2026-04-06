import type { NextApiRequestQuery } from "next/dist/server/api-utils";

import {
  applyPlayerStatsModeChange,
  buildPlayerStatsSearchParams,
  createDetailFilterStateFromLandingContext,
  createDefaultDetailFilterState,
  createDefaultLandingFilterState,
  getDefaultLandingSortState,
} from "./playerStatsFilters";
import {
  buildPlayerStatsDetailApiPath,
  buildPlayerStatsLandingApiPath,
  buildPlayerStatsLandingChartApiPath,
  parseDetailApiRequest,
  parseLandingApiRequest,
  parseLandingChartApiRequest,
  type PlayerStatsDetailApiError,
  type PlayerStatsDetailApiResponse,
  type PlayerStatsLandingApiError,
  type PlayerStatsLandingApiResponse,
  type PlayerStatsLandingChartError,
  type PlayerStatsLandingChartResponse,
} from "./playerStatsQueries";
import type {
  PlayerStatsDetailFilterState,
  PlayerStatsLandingFilterState,
} from "./playerStatsTypes";

export type GoalieStatsLandingApiError = PlayerStatsLandingApiError;
export type GoalieStatsLandingApiResponse = PlayerStatsLandingApiResponse;
export type GoalieStatsDetailApiError = PlayerStatsDetailApiError;
export type GoalieStatsDetailApiResponse = PlayerStatsDetailApiResponse;
export type GoalieStatsLandingChartError = PlayerStatsLandingChartError;
export type GoalieStatsLandingChartResponse = PlayerStatsLandingChartResponse;

const GOALIE_LANDING_PATHNAME = "/underlying-stats/goalieStats";

function withGoalieModeQuery(query: NextApiRequestQuery): NextApiRequestQuery {
  return {
    ...query,
    statMode: "goalies",
  };
}

export function createDefaultGoalieLandingFilterState(
  options: Parameters<typeof createDefaultLandingFilterState>[0] = {}
): PlayerStatsLandingFilterState {
  const nextState = applyPlayerStatsModeChange(
    createDefaultLandingFilterState(options),
    "goalies"
  ).state;

  return {
    ...nextState,
    view: {
      ...nextState.view,
      sort: getDefaultLandingSortState(
        nextState.primary.statMode,
        nextState.primary.displayMode
      ),
    },
  };
}

export function createDefaultGoalieDetailFilterState(
  options: Parameters<typeof createDefaultDetailFilterState>[0] = {}
): PlayerStatsDetailFilterState {
  const nextState = applyPlayerStatsModeChange(
    createDefaultDetailFilterState(options),
    "goalies"
  ).state;

  return {
    ...nextState,
    view: {
      ...nextState.view,
      sort: getDefaultLandingSortState(
        nextState.primary.statMode,
        nextState.primary.displayMode
      ),
    },
  };
}

export function toGoalieLandingFilterState(
  state: PlayerStatsLandingFilterState
): PlayerStatsLandingFilterState {
  return applyPlayerStatsModeChange(state, "goalies").state;
}

export function toGoalieDetailFilterState(
  state: PlayerStatsDetailFilterState
): PlayerStatsDetailFilterState {
  return applyPlayerStatsModeChange(state, "goalies").state;
}

export function buildGoalieStatsLandingApiPath(
  state: PlayerStatsLandingFilterState
): string {
  const normalizedState = toGoalieLandingFilterState(state);
  const query = buildPlayerStatsSearchParams(normalizedState).toString();

  return query
    ? `/api/v1/underlying-stats/goalies?${query}`
    : "/api/v1/underlying-stats/goalies";
}

export function buildGoalieStatsDetailApiPath(
  playerId: number,
  state: PlayerStatsDetailFilterState
): string {
  const normalizedState = toGoalieDetailFilterState(state);
  const query = buildPlayerStatsSearchParams(normalizedState).toString();

  return query
    ? `/api/v1/underlying-stats/goalies/${playerId}?${query}`
    : `/api/v1/underlying-stats/goalies/${playerId}`;
}

export function buildGoalieStatsLandingChartApiPath(args: {
  playerId: number;
  state: PlayerStatsLandingFilterState;
  splitTeamId?: number | null;
}): string {
  const normalizedState = toGoalieLandingFilterState(args.state);
  const query = buildPlayerStatsSearchParams(normalizedState);

  if (args.splitTeamId != null) {
    query.set("splitTeamId", String(args.splitTeamId));
  }

  const queryString = query.toString();
  return queryString
    ? `/api/v1/underlying-stats/goalies/${args.playerId}/chart?${queryString}`
    : `/api/v1/underlying-stats/goalies/${args.playerId}/chart`;
}

export function buildGoalieStatsLandingHref(
  state: PlayerStatsLandingFilterState
): string {
  const normalizedState = toGoalieLandingFilterState(state);
  const query = buildPlayerStatsSearchParams(normalizedState).toString();

  return query
    ? `${GOALIE_LANDING_PATHNAME}?${query}`
    : GOALIE_LANDING_PATHNAME;
}

export function buildGoalieStatsDetailHref(
  playerId: number | string,
  landingState: PlayerStatsLandingFilterState
): string {
  const detailState = createDetailFilterStateFromLandingContext(
    toGoalieLandingFilterState(landingState)
  );
  const normalizedState = toGoalieDetailFilterState(detailState);
  const query = buildPlayerStatsSearchParams(normalizedState).toString();
  const pathname = `/underlying-stats/goalieStats/${playerId}`;

  return query ? `${pathname}?${query}` : pathname;
}

export function parseGoalieLandingApiRequest(query: NextApiRequestQuery) {
  return parseLandingApiRequest(withGoalieModeQuery(query));
}

export function parseGoalieDetailApiRequest(query: NextApiRequestQuery) {
  return parseDetailApiRequest(withGoalieModeQuery(query));
}

export function parseGoalieLandingChartApiRequest(query: NextApiRequestQuery) {
  return parseLandingChartApiRequest(withGoalieModeQuery(query));
}

export {
  buildPlayerStatsLandingApiPath,
  buildPlayerStatsDetailApiPath,
  buildPlayerStatsLandingChartApiPath,
};
