import type { GoalieRanking, GoalieValueTier } from "./goalieTypes";

export type GoalieAdvancedStrength =
  | "all"
  | "5v5"
  | "ev"
  | "pk"
  | "pp";

export interface GoalieAdvancedStrengthOption {
  value: GoalieAdvancedStrength;
  label: string;
  prefix: `nst_${GoalieAdvancedStrength}_counts`;
}

export interface GoalieAdvancedMetricsRow {
  playerId: number;
  goalieName: string;
  team?: string;
  gamesPlayed: number;
  gamesStarted: number;
  qualityStartsPct: number | null;
  strengths: Record<
    GoalieAdvancedStrength,
    {
      gsaa: number | null;
      xgAgainst: number | null;
      xgAgainstPer60: number | null;
      hdShotsAgainstPer60: number | null;
      shotsAgainstPer60: number | null;
      reboundAttemptsAgainstPer60: number | null;
      rushAttemptsAgainstPer60: number | null;
      avgShotDistance: number | null;
      avgGoalDistance: number | null;
    }
  >;
}

export const GOALIE_ADVANCED_STRENGTH_OPTIONS: GoalieAdvancedStrengthOption[] = [
  { value: "all", label: "All Situations", prefix: "nst_all_counts" },
  { value: "5v5", label: "5v5", prefix: "nst_5v5_counts" },
  { value: "ev", label: "Even Strength", prefix: "nst_ev_counts" },
  { value: "pk", label: "PK", prefix: "nst_pk_counts" },
  { value: "pp", label: "PP", prefix: "nst_pp_counts" }
];

type GoalieStatsUnifiedRow = Record<string, number | string | null | boolean>;

const ADVANCED_STRENGTH_SELECT_FIELDS = GOALIE_ADVANCED_STRENGTH_OPTIONS.flatMap(
  ({ prefix }) => [
    `${prefix}_toi`,
    `${prefix}_gsaa`,
    `${prefix}_xg_against`,
    `${prefix}_goals_against`,
    `${prefix}_hd_shots_against`,
    `${prefix}_shots_against`,
    `${prefix}_rebound_attempts_against`,
    `${prefix}_rush_attempts_against`,
    `${prefix}_avg_shot_distance`,
    `${prefix}_avg_goal_distance`
  ]
);

export const GOALIE_ADVANCED_METRICS_SELECT = [
  "player_id",
  "player_name",
  "games_played",
  "games_started",
  "quality_start",
  ...ADVANCED_STRENGTH_SELECT_FIELDS
].join(",");

const finiteOrZero = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const finiteOrNull = (value: number) => (Number.isFinite(value) ? value : null);

const sumField = (rows: GoalieStatsUnifiedRow[], field: string) => {
  let total = 0;
  let hasValue = false;

  rows.forEach((row) => {
    const value = row[field];
    if (typeof value === "number" && Number.isFinite(value)) {
      total += value;
      hasValue = true;
    }
  });

  return { total, hasValue };
};

const sumFieldOrNull = (rows: GoalieStatsUnifiedRow[], field: string) => {
  const { total, hasValue } = sumField(rows, field);
  return hasValue ? total : null;
};

const per60 = (value: number, toiMinutes: number) =>
  toiMinutes > 0 ? finiteOrNull((value / toiMinutes) * 60) : null;

const per60OrNull = (value: number | null, toi: number) =>
  value === null ? null : per60(value, toi);

const weightedAverageField = (
  rows: GoalieStatsUnifiedRow[],
  valueField: string,
  weightField: string
) => {
  let weightedTotal = 0;
  let weightTotal = 0;

  rows.forEach((row) => {
    const value = row[valueField];
    const weight = row[weightField];

    if (
      typeof value === "number" &&
      Number.isFinite(value) &&
      typeof weight === "number" &&
      Number.isFinite(weight) &&
      weight > 0
    ) {
      weightedTotal += value * weight;
      weightTotal += weight;
    }
  });

  return weightTotal > 0 ? finiteOrNull(weightedTotal / weightTotal) : null;
};

