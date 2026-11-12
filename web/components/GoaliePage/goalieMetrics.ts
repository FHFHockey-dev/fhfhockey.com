import type { GoalieRanking, GoalieValueTier } from "./goalieTypes";

export type GoalieAdvancedStrength = "all" | "5v5" | "ev" | "pk" | "pp";

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

export const GOALIE_ADVANCED_STRENGTH_OPTIONS: GoalieAdvancedStrengthOption[] =
  [
    { value: "all", label: "All Situations", prefix: "nst_all_counts" },
    { value: "5v5", label: "5v5", prefix: "nst_5v5_counts" },
    { value: "ev", label: "Even Strength", prefix: "nst_ev_counts" },
    { value: "pk", label: "PK", prefix: "nst_pk_counts" },
    { value: "pp", label: "PP", prefix: "nst_pp_counts" },
  ];

type GoalieStatsUnifiedRow = Record<string, number | string | null | boolean>;

const ADVANCED_STRENGTH_SELECT_FIELDS =
  GOALIE_ADVANCED_STRENGTH_OPTIONS.flatMap(({ prefix }) => [
    `${prefix}_toi`,
    `${prefix}_xg_against`,
    `${prefix}_goals_against`,
    `${prefix}_hd_shots_against`,
    `${prefix}_shots_against`,
    `${prefix}_rebound_attempts_against`,
    `${prefix}_rush_attempts_against`,
    `${prefix}_avg_shot_distance`,
    `${prefix}_avg_goal_distance`,
  ]);

export const GOALIE_ADVANCED_METRICS_SELECT = [
  "player_id",
  "player_name",
  "date",
  "games_played",
  "games_started",
  "quality_start",
  ...ADVANCED_STRENGTH_SELECT_FIELDS,
].join(",");

/** Rows per request; PostgREST caps a response, so the reader pages. */
export const GOALIE_ADVANCED_METRICS_PAGE_SIZE = 1000;

type GoalieAdvancedMetricsClient = { from: (table: string) => any };

/**
 * Advanced goalie rows for exactly the selected window (PR-U1): season and
 * date bounds, keyed order, paged until a short page, so the value tier and
 * the table never mix season-wide rows with a date-filtered leaderboard.
 */
export async function fetchGoalieAdvancedMetricsRows(
  client: GoalieAdvancedMetricsClient,
  seasonId: number,
  window: { startDate: string; endDate: string },
  pageSize: number = GOALIE_ADVANCED_METRICS_PAGE_SIZE,
): Promise<GoalieStatsUnifiedRow[]> {
  const rows: GoalieStatsUnifiedRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from("goalie_stats_unified")
      .select(GOALIE_ADVANCED_METRICS_SELECT)
      .eq("season_id", seasonId)
      .gte("date", window.startDate)
      .lte("date", window.endDate)
      .order("date", { ascending: true })
      .order("player_id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) {
      throw error;
    }
    const page = (data ?? []) as GoalieStatsUnifiedRow[];
    rows.push(...page);
    if (page.length < pageSize) {
      return rows;
    }
  }
}

const finiteOrZero = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const finiteOrNull = (value: number) => (Number.isFinite(value) ? value : null);

const knownNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/**
 * Window total of a count, unknown when any game's value is unknown
 * (rule 13: never keep exposure for a game whose count is missing).
 */
const completeSum = (rows: GoalieStatsUnifiedRow[], field: string) => {
  let total = 0;
  for (const row of rows) {
    const value = knownNumber(row[field]);
    if (value === null) {
      return null;
    }
    total += value;
  }
  return rows.length ? total : null;
};

/**
 * Per-60 from per-game (count, TOI) pairs. Unit adapter (rule 17): the NST
 * `nst_*_counts_toi` fields are minutes. Unknown when any game lacks either.
 */
const pairedPer60 = (
  rows: GoalieStatsUnifiedRow[],
  countField: string,
  toiMinutesField: string,
) => {
  const count = completeSum(rows, countField);
  const minutes = completeSum(rows, toiMinutesField);
  return count === null || minutes === null || minutes <= 0
    ? null
    : finiteOrNull((count / minutes) * 60);
};

/**
 * League SV% at one strength over the fetched window: pooled saves over pooled
 * shots from every row with both shots and goals against known.
 */
