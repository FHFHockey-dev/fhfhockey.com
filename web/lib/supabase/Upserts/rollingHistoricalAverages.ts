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

/**
 * One team-of-record game slot (decision 16): a regular-season game of the
 * team the player was with on that date. `teamId` null marks a player game
 * whose team of record is unknown, which makes every scope containing it
 * unknown.
 */
export type TeamOfRecordSlot = {
  season: number;
  teamId: number | null;
  date: string;
  played: boolean;
};

export type HistoricalGpPctAccumulator = {
  slots: TeamOfRecordSlot[];
  bySeason: Map<
    number,
    {
      playerGames: number;
      teamGames: number;
      unknownTeamGames: number;
    }
  >;
  careerPlayerGames: number;
  careerTeamGames: number;
  careerUnknownTeamGames: number;
  stint: {
    season: number;
    teamId: number;
    schedule: readonly string[];
    cursorDate: string;
  } | null;
  /** Team of record at the end of the latest known stint, by season. */
  lastTeamBySeason: Map<number, number>;
};

export type HistoricalGpPctSnapshot = {
  season: number | null;
  threeYear: number | null;
  career: number | null;
  /** Appearances; always known. */
  seasonPlayerGames: number;
  /** Team-of-record games available; null when any team of record is unknown. */
  seasonTeamGames: number | null;
  threeYearPlayerGames: number;
  threeYearTeamGames: number | null;
  careerPlayerGames: number;
  careerTeamGames: number | null;
};

