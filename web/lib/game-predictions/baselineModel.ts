import type { SupabaseClient } from "@supabase/supabase-js";

import type { BinaryLogisticModel, BinaryTrainingExample } from "lib/xg/binaryLogistic";
import {
  predictBinaryLogisticProbability,
  trainBinaryLogisticModel,
} from "lib/xg/binaryLogistic";
import type { ProbabilityCalibrator } from "lib/xg/calibration";
import type { Database, Json } from "lib/supabase/database-generated.types";
import type { GamePredictionFeatureSnapshotPayload } from "./featureBuilder";

export const BASELINE_MODEL_NAME = "nhl_game_baseline_logistic";
export const BASELINE_MODEL_VERSION = "v6_roster_ctpi_sos_threshold_52";
export const BASELINE_PROBABILITY_FLOOR = 0.05;
export const BASELINE_MIN_DATA_QUALITY_MULTIPLIER = 0.55;
export const BASELINE_WINNER_DECISION_THRESHOLD = 0.52;

export const BASELINE_FEATURE_KEYS = [
  "homeMinusAwayOffRating",
  "homeMinusAwayDefRating",
  "homeMinusAwayGoalieRating",
  "homeMinusAwaySpecialRating",
  "homeMinusAwayPointPctg",
  "homeMinusAwayGoalDifferential",
  "homeMinusAwayRecent5GoalDifferentialPerGame",
  "homeMinusAwayRecent10GoalDifferentialPerGame",
  "homeMinusAwayRecent20GoalDifferentialPerGame",
  "homeMinusAwayRecent40GoalDifferentialPerGame",
  "homeMinusAwayRecent5XgfPct",
  "homeMinusAwayRecent10XgfPct",
  "homeMinusAwayRecent20XgfPct",
  "homeMinusAwayRecent40XgfPct",
  "homeMinusAwaySeasonToDateXgfPct",
  "homeMinusAwayCrossSeasonPriorXgfPct",
  "homeMinusAwayRecent10PointPct",
  "homeMinusAwaySeasonToDatePointPct",
  "homeMinusAwayRecent20ShotShare",
  "homeMinusAwayRecent40ShotShare",
  "homeMinusAwayRecent20FenwickShare",
  "homeMinusAwayRecent40FenwickShare",
  "homeMinusAwayRecent20GfPct",
  "homeMinusAwayRecent40GfPct",
  "homeMinusAwayRecent20XgaPer60",
  "homeMinusAwayRecent40XgaPer60",
  "homeMinusAwayCtpi",
  "homeMinusAwayPastOpponentCompositeRating",
  "homeMinusAwayForgeProjectedGoals",
  "homeMinusAwayForgeProjectedShots",
  "homeMinusAwayWeightedGoalieGsaaPer60",
  "homeMinusAwayGoalieStartUncertainty",
  "homeRestAdvantageDays",
  "homeMinusAwayGamesPlayedAsOf",
  "seasonPhaseOrdinal",
  "homeMarketNoVigProbability",
] as const;

export type BaselineFeatureKey = (typeof BASELINE_FEATURE_KEYS)[number];

export const CANDIDATE_ONLY_FEATURE_KEYS: readonly BaselineFeatureKey[] = [
  "homeMinusAwayRecent20GoalDifferentialPerGame",
  "homeMinusAwayRecent40GoalDifferentialPerGame",
  "homeMinusAwayRecent20XgfPct",
  "homeMinusAwayRecent40XgfPct",
  "homeMinusAwaySeasonToDateXgfPct",
  "homeMinusAwayCrossSeasonPriorXgfPct",
  "homeMinusAwaySeasonToDatePointPct",
  "homeMinusAwayRecent20ShotShare",
  "homeMinusAwayRecent40ShotShare",
  "homeMinusAwayRecent20FenwickShare",
  "homeMinusAwayRecent40FenwickShare",
  "homeMinusAwayRecent20GfPct",
  "homeMinusAwayRecent40GfPct",
  "homeMinusAwayRecent20XgaPer60",
  "homeMinusAwayRecent40XgaPer60",
  "homeMinusAwayGoalieStartUncertainty",
  "homeMinusAwayGamesPlayedAsOf",
  "seasonPhaseOrdinal",
  "homeMarketNoVigProbability",
];

export const PUBLIC_EXPLANATION_FEATURE_KEYS: readonly BaselineFeatureKey[] =
  BASELINE_FEATURE_KEYS;

export type GamePredictionBaselineExample = BinaryTrainingExample & {
  gameId: number;
  featureSnapshotId: string;
  featureKeys: readonly BaselineFeatureKey[];
};

export type BaselineFeatureNormalization = {
  means: number[];
  scales: number[];
};

export type GamePredictionBaselineModel = BinaryLogisticModel & {
  featureNormalization?: BaselineFeatureNormalization;
  probabilityFloor?: number;
};

export type ExtraTreesFitOptions = {
  treeCount?: number;
  maxDepth?: number;
  minLeafExamples?: number;
  featuresPerSplit?: number;
  sampleRate?: number;
  seed?: number;
  leafSmoothing?: number;
};

export type GamePredictionExtraTreesNode =
  | {
      type: "leaf";
      sampleCount: number;
      positiveCount: number;
      probability: number;
    }
  | {
      type: "split";
      featureIndex: number;
      threshold: number;
      impurityReduction: number;
      left: GamePredictionExtraTreesNode;
      right: GamePredictionExtraTreesNode;
    };

export type GamePredictionExtraTreesModel = {
  modelFamily: "extra_trees";
  featureCount: number;
  trees: GamePredictionExtraTreesNode[];
  featureImportances: number[];
  priorProbability: number;
  probabilityFloor?: number;
  options: Required<ExtraTreesFitOptions>;
};

export type BaselineFeatureVectorOptions = {
  excludedFeatureKeys?: readonly BaselineFeatureKey[];
  includeDefaultExcludedFeatureKeys?: boolean;
};

export type GameOutcome = {
  gameId: number;
  homeWon: boolean;
};

export type GamePredictionTopFactor = {
  featureKey: BaselineFeatureKey;
  value: number;
  weight: number;
  contribution: number;
};

export type BaselineFeatureSignal = {
  featureKey: BaselineFeatureKey;
  sampleSize: number;
  meanValue: number;
  standardDeviation: number;
  meanWhenHomeWon: number;
  meanWhenHomeLost: number;
  pearsonCorrelation: number;
  absoluteCorrelation: number;
  mutualInformationScore: number;
  univariateLogisticWeight: number;
  univariateOddsRatioPerStdDev: number;
  multivariateLogisticWeight: number;
  multivariateOddsRatioPerStdDev: number;
  direction: "home" | "away" | "neutral";
  rank: number;
};

export type BaselineFeatureLeakageCheck = {
  featureKey: BaselineFeatureKey;
  status: "pass" | "review" | "blocked_by_default";
  defaultExcluded: boolean;
  sourceAsOfRule: string;
  reasons: string[];
};

export type BaselineFeatureSignalAnalysis = {
  sampleSize: number;
  homeWins: number;
  awayWins: number;
  logisticBias: number;
  signals: BaselineFeatureSignal[];
  leakageChecks: BaselineFeatureLeakageCheck[];
};