const leagueSavePct = (rows: GoalieStatsUnifiedRow[], prefix: string) => {
  let shots = 0;
  let goals = 0;
  rows.forEach((row) => {
    const sa = knownNumber(row[`${prefix}_shots_against`]);
    const ga = knownNumber(row[`${prefix}_goals_against`]);
    if (sa !== null && ga !== null) {
      shots += sa;
      goals += ga;
    }
  });
  return shots > 0 ? 1 - goals / shots : null;
};

/**
 * GSAA = SA × (1 − league SV%) − GA at the window aggregate (decision 10),
 * never a sum of per-game GSAA. Unknown when any game lacks SA or GA.
 */
const windowGsaa = (
  goalieRows: GoalieStatsUnifiedRow[],
  prefix: string,
  leagueSv: number | null,
) => {
  const shotsAgainst = completeSum(goalieRows, `${prefix}_shots_against`);
  const goalsAgainst = completeSum(goalieRows, `${prefix}_goals_against`);
  return leagueSv === null || shotsAgainst === null || goalsAgainst === null
    ? null
    : finiteOrNull(shotsAgainst * (1 - leagueSv) - goalsAgainst);
};

/**
 * Quality starts over starts (decision 40 credits the starter only). A start
 * whose quality-start result is unknown makes the window rate unknown, never a
 * failed start (PR-U2).
 */
const qualityStartsPct = (goalieRows: GoalieStatsUnifiedRow[]) => {
  const starts = goalieRows.filter(
    (row) => (knownNumber(row.games_started) ?? 0) >= 1,
  );
  const qualityStarts = completeSum(starts, "quality_start");
  return qualityStarts === null
    ? null
    : finiteOrNull(qualityStarts / starts.length);
};

const weightedAverageField = (
  rows: GoalieStatsUnifiedRow[],
  valueField: string,
  weightField: string,
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
  rows: GoalieStatsUnifiedRow[],
): GoalieAdvancedMetricsRow[] => {
  const byGoalie = new Map<number, GoalieStatsUnifiedRow[]>();
  const leagueSvByPrefix = new Map(
    GOALIE_ADVANCED_STRENGTH_OPTIONS.map(({ prefix }) => [
      prefix,
      leagueSavePct(rows, prefix),
    ]),
  );

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
        0,
      );

      const strengths = GOALIE_ADVANCED_STRENGTH_OPTIONS.reduce(
        (acc, strength) => {
          const { prefix, value } = strength;
          const toiField = `${prefix}_toi`;

          acc[value] = {
            gsaa: windowGsaa(goalieRows, prefix, leagueSvByPrefix.get(prefix) ?? null),
            xgAgainst: completeSum(goalieRows, `${prefix}_xg_against`),
            xgAgainstPer60: pairedPer60(goalieRows, `${prefix}_xg_against`, toiField),
            hdShotsAgainstPer60: pairedPer60(
              goalieRows,
              `${prefix}_hd_shots_against`,
              toiField,
            ),
            shotsAgainstPer60: pairedPer60(
              goalieRows,
              `${prefix}_shots_against`,
              toiField,
            ),
            reboundAttemptsAgainstPer60: pairedPer60(
              goalieRows,
              `${prefix}_rebound_attempts_against`,
              toiField,
            ),
            rushAttemptsAgainstPer60: pairedPer60(
              goalieRows,
              `${prefix}_rush_attempts_against`,
              toiField,
            ),
            avgShotDistance: weightedAverageField(
              goalieRows,
              `${prefix}_avg_shot_distance`,
              `${prefix}_shots_against`,
            ),
            avgGoalDistance: weightedAverageField(
              goalieRows,
              `${prefix}_avg_goal_distance`,
              `${prefix}_goals_against`,
            ),
          };

          return acc;
        },
        {} as GoalieAdvancedMetricsRow["strengths"],
      );

      return {
        playerId,
        goalieName:
          typeof firstRow.player_name === "string"
            ? firstRow.player_name
            : "Unknown Goalie",
        gamesPlayed: goalieRows.reduce(
          (sum, row) => sum + finiteOrZero(row.games_played),
          0,
        ),
        gamesStarted,
        qualityStartsPct: qualityStartsPct(goalieRows),
        strengths,
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
  direction: "larger" | "smaller",
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
  metricLabelTitle?: string,
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
      metricLabelTitle,
    }));