export type RollingGpPctSnapshot = {
  windows: Record<
    RollingWindow,
    {
      playerGames: number;
      teamGames: number | null;
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
  return {
    slots: [],
    bySeason: new Map(),
    careerPlayerGames: 0,
    careerTeamGames: 0,
    careerUnknownTeamGames: 0,
    stint: null,
    lastTeamBySeason: new Map()
  };
}

function pushSlot(acc: HistoricalGpPctAccumulator, slot: TeamOfRecordSlot) {
  acc.slots.push(slot);
  const bucket = acc.bySeason.get(slot.season) ?? {
    playerGames: 0,
    teamGames: 0,
    unknownTeamGames: 0
  };
  if (slot.played) {
    bucket.playerGames += 1;
    acc.careerPlayerGames += 1;
  }
  if (slot.teamId == null) {
    bucket.unknownTeamGames += 1;
    acc.careerUnknownTeamGames += 1;
  } else {
    bucket.teamGames += 1;
    acc.careerTeamGames += 1;
  }
  acc.bySeason.set(slot.season, bucket);
}

function addTeamGames(
  acc: HistoricalGpPctAccumulator,
  stint: NonNullable<HistoricalGpPctAccumulator["stint"]>,
  afterDate: string,
  throughDate: string,
  inclusive: boolean
) {
  for (const date of stint.schedule) {
    if (date <= afterDate) continue;
    if (inclusive ? date > throughDate : date >= throughDate) break;
    pushSlot(acc, { season: stint.season, teamId: stint.teamId, date, played: false });
  }
}

/**
 * Availability follows the team of record by date (owner decision 16).
 *
 * Call once per player game row in chronological order. Each regular-season
 * game of the team the player was with on that date is one slot; the player
 * game marks its slot played. The trade or roster date is not stored, so stints
 * use an appearance-bounded proxy: a stint starts at the player's first
 * appearance with the team (or at the team's first game of the season when he
 * ended the previous season with the same team) and the previous stint keeps
 * its team's games until the day before the new stint's first appearance.
 * Preseason and playoff games are not team games here. A row whose team is
 * unknown adds an unknown slot, and any scope containing one is unknown.
 */
export function updateHistoricalGpPctAccumulator(
  acc: HistoricalGpPctAccumulator,
  args: {
    season: number;
    teamId: number | null;
    date: string;
    playedThisGame: boolean;
    /** Sorted regular-season game dates of `teamId` in `season`. */
    teamScheduleDates: readonly string[] | null;
    /** False for preseason and playoff rows, which are skipped. */
    regularSeason?: boolean;
  }
) {
  if (args.regularSeason === false) return;

  if (
    args.teamId == null ||
    !args.teamScheduleDates ||
    !args.teamScheduleDates.includes(args.date)
  ) {
    acc.stint = null;
    pushSlot(acc, {
      season: args.season,
      teamId: null,
      date: args.date,
      played: args.playedThisGame
    });
    return;
  }

  const previous = acc.stint;
  if (previous && previous.teamId === args.teamId && previous.season === args.season) {
    addTeamGames(acc, previous, previous.cursorDate, args.date, false);
  } else {
    if (previous && previous.season === args.season) {
      // Appearance-bounded proxy: the old team keeps its games until the day
      // before the first appearance with the new team.
      addTeamGames(acc, previous, previous.cursorDate, args.date, false);
    }
    // First stint of a season for a player who ended his previous season with
    // the same team: he was on the roster from the team's first game.
    let priorSeason = Number.NEGATIVE_INFINITY;
    for (const season of acc.lastTeamBySeason.keys()) {
      if (season < args.season && season > priorSeason) priorSeason = season;
    }
    const firstStintOfSeason = !acc.bySeason.get(args.season)?.teamGames;
    const continuesFromLastSeason =
      firstStintOfSeason && acc.lastTeamBySeason.get(priorSeason) === args.teamId;
    const startCursor = continuesFromLastSeason ? "" : args.date;
    acc.stint = {
      season: args.season,
      teamId: args.teamId,
      schedule: args.teamScheduleDates,
      cursorDate: startCursor
    };
    if (startCursor === "") {
      addTeamGames(acc, acc.stint, "", args.date, false);
    }
  }

  pushSlot(acc, {
    season: args.season,
    teamId: args.teamId,
    date: args.date,
    played: args.playedThisGame
  });
  acc.stint!.cursorDate = args.date;
  acc.lastTeamBySeason.set(args.season, args.teamId);
}

function toRatio(playerGames: number, teamGames: number | null): number | null {
  if (teamGames == null || teamGames <= 0) return null;
  // Never clamp: a ratio above 1 is a data mismatch to investigate.
  return Number((playerGames / teamGames).toFixed(6));
}

export function getHistoricalGpPctSnapshot(
  acc: HistoricalGpPctAccumulator,
  currentSeason: number
): HistoricalGpPctSnapshot {
  const currentSeasonKey = getSeasonWindowKey(currentSeason);
  const seasonBucket = acc.bySeason.get(currentSeason);
  const seasonPlayerGames = seasonBucket?.playerGames ?? 0;
  const seasonTeamGames =
    seasonBucket && seasonBucket.unknownTeamGames > 0
      ? null
      : (seasonBucket?.teamGames ?? 0);
  let threeYearPlayerGames = 0;
  let threeYearTeamGames: number | null = 0;

  for (const [season, bucket] of acc.bySeason.entries()) {
    const bucketSeasonKey = getSeasonWindowKey(season);
    if (
      bucketSeasonKey >= currentSeasonKey - 2 &&
      bucketSeasonKey <= currentSeasonKey
    ) {
      threeYearPlayerGames += bucket.playerGames;
      threeYearTeamGames =
        threeYearTeamGames == null || bucket.unknownTeamGames > 0
          ? null
          : threeYearTeamGames + bucket.teamGames;
    }
  }

  const careerTeamGames =
    acc.careerUnknownTeamGames > 0 ? null : acc.careerTeamGames;

  return {
    season: toRatio(seasonPlayerGames, seasonTeamGames),
    threeYear: toRatio(threeYearPlayerGames, threeYearTeamGames),
    career: toRatio(acc.careerPlayerGames, careerTeamGames),
    seasonPlayerGames,
    seasonTeamGames,
    threeYearPlayerGames,
    threeYearTeamGames,
    careerPlayerGames: acc.careerPlayerGames,
    careerTeamGames
  };
}

/**
 * Last N team-of-record games by date within the current season (decision
 * 16): before a trade the window holds the old team's games, after it the
 * new team's, so a player who missed nothing reads N of N.
 */
export function getRollingGpPctSnapshot(
  acc: HistoricalGpPctAccumulator,
  args: {
    currentSeason: number;
    windows?: RollingWindow[];
  }
): RollingGpPctSnapshot {
  const windows = args.windows ?? DEFAULT_ROLLING_WINDOWS;
  const seasonSlots = acc.slots.filter((slot) => slot.season === args.currentSeason);

  const snapshot = windows.reduce<RollingGpPctSnapshot["windows"]>(
    (result, windowSize) => {
      const members = seasonSlots.slice(-windowSize);
      const playerGames = members.filter((slot) => slot.played).length;
      const teamGames = members.some((slot) => slot.teamId == null)
        ? null
        : members.length;
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