export type GamePredictionModelAuditMetadata = {
  winnerPolicyVersion?: string;
  winnerPolicyMode?: string;
  defaultWinnerThreshold?: number;
  selectedWinnerThreshold?: number;
  rosterImpactVersion?: string;
  strengthOfScheduleVersion?: string;
  seasonDecayVersion?: string;
  probabilityBlendVersion?: string;
  candidateModelFamily?: string;
  marketFeatureSuppressedBySourceReadiness?: boolean;
  marketFeatureGuardrailReason?: string;
};

export type GamePredictionResult = {
  gameId: number;
  snapshotDate: string;
  predictionScope: "pregame";
  predictionCutoffAt: string;
  modelName: string;
  modelVersion: string;
  featureSetVersion: string;
  homeTeamId: number;
  awayTeamId: number;
  homeWinProbability: number;
  awayWinProbability: number;
  predictedWinnerTeamId: number;
  confidenceLabel: "low" | "medium" | "high";
  topFactors: GamePredictionTopFactor[];
  components: Record<string, Json>;
  provenance: Record<string, Json>;
  metadata: Record<string, Json>;
};

function isFeatureExcluded(
  featureKey: BaselineFeatureKey,
  options?: BaselineFeatureVectorOptions,
): boolean {
  return getExcludedFeatureKeys(options).includes(featureKey);
}

function getExcludedFeatureKeys(
  options?: BaselineFeatureVectorOptions,
): readonly BaselineFeatureKey[] {
  const defaultExcluded: readonly BaselineFeatureKey[] =
    options?.includeDefaultExcludedFeatureKeys
      ? []
      : [
          "homeMinusAwayRecent10PointPct",
          ...CANDIDATE_ONLY_FEATURE_KEYS,
        ];
  return Array.from(
    new Set([
      ...defaultExcluded,
      ...(options?.excludedFeatureKeys ?? []),
    ]),
  );
}

function finiteOrZero(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function clipProbability(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(0.999999, Math.max(0.000001, value));
}

function applyProbabilityFloor(
  value: number,
  model: BinaryLogisticModel,
): number {
  const floor =
    (model as GamePredictionBaselineModel).probabilityFloor ??
    BASELINE_PROBABILITY_FLOOR;
  const boundedFloor = Math.max(0, Math.min(0.49, floor));
  return Math.min(1 - boundedFloor, Math.max(boundedFloor, value));
}

function roundProbability(value: number): number {
  return Number(clipProbability(value).toFixed(6));
}

function roundSignalMetric(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(6)) : 0;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[], average = mean(values)): number {
  if (values.length === 0) return 0;
  const variance =
    values.reduce((sum, value) => {
      const delta = value - average;
      return sum + delta * delta;
    }, 0) / values.length;
  return Math.sqrt(variance);
}

function pearsonCorrelation(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length < 2) return 0;
  const leftMean = mean(left);
  const rightMean = mean(right);
  let numerator = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index] - leftMean;
    const rightDelta = right[index] - rightMean;
    numerator += leftDelta * rightDelta;
    leftVariance += leftDelta * leftDelta;
    rightVariance += rightDelta * rightDelta;
  }
  const denominator = Math.sqrt(leftVariance * rightVariance);
  return denominator > 1e-12 ? numerator / denominator : 0;
}

function mutualInformationScore(values: number[], labels: number[]): number {
  if (values.length !== labels.length || values.length < 2) return 0;
  const uniqueValues = Array.from(new Set(values));
  if (uniqueValues.length < 2) return 0;
  const sortedValues = [...values].sort((a, b) => a - b);
  const binCount = Math.min(5, uniqueValues.length);
  const binnedValues = values.map((value) => {
    let rank = 0;
    while (
      rank + 1 < sortedValues.length &&
      sortedValues[rank + 1] <= value
    ) {
      rank += 1;
    }
    return Math.min(binCount - 1, Math.floor((rank / values.length) * binCount));
  });
  const total = values.length;
  let score = 0;

  for (let bin = 0; bin < binCount; bin += 1) {
    for (const label of [0, 1]) {
      const jointCount = binnedValues.filter(
        (binnedValue, index) => binnedValue === bin && labels[index] === label,
      ).length;
      if (jointCount === 0) continue;
      const binCountValue = binnedValues.filter(
        (binnedValue) => binnedValue === bin,
      ).length;
      const labelCount = labels.filter((value) => value === label).length;
      const jointProbability = jointCount / total;
      const binProbability = binCountValue / total;
      const labelProbability = labelCount / total;
      score += jointProbability * Math.log(jointProbability / (binProbability * labelProbability));
    }
  }

  return score;
}

function oddsRatioFromWeight(weight: number): number {
  return Math.exp(Math.max(-20, Math.min(20, weight)));
}

function buildModelAuditMetadata(args: {
  selectedWinnerThreshold: number;
  modelAuditMetadata?: GamePredictionModelAuditMetadata;
}): GamePredictionModelAuditMetadata {
  return {
    winnerPolicyVersion: "winner_policy_v1_report_50_and_selected_threshold",
    winnerPolicyMode: "report_default_50_and_selected_threshold",
    defaultWinnerThreshold: 0.5,
    selectedWinnerThreshold: args.selectedWinnerThreshold,
    rosterImpactVersion: "forge_team_projection_v1",
    strengthOfScheduleVersion: "past_opponent_power_v1",
    seasonDecayVersion: "none",
    probabilityBlendVersion: "none",
    ...args.modelAuditMetadata,
  };
}

export function buildBaselineFeatureLeakageChecks(): BaselineFeatureLeakageCheck[] {
  return BASELINE_FEATURE_KEYS.map((featureKey) => {
    const defaultExcluded = getExcludedFeatureKeys().includes(featureKey);
    const reasons: string[] = [];
    let status: BaselineFeatureLeakageCheck["status"] = defaultExcluded
      ? "review"
      : "pass";
    let sourceAsOfRule = "strict_before_game_date";

    if (featureKey === "homeMarketNoVigProbability") {
      status = "blocked_by_default";
      sourceAsOfRule = "strict_before_prediction_cutoff_and_start_time";
      reasons.push(
        "Market odds are training-eligible only from persisted snapshots captured before prediction cutoff and puck drop.",
      );
    }

    if (CANDIDATE_ONLY_FEATURE_KEYS.includes(featureKey)) {
      reasons.push("Candidate-only feature excluded from default production vector until ablation evidence supports promotion.");
    }

    if (featureKey.includes("SeasonToDate") || featureKey.includes("Recent")) {
      reasons.push("Uses dated NST rows filtered with row.date < sourceAsOfDate.");
    }

    if (featureKey.includes("GoalieStartUncertainty")) {
      sourceAsOfRule = "current_prediction_only";
      reasons.push("Goalie uncertainty comes from pregame projection/confirmed-start source state.");
    }

    return {
      featureKey,
      status,
      defaultExcluded,
      sourceAsOfRule,
      reasons,
    };
  });
}

function parseDateOnly(value: string): number {
  return Date.parse(`${value}T00:00:00.000Z`);
}

function differenceInDays(laterDate: string, earlierDate: string): number {
  return Math.floor(
    (parseDateOnly(laterDate) - parseDateOnly(earlierDate)) / 86_400_000,
  );
}