export const buildGoalieMetricsGroups = (
  goalieRankings: GoalieRanking[],
): GoalieMetricsGroup[] => {
  if (goalieRankings.length === 0) {
    return [];
  }

  const goaliesWithFiniteValues = goalieRankings.filter(
    (goalie) =>
      Number.isFinite(goalie.averageFantasyPointsPerGame) ||
      Number.isFinite(goalie.wowVariance) ||
      Number.isFinite(goalie.gogVariance) ||
      Number.isFinite(goalie.totalGamesPlayed),
  );

  const fantasyValues = goaliesWithFiniteValues.map((goalie) =>
    toFiniteNumber(goalie.averageFantasyPointsPerGame),
  );
  const fantasyDeltaValues = goaliesWithFiniteValues.map((goalie) =>
    toFiniteNumber(goalie.fantasyPointsAboveAverage),
  );
  const wowVarianceValues = goaliesWithFiniteValues.map((goalie) =>
    toFiniteNumber(goalie.wowVariance),
  );
  const gogVarianceValues = goaliesWithFiniteValues.map((goalie) =>
    toFiniteNumber(goalie.gogVariance),
  );
  const gamesPlayedValues = goaliesWithFiniteValues.map((goalie) =>
    toFiniteNumber(goalie.totalGamesPlayed),
  );
  const gamesStartedValues = goaliesWithFiniteValues.map((goalie) =>
    toFiniteNumber(goalie.totalGamesStarted),
  );
  const totalPointValues = goaliesWithFiniteValues.map((goalie) =>
    toFiniteNumber(goalie.totalPoints),
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
        (goalie) =>
          toFiniteNumber(goalie.averageFantasyPointsPerGame).toFixed(2),
        "Higher average fantasy points per game is better.",
      ),
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
          `${(
            toFiniteNumber(goalie.wowVariance) +
            toFiniteNumber(goalie.gogVariance)
          ).toFixed(2)}`,
        "Lower combined standard deviation is better.",
      ),
    },
    {
      title: "Workload",
      description: "Goalies with the strongest start volume and ice-time load.",
      rows: topRows(
        goaliesWithFiniteValues,
        (a, b) =>
          toFiniteNumber(b.totalGamesPlayed) -
            toFiniteNumber(a.totalGamesPlayed) ||
          toFiniteNumber(b.totalTimeOnIce) - toFiniteNumber(a.totalTimeOnIce),
        "GP",
        (goalie) =>
          `${toFiniteNumber(goalie.totalGamesPlayed)} GP · ${toFiniteNumber(
            goalie.totalTimeOnIce,
          ).toFixed(1)} min`,
        "Higher workload suggests a stronger start-volume profile.",
      ),
    },
    {
      title: "Recent Form",
      description: "Goalies with the strongest current-period ranking output.",
      rows: topRows(
        goaliesWithFiniteValues,
        (a, b) =>
          toFiniteNumber(b.totalPoints) - toFiniteNumber(a.totalPoints) ||
          toFiniteNumber(b.percentGoodWeeks) -
            toFiniteNumber(a.percentGoodWeeks),
        "WoW Pts",
        (goalie) =>
          `${toFiniteNumber(goalie.totalPoints)} pts · ${toFiniteNumber(
            goalie.percentGoodWeeks,
          ).toFixed(1)}% good weeks`,
        "Higher ranking points and a higher good-week rate are better.",
      ),
    },
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
  goalieRankings: GoalieRanking[],
): GoalieVarianceAverages => {
  const averageOrNull = (values: Array<number | null | undefined>) => {
    const validValues = values.filter((value): value is number =>
      Number.isFinite(value),
    );

    return validValues.length > 0 ? average(validValues) : null;
  };

  return {
    wowVariance: averageOrNull(
      goalieRankings.map((goalie) => goalie.wowVariance),
    ),
    gogVariance: averageOrNull(
      goalieRankings.map((goalie) => goalie.gogVariance),
    ),
  };
};

