import type { NextApiRequestQuery } from "next/dist/server/api-utils";

import {
  buildPlayerStatsSearchParams,
  createDefaultDetailFilterState,
  createDefaultLandingFilterState,
  parsePlayerStatsFilterStateFromQuery,
  validatePlayerStatsFilterState,
} from "./playerStatsFilters";
import type {
  PlayerStatsDetailFilterState,
  PlayerStatsLandingFilterState,
  PlayerStatsMode,
  PlayerStatsPositionGroup,
  PlayerStatsSortState,
  PlayerStatsTableFamily,
  PlayerStatsTablePaginationMeta,
  PlayerStatsTradeMode,
} from "./playerStatsTypes";

export type PlayerStatsLandingApiRow = {
  rowKey: string;
  [key: string]: unknown;
};

export type PlayerStatsLandingApiResponse = {
  family: PlayerStatsTableFamily;
  rows: PlayerStatsLandingApiRow[];
  sort: PlayerStatsSortState;
  pagination: PlayerStatsTablePaginationMeta;
  placeholder: boolean;
  generatedAt: string;
};

export type PlayerStatsLandingApiError = {
  error: string;
  issues?: string[];
};

export type PlayerStatsDetailApiRow = PlayerStatsLandingApiRow & {
  seasonId: number;
  seasonLabel: string;
};

export type PlayerStatsDetailApiResponse = {
  playerId: number;
  family: PlayerStatsTableFamily;
  rows: PlayerStatsDetailApiRow[];
  sort: PlayerStatsSortState;
  pagination: PlayerStatsTablePaginationMeta;
  placeholder: boolean;
  generatedAt: string;
};

export type PlayerStatsDetailApiError = {
  error: string;
  issues?: string[];
};

export type PlayerStatsLandingTeamContext = {
  teamId: number;
  teamAbbrev: string;
  firstGameDate: string | null;
};

export type PlayerStatsLandingTradeDisplay = {
  aggregationUnit: "player" | "playerTeam";
  rowKey: string;
  teamId: number | null;
  teamAbbrev: string | null;
  teamLabel: string;
};

export type CanonicalPlayerPositionCode = "C" | "LW" | "RW" | "D" | "G" | null;

export function buildPlayerStatsLandingApiPath(
  state: PlayerStatsLandingFilterState
): string {
  const query = buildPlayerStatsSearchParams(state).toString();
  return query
    ? `/api/v1/underlying-stats/players?${query}`
    : "/api/v1/underlying-stats/players";
}

export function buildPlayerStatsDetailApiPath(
  playerId: number,
  state: PlayerStatsDetailFilterState
): string {
  const query = buildPlayerStatsSearchParams(state).toString();
  return query
    ? `/api/v1/underlying-stats/players/${playerId}?${query}`
    : `/api/v1/underlying-stats/players/${playerId}`;
}

export function createEmptyPlayerStatsLandingResponse(
  state: PlayerStatsLandingFilterState
): PlayerStatsLandingApiResponse {
  return {
    family: resolveLandingTableFamily(state),
    rows: [],
    sort: state.view.sort,
    pagination: {
      page: state.view.pagination.page,
      pageSize: state.view.pagination.pageSize,
      totalRows: 0,
      totalPages: 0,
    },
    placeholder: true,
    generatedAt: new Date().toISOString(),
  };
}

export function buildLandingTradeDisplay(args: {
  playerId: number | string;
  tradeMode: PlayerStatsTradeMode;
  teamContexts: readonly PlayerStatsLandingTeamContext[];
  splitTeamId?: number | null;
}): PlayerStatsLandingTradeDisplay {
  const distinctTeamContexts = getDistinctTeamContexts(args.teamContexts);

  if (args.tradeMode === "split") {
    const splitTeamContext =
      distinctTeamContexts.find((team) => team.teamId === args.splitTeamId) ??
      distinctTeamContexts[0];

    if (!splitTeamContext) {
      return {
        aggregationUnit: "playerTeam",
        rowKey: `landing:playerTeam:${args.playerId}:unknown`,
        teamId: null,
        teamAbbrev: null,
        teamLabel: "—",
      };
    }

    return {
      aggregationUnit: "playerTeam",
      rowKey: `landing:playerTeam:${args.playerId}:${splitTeamContext.teamId}`,
      teamId: splitTeamContext.teamId,
      teamAbbrev: splitTeamContext.teamAbbrev,
      teamLabel: splitTeamContext.teamAbbrev,
    };
  }

  if (distinctTeamContexts.length === 0) {
    return {
      aggregationUnit: "player",
      rowKey: `landing:player:${args.playerId}`,
      teamId: null,
      teamAbbrev: null,
      teamLabel: "—",
    };
  }

  if (distinctTeamContexts.length === 1) {
    const [teamContext] = distinctTeamContexts;
    return {
      aggregationUnit: "player",
      rowKey: `landing:player:${args.playerId}`,
      teamId: teamContext.teamId,
      teamAbbrev: teamContext.teamAbbrev,
      teamLabel: teamContext.teamAbbrev,
    };
  }

  return {
    aggregationUnit: "player",
    rowKey: `landing:player:${args.playerId}`,
    teamId: null,
    teamAbbrev: null,
    teamLabel: distinctTeamContexts.map((team) => team.teamAbbrev).join(" / "),
  };
}