function dampenTowardCoinFlip(probability: number, multiplier: number): number {
  return 0.5 + (probability - 0.5) * multiplier;
}

function buildDataQualityMultiplier(
  payload: GamePredictionFeatureSnapshotPayload,
): { multiplier: number; penalties: Record<string, number> } {
  const penalties: Record<string, number> = {};
  const staleCount = payload.sourceCutoffs.filter((cutoff) => cutoff.stale).length;
  if (staleCount > 0) {
    penalties.stale_sources = Math.min(0.18, staleCount * 0.03);
  }

  if (payload.missingFeatures.length > 0) {
    penalties.missing_features = Math.min(0.18, payload.missingFeatures.length * 0.025);
  }

  const goalieFallbackCount = [payload.home.goalie, payload.away.goalie].filter(
    (goalie) => goalie.source === "fallback",
  ).length;
  if (goalieFallbackCount > 0) {
    penalties.goalie_fallback = goalieFallbackCount * 0.06;
  }

  const projectedGoalieCount = [payload.home.goalie, payload.away.goalie].filter(
    (goalie) => !goalie.confirmed && goalie.source !== "fallback",
  ).length;
  if (projectedGoalieCount > 0) {
    penalties.projected_goalie = projectedGoalieCount * 0.025;
  }

  const goalieUncertainty =
    payload.home.goalie.startUncertainty + payload.away.goalie.startUncertainty;
  if (goalieUncertainty > 0) {
    penalties.goalie_start_uncertainty = Math.min(
      0.06,
      goalieUncertainty * 0.025,
    );
  }

  if (payload.fallbackFlags.market_odds_unavailable) {
    penalties.market_odds_unavailable = 0.01;
  } else if (
    payload.market?.capturedAgeHours != null &&
    payload.market.capturedAgeHours > 24
  ) {
    penalties.market_odds_stale = 0.02;
  }

  if (!payload.home.lineup || !payload.away.lineup) {
    penalties.missing_lineup = (!payload.home.lineup ? 0.03 : 0) +
      (!payload.away.lineup ? 0.03 : 0);
  }

  const horizonDays = Math.max(
    0,
    differenceInDays(payload.gameDate, payload.sourceAsOfDate),
  );
  if (horizonDays > 0) {
    penalties.prediction_horizon = Math.min(0.14, horizonDays * 0.02);
  }

  const totalPenalty = Object.values(penalties).reduce(
    (sum, penalty) => sum + penalty,
    0,
  );

  return {
    multiplier: Math.max(
      BASELINE_MIN_DATA_QUALITY_MULTIPLIER,
      Math.min(1, 1 - totalPenalty),
    ),
    penalties,
  };
}

function buildFeatureNormalization(
  examples: GamePredictionBaselineExample[],
): BaselineFeatureNormalization {
  const featureCount = examples[0]?.features.length ?? 0;
  const means = Array.from({ length: featureCount }, (_, featureIndex) => {
    const sum = examples.reduce(
      (total, example) => total + example.features[featureIndex],
      0,
    );
    return sum / examples.length;
  });
  const scales = means.map((mean, featureIndex) => {
    const variance =
      examples.reduce((total, example) => {
        const delta = example.features[featureIndex] - mean;
        return total + delta * delta;
      }, 0) / examples.length;
    const stdDev = Math.sqrt(variance);
    return stdDev > 1e-9 ? stdDev : 1;
  });

  return { means, scales };
}

function normalizeFeatureVector(
  features: number[],
  normalization?: BaselineFeatureNormalization,
): number[] {
  if (!normalization) return features;
  return features.map((feature, index) => {
    const mean = normalization.means[index] ?? 0;
    const scale = normalization.scales[index] ?? 1;
    return (feature - mean) / scale;
  });
}

export function predictBaselineModelRawHomeWinProbability(
  model: BinaryLogisticModel,
  features: number[],
): number {
  const modelFeatures = features.slice(0, model.featureCount);
  const normalizedFeatures = normalizeFeatureVector(
    modelFeatures,
    (model as GamePredictionBaselineModel).featureNormalization,
  );
  return predictBinaryLogisticProbability(model, normalizedFeatures);
}

function normalizeExamples(
  examples: GamePredictionBaselineExample[],
  normalization: BaselineFeatureNormalization,
): GamePredictionBaselineExample[] {
  return examples.map((example) => ({
    ...example,
    features: normalizeFeatureVector(example.features, normalization),
  }));
}

