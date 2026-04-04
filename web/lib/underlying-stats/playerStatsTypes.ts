export const PLAYER_STATS_SURFACES = ["landing", "detail"] as const;
export type PlayerStatsSurface = (typeof PLAYER_STATS_SURFACES)[number];

export const PLAYER_STATS_SEASON_TYPES = [
  "regularSeason",
  "playoffs",
  "preSeason",
] as const;
export type PlayerStatsSeasonType = (typeof PLAYER_STATS_SEASON_TYPES)[number];

export const PLAYER_STATS_STRENGTHS = [
  "fiveOnFive",
  "allStrengths",
  "evenStrength",
  "penaltyKill",
  "powerPlay",
  "fiveOnFourPP",
  "fourOnFivePK",
  "threeOnThree",
  "withEmptyNet",
  "againstEmptyNet",
] as const;
export type PlayerStatsStrength = (typeof PLAYER_STATS_STRENGTHS)[number];

export const PLAYER_STATS_SCORE_STATES = [
  "allScores",
  "tied",
  "leading",
  "trailing",
  "withinOne",
  "upOne",
  "downOne",
] as const;
export type PlayerStatsScoreState = (typeof PLAYER_STATS_SCORE_STATES)[number];

export const PLAYER_STATS_MODES = ["onIce", "individual", "goalies"] as const;
export type PlayerStatsMode = (typeof PLAYER_STATS_MODES)[number];

export const PLAYER_STATS_DISPLAY_MODES = ["counts", "rates"] as const;
export type PlayerStatsDisplayMode =
  (typeof PLAYER_STATS_DISPLAY_MODES)[number];

export const PLAYER_STATS_TABLE_FAMILIES = [
  "individualCounts",
  "individualRates",
  "onIceCounts",
  "onIceRates",
  "goalieCounts",
  "goalieRates",
] as const;
export type PlayerStatsTableFamily =
  (typeof PLAYER_STATS_TABLE_FAMILIES)[number];

export const PLAYER_STATS_POSITION_GROUPS = [
  "skaters",
  "defensemen",
  "centers",
  "leftWings",
  "rightWings",
  "goalies",
] as const;
export type PlayerStatsPositionGroup =
  (typeof PLAYER_STATS_POSITION_GROUPS)[number];

export const PLAYER_STATS_VENUES = ["all", "home", "away"] as const;
export type PlayerStatsVenue = (typeof PLAYER_STATS_VENUES)[number];

export const PLAYER_STATS_TRADE_MODES = ["combine", "split"] as const;
export type PlayerStatsTradeMode = (typeof PLAYER_STATS_TRADE_MODES)[number];

export type PlayerStatsSortDirection = "asc" | "desc";
export type PlayerStatsSortKey = string;

export type PlayerStatsPaginationState = {
  page: number;
  pageSize: number;
};

export const PLAYER_STATS_TABLE_RENDERING_STRATEGY = "pagination" as const;
export type PlayerStatsTableRenderingStrategy =
  typeof PLAYER_STATS_TABLE_RENDERING_STRATEGY;

export type PlayerStatsTablePaginationMeta = {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
};

export type PlayerStatsSortState = {
  sortKey: PlayerStatsSortKey | null;
  direction: PlayerStatsSortDirection;
};

export type PlayerStatsSeasonRange = {
  fromSeasonId: number | null;
  throughSeasonId: number | null;
};

export type PlayerStatsDateRangeScope = {
  kind: "dateRange";
  startDate: string | null;
  endDate: string | null;
};

export type PlayerStatsGameRangeScope = {
  kind: "gameRange";
  value: number | null;
};

export type PlayerStatsTeamGamesScope = {
  kind: "byTeamGames";
  value: number | null;
};

export type PlayerStatsNoScope = {
  kind: "none";
};

export type PlayerStatsScopeModifier =
  | PlayerStatsNoScope
  | PlayerStatsDateRangeScope
  | PlayerStatsGameRangeScope
  | PlayerStatsTeamGamesScope;

export type PlayerStatsPrimaryFilters = {
  seasonRange: PlayerStatsSeasonRange;
  seasonType: PlayerStatsSeasonType;
  strength: PlayerStatsStrength;
  scoreState: PlayerStatsScoreState;
  statMode: PlayerStatsMode;
  displayMode: PlayerStatsDisplayMode;
};

export type PlayerStatsLandingExpandableFilters = {
  teamId: number | null;
  againstTeamId?: never;
  positionGroup: PlayerStatsPositionGroup | null;
  venue: PlayerStatsVenue;
  minimumToiSeconds: number | null;
  scope: PlayerStatsScopeModifier;
  tradeMode: PlayerStatsTradeMode;
  advancedOpen: boolean;
};

export type PlayerStatsDetailExpandableFilters = {
  teamId?: never;
  againstTeamId: number | null;
  positionGroup: PlayerStatsPositionGroup | null;
  venue: PlayerStatsVenue;
  minimumToiSeconds: number | null;
  scope: PlayerStatsScopeModifier;
  tradeMode: PlayerStatsTradeMode;
  advancedOpen: boolean;
};

export type PlayerStatsBaseViewState = {
  sort: PlayerStatsSortState;
  pagination: PlayerStatsPaginationState;
};

export type PlayerStatsLandingFilterState = {
  surface: "landing";
  primary: PlayerStatsPrimaryFilters;
  expandable: PlayerStatsLandingExpandableFilters;
  view: PlayerStatsBaseViewState;
};

export type PlayerStatsDetailFilterState = {
  surface: "detail";
  primary: PlayerStatsPrimaryFilters;
  expandable: PlayerStatsDetailExpandableFilters;
  view: PlayerStatsBaseViewState;
};

export type PlayerStatsFilterState =
  | PlayerStatsLandingFilterState
  | PlayerStatsDetailFilterState;

export type PlayerStatsModeCompatibility = {
  visibleModes: readonly PlayerStatsDisplayMode[];
  allowedPositionGroups: readonly PlayerStatsPositionGroup[];
  supportsTeamFilter: boolean;
  supportsAgainstTeamFilter: boolean;
  supportsPositionFilter: boolean;
  showPositionColumn: boolean;
};

export const PLAYER_STATS_MODE_COMPATIBILITY: Record<
  PlayerStatsMode,
  PlayerStatsModeCompatibility
> = {
  individual: {
    visibleModes: PLAYER_STATS_DISPLAY_MODES,
    allowedPositionGroups: [
      "skaters",
      "defensemen",
      "centers",
      "leftWings",
      "rightWings",
    ],
    supportsTeamFilter: true,
    supportsAgainstTeamFilter: true,
    supportsPositionFilter: true,
    showPositionColumn: true,
  },
  onIce: {
    visibleModes: PLAYER_STATS_DISPLAY_MODES,
    allowedPositionGroups: [
      "skaters",
      "defensemen",
      "centers",
      "leftWings",
      "rightWings",
    ],
    supportsTeamFilter: true,
    supportsAgainstTeamFilter: true,
    supportsPositionFilter: true,
    showPositionColumn: true,
  },
  goalies: {
    visibleModes: PLAYER_STATS_DISPLAY_MODES,
    allowedPositionGroups: ["goalies"],
    supportsTeamFilter: true,
    supportsAgainstTeamFilter: true,
    supportsPositionFilter: false,
    showPositionColumn: false,
  },
};