export function normalizeCanonicalPlayerPositionCode(
  rawPosition: string | null | undefined,
  mode?: PlayerStatsMode
): CanonicalPlayerPositionCode {
  if (mode === "goalies") {
    return "G";
  }

  if (!rawPosition) {
    return null;
  }

  const normalized = rawPosition.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  if (normalized === "G" || normalized === "GK" || normalized === "GOALIE") {
    return "G";
  }

  if (normalized === "D" || normalized === "LD" || normalized === "RD") {
    return "D";
  }

  if (normalized === "C") {
    return "C";
  }

  if (normalized === "LW" || normalized === "L") {
    return "LW";
  }

  if (normalized === "RW" || normalized === "R") {
    return "RW";
  }

  if (normalized === "W" || normalized === "F") {
    return null;
  }

  return null;
}

export function matchesPlayerStatsPositionGroup(args: {
  rawPosition: string | null | undefined;
  positionGroup: PlayerStatsPositionGroup | null;
  mode: PlayerStatsMode;
}): boolean {
  if (args.mode === "goalies") {
    return args.positionGroup === null || args.positionGroup === "goalies";
  }

  const canonicalPosition = normalizeCanonicalPlayerPositionCode(
    args.rawPosition,
    args.mode
  );

  if (canonicalPosition === "G") {
    return false;
  }

  if (args.positionGroup === null || args.positionGroup === "skaters") {
    return canonicalPosition === "C" || canonicalPosition === "LW" || canonicalPosition === "RW" || canonicalPosition === "D";
  }

  if (args.positionGroup === "defensemen") {
    return canonicalPosition === "D";
  }

  if (args.positionGroup === "centers") {
    return canonicalPosition === "C";
  }

  if (args.positionGroup === "leftWings") {
    return canonicalPosition === "LW";
  }

  if (args.positionGroup === "rightWings") {
    return canonicalPosition === "RW";
  }

  if (args.positionGroup === "goalies") {
    return false;
  }

  return false;
}

export function parseLandingApiRequest(
  query: NextApiRequestQuery
):
  | {
      ok: true;
      state: PlayerStatsLandingFilterState;
    }
  | {
      ok: false;
      error: PlayerStatsLandingApiError;
      statusCode: number;
    } {
  const fallbackState = createDefaultLandingFilterState();
  const state = parsePlayerStatsFilterStateFromQuery(query, fallbackState);
  const validation = validatePlayerStatsFilterState(state);

  if (!validation.isValid) {
    return {
      ok: false,
      statusCode: 400,
      error: {
        error: "Invalid player stats filter combination.",
        issues: validation.issues,
      },
    };
  }

  return {
    ok: true,
    state,
  };
}

export function parseDetailApiRequest(
  query: NextApiRequestQuery
):
  | {
      ok: true;
      playerId: number;
      state: PlayerStatsDetailFilterState;
    }
  | {
      ok: false;
      error: PlayerStatsDetailApiError;
      statusCode: number;
    } {
  const rawPlayerId = query.playerId;
  const normalizedPlayerId = Array.isArray(rawPlayerId)
    ? rawPlayerId[0]
    : rawPlayerId;
  const playerId = Number(normalizedPlayerId);

  if (!Number.isFinite(playerId) || playerId <= 0) {
    return {
      ok: false,
      statusCode: 400,
      error: {
        error: "Invalid player id.",
        issues: ["playerId must be a positive integer."],
      },
    };
  }

  const fallbackState = createDefaultDetailFilterState();
  const state = parsePlayerStatsFilterStateFromQuery(query, fallbackState);
  const validation = validatePlayerStatsFilterState(state);

  if (!validation.isValid) {
    return {
      ok: false,
      statusCode: 400,
      error: {
        error: "Invalid player stats filter combination.",
        issues: validation.issues,
      },
    };
  }

  return {
    ok: true,
    playerId: Math.trunc(playerId),
    state,
  };
}

function resolveLandingTableFamily(
  state: PlayerStatsLandingFilterState
): PlayerStatsTableFamily {
  if (state.primary.statMode === "individual") {
    return state.primary.displayMode === "rates"
      ? "individualRates"
      : "individualCounts";
  }

  if (state.primary.statMode === "goalies") {
    return state.primary.displayMode === "rates" ? "goalieRates" : "goalieCounts";
  }

  return state.primary.displayMode === "rates" ? "onIceRates" : "onIceCounts";
}

function getDistinctTeamContexts(
  teamContexts: readonly PlayerStatsLandingTeamContext[]
): PlayerStatsLandingTeamContext[] {
  const byTeamId = new Map<number, PlayerStatsLandingTeamContext>();

  for (const teamContext of teamContexts) {
    const existing = byTeamId.get(teamContext.teamId);
    if (!existing) {
      byTeamId.set(teamContext.teamId, teamContext);
      continue;
    }

    if (
      compareNullableDateOnly(teamContext.firstGameDate, existing.firstGameDate) < 0
    ) {
      byTeamId.set(teamContext.teamId, teamContext);
    }
  }

  return [...byTeamId.values()].sort((left, right) => {
    const byDate = compareNullableDateOnly(left.firstGameDate, right.firstGameDate);
    if (byDate !== 0) {
      return byDate;
    }

    return left.teamAbbrev.localeCompare(right.teamAbbrev);
  });
}

function compareNullableDateOnly(
  left: string | null,
  right: string | null
): number {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left.localeCompare(right);
}
