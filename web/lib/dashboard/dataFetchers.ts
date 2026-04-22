import { fetchCachedJson } from "./clientFetchCache";
import type { TeamRating } from "../teamRatingsService";
import type { CategoryComputationResult } from "../trends/teamPercentiles";
import type { TrendCategoryId } from "../trends/teamMetricConfig";
import type { GoalieTrendCategoryId } from "../trends/goalieMetricConfig";
import type { RequestedDateServingState } from "./freshness";
import { getTeamMetaByAbbr, getTeamMetaById } from "./teamMetadata";

// Trends dashboard aggregate fetchers.
// Pass-4 FORGE audit result: this file is still live through the older Trends
// dashboard path, but it is not the canonical fetch path for the standalone
// FORGE dashboard route family. Keep it isolated to aggregate Trends loading
// and share the common client fetch cache so overlapping endpoint contracts do
// not drift through parallel cache implementations.

export type TeamTrendsResponse = {
  seasonId: number;
  generatedAt: string;
  categories: Record<TrendCategoryId, CategoryComputationResult>;
};

export type CtpiResponse = {
  seasonId: number;
  generatedAt: string;
  teams: Array<{
    team: string;
    ctpi_0_to_100: number;
    offense: number;
    defense: number;
    goaltending: number;
    specialTeams: number;
    luck: number;
    sparkSeries?: Array<{ date: string; value: number }>;
  }>;
};

export type SosResponse = {
  seasonId: number;
  generatedAt: string;
  teams: Array<{
    team: string;
    teamId: number;
    date: string;
    past: { wins: number; losses: number; otl: number; winPct: number };
    future: { wins: number; losses: number; otl: number; winPct: number };
    combinedWinPct: number;
    sosScore: number;
  }>;
};

export type SkaterTrendsResponse = {
  seasonId: number;
  generatedAt: string;
  positionGroup: "forward" | "defense" | "all";
  limit: number;
  windowSize: number;
  categories: Record<string, unknown>;
  playerMetadata: Record<
    string,
    {
      id: number;
      fullName: string;
      position: string | null;
      teamAbbrev: string | null;
      imageUrl: string | null;
    }
  >;
};

export type GoalieTrendsResponse = {
  seasonId: number;
  generatedAt: string;
  requestedDate: string;
  dateUsed: string;
  fallbackApplied: boolean;
  serving: RequestedDateServingState;
  limit: number;
  windowSize: number;
  categories: Record<
    GoalieTrendCategoryId,
    {
      series: Record<string, Array<{ gp: number; percentile: number }>>;
      rankings: Array<{
        playerId: number;
        percentile: number;
        gp: number;
        rank: number;
        previousRank: number | null;
        delta: number;
        latestValue: number | null;
      }>;
    }
  >;
  playerMetadata: Record<
    string,
    {
      id: number;
      fullName: string;
      position: string | null;
      teamAbbrev: string | null;
      imageUrl: string | null;
    }
  >;
};

export type ForgePlayersResponse = {
  durationMs: string;
  runId: number;
  asOfDate: string;
  requestedDate: string;
  fallbackApplied: boolean;
  serving: RequestedDateServingState;
  data: Array<Record<string, unknown>>;
};

export type ForgeGoaliesResponse = {
  durationMs: string;
  runId: string;
  asOfDate: string;
  horizonGames: number;
  requestedDate: string;
  fallbackApplied: boolean;
  serving: RequestedDateServingState;
  data: Array<Record<string, unknown>>;
};

export type StartChartResponse = {
  dateUsed: string;
  requestedDate: string;
  fallbackApplied: boolean;
  serving: RequestedDateServingState;
  projections: number;
  players: Array<Record<string, unknown>>;
  ctpi: Array<Record<string, unknown>>;
  games: Array<Record<string, unknown>>;
};

export type SustainabilityDirection = "hot" | "cold";
export type SustainabilityPosition = "all" | "F" | "D";

export type SustainabilityTrendRow = {
  player_id: number;
  player_name: string | null;
  position_group: string;
  position_code: string | null;
  window_code: string;
  s_100: number;
  luck_pressure: number;
  z_shp?: number;
  z_oishp?: number;
  z_ipp?: number;
  z_ppshp?: number;
};

export type SustainabilityTrendsResponse = {
  success: boolean;
  snapshot_date: string;
  window_code: string;
  pos: SustainabilityPosition;
  direction: SustainabilityDirection;
  limit: number;
  rows: SustainabilityTrendRow[];
};

