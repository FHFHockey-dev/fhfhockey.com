import type {
  BuildSkaterValueRowsOptions,
  SkaterBucket,
  SkaterBucketWeeklyAverage,
  SkaterFantasyPointSettings,
  SkaterFantasyStatKey,
  SkaterGameRow,
  SkaterGameWithFantasyPoints,
  SkaterValueOverviewRow,
  SkaterWeek,
  SkaterWeekCounts,
  SkaterWeekRating,
  SkaterWeeklyAggregate,
  YahooDraftAnalysis,
  YahooOwnershipTimelineEntry,
  YahooSkaterRow
} from "./skaterTypes";
import { SKATER_SCORING_CATEGORIES } from "./skaterMetrics";
import { DEFAULT_MINIMUM_PERCENT_DRAFTED } from "./skaterFilters";

const WEEK_RATINGS: SkaterWeekRating[] = [
  "Elite",
  "Quality",
  "Average",
  "Bad",
  "Really Bad"
];

export const MINIMUM_BUCKET_PLAYERS_FOR_STD_DEV = 3;
const DEFAULT_ADP_LEAGUE_SIZE = 12;

const finiteOrZero = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const finiteOrNull = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const parseNumericValue = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

const parseUtcDate = (date: string | null | undefined) => {
  if (!date) {
    return null;
  }

  const parsed = new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isDateInWeek = (date: string, week: SkaterWeek) =>
  date >= week.startDate && date <= week.endDate;

export const createEmptyWeekCounts = (): SkaterWeekCounts => ({
  Elite: 0,
  Quality: 0,
  Average: 0,
  Bad: 0,
  "Really Bad": 0
});

/**
 * Matches goalie variance and uses sample standard deviation.
 */
export const calculateStandardDeviation = (values: number[]): number => {
  if (values.length < 2) {
    return 0;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    (values.length - 1);

  return Math.sqrt(variance);
};

export const calculateSkaterFantasyStatValue = (
  row: SkaterGameRow,
  statKey: SkaterFantasyStatKey
): number => {
  const category = SKATER_SCORING_CATEGORIES.find(
    (candidate) => candidate.key === statKey
  );

  if (!category) {
    return 0;
  }

  const value = finiteOrZero(row[category.sourceField]);

  if (statKey === "TIME_ON_ICE") {
    return value / 60;
  }

  return value;
};

export const calculateSkaterGameFantasyPoints = (
  row: SkaterGameRow,
  settings: Partial<SkaterFantasyPointSettings>,
  selectedKeys: SkaterFantasyStatKey[]
): number =>
  selectedKeys.reduce(
    (total, statKey) =>
      total + calculateSkaterFantasyStatValue(row, statKey) * (settings[statKey] ?? 0),
    0
  );

export const attachSkaterFantasyPoints = (
  rows: SkaterGameRow[],
  settings: Partial<SkaterFantasyPointSettings>,
  selectedKeys: SkaterFantasyStatKey[]
): SkaterGameWithFantasyPoints[] =>
  rows.map((row) => ({
    ...row,
    fantasyPoints: calculateSkaterGameFantasyPoints(row, settings, selectedKeys)
  }));

export const getCalendarWeekForDate = (date: string): SkaterWeek | null => {
  const parsed = parseUtcDate(date);
  if (!parsed) {
    return null;
  }

  const day = parsed.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(parsed);
  start.setUTCDate(parsed.getUTCDate() + mondayOffset);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  return {
    key: `${toDateKey(start)}_${toDateKey(end)}`,
    startDate: toDateKey(start),
    endDate: toDateKey(end)
  };
};

export const findSkaterWeekForDate = (
  date: string | null | undefined,
  matchupWeeks: SkaterWeek[] = []
): SkaterWeek | null => {
  if (!date) {
    return null;
  }

  const dateKey = date.slice(0, 10);
  const matchupWeek = matchupWeeks.find((week) => isDateInWeek(dateKey, week));

  return matchupWeek ?? getCalendarWeekForDate(dateKey);
};

export const buildYahooSkaterMap = (rows: YahooSkaterRow[] = []) => {
  const byPlayerId = new Map<number, YahooSkaterRow>();

  rows.forEach((row) => {
    const playerId = parseNumericValue(row.player_id);
    if (playerId !== null) {
      byPlayerId.set(playerId, row);
    }
  });

  return byPlayerId;
};

export const calculateWeeklyOwnershipAverage = (
  timeline: YahooOwnershipTimelineEntry[] | null | undefined,
  week: SkaterWeek
): number | null => {
  const values =
    timeline
      ?.filter((entry) => isDateInWeek(entry.date, week))
      .map((entry) => entry.value)
      .filter((value) => Number.isFinite(value)) ?? [];

  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const getClosestPriorOwnership = (
  timeline: YahooOwnershipTimelineEntry[] | null | undefined,
  week: SkaterWeek
): number | null => {
  const priorEntries =
    timeline
      ?.filter((entry) => entry.date <= week.startDate && Number.isFinite(entry.value))
      .sort((a, b) => b.date.localeCompare(a.date)) ?? [];

  return priorEntries[0]?.value ?? null;
};

export const getWeeklyOwnershipValue = (
  yahooRow: YahooSkaterRow | undefined,
  week: SkaterWeek
): number | null => {
  if (!yahooRow) {
    return null;
  }

  return (
    calculateWeeklyOwnershipAverage(yahooRow.ownership_timeline, week) ??
    getClosestPriorOwnership(yahooRow.ownership_timeline, week) ??
    finiteOrNull(yahooRow.percent_ownership)
  );
};

export const getOwnershipBucket = (ownership: number | null): SkaterBucket => {
  if (ownership === null) {
    return {
      key: "ownership-unknown",
      label: "WW",
      kind: "unknown",
      sortOrder: 1000
    };
  }

  const clamped = Math.min(100, Math.max(0, ownership));
  const lowerBound = clamped >= 90 ? 90 : Math.floor(clamped / 10) * 10;
  const upperBound = lowerBound === 90 ? 100 : lowerBound + 9;

  return {
    key: `ownership-${lowerBound}-${upperBound}`,
    label: `${lowerBound}-${upperBound}%`,
    kind: "ownership",
    sortOrder: lowerBound
  };
};

const getDraftAnalysisValue = (
  draftAnalysis: YahooDraftAnalysis | null | undefined,
  key: keyof YahooDraftAnalysis
) => parseNumericValue(draftAnalysis?.[key]);

export const getYahooAverageDraftPick = (
  yahooRow: YahooSkaterRow | undefined
): number | null =>
  getDraftAnalysisValue(yahooRow?.draft_analysis, "average_pick") ??
  finiteOrNull(yahooRow?.average_draft_pick);

export const getYahooPercentDrafted = (
  yahooRow: YahooSkaterRow | undefined
): number | null =>
  getDraftAnalysisValue(yahooRow?.draft_analysis, "percent_drafted") ??
  finiteOrNull(yahooRow?.percent_drafted);

const ordinalSuffix = (value: number) => {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return "th";
  }

  switch (value % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
};

export const getAdpBucket = (
  adp: number | null,
  percentDrafted: number | null,
  minimumPercentDrafted = DEFAULT_MINIMUM_PERCENT_DRAFTED
): SkaterBucket => {
  if (adp === null || adp <= 0) {
    return {
      key: "adp-ww",
      label: "WW",
      kind: "waiver-wire",
      sortOrder: 1000
    };
  }

  if (percentDrafted !== null && percentDrafted < minimumPercentDrafted) {
    return {
      key: "adp-low-percent-drafted",
      label: "LOW %D",
      kind: "low-percent-drafted",
      sortOrder: 1001
    };
  }

  const round = Math.ceil(adp / DEFAULT_ADP_LEAGUE_SIZE);

  return {
    key: `adp-round-${round}`,
    label: `${round}${ordinalSuffix(round)} Rd`,
    kind: "adp-round",
    sortOrder: round
  };
};

const getTeam = (row: SkaterGameRow) =>
  row.team_abbrev ?? row.current_team_abbreviation ?? "N/A";

export const buildSkaterWeeklyAggregates = (
  rows: SkaterGameWithFantasyPoints[],
  options: Pick<
    BuildSkaterValueRowsOptions,
    "valuationMode" | "yahooRows" | "matchupWeeks" | "minimumPercentDrafted"
  >
): SkaterWeeklyAggregate[] => {
  const yahooByPlayerId = buildYahooSkaterMap(options.yahooRows);
  const grouped = new Map<string, SkaterGameWithFantasyPoints[]>();

  rows.forEach((row) => {
    if (typeof row.player_id !== "number" || !Number.isFinite(row.player_id)) {
      return;
    }

    const week = findSkaterWeekForDate(row.date, options.matchupWeeks);
    if (!week) {
      return;
    }

    const key = `${row.player_id}:${week.key}`;
    const playerWeekRows = grouped.get(key) ?? [];
    playerWeekRows.push(row);
    grouped.set(key, playerWeekRows);
  });

  return Array.from(grouped.values()).map((playerWeekRows) => {
    const sortedRows = [...playerWeekRows].sort((a, b) =>
      String(a.date ?? "").localeCompare(String(b.date ?? ""))
    );
    const firstRow = sortedRows[0];
    const latestRow = sortedRows.at(-1) ?? firstRow;
    const week = findSkaterWeekForDate(firstRow.date, options.matchupWeeks);
    const playerId = firstRow.player_id as number;
    const yahooRow = yahooByPlayerId.get(playerId);
    const gamesPlayed = playerWeekRows.reduce(
      (sum, row) => sum + (finiteOrNull(row.games_played) ?? 1),
      0
    );
    const fantasyPoints = playerWeekRows.reduce(
      (sum, row) => sum + row.fantasyPoints,
      0
    );
    const ownershipAverage = week
      ? getWeeklyOwnershipValue(yahooRow, week)
      : null;
    const adp = getYahooAverageDraftPick(yahooRow);
    const percentDrafted = getYahooPercentDrafted(yahooRow);
    const bucket =
      options.valuationMode === "ownership"
        ? getOwnershipBucket(ownershipAverage)
        : getAdpBucket(
            adp,
            percentDrafted,
            options.minimumPercentDrafted
          );

    return {
      playerId,
      playerName: latestRow.player_name ?? "Unknown Skater",
      team: getTeam(latestRow),
      position: latestRow.position_code ?? "N/A",
      week: week as SkaterWeek,
      gamesPlayed,
      fantasyPoints,
      fantasyPointsPerGame:
        gamesPlayed > 0 ? fantasyPoints / gamesPlayed : null,
      ownershipAverage,
      adp,
      percentDrafted,
      bucket
    };
  });
};

export const buildSkaterBucketWeeklyAverages = (
  weeklyAggregates: SkaterWeeklyAggregate[]
): SkaterBucketWeeklyAverage[] => {
  const grouped = new Map<string, SkaterWeeklyAggregate[]>();

  weeklyAggregates.forEach((aggregate) => {
    const key = `${aggregate.week.key}:${aggregate.bucket.key}`;
    const bucketRows = grouped.get(key) ?? [];
    bucketRows.push(aggregate);
    grouped.set(key, bucketRows);
  });

  return Array.from(grouped.values()).map((bucketRows) => {
    const firstRow = bucketRows[0];
    const weeklyValues = bucketRows.map((row) => row.fantasyPoints);
    const perGameValues = bucketRows
      .map((row) => row.fantasyPointsPerGame)
      .filter((value): value is number => value !== null);

    return {
      weekKey: firstRow.week.key,
      bucket: firstRow.bucket,
      playerCount: bucketRows.length,
      averageFantasyPoints:
        weeklyValues.reduce((sum, value) => sum + value, 0) /
        weeklyValues.length,
      averageFantasyPointsPerGame:
        perGameValues.length > 0
          ? perGameValues.reduce((sum, value) => sum + value, 0) /
            perGameValues.length
          : null,
      weeklyStandardDeviation: calculateStandardDeviation(weeklyValues)
    };
  });
};

export const classifySkaterWeek = (
  fantasyPoints: number,
  bucketAverage: SkaterBucketWeeklyAverage
): SkaterWeekRating => {
  if (
    bucketAverage.playerCount < MINIMUM_BUCKET_PLAYERS_FOR_STD_DEV ||
    bucketAverage.weeklyStandardDeviation === 0
  ) {
    return "Average";
  }

  const delta = fantasyPoints - bucketAverage.averageFantasyPoints;
  const zScore = delta / bucketAverage.weeklyStandardDeviation;

  if (zScore >= 1.5) return "Elite";
  if (zScore >= 0.5) return "Quality";
  if (zScore > -0.5) return "Average";
  if (zScore > -1.5) return "Bad";
  return "Really Bad";
};

const buildBucketAverageMap = (averages: SkaterBucketWeeklyAverage[]) => {
  const byWeekAndBucket = new Map<string, SkaterBucketWeeklyAverage>();

  averages.forEach((average) => {
    byWeekAndBucket.set(`${average.weekKey}:${average.bucket.key}`, average);
  });

  return byWeekAndBucket;
};

export const buildSkaterValueOverviewRows = (
  gameRows: SkaterGameRow[],
  options: BuildSkaterValueRowsOptions
): SkaterValueOverviewRow[] => {
  const rowsWithFantasyPoints = attachSkaterFantasyPoints(
    gameRows,
    options.scoringSettings,
    options.selectedScoringKeys
  );
  const weeklyAggregates = buildSkaterWeeklyAggregates(rowsWithFantasyPoints, {
    valuationMode: options.valuationMode,
    yahooRows: options.yahooRows,
    matchupWeeks: options.matchupWeeks,
    minimumPercentDrafted: options.minimumPercentDrafted
  });

  return buildSkaterValueOverviewRowsFromAggregates(
    rowsWithFantasyPoints,
    weeklyAggregates,
    options
  );
};

export const buildSkaterValueOverviewRowsFromAggregates = (
  rowsWithFantasyPoints: SkaterGameWithFantasyPoints[],
  weeklyAggregates: SkaterWeeklyAggregate[],
  options: Pick<BuildSkaterValueRowsOptions, "valuationMode" | "averageComparisonBasis">
): SkaterValueOverviewRow[] => {
  const bucketAverages = buildSkaterBucketWeeklyAverages(weeklyAggregates);
  const averageByWeekAndBucket = buildBucketAverageMap(bucketAverages);
  const gameRowsByPlayerId = new Map<number, SkaterGameWithFantasyPoints[]>();
  const weeklyRowsByPlayerId = new Map<number, SkaterWeeklyAggregate[]>();

  rowsWithFantasyPoints.forEach((row) => {
    if (typeof row.player_id !== "number" || !Number.isFinite(row.player_id)) {
      return;
    }
    const playerRows = gameRowsByPlayerId.get(row.player_id) ?? [];
    playerRows.push(row);
    gameRowsByPlayerId.set(row.player_id, playerRows);
  });

  weeklyAggregates.forEach((aggregate) => {
    const playerRows = weeklyRowsByPlayerId.get(aggregate.playerId) ?? [];
    playerRows.push(aggregate);
    weeklyRowsByPlayerId.set(aggregate.playerId, playerRows);
  });

  return Array.from(weeklyRowsByPlayerId.entries())
    .map(([playerId, playerWeeks]) => {
      const sortedWeeks = [...playerWeeks].sort((a, b) =>
        a.week.key.localeCompare(b.week.key)
      );
      const latestWeek = sortedWeeks.at(-1) ?? sortedWeeks[0];
      const gameFantasyPoints =
        gameRowsByPlayerId.get(playerId)?.map((row) => row.fantasyPoints) ?? [];
      const weekCounts = createEmptyWeekCounts();
      let comparisonTotal = 0;
      let comparisonCount = 0;

      sortedWeeks.forEach((week) => {
        const bucketAverage = averageByWeekAndBucket.get(
          `${week.week.key}:${week.bucket.key}`
        );
        if (!bucketAverage) {
          weekCounts.Average += 1;
          return;
        }

        weekCounts[classifySkaterWeek(week.fantasyPoints, bucketAverage)] += 1;
        const comparisonAverage =
          options.averageComparisonBasis === "game"
            ? bucketAverage.averageFantasyPointsPerGame
            : bucketAverage.averageFantasyPoints;
        const playerValue =
          options.averageComparisonBasis === "game"
            ? week.fantasyPointsPerGame
            : week.fantasyPoints;

        if (comparisonAverage !== null && playerValue !== null) {
          comparisonTotal += playerValue - comparisonAverage;
          comparisonCount += 1;
        }
      });

      const totalWeeks = sortedWeeks.length;
      const gamesPlayed = sortedWeeks.reduce(
        (sum, row) => sum + row.gamesPlayed,
        0
      );
      const totalFantasyPoints = sortedWeeks.reduce(
        (sum, row) => sum + row.fantasyPoints,
        0
      );
      const weeklyFantasyPoints = sortedWeeks.map((row) => row.fantasyPoints);
      const valuation =
        options.valuationMode === "ownership"
          ? latestWeek.ownershipAverage
          : latestWeek.adp;

      return {
        rowType: "player",
        playerId,
        playerName: latestWeek.playerName,
        team: latestWeek.team,
        tier: latestWeek.bucket.label,
        valuation,
        valuationLabel: options.valuationMode === "ownership" ? "OWN%" : "ADP",
        bucket: latestWeek.bucket,
        weekCounts,
        percentOkWeeks:
          totalWeeks > 0
            ? ((weekCounts.Elite + weekCounts.Quality + weekCounts.Average) /
                totalWeeks) *
              100
            : 0,
        percentGoodWeeks:
          totalWeeks > 0
            ? ((weekCounts.Elite + weekCounts.Quality) / totalWeeks) * 100
            : 0,
        weeklyVariance: calculateStandardDeviation(weeklyFantasyPoints),
        gameToGameVariance: calculateStandardDeviation(gameFantasyPoints),
        averageFantasyPointsPerGame:
          gamesPlayed > 0 ? totalFantasyPoints / gamesPlayed : null,
        averageFantasyPointsPerWeek:
          totalWeeks > 0 ? totalFantasyPoints / totalWeeks : 0,
        fantasyPointsAboveAverage:
          comparisonCount > 0 ? comparisonTotal / comparisonCount : 0,
        gamesPlayed,
        totalFantasyPoints
      } satisfies SkaterValueOverviewRow;
    })
    .sort((a, b) => b.totalFantasyPoints - a.totalFantasyPoints);
};

export const WEEK_RATING_SORT_ORDER = WEEK_RATINGS.reduce(
  (acc, rating, index) => {
    acc[rating] = index;
    return acc;
  },
  {} as Record<SkaterWeekRating, number>
);