export const formatGoalieVarianceValue = (
  value: number | null | undefined,
  averageValue: number | null,
  varianceDisplayMode: GoalieVarianceDisplayMode,
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
  varianceDisplayMode: GoalieVarianceDisplayMode,
): GoalieLeaderboardColumn[] => [
  { label: "Rank", width: "4%", sortKey: "totalPoints" },
  { label: "Name", width: "10%", sortKey: "goalieFullName" },
  { label: "Team", width: "5%", sortKey: "team" },
  {
    label: "Value Tier",
    width: "7%",
    sortKey: "valueTierScore",
    infoTitle:
      "Relative value tier among goalies at or above the value-tier start floor. Uses fantasy production, consistency, workload, and start confidence. Below the floor, or without two games and two graded weeks, it shows insufficient sample.",
  },
  {
    label: "Wks",
    width: "4%",
    sortKey: "eligibleWeeks",
    infoTitle:
      "Weeks played as a starter (at least one start and 20 minutes) that were graded against the starter average.",
  },
  { label: "WoW Pts", width: "5%", sortKey: "totalPoints" },
  { label: "Elite Wk", width: "5%", sortKey: "eliteWeeks" },
  { label: "Good", width: "5%", sortKey: "goodWeeks" },
  { label: "AVG", width: "5%", sortKey: "averageWeeks" },
  { label: "BAD", width: "5%", sortKey: "badWeeks" },
  { label: "Abysmal", width: "5%", sortKey: "abysmalWeeks" },
  { label: "% OK WKs", width: "5%", sortKey: "percentAcceptableWeeks" },
  { label: "% Good WKs", width: "5%", sortKey: "percentGoodWeeks" },
  {
    label: "Consistency",
    width: "5%",
    sortKey: "consistencyScore",
    infoTitle:
      "0-100 stability score across eligible weekly quality bands. Requires at least two classified weeks; higher means less week-to-week movement, independent of whether the level is good or bad.",
  },
  {
    label: "GS/Wk",
    width: "5%",
    sortKey: "averageStartsPerWeek",
    infoTitle:
      "Average starts per eligible week, separating workload from quality.",
  },
  {
    label: "Weekly Records",
    width: "8%",
    sortKey: "totalWins",
    infoTitle:
      "Most common weekly W-L/OT decision patterns (for example 3-2, 2-1, or 1-0).",
  },
  {
    label: varianceDisplayMode === "relative" ? "WoW Δ vs Avg" : "WoW Std Dev",
    width: "6%",
    sortKey: "wowVariance",
    infoTitle:
      varianceDisplayMode === "relative"
        ? "Difference from the filtered average week-over-week standard deviation. Lower relative deltas indicate more consistency."
        : "Week-over-week standard deviation of ranking points. Lower values indicate more consistency.",
  },
  {
    label:
      varianceDisplayMode === "relative" ? "Game Δ vs Avg" : "Game Std Dev",
    width: "6%",
    sortKey: "gogVariance",
    infoTitle:
      varianceDisplayMode === "relative"
        ? "Difference from the filtered average game standard deviation. Lower relative deltas indicate more consistency."
        : "Game-over-game standard deviation of fantasy points. Lower values indicate more consistency.",
  },
  { label: "Avg fPts/G", width: "5%", sortKey: "averageFantasyPointsPerGame" },
  {
    label: "+/- Lg Avg fPts",
    width: "5%",
    sortKey: "fantasyPointsAboveAverage",
    infoTitle:
      "Goalie average fantasy points per game versus the filtered league average.",
  },
  {
    label: "Percentile Rank",
    width: "5%",
    sortKey: "averagePercentileRank",
    infoTitle: "Average percentile rank across the visible stat set.",
  },
  { label: "GP", width: "4%", sortKey: "totalGamesPlayed" },
  { label: "SV%", width: "5%", sortKey: "overallSavePct" },
  { label: "GAA", width: "5%", sortKey: "overallGaa" },
];

/** Decision 98: a visible, user-lowerable default floor for the value tier. */
export const GOALIE_VALUE_TIER_DEFAULT_MIN_STARTS = 5;

const finiteValueOrNull = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/** Mean of component parts; unknown when any part is unknown (no rescaling). */
const averageOfKnown = (values: Array<number | null>) =>
  values.some((value) => value === null)
    ? null
    : average(values as number[]);

/**
 * Value tier over the qualified cohort (W2-2 D9, decision 98): goalies with at
 * least `minimumStarts` starts. Percentiles use only known values, a missing
 * input is unknown rather than 0, and a goalie below the floor or with an
 * unknown component (for example a spread from fewer than two games or weeks)
 * gets no tier and is marked "insufficient sample".
 */
