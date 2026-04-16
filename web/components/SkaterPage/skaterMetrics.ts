import { DEFAULT_SKATER_FANTASY_POINTS } from "lib/projectionsConfig/fantasyPointsConfig";
import { SKATER_LABELS } from "lib/projectionsConfig/skaterScoringLabels";

import type {
  SkaterAdvancedMetricsRow,
  SkaterBucket,
  SkaterMetricsRow,
  SkaterScoringCategory,
  SkaterGameRow,
  SkaterValueOverviewRow,
  SkaterValuationMode,
  SkaterWeeklyAggregate
} from "./skaterTypes";

export const SKATER_SCORING_LABELS = SKATER_LABELS;

const defaultPointValue = (key: string) =>
  DEFAULT_SKATER_FANTASY_POINTS[key] ?? 0;

export const SKATER_SCORING_CATEGORIES: SkaterScoringCategory[] = [
  {
    key: "GOALS",
    label: SKATER_SCORING_LABELS.GOALS,
    sourceField: "goals",
    defaultValue: defaultPointValue("GOALS"),
    defaultSelected: true
  },
  {
    key: "ASSISTS",
    label: SKATER_SCORING_LABELS.ASSISTS,
    sourceField: "assists",
    defaultValue: defaultPointValue("ASSISTS"),
    defaultSelected: true
  },
  {
    key: "POINTS",
    label: SKATER_SCORING_LABELS.POINTS,
    sourceField: "points",
    defaultValue: defaultPointValue("POINTS"),
    defaultSelected: false
  },
  {
    key: "HITS",
    label: SKATER_SCORING_LABELS.HITS,
    sourceField: "hits",
    defaultValue: defaultPointValue("HITS"),
    defaultSelected: true
  },
  {
    key: "PENALTY_MINUTES",
    label: SKATER_SCORING_LABELS.PENALTY_MINUTES,
    sourceField: "penalty_minutes",
    defaultValue: defaultPointValue("PENALTY_MINUTES"),
    defaultSelected: false
  },
  {
    key: "BLOCKED_SHOTS",
    label: SKATER_SCORING_LABELS.BLOCKED_SHOTS,
    sourceField: "blocked_shots",
    defaultValue: defaultPointValue("BLOCKED_SHOTS"),
    defaultSelected: true
  },
  {
    key: "SHOTS_ON_GOAL",
    label: SKATER_SCORING_LABELS.SHOTS_ON_GOAL,
    sourceField: "shots",
    defaultValue: defaultPointValue("SHOTS_ON_GOAL"),
    defaultSelected: true
  },
  {
    key: "PP_POINTS",
    label: SKATER_SCORING_LABELS.PP_POINTS,
    sourceField: "pp_points",
    defaultValue: defaultPointValue("PP_POINTS"),
    defaultSelected: true
  },
  {
    key: "PP_GOALS",
    label: SKATER_SCORING_LABELS.PP_GOALS,
    sourceField: "pp_goals",
    defaultValue: defaultPointValue("PP_GOALS"),
    defaultSelected: false
  },
  {
    key: "PP_ASSISTS",
    label: SKATER_SCORING_LABELS.PP_ASSISTS,
    sourceField: "pp_assists",
    defaultValue: defaultPointValue("PP_ASSISTS"),
    defaultSelected: false
  },
  {
    key: "SH_POINTS",
    label: SKATER_SCORING_LABELS.SH_POINTS,
    sourceField: "sh_points",
    defaultValue: defaultPointValue("SH_POINTS"),
    defaultSelected: false
  },
  {
    key: "SH_GOALS",
    label: SKATER_SCORING_LABELS.SH_GOALS,
    sourceField: "sh_goals",
    defaultValue: defaultPointValue("SH_GOALS"),
    defaultSelected: false
  },
  {
    key: "SH_ASSISTS",
    label: SKATER_SCORING_LABELS.SH_ASSISTS,
    sourceField: "sh_assists",
    defaultValue: defaultPointValue("SH_ASSISTS"),
    defaultSelected: false
  },
  {
    key: "PLUS_MINUS",
    label: SKATER_SCORING_LABELS.PLUS_MINUS,
    sourceField: "plus_minus",
    defaultValue: defaultPointValue("PLUS_MINUS"),
    defaultSelected: false
  },
  {
    key: "TIME_ON_ICE",
    label: SKATER_SCORING_LABELS.TIME_ON_ICE,
    sourceField: "toi_per_game",
    defaultValue: defaultPointValue("TIME_ON_ICE"),
    defaultSelected: false
  }
];