export type DashboardDataParams = {
  date: string;
  skaterPosition?: "forward" | "defense" | "all";
  skaterWindow?: 1 | 3 | 5 | 10 | 20;
  skaterLimit?: number;
  sustainabilityWindow?: "l3" | "l5" | "l10" | "l20";
  sustainabilityLimit?: number;
};

export type DashboardData = {
  date: string;
  teamRatings: TeamRating[];
  teamTrends: TeamTrendsResponse;
  teamCtpi: CtpiResponse;
  teamSos: SosResponse;
  skaterTrends: SkaterTrendsResponse;
  goalieTrends: GoalieTrendsResponse;
  forgePlayers: ForgePlayersResponse;
  forgeGoalies: ForgeGoaliesResponse;
  startChart: StartChartResponse;
  sustainability: {
    hot: SustainabilityTrendsResponse;
    cold: SustainabilityTrendsResponse;
  };
  teamMeta: Record<
    string,
    {
      id: number;
      abbr: string;
      name: string;
      shortName: string;
      colors: { primary: string; secondary: string; accent: string };
      logo: string;
    }
  >;
};

const buildQuery = (
  base: string,
  params: Record<string, string | number | boolean | undefined>
) => {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
    )
    .join("&");
  return query ? `${base}?${query}` : base;
};

const TREND_TTL_MS = 5 * 60_000;
const SNAPSHOT_TTL_MS = 60_000;

const buildTeamMetaIndex = (input: {
  teamRatings: TeamRating[];
  teamCtpi: CtpiResponse;
  teamSos: SosResponse;
  startChart: StartChartResponse;
}): DashboardData["teamMeta"] => {
  const metaIndex: DashboardData["teamMeta"] = {};
  const allAbbrs = new Set<string>();
  const allIds = new Set<number>();

  const addAbbr = (abbr: string | null | undefined) => {
    if (!abbr) return;
    allAbbrs.add(abbr.toUpperCase());
  };

  const addId = (teamId: number | null | undefined) => {
    if (typeof teamId !== "number" || Number.isNaN(teamId)) return;
    allIds.add(teamId);
  };

  input.teamRatings.forEach((row) => addAbbr(row.teamAbbr));
  input.teamCtpi?.teams?.forEach((row) => addAbbr(row.team));
  input.teamSos?.teams?.forEach((row) => {
    addAbbr(row.team);
    addId(row.teamId);
  });
  input.startChart?.games?.forEach((game) => {
    const g = game as { homeTeamId?: number; awayTeamId?: number };
    addId(g.homeTeamId ?? null);
    addId(g.awayTeamId ?? null);
  });

  allIds.forEach((teamId) => {
    const meta = getTeamMetaById(teamId);
    if (meta) metaIndex[meta.abbr] = meta;
  });

  allAbbrs.forEach((abbr) => {
    const meta = getTeamMetaByAbbr(abbr);
    if (meta) metaIndex[abbr] = meta;
  });

  return metaIndex;
};

export const fetchTeamTrends = (): Promise<TeamTrendsResponse> =>
  fetchCachedJson<TeamTrendsResponse>("/api/v1/trends/team-power", {
    ttlMs: TREND_TTL_MS
  });

export const fetchTeamCtpi = (): Promise<CtpiResponse> =>
  fetchCachedJson<CtpiResponse>("/api/v1/trends/team-ctpi", {
    ttlMs: TREND_TTL_MS
  });

export const fetchTeamSos = (): Promise<SosResponse> =>
  fetchCachedJson<SosResponse>("/api/v1/trends/team-sos", {
    ttlMs: TREND_TTL_MS
  });

export const fetchSkaterTrends = (params: {
  position?: "forward" | "defense" | "all";
  window?: 1 | 3 | 5 | 10 | 20;
  limit?: number;
}): Promise<SkaterTrendsResponse> =>
  fetchCachedJson<SkaterTrendsResponse>(
    buildQuery("/api/v1/trends/skater-power", {
      position: params.position,
      window: params.window,
      limit: params.limit
    }),
    { ttlMs: TREND_TTL_MS }
  );

export const fetchGoalieTrends = (params: {
  date: string;
  window?: 1 | 3 | 5 | 10;
  limit?: number;
}): Promise<GoalieTrendsResponse> =>
  fetchCachedJson<GoalieTrendsResponse>(
    buildQuery("/api/v1/trends/goalie-power", {
      date: params.date,
      window: params.window,
      limit: params.limit
    }),
    { ttlMs: TREND_TTL_MS }
  );

