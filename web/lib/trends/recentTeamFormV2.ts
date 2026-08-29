import { buildLinearWeights, isOneGameTeamRow, type TeamGameRow } from "./ctpi";

export const RECENT_TEAM_FORM_V2_CANDIDATE_FORMULA_VERSION =
  "recent-team-form-v2-candidate";
export const RECENT_TEAM_FORM_V2_CANDIDATE_INPUT_VERSION =
  "ctpi-one-team-game-input-v3-candidate";

export const RECENT_TEAM_FORM_V2_MIN_GAMES = 5;
export const RECENT_TEAM_FORM_V2_TARGET_GAMES = 10;
export const RECENT_TEAM_FORM_V2_MIN_COMPONENT_WEIGHT = 0.65;

export type RecentTeamFormMetricKey =
  | "xgf_per_60"
  | "hdcf_per_60"
  | "gf_per_60"
  | "xga_per_60"
  | "hdca_per_60"
  | "ca_per_60"
  | "pp_xgf_per_60"
  | "pk_xga_per_60"
  | "gsax_per_60_season"
  | "gsax_per_60_last10"
  | "pdo";

export type RecentTeamFormComponentKey =
  | "offense"
  | "defense"
  | "goaltending"
  | "specialTeams";

export type RecentTeamFormCandidateMetrics = {
  team: string;
  sourceGameCount: number;
  recentGameCount: number;
  rejectedSourceRows: number;
  sourceThroughDate: string | null;
  effectiveRecentGames: number;
  values: Record<RecentTeamFormMetricKey, number | null>;
  observationCounts: Record<RecentTeamFormMetricKey, number>;
};

export type RecentTeamFormCandidateScore = {
  team: string;
  formulaVersion: typeof RECENT_TEAM_FORM_V2_CANDIDATE_FORMULA_VERSION;
  inputVersion: typeof RECENT_TEAM_FORM_V2_CANDIDATE_INPUT_VERSION;
  status: "ready" | "partial" | "unavailable";
  sourceGameCount: number;
  recentGameCount: number;
  rejectedSourceRows: number;
  sourceThroughDate: string | null;
  effectiveRecentGames: number;
  ctpi_raw: number | null;
  ctpi_0_to_100: number | null;
  components: Record<RecentTeamFormComponentKey, number | null>;
  componentCoverage: Record<RecentTeamFormComponentKey, number>;
  z: Record<RecentTeamFormMetricKey, number | null>;
  confidence: {
    value: number;
    tier: "high" | "medium" | "low" | "unavailable";
    recentGameFraction: number;
    metricWeightCoverage: number;
    componentWeightCoverage: number;
  };
  pdoContext: {
    value: number | null;
    z: number | null;
    observationCount: number;
    signal: "high" | "neutral" | "low" | "unavailable";
    includedInScore: false;
  };
  missingMetrics: RecentTeamFormMetricKey[];
  unavailableLeagueMetrics: RecentTeamFormMetricKey[];
  missingComponents: RecentTeamFormComponentKey[];
  warnings: string[];
};

type WeightedValue = {
  value: number | null;
  observationCount: number;
};

type LeagueMoment = {
  mean: number | null;
  standardDeviation: number | null;
  observationCount: number;
};

type ComponentResult = {
  value: number | null;
  coverage: number;
};

const METRIC_KEYS: RecentTeamFormMetricKey[] = [
  "xgf_per_60",
  "hdcf_per_60",
  "gf_per_60",
  "xga_per_60",
  "hdca_per_60",
  "ca_per_60",
  "pp_xgf_per_60",
  "pk_xga_per_60",
  "gsax_per_60_season",
  "gsax_per_60_last10",
  "pdo",
];

