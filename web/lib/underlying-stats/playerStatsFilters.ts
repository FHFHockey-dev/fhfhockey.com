import type {
  PlayerStatsDetailFilterState,
  PlayerStatsDisplayMode,
  PlayerStatsFilterState,
  PlayerStatsLandingFilterState,
  PlayerStatsMode,
  PlayerStatsPaginationState,
  PlayerStatsPositionGroup,
  PlayerStatsPrimaryFilters,
  PlayerStatsScoreState,
  PlayerStatsSeasonType,
  PlayerStatsSortDirection,
  PlayerStatsSortState,
  PlayerStatsStrength,
  PlayerStatsTradeMode,
  PlayerStatsVenue,
} from "./playerStatsTypes";
import {
  PLAYER_STATS_DISPLAY_MODES,
  PLAYER_STATS_MODE_COMPATIBILITY,
  PLAYER_STATS_MODES,
  PLAYER_STATS_POSITION_GROUPS,
  PLAYER_STATS_SCORE_STATES,
  PLAYER_STATS_SEASON_TYPES,
  PLAYER_STATS_STRENGTHS,
  PLAYER_STATS_TRADE_MODES,
  PLAYER_STATS_VENUES,
} from "./playerStatsTypes";

export const DEFAULT_PLAYER_STATS_PAGE_SIZE = 50;

export const DEFAULT_PLAYER_STATS_ADVANCED_OPEN = false;

export const DEFAULT_PLAYER_STATS_TRADE_MODE = "combine" as const;

export const DEFAULT_PLAYER_STATS_STAT_MODE = "onIce" as const;

export const DEFAULT_PLAYER_STATS_DISPLAY_MODE = "counts" as const;

export const DEFAULT_PLAYER_STATS_SEASON_TYPE = "regularSeason" as const;

export const DEFAULT_PLAYER_STATS_STRENGTH = "fiveOnFive" as const;

export const DEFAULT_PLAYER_STATS_SCORE_STATE = "allScores" as const;

export const PLAYER_STATS_QUERY_PARAM_KEYS = {
  fromSeasonId: "fromSeasonId",
  throughSeasonId: "throughSeasonId",
  seasonType: "seasonType",
  strength: "strength",
  scoreState: "scoreState",
  statMode: "statMode",
  displayMode: "displayMode",
  teamId: "teamId",
  againstTeamId: "againstTeamId",
  positionGroup: "positionGroup",
  venue: "venue",
  minimumToiSeconds: "minimumToiSeconds",
  scope: "scope",
  startDate: "startDate",
  endDate: "endDate",
  gameRange: "gameRange",
  byTeamGames: "byTeamGames",
  tradeMode: "tradeMode",
  sortKey: "sortKey",
  sortDirection: "sortDirection",
  page: "page",
  pageSize: "pageSize",
} as const;

export type PlayerStatsQueryValue = string | string[] | undefined;

export type PlayerStatsQueryInput =
  | URLSearchParams
  | Record<string, PlayerStatsQueryValue>;

export type PlayerStatsSerializedQuery = Record<string, string>;

export type PlayerStatsFilterResetReason =
  | "positionGroupClearedForMode"
  | "displayModeResetForMode";

export type PlayerStatsFilterNormalizationResult<T extends PlayerStatsFilterState> = {
  state: T;
  resetReasons: PlayerStatsFilterResetReason[];
};

export type PlayerStatsMinimumToiControlState = {
  supported: true;
  visible: true;
  disabled: false;
  retainedValue: number | null;
  appliesAfterAggregation: true;
};

export type PlayerStatsDetailFilterModel = {
  teamFilterReplacement: "againstTeamId";
  againstTeamQuerySemantics: "matchesOpponentTeamId";
  landingTeamCarryoverSemantics: "dropTeamIdResetAgainstTeam";
  landingOnlyExpandableFilters: readonly ["teamId"];
  detailOnlyExpandableFilters: readonly ["againstTeamId"];
  carriedExpandableFilters: readonly [
    "positionGroup",
    "venue",
    "minimumToiSeconds",
    "scope",
    "tradeMode"
  ];
  sortCarryover: "preserve";
  paginationCarryover: "resetPagePreservePageSize";
};