export const buildGoalieAdvancedMetricsRows = (
  rows: GoalieStatsUnifiedRow[]
): GoalieAdvancedMetricsRow[] => {
  const byGoalie = new Map<number, GoalieStatsUnifiedRow[]>();

  rows.forEach((row) => {
    const playerId = finiteOrZero(row.player_id);
    if (!playerId) {
      return;
    }

    const goalieRows = byGoalie.get(playerId) ?? [];
    goalieRows.push(row);
    byGoalie.set(playerId, goalieRows);
  });

  return Array.from(byGoalie.entries())
    .map(([playerId, goalieRows]) => {
      const firstRow = goalieRows[0] ?? {};
      const gamesStarted = goalieRows.reduce(
        (sum, row) => sum + finiteOrZero(row.games_started),
        0
      );
      const qualityStarts = goalieRows.reduce(
        (sum, row) => sum + finiteOrZero(row.quality_start),
        0
      );

      const strengths = GOALIE_ADVANCED_STRENGTH_OPTIONS.reduce(
        (acc, strength) => {
          const { prefix, value } = strength;
          const toi = sumField(goalieRows, `${prefix}_toi`).total;
          const xgAgainst = sumFieldOrNull(
            goalieRows,
            `${prefix}_xg_against`
          );
          const hdShotsAgainst = sumFieldOrNull(
            goalieRows,
            `${prefix}_hd_shots_against`
          );
          const shotsAgainst = sumFieldOrNull(
            goalieRows,
            `${prefix}_shots_against`
          );
          const reboundAttemptsAgainst = sumFieldOrNull(
            goalieRows,
            `${prefix}_rebound_attempts_against`
          );
          const rushAttemptsAgainst = sumFieldOrNull(
            goalieRows,
            `${prefix}_rush_attempts_against`
          );

          acc[value] = {
            gsaa: sumFieldOrNull(goalieRows, `${prefix}_gsaa`),
            xgAgainst,
            xgAgainstPer60: per60OrNull(xgAgainst, toi),
            hdShotsAgainstPer60: per60OrNull(hdShotsAgainst, toi),
            shotsAgainstPer60: per60OrNull(shotsAgainst, toi),
            reboundAttemptsAgainstPer60: per60OrNull(
              reboundAttemptsAgainst,
              toi
            ),
            rushAttemptsAgainstPer60: per60OrNull(rushAttemptsAgainst, toi),
            avgShotDistance: weightedAverageField(
              goalieRows,
              `${prefix}_avg_shot_distance`,
              `${prefix}_shots_against`
            ),
            avgGoalDistance: weightedAverageField(
              goalieRows,
              `${prefix}_avg_goal_distance`,
              `${prefix}_goals_against`
            )
          };

          return acc;
        },
        {} as GoalieAdvancedMetricsRow["strengths"]
      );

      return {
        playerId,
        goalieName:
          typeof firstRow.player_name === "string"
            ? firstRow.player_name
            : "Unknown Goalie",
        gamesPlayed: goalieRows.reduce(
          (sum, row) => sum + finiteOrZero(row.games_played),
          0
        ),
        gamesStarted,
        qualityStartsPct:
          gamesStarted > 0 ? finiteOrNull(qualityStarts / gamesStarted) : null,
        strengths
      };
    })
    .sort((a, b) => a.goalieName.localeCompare(b.goalieName));
};

export interface GoalieMetricsRow {
  goalieId: number;
  goalieName: string;
  team: string;
  value: string;
  metricLabel: string;
  metricLabelTitle?: string;
}

export interface GoalieMetricsGroup {
  title: string;
  description: string;
  rows: GoalieMetricsRow[];
}

const toFiniteNumber = (value: number | undefined | null) =>
  Number.isFinite(value) ? Number(value) : 0;