export function buildBaselineFeatureVector(
  payload: GamePredictionFeatureSnapshotPayload,
  options: BaselineFeatureVectorOptions = {},
): number[] {
  const values: Record<BaselineFeatureKey, number | null> = {
    homeMinusAwayOffRating: payload.matchup.homeMinusAwayOffRating,
    homeMinusAwayDefRating: payload.matchup.homeMinusAwayDefRating,
    homeMinusAwayGoalieRating: payload.matchup.homeMinusAwayGoalieRating,
    homeMinusAwaySpecialRating: payload.matchup.homeMinusAwaySpecialRating,
    homeMinusAwayPointPctg: payload.matchup.homeMinusAwayPointPctg,
    homeMinusAwayGoalDifferential:
      payload.matchup.homeMinusAwayGoalDifferential == null
        ? null
        : payload.matchup.homeMinusAwayGoalDifferential / 50,
    homeMinusAwayRecent5GoalDifferentialPerGame:
      payload.matchup.homeMinusAwayRecent5GoalDifferentialPerGame == null
        ? null
        : payload.matchup.homeMinusAwayRecent5GoalDifferentialPerGame / 3,
    homeMinusAwayRecent10GoalDifferentialPerGame:
      payload.matchup.homeMinusAwayRecent10GoalDifferentialPerGame == null
        ? null
        : payload.matchup.homeMinusAwayRecent10GoalDifferentialPerGame / 3,
    homeMinusAwayRecent20GoalDifferentialPerGame:
      payload.matchup.homeMinusAwayRecent20GoalDifferentialPerGame == null
        ? null
        : payload.matchup.homeMinusAwayRecent20GoalDifferentialPerGame / 3,
    homeMinusAwayRecent40GoalDifferentialPerGame:
      payload.matchup.homeMinusAwayRecent40GoalDifferentialPerGame == null
        ? null
        : payload.matchup.homeMinusAwayRecent40GoalDifferentialPerGame / 3,
    homeMinusAwayRecent5XgfPct: payload.matchup.homeMinusAwayRecent5XgfPct,
    homeMinusAwayRecent10XgfPct: payload.matchup.homeMinusAwayRecent10XgfPct,
    homeMinusAwayRecent20XgfPct: payload.matchup.homeMinusAwayRecent20XgfPct,
    homeMinusAwayRecent40XgfPct: payload.matchup.homeMinusAwayRecent40XgfPct,
    homeMinusAwaySeasonToDateXgfPct:
      payload.matchup.homeMinusAwaySeasonToDateXgfPct,
    homeMinusAwayCrossSeasonPriorXgfPct:
      payload.matchup.homeMinusAwayCrossSeasonPriorXgfPct,
    homeMinusAwayRecent10PointPct:
      payload.matchup.homeMinusAwayRecent10PointPct,
    homeMinusAwaySeasonToDatePointPct:
      payload.matchup.homeMinusAwaySeasonToDatePointPct,
    homeMinusAwayRecent20ShotShare:
      payload.matchup.homeMinusAwayRecent20ShotShare,
    homeMinusAwayRecent40ShotShare:
      payload.matchup.homeMinusAwayRecent40ShotShare,
    homeMinusAwayRecent20FenwickShare:
      payload.matchup.homeMinusAwayRecent20FenwickShare,
    homeMinusAwayRecent40FenwickShare:
      payload.matchup.homeMinusAwayRecent40FenwickShare,
    homeMinusAwayRecent20GfPct: payload.matchup.homeMinusAwayRecent20GfPct,
    homeMinusAwayRecent40GfPct: payload.matchup.homeMinusAwayRecent40GfPct,
    homeMinusAwayRecent20XgaPer60:
      payload.matchup.homeMinusAwayRecent20XgaPer60 == null
        ? null
        : payload.matchup.homeMinusAwayRecent20XgaPer60 / 3,
    homeMinusAwayRecent40XgaPer60:
      payload.matchup.homeMinusAwayRecent40XgaPer60 == null
        ? null
        : payload.matchup.homeMinusAwayRecent40XgaPer60 / 3,
    homeMinusAwayCtpi:
      payload.matchup.homeMinusAwayCtpi == null
        ? null
        : payload.matchup.homeMinusAwayCtpi / 100,
    homeMinusAwayPastOpponentCompositeRating:
      payload.matchup.homeMinusAwayPastOpponentCompositeRating == null
        ? null
        : payload.matchup.homeMinusAwayPastOpponentCompositeRating / 100,
    homeMinusAwayForgeProjectedGoals:
      payload.matchup.homeMinusAwayForgeProjectedGoals == null
        ? null
        : payload.matchup.homeMinusAwayForgeProjectedGoals / 3,
    homeMinusAwayForgeProjectedShots:
      payload.matchup.homeMinusAwayForgeProjectedShots == null
        ? null
        : payload.matchup.homeMinusAwayForgeProjectedShots / 10,
    homeMinusAwayWeightedGoalieGsaaPer60:
      payload.matchup.homeMinusAwayWeightedGoalieGsaaPer60,
    homeMinusAwayGoalieStartUncertainty:
      payload.matchup.homeMinusAwayGoalieStartUncertainty,
    homeRestAdvantageDays:
      payload.matchup.homeRestAdvantageDays == null
        ? null
        : Math.max(-3, Math.min(3, payload.matchup.homeRestAdvantageDays)) / 3,
    homeMinusAwayGamesPlayedAsOf:
      payload.matchup.homeMinusAwayGamesPlayedAsOf == null
        ? null
        : Math.max(-20, Math.min(20, payload.matchup.homeMinusAwayGamesPlayedAsOf)) /
          20,
    seasonPhaseOrdinal: payload.matchup.seasonPhaseOrdinal / 3,
    homeMarketNoVigProbability:
      payload.market?.homeNoVigProbability == null
        ? null
        : payload.market.homeNoVigProbability - 0.5,
  };

  return BASELINE_FEATURE_KEYS.map((featureKey) =>
    isFeatureExcluded(featureKey, options) ? 0 : finiteOrZero(values[featureKey]),
  );
}

export function buildBaselineTrainingDataset(
  snapshots: Array<{ featureSnapshotId: string; payload: GamePredictionFeatureSnapshotPayload }>,
  outcomes: GameOutcome[],
  featureVectorOptions: BaselineFeatureVectorOptions = {},
): GamePredictionBaselineExample[] {
  const outcomesByGameId = new Map(outcomes.map((outcome) => [outcome.gameId, outcome]));

  return snapshots.flatMap((snapshot) => {
    const outcome = outcomesByGameId.get(snapshot.payload.gameId);
    if (!outcome) return [];

    return [
      {
        gameId: snapshot.payload.gameId,
        featureSnapshotId: snapshot.featureSnapshotId,
        featureKeys: BASELINE_FEATURE_KEYS,
        features: buildBaselineFeatureVector(snapshot.payload, featureVectorOptions),
        label: outcome.homeWon ? 1 : 0,
      },
    ];
  });
}