export type PlayerStatsSeasonWindow = {
  seasonId: number;
  regularSeasonStartDate: string | null;
  regularSeasonEndDate: string | null;
  seasonEndDate: string | null;
};

export type PlayerStatsSeasonWindowMap = Record<number, PlayerStatsSeasonWindow>;

export type PlayerStatsValidationIssue =
  | "seasonRangeMissing"
  | "seasonRangeOrder"
  | "dateRangeMissingStart"
  | "dateRangeMissingEnd"
  | "dateRangeOrder"
  | "dateRangeOutsideSeasonSpan";

export type PlayerStatsValidationResult = {
  isValid: boolean;
  issues: PlayerStatsValidationIssue[];
};

export type PlayerStatsScopeState = PlayerStatsFilterState["expandable"]["scope"];

export const PLAYER_STATS_DETAIL_FILTER_MODEL: PlayerStatsDetailFilterModel = {
  teamFilterReplacement: "againstTeamId",
  againstTeamQuerySemantics: "matchesOpponentTeamId",
  landingTeamCarryoverSemantics: "dropTeamIdResetAgainstTeam",
  landingOnlyExpandableFilters: ["teamId"],
  detailOnlyExpandableFilters: ["againstTeamId"],
  carriedExpandableFilters: [
    "positionGroup",
    "venue",
    "minimumToiSeconds",
    "scope",
    "tradeMode",
  ],
  sortCarryover: "preserve",
  paginationCarryover: "resetPagePreservePageSize",
};

const PLAYER_STATS_SORT_DIRECTIONS = ["asc", "desc"] as const;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function getQueryParam(
  query: PlayerStatsQueryInput,
  key: string
): string | undefined {
  if (query instanceof URLSearchParams) {
    return query.get(key) ?? undefined;
  }

  const value = query[key];
  return Array.isArray(value) ? value[0] : value;
}

function parseEnumParam<T extends string>(
  query: PlayerStatsQueryInput,
  key: string,
  allowed: readonly T[],
  fallback: T
): T {
  const candidate = getQueryParam(query, key);
  return (allowed as readonly string[]).includes(candidate ?? "")
    ? (candidate as T)
    : fallback;
}

