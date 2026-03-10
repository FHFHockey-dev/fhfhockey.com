import {
  DEFAULT_ROLLING_WINDOWS,
  type RollingWindow
} from "./rollingMetricAggregation";
import { ROLLING_PLAYER_AVAILABILITY_CONTRACT } from "./rollingPlayerAvailabilityContract";

type SeasonBucket = {
  sum: number;
  count: number;
};

function getSeasonWindowKey(season: number): number {
  if (!Number.isFinite(season)) return season;
  return season >= 10000000 ? Math.floor(season / 10000) : season;
}

export type HistoricalAverageAccumulator = {
  careerSum: number;
  careerCount: number;
  bySeason: Map<number, SeasonBucket>;
};

export type HistoricalAverageSnapshot = {
  season: number | null;
  threeYear: number | null;
  career: number | null;
};

export type HistoricalGpPctAccumulator = {
  bySeason: Map<
    number,
    {
      playerGames: number;
      teamGames: number;
    }
  >;
  careerPlayerGames: number;
  careerTeamGames: number;
  bySeasonTeam: Map<
    string,
    {
      season: number;
      teamId: number | null;
      playerGames: number;
      teamGames: number;
      appearanceTeamGames: number[];
    }
  >;
};

export type HistoricalGpPctSnapshot = {
  season: number | null;
  threeYear: number | null;
  career: number | null;
  seasonPlayerGames: number;
  seasonTeamGames: number;
  threeYearPlayerGames: number;
  threeYearTeamGames: number;
  careerPlayerGames: number;
  careerTeamGames: number;
};

export type RollingGpPctSnapshot = {
  windows: Record<
    RollingWindow,
    {
      playerGames: number;
      teamGames: number;
      ratio: number | null;
    }
  >;
};

export const HISTORICAL_GP_PCT_CONTRACT =
  ROLLING_PLAYER_AVAILABILITY_CONTRACT.intendedReplacement;

export function createHistoricalAverageAccumulator(): HistoricalAverageAccumulator {
  return {
    careerSum: 0,
    careerCount: 0,
    bySeason: new Map()
  };
}

export function updateHistoricalAverageAccumulator(
  acc: HistoricalAverageAccumulator,
  season: number,
  value: number | null
) {
  if (value == null || Number.isNaN(value)) return;
  acc.careerSum += value;
  acc.careerCount += 1;
  const bucket = acc.bySeason.get(season) ?? { sum: 0, count: 0 };
  bucket.sum += value;
  bucket.count += 1;
  acc.bySeason.set(season, bucket);
}

function toAverage(sum: number, count: number): number | null {
  if (count <= 0) return null;
  return Number((sum / count).toFixed(6));
}

export function getHistoricalAverageSnapshot(
  acc: HistoricalAverageAccumulator,
  currentSeason: number
): HistoricalAverageSnapshot {
  const currentSeasonKey = getSeasonWindowKey(currentSeason);
  const seasonBucket = acc.bySeason.get(currentSeason);
  let threeYearSum = 0;
  let threeYearCount = 0;
  for (const [season, bucket] of acc.bySeason.entries()) {
    const seasonKey = getSeasonWindowKey(season);
    if (seasonKey < currentSeasonKey - 2 || seasonKey > currentSeasonKey) {
      continue;
    }
    threeYearSum += bucket.sum;
    threeYearCount += bucket.count;
  }
  return {
    season: seasonBucket ? toAverage(seasonBucket.sum, seasonBucket.count) : null,
    threeYear: toAverage(threeYearSum, threeYearCount),
    career: toAverage(acc.careerSum, acc.careerCount)
  };
}

export function createHistoricalGpPctAccumulator(): HistoricalGpPctAccumulator {
  // Transitional note: the accumulator is still keyed by season/team buckets,
  // for rolling windows, but cross-stint season / 3YA / career availability is
  // accumulated explicitly at the season and career levels so the replacement
  // contract does not depend on reconstructing those scopes from team buckets
  // later. Keep future GP% changes aligned to
  // `ROLLING_PLAYER_AVAILABILITY_CONTRACT.intendedReplacement`.
  return {
    bySeason: new Map(),
    careerPlayerGames: 0,
    careerTeamGames: 0,
    bySeasonTeam: new Map()
  };
}