export function trainGamePredictionBaselineModel(
  examples: GamePredictionBaselineExample[],
  options: Parameters<typeof trainBinaryLogisticModel>[1] = { iterations: 800, learningRate: 0.05, l2: 0.01 }
): GamePredictionBaselineModel {
  const featureNormalization = buildFeatureNormalization(examples);
  const normalizedExamples = normalizeExamples(examples, featureNormalization);
  const model = trainBinaryLogisticModel(normalizedExamples, options);
  return {
    ...model,
    featureNormalization,
    probabilityFloor: BASELINE_PROBABILITY_FLOOR,
  };
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function extraTreesOptions(
  featureCount: number,
  options: ExtraTreesFitOptions = {},
): Required<ExtraTreesFitOptions> {
  return {
    treeCount: Math.max(1, Math.floor(options.treeCount ?? 41)),
    maxDepth: Math.max(1, Math.floor(options.maxDepth ?? 4)),
    minLeafExamples: Math.max(2, Math.floor(options.minLeafExamples ?? 8)),
    featuresPerSplit: Math.max(
      1,
      Math.min(
        featureCount,
        Math.floor(options.featuresPerSplit ?? Math.sqrt(featureCount)),
      ),
    ),
    sampleRate: Math.max(0.3, Math.min(1, options.sampleRate ?? 0.85)),
    seed: Math.floor(options.seed ?? 20260615),
    leafSmoothing: Math.max(0, options.leafSmoothing ?? 6),
  };
}

function giniImpurity(positiveCount: number, sampleCount: number): number {
  if (sampleCount <= 0) return 0;
  const positiveProbability = positiveCount / sampleCount;
  const negativeProbability = 1 - positiveProbability;
  return 1 - positiveProbability * positiveProbability -
    negativeProbability * negativeProbability;
}

function positiveCount(examples: GamePredictionBaselineExample[]): number {
  return examples.filter((example) => example.label === 1).length;
}

function buildExtraTreesLeaf(
  examples: GamePredictionBaselineExample[],
  priorProbability: number,
  leafSmoothing: number,
): GamePredictionExtraTreesNode {
  const positives = positiveCount(examples);
  const probability =
    (positives + priorProbability * leafSmoothing) /
    (examples.length + leafSmoothing);
  return {
    type: "leaf",
    sampleCount: examples.length,
    positiveCount: positives,
    probability: clipProbability(probability),
  };
}

function sampleExtraTreeExamples(
  examples: GamePredictionBaselineExample[],
  options: Required<ExtraTreesFitOptions>,
  random: () => number,
): GamePredictionBaselineExample[] {
  const sampleCount = Math.max(
    options.minLeafExamples * 2,
    Math.floor(examples.length * options.sampleRate),
  );
  if (sampleCount >= examples.length) return [...examples];
  return Array.from(
    { length: sampleCount },
    () => examples[Math.floor(random() * examples.length)]!,
  );
}

function randomFeatureSubset(
  featureCount: number,
  subsetSize: number,
  random: () => number,
): number[] {
  const selected = new Set<number>();
  while (selected.size < Math.min(featureCount, subsetSize)) {
    selected.add(Math.floor(random() * featureCount));
  }
  return Array.from(selected);
}

function trainExtraTreeNode(args: {
  examples: GamePredictionBaselineExample[];
  featureCount: number;
  options: Required<ExtraTreesFitOptions>;
  random: () => number;
  depth: number;
  priorProbability: number;
  featureImportances: number[];
}): GamePredictionExtraTreesNode {
  const { examples, options } = args;
  const positives = positiveCount(examples);
  const parentImpurity = giniImpurity(positives, examples.length);
  if (
    args.depth >= options.maxDepth ||
    examples.length < options.minLeafExamples * 2 ||
    positives === 0 ||
    positives === examples.length ||
    parentImpurity <= 1e-9
  ) {
    return buildExtraTreesLeaf(
      examples,
      args.priorProbability,
      options.leafSmoothing,
    );
  }

  let bestSplit: {
    featureIndex: number;
    threshold: number;
    impurityReduction: number;
    left: GamePredictionBaselineExample[];
    right: GamePredictionBaselineExample[];
  } | null = null;

  for (const featureIndex of randomFeatureSubset(
    args.featureCount,
    options.featuresPerSplit,
    args.random,
  )) {
    const values = examples.map((example) => example.features[featureIndex] ?? 0);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    if (!Number.isFinite(minValue) || !Number.isFinite(maxValue) || minValue === maxValue) {
      continue;
    }
    const threshold = minValue + args.random() * (maxValue - minValue);
    const left = examples.filter(
      (example) => (example.features[featureIndex] ?? 0) <= threshold,
    );
    const right = examples.filter(
      (example) => (example.features[featureIndex] ?? 0) > threshold,
    );
    if (
      left.length < options.minLeafExamples ||
      right.length < options.minLeafExamples
    ) {
      continue;
    }
    const leftPositive = positiveCount(left);
    const rightPositive = positives - leftPositive;
    const weightedImpurity =
      (left.length / examples.length) * giniImpurity(leftPositive, left.length) +
      (right.length / examples.length) * giniImpurity(rightPositive, right.length);
    const impurityReduction = parentImpurity - weightedImpurity;
    if (!bestSplit || impurityReduction > bestSplit.impurityReduction) {
      bestSplit = { featureIndex, threshold, impurityReduction, left, right };
    }
  }

  if (!bestSplit || bestSplit.impurityReduction <= 1e-9) {
    return buildExtraTreesLeaf(
      examples,
      args.priorProbability,
      options.leafSmoothing,
    );
  }

  args.featureImportances[bestSplit.featureIndex] +=
    bestSplit.impurityReduction * examples.length;

  return {
    type: "split",
    featureIndex: bestSplit.featureIndex,
    threshold: bestSplit.threshold,
    impurityReduction: bestSplit.impurityReduction,
    left: trainExtraTreeNode({
      ...args,
      examples: bestSplit.left,
      depth: args.depth + 1,
    }),
    right: trainExtraTreeNode({
      ...args,
      examples: bestSplit.right,
      depth: args.depth + 1,
    }),
  };
}

export function trainGamePredictionExtraTreesModel(
  examples: GamePredictionBaselineExample[],
  options: ExtraTreesFitOptions = {},
): GamePredictionExtraTreesModel {
  if (examples.length === 0) {
    throw new Error("At least one game prediction example is required.");
  }
  const featureCount = examples[0]?.features.length ?? 0;
  if (featureCount <= 0) {
    throw new Error("ExtraTrees examples must include at least one feature.");
  }
  for (const example of examples) {
    if (example.features.length !== featureCount) {
      throw new Error("All ExtraTrees examples must use the same feature count.");
    }
  }

  const resolvedOptions = extraTreesOptions(featureCount, options);
  const random = createSeededRandom(resolvedOptions.seed);
  const priorProbability = positiveCount(examples) / examples.length;
  const featureImportances = Array.from({ length: featureCount }, () => 0);
  const trees = Array.from({ length: resolvedOptions.treeCount }, () =>
    trainExtraTreeNode({
      examples: sampleExtraTreeExamples(examples, resolvedOptions, random),
      featureCount,
      options: resolvedOptions,
      random,
      depth: 0,
      priorProbability,
      featureImportances,
    }),
  );
  const totalImportance = featureImportances.reduce(
    (sum, importance) => sum + importance,
    0,
  );

  return {
    modelFamily: "extra_trees",
    featureCount,
    trees,
    featureImportances: totalImportance > 0
      ? featureImportances.map((importance) => importance / totalImportance)
      : featureImportances,
    priorProbability: clipProbability(priorProbability),
    probabilityFloor: BASELINE_PROBABILITY_FLOOR,
    options: resolvedOptions,
  };
}

export function analyzeBaselineFeatureSignals(
  examples: GamePredictionBaselineExample[],
  options: Parameters<typeof trainBinaryLogisticModel>[1] = {
    iterations: 800,
    learningRate: 0.03,
    l2: 0.02,
  },
): BaselineFeatureSignalAnalysis {
  if (examples.length === 0) {
    throw new Error("At least one baseline training example is required.");
  }

  const featureNormalization = buildFeatureNormalization(examples);
  const normalizedExamples = normalizeExamples(examples, featureNormalization);
  const multivariateModel = trainBinaryLogisticModel(normalizedExamples, options);
  const labels = examples.map((example) => example.label);
  const homeWins = labels.filter((label) => label === 1).length;
  const awayWins = examples.length - homeWins;

  const signals = BASELINE_FEATURE_KEYS.map((featureKey, featureIndex) => {
    const values = examples.map((example) => example.features[featureIndex] ?? 0);
    const normalizedValues = normalizedExamples.map(
      (example) => example.features[featureIndex] ?? 0,
    );
    const homeWinValues = values.filter((_, index) => labels[index] === 1);
    const awayWinValues = values.filter((_, index) => labels[index] === 0);
    const univariateModel = trainBinaryLogisticModel(
      normalizedValues.map((value, index) => ({
        features: [value],
        label: labels[index],
      })),
      options,
    );
    const correlation = pearsonCorrelation(values, labels);
    const mutualInformation = mutualInformationScore(values, labels);
    const multivariateWeight = multivariateModel.weights[featureIndex] ?? 0;
    const direction: BaselineFeatureSignal["direction"] =
      Math.abs(multivariateWeight) < 1e-9
        ? "neutral"
        : multivariateWeight > 0
          ? "home"
          : "away";

    return {
      featureKey,
      sampleSize: examples.length,
      meanValue: roundSignalMetric(mean(values)),
      standardDeviation: roundSignalMetric(
        featureNormalization.scales[featureIndex] ?? standardDeviation(values),
      ),
      meanWhenHomeWon: roundSignalMetric(mean(homeWinValues)),
      meanWhenHomeLost: roundSignalMetric(mean(awayWinValues)),
      pearsonCorrelation: roundSignalMetric(correlation),
      absoluteCorrelation: roundSignalMetric(Math.abs(correlation)),
      mutualInformationScore: roundSignalMetric(mutualInformation),
      univariateLogisticWeight: roundSignalMetric(
        univariateModel.weights[0] ?? 0,
      ),
      univariateOddsRatioPerStdDev: roundSignalMetric(
        oddsRatioFromWeight(univariateModel.weights[0] ?? 0),
      ),
      multivariateLogisticWeight: roundSignalMetric(multivariateWeight),
      multivariateOddsRatioPerStdDev: roundSignalMetric(
        oddsRatioFromWeight(multivariateWeight),
      ),
      direction,
      rank: 0,
    };
  }).sort((left, right) => {
    const weightDelta =
      Math.abs(right.multivariateLogisticWeight) -
      Math.abs(left.multivariateLogisticWeight);
    if (Math.abs(weightDelta) > 1e-12) return weightDelta;
    return right.absoluteCorrelation - left.absoluteCorrelation;
  });

  return {
    sampleSize: examples.length,
    homeWins,
    awayWins,
    logisticBias: roundSignalMetric(multivariateModel.bias),
    signals: signals.map((signal, index) => ({ ...signal, rank: index + 1 })),
    leakageChecks: buildBaselineFeatureLeakageChecks(),
  };
}

export function getConfidenceLabel(probability: number): GamePredictionResult["confidenceLabel"] {
  const edge = Math.abs(probability - 0.5);
  if (edge >= 0.15) return "high";
  if (edge >= 0.07) return "medium";
  return "low";
}

function marketEdgeBucket(edge: number | null): string | null {
  if (edge == null || !Number.isFinite(edge)) return null;
  const absoluteEdge = Math.abs(edge);
  if (absoluteEdge >= 0.08) return edge > 0 ? "home_large" : "away_large";
  if (absoluteEdge >= 0.04) return edge > 0 ? "home_medium" : "away_medium";
  if (absoluteEdge >= 0.015) return edge > 0 ? "home_small" : "away_small";
  return "efficient";
}

function buildTopFactors(
  model: BinaryLogisticModel,
  features: number[],
  limit = 5
): GamePredictionTopFactor[] {
  const featureKeys = BASELINE_FEATURE_KEYS.slice(0, model.featureCount);
  const modelFeatures = features.slice(0, model.featureCount);
  const normalizedFeatures = normalizeFeatureVector(
    modelFeatures,
    (model as GamePredictionBaselineModel).featureNormalization,
  );
  return featureKeys.map((featureKey, index) => {
    const value = modelFeatures[index] ?? 0;
    const weight = model.weights[index] ?? 0;
    return {
      featureKey,
      value,
      weight,
      contribution: (normalizedFeatures[index] ?? 0) * weight,
    };
  })
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, limit);
}

