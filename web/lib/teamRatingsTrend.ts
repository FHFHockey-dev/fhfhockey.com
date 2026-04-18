import type { SupabaseClient } from "@supabase/supabase-js";

import {
  calculateEwma,
  calculateFinalRating,
  calculateLeagueMetrics,
  calculateRawDistribution,
  calculateRawScores,
  calculateZScores,
  fetchGameLogs,
  type TeamGame
} from "./power-ratings";
import supabaseServer from "./supabase/server";

export type TeamOffRatingSnapshot = {
  date: string;
  offRating: number;
  teamAbbr: string;
};

export type TeamLandingSparkPoint = {
  date: string;
  value: number;
};

export type TeamFormSnapshot = {
  date: string;
  offRating: number;
  defRating: number;
  paceRating: number;
  powerScore: number;
  pdo: number | null;
  pdoZ: number;
  teamAbbr: string;
};

export type TeamFormContext = {
  currentPdo: number | null;
  currentPdoZ: number | null;
  trendDelta: number;
  trendSeries: TeamLandingSparkPoint[];
  varianceFlag: number;
  varianceSeries: TeamLandingSparkPoint[];
};

export const TEAM_RATINGS_TREND_LOOKBACK_DAYS = 150;

const computeBasePowerScore = ({
  defRating,
  offRating,
  paceRating
}: Pick<TeamFormSnapshot, "defRating" | "offRating" | "paceRating">): number =>
  Number((((offRating + defRating + paceRating) / 3)).toFixed(2));

export const buildTeamGamesFromLogs = (
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

export const buildSnapshotHistoryByTeam = (
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

export const buildFormHistoryByTeam = (
  teamGames: Map<string, TeamGame[]>,
  targetDate: string
): Map<string, TeamFormSnapshot[]> => {
  const allDates = Array.from(
    new Set(
      Array.from(teamGames.values()).flatMap((games) =>
        games
          .map((game) => game.date)
          .filter((date) => typeof date === "string" && date <= targetDate)
      )
    )
  ).sort((a, b) => a.localeCompare(b));

  const historyByTeam = new Map<string, TeamFormSnapshot[]>();

  allDates.forEach((snapshotDate) => {
    const ewmaMetrics = Array.from(teamGames.values())
      .map((games) => calculateEwma(games, snapshotDate))
      .filter((metric): metric is NonNullable<typeof metric> => Boolean(metric));

    if (!ewmaMetrics.length) {
      return;
    }

    const leagueMetrics = calculateLeagueMetrics(ewmaMetrics);
    const zScores = ewmaMetrics.map((metric) => ({
      metric,
      z: calculateZScores(metric, leagueMetrics)
    }));
    const rawScores = zScores.map(({ z }) => calculateRawScores(z));
    const rawDistribution = calculateRawDistribution(rawScores);
    const finalRatings = rawScores.map((score) =>
      calculateFinalRating(score, rawDistribution)
    );
    const zScoreByTeam = new Map(
      zScores.map(({ metric, z }) => [
        metric.team_abbreviation,
        {
          pdo: metric.pdo_ewma,
          pdoZ: z.pdo_z
        }
      ])
    );

    finalRatings.forEach((rating) => {
      const zScore = zScoreByTeam.get(rating.team_abbreviation);
      const existing = historyByTeam.get(rating.team_abbreviation) ?? [];

      existing.push({
        date: snapshotDate,
        offRating: rating.off_rating,
        defRating: rating.def_rating,
        paceRating: rating.pace_rating,
        powerScore: computeBasePowerScore({
          offRating: rating.off_rating,
          defRating: rating.def_rating,
          paceRating: rating.pace_rating
        }),
        pdo: zScore?.pdo ?? null,
        pdoZ: zScore?.pdoZ ?? 0,
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

export const deriveTrendOverridesFromLogs = (
  logs: Awaited<ReturnType<typeof fetchGameLogs>>,
  targetDate: string
): Map<string, number> => {
  const teamGames = buildTeamGamesFromLogs(logs);
  const historyByTeam = buildSnapshotHistoryByTeam(teamGames, targetDate);
  return computeTrendOverridesFromHistory(historyByTeam);
};

export const computeTeamFormContextFromHistory = (
  historyByTeam: Map<string, TeamFormSnapshot[]>
): Map<string, TeamFormContext> => {
  const payload = new Map<string, TeamFormContext>();

  historyByTeam.forEach((snapshots, teamAbbr) => {
    if (!snapshots.length) {
      return;
    }

    const current = snapshots[0];
    const baselineWindow = snapshots.slice(1, 11);
    const trendDelta =
      baselineWindow.length > 0
        ? Number(
            (
              current.powerScore -
              baselineWindow.reduce((sum, snapshot) => sum + snapshot.powerScore, 0) /
                baselineWindow.length
            ).toFixed(2)
          )
        : 0;
    const trendSeries = snapshots
      .slice(0, 10)
      .reverse()
      .map((snapshot) => ({
        date: snapshot.date,
        value: snapshot.powerScore
      }));
    const varianceSeries = snapshots
      .slice(0, 10)
      .reverse()
      .map((snapshot) => ({
        date: snapshot.date,
        value: snapshot.pdo ?? 100
      }));

    payload.set(teamAbbr, {
      currentPdo: current.pdo,
      currentPdoZ: current.pdoZ,
      trendDelta,
      trendSeries,
      varianceFlag: Math.abs(current.pdoZ) >= 1 ? 1 : 0,
      varianceSeries
    });
  });

  return payload;
};

export const deriveTeamFormContextFromLogs = (
  logs: Awaited<ReturnType<typeof fetchGameLogs>>,
  targetDate: string
): Map<string, TeamFormContext> => {
  const teamGames = buildTeamGamesFromLogs(logs);
  const historyByTeam = buildFormHistoryByTeam(teamGames, targetDate);
  return computeTeamFormContextFromHistory(historyByTeam);
};

export const deriveTeamFormContextForDate = async (
  date: string,
  supabase: SupabaseClient = supabaseServer
): Promise<Map<string, TeamFormContext>> => {
  const startDate = new Date(`${date}T00:00:00.000Z`);
  startDate.setUTCDate(startDate.getUTCDate() - TEAM_RATINGS_TREND_LOOKBACK_DAYS);

  const logs = await fetchGameLogs(
    supabase,
    startDate.toISOString().slice(0, 10),
    date
  );

  return deriveTeamFormContextFromLogs(logs, date);
};

export const deriveTrendOverridesForDate = async (
  date: string,
  supabase: SupabaseClient = supabaseServer
): Promise<Map<string, number>> => {
  const startDate = new Date(`${date}T00:00:00.000Z`);
  startDate.setUTCDate(startDate.getUTCDate() - TEAM_RATINGS_TREND_LOOKBACK_DAYS);

  const logs = await fetchGameLogs(
    supabase,
    startDate.toISOString().slice(0, 10),
    date
  );

  return deriveTrendOverridesFromLogs(logs, date);
};
