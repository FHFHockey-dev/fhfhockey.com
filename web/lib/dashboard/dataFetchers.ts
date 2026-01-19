import type { TeamRating } from "../teamRatingsService";
import type { CategoryComputationResult } from "../trends/teamPercentiles";
import type { TrendCategoryId } from "../trends/teamMetricConfig";
import { getTeamMetaByAbbr, getTeamMetaById } from "./teamMetadata";

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

export type ForgePlayersResponse = {
  durationMs: string;
  runId: number;
  asOfDate: string;
  data: Array<Record<string, unknown>>;
};

export type ForgeGoaliesResponse = {
  durationMs: string;
  runId: string;
  asOfDate: string;
  horizonGames: number;
  data: Array<Record<string, unknown>>;
};

export type StartChartResponse = {
  dateUsed: string;
  projections: number;
  players: Array<Record<string, unknown>>;
  ctpi: Array<Record<string, unknown>>;
  games: Array<Record<string, unknown>>;
};

export type DashboardDataParams = {
  date: string;
  skaterPosition?: "forward" | "defense" | "all";
  skaterWindow?: 1 | 3 | 5 | 10;
  skaterLimit?: number;
};

export type DashboardData = {
  date: string;
  teamRatings: TeamRating[];
  teamTrends: TeamTrendsResponse;
  teamCtpi: CtpiResponse;
  teamSos: SosResponse;
  skaterTrends: SkaterTrendsResponse;
  forgePlayers: ForgePlayersResponse;
  forgeGoalies: ForgeGoaliesResponse;
  startChart: StartChartResponse;
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

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return (await response.json()) as T;
};

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

const cachedFetchJson = async <T>(
  url: string,
  ttlMs: number,
  init?: RequestInit
): Promise<T> => {
  const now = Date.now();
  const cached = cache.get(url) as CacheEntry<T> | undefined;
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const pending = inFlight.get(url) as Promise<T> | undefined;
  if (pending) {
    return pending;
  }

  const request = fetchJson<T>(url, init)
    .then((value) => {
      cache.set(url, { value, expiresAt: now + ttlMs });
      return value;
    })
    .finally(() => {
      inFlight.delete(url);
    });

  inFlight.set(url, request);
  return request;
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
  cachedFetchJson<TeamTrendsResponse>(
    "/api/v1/trends/team-power",
    TREND_TTL_MS
  );

export const fetchTeamCtpi = (): Promise<CtpiResponse> =>
  cachedFetchJson<CtpiResponse>("/api/v1/trends/team-ctpi", TREND_TTL_MS);

export const fetchTeamSos = (): Promise<SosResponse> =>
  cachedFetchJson<SosResponse>("/api/v1/trends/team-sos", TREND_TTL_MS);

export const fetchSkaterTrends = (params: {
  position?: "forward" | "defense" | "all";
  window?: 1 | 3 | 5 | 10;
  limit?: number;
}): Promise<SkaterTrendsResponse> =>
  cachedFetchJson<SkaterTrendsResponse>(
    buildQuery("/api/v1/trends/skater-power", {
      position: params.position,
      window: params.window,
      limit: params.limit
    }),
    TREND_TTL_MS
  );

export const fetchForgePlayers = (date: string): Promise<ForgePlayersResponse> =>
  cachedFetchJson<ForgePlayersResponse>(
    buildQuery("/api/v1/forge/players", { date }),
    SNAPSHOT_TTL_MS
  );

export const fetchStartChart = (date: string): Promise<StartChartResponse> =>
  cachedFetchJson<StartChartResponse>(
    buildQuery("/api/v1/start-chart", { date }),
    SNAPSHOT_TTL_MS
  );

export const fetchForgeGoalies = (date: string): Promise<ForgeGoaliesResponse> =>
  cachedFetchJson<ForgeGoaliesResponse>(
    buildQuery("/api/v1/projections/goalies", { date, horizon: 1 }),
    SNAPSHOT_TTL_MS
  );

export const fetchTeamRatings = (date: string): Promise<TeamRating[]> =>
  cachedFetchJson<TeamRating[]>(
    buildQuery("/api/team-ratings", { date }),
    SNAPSHOT_TTL_MS
  );

export const loadDashboardData = async (
  params: DashboardDataParams
): Promise<DashboardData> => {
  const skaterPosition = params.skaterPosition ?? "forward";
  const skaterWindow = params.skaterWindow ?? 1;
  const skaterLimit = params.skaterLimit ?? 25;

  const [
    teamRatings,
    teamTrends,
    teamCtpi,
    teamSos,
    skaterTrends,
    forgePlayers,
    forgeGoalies,
    startChart
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
    fetchForgePlayers(params.date),
    fetchForgeGoalies(params.date),
    fetchStartChart(params.date)
  ]);

  return {
    date: params.date,
    teamRatings,
    teamTrends,
    teamCtpi,
    teamSos,
    skaterTrends,
    forgePlayers,
    forgeGoalies,
    startChart,
    teamMeta: buildTeamMetaIndex({
      teamRatings,
      teamCtpi,
      teamSos,
      startChart
    })
  };
};