function predictExtraTreeNodeProbability(
  node: GamePredictionExtraTreesNode,
  features: number[],
): number {
  if (node.type === "leaf") return node.probability;
  return (features[node.featureIndex] ?? 0) <= node.threshold
    ? predictExtraTreeNodeProbability(node.left, features)
    : predictExtraTreeNodeProbability(node.right, features);
}

export function predictExtraTreesHomeWinProbability(
  model: GamePredictionExtraTreesModel,
  features: number[],
): number {
  if (features.length !== model.featureCount) {
    throw new Error(
      `Expected ${model.featureCount} features but received ${features.length}.`,
    );
  }
  if (model.trees.length === 0) return model.priorProbability;
  return clipProbability(
    mean(
      model.trees.map((tree) =>
        predictExtraTreeNodeProbability(tree, features),
      ),
    ),
  );
}

function buildExtraTreesTopFactors(
  model: GamePredictionExtraTreesModel,
  features: number[],
  limit = 5,
): GamePredictionTopFactor[] {
  return BASELINE_FEATURE_KEYS.slice(0, model.featureCount)
    .map((featureKey, index) => {
      const importance = model.featureImportances[index] ?? 0;
      const value = features[index] ?? 0;
      return {
        featureKey,
        value,
        weight: importance,
        contribution: value * importance,
      };
    })
    .filter((factor) => factor.weight > 0)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, limit);
}

