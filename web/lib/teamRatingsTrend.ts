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

export const TEAM_RATINGS_TREND_LOOKBACK_DAYS = 150;

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