function parsePositiveInteger(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parsePositiveIntegerParam(
  query: PlayerStatsQueryInput,
  key: string,
  fallback: number
): number {
  return parsePositiveInteger(getQueryParam(query, key)) ?? fallback;
}

function parseOptionalPositiveIntegerParam(
  query: PlayerStatsQueryInput,
  key: string
): number | null {
  return parsePositiveInteger(getQueryParam(query, key));
}

function parseDateOnly(value: string | undefined): string | null {
  return value && DATE_ONLY_PATTERN.test(value) ? value : null;
}

function compareDateOnly(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}

function deriveFallbackSeasonWindow(seasonId: number): PlayerStatsSeasonWindow | null {
  const seasonString = String(seasonId);
  if (!/^\d{8}$/.test(seasonString)) {
    return null;
  }

  const startYear = seasonString.slice(0, 4);
  const endYear = seasonString.slice(4, 8);

  return {
    seasonId,
    regularSeasonStartDate: `${startYear}-09-01`,
    regularSeasonEndDate: `${endYear}-06-30`,
    seasonEndDate: `${endYear}-06-30`,
  };
}

function resolveSeasonWindow(
  seasonId: number,
  seasonWindowsById?: PlayerStatsSeasonWindowMap
): PlayerStatsSeasonWindow | null {
  return seasonWindowsById?.[seasonId] ?? deriveFallbackSeasonWindow(seasonId);
}

function getSeasonSpanDateBounds(
  primary: PlayerStatsPrimaryFilters,
  seasonWindowsById?: PlayerStatsSeasonWindowMap
): { minDate: string; maxDate: string } | null {
  const { fromSeasonId, throughSeasonId } = primary.seasonRange;
  if (!fromSeasonId || !throughSeasonId) {
    return null;
  }

  const fromSeason = resolveSeasonWindow(fromSeasonId, seasonWindowsById);
  const throughSeason = resolveSeasonWindow(throughSeasonId, seasonWindowsById);
  if (!fromSeason || !throughSeason) {
    return null;
  }

  const minDate = fromSeason.regularSeasonStartDate;
  const maxDate =
    primary.seasonType === "playoffs"
      ? throughSeason.seasonEndDate
      : throughSeason.regularSeasonEndDate;

  if (!minDate || !maxDate) {
    return null;
  }

  return { minDate, maxDate };
}

function parseSortState(
  query: PlayerStatsQueryInput,
  fallback: PlayerStatsSortState
): PlayerStatsSortState {
  const sortKey = getQueryParam(query, PLAYER_STATS_QUERY_PARAM_KEYS.sortKey)?.trim();

  if (!sortKey) {
    return fallback;
  }

  return {
    sortKey,
    direction: parseEnumParam<PlayerStatsSortDirection>(
      query,
      PLAYER_STATS_QUERY_PARAM_KEYS.sortDirection,
      PLAYER_STATS_SORT_DIRECTIONS,
      fallback.direction
    ),
  };
}

function parsePaginationState(
  query: PlayerStatsQueryInput,
  fallback: PlayerStatsPaginationState
): PlayerStatsPaginationState {
  return {
    page: parsePositiveIntegerParam(
      query,
      PLAYER_STATS_QUERY_PARAM_KEYS.page,
      fallback.page
    ),
    pageSize: parsePositiveIntegerParam(
      query,
      PLAYER_STATS_QUERY_PARAM_KEYS.pageSize,
      fallback.pageSize
    ),
  };
}

function parsePrimaryFilters(
  query: PlayerStatsQueryInput,
  fallback: PlayerStatsPrimaryFilters
): PlayerStatsPrimaryFilters {
  return {
    seasonRange: {
      fromSeasonId: parsePositiveInteger(getQueryParam(
        query,
        PLAYER_STATS_QUERY_PARAM_KEYS.fromSeasonId
      )) ?? fallback.seasonRange.fromSeasonId,
      throughSeasonId: parsePositiveInteger(getQueryParam(
        query,
        PLAYER_STATS_QUERY_PARAM_KEYS.throughSeasonId
      )) ?? fallback.seasonRange.throughSeasonId,
    },
    seasonType: parseEnumParam<PlayerStatsSeasonType>(
      query,
      PLAYER_STATS_QUERY_PARAM_KEYS.seasonType,
      PLAYER_STATS_SEASON_TYPES,
      fallback.seasonType
    ),
    strength: parseEnumParam<PlayerStatsStrength>(
      query,
      PLAYER_STATS_QUERY_PARAM_KEYS.strength,
      PLAYER_STATS_STRENGTHS,
      fallback.strength
    ),
    scoreState: parseEnumParam<PlayerStatsScoreState>(
      query,
      PLAYER_STATS_QUERY_PARAM_KEYS.scoreState,
      PLAYER_STATS_SCORE_STATES,
      fallback.scoreState
    ),
    statMode: parseEnumParam<PlayerStatsMode>(
      query,
      PLAYER_STATS_QUERY_PARAM_KEYS.statMode,
      PLAYER_STATS_MODES,
      fallback.statMode
    ),
    displayMode: parseEnumParam<PlayerStatsDisplayMode>(
      query,
      PLAYER_STATS_QUERY_PARAM_KEYS.displayMode,
      PLAYER_STATS_DISPLAY_MODES,
      fallback.displayMode
    ),
  };
}

function parsePositionGroup(
  query: PlayerStatsQueryInput
): PlayerStatsPositionGroup | null {
  const value = getQueryParam(query, PLAYER_STATS_QUERY_PARAM_KEYS.positionGroup);
  return (PLAYER_STATS_POSITION_GROUPS as readonly string[]).includes(value ?? "")
    ? (value as PlayerStatsPositionGroup)
    : null;
}

function parseVenue(
  query: PlayerStatsQueryInput,
  fallback: PlayerStatsVenue
): PlayerStatsVenue {
  return parseEnumParam<PlayerStatsVenue>(
    query,
    PLAYER_STATS_QUERY_PARAM_KEYS.venue,
    PLAYER_STATS_VENUES,
    fallback
  );
}

function parseTradeMode(
  query: PlayerStatsQueryInput,
  fallback: PlayerStatsTradeMode
): PlayerStatsTradeMode {
  return parseEnumParam<PlayerStatsTradeMode>(
    query,
    PLAYER_STATS_QUERY_PARAM_KEYS.tradeMode,
    PLAYER_STATS_TRADE_MODES,
    fallback
  );
}

function parseScopeModifier(
  query: PlayerStatsQueryInput,
  fallback: PlayerStatsFilterState["expandable"]["scope"]
): PlayerStatsFilterState["expandable"]["scope"] {
  const scope = getQueryParam(query, PLAYER_STATS_QUERY_PARAM_KEYS.scope);

  if (scope === "dateRange") {
    return {
      kind: "dateRange",
      startDate: parseDateOnly(
        getQueryParam(query, PLAYER_STATS_QUERY_PARAM_KEYS.startDate)
      ),
      endDate: parseDateOnly(
        getQueryParam(query, PLAYER_STATS_QUERY_PARAM_KEYS.endDate)
      ),
    };
  }

  if (scope === "gameRange") {
    return {
      kind: "gameRange",
      value: parseOptionalPositiveIntegerParam(
        query,
        PLAYER_STATS_QUERY_PARAM_KEYS.gameRange
      ),
    };
  }

  if (scope === "byTeamGames") {
    return {
      kind: "byTeamGames",
      value: parseOptionalPositiveIntegerParam(
        query,
        PLAYER_STATS_QUERY_PARAM_KEYS.byTeamGames
      ),
    };
  }

  if (scope === "none") {
    return { kind: "none" };
  }

  return fallback;
}

function setQueryParam(
  query: PlayerStatsSerializedQuery,
  key: string,
  value: string | number | null | undefined
) {
  if (value === null || value === undefined || value === "") {
    return;
  }

  query[key] = String(value);
}

export function deriveFallbackCurrentSeasonId(asOfDate: Date = new Date()): number {
  const year = asOfDate.getFullYear();
  const monthIndex = asOfDate.getMonth();

  // Use September as the season rollover threshold for local fallback logic.
  // Server/bootstrap code should pass a canonical currentSeasonId when available.
  const startYear = monthIndex >= 8 ? year : year - 1;
  return Number(`${startYear}${startYear + 1}`);
}

export function getDefaultLandingSortState(
  statMode: PlayerStatsMode = DEFAULT_PLAYER_STATS_STAT_MODE,
  displayMode: PlayerStatsDisplayMode = DEFAULT_PLAYER_STATS_DISPLAY_MODE
): PlayerStatsSortState {
  if (statMode === "individual" && displayMode === "counts") {
    return { sortKey: "totalPoints", direction: "desc" };
  }

  if (statMode === "individual" && displayMode === "rates") {
    return { sortKey: "totalPointsPer60", direction: "desc" };
  }

  if (statMode === "goalies" && displayMode === "counts") {
    return { sortKey: "savePct", direction: "desc" };
  }

  if (statMode === "goalies" && displayMode === "rates") {
    return { sortKey: "savePct", direction: "desc" };
  }

  return { sortKey: "xgfPct", direction: "desc" };
}

export function createDefaultLandingPrimaryFilters(
  currentSeasonId: number = deriveFallbackCurrentSeasonId()
): PlayerStatsPrimaryFilters {
  return {
    seasonRange: {
      fromSeasonId: currentSeasonId,
      throughSeasonId: currentSeasonId,
    },
    seasonType: DEFAULT_PLAYER_STATS_SEASON_TYPE,
    strength: DEFAULT_PLAYER_STATS_STRENGTH,
    scoreState: DEFAULT_PLAYER_STATS_SCORE_STATE,
    statMode: DEFAULT_PLAYER_STATS_STAT_MODE,
    displayMode: DEFAULT_PLAYER_STATS_DISPLAY_MODE,
  };
}

export function createDefaultLandingFilterState(options: {
  currentSeasonId?: number;
  asOfDate?: Date;
  pageSize?: number;
} = {}): PlayerStatsLandingFilterState {
  const resolvedSeasonId =
    options.currentSeasonId ?? deriveFallbackCurrentSeasonId(options.asOfDate);
  const primary = createDefaultLandingPrimaryFilters(resolvedSeasonId);

  return {
    surface: "landing",
    primary,
    expandable: {
      teamId: null,
      positionGroup: null,
      venue: "all",
      minimumToiSeconds: null,
      scope: { kind: "none" },
      tradeMode: DEFAULT_PLAYER_STATS_TRADE_MODE,
      advancedOpen: DEFAULT_PLAYER_STATS_ADVANCED_OPEN,
    },
    view: {
      sort: getDefaultLandingSortState(primary.statMode, primary.displayMode),
      pagination: {
        page: 1,
        pageSize: options.pageSize ?? DEFAULT_PLAYER_STATS_PAGE_SIZE,
      },
    },
  };
}

export function createDefaultDetailFilterState(options: {
  currentSeasonId?: number;
  asOfDate?: Date;
  pageSize?: number;
} = {}): PlayerStatsDetailFilterState {
  const resolvedSeasonId =
    options.currentSeasonId ?? deriveFallbackCurrentSeasonId(options.asOfDate);
  const primary = createDefaultLandingPrimaryFilters(resolvedSeasonId);

  return {
    surface: "detail",
    primary,
    expandable: {
      againstTeamId: null,
      positionGroup: null,
      venue: "all",
      minimumToiSeconds: null,
      scope: { kind: "none" },
      tradeMode: DEFAULT_PLAYER_STATS_TRADE_MODE,
      advancedOpen: DEFAULT_PLAYER_STATS_ADVANCED_OPEN,
    },
    view: {
      sort: getDefaultLandingSortState(primary.statMode, primary.displayMode),
      pagination: {
        page: 1,
        pageSize: options.pageSize ?? DEFAULT_PLAYER_STATS_PAGE_SIZE,
      },
    },
  };
}

export function isPlayerStatsScopeModifierActive(
  scope: PlayerStatsScopeState
): boolean {
  return scope.kind !== "none";
}

export function applyPlayerStatsScopeChange<T extends PlayerStatsFilterState>(
  state: T,
  nextScope: PlayerStatsScopeState
): T {
  return {
    ...state,
    expandable: {
      ...state.expandable,
      scope: nextScope,
    },
  };
}

export function serializePlayerStatsFilterStateToQuery(
  state: PlayerStatsFilterState
): PlayerStatsSerializedQuery {
  const query: PlayerStatsSerializedQuery = {};

  setQueryParam(
    query,
    PLAYER_STATS_QUERY_PARAM_KEYS.fromSeasonId,
    state.primary.seasonRange.fromSeasonId
  );
  setQueryParam(
    query,
    PLAYER_STATS_QUERY_PARAM_KEYS.throughSeasonId,
    state.primary.seasonRange.throughSeasonId
  );
  setQueryParam(
    query,
    PLAYER_STATS_QUERY_PARAM_KEYS.seasonType,
    state.primary.seasonType
  );
  setQueryParam(query, PLAYER_STATS_QUERY_PARAM_KEYS.strength, state.primary.strength);
  setQueryParam(
    query,
    PLAYER_STATS_QUERY_PARAM_KEYS.scoreState,
    state.primary.scoreState
  );
  setQueryParam(query, PLAYER_STATS_QUERY_PARAM_KEYS.statMode, state.primary.statMode);
  setQueryParam(
    query,
    PLAYER_STATS_QUERY_PARAM_KEYS.displayMode,
    state.primary.displayMode
  );

  if (state.surface === "landing") {
    setQueryParam(query, PLAYER_STATS_QUERY_PARAM_KEYS.teamId, state.expandable.teamId);
  } else {
    setQueryParam(
      query,
      PLAYER_STATS_QUERY_PARAM_KEYS.againstTeamId,
      state.expandable.againstTeamId
    );
  }

  setQueryParam(
    query,
    PLAYER_STATS_QUERY_PARAM_KEYS.positionGroup,
    state.expandable.positionGroup
  );
  setQueryParam(query, PLAYER_STATS_QUERY_PARAM_KEYS.venue, state.expandable.venue);
  setQueryParam(
    query,
    PLAYER_STATS_QUERY_PARAM_KEYS.minimumToiSeconds,
    state.expandable.minimumToiSeconds
  );
  setQueryParam(
    query,
    PLAYER_STATS_QUERY_PARAM_KEYS.tradeMode,
    state.expandable.tradeMode
  );
  setQueryParam(query, PLAYER_STATS_QUERY_PARAM_KEYS.scope, state.expandable.scope.kind);

  if (state.expandable.scope.kind === "dateRange") {
    setQueryParam(
      query,
      PLAYER_STATS_QUERY_PARAM_KEYS.startDate,
      state.expandable.scope.startDate
    );
    setQueryParam(
      query,
      PLAYER_STATS_QUERY_PARAM_KEYS.endDate,
      state.expandable.scope.endDate
    );
  }

  if (state.expandable.scope.kind === "gameRange") {
    setQueryParam(
      query,
      PLAYER_STATS_QUERY_PARAM_KEYS.gameRange,
      state.expandable.scope.value
    );
  }

  if (state.expandable.scope.kind === "byTeamGames") {
    setQueryParam(
      query,
      PLAYER_STATS_QUERY_PARAM_KEYS.byTeamGames,
      state.expandable.scope.value
    );
  }

  setQueryParam(query, PLAYER_STATS_QUERY_PARAM_KEYS.sortKey, state.view.sort.sortKey);
  setQueryParam(
    query,
    PLAYER_STATS_QUERY_PARAM_KEYS.sortDirection,
    state.view.sort.direction
  );
  setQueryParam(query, PLAYER_STATS_QUERY_PARAM_KEYS.page, state.view.pagination.page);
  setQueryParam(
    query,
    PLAYER_STATS_QUERY_PARAM_KEYS.pageSize,
    state.view.pagination.pageSize
  );

  return query;
}

export function buildPlayerStatsSearchParams(
  state: PlayerStatsFilterState
): URLSearchParams {
  return new URLSearchParams(serializePlayerStatsFilterStateToQuery(state));
}

export function createDetailFilterStateFromLandingContext(
  landingState: PlayerStatsLandingFilterState
): PlayerStatsDetailFilterState {
  const detailState: PlayerStatsDetailFilterState = {
    surface: "detail",
    primary: {
      ...landingState.primary,
    },
    expandable: {
      againstTeamId: null,
      positionGroup: landingState.expandable.positionGroup,
      venue: landingState.expandable.venue,
      minimumToiSeconds: landingState.expandable.minimumToiSeconds,
      scope: landingState.expandable.scope,
      tradeMode: landingState.expandable.tradeMode,
      advancedOpen: DEFAULT_PLAYER_STATS_ADVANCED_OPEN,
    },
    view: {
      sort: {
        ...landingState.view.sort,
      },
      pagination: {
        page: 1,
        pageSize: landingState.view.pagination.pageSize,
      },
    },
  };

  return normalizePlayerStatsFilterStateForMode(detailState).state;
}

export function buildPlayerStatsDetailHref(
  playerId: number | string,
  landingState: PlayerStatsLandingFilterState
): string {
  const pathname = `/underlying-stats/playerStats/${playerId}`;
  const query = buildPlayerStatsSearchParams(
    createDetailFilterStateFromLandingContext(landingState)
  ).toString();

  return query ? `${pathname}?${query}` : pathname;
}

export function normalizePlayerStatsFilterStateForMode<
  T extends PlayerStatsFilterState,
>(state: T): PlayerStatsFilterNormalizationResult<T> {
  const compatibility = PLAYER_STATS_MODE_COMPATIBILITY[state.primary.statMode];
  const resetReasons: PlayerStatsFilterResetReason[] = [];
  let nextState = state;

  if (!compatibility.visibleModes.includes(state.primary.displayMode)) {
    nextState = {
      ...nextState,
      primary: {
        ...nextState.primary,
        displayMode: compatibility.visibleModes[0],
      },
    };
    resetReasons.push("displayModeResetForMode");
  }

  const positionGroup = nextState.expandable.positionGroup;
  const positionGroupAllowed =
    positionGroup === null ||
    (compatibility.allowedPositionGroups as readonly string[]).includes(positionGroup);

  if ((!compatibility.supportsPositionFilter || !positionGroupAllowed) && positionGroup !== null) {
    nextState = {
      ...nextState,
      expandable: {
        ...nextState.expandable,
        positionGroup: null,
      },
    };
    resetReasons.push("positionGroupClearedForMode");
  }

  return {
    state: nextState,
    resetReasons,
  };
}

export function applyPlayerStatsModeChange<T extends PlayerStatsFilterState>(
  state: T,
  nextMode: PlayerStatsMode
): PlayerStatsFilterNormalizationResult<T> {
  const nextState = {
    ...state,
    primary: {
      ...state.primary,
      statMode: nextMode,
    },
  } as T;

  return normalizePlayerStatsFilterStateForMode(nextState);
}

export function getPlayerStatsMinimumToiControlState(
  state: PlayerStatsFilterState
): PlayerStatsMinimumToiControlState {
  return {
    supported: true,
    visible: true,
    disabled: false,
    retainedValue: state.expandable.minimumToiSeconds,
    appliesAfterAggregation: true,
  };
}

export function validatePlayerStatsFilterState(
  state: PlayerStatsFilterState,
  options: {
    seasonWindowsById?: PlayerStatsSeasonWindowMap;
  } = {}
): PlayerStatsValidationResult {
  const issues: PlayerStatsValidationIssue[] = [];
  const { fromSeasonId, throughSeasonId } = state.primary.seasonRange;

  if (!fromSeasonId || !throughSeasonId) {
    issues.push("seasonRangeMissing");
  } else if (fromSeasonId > throughSeasonId) {
    issues.push("seasonRangeOrder");
  }

  if (state.expandable.scope.kind === "dateRange") {
    const { startDate, endDate } = state.expandable.scope;

    if (!startDate) {
      issues.push("dateRangeMissingStart");
    }

    if (!endDate) {
      issues.push("dateRangeMissingEnd");
    }

    if (startDate && endDate && compareDateOnly(startDate, endDate) > 0) {
      issues.push("dateRangeOrder");
    }

    if (
      startDate &&
      endDate &&
      !issues.includes("seasonRangeMissing") &&
      !issues.includes("seasonRangeOrder")
    ) {
      const bounds = getSeasonSpanDateBounds(
        state.primary,
        options.seasonWindowsById
      );

      if (
        bounds &&
        (compareDateOnly(startDate, bounds.minDate) < 0 ||
          compareDateOnly(endDate, bounds.maxDate) > 0)
      ) {
        issues.push("dateRangeOutsideSeasonSpan");
      }
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

export function parsePlayerStatsFilterStateFromQuery<T extends PlayerStatsFilterState>(
  query: PlayerStatsQueryInput,
  fallbackState: T
): T {
  const primary = parsePrimaryFilters(query, fallbackState.primary);
  const view = {
    sort: parseSortState(query, fallbackState.view.sort),
    pagination: parsePaginationState(query, fallbackState.view.pagination),
  };

  if (fallbackState.surface === "landing") {
    const state: PlayerStatsLandingFilterState = {
      surface: "landing",
      primary,
      expandable: {
        teamId: parseOptionalPositiveIntegerParam(
          query,
          PLAYER_STATS_QUERY_PARAM_KEYS.teamId
        ),
        positionGroup: parsePositionGroup(query),
        venue: parseVenue(query, fallbackState.expandable.venue),
        minimumToiSeconds: parseOptionalPositiveIntegerParam(
          query,
          PLAYER_STATS_QUERY_PARAM_KEYS.minimumToiSeconds
        ),
        scope: parseScopeModifier(query, fallbackState.expandable.scope),
        tradeMode: parseTradeMode(query, fallbackState.expandable.tradeMode),
        advancedOpen: fallbackState.expandable.advancedOpen,
      },
      view,
    };

    return normalizePlayerStatsFilterStateForMode(state as T).state;
  }

  const state: PlayerStatsDetailFilterState = {
    surface: "detail",
    primary,
    expandable: {
      againstTeamId: parseOptionalPositiveIntegerParam(
        query,
        PLAYER_STATS_QUERY_PARAM_KEYS.againstTeamId
      ),
      positionGroup: parsePositionGroup(query),
      venue: parseVenue(query, fallbackState.expandable.venue),
      minimumToiSeconds: parseOptionalPositiveIntegerParam(
        query,
        PLAYER_STATS_QUERY_PARAM_KEYS.minimumToiSeconds
      ),
      scope: parseScopeModifier(query, fallbackState.expandable.scope),
      tradeMode: parseTradeMode(query, fallbackState.expandable.tradeMode),
      advancedOpen: fallbackState.expandable.advancedOpen,
    },
    view,
  };

  return normalizePlayerStatsFilterStateForMode(state as T).state;
}
