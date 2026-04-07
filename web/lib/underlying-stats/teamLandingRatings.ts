import type { SupabaseClient } from "@supabase/supabase-js";
import supabaseServer from "../supabase/server";
import {
  deriveTrendOverridesForDate as deriveStoredTrendOverridesForDate,
  computeTrendOverridesFromHistory
} from "../teamRatingsTrend";
import {
  fetchTeamRatings,
  isValidIsoDate,
  type TeamRating
} from "../teamRatingsService";
import {
  fetchUnderlyingStatsTeamScheduleStrengthForRatings,
  type UnderlyingStatsTeamScheduleStrength
} from "./teamScheduleStrength";

type TrendCacheEntry = {
  expiresAt: number;
  payload: Map<string, number>;
};

export { computeTrendOverridesFromHistory };

export type UnderlyingStatsLandingRating = TeamRating & {
  sos: number | null;
};

type LandingRatingsFetcher = (date: string) => Promise<UnderlyingStatsLandingRating[]>;

export type UnderlyingStatsLandingSnapshot = {
  requestedDate: string | null;
  resolvedDate: string | null;
  ratings: UnderlyingStatsLandingRating[];
};

const TREND_CACHE_TTL_MS = Number(
  process.env.TEAM_RATINGS_CACHE_TTL_MS ?? 60_000
);
const trendCache = new Map<string, TrendCacheEntry>();

const buildTrendCacheKey = (date: string): string => date;

export const deriveTrendOverridesForDate = async (
  date: string,
  supabase: SupabaseClient = supabaseServer
): Promise<Map<string, number>> => {
  const cacheKey = buildTrendCacheKey(date);
  const cached = trendCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  const overrides = await deriveStoredTrendOverridesForDate(date, supabase);

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

  const [baseRatings, trendOverrides] = await Promise.all([
    fetchTeamRatings(date),
    deriveTrendOverridesForDate(date)
  ]);
  const scheduleStrengthByTeam =
    await fetchUnderlyingStatsTeamScheduleStrengthForRatings(date, baseRatings);

  return mergeUnderlyingStatsLandingRatings({
    baseRatings,
    trendOverrides,
    scheduleStrengthByTeam
  });
};

export const mergeUnderlyingStatsLandingRatings = ({
  baseRatings,
  trendOverrides,
  scheduleStrengthByTeam
}: {
  baseRatings: TeamRating[];
  trendOverrides: Map<string, number>;
  scheduleStrengthByTeam: Map<string, UnderlyingStatsTeamScheduleStrength>;
}): UnderlyingStatsLandingRating[] =>
  baseRatings.map((rating) => ({
    ...rating,
    trend10: trendOverrides.get(rating.teamAbbr) ?? rating.trend10,
    sos: scheduleStrengthByTeam.get(rating.teamAbbr)?.sos ?? null
  }));

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
        requestedDate: normalizedRequestedDate,
        resolvedDate: candidateDate,
        ratings
      };
    }
  }

  return {
    requestedDate: normalizedRequestedDate,
    resolvedDate: candidateDates[0] ?? null,
    ratings: []
  };
};

export const clearUnderlyingStatsLandingRatingsCache = (): void => {
  trendCache.clear();
};