export function predictGameWithExtraTreesModel(args: {
  payload: GamePredictionFeatureSnapshotPayload;
  model: GamePredictionExtraTreesModel;
  predictionCutoffAt: string;
  calibrator?: ProbabilityCalibrator;
  modelName?: string;
  modelVersion?: string;
  featureVectorOptions?: BaselineFeatureVectorOptions;
  disableDataQualityDampening?: boolean;
  winnerDecisionThreshold?: number;
  modelAuditMetadata?: GamePredictionModelAuditMetadata;
}): GamePredictionResult {
  const features = buildBaselineFeatureVector(
    args.payload,
    args.featureVectorOptions,
  );
  const modelFeatures = features.slice(0, args.model.featureCount);
  const rawHomeProbability = predictExtraTreesHomeWinProbability(
    args.model,
    modelFeatures,
  );
  const calibratedHomeProbability = args.calibrator
    ? args.calibrator.predict(rawHomeProbability)
    : rawHomeProbability;
  const dataQuality = args.disableDataQualityDampening
    ? { multiplier: 1, penalties: {} }
    : buildDataQualityMultiplier(args.payload);
  const qualityAdjustedHomeProbability = dampenTowardCoinFlip(
    calibratedHomeProbability,
    dataQuality.multiplier,
  );
  const homeWinProbability = roundProbability(
    applyProbabilityFloor(
      qualityAdjustedHomeProbability,
      args.model as unknown as BinaryLogisticModel,
    ),
  );
  const awayWinProbability = roundProbability(1 - homeWinProbability);
  const marketHomeNoVigProbability =
    args.payload.market?.homeNoVigProbability ?? null;
  const modelVsMarketEdge =
    marketHomeNoVigProbability == null
      ? null
      : roundSignalMetric(homeWinProbability - marketHomeNoVigProbability);
  const modelMarketEdgeBucket = marketEdgeBucket(modelVsMarketEdge);
  const winnerDecisionThreshold = Math.max(
    0.01,
    Math.min(
      0.99,
      args.winnerDecisionThreshold ?? BASELINE_WINNER_DECISION_THRESHOLD,
    ),
  );
  const excludedFeatureKeys = getExcludedFeatureKeys(args.featureVectorOptions);
  const threshold50WinnerTeamId =
    homeWinProbability >= 0.5
      ? args.payload.home.teamId
      : args.payload.away.teamId;
  const selectedThresholdWinnerTeamId =
    homeWinProbability >= winnerDecisionThreshold
      ? args.payload.home.teamId
      : args.payload.away.teamId;
  const modelAuditMetadata = buildModelAuditMetadata({
    selectedWinnerThreshold: winnerDecisionThreshold,
    modelAuditMetadata: {
      candidateModelFamily: "extra_trees",
      ...args.modelAuditMetadata,
    },
  });

  return {
    gameId: args.payload.gameId,
    snapshotDate: args.payload.gameDate,
    predictionScope: "pregame",
    predictionCutoffAt: args.predictionCutoffAt,
    modelName: args.modelName ?? BASELINE_MODEL_NAME,
    modelVersion: args.modelVersion ?? BASELINE_MODEL_VERSION,
    featureSetVersion: args.payload.featureSetVersion,
    homeTeamId: args.payload.home.teamId,
    awayTeamId: args.payload.away.teamId,
    homeWinProbability,
    awayWinProbability,
    predictedWinnerTeamId: selectedThresholdWinnerTeamId,
    confidenceLabel: getConfidenceLabel(homeWinProbability),
    topFactors: buildExtraTreesTopFactors(args.model, features),
    components: {
      baseline_features: Object.fromEntries(
        BASELINE_FEATURE_KEYS.map((featureKey, index) => [featureKey, features[index]]),
      ) as Json,
      raw_home_win_probability: rawHomeProbability,
      calibrated_home_win_probability: calibratedHomeProbability,
      quality_adjusted_home_win_probability: qualityAdjustedHomeProbability,
      bounded_home_win_probability: homeWinProbability,
      calibration_method: args.calibrator?.method ?? "raw_extra_trees",
      data_quality_multiplier: dataQuality.multiplier,
      data_quality_penalties: dataQuality.penalties,
      market: args.payload.market as unknown as Json,
      model_vs_market_edge: modelVsMarketEdge,
      market_edge_bucket: modelMarketEdgeBucket,
      probability_floor: args.model.probabilityFloor ?? BASELINE_PROBABILITY_FLOOR,
      model_family: "extra_trees",
      tree_count: args.model.trees.length,
      extra_trees_options: args.model.options as unknown as Json,
      feature_importances: Object.fromEntries(
        BASELINE_FEATURE_KEYS.map((featureKey, index) => [
          featureKey,
          args.model.featureImportances[index] ?? 0,
        ]),
      ) as Json,
      excluded_feature_keys: excludedFeatureKeys as unknown as Json,
      winner_decision_threshold: winnerDecisionThreshold,
      threshold_50_predicted_winner_team_id: threshold50WinnerTeamId,
      selected_threshold_predicted_winner_team_id: selectedThresholdWinnerTeamId,
      model_audit: modelAuditMetadata as unknown as Json,
    },
    provenance: {
      source_cutoffs: args.payload.sourceCutoffs as unknown as Json,
      missing_features: args.payload.missingFeatures as unknown as Json,
      fallback_flags: args.payload.fallbackFlags as unknown as Json,
    },
    metadata: {
      confidence_label: getConfidenceLabel(homeWinProbability),
      feature_set_version: args.payload.featureSetVersion,
      game_type: args.payload.gameType,
      has_stale_source: args.payload.sourceCutoffs.some((cutoff) => cutoff.stale),
      season_phase: args.payload.seasonPhase.phase,
      season_phase_ordinal: args.payload.seasonPhase.ordinal,
      home_games_played_as_of: args.payload.seasonPhase.homeGamesPlayed,
      away_games_played_as_of: args.payload.seasonPhase.awayGamesPlayed,
      market_probability_available: args.payload.market != null,
      market_odds_source_name: args.payload.market?.sourceName ?? null,
      market_odds_provider: args.payload.market?.provider ?? null,
      market_odds_captured_at: args.payload.market?.capturedAt ?? null,
      market_odds_import_recorded_at:
        args.payload.market?.importRecordedAt ?? null,
      market_odds_import_batch_id: args.payload.market?.importBatchId ?? null,
      home_market_no_vig_probability: marketHomeNoVigProbability,
      model_vs_market_edge: modelVsMarketEdge,
      market_edge_bucket: modelMarketEdgeBucket,
      home_goalie_start_uncertainty: args.payload.home.goalie.startUncertainty,
      away_goalie_start_uncertainty: args.payload.away.goalie.startUncertainty,
      goalie_confirmation_state:
        args.payload.home.goalie.confirmed && args.payload.away.goalie.confirmed
          ? "both_confirmed"
          : args.payload.home.goalie.confirmed || args.payload.away.goalie.confirmed
            ? "partial_confirmed"
            : "projected_or_fallback",
      warnings: args.payload.warnings as unknown as Json,
      data_quality_multiplier: dataQuality.multiplier,
      excluded_feature_keys: excludedFeatureKeys as unknown as Json,
      winner_decision_threshold: winnerDecisionThreshold,
      threshold_50_predicted_winner_team_id: threshold50WinnerTeamId,
      selected_threshold_predicted_winner_team_id: selectedThresholdWinnerTeamId,
      model_family: "extra_trees",
      model_audit: modelAuditMetadata as unknown as Json,
      public_explanation_feature_keys: [] as unknown as Json,
    },
  };
}

