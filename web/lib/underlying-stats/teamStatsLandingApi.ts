import {
  buildTeamStatsSearchParams,
  resolveTeamStatsTableFamily,
  type TeamStatsLandingFilterState,
  type TeamStatsSortState,
  type TeamStatsTableFamily,
} from "./teamStatsFilters";

export type TeamStatsLandingApiRow = {
  rowKey: string;
  /** Competition rank in the current sort (ties share a rank); not a quality rank. */
  rank?: number;
  teamId: number;
  teamLabel: string;
  gamesPlayed: number;
  /** Null when any game in the window has unknown ice time (rule 13). */
  toiSeconds: number | null;
  toiPerGameSeconds: number | null;
  /**
   * Record columns are null under a strength or score-state split (decision 92)
   * and count only games with a resolved winner (W2-3 D12).
   */
  wins: number | null;
  losses: number | null;
  otl: number | null;
  rowWins: number | null;
  points: number | null;
  pointPct: number | null;
  /** Games in the window whose winner is unresolved; excluded from the record. */
  unresolvedGames?: number;
  /** Which official NHL totals replaced native values, if any (W2-2 D12 provenance). */
  officialOverlay?: "allStrengths" | "fiveOnFive" | null;
  cf: number;
  ca: number;
  cfPct: number | null;
  ff: number;
  fa: number;
  ffPct: number | null;
  sf: number;
  sa: number;
  sfPct: number | null;
  gf: number;
  ga: number;
  gfPct: number | null;
  /** Bucket-heuristic xG is hidden (decisions 6, 12): always null. */
  xgf: number | null;
  xga: number | null;
  xgfPct: number | null;
  scf: number;
  sca: number;
  scfPct: number | null;
  scsf: number;
  scsa: number;
  scsfPct: number | null;
  scgf: number;
  scga: number;
  scgfPct: number | null;
  scshPct: number | null;
  scsvPct: number | null;
  hdcf: number;
  hdca: number;
  hdcfPct: number | null;
  hdsf: number;
  hdsa: number;
  hdsfPct: number | null;
  hdgf: number;
  hdga: number;
  hdgfPct: number | null;
  hdshPct: number | null;
  hdsvPct: number | null;
  mdcf: number;
  mdca: number;
  mdcfPct: number | null;
  mdsf: number;
  mdsa: number;
  mdsfPct: number | null;
  mdgf: number;
  mdga: number;
  mdgfPct: number | null;
  mdshPct: number | null;
  mdsvPct: number | null;
  ldcf: number;
  ldca: number;
  ldcfPct: number | null;
  ldsf: number;
  ldsa: number;
  ldsfPct: number | null;
  ldgf: number;
  ldga: number;
  ldgfPct: number | null;
  ldshPct: number | null;
  ldsvPct: number | null;
  shPct: number | null;
  svPct: number | null;
  pdo: number | null;
  cfPer60?: number | null;
  caPer60?: number | null;
  ffPer60?: number | null;
  faPer60?: number | null;
  sfPer60?: number | null;
  saPer60?: number | null;
  gfPer60?: number | null;
  gaPer60?: number | null;
  xgfPer60?: number | null;
  xgaPer60?: number | null;
  scfPer60?: number | null;
  scaPer60?: number | null;
  scsfPer60?: number | null;
  scsaPer60?: number | null;
  scgfPer60?: number | null;
  scgaPer60?: number | null;
  hdcfPer60?: number | null;
  hdcaPer60?: number | null;
  hdsfPer60?: number | null;
  hdsaPer60?: number | null;
  hdgfPer60?: number | null;
  hdgaPer60?: number | null;
  mdcfPer60?: number | null;
  mdcaPer60?: number | null;
  mdsfPer60?: number | null;
  mdsaPer60?: number | null;
  mdgfPer60?: number | null;
  mdgaPer60?: number | null;
  ldcfPer60?: number | null;
  ldcaPer60?: number | null;
  ldsfPer60?: number | null;
  ldsaPer60?: number | null;
  ldgfPer60?: number | null;
  ldgaPer60?: number | null;
  [key: string]: unknown;
};

export type TeamStatsLandingPaginationMeta = {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
};

export type TeamStatsLandingApiResponse = {
  family: TeamStatsTableFamily;
  rows: TeamStatsLandingApiRow[];
  sort: TeamStatsSortState;
  pagination: TeamStatsLandingPaginationMeta;
  placeholder: boolean;
  generatedAt: string;
  // Single-season requests only: completed games versus games with stored
  // team summaries, so missing source coverage is not shown as "no matches".
  coverage?: TeamStatsLandingCoverage | null;
};

export type TeamStatsLandingCoverage = {
  /** Scheduled games dated before today (UTC); completion is not tracked here. */
  completedGames: number;
  /** Approximate game equivalents: all-situations team rows divided by two. */
  summarizedGames: number;
};

export type TeamStatsLandingApiError = {
  error: string;
  issues?: string[];
};

export function buildTeamStatsLandingApiPath(state: TeamStatsLandingFilterState): string {
  const query = buildTeamStatsSearchParams(state).toString();
  return query
    ? `/api/v1/underlying-stats/teams?${query}`
    : "/api/v1/underlying-stats/teams";
}

export function createEmptyTeamStatsLandingResponse(
  state: TeamStatsLandingFilterState
): TeamStatsLandingApiResponse {
  return {
    family: resolveTeamStatsTableFamily(state.primary.displayMode),
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