export const fetchForgePlayers = (date: string): Promise<ForgePlayersResponse> =>
  fetchCachedJson<ForgePlayersResponse>(
    buildQuery("/api/v1/forge/players", { date }),
    { ttlMs: SNAPSHOT_TTL_MS }
  );

export const fetchStartChart = (date: string): Promise<StartChartResponse> =>
  fetchCachedJson<StartChartResponse>(
    buildQuery("/api/v1/start-chart", { date }),
    { ttlMs: SNAPSHOT_TTL_MS }
  );

export const fetchForgeGoalies = (date: string): Promise<ForgeGoaliesResponse> =>
  fetchCachedJson<ForgeGoaliesResponse>(
    // Canonical dashboard goalie endpoint: includes fallback + diagnostics metadata.
    buildQuery("/api/v1/forge/goalies", {
      date,
      horizon: 1,
      fallbackToLatestWithData: true
    }),
    { ttlMs: SNAPSHOT_TTL_MS }
  );

export const fetchTeamRatings = (date: string): Promise<TeamRating[]> =>
  fetchCachedJson<TeamRating[]>(
    buildQuery("/api/team-ratings", { date }),
    { ttlMs: SNAPSHOT_TTL_MS }
  );

const toSustainabilityPosition = (
  skaterPosition: DashboardDataParams["skaterPosition"]
): SustainabilityPosition => {
  if (skaterPosition === "defense") return "D";
  if (skaterPosition === "forward") return "F";
  return "all";
};

export const fetchSustainabilityTrends = (params: {
  date: string;
  direction: SustainabilityDirection;
  pos: SustainabilityPosition;
  window?: "l3" | "l5" | "l10" | "l20";
  limit?: number;
}): Promise<SustainabilityTrendsResponse> =>
  fetchCachedJson<SustainabilityTrendsResponse>(
    buildQuery("/api/v1/sustainability/trends", {
      snapshot_date: params.date,
      direction: params.direction,
      pos: params.pos,
      window_code: params.window,
      limit: params.limit
    }),
    { ttlMs: TREND_TTL_MS }
  );

export const loadTrendsDashboardData = async (
  params: DashboardDataParams
): Promise<DashboardData> => {
  const skaterPosition = params.skaterPosition ?? "forward";
  const skaterWindow = params.skaterWindow ?? 1;
  const skaterLimit = params.skaterLimit ?? 25;
  const sustainabilityWindow = params.sustainabilityWindow ?? "l10";
  const sustainabilityLimit = params.sustainabilityLimit ?? 15;
  const sustainabilityPosition = toSustainabilityPosition(skaterPosition);

  const [
    teamRatings,
    teamTrends,
    teamCtpi,
    teamSos,
    skaterTrends,
    goalieTrends,
    forgePlayers,
    forgeGoalies,
    startChart,
    sustainabilityHot,
    sustainabilityCold
  ] = await Promise.all([
    fetchTeamRatings(params.date),
    fetchTeamTrends(),
    fetchTeamCtpi(),
    fetchTeamSos(),
    fetchSkaterTrends({
      position: skaterPosition,
      window: skaterWindow,
      limit: skaterLimit
    }),
    fetchGoalieTrends({
      date: params.date,
      window: skaterWindow > 10 ? 10 : skaterWindow,
      limit: skaterLimit
    }),
    fetchForgePlayers(params.date),
    fetchForgeGoalies(params.date),
    fetchStartChart(params.date),
    fetchSustainabilityTrends({
      date: params.date,
      direction: "hot",
      pos: sustainabilityPosition,
      window: sustainabilityWindow,
      limit: sustainabilityLimit
    }),
    fetchSustainabilityTrends({
      date: params.date,
      direction: "cold",
      pos: sustainabilityPosition,
      window: sustainabilityWindow,
      limit: sustainabilityLimit
    })
  ]);

  return {
    date: params.date,
    teamRatings,
    teamTrends,
    teamCtpi,
    teamSos,
    skaterTrends,
    goalieTrends,
    forgePlayers,
    forgeGoalies,
    startChart,
    sustainability: {
      hot: sustainabilityHot,
      cold: sustainabilityCold
    },
    teamMeta: buildTeamMetaIndex({
      teamRatings,
      teamCtpi,
      teamSos,
      startChart
    })
  };
};

// Deprecated compatibility export for older callers. Prefer loadTrendsDashboardData
// for new code so this file is not mistaken for the canonical FORGE dashboard loader.
export const loadDashboardData = loadTrendsDashboardData;