export const buildGoalieValueTierMap = (
  goalieRankings: GoalieRanking[],
  advancedMetricsRows: GoalieAdvancedMetricsRow[] = [],
  minimumStarts: number = GOALIE_VALUE_TIER_DEFAULT_MIN_STARTS,
) => {
  const cohort = goalieRankings.filter(
    (goalie) => (goalie.totalGamesStarted ?? 0) >= minimumStarts,
  );
  const knownValues = (pick: (goalie: GoalieRanking) => number | null | undefined) =>
    cohort
      .map((goalie) => finiteValueOrNull(pick(goalie)))
      .filter((value): value is number => value !== null);
  const percentileOrNull = (
    value: number | null | undefined,
    values: number[],
    direction: "larger" | "smaller",
  ) => {
    const known = finiteValueOrNull(value);
    return known === null || values.length === 0
      ? null
      : percentile(known, values, direction);
  };

  const fantasyValues = knownValues((goalie) => goalie.averageFantasyPointsPerGame);
  const fantasyDeltaValues = knownValues((goalie) => goalie.fantasyPointsAboveAverage);
  const wowVarianceValues = knownValues((goalie) => goalie.wowVariance);
  const gogVarianceValues = knownValues((goalie) => goalie.gogVariance);
  const gamesPlayedValues = knownValues((goalie) => goalie.totalGamesPlayed);
  const gamesStartedValues = knownValues((goalie) => goalie.totalGamesStarted);
  const timeOnIceValues = knownValues((goalie) => goalie.totalTimeOnIce);
  const acceptableWeekValues = knownValues(
    (goalie) => goalie.percentAcceptableWeeks,
  );
  const advancedMetricsByGoalieId = new Map(
    advancedMetricsRows.map((row) => [row.playerId, row]),
  );
  const qualityStartPctValues = knownValues(
    (goalie) => advancedMetricsByGoalieId.get(goalie.playerId)?.qualityStartsPct,
  );

  const scoreForGoalie = (goalie: GoalieRanking) => {
    const qualityStartsPct = advancedMetricsByGoalieId.get(
      goalie.playerId,
    )?.qualityStartsPct;
    const startConfidenceParts = [
      percentileOrNull(goalie.totalGamesStarted, gamesStartedValues, "larger"),
      percentileOrNull(
        goalie.percentAcceptableWeeks,
        acceptableWeekValues,
        "larger",
      ),
    ];

    if (finiteValueOrNull(qualityStartsPct) !== null) {
      startConfidenceParts.push(
        percentileOrNull(qualityStartsPct, qualityStartPctValues, "larger"),
      );
    }

    const components = [
      averageOfKnown([
        percentileOrNull(goalie.averageFantasyPointsPerGame, fantasyValues, "larger"),
        percentileOrNull(goalie.fantasyPointsAboveAverage, fantasyDeltaValues, "larger"),
      ]),
      averageOfKnown([
        percentileOrNull(goalie.wowVariance, wowVarianceValues, "smaller"),
        percentileOrNull(goalie.gogVariance, gogVarianceValues, "smaller"),
      ]),
      averageOfKnown([
        percentileOrNull(goalie.totalGamesPlayed, gamesPlayedValues, "larger"),
        percentileOrNull(goalie.totalTimeOnIce, timeOnIceValues, "larger"),
      ]),
      averageOfKnown(startConfidenceParts),
    ];
    if (components.some((component) => component === null)) {
      return null;
    }
    const [fantasyScore, consistencyScore, workloadScore, startConfidenceScore] =
      components as number[];

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
    cohort.flatMap((goalie) => {
      const score = scoreForGoalie(goalie);
      return score === null
        ? []
        : [[goalie.playerId, { score, tier: tierForScore(score) }] as const];
    }),
  );
};

export const applyGoalieValueTiers = (
  goalieRankings: GoalieRanking[],
  advancedMetricsRows: GoalieAdvancedMetricsRow[] = [],
  minimumStarts: number = GOALIE_VALUE_TIER_DEFAULT_MIN_STARTS,
): GoalieRanking[] => {
  const valueTierByGoalieId = buildGoalieValueTierMap(
    goalieRankings,
    advancedMetricsRows,
    minimumStarts,
  );

  return goalieRankings.map((goalie) => {
    const valueTier = valueTierByGoalieId.get(goalie.playerId);

    return {
      ...goalie,
      valueTier: valueTier?.tier,
      valueTierScore: valueTier?.score,
      valueTierInsufficientSample: !valueTier,
    };
  });
};
