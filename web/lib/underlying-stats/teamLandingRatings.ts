import type { SupabaseClient } from "@supabase/supabase-js";
import supabaseServer from "../supabase/server";
import {
  calculateEwma,
  calculateFinalRating,
  calculateLeagueMetrics,
  calculateRawDistribution,
  calculateRawScores,
  calculateZScores,
  fetchGameLogs,
  type TeamGame
} from "../power-ratings";
import {
  fetchTeamRatings,
  isValidIsoDate,
  type TeamRating
} from "../teamRatingsService";

type TeamOffRatingSnapshot = {
  date: string;
  offRating: number;
  teamAbbr: string;
};

type TrendCacheEntry = {
  expiresAt: number;
  payload: Map<string, number>;
};

type LandingRatingsFetcher = (date: string) => Promise<TeamRating[]>;

export type UnderlyingStatsLandingSnapshot = {
  requestedDate: string | null;
  resolvedDate: string | null;
  ratings: TeamRating[];
};

const TREND_LOOKBACK_DAYS = 150;
const TREND_CACHE_TTL_MS = Number(
  process.env.TEAM_RATINGS_CACHE_TTL_MS ?? 60_000
);
const trendCache = new Map<string, TrendCacheEntry>();

const buildTrendCacheKey = (date: string): string => date;

const buildTeamGames = (
  logs: Awaited<ReturnType<typeof fetchGameLogs>>
): Map<string, TeamGame[]> => {
  const filtered = logs.filter((log) => log.data_mode === "all");
  const grouped = new Map<string, TeamGame[]>();

  filtered.forEach((log) => {
    const existing = grouped.get(log.team_abbreviation) ?? [];
    existing.push({
      ...log,
      rn_desc: 0,
      gp_to_date: 0
    });
    grouped.set(log.team_abbreviation, existing);
  });

  grouped.forEach((games, teamAbbr) => {
    const sorted = [...games].sort((a, b) => b.date.localeCompare(a.date));
    grouped.set(
      teamAbbr,
      sorted.map((game, index) => ({
        ...game,
        rn_desc: index,
        gp_to_date: sorted.length - index
      }))
    );
  });

  return grouped;
};

const buildSnapshotHistoryByTeam = (
  teamGames: Map<string, TeamGame[]>,
  targetDate: string
): Map<string, TeamOffRatingSnapshot[]> => {
  const allDates = Array.from(
    new Set(
      Array.from(teamGames.values()).flatMap((games) =>
        games
          .map((game) => game.date)
          .filter((date) => typeof date === "string" && date <= targetDate)
      )
    )
  ).sort((a, b) => a.localeCompare(b));

  const historyByTeam = new Map<string, TeamOffRatingSnapshot[]>();

  allDates.forEach((snapshotDate) => {
    const ewmaMetrics = Array.from(teamGames.values())
      .map((games) => calculateEwma(games, snapshotDate))
      .filter((metric): metric is NonNullable<typeof metric> => Boolean(metric));

    if (!ewmaMetrics.length) {
      return;
    }

    const leagueMetrics = calculateLeagueMetrics(ewmaMetrics);
    const rawScores = ewmaMetrics
      .map((metric) => calculateZScores(metric, leagueMetrics))
      .map((metric) => calculateRawScores(metric));
    const rawDistribution = calculateRawDistribution(rawScores);
    const finalRatings = rawScores.map((score) =>
      calculateFinalRating(score, rawDistribution)
    );

    finalRatings.forEach((rating) => {
      const existing = historyByTeam.get(rating.team_abbreviation) ?? [];
      existing.push({
        date: snapshotDate,
        offRating: rating.off_rating,
        teamAbbr: rating.team_abbreviation
      });
      historyByTeam.set(rating.team_abbreviation, existing);
    });
  });

  historyByTeam.forEach((snapshots, teamAbbr) => {
    historyByTeam.set(
      teamAbbr,
      [...snapshots].sort((a, b) => b.date.localeCompare(a.date))
    );
  });

  return historyByTeam;
};

export const computeTrendOverridesFromHistory = (
  historyByTeam: Map<string, TeamOffRatingSnapshot[]>
): Map<string, number> => {
  const overrides = new Map<string, number>();

  historyByTeam.forEach((snapshots, teamAbbr) => {
    if (!snapshots.length) {
      return;
    }

    const current = snapshots[0];
    const baselineWindow = snapshots.slice(1, 11);

    if (!baselineWindow.length) {
      overrides.set(teamAbbr, 0);
      return;
    }

    const baselineAverage =
      baselineWindow.reduce((sum, snapshot) => sum + snapshot.offRating, 0) /
      baselineWindow.length;

    overrides.set(
      teamAbbr,
      Number((current.offRating - baselineAverage).toFixed(2))
    );
  });

  return overrides;
};

export const deriveTrendOverridesForDate = async (
  date: string,
  supabase: SupabaseClient = supabaseServer
): Promise<Map<string, number>> => {
  const cacheKey = buildTrendCacheKey(date);
  const cached = trendCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  const startDate = new Date(`${date}T00:00:00.000Z`);
  startDate.setUTCDate(startDate.getUTCDate() - TREND_LOOKBACK_DAYS);

  const logs = await fetchGameLogs(
    supabase,
    startDate.toISOString().slice(0, 10),
    date
  );
  const teamGames = buildTeamGames(logs);
  const historyByTeam = buildSnapshotHistoryByTeam(teamGames, date);
  const overrides = computeTrendOverridesFromHistory(historyByTeam);

  trendCache.set(cacheKey, {
    payload: overrides,
    expiresAt: Date.now() + TREND_CACHE_TTL_MS
  });

  return overrides;
};

export const fetchUnderlyingStatsLandingRatings = async (
  date: string
): Promise<TeamRating[]> => {
  if (!isValidIsoDate(date)) {
    return [];
  }

  const [baseRatings, trendOverrides] = await Promise.all([
    fetchTeamRatings(date),
    deriveTrendOverridesForDate(date)
  ]);

  return baseRatings.map((rating) => ({
    ...rating,
    trend10: trendOverrides.get(rating.teamAbbr) ?? rating.trend10
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