export const DEFAULT_SKATER_SCORING_SETTINGS = SKATER_SCORING_CATEGORIES.reduce(
  (settings, category) => {
    settings[category.key] = category.defaultValue;
    return settings;
  },
  {} as Record<(typeof SKATER_SCORING_CATEGORIES)[number]["key"], number>
);

export const DEFAULT_SELECTED_SKATER_SCORING_KEYS = SKATER_SCORING_CATEGORIES
  .filter((category) => category.defaultSelected)
  .map((category) => category.key);

export const STANDARD_SKATER_METRIC_FIELDS = [
  "games_played",
  "toi_per_game",
  "goals",
  "assists",
  "points",
  "shots",
  "shooting_percentage",
  "pp_toi",
  "pp_toi_per_game",
  "pp_goals",
  "pp_assists",
  "pp_points",
  "hits",
  "blocked_shots",
  "penalty_minutes",
  "plus_minus"
] as const;

export const ADVANCED_SKATER_METRIC_FIELDS = [
  "goals",
  "assists",
  "points",
  "shots",
  "pp_goals",
  "pp_assists",
  "pp_points",
  "hits",
  "blocked_shots",
  "penalty_minutes",
  "toi_per_game",
  "pp_toi",
  "individual_sat_for_per_60",
  "nst_ipp",
  "nst_ixg_per_60",
  "nst_oi_cf_per_60"
] as const;

const EMPTY_BUCKET: SkaterBucket = {
  key: "unknown",
  label: "N/A",
  kind: "unknown",
  sortOrder: 10000
};

const finiteOrZero = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const finiteOrNull = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const average = (values: Array<number | null | undefined>) => {
  const finiteValues = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value)
  );

  if (finiteValues.length === 0) {
    return null;
  }

  return (
    finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length
  );
};

const sum = (values: Array<number | null | undefined>) =>
  values.reduce<number>((total, value) => total + finiteOrZero(value), 0);

const per60 = (value: number, toiSeconds: number) =>
  toiSeconds > 0 ? (value / toiSeconds) * 3600 : null;

const getTeam = (row: SkaterGameRow) =>
  row.team_abbrev ?? row.current_team_abbreviation ?? "N/A";

const getPlayerKey = (row: SkaterGameRow) =>
  typeof row.player_id === "number" && Number.isFinite(row.player_id)
    ? row.player_id
    : null;

const groupRowsByPlayer = (rows: SkaterGameRow[]) => {
  const byPlayerId = new Map<number, SkaterGameRow[]>();

  rows.forEach((row) => {
    const playerId = getPlayerKey(row);
    if (playerId === null) {
      return;
    }

    const playerRows = byPlayerId.get(playerId) ?? [];
    playerRows.push(row);
    byPlayerId.set(playerId, playerRows);
  });

  return byPlayerId;
};

const getLatestContextByPlayer = (weeklyAggregates: SkaterWeeklyAggregate[]) => {
  const byPlayerId = new Map<number, SkaterWeeklyAggregate>();

  weeklyAggregates.forEach((aggregate) => {
    const current = byPlayerId.get(aggregate.playerId);
    if (!current || aggregate.week.key > current.week.key) {
      byPlayerId.set(aggregate.playerId, aggregate);
    }
  });

  return byPlayerId;
};

