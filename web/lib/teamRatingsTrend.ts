import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildGenuineTeamGames,
  calculateEwma,
  calculateLeagueMetrics,
  calculateZScores,
  computeDailyPowerRatings,
  fetchGameLogs,
  type TeamGame
} from "./power-ratings";
import { computeTeamPowerScore } from "./dashboard/teamContext";
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

/** Genuine all-situation games, one row per team and date (shared with the writer). */
export const buildTeamGamesFromLogs = (
  logs: Awaited<ReturnType<typeof fetchGameLogs>>
): Map<string, TeamGame[]> => buildGenuineTeamGames(logs);

/**
 * Ratings on each date a team played, standardised against that day's
 * all-team baseline (every team as of its latest game, W1 P0 #12), never
 * against only the teams on that night's slate.
 */
const forEachPlayedSnapshot = (
  teamGames: Map<string, TeamGame[]>,
  targetDate: string,
  visit: (
    snapshotDate: string,
    played: ReturnType<typeof computeDailyPowerRatings>
  ) => void
) => {
  const allDates = Array.from(
    new Set(
      Array.from(teamGames.values()).flatMap((games) =>
        games
          .map((game) => game.date)
          .filter((date) => typeof date === "string" && date <= targetDate)
      )
    )
  ).sort((a, b) => a.localeCompare(b));

  allDates.forEach((snapshotDate) => {
    const daily = computeDailyPowerRatings(teamGames, snapshotDate);
    const played = new Map(
      Array.from(daily.entries()).filter(
        ([, entry]) => entry.sourceThroughDate === snapshotDate
      )
    );
    if (played.size > 0) visit(snapshotDate, played);
  });
};

export const buildSnapshotHistoryByTeam = (
  teamGames: Map<string, TeamGame[]>,
  targetDate: string
): Map<string, TeamOffRatingSnapshot[]> => {
  const historyByTeam = new Map<string, TeamOffRatingSnapshot[]>();

  forEachPlayedSnapshot(teamGames, targetDate, (snapshotDate, played) => {
    played.forEach(({ rating }) => {
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
  const historyByTeam = new Map<string, TeamFormSnapshot[]>();

  forEachPlayedSnapshot(teamGames, targetDate, (snapshotDate, played) => {
    // PDO z against the same all-team baseline the ratings use.
    const ewmaMetrics = Array.from(teamGames.values())
      .map((games) => {
        const latest = games
          .filter((game) => game.date <= snapshotDate)
          .reduce<string | null>(
            (best, game) => (best == null || game.date > best ? game.date : best),
            null
          );
        return latest ? calculateEwma(games, latest) : null;
      })
      .filter((metric): metric is NonNullable<typeof metric> => Boolean(metric));
    const leagueMetrics = ewmaMetrics.length
      ? calculateLeagueMetrics(ewmaMetrics)
      : null;
    const pdoByTeam = new Map(
      ewmaMetrics.map((metric) => [
        metric.team_abbreviation,
        {
          pdo: metric.pdo_ewma,
          pdoZ: leagueMetrics ? calculateZScores(metric, leagueMetrics).pdo_z : 0
        }
      ])
    );

    played.forEach(({ rating }) => {
      const pdo = pdoByTeam.get(rating.team_abbreviation);
      const existing = historyByTeam.get(rating.team_abbreviation) ?? [];

      existing.push({
        date: snapshotDate,
        offRating: rating.off_rating,
        defRating: rating.def_rating,
        paceRating: rating.pace_rating,
        powerScore: Number(
          computeTeamPowerScore({
            offRating: rating.off_rating,
            defRating: rating.def_rating
          }).toFixed(2)
        ),
        pdo: pdo?.pdo ?? null,
        pdoZ: pdo?.pdoZ ?? 0,
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
