import type { SupabaseClient } from "@supabase/supabase-js";
import supabaseServer from "../supabase/server";
import {
  deriveTeamFormContextForDate as deriveStoredTeamFormContextForDate,
  computeTrendOverridesFromHistory,
  type TeamFormContext,
  type TeamLandingSparkPoint
} from "../teamRatingsTrend";
import {
  fetchTeamRatings,
  isValidIsoDate,
  type TeamRating
} from "../teamRatingsService";
import {
  fetchUnderlyingStatsTeamScheduleStrengthForRatings,
  type UnderlyingStatsScheduleTexture,
  type UnderlyingStatsTeamScheduleStrength
} from "./teamScheduleStrength";
import {
  fetchUnderlyingStatsTeamSpecialTeamsContext,
  type UnderlyingStatsTeamSpecialTeamsContext
} from "./teamSpecialTeamsContext";
import {
  buildTeamRatingNarratives,
  type TeamRatingNarrativeSnapshot
} from "./teamRatingNarrative";
import {
  buildUnderlyingStatsLandingDashboard,
  type UnderlyingStatsLandingDashboard
} from "./teamLandingDashboard";

type TrendCacheEntry = {
  expiresAt: number;
  payload: Map<string, TeamFormContext>;
};

export { computeTrendOverridesFromHistory };

export type UnderlyingStatsLandingRating = TeamRating & {
  sos: number | null;
  luckPdo: number | null;
  luckPdoZ: number | null;
  luckSeries: TeamLandingSparkPoint[];
  luckStatus: "cold" | "hot" | "normal";
  narrative: string[];
  pkPct: number | null;
  pkRank: number | null;
  ppPct: number | null;
  ppRank: number | null;
  scheduleTexture: UnderlyingStatsScheduleTexture | null;
  sosFuture: number | null;
  sosFutureRank: number | null;
  sosPast: number | null;
  sosPastRank: number | null;
  trendSeries: TeamLandingSparkPoint[];
};

type LandingRatingsFetcher = (date: string) => Promise<UnderlyingStatsLandingRating[]>;

export type UnderlyingStatsLandingSnapshot = {
  dashboard: UnderlyingStatsLandingDashboard;
  requestedDate: string | null;
  resolvedDate: string | null;
  ratings: UnderlyingStatsLandingRating[];
};

const TREND_CACHE_TTL_MS = Number(
  process.env.TEAM_RATINGS_CACHE_TTL_MS ?? 60_000
);
const trendCache = new Map<string, TrendCacheEntry>();

const buildTrendCacheKey = (date: string): string => date;
const NARRATIVE_LOOKBACK_DAYS = 120;

type TeamRatingHistoryRow = {
  date: string;
  def_rating: number | null;
  ga60: number | null;
  gf60: number | null;
  off_rating: number | null;
  pace60: number | null;
  pace_rating: number | null;
  pk_tier: number | null;
  pp_tier: number | null;
  sa60: number | null;
  sf60: number | null;
  team_abbreviation: string | null;
  xga60: number | null;
  xgf60: number | null;
};

const toFiniteNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const addDays = (isoDate: string, days: number): string => {
  const nextDate = new Date(`${isoDate}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate.toISOString().slice(0, 10);
};

const fetchTeamRatingHistoryForNarratives = async (
  date: string,
  teamAbbrs: string[],
  supabase: SupabaseClient = supabaseServer
): Promise<Map<string, TeamRatingNarrativeSnapshot[]>> => {
  if (!teamAbbrs.length) {
    return new Map();
  }

  const normalizedTeamAbbrs = Array.from(
    new Set(teamAbbrs.map((teamAbbr) => teamAbbr.trim().toUpperCase()))
  );
  const { data, error } = await supabase
    .from("team_power_ratings_daily")
    .select(
      [
        "team_abbreviation",
        "date",
        "off_rating",
        "def_rating",
        "pace_rating",
        "pp_tier",
        "pk_tier",
        "xgf60",
        "gf60",
        "sf60",
        "xga60",
        "ga60",
        "sa60",
        "pace60"
      ].join(",")
    )
    .in("team_abbreviation", normalizedTeamAbbrs)
    .gte("date", addDays(date, -NARRATIVE_LOOKBACK_DAYS))
    .lte("date", date)
    .order("date", { ascending: false });

  if (error) {
    throw error;
  }

  const payload = new Map<string, TeamRatingNarrativeSnapshot[]>();

  ((data as unknown as TeamRatingHistoryRow[] | null) ?? []).forEach((row) => {
    const teamAbbr = row.team_abbreviation?.trim().toUpperCase();
    if (!teamAbbr) {
      return;
    }

    const existing = payload.get(teamAbbr) ?? [];
    if (existing.length >= 11) {
      return;
    }

    existing.push({
      components: {
        ga60: toFiniteNumber(row.ga60),
        gf60: toFiniteNumber(row.gf60),
        pace60: toFiniteNumber(row.pace60),
        sa60: toFiniteNumber(row.sa60),
        sf60: toFiniteNumber(row.sf60),
        xga60: toFiniteNumber(row.xga60),
        xgf60: toFiniteNumber(row.xgf60)
      },
      date: row.date,
      defRating: toFiniteNumber(row.def_rating),
      offRating: toFiniteNumber(row.off_rating),
      paceRating: toFiniteNumber(row.pace_rating),
      pkTier: row.pk_tier,
      ppTier: row.pp_tier
    });
    payload.set(teamAbbr, existing);
  });

  return payload;
};

export const deriveTrendOverridesForDate = async (
  date: string,
  supabase: SupabaseClient = supabaseServer
): Promise<Map<string, number>> => {
  const formContext = await deriveTeamFormContextForDate(date, supabase);
  return new Map(
    Array.from(formContext.entries()).map(([teamAbbr, context]) => [
      teamAbbr,
      context.trendDelta
    ])
  );
};

export const deriveTeamFormContextForDate = async (
  date: string,
  supabase: SupabaseClient = supabaseServer
): Promise<Map<string, TeamFormContext>> => {
  const cacheKey = buildTrendCacheKey(date);
  const cached = trendCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  const overrides = await deriveStoredTeamFormContextForDate(date, supabase);

  trendCache.set(cacheKey, {
    payload: overrides,
    expiresAt: Date.now() + TREND_CACHE_TTL_MS
  });

  return overrides;
};

export const fetchUnderlyingStatsLandingRatings = async (
  date: string
): Promise<UnderlyingStatsLandingRating[]> => {
  if (!isValidIsoDate(date)) {
    return [];
  }

  const [baseRatings, formContextByTeam, specialTeamsByTeam] =
    await Promise.all([
      fetchTeamRatings(date),
      deriveTeamFormContextForDate(date),
      fetchUnderlyingStatsTeamSpecialTeamsContext(date)
    ]);
  const ratingHistoryByTeam = await fetchTeamRatingHistoryForNarratives(
    date,
    baseRatings.map((rating) => rating.teamAbbr)
  );
  const scheduleStrengthByTeam =
    await fetchUnderlyingStatsTeamScheduleStrengthForRatings(date, baseRatings);

  const trendOverrides = new Map(
    Array.from(formContextByTeam.entries()).map(([teamAbbr, context]) => [
      teamAbbr,
      context.trendDelta
    ])
  );

  return mergeUnderlyingStatsLandingRatings({
    baseRatings,
    formContextByTeam,
    ratingHistoryByTeam,
    specialTeamsByTeam,
    trendOverrides,
    scheduleStrengthByTeam
  });
};

export const mergeUnderlyingStatsLandingRatings = ({
  baseRatings,
  formContextByTeam,
  ratingHistoryByTeam,
  specialTeamsByTeam,
  trendOverrides,
  scheduleStrengthByTeam
}: {
  baseRatings: TeamRating[];
  formContextByTeam?: Map<string, TeamFormContext>;
  ratingHistoryByTeam?: Map<string, TeamRatingNarrativeSnapshot[]>;
  specialTeamsByTeam?: Map<string, UnderlyingStatsTeamSpecialTeamsContext>;
  trendOverrides: Map<string, number>;
  scheduleStrengthByTeam: Map<string, UnderlyingStatsTeamScheduleStrength>;
}): UnderlyingStatsLandingRating[] => {
  const mergedRatings = baseRatings.map((rating) => {
    const scheduleStrength = scheduleStrengthByTeam.get(rating.teamAbbr);
    const formContext = formContextByTeam?.get(rating.teamAbbr);
    const specialTeams = specialTeamsByTeam?.get(rating.teamAbbr);
    const currentPdoZ = formContext?.currentPdoZ ?? null;
    const luckStatus: UnderlyingStatsLandingRating["luckStatus"] =
      typeof currentPdoZ === "number" && currentPdoZ >= 1
        ? "hot"
        : typeof currentPdoZ === "number" && currentPdoZ <= -1
          ? "cold"
          : "normal";

    return {
      ...rating,
      luckPdo: formContext?.currentPdo ?? null,
      luckPdoZ: currentPdoZ,
      luckSeries: formContext?.varianceSeries ?? [],
      luckStatus,
      narrative: [],
      pkPct: specialTeams?.pkPct ?? null,
      pkRank: specialTeams?.pkRank ?? null,
      ppPct: specialTeams?.ppPct ?? null,
      ppRank: specialTeams?.ppRank ?? null,
      scheduleTexture: scheduleStrength?.texture ?? null,
      sos: scheduleStrength?.sos ?? null,
      sosFuture: scheduleStrength?.future?.sos ?? null,
      sosFutureRank: scheduleStrength?.future?.rank ?? null,
      sosPast: scheduleStrength?.past?.sos ?? null,
      sosPastRank: scheduleStrength?.past?.rank ?? null,
      trend10: trendOverrides.get(rating.teamAbbr) ?? rating.trend10,
      trendSeries: formContext?.trendSeries ?? [],
      varianceFlag: formContext?.varianceFlag ?? rating.varianceFlag
    };
  });
  const narrativesByTeam = buildTeamRatingNarratives({
    historiesByTeam: ratingHistoryByTeam ?? new Map(),
    rows: mergedRatings
  });

  return mergedRatings.map((rating) => ({
    ...rating,
    narrative: narrativesByTeam.get(rating.teamAbbr)?.bullets ?? []
  }));
};
export const resolveUnderlyingStatsLandingSnapshot = async ({
  requestedDate,
  availableDates,
  fetchRatings = fetchUnderlyingStatsLandingRatings
}: {
  requestedDate?: string | null;
  availableDates: string[];
  fetchRatings?: LandingRatingsFetcher;
}): Promise<UnderlyingStatsLandingSnapshot> => {
  const normalizedRequestedDate =
    typeof requestedDate === "string" && requestedDate.length > 0
      ? requestedDate
      : null;

  const candidateDates: string[] = [];

  if (
    normalizedRequestedDate &&
    isValidIsoDate(normalizedRequestedDate) &&
    !candidateDates.includes(normalizedRequestedDate)
  ) {
    candidateDates.push(normalizedRequestedDate);
  }

  availableDates.forEach((date) => {
    if (!isValidIsoDate(date) || candidateDates.includes(date)) {
      return;
    }
    candidateDates.push(date);
  });

  for (const candidateDate of candidateDates) {
    const ratings = await fetchRatings(candidateDate);
    if (ratings.length > 0) {
      return {
        dashboard: buildUnderlyingStatsLandingDashboard(ratings),
        requestedDate: normalizedRequestedDate,
        resolvedDate: candidateDate,
        ratings
      };
    }
  }

  return {
    dashboard: buildUnderlyingStatsLandingDashboard([]),
    requestedDate: normalizedRequestedDate,
    resolvedDate: candidateDates[0] ?? null,
    ratings: []
  };
};

export const clearUnderlyingStatsLandingRatingsCache = (): void => {
  trendCache.clear();
};