const getValuation = (
  context: SkaterWeeklyAggregate | undefined,
  valuationMode: SkaterValuationMode
) => (valuationMode === "ownership" ? context?.ownershipAverage : context?.adp) ?? null;

const getValuationLabel = (valuationMode: SkaterValuationMode) =>
  valuationMode === "ownership" ? "OWN%" : "ADP";

const sortByBucketThenName = <
  T extends { bucket: SkaterBucket; rowType: "player" | "bucket-average"; playerName: string }
>(
  a: T,
  b: T
) => {
  if (a.bucket.sortOrder !== b.bucket.sortOrder) {
    return a.bucket.sortOrder - b.bucket.sortOrder;
  }

  if (a.rowType !== b.rowType) {
    return a.rowType === "player" ? -1 : 1;
  }

  return a.playerName.localeCompare(b.playerName);
};

export const buildSkaterMetricsRows = (
  rows: SkaterGameRow[],
  weeklyAggregates: SkaterWeeklyAggregate[],
  valuationMode: SkaterValuationMode
): SkaterMetricsRow[] => {
  const contextByPlayer = getLatestContextByPlayer(weeklyAggregates);

  return Array.from(groupRowsByPlayer(rows).entries())
    .map(([playerId, playerRows]) => {
      const sortedRows = [...playerRows].sort((a, b) =>
        String(a.date ?? "").localeCompare(String(b.date ?? ""))
      );
      const latestRow = sortedRows.at(-1) ?? sortedRows[0];
      const context = contextByPlayer.get(playerId);
      const gamesPlayed = sum(playerRows.map((row) => row.games_played ?? 1));
      const shots = sum(playerRows.map((row) => row.shots));
      const goals = sum(playerRows.map((row) => row.goals));

      return {
        rowType: "player",
        playerId,
        playerName: latestRow.player_name ?? "Unknown Skater",
        team: getTeam(latestRow),
        valuation: getValuation(context, valuationMode),
        valuationLabel: getValuationLabel(valuationMode),
        bucket: context?.bucket ?? EMPTY_BUCKET,
        gamesPlayed,
        averageTimeOnIce: average(playerRows.map((row) => row.toi_per_game)),
        goals,
        assists: sum(playerRows.map((row) => row.assists)),
        points: sum(playerRows.map((row) => row.points)),
        shots,
        shootingPercentage: shots > 0 ? goals / shots : average(playerRows.map((row) => row.shooting_percentage)),
        averagePowerPlayTimeOnIce:
          average(playerRows.map((row) => row.pp_toi_per_game)) ??
          average(playerRows.map((row) => row.pp_toi)),
        powerPlayGoals: sum(playerRows.map((row) => row.pp_goals)),
        powerPlayAssists: sum(playerRows.map((row) => row.pp_assists)),
        powerPlayPoints: sum(playerRows.map((row) => row.pp_points)),
        hits: sum(playerRows.map((row) => row.hits)),
        blocks: sum(playerRows.map((row) => row.blocked_shots)),
        penaltyMinutes: sum(playerRows.map((row) => row.penalty_minutes)),
        plusMinus: sum(playerRows.map((row) => row.plus_minus))
      } satisfies SkaterMetricsRow;
    })
    .sort(sortByBucketThenName);
};

