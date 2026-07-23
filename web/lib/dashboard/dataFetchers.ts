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
  seriesGames: number;
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
  guardrail_state?: string;
  guardrail_warnings?: string[];
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

export const DASHBOARD_SECTIONS = [
  "team",
  "skater",
  "goalie",
  "projection",
  "schedule"
] as const;

export type DashboardSection = (typeof DASHBOARD_SECTIONS)[number];

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
  sectionErrors: Partial<Record<DashboardSection, string>>;
  sectionUpdatedAt: Partial<Record<DashboardSection, string>>;
  sectionResolvedFor: Partial<Record<DashboardSection, string>>;
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
  seriesGames?: number;
}): Promise<SkaterTrendsResponse> =>
  fetchCachedJson<SkaterTrendsResponse>(
    buildQuery("/api/v1/trends/skater-power", {
      position: params.position,
      window: params.window,
      limit: params.limit,
      seriesGames: params.seriesGames
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
  params: DashboardDataParams,
  options: {
    sections?: DashboardSection[];
    base?: DashboardData | null;
  } = {}
): Promise<DashboardData> => {
  const skaterPosition = params.skaterPosition ?? "forward";
  const skaterWindow = params.skaterWindow ?? 1;
  const skaterLimit = params.skaterLimit ?? 25;
  const sustainabilityWindow = params.sustainabilityWindow ?? "l10";
  const sustainabilityLimit = params.sustainabilityLimit ?? 15;
  const sustainabilityPosition = toSustainabilityPosition(skaterPosition);

  const emptyServing = {} as RequestedDateServingState;
  const base: DashboardData = options.base ?? {
    date: params.date,
    teamRatings: [],
    teamTrends: {
      seasonId: 0,
      generatedAt: "",
      categories: {} as TeamTrendsResponse["categories"]
    },
    teamCtpi: { seasonId: 0, generatedAt: "", teams: [] },
    teamSos: { seasonId: 0, generatedAt: "", teams: [] },
    skaterTrends: {
      seasonId: 0,
      generatedAt: "",
      positionGroup: skaterPosition,
      limit: skaterLimit,
      seriesGames: 40,
      windowSize: skaterWindow,
      categories: {},
      playerMetadata: {}
    },
    goalieTrends: {
      seasonId: 0,
      generatedAt: "",
      requestedDate: params.date,
      dateUsed: "",
      fallbackApplied: false,
      serving: emptyServing,
      limit: skaterLimit,
      windowSize: skaterWindow === 20 ? 10 : skaterWindow,
      categories: {} as GoalieTrendsResponse["categories"],
      playerMetadata: {}
    },
    forgePlayers: {
      durationMs: "",
      runId: 0,
      asOfDate: "",
      requestedDate: params.date,
      fallbackApplied: false,
      serving: emptyServing,
      data: []
    },
    forgeGoalies: {
      durationMs: "",
      runId: "",
      asOfDate: "",
      horizonGames: 1,
      requestedDate: params.date,
      fallbackApplied: false,
      serving: emptyServing,
      data: []
    },
    startChart: {
      dateUsed: "",
      requestedDate: params.date,
      fallbackApplied: false,
      serving: emptyServing,
      projections: 0,
      players: [],
      ctpi: [],
      games: []
    },
    sustainability: {
      hot: {
        success: false,
        snapshot_date: params.date,
        window_code: sustainabilityWindow,
        pos: sustainabilityPosition,
        direction: "hot",
        limit: sustainabilityLimit,
        rows: []
      },
      cold: {
        success: false,
        snapshot_date: params.date,
        window_code: sustainabilityWindow,
        pos: sustainabilityPosition,
        direction: "cold",
        limit: sustainabilityLimit,
        rows: []
      }
    },
    sectionErrors: {},
    sectionUpdatedAt: {},
    sectionResolvedFor: {},
    teamMeta: {}
  };
  const next: DashboardData = {
    ...base,
    date: params.date,
    sustainability: { ...base.sustainability },
    sectionErrors: { ...base.sectionErrors },
    sectionUpdatedAt: { ...base.sectionUpdatedAt },
    sectionResolvedFor: { ...base.sectionResolvedFor }
  };
  const sections = new Set(options.sections ?? DASHBOARD_SECTIONS);

  const applySection = async <T extends readonly unknown[]>(
    section: DashboardSection,
    getRequests: () => { [K in keyof T]: Promise<T[K]> },
    apply: (values: { [K in keyof T]: T[K] | undefined }) => void
  ) => {
    if (!sections.has(section)) return;
    const settled = await Promise.allSettled(getRequests());
    const values = settled.map((result) =>
      result.status === "fulfilled" ? result.value : undefined
    ) as unknown as { [K in keyof T]: T[K] | undefined };
    apply(values);
    if (settled.some((result) => result.status === "rejected")) {
      next.sectionErrors[section] = `${section} sources are temporarily unavailable`;
      return;
    }
    delete next.sectionErrors[section];
    next.sectionUpdatedAt[section] = new Date().toISOString();
    next.sectionResolvedFor[section] =
      section === "skater"
        ? `${params.date}; ${skaterPosition}; ${skaterWindow} GP`
        : section === "goalie"
          ? `${params.date}; ${skaterWindow === 20 ? 10 : skaterWindow} GP`
          : params.date;
  };

  await Promise.all([
    applySection(
      "team",
      () => [
        fetchTeamRatings(params.date),
        fetchTeamTrends(),
        fetchTeamCtpi(),
        fetchTeamSos()
      ] as const,
      ([teamRatings, teamTrends, teamCtpi, teamSos]) => {
        if (teamRatings) next.teamRatings = teamRatings;
        if (teamTrends) next.teamTrends = teamTrends;
        if (teamCtpi) next.teamCtpi = teamCtpi;
        if (teamSos) next.teamSos = teamSos;
      }
    ),
    applySection(
      "skater",
      () => [
        fetchSkaterTrends({
          position: skaterPosition,
          window: skaterWindow,
          limit: skaterLimit,
          seriesGames: 40
        }),
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
      ] as const,
      ([skaterTrends, sustainabilityHot, sustainabilityCold]) => {
        if (skaterTrends) next.skaterTrends = skaterTrends;
        if (sustainabilityHot) next.sustainability.hot = sustainabilityHot;
        if (sustainabilityCold) next.sustainability.cold = sustainabilityCold;
      }
    ),
    applySection(
      "goalie",
      () => [
        fetchGoalieTrends({
          date: params.date,
          window: skaterWindow === 20 ? 10 : skaterWindow,
          limit: skaterLimit
        })
      ] as const,
      ([goalieTrends]) => {
        if (goalieTrends) next.goalieTrends = goalieTrends;
      }
    ),
    applySection(
      "projection",
      () => [fetchForgePlayers(params.date)] as const,
      ([forgePlayers]) => {
        if (forgePlayers) next.forgePlayers = forgePlayers;
      }
    ),
    applySection(
      "schedule",
      () =>
        [fetchForgeGoalies(params.date), fetchStartChart(params.date)] as const,
      ([forgeGoalies, startChart]) => {
        if (forgeGoalies) next.forgeGoalies = forgeGoalies;
        if (startChart) next.startChart = startChart;
      }
    )
  ]);

  next.teamMeta = buildTeamMetaIndex(next);
  return next;
};

export const mergeDashboardSections = (
  current: DashboardData | null,
  response: DashboardData,
  sections: DashboardSection[]
): DashboardData => {
  if (!current) return response;
  const merged: DashboardData = {
    ...current,
    date: response.date,
    sustainability: { ...current.sustainability },
    sectionErrors: { ...current.sectionErrors },
    sectionUpdatedAt: { ...current.sectionUpdatedAt },
    sectionResolvedFor: { ...current.sectionResolvedFor }
  };

  sections.forEach((section) => {
    if (section === "team") {
      merged.teamRatings = response.teamRatings;
      merged.teamTrends = response.teamTrends;
      merged.teamCtpi = response.teamCtpi;
      merged.teamSos = response.teamSos;
    } else if (section === "skater") {
      merged.skaterTrends = response.skaterTrends;
      merged.sustainability = response.sustainability;
    } else if (section === "goalie") {
      merged.goalieTrends = response.goalieTrends;
    } else if (section === "projection") {
      merged.forgePlayers = response.forgePlayers;
    } else {
      merged.forgeGoalies = response.forgeGoalies;
      merged.startChart = response.startChart;
    }

    if (response.sectionErrors[section]) {
      merged.sectionErrors[section] = response.sectionErrors[section];
    } else {
      delete merged.sectionErrors[section];
    }
    if (response.sectionUpdatedAt[section]) {
      merged.sectionUpdatedAt[section] = response.sectionUpdatedAt[section];
    }
    if (response.sectionResolvedFor[section]) {
      merged.sectionResolvedFor[section] = response.sectionResolvedFor[section];
    }
  });

  merged.teamMeta = buildTeamMetaIndex(merged);
  return merged;
};

// Deprecated compatibility export for older callers. Prefer loadTrendsDashboardData
// for new code so this file is not mistaken for the canonical FORGE dashboard loader.
export const loadDashboardData = loadTrendsDashboardData;