export function updateHistoricalGpPctAccumulator(
  acc: HistoricalGpPctAccumulator,
  args: {
    season: number;
    teamId: number | null;
    playedThisGame: boolean;
    teamGamesPlayed: number;
  }
) {
  const teamKey = `${args.season}:${args.teamId ?? 0}`;
  const bucket = acc.bySeasonTeam.get(teamKey) ?? {
    season: args.season,
    teamId: args.teamId ?? null,
    playerGames: 0,
    teamGames: 0,
    appearanceTeamGames: []
  };
  const seasonBucket = acc.bySeason.get(args.season) ?? {
    playerGames: 0,
    teamGames: 0
  };

  const previousTeamGames = bucket.teamGames;
  if (args.playedThisGame) {
    bucket.playerGames += 1;
    seasonBucket.playerGames += 1;
    acc.careerPlayerGames += 1;
    if (args.teamGamesPlayed > 0) {
      bucket.appearanceTeamGames.push(args.teamGamesPlayed);
    }
  }
  bucket.teamGames = Math.max(bucket.teamGames, args.teamGamesPlayed);
  const addedTeamGames = bucket.teamGames - previousTeamGames;
  if (addedTeamGames > 0) {
    seasonBucket.teamGames += addedTeamGames;
    acc.careerTeamGames += addedTeamGames;
  }

  acc.bySeasonTeam.set(teamKey, bucket);
  acc.bySeason.set(args.season, seasonBucket);
}

function toRatio(playerGames: number, teamGames: number): number | null {
  if (teamGames <= 0) return null;
  return Number(Math.min(1, playerGames / teamGames).toFixed(6));
}

export function getHistoricalGpPctSnapshot(
  acc: HistoricalGpPctAccumulator,
  currentSeason: number
): HistoricalGpPctSnapshot {
  // The replacement contract requires season / 3YA / career availability to be
  // interpreted as player-centered aggregates across all stints in scope:
  // `HISTORICAL_GP_PCT_CONTRACT.*.historicalScope`
  // is the source of truth for later remediation tasks.
  const currentSeasonKey = getSeasonWindowKey(currentSeason);
  const seasonBucket = acc.bySeason.get(currentSeason);
  const seasonPlayerGames = seasonBucket?.playerGames ?? 0;
  const seasonTeamGames = seasonBucket?.teamGames ?? 0;
  let threeYearPlayerGames = 0;
  let threeYearTeamGames = 0;
  const careerPlayerGames = acc.careerPlayerGames;
  const careerTeamGames = acc.careerTeamGames;

  for (const [season, bucket] of acc.bySeason.entries()) {
    const bucketSeasonKey = getSeasonWindowKey(season);

    if (
      bucketSeasonKey >= currentSeasonKey - 2 &&
      bucketSeasonKey <= currentSeasonKey
    ) {
      threeYearPlayerGames += bucket.playerGames;
      threeYearTeamGames += bucket.teamGames;
    }
  }

  return {
    season: toRatio(seasonPlayerGames, seasonTeamGames),
    threeYear: toRatio(threeYearPlayerGames, threeYearTeamGames),
    career: toRatio(careerPlayerGames, careerTeamGames),
    seasonPlayerGames,
    seasonTeamGames,
    threeYearPlayerGames,
    threeYearTeamGames,
    careerPlayerGames,
    careerTeamGames
  };
}

export function getRollingGpPctSnapshot(
  acc: HistoricalGpPctAccumulator,
  args: {
    currentSeason: number;
    currentTeamId: number | null;
    currentTeamGamesPlayed: number;
    windows?: RollingWindow[];
  }
): RollingGpPctSnapshot {
  // Rolling availability is expected to converge on the shared current-team
  // last-N-team-games contract, even though this helper still operates on the
  // existing accumulator shape during the remediation transition.
  const windows = args.windows ?? DEFAULT_ROLLING_WINDOWS;
  const currentBucket =
    acc.bySeasonTeam.get(`${args.currentSeason}:${args.currentTeamId ?? 0}`) ??
    null;

  const snapshot = windows.reduce<RollingGpPctSnapshot["windows"]>(
    (result, windowSize) => {
      const teamGames =
        args.currentTeamGamesPlayed > 0
          ? Math.min(windowSize, args.currentTeamGamesPlayed)
          : 0;
      const startTeamGame =
        teamGames > 0 ? args.currentTeamGamesPlayed - teamGames + 1 : 0;
      const playerGames =
        currentBucket && teamGames > 0
          ? currentBucket.appearanceTeamGames.filter(
              (teamGame) =>
                teamGame >= startTeamGame &&
                teamGame <= args.currentTeamGamesPlayed
            ).length
          : 0;

      result[windowSize] = {
        playerGames,
        teamGames,
        ratio: toRatio(playerGames, teamGames)
      };
      return result;
    },
    {} as RollingGpPctSnapshot["windows"]
  );

  return { windows: snapshot };
}