export const buildSkaterAdvancedMetricsRows = (
  rows: SkaterGameRow[],
  weeklyAggregates: SkaterWeeklyAggregate[],
  valuationMode: SkaterValuationMode
): SkaterAdvancedMetricsRow[] => {
  const contextByPlayer = getLatestContextByPlayer(weeklyAggregates);

  return Array.from(groupRowsByPlayer(rows).entries())
    .map(([playerId, playerRows]) => {
      const sortedRows = [...playerRows].sort((a, b) =>
        String(a.date ?? "").localeCompare(String(b.date ?? ""))
      );
      const latestRow = sortedRows.at(-1) ?? sortedRows[0];
      const context = contextByPlayer.get(playerId);
      const gamesPlayed = sum(playerRows.map((row) => row.games_played ?? 1));
      const toiSeconds = sum(playerRows.map((row) => row.toi_per_game));
      const ppToiSeconds = sum(playerRows.map((row) => row.pp_toi));

      return {
        rowType: "player",
        playerId,
        playerName: latestRow.player_name ?? "Unknown Skater",
        team: getTeam(latestRow),
        valuation: getValuation(context, valuationMode),
        valuationLabel: getValuationLabel(valuationMode),
        bucket: context?.bucket ?? EMPTY_BUCKET,
        gamesPlayed,
        goalsPer60: per60(sum(playerRows.map((row) => row.goals)), toiSeconds),
        assistsPer60: per60(
          sum(playerRows.map((row) => row.assists)),
          toiSeconds
        ),
        pointsPer60: per60(
          sum(playerRows.map((row) => row.points)),
          toiSeconds
        ),
        shotsPer60: per60(sum(playerRows.map((row) => row.shots)), toiSeconds),
        powerPlayGoalsPer60: per60(
          sum(playerRows.map((row) => row.pp_goals)),
          ppToiSeconds
        ),
        powerPlayAssistsPer60: per60(
          sum(playerRows.map((row) => row.pp_assists)),
          ppToiSeconds
        ),
        powerPlayPointsPer60: per60(
          sum(playerRows.map((row) => row.pp_points)),
          ppToiSeconds
        ),
        hitsPer60: per60(sum(playerRows.map((row) => row.hits)), toiSeconds),
        blocksPer60: per60(
          sum(playerRows.map((row) => row.blocked_shots)),
          toiSeconds
        ),
        penaltyMinutesPer60: per60(
          sum(playerRows.map((row) => row.penalty_minutes)),
          toiSeconds
        ),
        corsiForPer60:
          average(playerRows.map((row) => row.nst_oi_cf_per_60)) ??
          average(playerRows.map((row) => row.individual_sat_for_per_60)),
        individualPointPercentage: average(
          playerRows.map((row) => row.nst_ipp)
        ),
        individualExpectedGoalsPer60: average(
          playerRows.map((row) => row.nst_ixg_per_60)
        )
      } satisfies SkaterAdvancedMetricsRow;
    })
    .sort(sortByBucketThenName);
};

const averageWeekCounts = (rows: SkaterValueOverviewRow[]) => {
  if (rows.length === 0) {
    return {
      Elite: 0,
      Quality: 0,
      Average: 0,
      Bad: 0,
      "Really Bad": 0
    };
  }

  return {
    Elite: average(rows.map((row) => row.weekCounts.Elite)) ?? 0,
    Quality: average(rows.map((row) => row.weekCounts.Quality)) ?? 0,
    Average: average(rows.map((row) => row.weekCounts.Average)) ?? 0,
    Bad: average(rows.map((row) => row.weekCounts.Bad)) ?? 0,
    "Really Bad": average(rows.map((row) => row.weekCounts["Really Bad"])) ?? 0
  };
};