const COMPONENT_WEIGHTS: Record<RecentTeamFormComponentKey, number> = {
  offense: 0.35,
  defense: 0.3,
  goaltending: 0.2,
  specialTeams: 0.15,
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

function weightedMean(
  values: Array<number | null>,
  weights: number[],
): WeightedValue {
  const observed = values.flatMap((value, index) =>
    isFiniteNumber(value) && isFiniteNumber(weights[index])
      ? [{ value, weight: weights[index] }]
      : [],
  );
  const weightTotal = observed.reduce((total, row) => total + row.weight, 0);
  return {
    value:
      observed.length > 0 && weightTotal > 0
        ? observed.reduce((total, row) => total + row.value * row.weight, 0) /
          weightTotal
        : null,
    observationCount: observed.length,
  };
}

function weightedRatio(
  rows: TeamGameRow[],
  weights: number[],
  numerator: keyof TeamGameRow,
  denominator: keyof TeamGameRow,
): WeightedValue {
  return weightedMean(
    rows.map((row) => {
      const numeratorValue = row[numerator];
      const denominatorValue = row[denominator];
      return isFiniteNumber(numeratorValue) &&
        isFiniteNumber(denominatorValue) &&
        denominatorValue > 0
        ? (numeratorValue / denominatorValue) * 3600
        : null;
    }),
    weights,
  );
}

function normalizePdo(value: unknown): number | null {
  if (!isFiniteNumber(value)) return null;
  return value < 2 ? value * 100 : value;
}

function effectiveSampleSize(weights: number[]): number {
  const total = weights.reduce((sum, value) => sum + value, 0);
  const squared = weights.reduce((sum, value) => sum + value ** 2, 0);
  return squared > 0 ? total ** 2 / squared : 0;
}

export function computeRecentTeamFormCandidateMetrics(
  games: TeamGameRow[],
  maxGames = RECENT_TEAM_FORM_V2_TARGET_GAMES,
): RecentTeamFormCandidateMetrics {
  const sourceRows = games
    .filter((row) => row.date && isOneGameTeamRow(row))
    .sort((left, right) => right.date.localeCompare(left.date));
  const recentRows = sourceRows.slice(0, maxGames);
  const weights = buildLinearWeights(recentRows.length);
  const valueFor = (key: keyof TeamGameRow) =>
    weightedMean(
      recentRows.map((row) =>
        isFiniteNumber(row[key]) ? (row[key] as number) : null,
      ),
      weights,
    );

  const xgf = valueFor("xgf_per_60");
  const hdcf = valueFor("hdcf_per_60");
  const gf = valueFor("gf_per_60");
  const xga = valueFor("xga_per_60");
  const hdca = valueFor("hdca_per_60");
  const ca = valueFor("ca_per_60");
  const ppXgf = weightedRatio(recentRows, weights, "pp_xgf", "powerPlayToi");
  const pkXga = weightedRatio(recentRows, weights, "pk_xga", "toi_shorthanded");
  const recentGsax = weightedMean(
    recentRows.map((row) =>
      isFiniteNumber(row.xga) &&
      isFiniteNumber(row.goals_against) &&
      isFiniteNumber(row.toi_all_seconds) &&
      row.toi_all_seconds > 0
        ? ((row.xga - row.goals_against) * 3600) / row.toi_all_seconds
        : null,
    ),
    weights,
  );
  const seasonGsaxRows = sourceRows.filter(
    (row) =>
      isFiniteNumber(row.xga) &&
      isFiniteNumber(row.goals_against) &&
      isFiniteNumber(row.toi_all_seconds) &&
      row.toi_all_seconds > 0,
  );
  const seasonToi = seasonGsaxRows.reduce(
    (total, row) => total + (row.toi_all_seconds as number),
    0,
  );
  const seasonGsax =
    seasonToi > 0
      ? (seasonGsaxRows.reduce(
          (total, row) =>
            total + (row.xga as number) - (row.goals_against as number),
          0,
        ) *
          3600) /
        seasonToi
      : null;
  const pdo = weightedMean(
    recentRows.map((row) => normalizePdo(row.pdo)),
    weights,
  );

  return {
    team: sourceRows[0]?.team ?? "",
    sourceGameCount: sourceRows.length,
    recentGameCount: recentRows.length,
    rejectedSourceRows: games.filter(
      (row) => row.date && !isOneGameTeamRow(row),
    ).length,
    sourceThroughDate: sourceRows[0]?.date ?? null,
    effectiveRecentGames: effectiveSampleSize(weights),
    values: {
      xgf_per_60: xgf.value,
      hdcf_per_60: hdcf.value,
      gf_per_60: gf.value,
      xga_per_60: xga.value,
      hdca_per_60: hdca.value,
      ca_per_60: ca.value,
      pp_xgf_per_60: ppXgf.value,
      pk_xga_per_60: pkXga.value,
      gsax_per_60_season: seasonGsax,
      gsax_per_60_last10: recentGsax.value,
      pdo: pdo.value,
    },
    observationCounts: {
      xgf_per_60: xgf.observationCount,
      hdcf_per_60: hdcf.observationCount,
      gf_per_60: gf.observationCount,
      xga_per_60: xga.observationCount,
      hdca_per_60: hdca.observationCount,
      ca_per_60: ca.observationCount,
      pp_xgf_per_60: ppXgf.observationCount,
      pk_xga_per_60: pkXga.observationCount,
      gsax_per_60_season: seasonGsaxRows.length,
      gsax_per_60_last10: recentGsax.observationCount,
      pdo: pdo.observationCount,
    },
  };
}

function leagueMoment(values: Array<number | null>): LeagueMoment {
  const observed = values.filter(isFiniteNumber);
  if (observed.length === 0) {
    return { mean: null, standardDeviation: null, observationCount: 0 };
  }
  const average =
    observed.reduce((total, value) => total + value, 0) / observed.length;
  const variance =
    observed.reduce((total, value) => total + (value - average) ** 2, 0) /
    observed.length;
  return {
    mean: average,
    standardDeviation: Math.sqrt(variance),
    observationCount: observed.length,
  };
}

function observedZ(value: number | null, moment: LeagueMoment): number | null {
  if (
    !isFiniteNumber(value) ||
    !isFiniteNumber(moment.mean) ||
    !isFiniteNumber(moment.standardDeviation) ||
    moment.observationCount < 2
  ) {
    return null;
  }
  return moment.standardDeviation === 0
    ? 0
    : (value - moment.mean) / moment.standardDeviation;
}

function combine(
  values: Array<{ value: number | null; weight: number; direction?: 1 | -1 }>,
): ComponentResult {
  const observed = values.filter((row) => isFiniteNumber(row.value));
  const coverage = observed.reduce((total, row) => total + row.weight, 0);
  return {
    value:
      coverage > 0
        ? observed.reduce(
            (total, row) =>
              total + (row.value as number) * row.weight * (row.direction ?? 1),
            0,
          ) / coverage
        : null,
    coverage,
  };
}

function boundedScore(raw: number): number {
  return 100 / (1 + Math.exp(-0.6 * raw));
}

function confidenceTier(
  status: RecentTeamFormCandidateScore["status"],
  value: number,
): RecentTeamFormCandidateScore["confidence"]["tier"] {
  if (status === "unavailable") return "unavailable";
  if (value >= 0.9) return "high";
  if (value >= 0.65) return "medium";
  return "low";
}

export function computeRecentTeamFormCandidateV2(
  teams: RecentTeamFormCandidateMetrics[],
): RecentTeamFormCandidateScore[] {
  const moments = Object.fromEntries(
    METRIC_KEYS.map((key) => [
      key,
      leagueMoment(teams.map((team) => team.values[key])),
    ]),
  ) as Record<RecentTeamFormMetricKey, LeagueMoment>;

  return teams.map((team) => {
    const z = Object.fromEntries(
      METRIC_KEYS.map((key) => [
        key,
        observedZ(team.values[key], moments[key]),
      ]),
    ) as Record<RecentTeamFormMetricKey, number | null>;
    const componentResults: Record<
      RecentTeamFormComponentKey,
      ComponentResult
    > = {
      offense: combine([
        { value: z.xgf_per_60, weight: 0.5 },
        { value: z.hdcf_per_60, weight: 0.3 },
        { value: z.gf_per_60, weight: 0.2 },
      ]),
      defense: combine([
        { value: z.xga_per_60, weight: 0.5, direction: -1 },
        { value: z.hdca_per_60, weight: 0.3, direction: -1 },
        { value: z.ca_per_60, weight: 0.2, direction: -1 },
      ]),
      goaltending: combine([
        { value: z.gsax_per_60_season, weight: 0.4 },
        { value: z.gsax_per_60_last10, weight: 0.6 },
      ]),
      specialTeams: combine([
        { value: z.pp_xgf_per_60, weight: 0.55 },
        { value: z.pk_xga_per_60, weight: 0.45, direction: -1 },
      ]),
    };
    const components = Object.fromEntries(
      Object.entries(componentResults).map(([key, result]) => [
        key,
        result.value,
      ]),
    ) as Record<RecentTeamFormComponentKey, number | null>;
    const componentCoverage = Object.fromEntries(
      Object.entries(componentResults).map(([key, result]) => [
        key,
        result.coverage,
      ]),
    ) as Record<RecentTeamFormComponentKey, number>;
    const availableComponents = (
      Object.keys(COMPONENT_WEIGHTS) as RecentTeamFormComponentKey[]
    ).filter((key) => isFiniteNumber(components[key]));
    const componentWeightCoverage = availableComponents.reduce(
      (total, key) => total + COMPONENT_WEIGHTS[key],
      0,
    );
    const metricWeightCoverage = (
      Object.keys(COMPONENT_WEIGHTS) as RecentTeamFormComponentKey[]
    ).reduce(
      (total, key) => total + COMPONENT_WEIGHTS[key] * componentCoverage[key],
      0,
    );
    const raw =
      componentWeightCoverage >= RECENT_TEAM_FORM_V2_MIN_COMPONENT_WEIGHT
        ? availableComponents.reduce(
            (total, key) =>
              total + (components[key] as number) * COMPONENT_WEIGHTS[key],
            0,
          ) / componentWeightCoverage
        : null;
    const enoughGames = team.recentGameCount >= RECENT_TEAM_FORM_V2_MIN_GAMES;
    const scoreReady = enoughGames && isFiniteNumber(raw);
    const recentGameFraction = clamp(
      team.recentGameCount / RECENT_TEAM_FORM_V2_TARGET_GAMES,
      0,
      1,
    );
    const confidenceValue = clamp(
      recentGameFraction * metricWeightCoverage,
      0,
      1,
    );
    const missingMetrics = METRIC_KEYS.filter(
      (key) => key !== "pdo" && !isFiniteNumber(team.values[key]),
    );
    const unavailableLeagueMetrics = METRIC_KEYS.filter(
      (key) =>
        key !== "pdo" &&
        isFiniteNumber(team.values[key]) &&
        !isFiniteNumber(z[key]),
    );
    const missingComponents = (
      Object.keys(COMPONENT_WEIGHTS) as RecentTeamFormComponentKey[]
    ).filter((key) => !isFiniteNumber(components[key]));
    const status: RecentTeamFormCandidateScore["status"] = !scoreReady
      ? "unavailable"
      : confidenceValue >= 0.9 &&
          missingMetrics.length === 0 &&
          unavailableLeagueMetrics.length === 0
        ? "ready"
        : "partial";
    const pdoZ = z.pdo;
    const pdoSignal = !isFiniteNumber(pdoZ)
      ? "unavailable"
      : pdoZ >= 1
        ? "high"
        : pdoZ <= -1
          ? "low"
          : "neutral";
    const warnings = [
      team.rejectedSourceRows > 0 ? "rejected_non_game_source_rows" : null,
      !enoughGames ? "insufficient_recent_games" : null,
      team.recentGameCount < RECENT_TEAM_FORM_V2_TARGET_GAMES
        ? "short_sample"
        : null,
      missingMetrics.length > 0 ? "missing_source_metrics" : null,
      unavailableLeagueMetrics.length > 0
        ? "insufficient_league_comparison"
        : null,
      missingComponents.length > 0 ? "missing_formula_components" : null,
      !scoreReady ? "score_unavailable" : null,
    ].filter((value): value is string => value != null);

    return {
      team: team.team,
      formulaVersion: RECENT_TEAM_FORM_V2_CANDIDATE_FORMULA_VERSION,
      inputVersion: RECENT_TEAM_FORM_V2_CANDIDATE_INPUT_VERSION,
      status,
      sourceGameCount: team.sourceGameCount,
      recentGameCount: team.recentGameCount,
      rejectedSourceRows: team.rejectedSourceRows,
      sourceThroughDate: team.sourceThroughDate,
      effectiveRecentGames: team.effectiveRecentGames,
      ctpi_raw: scoreReady ? raw : null,
      ctpi_0_to_100: scoreReady ? boundedScore(raw) : null,
      components,
      componentCoverage,
      z,
      confidence: {
        value: confidenceValue,
        tier: confidenceTier(status, confidenceValue),
        recentGameFraction,
        metricWeightCoverage,
        componentWeightCoverage,
      },
      pdoContext: {
        value: team.values.pdo,
        z: pdoZ,
        observationCount: team.observationCounts.pdo,
        signal: pdoSignal,
        includedInScore: false,
      },
      missingMetrics,
      unavailableLeagueMetrics,
      missingComponents,
      warnings,
    };
  });
}