const average = (values: number[]) => {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const percentile = (
  value: number,
  values: number[],
  direction: "larger" | "smaller"
) => {
  const validValues = values.filter((entry) => Number.isFinite(entry));

  if (!Number.isFinite(value) || validValues.length === 0) {
    return 0;
  }

  const sorted = [...validValues].sort((a, b) => a - b);
  const below = sorted.filter((entry) => entry < value).length;
  const equal = sorted.filter((entry) => entry === value).length;
  let score = ((below + 0.5 * equal) / sorted.length) * 100;

  if (direction === "smaller") {
    score = 100 - score;
  }

  return score;
};

const topRows = (
  rows: GoalieRanking[],
  compare: (a: GoalieRanking, b: GoalieRanking) => number,
  metricLabel: string,
  valueFormatter: (goalie: GoalieRanking) => string,
  metricLabelTitle?: string
) =>
  [...rows]
    .sort(compare)
    .slice(0, 3)
    .map((goalie) => ({
      goalieId: goalie.playerId,
      goalieName: goalie.goalieFullName ?? "N/A",
      team: goalie.team ?? "N/A",
      value: valueFormatter(goalie),
      metricLabel,
      metricLabelTitle
    }));

export const buildGoalieMetricsGroups = (
  goalieRankings: GoalieRanking[]
): GoalieMetricsGroup[] => {
  if (goalieRankings.length === 0) {
    return [];
  }

  const goaliesWithFiniteValues = goalieRankings.filter(
    (goalie) =>
      Number.isFinite(goalie.averageFantasyPointsPerGame) ||
      Number.isFinite(goalie.wowVariance) ||
      Number.isFinite(goalie.gogVariance) ||
      Number.isFinite(goalie.totalGamesPlayed)
  );

  const fantasyValues = goaliesWithFiniteValues.map((goalie) =>
    toFiniteNumber(goalie.averageFantasyPointsPerGame)
  );
  const fantasyDeltaValues = goaliesWithFiniteValues.map((goalie) =>
    toFiniteNumber(goalie.fantasyPointsAboveAverage)
  );
  const wowVarianceValues = goaliesWithFiniteValues.map((goalie) =>
    toFiniteNumber(goalie.wowVariance)
  );
  const gogVarianceValues = goaliesWithFiniteValues.map((goalie) =>
    toFiniteNumber(goalie.gogVariance)
  );
  const gamesPlayedValues = goaliesWithFiniteValues.map((goalie) =>
    toFiniteNumber(goalie.totalGamesPlayed)
  );
  const gamesStartedValues = goaliesWithFiniteValues.map((goalie) =>
    toFiniteNumber(goalie.totalGamesStarted)
  );
  const totalPointValues = goaliesWithFiniteValues.map((goalie) =>
    toFiniteNumber(goalie.totalPoints)
  );

  return [
    {
      title: "Fantasy Production",
      description:
        "Highest average fantasy points per game in the current filtered set.",
      rows: topRows(
        goaliesWithFiniteValues,
        (a, b) =>
          toFiniteNumber(b.averageFantasyPointsPerGame) -
          toFiniteNumber(a.averageFantasyPointsPerGame),
        "Avg fPts/G",
        (goalie) => toFiniteNumber(goalie.averageFantasyPointsPerGame).toFixed(2),
        "Higher average fantasy points per game is better."
      )
    },
    {
      title: "Consistency",
      description: "Lowest combined volatility across weekly and game scoring.",
      rows: topRows(
        goaliesWithFiniteValues,
        (a, b) =>
          toFiniteNumber(a.wowVariance) +
          toFiniteNumber(a.gogVariance) -
          (toFiniteNumber(b.wowVariance) + toFiniteNumber(b.gogVariance)),
        "Std Dev",
        (goalie) =>
          `${(toFiniteNumber(goalie.wowVariance) + toFiniteNumber(goalie.gogVariance)).toFixed(
            2
          )}`,
        "Lower combined standard deviation is better."
      )
    },
    {
      title: "Workload",
      description: "Goalies with the strongest start volume and ice-time load.",
      rows: topRows(
        goaliesWithFiniteValues,
        (a, b) =>
          toFiniteNumber(b.totalGamesPlayed) - toFiniteNumber(a.totalGamesPlayed) ||
          toFiniteNumber(b.totalTimeOnIce) - toFiniteNumber(a.totalTimeOnIce),
        "GP",
        (goalie) =>
          `${toFiniteNumber(goalie.totalGamesPlayed)} GP · ${toFiniteNumber(
            goalie.totalTimeOnIce
          ).toFixed(1)} min`,
        "Higher workload suggests a stronger start-volume profile."
      )
    },
    {
      title: "Recent Form",
      description: "Goalies with the strongest current-period ranking output.",
      rows: topRows(
        goaliesWithFiniteValues,
        (a, b) =>
          toFiniteNumber(b.totalPoints) - toFiniteNumber(a.totalPoints) ||
          toFiniteNumber(b.percentGoodWeeks) - toFiniteNumber(a.percentGoodWeeks),
        "WoW Pts",
        (goalie) =>
          `${toFiniteNumber(goalie.totalPoints)} pts · ${toFiniteNumber(
            goalie.percentGoodWeeks
          ).toFixed(1)}% good weeks`,
        "Higher ranking points and a higher good-week rate are better."
      )
    }
  ];
};

export interface GoalieLeaderboardColumn {
  label: string;
  width: string;
  sortKey: keyof GoalieRanking;
  infoTitle?: string;
}

export type GoalieVarianceDisplayMode = "raw" | "relative";

export interface GoalieVarianceAverages {
  wowVariance: number | null;
  gogVariance: number | null;
}

export const buildGoalieVarianceAverages = (
  goalieRankings: GoalieRanking[]
): GoalieVarianceAverages => {
  const averageOrNull = (values: Array<number | undefined>) => {
    const validValues = values.filter((value): value is number =>
      Number.isFinite(value)
    );

    return validValues.length > 0 ? average(validValues) : null;
  };

  return {
    wowVariance: averageOrNull(
      goalieRankings.map((goalie) => goalie.wowVariance)
    ),
    gogVariance: averageOrNull(
      goalieRankings.map((goalie) => goalie.gogVariance)
    )
  };
};

export const formatGoalieVarianceValue = (
  value: number | undefined,
  averageValue: number | null,
  varianceDisplayMode: GoalieVarianceDisplayMode
) => {
  if (value == null || !Number.isFinite(value)) {
    return "N/A";
  }

  if (varianceDisplayMode === "relative") {
    if (averageValue == null || !Number.isFinite(averageValue)) {
      return "N/A";
    }

    const delta = value - averageValue;
    return `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`;
  }

  return value.toFixed(2);
};

export const getGoalieLeaderboardColumns = (
  varianceDisplayMode: GoalieVarianceDisplayMode
): GoalieLeaderboardColumn[] => [
  { label: "Rank", width: "4%", sortKey: "totalPoints" },
  { label: "Name", width: "10%", sortKey: "goalieFullName" },
  { label: "Team", width: "5%", sortKey: "team" },
  {
    label: "Value Tier",
    width: "7%",
    sortKey: "valueTierScore",
    infoTitle:
      "Relative value tier for the current filtered population. Uses fantasy production, consistency, workload, and start confidence."
  },
  { label: "WoW Pts", width: "5%", sortKey: "totalPoints" },
  { label: "Elite Wk", width: "5%", sortKey: "eliteWeeks" },
  { label: "Quality", width: "5%", sortKey: "qualityWeeks" },
  { label: "AVG", width: "5%", sortKey: "averageWeeks" },
  { label: "BAD", width: "5%", sortKey: "badWeeks" },
  { label: "Really Bad", width: "5%", sortKey: "reallyBadWeeks" },
  { label: "% OK WKs", width: "5%", sortKey: "percentAcceptableWeeks" },
  { label: "% Good WKs", width: "5%", sortKey: "percentGoodWeeks" },
  {
    label: varianceDisplayMode === "relative" ? "WoW Δ vs Avg" : "WoW Std Dev",
    width: "6%",
    sortKey: "wowVariance",
    infoTitle:
      varianceDisplayMode === "relative"
        ? "Difference from the filtered average week-over-week standard deviation. Lower relative deltas indicate more consistency."
        : "Week-over-week standard deviation of ranking points. Lower values indicate more consistency."
  },
  {
    label: varianceDisplayMode === "relative" ? "Game Δ vs Avg" : "Game Std Dev",
    width: "6%",
    sortKey: "gogVariance",
    infoTitle:
      varianceDisplayMode === "relative"
        ? "Difference from the filtered average game standard deviation. Lower relative deltas indicate more consistency."
        : "Game-over-game standard deviation of fantasy points. Lower values indicate more consistency."
  },
  { label: "Avg fPts/G", width: "5%", sortKey: "averageFantasyPointsPerGame" },
  {
    label: "+/- Lg Avg fPts",
    width: "5%",
    sortKey: "fantasyPointsAboveAverage",
    infoTitle: "Goalie average fantasy points per game versus the filtered league average."
  },
  {
    label: "Percentile Rank",
    width: "5%",
    sortKey: "averagePercentileRank",
    infoTitle: "Average percentile rank across the visible stat set."
  },
  { label: "GP", width: "4%", sortKey: "totalGamesPlayed" },
  { label: "SV%", width: "5%", sortKey: "overallSavePct" },
  { label: "GAA", width: "5%", sortKey: "overallGaa" }
];

export const buildGoalieValueTierMap = (
  goalieRankings: GoalieRanking[],
  advancedMetricsRows: GoalieAdvancedMetricsRow[] = []
) => {
  const goaliesWithFiniteValues = goalieRankings.filter(
    (goalie) =>
      Number.isFinite(goalie.averageFantasyPointsPerGame) ||
      Number.isFinite(goalie.wowVariance) ||
      Number.isFinite(goalie.gogVariance) ||
      Number.isFinite(goalie.totalGamesPlayed)
  );

  const fantasyValues = goaliesWithFiniteValues.map((goalie) =>
    toFiniteNumber(goalie.averageFantasyPointsPerGame)
  );
  const fantasyDeltaValues = goaliesWithFiniteValues.map((goalie) =>
    toFiniteNumber(goalie.fantasyPointsAboveAverage)
  );
  const wowVarianceValues = goaliesWithFiniteValues.map((goalie) =>
    toFiniteNumber(goalie.wowVariance)
  );
  const gogVarianceValues = goaliesWithFiniteValues.map((goalie) =>
    toFiniteNumber(goalie.gogVariance)
  );
  const gamesPlayedValues = goaliesWithFiniteValues.map((goalie) =>
    toFiniteNumber(goalie.totalGamesPlayed)
  );
  const gamesStartedValues = goaliesWithFiniteValues.map((goalie) =>
    toFiniteNumber(goalie.totalGamesStarted)
  );
  const timeOnIceValues = goaliesWithFiniteValues.map((goalie) =>
    toFiniteNumber(goalie.totalTimeOnIce)
  );
  const acceptableWeekValues = goaliesWithFiniteValues.map((goalie) =>
    toFiniteNumber(goalie.percentAcceptableWeeks)
  );
  const advancedMetricsByGoalieId = new Map(
    advancedMetricsRows.map((row) => [row.playerId, row])
  );
  const qualityStartPctValues = goaliesWithFiniteValues
    .map(
      (goalie) =>
        advancedMetricsByGoalieId.get(goalie.playerId)?.qualityStartsPct
    )
    .filter((value): value is number => Number.isFinite(value));

  const scoreParts = (goalie: GoalieRanking) => {
    const qualityStartsPct =
      advancedMetricsByGoalieId.get(goalie.playerId)?.qualityStartsPct;
    const startConfidenceParts = [
      percentile(
        toFiniteNumber(goalie.totalGamesStarted),
        gamesStartedValues,
        "larger"
      ),
      percentile(
        toFiniteNumber(goalie.percentAcceptableWeeks),
        acceptableWeekValues,
        "larger"
      )
    ];

    if (
      typeof qualityStartsPct === "number" &&
      Number.isFinite(qualityStartsPct)
    ) {
      startConfidenceParts.push(
        percentile(qualityStartsPct, qualityStartPctValues, "larger")
      );
    }

    return {
      fantasyScore: average([
        percentile(
          toFiniteNumber(goalie.averageFantasyPointsPerGame),
          fantasyValues,
          "larger"
        ),
        percentile(
          toFiniteNumber(goalie.fantasyPointsAboveAverage),
          fantasyDeltaValues,
          "larger"
        )
      ]),
      consistencyScore: average([
        percentile(
          toFiniteNumber(goalie.wowVariance),
          wowVarianceValues,
          "smaller"
        ),
        percentile(
          toFiniteNumber(goalie.gogVariance),
          gogVarianceValues,
          "smaller"
        )
      ]),
      workloadScore: average([
        percentile(
          toFiniteNumber(goalie.totalGamesPlayed),
          gamesPlayedValues,
          "larger"
        ),
        percentile(
          toFiniteNumber(goalie.totalTimeOnIce),
          timeOnIceValues,
          "larger"
        )
      ]),
      startConfidenceScore: average(startConfidenceParts)
    };
  };

  const scoreForGoalie = (goalie: GoalieRanking) => {
    const {
      fantasyScore,
      consistencyScore,
      workloadScore,
      startConfidenceScore
    } = scoreParts(goalie);

    return (
      fantasyScore * 0.35 +
      consistencyScore * 0.25 +
      workloadScore * 0.2 +
      startConfidenceScore * 0.2
    );
  };

  const tierForScore = (score: number): GoalieValueTier => {
    if (score >= 85) return "Tier 1";
    if (score >= 70) return "Tier 2";
    if (score >= 55) return "Tier 3";
    if (score >= 40) return "Tier 4";
    return "Tier 5";
  };

  return new Map(
    goaliesWithFiniteValues.map((goalie) => {
      const score = scoreForGoalie(goalie);
      return [
        goalie.playerId,
        {
          score,
          tier: tierForScore(score)
        }
      ] as const;
    })
  );
};

export const applyGoalieValueTiers = (
  goalieRankings: GoalieRanking[],
  advancedMetricsRows: GoalieAdvancedMetricsRow[] = []
): GoalieRanking[] => {
  const valueTierByGoalieId = buildGoalieValueTierMap(
    goalieRankings,
    advancedMetricsRows
  );

  return goalieRankings.map((goalie) => {
    const valueTier = valueTierByGoalieId.get(goalie.playerId);

    return {
      ...goalie,
      valueTier: valueTier?.tier,
      valueTierScore: valueTier?.score
    };
  });
};
