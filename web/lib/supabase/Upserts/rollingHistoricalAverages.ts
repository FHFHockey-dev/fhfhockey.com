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
  bySeasonTeam: Map<
    string,
    {
      season: number;
      playerGames: number;
      teamGames: number;
    }
  >;
};

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
  return {
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
    playerGames: 0,
    teamGames: 0
  };
  if (args.playedThisGame) {
    bucket.playerGames += 1;
  }
  bucket.teamGames = Math.max(bucket.teamGames, args.teamGamesPlayed);
  acc.bySeasonTeam.set(teamKey, bucket);
}

function toRatio(playerGames: number, teamGames: number): number | null {
  if (teamGames <= 0) return null;
  return Number(Math.min(1, playerGames / teamGames).toFixed(6));
}

export function getHistoricalGpPctSnapshot(
  acc: HistoricalGpPctAccumulator,
  currentSeason: number,
  teamId: number | null
): HistoricalAverageSnapshot {
  const currentSeasonKey = getSeasonWindowKey(currentSeason);
  let seasonPlayerGames = 0;
  let seasonTeamGames = 0;
  let threeYearPlayerGames = 0;
  let threeYearTeamGames = 0;
  let careerPlayerGames = 0;
  let careerTeamGames = 0;

  for (const [key, bucket] of acc.bySeasonTeam.entries()) {
    const [seasonStr, teamIdStr] = key.split(":");
    const bucketSeason = Number(seasonStr);
    const bucketTeamId = Number(teamIdStr);
    const bucketSeasonKey = getSeasonWindowKey(bucketSeason);

    if (
      bucketSeasonKey >= currentSeasonKey - 2 &&
      bucketSeasonKey <= currentSeasonKey
    ) {
      threeYearPlayerGames += bucket.playerGames;
      threeYearTeamGames += bucket.teamGames;
    }
    careerPlayerGames += bucket.playerGames;
    careerTeamGames += bucket.teamGames;

    if (bucketSeason === currentSeason && bucketTeamId === (teamId ?? 0)) {
      seasonPlayerGames += bucket.playerGames;
      seasonTeamGames += bucket.teamGames;
    }
  }

  return {
    season: toRatio(seasonPlayerGames, seasonTeamGames),
    threeYear: toRatio(threeYearPlayerGames, threeYearTeamGames),
    career: toRatio(careerPlayerGames, careerTeamGames)
  };
}