export function predictGameWithBaselineModel(args: {
  payload: GamePredictionFeatureSnapshotPayload;
  model: BinaryLogisticModel;
  predictionCutoffAt: string;
  calibrator?: ProbabilityCalibrator;
  modelName?: string;
  modelVersion?: string;
  featureVectorOptions?: BaselineFeatureVectorOptions;
  disableDataQualityDampening?: boolean;
  winnerDecisionThreshold?: number;
  modelAuditMetadata?: GamePredictionModelAuditMetadata;
}): GamePredictionResult {
  const features = buildBaselineFeatureVector(
    args.payload,
    args.featureVectorOptions,
  );
  const modelFeatures = features.slice(0, args.model.featureCount);
  const normalizedFeatures = normalizeFeatureVector(
    modelFeatures,
    (args.model as GamePredictionBaselineModel).featureNormalization,
  );
  const rawHomeProbability = predictBaselineModelRawHomeWinProbability(
    args.model,
    features,
  );
  const calibratedHomeProbability = args.calibrator
    ? args.calibrator.predict(rawHomeProbability)
    : rawHomeProbability;
  const dataQuality = args.disableDataQualityDampening
    ? { multiplier: 1, penalties: {} }
    : buildDataQualityMultiplier(args.payload);
  const qualityAdjustedHomeProbability = dampenTowardCoinFlip(
    calibratedHomeProbability,
    dataQuality.multiplier,
  );
  const homeWinProbability = roundProbability(
    applyProbabilityFloor(qualityAdjustedHomeProbability, args.model),
  );
  const awayWinProbability = roundProbability(1 - homeWinProbability);
  const marketHomeNoVigProbability =
    args.payload.market?.homeNoVigProbability ?? null;
  const modelVsMarketEdge =
    marketHomeNoVigProbability == null
      ? null
      : roundSignalMetric(homeWinProbability - marketHomeNoVigProbability);
  const modelMarketEdgeBucket = marketEdgeBucket(modelVsMarketEdge);
  const winnerDecisionThreshold = Math.max(
    0.01,
    Math.min(
      0.99,
      args.winnerDecisionThreshold ?? BASELINE_WINNER_DECISION_THRESHOLD,
    ),
  );
  const excludedFeatureKeys = getExcludedFeatureKeys(args.featureVectorOptions);
  const threshold50WinnerTeamId =
    homeWinProbability >= 0.5
      ? args.payload.home.teamId
      : args.payload.away.teamId;
  const selectedThresholdWinnerTeamId =
    homeWinProbability >= winnerDecisionThreshold
      ? args.payload.home.teamId
      : args.payload.away.teamId;
  const modelAuditMetadata = buildModelAuditMetadata({
    selectedWinnerThreshold: winnerDecisionThreshold,
    modelAuditMetadata: args.modelAuditMetadata,
  });

  return {
    gameId: args.payload.gameId,
    snapshotDate: args.payload.gameDate,
    predictionScope: "pregame",
    predictionCutoffAt: args.predictionCutoffAt,
    modelName: args.modelName ?? BASELINE_MODEL_NAME,
    modelVersion: args.modelVersion ?? BASELINE_MODEL_VERSION,
    featureSetVersion: args.payload.featureSetVersion,
    homeTeamId: args.payload.home.teamId,
    awayTeamId: args.payload.away.teamId,
    homeWinProbability,
    awayWinProbability,
    predictedWinnerTeamId: selectedThresholdWinnerTeamId,
    confidenceLabel: getConfidenceLabel(homeWinProbability),
    topFactors: buildTopFactors(args.model, features),
    components: {
      baseline_features: Object.fromEntries(
        BASELINE_FEATURE_KEYS.map((featureKey, index) => [featureKey, features[index]])
      ) as Json,
      normalized_baseline_features: Object.fromEntries(
        BASELINE_FEATURE_KEYS.map((featureKey, index) => [
          featureKey,
          normalizedFeatures[index] ?? null,
        ])
      ) as Json,
      raw_home_win_probability: rawHomeProbability,
      quality_adjusted_home_win_probability: qualityAdjustedHomeProbability,
      bounded_home_win_probability: homeWinProbability,
      calibration_method: args.calibrator?.method ?? "raw",
      data_quality_multiplier: dataQuality.multiplier,
      data_quality_penalties: dataQuality.penalties,
      market: args.payload.market as unknown as Json,
      model_vs_market_edge: modelVsMarketEdge,
      market_edge_bucket: modelMarketEdgeBucket,
      probability_floor:
        (args.model as GamePredictionBaselineModel).probabilityFloor ??
        BASELINE_PROBABILITY_FLOOR,
      normalization_method: (args.model as GamePredictionBaselineModel)
        .featureNormalization
        ? "training_set_standard_score"
        : "none",
      excluded_feature_keys: excludedFeatureKeys as unknown as Json,
      winner_decision_threshold: winnerDecisionThreshold,
      threshold_50_predicted_winner_team_id: threshold50WinnerTeamId,
      selected_threshold_predicted_winner_team_id: selectedThresholdWinnerTeamId,
      model_audit: modelAuditMetadata as unknown as Json,
    },
    provenance: {
      source_cutoffs: args.payload.sourceCutoffs as unknown as Json,
      missing_features: args.payload.missingFeatures as unknown as Json,
      fallback_flags: args.payload.fallbackFlags as unknown as Json,
    },
    metadata: {
      confidence_label: getConfidenceLabel(homeWinProbability),
      feature_set_version: args.payload.featureSetVersion,
      game_type: args.payload.gameType,
      has_stale_source: args.payload.sourceCutoffs.some((cutoff) => cutoff.stale),
      season_phase: args.payload.seasonPhase.phase,
      season_phase_ordinal: args.payload.seasonPhase.ordinal,
      home_games_played_as_of: args.payload.seasonPhase.homeGamesPlayed,
      away_games_played_as_of: args.payload.seasonPhase.awayGamesPlayed,
      market_probability_available: args.payload.market != null,
      market_odds_source_name: args.payload.market?.sourceName ?? null,
      market_odds_provider: args.payload.market?.provider ?? null,
      market_odds_captured_at: args.payload.market?.capturedAt ?? null,
      market_odds_import_recorded_at:
        args.payload.market?.importRecordedAt ?? null,
      market_odds_import_batch_id: args.payload.market?.importBatchId ?? null,
      home_market_no_vig_probability: marketHomeNoVigProbability,
      model_vs_market_edge: modelVsMarketEdge,
      market_edge_bucket: modelMarketEdgeBucket,
      home_goalie_start_uncertainty: args.payload.home.goalie.startUncertainty,
      away_goalie_start_uncertainty: args.payload.away.goalie.startUncertainty,
      goalie_confirmation_state:
        args.payload.home.goalie.confirmed && args.payload.away.goalie.confirmed
          ? "both_confirmed"
          : args.payload.home.goalie.confirmed || args.payload.away.goalie.confirmed
            ? "partial_confirmed"
            : "projected_or_fallback",
      warnings: args.payload.warnings as unknown as Json,
      data_quality_multiplier: dataQuality.multiplier,
      excluded_feature_keys: excludedFeatureKeys as unknown as Json,
      winner_decision_threshold: winnerDecisionThreshold,
      threshold_50_predicted_winner_team_id: threshold50WinnerTeamId,
      selected_threshold_predicted_winner_team_id: selectedThresholdWinnerTeamId,
      model_audit: modelAuditMetadata as unknown as Json,
      public_explanation_feature_keys:
        PUBLIC_EXPLANATION_FEATURE_KEYS as unknown as Json,
    },
  };
}

export function buildGamePredictionHistoryInsert(args: {
  prediction: GamePredictionResult;
  featureSnapshotId: string;
  runId?: string | null;
}): Database["public"]["Tables"]["game_prediction_history"]["Insert"] {
  const { prediction } = args;
  return {
    feature_snapshot_id: args.featureSnapshotId,
    run_id: args.runId ?? null,
    snapshot_date: prediction.snapshotDate,
    game_id: prediction.gameId,
    prediction_scope: prediction.predictionScope,
    prediction_cutoff_at: prediction.predictionCutoffAt,
    model_name: prediction.modelName,
    model_version: prediction.modelVersion,
    feature_set_version: prediction.featureSetVersion,
    home_team_id: prediction.homeTeamId,
    away_team_id: prediction.awayTeamId,
    home_win_probability: prediction.homeWinProbability,
    away_win_probability: prediction.awayWinProbability,
    predicted_winner_team_id: prediction.predictedWinnerTeamId,
    confidence_label: prediction.confidenceLabel,
    top_factors: prediction.topFactors as unknown as Json,
    components: prediction.components,
    provenance: prediction.provenance,
    metadata: prediction.metadata,
    computed_at: prediction.predictionCutoffAt,
  };
}

export function buildGamePredictionOutputUpsert(
  prediction: GamePredictionResult
): Database["public"]["Tables"]["game_prediction_outputs"]["Insert"] {
  return {
    snapshot_date: prediction.snapshotDate,
    game_id: prediction.gameId,
    model_name: prediction.modelName,
    model_version: prediction.modelVersion,
    prediction_scope: prediction.predictionScope,
    home_team_id: prediction.homeTeamId,
    away_team_id: prediction.awayTeamId,
    home_win_probability: prediction.homeWinProbability,
    away_win_probability: prediction.awayWinProbability,
    components: {
      ...prediction.components,
      top_factors: prediction.topFactors as unknown as Json,
    },
    provenance: prediction.provenance,
    metadata: prediction.metadata,
    computed_at: prediction.predictionCutoffAt,
    updated_at: new Date().toISOString(),
  };
}

export async function persistGamePrediction(args: {
  client: SupabaseClient<Database>;
  prediction: GamePredictionResult;
  featureSnapshotId: string;
  runId?: string | null;
}): Promise<string> {
  const historyInsert = buildGamePredictionHistoryInsert({
    prediction: args.prediction,
    featureSnapshotId: args.featureSnapshotId,
    runId: args.runId,
  });
  const { data, error } = await args.client
    .from("game_prediction_history")
    .insert(historyInsert)
    .select("prediction_id")
    .single();
  if (error) throw error;

  const { error: latestError } = await args.client
    .from("game_prediction_outputs")
    .upsert(buildGamePredictionOutputUpsert(args.prediction), {
      onConflict: "snapshot_date,game_id,model_name,model_version,prediction_scope",
    });
  if (latestError) throw latestError;

  return data.prediction_id;
}
