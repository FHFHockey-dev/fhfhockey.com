import type {
  PlayerStatsDisplayMode,
  PlayerStatsScoreState,
  PlayerStatsSeasonType,
  PlayerStatsStrength,
  PlayerStatsVenue,
} from "./playerStatsTypes";
import {
  PLAYER_STATS_DISPLAY_MODES,
  PLAYER_STATS_SCORE_STATES,
  PLAYER_STATS_SEASON_TYPES,
  PLAYER_STATS_STRENGTHS,
  PLAYER_STATS_VENUES,
} from "./playerStatsTypes";

export const DEFAULT_TEAM_STATS_PAGE_SIZE = 50;

export const DEFAULT_TEAM_STATS_ADVANCED_OPEN = false;

export const DEFAULT_TEAM_STATS_DISPLAY_MODE = "counts" as const;

export const DEFAULT_TEAM_STATS_SEASON_TYPE = "regularSeason" as const;

export const DEFAULT_TEAM_STATS_STRENGTH = "fiveOnFive" as const;

export const DEFAULT_TEAM_STATS_SCORE_STATE = "allScores" as const;

export const TEAM_STATS_QUERY_PARAM_KEYS = {
  fromSeasonId: "fromSeasonId",
  throughSeasonId: "throughSeasonId",
  seasonType: "seasonType",
  strength: "strength",
  scoreState: "scoreState",
  displayMode: "displayMode",
  teamId: "teamId",
  againstTeamId: "againstTeamId",
  venue: "venue",
  minimumToiSeconds: "minimumToiSeconds",
  scope: "scope",
  startDate: "startDate",
  endDate: "endDate",
  gameRange: "gameRange",
  teamGameRange: "teamGameRange",
  sortKey: "sortKey",
  sortDirection: "sortDirection",
  page: "page",
  pageSize: "pageSize",
} as const;

export type TeamStatsQueryValue = string | string[] | undefined;

export type TeamStatsQueryInput =
  | URLSearchParams
  | Record<string, TeamStatsQueryValue>;

export type TeamStatsSerializedQuery = Record<string, string>;

export type TeamStatsSortDirection = "asc" | "desc";

export type TeamStatsSortState = {
  sortKey: string | null;
  direction: TeamStatsSortDirection;
};

export const TEAM_STATS_TABLE_FAMILIES = ["counts", "rates"] as const;

export type TeamStatsTableFamily = (typeof TEAM_STATS_TABLE_FAMILIES)[number];

export type TeamStatsPaginationState = {
  page: number;
  pageSize: number;
};

export type TeamStatsSeasonRange = {
  fromSeasonId: number | null;
  throughSeasonId: number | null;
};

export type TeamStatsDateRangeScope = {
  kind: "dateRange";
  startDate: string | null;
  endDate: string | null;
};

export type TeamStatsGameRangeScope = {
  kind: "gameRange";
  value: number | null;
};

export type TeamStatsTeamGameRangeScope = {
  kind: "teamGameRange";
  value: number | null;
};

export type TeamStatsNoScope = {
  kind: "none";
};

export type TeamStatsScopeModifier =
  | TeamStatsNoScope
  | TeamStatsDateRangeScope
  | TeamStatsGameRangeScope
  | TeamStatsTeamGameRangeScope;

export type TeamStatsPrimaryFilters = {
  seasonRange: TeamStatsSeasonRange;
  seasonType: PlayerStatsSeasonType;
  strength: PlayerStatsStrength;
  scoreState: PlayerStatsScoreState;
  displayMode: PlayerStatsDisplayMode;
};

export type TeamStatsExpandableFilters = {
  teamId: number | null;
  againstTeamId: number | null;
  venue: PlayerStatsVenue;
  minimumToiSeconds: number | null;
  scope: TeamStatsScopeModifier;
  advancedOpen: boolean;
};