export const buildSkaterValueOverviewBucketAverageRows = (
  rows: SkaterValueOverviewRow[]
): SkaterValueOverviewRow[] => {
  const playerRows = rows.filter((row) => row.rowType === "player");
  const byBucket = new Map<string, SkaterValueOverviewRow[]>();

  playerRows.forEach((row) => {
    const bucketRows = byBucket.get(row.bucket.key) ?? [];
    bucketRows.push(row);
    byBucket.set(row.bucket.key, bucketRows);
  });

  return Array.from(byBucket.values()).map((bucketRows) => {
    const firstRow = bucketRows[0];

    return {
      rowType: "bucket-average",
      playerName: `${firstRow.bucket.label} Avg`,
      team: "",
      tier: firstRow.bucket.label,
      valuation: average(bucketRows.map((row) => row.valuation)),
      valuationLabel: firstRow.valuationLabel,
      bucket: firstRow.bucket,
      weekCounts: averageWeekCounts(bucketRows),
      percentOkWeeks: average(bucketRows.map((row) => row.percentOkWeeks)) ?? 0,
      percentGoodWeeks:
        average(bucketRows.map((row) => row.percentGoodWeeks)) ?? 0,
      weeklyVariance: average(bucketRows.map((row) => row.weeklyVariance)) ?? 0,
      gameToGameVariance:
        average(bucketRows.map((row) => row.gameToGameVariance)) ?? 0,
      averageFantasyPointsPerGame: average(
        bucketRows.map((row) => row.averageFantasyPointsPerGame)
      ),
      averageFantasyPointsPerWeek:
        average(bucketRows.map((row) => row.averageFantasyPointsPerWeek)) ?? 0,
      fantasyPointsAboveAverage:
        average(bucketRows.map((row) => row.fantasyPointsAboveAverage)) ?? 0,
      gamesPlayed: average(bucketRows.map((row) => row.gamesPlayed)) ?? 0,
      totalFantasyPoints:
        average(bucketRows.map((row) => row.totalFantasyPoints)) ?? 0
    };
  });
};

export const withSkaterValueOverviewBucketAverages = (
  rows: SkaterValueOverviewRow[]
) =>
  [...rows, ...buildSkaterValueOverviewBucketAverageRows(rows)].sort(
    sortByBucketThenName
  );

export const buildSkaterMetricsBucketAverageRows = (
  rows: SkaterMetricsRow[]
): SkaterMetricsRow[] => {
  const playerRows = rows.filter((row) => row.rowType === "player");
  const byBucket = new Map<string, SkaterMetricsRow[]>();

  playerRows.forEach((row) => {
    const bucketRows = byBucket.get(row.bucket.key) ?? [];
    bucketRows.push(row);
    byBucket.set(row.bucket.key, bucketRows);
  });

  return Array.from(byBucket.values()).map((bucketRows) => {
    const firstRow = bucketRows[0];

    return {
      rowType: "bucket-average",
      playerName: `${firstRow.bucket.label} Avg`,
      team: "",
      valuation: average(bucketRows.map((row) => row.valuation)),
      valuationLabel: firstRow.valuationLabel,
      bucket: firstRow.bucket,
      gamesPlayed: average(bucketRows.map((row) => row.gamesPlayed)) ?? 0,
      averageTimeOnIce: average(bucketRows.map((row) => row.averageTimeOnIce)),
      goals: average(bucketRows.map((row) => row.goals)) ?? 0,
      assists: average(bucketRows.map((row) => row.assists)) ?? 0,
      points: average(bucketRows.map((row) => row.points)) ?? 0,
      shots: average(bucketRows.map((row) => row.shots)) ?? 0,
      shootingPercentage: average(
        bucketRows.map((row) => row.shootingPercentage)
      ),
      averagePowerPlayTimeOnIce: average(
        bucketRows.map((row) => row.averagePowerPlayTimeOnIce)
      ),
      powerPlayGoals:
        average(bucketRows.map((row) => row.powerPlayGoals)) ?? 0,
      powerPlayAssists:
        average(bucketRows.map((row) => row.powerPlayAssists)) ?? 0,
      powerPlayPoints:
        average(bucketRows.map((row) => row.powerPlayPoints)) ?? 0,
      hits: average(bucketRows.map((row) => row.hits)) ?? 0,
      blocks: average(bucketRows.map((row) => row.blocks)) ?? 0,
      penaltyMinutes:
        average(bucketRows.map((row) => row.penaltyMinutes)) ?? 0,
      plusMinus: average(bucketRows.map((row) => row.plusMinus)) ?? 0
    };
  });
};

export const withSkaterMetricsBucketAverages = (rows: SkaterMetricsRow[]) =>
  [...rows, ...buildSkaterMetricsBucketAverageRows(rows)].sort(
    sortByBucketThenName
  );
