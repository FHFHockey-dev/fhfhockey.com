import {
  buildTeamStatsSearchParams,
  resolveTeamStatsTableFamily,
  type TeamStatsLandingFilterState,
  type TeamStatsSortState,
  type TeamStatsTableFamily,
} from "./teamStatsFilters";

export type TeamStatsLandingApiRow = {
  rowKey: string;
  rank?: number;
  teamId: number;
  teamLabel: string;
  gamesPlayed: number;
  toiSeconds: number;
  toiPerGameSeconds: number | null;
  wins: number;
  losses: number;
  otl: number;
  rowWins: number;
  points: number;
  pointPct: number | null;
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
  xgf: number;
  xga: number;
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