export type TeamStatsLandingFilterState = {
  surface: "landing";
  primary: TeamStatsPrimaryFilters;
  expandable: TeamStatsExpandableFilters;
  view: {
    sort: TeamStatsSortState;
    pagination: TeamStatsPaginationState;
  };
};

export type TeamStatsFilterState = TeamStatsLandingFilterState;

export type TeamStatsSeasonWindow = {
  seasonId: number;
  regularSeasonStartDate: string | null;
  regularSeasonEndDate: string | null;
  seasonEndDate: string | null;
};

export type TeamStatsSeasonWindowMap = Record<number, TeamStatsSeasonWindow>;

export type TeamStatsValidationIssue =
  | "seasonRangeMissing"
  | "seasonRangeOrder"
  | "dateRangeMissingStart"
  | "dateRangeMissingEnd"
  | "dateRangeOrder"
  | "gameRangeMissingValue"
  | "teamGameRangeMissingValue"
  | "dateRangeOutsideSeasonSpan";

export type TeamStatsValidationResult = {
  isValid: boolean;
  issues: TeamStatsValidationIssue[];
};

export type TeamStatsFilterNormalizationResult = {
  state: TeamStatsLandingFilterState;
};

export type TeamStatsMinimumToiControlState = {
  supported: true;
  visible: true;
  disabled: false;
  retainedValue: number | null;
  appliesAfterAggregation: true;
};

const TEAM_STATS_SORT_DIRECTIONS = ["asc", "desc"] as const;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const TEAM_STATS_COUNT_SORT_KEYS = [
  "rank",
  "teamLabel",
  "gamesPlayed",
  "toiSeconds",
  "wins",
  "losses",
  "otl",
  "rowWins",
  "points",
  "pointPct",
  "cf",
  "ca",
  "cfPct",
  "ff",
  "fa",
  "ffPct",
  "sf",
  "sa",
  "sfPct",
  "gf",
  "ga",
  "gfPct",
  "xgf",
  "xga",
  "xgfPct",
  "scf",
  "sca",
  "scfPct",
  "scsf",
  "scsa",
  "scsfPct",
  "scgf",
  "scga",
  "scgfPct",
  "scshPct",
  "scsvPct",
  "hdcf",
  "hdca",
  "hdcfPct",
  "hdsf",
  "hdsa",
  "hdsfPct",
  "hdgf",
  "hdga",
  "hdgfPct",
  "hdshPct",
  "hdsvPct",
  "mdcf",
  "mdca",
  "mdcfPct",
  "mdsf",
  "mdsa",
  "mdsfPct",
  "mdgf",
  "mdga",
  "mdgfPct",
  "mdshPct",
  "mdsvPct",
  "ldcf",
  "ldca",
  "ldcfPct",
  "ldsf",
  "ldsa",
  "ldsfPct",
  "ldgf",
  "ldga",
  "ldgfPct",
  "ldshPct",
  "ldsvPct",
  "shPct",
  "svPct",
  "pdo",
] as const;

const TEAM_STATS_RATE_SORT_KEYS = [
  "rank",
  "teamLabel",
  "gamesPlayed",
  "toiPerGameSeconds",
  "wins",
  "losses",
  "otl",
  "rowWins",
  "points",
  "pointPct",
  "cfPer60",
  "caPer60",
  "cfPct",
  "ffPer60",
  "faPer60",
  "ffPct",
  "sfPer60",
  "saPer60",
  "sfPct",
  "gfPer60",
  "gaPer60",
  "gfPct",
  "xgfPer60",
  "xgaPer60",
  "xgfPct",
  "scfPer60",
  "scaPer60",
  "scfPct",
  "scsfPer60",
  "scsaPer60",
  "scsfPct",
  "scgfPer60",
  "scgaPer60",
  "scgfPct",
  "scshPct",
  "scsvPct",
  "hdcfPer60",
  "hdcaPer60",
  "hdcfPct",
  "hdsfPer60",
  "hdsaPer60",
  "hdsfPct",
  "hdgfPer60",
  "hdgaPer60",
  "hdgfPct",
  "hdshPct",
  "hdsvPct",
  "mdcfPer60",
  "mdcaPer60",
  "mdcfPct",
  "mdsfPer60",
  "mdsaPer60",
  "mdsfPct",
  "mdgfPer60",
  "mdgaPer60",
  "mdgfPct",
  "mdshPct",
  "mdsvPct",
  "ldcfPer60",
  "ldcaPer60",
  "ldcfPct",
  "ldsfPer60",
  "ldsaPer60",
  "ldsfPct",
  "ldgfPer60",
  "ldgaPer60",
  "ldgfPct",
  "ldshPct",
  "ldsvPct",
  "shPct",
  "svPct",
  "pdo",
] as const;

export const TEAM_STATS_SORT_KEYS_BY_FAMILY: Record<
  TeamStatsTableFamily,
  readonly string[]
> = {
  counts: TEAM_STATS_COUNT_SORT_KEYS,
  rates: TEAM_STATS_RATE_SORT_KEYS,
};

export const TEAM_STATS_DEFAULT_SORTS: Record<TeamStatsTableFamily, TeamStatsSortState> = {
  counts: { sortKey: "points", direction: "desc" },
  rates: { sortKey: "xgfPct", direction: "desc" },
};

function getQueryParam(
  query: TeamStatsQueryInput,
  key: string
): string | undefined {
  if (query instanceof URLSearchParams) {
    return query.get(key) ?? undefined;
  }

  const value = query[key];
  return Array.isArray(value) ? value[0] : value;
}

function parseEnumParam<T extends string>(
  query: TeamStatsQueryInput,
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
  query: TeamStatsQueryInput,
  key: string,
  fallback: number
): number {
  return parsePositiveInteger(getQueryParam(query, key)) ?? fallback;
}

function parseOptionalPositiveIntegerParam(
  query: TeamStatsQueryInput,
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

function deriveFallbackSeasonWindow(seasonId: number): TeamStatsSeasonWindow | null {
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
  seasonWindowsById?: TeamStatsSeasonWindowMap
): TeamStatsSeasonWindow | null {
  return seasonWindowsById?.[seasonId] ?? deriveFallbackSeasonWindow(seasonId);
}

function getSeasonSpanDateBounds(
  primary: TeamStatsPrimaryFilters,
  seasonWindowsById?: TeamStatsSeasonWindowMap
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
  query: TeamStatsQueryInput,
  fallback: TeamStatsSortState
): TeamStatsSortState {
  const sortKey = getQueryParam(query, TEAM_STATS_QUERY_PARAM_KEYS.sortKey)?.trim();

  if (!sortKey) {
    return fallback;
  }

  return {
    sortKey,
    direction: parseEnumParam<TeamStatsSortDirection>(
      query,
      TEAM_STATS_QUERY_PARAM_KEYS.sortDirection,
      TEAM_STATS_SORT_DIRECTIONS,
      fallback.direction
    ),
  };
}

function parsePaginationState(
  query: TeamStatsQueryInput,
  fallback: TeamStatsPaginationState
): TeamStatsPaginationState {
  return {
    page: parsePositiveIntegerParam(
      query,
      TEAM_STATS_QUERY_PARAM_KEYS.page,
      fallback.page
    ),
    pageSize: parsePositiveIntegerParam(
      query,
      TEAM_STATS_QUERY_PARAM_KEYS.pageSize,
      fallback.pageSize
    ),
  };
}

function parsePrimaryFilters(
  query: TeamStatsQueryInput,
  fallback: TeamStatsPrimaryFilters
): TeamStatsPrimaryFilters {
  return {
    seasonRange: {
      fromSeasonId:
        parsePositiveInteger(getQueryParam(query, TEAM_STATS_QUERY_PARAM_KEYS.fromSeasonId)) ??
        fallback.seasonRange.fromSeasonId,
      throughSeasonId:
        parsePositiveInteger(getQueryParam(query, TEAM_STATS_QUERY_PARAM_KEYS.throughSeasonId)) ??
        fallback.seasonRange.throughSeasonId,
    },
    seasonType: parseEnumParam<PlayerStatsSeasonType>(
      query,
      TEAM_STATS_QUERY_PARAM_KEYS.seasonType,
      PLAYER_STATS_SEASON_TYPES,
      fallback.seasonType
    ),
    strength: parseEnumParam<PlayerStatsStrength>(
      query,
      TEAM_STATS_QUERY_PARAM_KEYS.strength,
      PLAYER_STATS_STRENGTHS,
      fallback.strength
    ),
    scoreState: parseEnumParam<PlayerStatsScoreState>(
      query,
      TEAM_STATS_QUERY_PARAM_KEYS.scoreState,
      PLAYER_STATS_SCORE_STATES,
      fallback.scoreState
    ),
    displayMode: parseEnumParam<PlayerStatsDisplayMode>(
      query,
      TEAM_STATS_QUERY_PARAM_KEYS.displayMode,
      PLAYER_STATS_DISPLAY_MODES,
      fallback.displayMode
    ),
  };
}

function parseVenue(
  query: TeamStatsQueryInput,
  fallback: PlayerStatsVenue
): PlayerStatsVenue {
  return parseEnumParam<PlayerStatsVenue>(
    query,
    TEAM_STATS_QUERY_PARAM_KEYS.venue,
    PLAYER_STATS_VENUES,
    fallback
  );
}

function parseScopeModifier(
  query: TeamStatsQueryInput,
  fallback: TeamStatsScopeModifier
): TeamStatsScopeModifier {
  const scope = getQueryParam(query, TEAM_STATS_QUERY_PARAM_KEYS.scope);

  if (scope === "dateRange") {
    return {
      kind: "dateRange",
      startDate: parseDateOnly(getQueryParam(query, TEAM_STATS_QUERY_PARAM_KEYS.startDate)),
      endDate: parseDateOnly(getQueryParam(query, TEAM_STATS_QUERY_PARAM_KEYS.endDate)),
    };
  }

  if (scope === "gameRange") {
    return {
      kind: "gameRange",
      value: parseOptionalPositiveIntegerParam(query, TEAM_STATS_QUERY_PARAM_KEYS.gameRange),
    };
  }

  if (scope === "teamGameRange") {
    return {
      kind: "teamGameRange",
      value: parseOptionalPositiveIntegerParam(
        query,
        TEAM_STATS_QUERY_PARAM_KEYS.teamGameRange
      ),
    };
  }

  if (scope === "none") {
    return { kind: "none" };
  }

  return fallback;
}

function normalizeTeamStatsScopeModifier(
  scope: TeamStatsScopeModifier
): TeamStatsScopeModifier {
  if (scope.kind === "dateRange") {
    return {
      kind: "dateRange",
      startDate: scope.startDate,
      endDate: scope.endDate,
    };
  }

  if (scope.kind === "gameRange") {
    return {
      kind: "gameRange",
      value: scope.value,
    };
  }

  if (scope.kind === "teamGameRange") {
    return {
      kind: "teamGameRange",
      value: scope.value,
    };
  }

  return { kind: "none" };
}

function resolveScopeModifierFromQuery(
  query: TeamStatsQueryInput,
  fallback: TeamStatsScopeModifier
): TeamStatsScopeModifier {
  const explicitScope = parseScopeModifier(query, fallback);
  if (explicitScope.kind !== fallback.kind || explicitScope.kind !== "none") {
    return normalizeTeamStatsScopeModifier(explicitScope);
  }

  const startDate = parseDateOnly(getQueryParam(query, TEAM_STATS_QUERY_PARAM_KEYS.startDate));
  const endDate = parseDateOnly(getQueryParam(query, TEAM_STATS_QUERY_PARAM_KEYS.endDate));
  if (startDate || endDate) {
    return normalizeTeamStatsScopeModifier({
      kind: "dateRange",
      startDate,
      endDate,
    });
  }

  const gameRange = parseOptionalPositiveIntegerParam(
    query,
    TEAM_STATS_QUERY_PARAM_KEYS.gameRange
  );
  if (gameRange != null) {
    return normalizeTeamStatsScopeModifier({
      kind: "gameRange",
      value: gameRange,
    });
  }

  const teamGameRange = parseOptionalPositiveIntegerParam(
    query,
    TEAM_STATS_QUERY_PARAM_KEYS.teamGameRange
  );
  if (teamGameRange != null) {
    return normalizeTeamStatsScopeModifier({
      kind: "teamGameRange",
      value: teamGameRange,
    });
  }

  return normalizeTeamStatsScopeModifier(fallback);
}

function setQueryParam(
  query: TeamStatsSerializedQuery,
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
  const startYear = monthIndex >= 8 ? year : year - 1;
  return Number(`${startYear}${startYear + 1}`);
}

export function getDefaultTeamLandingSortState(
  displayMode: PlayerStatsDisplayMode = DEFAULT_TEAM_STATS_DISPLAY_MODE
): TeamStatsSortState {
  return TEAM_STATS_DEFAULT_SORTS[resolveTeamStatsTableFamily(displayMode)];
}

export function resolveTeamStatsTableFamily(
  displayMode: PlayerStatsDisplayMode
): TeamStatsTableFamily {
  return displayMode === "rates" ? "rates" : "counts";
}

export function getTeamStatsDefaultSortForFamily(
  family: TeamStatsTableFamily
): TeamStatsSortState {
  return TEAM_STATS_DEFAULT_SORTS[family];
}

export function getTeamStatsSortKeysForFamily(
  family: TeamStatsTableFamily
): readonly string[] {
  return TEAM_STATS_SORT_KEYS_BY_FAMILY[family];
}

export function isValidTeamStatsSortKeyForFamily(
  family: TeamStatsTableFamily,
  sortKey: string | null | undefined
): boolean {
  return sortKey != null && TEAM_STATS_SORT_KEYS_BY_FAMILY[family].includes(sortKey);
}

export function normalizeTeamStatsSortState(
  displayMode: PlayerStatsDisplayMode,
  sort: TeamStatsSortState
): TeamStatsSortState {
  const family = resolveTeamStatsTableFamily(displayMode);
  if (!isValidTeamStatsSortKeyForFamily(family, sort.sortKey)) {
    return getTeamStatsDefaultSortForFamily(family);
  }

  return sort;
}

export function createDefaultTeamLandingPrimaryFilters(
  currentSeasonId: number = deriveFallbackCurrentSeasonId()
): TeamStatsPrimaryFilters {
  return {
    seasonRange: {
      fromSeasonId: currentSeasonId,
      throughSeasonId: currentSeasonId,
    },
    seasonType: DEFAULT_TEAM_STATS_SEASON_TYPE,
    strength: DEFAULT_TEAM_STATS_STRENGTH,
    scoreState: DEFAULT_TEAM_STATS_SCORE_STATE,
    displayMode: DEFAULT_TEAM_STATS_DISPLAY_MODE,
  };
}

export function createDefaultTeamLandingFilterState(options: {
  currentSeasonId?: number;
  asOfDate?: Date;
  pageSize?: number;
} = {}): TeamStatsLandingFilterState {
  const resolvedSeasonId =
    options.currentSeasonId ?? deriveFallbackCurrentSeasonId(options.asOfDate);
  const primary = createDefaultTeamLandingPrimaryFilters(resolvedSeasonId);

  return {
    surface: "landing",
    primary,
    expandable: {
      teamId: null,
      againstTeamId: null,
      venue: "all",
      minimumToiSeconds: null,
      scope: { kind: "none" },
      advancedOpen: DEFAULT_TEAM_STATS_ADVANCED_OPEN,
    },
    view: {
      sort: getDefaultTeamLandingSortState(primary.displayMode),
      pagination: {
        page: 1,
        pageSize: options.pageSize ?? DEFAULT_TEAM_STATS_PAGE_SIZE,
      },
    },
  };
}

export function isTeamStatsScopeModifierActive(
  scope: TeamStatsScopeModifier
): boolean {
  return scope.kind !== "none";
}

export function getTeamStatsMinimumToiControlState(
  state: TeamStatsFilterState
): TeamStatsMinimumToiControlState {
  return {
    supported: true,
    visible: true,
    disabled: false,
    retainedValue: state.expandable.minimumToiSeconds,
    appliesAfterAggregation: true,
  };
}

export function applyTeamStatsScopeChange(
  state: TeamStatsLandingFilterState,
  nextScope: TeamStatsScopeModifier
): TeamStatsLandingFilterState {
  return {
    ...state,
    expandable: {
      ...state.expandable,
      scope: normalizeTeamStatsScopeModifier(nextScope),
    },
  };
}

export function normalizeTeamStatsFilterState(
  state: TeamStatsLandingFilterState
): TeamStatsFilterNormalizationResult {
  const normalizedPrimary: TeamStatsPrimaryFilters = {
    ...state.primary,
    displayMode:
      state.primary.displayMode === "rates" ? "rates" : DEFAULT_TEAM_STATS_DISPLAY_MODE,
  };

  return {
    state: {
      ...state,
      primary: normalizedPrimary,
      expandable: {
        ...state.expandable,
        scope: normalizeTeamStatsScopeModifier(state.expandable.scope),
      },
      view: {
        ...state.view,
        sort: normalizeTeamStatsSortState(normalizedPrimary.displayMode, state.view.sort),
      },
    },
  };
}

export function serializeTeamStatsFilterStateToQuery(
  state: TeamStatsFilterState
): TeamStatsSerializedQuery {
  const normalizedState = normalizeTeamStatsFilterState(state).state;
  const query: TeamStatsSerializedQuery = {};

  setQueryParam(
    query,
    TEAM_STATS_QUERY_PARAM_KEYS.fromSeasonId,
    normalizedState.primary.seasonRange.fromSeasonId
  );
  setQueryParam(
    query,
    TEAM_STATS_QUERY_PARAM_KEYS.throughSeasonId,
    normalizedState.primary.seasonRange.throughSeasonId
  );
  setQueryParam(
    query,
    TEAM_STATS_QUERY_PARAM_KEYS.seasonType,
    normalizedState.primary.seasonType
  );
  setQueryParam(query, TEAM_STATS_QUERY_PARAM_KEYS.strength, normalizedState.primary.strength);
  setQueryParam(
    query,
    TEAM_STATS_QUERY_PARAM_KEYS.scoreState,
    normalizedState.primary.scoreState
  );
  setQueryParam(
    query,
    TEAM_STATS_QUERY_PARAM_KEYS.displayMode,
    normalizedState.primary.displayMode
  );
  setQueryParam(query, TEAM_STATS_QUERY_PARAM_KEYS.teamId, normalizedState.expandable.teamId);
  setQueryParam(
    query,
    TEAM_STATS_QUERY_PARAM_KEYS.againstTeamId,
    normalizedState.expandable.againstTeamId
  );
  setQueryParam(query, TEAM_STATS_QUERY_PARAM_KEYS.venue, normalizedState.expandable.venue);
  setQueryParam(
    query,
    TEAM_STATS_QUERY_PARAM_KEYS.minimumToiSeconds,
    normalizedState.expandable.minimumToiSeconds
  );
  setQueryParam(
    query,
    TEAM_STATS_QUERY_PARAM_KEYS.scope,
    normalizedState.expandable.scope.kind
  );

  if (normalizedState.expandable.scope.kind === "dateRange") {
    setQueryParam(
      query,
      TEAM_STATS_QUERY_PARAM_KEYS.startDate,
      normalizedState.expandable.scope.startDate
    );
    setQueryParam(
      query,
      TEAM_STATS_QUERY_PARAM_KEYS.endDate,
      normalizedState.expandable.scope.endDate
    );
  }

  if (normalizedState.expandable.scope.kind === "gameRange") {
    setQueryParam(
      query,
      TEAM_STATS_QUERY_PARAM_KEYS.gameRange,
      normalizedState.expandable.scope.value
    );
  }

  if (normalizedState.expandable.scope.kind === "teamGameRange") {
    setQueryParam(
      query,
      TEAM_STATS_QUERY_PARAM_KEYS.teamGameRange,
      normalizedState.expandable.scope.value
    );
  }

  setQueryParam(query, TEAM_STATS_QUERY_PARAM_KEYS.sortKey, normalizedState.view.sort.sortKey);
  setQueryParam(
    query,
    TEAM_STATS_QUERY_PARAM_KEYS.sortDirection,
    normalizedState.view.sort.direction
  );
  setQueryParam(query, TEAM_STATS_QUERY_PARAM_KEYS.page, normalizedState.view.pagination.page);
  setQueryParam(
    query,
    TEAM_STATS_QUERY_PARAM_KEYS.pageSize,
    normalizedState.view.pagination.pageSize
  );

  return query;
}

export function buildTeamStatsSearchParams(
  state: TeamStatsFilterState
): URLSearchParams {
  return new URLSearchParams(serializeTeamStatsFilterStateToQuery(state));
}

export function parseTeamStatsFilterStateFromQuery(
  query: TeamStatsQueryInput,
  fallbackState: TeamStatsLandingFilterState
): TeamStatsLandingFilterState {
  return normalizeTeamStatsFilterState({
    surface: "landing",
    primary: parsePrimaryFilters(query, fallbackState.primary),
    expandable: {
      teamId: parseOptionalPositiveIntegerParam(query, TEAM_STATS_QUERY_PARAM_KEYS.teamId),
      againstTeamId: parseOptionalPositiveIntegerParam(
        query,
        TEAM_STATS_QUERY_PARAM_KEYS.againstTeamId
      ),
      venue: parseVenue(query, fallbackState.expandable.venue),
      minimumToiSeconds: parseOptionalPositiveIntegerParam(
        query,
        TEAM_STATS_QUERY_PARAM_KEYS.minimumToiSeconds
      ),
      scope: resolveScopeModifierFromQuery(query, fallbackState.expandable.scope),
      advancedOpen: fallbackState.expandable.advancedOpen,
    },
    view: {
      sort: parseSortState(query, fallbackState.view.sort),
      pagination: parsePaginationState(query, fallbackState.view.pagination),
    },
  }).state;
}

export function validateTeamStatsFilterState(
  state: TeamStatsFilterState,
  options: {
    seasonWindowsById?: TeamStatsSeasonWindowMap;
  } = {}
): TeamStatsValidationResult {
  const issues: TeamStatsValidationIssue[] = [];
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
      const bounds = getSeasonSpanDateBounds(state.primary, options.seasonWindowsById);

      if (
        bounds &&
        (compareDateOnly(startDate, bounds.minDate) < 0 ||
          compareDateOnly(endDate, bounds.maxDate) > 0)
      ) {
        issues.push("dateRangeOutsideSeasonSpan");
      }
    }
  }

  if (
    state.expandable.scope.kind === "gameRange" &&
    state.expandable.scope.value == null
  ) {
    issues.push("gameRangeMissingValue");
  }

  if (
    state.expandable.scope.kind === "teamGameRange" &&
    state.expandable.scope.value == null
  ) {
    issues.push("teamGameRangeMissingValue");
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}