import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import crypto from "crypto";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/supabase/database-generated.types";
import { buildShotFeatureRows, type NhlShotFeatureRow } from "../lib/supabase/Upserts/nhlShotFeatureBuilder";
import type { ParsedNhlPbpEvent } from "../lib/supabase/Upserts/nhlPlayByPlayParser";
import {
  BASELINE_FEATURE_FAMILY_PRESETS,
  buildEncodedBaselineDataset,
  BOOLEAN_FEATURE_KEYS,
  CATEGORICAL_FEATURE_KEYS,
  type BaselinePredictionType,
  type BaselineFeatureFamilyName,
  NUMERIC_FEATURE_KEYS,
  type EncodedBaselineExample,
  type BaselineSplitConfig,
} from "../lib/xg/baselineDataset";
import {
  predictBinaryLogisticProbability,
  trainBinaryLogisticModel,
  type BinaryLogisticModel,
  type BinaryLogisticFitOptions,
} from "../lib/xg/binaryLogistic";
import {
  assessCalibration,
  fitProbabilityCalibrator,
  type CalibrationAssessment,
  type CalibrationMethodName,
  type CalibrationExample,
  type SerializedCalibrationModel,
} from "../lib/xg/calibration";
import {
  buildShooterGoalieHandednessMatchup,
  normalizeShootsCatchesValue,
} from "../lib/xg/handedness";
import {
  buildDeploymentContextForShot,
  buildShiftStintsByGameId,
} from "../lib/xg/deploymentContext";
import {
  buildShooterPositionGroup,
  normalizeRosterPosition,
} from "../lib/xg/rosterPosition";
const { XGBoost } = require("@fractal-solutions/xgboost-js") as {
  XGBoost: new (config: Record<string, number>) => {
    fit: (features: number[][], labels: number[]) => void;
    predictSingle: (features: number[]) => number;
    getFeatureImportance: () => number[];
    toJSON: () => unknown;
  };
};

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

type CliOptions = {
  season: number;
  outputDir: string;
  family: string;
  predictionType: BaselinePredictionType;
  featureFamily: BaselineFeatureFamilyName;
  parserVersion: number;
  strengthVersion: number;
  featureVersion: number;
  limitGames: number | null;
  gameIds: number[] | null;
  seed: number;
  trainRatio: number;
  validationRatio: number;
  testRatio: number | null;
  numericFeatures: string[] | null;
  booleanFeatures: string[] | null;
  categoricalFeatures: string[] | null;
  iterations: number | null;
  learningRate: number | null;
  l1: number | null;
  l2: number | null;
  maxDepth: number | null;
  minChildWeight: number | null;
  numRounds: number | null;
};

type GameRow = {
  id: number;
  date: string | null;
  seasonId: number;
  homeTeamId: number;
  awayTeamId: number;
};

type PbpEventRow = Database["public"]["Tables"]["nhl_api_pbp_events"]["Row"];
type ShiftRow = Database["public"]["Tables"]["nhl_api_shift_rows"]["Row"];
type PlayerRow = Database["public"]["Tables"]["players"]["Row"];
type PlayerStatsUnifiedRow = Database["public"]["Views"]["player_stats_unified"]["Row"];
type GoalieStatsUnifiedRow = Database["public"]["Views"]["goalie_stats_unified"]["Row"];
type RosterPositionCode = "L" | "R" | "C" | "D" | "G";
type SupabaseClient = ReturnType<typeof createSupabaseClient>;
type ScoredExample = EncodedBaselineExample & {
  prediction: number;
};
type HoldoutScoreRow = {
  rowId: string;
  split: "validation" | "test";
  label: 0 | 1;
  prediction: number;
  strengthState: string | null;
  isReboundShot: boolean;
  isRushShot: boolean;
};
type CalibrationBin = {
  binIndex: number;
  lowerBoundInclusive: number;
  upperBoundExclusive: number;
  count: number;
  avgPrediction: number | null;
  observedGoalRate: number | null;
};
type SplitEvaluation = {
  exampleCount: number;
  goalCount: number;
  goalRate: number | null;
  averagePrediction: number | null;
  logLoss: number | null;
  brierScore: number | null;
  calibrationBins: CalibrationBin[];
};
type SliceEvaluation = {
  sliceName: string;
  sliceValue: string;
  evaluation: SplitEvaluation;
};
type ApprovalGradeEligibility = {
  isEligible: boolean;
  blockingReasons: string[];
};
type FeatureTransforms = {
  numericStandardization?: Record<string, { mean: number; std: number }>;
};
type DatasetArtifactPayload = {
  artifactKind: "nhl_xg_training_dataset";
  artifactVersion: number;
  artifactTag: string;
  generatedAt: string;
  sourceCommitSha: string | null;
  seasonScope: number;
  parserVersion: number;
  strengthVersion: number;
  featureVersion: number;
  predictionType: BaselinePredictionType;
  datasetContractRef: string;
  featureContractRef: string;
  materializationDecisionRef: string;
  randomSeed: number;
  splitConfig: BaselineSplitConfig;
  splitStrategy: string;
  featureFamily: string;
  selectedFeatures: {
    numeric: string[];
    boolean: string[];
    categorical: string[];
  };
  splitAssignments: Array<{ gameId: number; split: "train" | "validation" | "test" }>;
  splitCounts: Record<"train" | "validation" | "test", number>;
  featureKeys: string[];
  categoricalLevels: Record<string, string[]>;
  approvalGradeEligibility: ApprovalGradeEligibility;
  rowCount: number;
  rowIds: string[];
};
type ModelArtifactPayload = {
  artifactKind: "nhl_xg_model";
  artifactVersion: number;
  artifactTag: string;
  family: string;
  generatedAt: string;
  sourceCommitSha: string | null;
  parserVersion: number;
  strengthVersion: number;
  featureVersion: number;
  predictionType: BaselinePredictionType;
  seasonScope: number;
  randomSeed: number;
  splitConfig: BaselineSplitConfig;
  splitStrategy: string;
  featureFamily: string;
  selectedFeatures: {
    numeric: string[];
    boolean: string[];
    categorical: string[];
  };
  featureKeys: string[];
  featureTransforms?: FeatureTransforms;
  trainExampleCount: number;
  validationExampleCount: number;
  testExampleCount: number;
  fitOptions: Record<string, number>;
  evaluation: Record<"overall" | "train" | "validation" | "test", SplitEvaluation>;
  holdoutEvaluation: SplitEvaluation;
  holdoutSliceEvaluations: {
    strengthState: SliceEvaluation[];
    rebound: SliceEvaluation[];
    rush: SliceEvaluation[];
  };
  holdoutScores: HoldoutScoreRow[];
  calibrationAssessment: CalibrationAssessment;
  calibration?: {
    selectedMethod: CalibrationMethodName;
    fitSplit: "validation" | "none";
    fitExampleCount: number;
    applied: boolean;
    reason: string;
    model: SerializedCalibrationModel;
  };
  approvalGradeEligibility: ApprovalGradeEligibility;
  featureImportance?: Array<{ featureKey: string; importance: number }>;
  model: unknown;
};

function assertNoLeakedBaselineArtifactFeatures(args: {
  selectedFeatures: {
    numeric: string[];
    boolean: string[];
    categorical: string[];
  };
  featureKeys: string[];
}): void {
  if (args.selectedFeatures.categorical.includes("shotEventType")) {
    throw new Error(
      "Baseline artifact generation refused to persist leaked feature selection: shotEventType."
    );
  }

  const leakedFeatureKeys = args.featureKeys.filter((featureKey) =>
    featureKey.startsWith("shotEventType:")
  );
  if (leakedFeatureKeys.length) {
    throw new Error(
      `Baseline artifact generation refused to persist leaked feature keys: ${Array.from(
        new Set(leakedFeatureKeys)
      ).join(", ")}.`
    );
  }
}

function printHelp(): void {
  console.log(`Usage: npm run train:nhl-xg-baseline -- [options]

Options:
  --season <seasonId>          Season id to train on. Default: 20252026
  --family <name>              Model family. Default: xgboost_js
  --predictionType <name>      Prediction target: shot_goal or rebound_creation. Default: shot_goal
  --featureFamily <name>       Feature family preset. Default: first_pass_v1
  --parserVersion <n>          Required parser version. Default: 1
  --strengthVersion <n>        Required strength version. Default: 1
  --featureVersion <n>         Feature version recorded in the artifact. Default: 1
  --limitGames <n>             Optional cap on games for local smoke runs
  --gameIds <csv>              Optional explicit game id list override
  --seed <n>                   Deterministic seed for split assignment. Default: 42
  --trainRatio <n>             Train split ratio. Default: 0.7
  --validationRatio <n>        Validation split ratio. Default: 0.15
  --testRatio <n>              Optional explicit test split ratio. Default: inferred remainder
  --numericFeatures <csv>      Optional numeric feature subset
  --booleanFeatures <csv>      Optional boolean feature subset
  --categoricalFeatures <csv>  Optional categorical feature subset
  --iterations <n>             Optional override for optimizer iterations
  --learningRate <n>           Optional override for optimizer learning rate
  --l1 <n>                     Optional override for L1 penalty strength
  --l2 <n>                     Optional override for L2 penalty strength
  --maxDepth <n>               Optional boosting tree depth override
  --minChildWeight <n>         Optional boosting min-child-weight override
  --numRounds <n>              Optional boosting round-count override
  --outputDir <path>           Output directory. Default: scripts/output/xg-baselines
  --help                       Show this help
`);
}

const SUPABASE_PAGE_SIZE = 1000;
const MIN_APPROVAL_HOLDOUT_POSITIVES = 10;
const MIN_APPROVAL_TEST_POSITIVES = 10;
const MIN_NON_COLLAPSED_AVERAGE_PREDICTION = 0.001;
const MAX_NON_COLLAPSED_AVERAGE_PREDICTION = 0.999;
const MIN_REBOUND_CREATION_VALIDATION_EXAMPLES = 1000;
const MIN_REBOUND_CREATION_TEST_EXAMPLES = 1000;
const MIN_REBOUND_CREATION_VALIDATION_POSITIVES = 100;
const MIN_REBOUND_CREATION_TEST_POSITIVES = 100;
const MIN_REBOUND_CREATION_HOLDOUT_POSITIVES = 250;
const MAX_REBOUND_CREATION_VALIDATION_TEST_RATE_DELTA = 0.025;
const MAX_REBOUND_CREATION_HOLDOUT_CALIBRATION_DELTA = 0.025;

function binaryLogLossBaseline(positiveRate: number): number | null {
  if (!Number.isFinite(positiveRate) || positiveRate <= 0 || positiveRate >= 1) {
    return null;
  }

  return -(
    positiveRate * Math.log(positiveRate) +
    (1 - positiveRate) * Math.log(1 - positiveRate)
  );
}

function binaryBrierBaseline(positiveRate: number): number | null {
  if (!Number.isFinite(positiveRate) || positiveRate < 0 || positiveRate > 1) {
    return null;
  }

  return positiveRate * (1 - positiveRate);
}

function buildReboundCreationApprovalBlockingReasons(args: {
  evaluation: Record<"overall" | "train" | "validation" | "test", SplitEvaluation>;
  holdoutEvaluation: SplitEvaluation;
  calibrationAssessment: CalibrationAssessment;
}): string[] {
  const blockingReasons: string[] = [];
  const validation = args.evaluation.validation;
  const test = args.evaluation.test;
  const holdout = args.holdoutEvaluation;

  if (validation.exampleCount < MIN_REBOUND_CREATION_VALIDATION_EXAMPLES) {
    blockingReasons.push(
      `Rebound-creation validation split has ${validation.exampleCount} examples; approval requires at least ${MIN_REBOUND_CREATION_VALIDATION_EXAMPLES}.`
    );
  }

  if (test.exampleCount < MIN_REBOUND_CREATION_TEST_EXAMPLES) {
    blockingReasons.push(
      `Rebound-creation test split has ${test.exampleCount} examples; approval requires at least ${MIN_REBOUND_CREATION_TEST_EXAMPLES}.`
    );
  }

  if (validation.goalCount < MIN_REBOUND_CREATION_VALIDATION_POSITIVES) {
    blockingReasons.push(
      `Rebound-creation validation split has ${validation.goalCount} positive labels; approval requires at least ${MIN_REBOUND_CREATION_VALIDATION_POSITIVES}.`
    );
  }

  if (test.goalCount < MIN_REBOUND_CREATION_TEST_POSITIVES) {
    blockingReasons.push(
      `Rebound-creation test split has ${test.goalCount} positive labels; approval requires at least ${MIN_REBOUND_CREATION_TEST_POSITIVES}.`
    );
  }

  if (holdout.goalCount < MIN_REBOUND_CREATION_HOLDOUT_POSITIVES) {
    blockingReasons.push(
      `Rebound-creation validation+test holdout has ${holdout.goalCount} positive labels; approval requires at least ${MIN_REBOUND_CREATION_HOLDOUT_POSITIVES}.`
    );
  }

  if (validation.goalRate == null || test.goalRate == null) {
    blockingReasons.push(
      "Rebound-creation validation/test positive rates are unavailable; approval requires stable positive-rate diagnostics."
    );
  } else {
    const rateDelta = Math.abs(validation.goalRate - test.goalRate);
    if (rateDelta > MAX_REBOUND_CREATION_VALIDATION_TEST_RATE_DELTA) {
      blockingReasons.push(
        `Rebound-creation validation/test positive-rate delta is ${rateDelta.toFixed(6)}; approval allows at most ${MAX_REBOUND_CREATION_VALIDATION_TEST_RATE_DELTA}.`
      );
    }
  }

  if (holdout.goalRate == null || holdout.averagePrediction == null) {
    blockingReasons.push(
      "Rebound-creation holdout calibration diagnostics are unavailable; approval requires observed and predicted holdout rates."
    );
  } else {
    const calibrationDelta = Math.abs(holdout.averagePrediction - holdout.goalRate);
    if (calibrationDelta > MAX_REBOUND_CREATION_HOLDOUT_CALIBRATION_DELTA) {
      blockingReasons.push(
        `Rebound-creation holdout calibration delta is ${calibrationDelta.toFixed(6)}; approval allows at most ${MAX_REBOUND_CREATION_HOLDOUT_CALIBRATION_DELTA}.`
      );
    }
  }

  const holdoutLogLossBaseline =
    holdout.goalRate == null ? null : binaryLogLossBaseline(holdout.goalRate);
  if (
    holdout.logLoss == null ||
    holdoutLogLossBaseline == null ||
    holdout.logLoss >= holdoutLogLossBaseline
  ) {
    blockingReasons.push(
      "Rebound-creation holdout log loss does not beat the base-rate baseline."
    );
  }

  const holdoutBrierBaseline =
    holdout.goalRate == null ? null : binaryBrierBaseline(holdout.goalRate);
  if (
    holdout.brierScore == null ||
    holdoutBrierBaseline == null ||
    holdout.brierScore >= holdoutBrierBaseline
  ) {
    blockingReasons.push(
      "Rebound-creation holdout Brier score does not beat the base-rate baseline."
    );
  }

  for (const reason of args.calibrationAssessment.adoptabilityBlockingReasons) {
    if (!blockingReasons.includes(reason)) {
      blockingReasons.push(reason);
    }
  }

  if (
    args.calibrationAssessment.requiresPostCalibration &&
    args.calibrationAssessment.adoptableMethod == null
  ) {
    blockingReasons.push(
      "Rebound-creation post-calibration is required, but no calibration method is currently adoptable."
    );
  }

  return blockingReasons;
}

function buildApprovalGradeEligibility(args: {
  predictionType: BaselinePredictionType;
  splitCounts: Record<"train" | "validation" | "test", number>;
  evaluation: Record<"overall" | "train" | "validation" | "test", SplitEvaluation>;
  holdoutEvaluation: SplitEvaluation;
  testEvaluation: SplitEvaluation;
  calibrationAssessment: CalibrationAssessment;
}): ApprovalGradeEligibility {
  if (args.predictionType === "rebound_creation") {
    const blockingReasons = buildReboundCreationApprovalBlockingReasons({
      evaluation: args.evaluation,
      holdoutEvaluation: args.holdoutEvaluation,
      calibrationAssessment: args.calibrationAssessment,
    });

    return {
      isEligible: blockingReasons.length === 0,
      blockingReasons,
    };
  }

  const blockingReasons: string[] = [];

  if (args.splitCounts.test <= 0) {
    blockingReasons.push(
      "Dedicated test split is empty; approval-grade benchmark artifacts require at least one test example."
    );
  }

  if (args.testEvaluation.goalCount < MIN_APPROVAL_TEST_POSITIVES) {
    blockingReasons.push(
      `Dedicated test split has ${args.testEvaluation.goalCount} goals; approval-grade benchmark artifacts require at least ${MIN_APPROVAL_TEST_POSITIVES}.`
    );
  }

  if (args.holdoutEvaluation.goalCount < MIN_APPROVAL_HOLDOUT_POSITIVES) {
    blockingReasons.push(
      `Validation+test holdout has ${args.holdoutEvaluation.goalCount} goals; approval-grade benchmark artifacts require at least ${MIN_APPROVAL_HOLDOUT_POSITIVES}.`
    );
  }

  const averagePrediction = args.holdoutEvaluation.averagePrediction;
  if (
    averagePrediction == null ||
    averagePrediction <= MIN_NON_COLLAPSED_AVERAGE_PREDICTION ||
    averagePrediction >= MAX_NON_COLLAPSED_AVERAGE_PREDICTION
  ) {
    blockingReasons.push(
      "Validation+test holdout average prediction is collapsed or unavailable; approval-grade artifacts require non-degenerate probabilities."
    );
  }

  for (const reason of args.calibrationAssessment.adoptabilityBlockingReasons) {
    if (!blockingReasons.includes(reason)) {
      blockingReasons.push(reason);
    }
  }

  if (
    args.calibrationAssessment.requiresPostCalibration &&
    args.calibrationAssessment.adoptableMethod == null
  ) {
    blockingReasons.push(
      "Post-calibration is required, but no calibration method is currently adoptable."
    );
  }

  return {
    isEligible: blockingReasons.length === 0,
    blockingReasons,
  };
}

function parseIntegerList(value: string | undefined): number[] | null {
  if (!value) return null;
  const parsed = value
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isInteger(entry) && entry > 0);

  return parsed.length > 0 ? parsed : null;
}

function parseStringList(value: string | undefined): string[] | null {
  if (!value) return null;

  const parsed = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return parsed.length > 0 ? Array.from(new Set(parsed)) : null;
}

function parseFeatureSubset(
  provided: string[] | null,
  allowed: readonly string[],
  flagName: string
): string[] | null {
  if (!provided?.length) {
    return null;
  }

  const invalid = provided.filter((entry) => !allowed.includes(entry));
  if (invalid.length) {
    throw new Error(
      `Invalid ${flagName} entries: ${invalid.join(", ")}. Allowed values: ${allowed.join(", ")}.`
    );
  }

  return provided;
}

function parseCliArgs(argv: string[]): CliOptions {
  const options: Record<string, string> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;

    const withoutPrefix = token.slice(2);
    const [key, inlineValue] = withoutPrefix.split("=", 2);
    const nextToken = argv[index + 1];
    const value =
      inlineValue ?? (nextToken && !nextToken.startsWith("--") ? nextToken : "true");

    options[key] = value;

    if (inlineValue == null && nextToken && !nextToken.startsWith("--")) {
      index += 1;
    }
  }

  if (options.help === "true") {
    printHelp();
    process.exit(0);
  }

  const requestedFeatureFamily = options.featureFamily ?? "first_pass_v1";
  if (!(requestedFeatureFamily in BASELINE_FEATURE_FAMILY_PRESETS)) {
    throw new Error(
      `Unsupported --featureFamily "${requestedFeatureFamily}". Supported families: ${Object.keys(
        BASELINE_FEATURE_FAMILY_PRESETS
      ).join(", ")}.`
    );
  }
  const requestedPredictionType = options.predictionType ?? "shot_goal";
  if (
    requestedPredictionType !== "shot_goal" &&
    requestedPredictionType !== "rebound_creation"
  ) {
    throw new Error(
      `Unsupported --predictionType "${requestedPredictionType}". Supported types: shot_goal, rebound_creation.`
    );
  }

  return {
    season: Number(options.season ?? 20252026),
    outputDir:
      options.outputDir ?? path.resolve(process.cwd(), "scripts/output/xg-baselines"),
    family: options.family ?? "xgboost_js",
    predictionType: requestedPredictionType as BaselinePredictionType,
    featureFamily: requestedFeatureFamily as BaselineFeatureFamilyName,
    parserVersion: Number(options.parserVersion ?? 1),
    strengthVersion: Number(options.strengthVersion ?? 1),
    featureVersion: Number(options.featureVersion ?? 1),
    limitGames: options.limitGames ? Number(options.limitGames) : null,
    gameIds: parseIntegerList(options.gameIds),
    seed: Number(options.seed ?? 42),
    trainRatio: Number(options.trainRatio ?? 0.7),
    validationRatio: Number(options.validationRatio ?? 0.15),
    testRatio: options.testRatio ? Number(options.testRatio) : null,
    numericFeatures: parseFeatureSubset(
      parseStringList(options.numericFeatures),
      NUMERIC_FEATURE_KEYS,
      "--numericFeatures"
    ),
    booleanFeatures: parseFeatureSubset(
      parseStringList(options.booleanFeatures),
      BOOLEAN_FEATURE_KEYS,
      "--booleanFeatures"
    ),
    categoricalFeatures: parseFeatureSubset(
      parseStringList(options.categoricalFeatures),
      CATEGORICAL_FEATURE_KEYS,
      "--categoricalFeatures"
    ),
    iterations: options.iterations ? Number(options.iterations) : null,
    learningRate: options.learningRate ? Number(options.learningRate) : null,
    l1: options.l1 ? Number(options.l1) : null,
    l2: options.l2 ? Number(options.l2) : null,
    maxDepth: options.maxDepth ? Number(options.maxDepth) : null,
    minChildWeight: options.minChildWeight ? Number(options.minChildWeight) : null,
    numRounds: options.numRounds ? Number(options.numRounds) : null,
  };
}

function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase credentials. Expected NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in web/.env.local."
    );
  }

  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function getCommitSha(repoRoot: string): string | null {
  try {
    return execSync("git rev-parse HEAD", {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

function buildArtifactVersionTag(args: {
  family: string;
  predictionType: BaselinePredictionType;
  season: number;
  parserVersion: number;
  strengthVersion: number;
  featureVersion: number;
  configSignature: string;
}): string {
  const predictionTypePrefix =
    args.predictionType === "shot_goal" ? "" : `-${args.predictionType}`;
  return `${args.family}${predictionTypePrefix}-s${args.season}-p${args.parserVersion}-st${args.strengthVersion}-f${args.featureVersion}-cfg${args.configSignature}`;
}

function buildConfigSignature(args: {
  predictionType: BaselinePredictionType;
  featureFamily: string;
  seed: number;
  splitConfig: BaselineSplitConfig;
  numericFeatures: string[];
  booleanFeatures: string[];
  categoricalFeatures: string[];
  fitOptions: Record<string, number>;
}): string {
  const signatureArgs =
    args.predictionType === "shot_goal"
      ? {
          featureFamily: args.featureFamily,
          seed: args.seed,
          splitConfig: args.splitConfig,
          numericFeatures: args.numericFeatures,
          booleanFeatures: args.booleanFeatures,
          categoricalFeatures: args.categoricalFeatures,
          fitOptions: args.fitOptions,
        }
      : args;
  const raw = JSON.stringify(signatureArgs);
  return crypto.createHash("sha1").update(raw).digest("hex").slice(0, 8);
}

function buildNumericStandardization(
  examples: EncodedBaselineExample[],
  numericFeatureKeys: string[]
): FeatureTransforms {
  const trainExamples = examples.filter((example) => example.split === "train");
  const numericStandardization: Record<string, { mean: number; std: number }> = {};

  for (let index = 0; index < numericFeatureKeys.length; index += 1) {
    const values = trainExamples.map((example) => example.features[index] ?? 0);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance =
      values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    const std = Math.sqrt(variance);
    numericStandardization[numericFeatureKeys[index]!] = {
      mean,
      std: std > 1e-9 ? std : 1,
    };
  }

  return { numericStandardization };
}

function applyFeatureTransforms(
  examples: EncodedBaselineExample[],
  numericFeatureKeys: string[],
  transforms: FeatureTransforms
): EncodedBaselineExample[] {
  const numericStandardization = transforms.numericStandardization ?? {};

  return examples.map((example) => {
    const features = [...example.features];
    for (let index = 0; index < numericFeatureKeys.length; index += 1) {
      const transform = numericStandardization[numericFeatureKeys[index]!];
      if (!transform) continue;
      features[index] = ((features[index] ?? 0) - transform.mean) / transform.std;
    }

    return {
      ...example,
      features,
    };
  });
}

function resolveSelectedFeatures(
  options: CliOptions
): {
  featureFamily: string;
  numeric: string[];
  boolean: string[];
  categorical: string[];
} {
  const preset = BASELINE_FEATURE_FAMILY_PRESETS[options.featureFamily];
  const numeric = options.numericFeatures ?? [...preset.numericKeys];
  const boolean = options.booleanFeatures ?? [...preset.booleanKeys];
  const categorical = options.categoricalFeatures ?? [...preset.categoricalKeys];
  const hasExplicitOverrides =
    options.numericFeatures != null ||
    options.booleanFeatures != null ||
    options.categoricalFeatures != null;

  return {
    featureFamily: hasExplicitOverrides
      ? `${options.featureFamily}+custom`
      : options.featureFamily,
    numeric,
    boolean,
    categorical,
  };
}

function buildSplitStrategyLabel(splitConfig: BaselineSplitConfig): string {
  const trainRatio = splitConfig.trainRatio ?? 0.7;
  const validationRatio = splitConfig.validationRatio ?? 0.15;
  const testRatio = splitConfig.testRatio ?? Math.max(0, 1 - trainRatio - validationRatio);

  return `chronological_game(train=${trainRatio},validation=${validationRatio},test=${testRatio})`;
}

function resolveFitOptions(options: CliOptions): Required<BinaryLogisticFitOptions> {
  const defaultOptionsByFamily: Record<string, Required<BinaryLogisticFitOptions>> = {
    logistic_unregularized: {
      iterations: 800,
      learningRate: 0.05,
      l1: 0,
      l2: 0,
    },
    logistic_l2: {
      iterations: 800,
      learningRate: 0.05,
      l1: 0,
      l2: 0.01,
    },
    logistic_elastic_net: {
      iterations: 800,
      learningRate: 0.05,
      l1: 0.001,
      l2: 0.01,
    },
  };

  const defaults = defaultOptionsByFamily[options.family];
  if (!defaults) {
    throw new Error(
      `Unsupported model family "${options.family}". Supported families: ${Object.keys(defaultOptionsByFamily).join(", ")}.`
    );
  }

  return {
    iterations: options.iterations ?? defaults.iterations,
    learningRate: options.learningRate ?? defaults.learningRate,
    l1: options.l1 ?? defaults.l1,
    l2: options.l2 ?? defaults.l2,
  };
}

function resolveBoostingFitOptions(options: CliOptions): {
  learningRate: number;
  maxDepth: number;
  minChildWeight: number;
  numRounds: number;
} {
  return {
    learningRate: options.learningRate ?? 0.1,
    maxDepth: options.maxDepth ?? 3,
    minChildWeight: options.minChildWeight ?? 5,
    numRounds: options.numRounds ?? 60,
  };
}

function groupByGameId<T extends { game_id: number }>(rows: T[]): Map<number, T[]> {
  const grouped = new Map<number, T[]>();
  for (const row of rows) {
    const current = grouped.get(row.game_id) ?? [];
    current.push(row);
    grouped.set(row.game_id, current);
  }
  return grouped;
}

function selectGameRows(games: GameRow[], options: CliOptions): GameRow[] {
  const filtered = options.gameIds ? games.filter((game) => options.gameIds?.includes(game.id)) : games;

  if (options.limitGames != null && options.limitGames > 0) {
    return filtered.slice(0, options.limitGames);
  }

  return filtered;
}

async function fetchSelectedGames(
  client: SupabaseClient,
  options: CliOptions
): Promise<GameRow[]> {
  const rows: GameRow[] = [];

  if (options.gameIds?.length) {
    for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
      const { data, error } = await client
        .from("games")
        .select("id, date, seasonId, homeTeamId, awayTeamId")
        .in("id", options.gameIds)
        .order("date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + SUPABASE_PAGE_SIZE - 1);

      if (error) {
        throw error;
      }

      rows.push(...((data ?? []) as GameRow[]));

      if ((data?.length ?? 0) < SUPABASE_PAGE_SIZE) {
        return rows;
      }
    }
  }

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await client
      .from("games")
      .select("id, date, seasonId, homeTeamId, awayTeamId")
      .eq("seasonId", options.season)
      .order("date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + SUPABASE_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as GameRow[]));

    if ((data?.length ?? 0) < SUPABASE_PAGE_SIZE) {
      return rows;
    }
  }
}

function chunkNumbers(values: number[], size: number): number[][] {
  const chunks: number[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function fetchPbpRows(
  client: SupabaseClient,
  gameIds: number[],
  parserVersion: number,
  strengthVersion: number
): Promise<PbpEventRow[]> {
  const rows: PbpEventRow[] = [];

  for (const chunk of chunkNumbers(gameIds, 20)) {
    for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
      const { data, error } = await client
        .from("nhl_api_pbp_events")
        .select("*")
        .in("game_id", chunk)
        .eq("parser_version", parserVersion)
        .eq("strength_version", strengthVersion)
        .order("game_id", { ascending: true })
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("event_id", { ascending: true })
        .range(from, from + SUPABASE_PAGE_SIZE - 1);

      if (error) {
        throw error;
      }

      rows.push(...((data ?? []) as PbpEventRow[]));

      if ((data?.length ?? 0) < SUPABASE_PAGE_SIZE) {
        break;
      }
    }
  }

  return rows;
}

async function fetchShiftRows(
  client: SupabaseClient,
  gameIds: number[],
  parserVersion: number
): Promise<ShiftRow[]> {
  const rows: ShiftRow[] = [];

  for (const chunk of chunkNumbers(gameIds, 20)) {
    for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
      const { data, error } = await client
        .from("nhl_api_shift_rows")
        .select("*")
        .in("game_id", chunk)
        .eq("parser_version", parserVersion)
        .order("game_id", { ascending: true })
        .order("period", { ascending: true, nullsFirst: false })
        .order("start_seconds", { ascending: true, nullsFirst: false })
        .order("shift_id", { ascending: true })
        .range(from, from + SUPABASE_PAGE_SIZE - 1);

      if (error) {
        throw error;
      }

      rows.push(...((data ?? []) as ShiftRow[]));

      if ((data?.length ?? 0) < SUPABASE_PAGE_SIZE) {
        break;
      }
    }
  }

  return rows;
}

async function fetchShooterHandednessMap(
  client: SupabaseClient,
  playerIds: number[],
  seasonId: number
): Promise<Map<number, "L" | "R">> {
  const handednessByPlayerId = new Map<number, "L" | "R">();

  for (const chunk of chunkNumbers(playerIds, 200)) {
    const { data, error } = await client
      .from("player_stats_unified")
      .select("player_id, shoots_catches, date")
      .in("player_id", chunk)
      .eq("season_id", seasonId)
      .order("player_id", { ascending: true })
      .order("date", { ascending: false, nullsFirst: false });

    if (error) {
      throw error;
    }

    for (const row of (data ?? []) as Pick<
      PlayerStatsUnifiedRow,
      "player_id" | "shoots_catches" | "date"
    >[]) {
      const playerId = row.player_id;
      if (typeof playerId !== "number" || !Number.isInteger(playerId)) {
        continue;
      }

      if (handednessByPlayerId.has(playerId)) {
        continue;
      }

      const handedness = normalizeShootsCatchesValue(row.shoots_catches);
      if (handedness != null) {
        handednessByPlayerId.set(playerId, handedness);
      }
    }
  }

  return handednessByPlayerId;
}

async function fetchGoalieCatchHandMap(
  client: SupabaseClient,
  playerIds: number[],
  seasonId: number
): Promise<Map<number, "L" | "R">> {
  const handednessByPlayerId = new Map<number, "L" | "R">();

  for (const chunk of chunkNumbers(playerIds, 200)) {
    const { data, error } = await client
      .from("goalie_stats_unified")
      .select("player_id, shoots_catches, date")
      .in("player_id", chunk)
      .eq("season_id", seasonId)
      .order("player_id", { ascending: true })
      .order("date", { ascending: false, nullsFirst: false });

    if (error) {
      throw error;
    }

    for (const row of (data ?? []) as Pick<
      GoalieStatsUnifiedRow,
      "player_id" | "shoots_catches" | "date"
    >[]) {
      const playerId = row.player_id;
      if (typeof playerId !== "number" || !Number.isInteger(playerId)) {
        continue;
      }

      if (handednessByPlayerId.has(playerId)) {
        continue;
      }

      const handedness = normalizeShootsCatchesValue(row.shoots_catches);
      if (handedness != null) {
        handednessByPlayerId.set(playerId, handedness);
      }
    }
  }

  return handednessByPlayerId;
}

async function fetchPlayerRosterPositionMap(
  client: SupabaseClient,
  playerIds: number[]
): Promise<Map<number, RosterPositionCode>> {
  const positionByPlayerId = new Map<number, RosterPositionCode>();

  for (const chunk of chunkNumbers(playerIds, 200)) {
    const { data, error } = await client
      .from("players")
      .select("id, position")
      .in("id", chunk);

    if (error) {
      throw error;
    }

    for (const row of (data ?? []) as Pick<PlayerRow, "id" | "position">[]) {
      const playerId = row.id;
      if (typeof playerId !== "number" || !Number.isInteger(playerId)) {
        continue;
      }

      const position = normalizeRosterPosition(row.position);
      if (position != null) {
        positionByPlayerId.set(playerId, position);
      }
    }
  }

  return positionByPlayerId;
}

export async function enrichShotRowsWithHandedness(
  client: SupabaseClient,
  shotRows: NhlShotFeatureRow[],
  seasonId: number
): Promise<NhlShotFeatureRow[]> {
  const shooterIds = Array.from(
    new Set(
      shotRows
        .map((row) => row.shooterPlayerId)
        .filter((playerId): playerId is number => Number.isInteger(playerId))
    )
  );
  const goalieIds = Array.from(
    new Set(
      shotRows
        .map((row) => row.goalieInNetId)
        .filter((playerId): playerId is number => Number.isInteger(playerId))
    )
  );

  const [shooterHandednessMap, goalieCatchHandMap, shooterRosterPositionMap] = await Promise.all([
    shooterIds.length
      ? fetchShooterHandednessMap(client, shooterIds, seasonId)
      : Promise.resolve(new Map<number, "L" | "R">()),
    goalieIds.length
      ? fetchGoalieCatchHandMap(client, goalieIds, seasonId)
      : Promise.resolve(new Map<number, "L" | "R">()),
    shooterIds.length
      ? fetchPlayerRosterPositionMap(client, shooterIds)
      : Promise.resolve(new Map<number, RosterPositionCode>()),
  ]);

  return shotRows.map((row) => {
    const shooterHandedness =
      row.shooterPlayerId != null
        ? shooterHandednessMap.get(row.shooterPlayerId) ?? null
        : null;
    const shooterRosterPosition =
      row.shooterPlayerId != null
        ? shooterRosterPositionMap.get(row.shooterPlayerId) ?? null
        : null;
    const goalieCatchHand =
      row.goalieInNetId != null
        ? goalieCatchHandMap.get(row.goalieInNetId) ?? null
        : null;
    const shooterPositionGroup = buildShooterPositionGroup(shooterRosterPosition);

    return {
      ...row,
      shooterRosterPosition,
      shooterPositionGroup,
      isDefensemanShooter:
        shooterRosterPosition == null ? null : shooterRosterPosition === "D",
      shooterHandedness,
      goalieCatchHand,
      shooterGoalieHandednessMatchup: buildShooterGoalieHandednessMatchup(
        shooterHandedness,
        goalieCatchHand
      ),
    };
  });
}

export async function enrichShotRowsWithTrainingContext(
  client: SupabaseClient,
  shotRows: NhlShotFeatureRow[],
  shiftRows: ShiftRow[],
  seasonId: number
): Promise<NhlShotFeatureRow[]> {
  const handednessEnrichedRows = await enrichShotRowsWithHandedness(
    client,
    shotRows,
    seasonId
  );
  const stintsByGameId = buildShiftStintsByGameId(shiftRows);
  const onIcePlayerIds = Array.from(
    new Set(
      shiftRows
        .map((row) => {
          const playerId = row.player_id;
          return typeof playerId === "number" && Number.isInteger(playerId) ? playerId : null;
        })
        .filter((playerId): playerId is number => playerId != null)
    )
  );
  const positionByPlayerId = onIcePlayerIds.length
    ? await fetchPlayerRosterPositionMap(client, onIcePlayerIds)
    : new Map<number, RosterPositionCode>();

  return handednessEnrichedRows.map((row) => ({
    ...row,
    ...buildDeploymentContextForShot(
      row,
      stintsByGameId.get(row.gameId) ?? [],
      positionByPlayerId
    ),
  }));
}

function writeJsonArtifact(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function roundMetric(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  return Number(value.toFixed(6));
}

function buildCalibrationBins(
  examples: ScoredExample[],
  binCount = 10
): CalibrationBin[] {
  const bins = Array.from({ length: binCount }, (_, binIndex) => ({
    binIndex,
    lowerBoundInclusive: binIndex / binCount,
    upperBoundExclusive: binIndex === binCount - 1 ? 1.000001 : (binIndex + 1) / binCount,
    values: [] as ScoredExample[],
  }));

  for (const example of examples) {
    const rawIndex = Math.floor(example.prediction * binCount);
    const binIndex = Math.min(binCount - 1, Math.max(0, rawIndex));
    bins[binIndex]?.values.push(example);
  }

  return bins.map((bin) => {
    const count = bin.values.length;
    const predictionSum = bin.values.reduce((sum, example) => sum + example.prediction, 0);
    const labelSum = bin.values.reduce((sum, example) => sum + example.label, 0);

    return {
      binIndex: bin.binIndex,
      lowerBoundInclusive: bin.lowerBoundInclusive,
      upperBoundExclusive: bin.upperBoundExclusive,
      count,
      avgPrediction: count > 0 ? roundMetric(predictionSum / count) : null,
      observedGoalRate: count > 0 ? roundMetric(labelSum / count) : null,
    };
  });
}

function evaluateScoredExamples(examples: ScoredExample[]): SplitEvaluation {
  if (!examples.length) {
    return {
      exampleCount: 0,
      goalCount: 0,
      goalRate: null,
      averagePrediction: null,
      logLoss: null,
      brierScore: null,
      calibrationBins: buildCalibrationBins([]),
    };
  }

  let logLossSum = 0;
  let brierSum = 0;
  let goalCount = 0;
  let predictionSum = 0;

  for (const example of examples) {
    const prediction = example.prediction;
    goalCount += example.label;
    predictionSum += prediction;
    logLossSum +=
      example.label === 1 ? -Math.log(prediction) : -Math.log(1 - prediction);
    brierSum += (prediction - example.label) ** 2;
  }

  return {
    exampleCount: examples.length,
    goalCount,
    goalRate: roundMetric(goalCount / examples.length),
    averagePrediction: roundMetric(predictionSum / examples.length),
    logLoss: roundMetric(logLossSum / examples.length),
    brierScore: roundMetric(brierSum / examples.length),
    calibrationBins: buildCalibrationBins(examples),
  };
}

function scoreExamples(
  model: BinaryLogisticModel,
  examples: EncodedBaselineExample[]
): ScoredExample[] {
  return examples.map((example) => ({
    ...example,
    prediction: predictBinaryLogisticProbability(model, example.features),
  }));
}

function evaluateSlices(
  examples: ScoredExample[],
  args: {
    sliceName: string;
    getSliceValue: (example: ScoredExample) => string;
  }
): SliceEvaluation[] {
  const grouped = new Map<string, ScoredExample[]>();

  for (const example of examples) {
    const sliceValue = args.getSliceValue(example);
    const current = grouped.get(sliceValue) ?? [];
    current.push(example);
    grouped.set(sliceValue, current);
  }

  return Array.from(grouped.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([sliceValue, sliceExamples]) => ({
      sliceName: args.sliceName,
      sliceValue,
      evaluation: evaluateScoredExamples(sliceExamples),
    }));
}

function buildValidationCalibration(args: {
  rawScoredExamples: ScoredExample[];
  featureKeys: string[];
  splitCounts: Record<"train" | "validation" | "test", number>;
}): {
  scoredExamples: ScoredExample[];
  calibration: NonNullable<ModelArtifactPayload["calibration"]>;
} {
  const validationExamples = args.rawScoredExamples.filter(
    (example) => example.split === "validation"
  );
  const validationCalibrationExamples = validationExamples.map(
    (example): CalibrationExample => ({
      rowId: example.rowId,
      label: example.label,
      prediction: example.prediction,
    })
  );
  const validationPositiveCount = validationCalibrationExamples.reduce(
    (sum, example) => sum + example.label,
    0
  );
  const validationNegativeCount =
    validationCalibrationExamples.length - validationPositiveCount;

  if (
    validationCalibrationExamples.length < 10 ||
    validationPositiveCount <= 0 ||
    validationNegativeCount <= 0
  ) {
    return {
      scoredExamples: args.rawScoredExamples,
      calibration: {
        selectedMethod: "raw",
        fitSplit: "none",
        fitExampleCount: validationCalibrationExamples.length,
        applied: false,
        reason:
          "Skipped post-calibration because validation coverage was too small or lacked both outcome classes.",
        model: { method: "raw" },
      },
    };
  }

  const validationAssessment = assessCalibration(validationCalibrationExamples, {
    featureKeys: args.featureKeys,
    splitCounts: { test: args.splitCounts.test },
    sliceCoverage: {
      reboundPositiveCount: validationExamples.filter(
        (example) => example.label === 1 && example.isReboundShot
      ).length,
      rushPositiveCount: validationExamples.filter(
        (example) => example.label === 1 && example.isRushShot
      ).length,
    },
  });
  const selectedMethod =
    validationAssessment.requiresPostCalibration &&
    validationAssessment.adoptableMethod != null
      ? validationAssessment.adoptableMethod
      : "raw";
  const calibrator = fitProbabilityCalibrator(
    validationCalibrationExamples,
    selectedMethod
  );

  return {
    scoredExamples:
      calibrator.method === "raw"
        ? args.rawScoredExamples
        : args.rawScoredExamples.map((example) => ({
            ...example,
            prediction: calibrator.predict(example.prediction),
          })),
    calibration: {
      selectedMethod: calibrator.method,
      fitSplit: "validation",
      fitExampleCount: validationCalibrationExamples.length,
      applied: calibrator.method !== "raw",
      reason:
        calibrator.method === "raw"
          ? "Validation holdout did not require or support a post-calibration method over raw probabilities."
          : `Applied ${calibrator.method} calibration selected from validation holdout diagnostics.`,
      model: calibrator.model,
    },
  };
}

export function buildBaselineArtifactPayloads(args: {
  artifactTag: string;
  generatedAt: string;
  sourceCommitSha: string | null;
  seasonScope: number;
  family: string;
  featureFamily: string;
  parserVersion: number;
  strengthVersion: number;
  featureVersion: number;
  randomSeed: number;
  splitConfig: BaselineSplitConfig;
  splitStrategy: string;
  selectedFeatures: {
    numeric: string[];
    boolean: string[];
    categorical: string[];
  };
  dataset: ReturnType<typeof buildEncodedBaselineDataset>;
  featureTransforms?: FeatureTransforms;
  fitOptions: Record<string, number>;
  evaluation: Record<"overall" | "train" | "validation" | "test", SplitEvaluation>;
  holdoutEvaluation: SplitEvaluation;
  holdoutSliceEvaluations: {
    strengthState: SliceEvaluation[];
    rebound: SliceEvaluation[];
    rush: SliceEvaluation[];
  };
  holdoutScores: HoldoutScoreRow[];
  calibrationAssessment: CalibrationAssessment;
  calibration?: ModelArtifactPayload["calibration"];
  featureImportance?: Array<{ featureKey: string; importance: number }>;
  model: unknown;
}): {
  datasetArtifact: DatasetArtifactPayload;
  modelArtifact: ModelArtifactPayload;
} {
  assertNoLeakedBaselineArtifactFeatures({
    selectedFeatures: args.selectedFeatures,
    featureKeys: args.dataset.featureKeys,
  });
  const approvalGradeEligibility = buildApprovalGradeEligibility({
    predictionType: args.dataset.predictionType,
    splitCounts: args.dataset.splitCounts,
    evaluation: args.evaluation,
    holdoutEvaluation: args.holdoutEvaluation,
    testEvaluation: args.evaluation.test,
    calibrationAssessment: args.calibrationAssessment,
  });

  const datasetArtifact: DatasetArtifactPayload = {
    artifactKind: "nhl_xg_training_dataset",
    artifactVersion: 1,
    artifactTag: args.artifactTag,
    generatedAt: args.generatedAt,
    sourceCommitSha: args.sourceCommitSha,
    seasonScope: args.seasonScope,
    parserVersion: args.parserVersion,
    strengthVersion: args.strengthVersion,
    featureVersion: args.featureVersion,
    predictionType: args.dataset.predictionType,
    datasetContractRef:
      "/Users/tim/Code/fhfhockey.com/tasks/xg-training-dataset-contract.md",
    featureContractRef:
      "/Users/tim/Code/fhfhockey.com/tasks/xg-training-feature-contract.md",
    materializationDecisionRef:
      "/Users/tim/Code/fhfhockey.com/tasks/xg-training-materialization-decision.md",
    randomSeed: args.randomSeed,
    splitConfig: args.splitConfig,
    splitStrategy: args.splitStrategy,
    featureFamily: args.featureFamily,
    selectedFeatures: args.selectedFeatures,
    splitAssignments: args.dataset.splitAssignments,
    splitCounts: args.dataset.splitCounts,
    featureKeys: args.dataset.featureKeys,
    categoricalLevels: args.dataset.categoricalLevels,
    approvalGradeEligibility,
    rowCount: args.dataset.examples.length,
    rowIds: args.dataset.examples.map((example: EncodedBaselineExample) => example.rowId),
  };

  const modelArtifact: ModelArtifactPayload = {
    artifactKind: "nhl_xg_model",
    artifactVersion: 1,
    artifactTag: args.artifactTag,
    family: args.family,
    generatedAt: args.generatedAt,
    sourceCommitSha: args.sourceCommitSha,
    parserVersion: args.parserVersion,
    strengthVersion: args.strengthVersion,
    featureVersion: args.featureVersion,
    predictionType: args.dataset.predictionType,
    seasonScope: args.seasonScope,
    randomSeed: args.randomSeed,
    splitConfig: args.splitConfig,
    splitStrategy: args.splitStrategy,
    featureFamily: args.featureFamily,
    selectedFeatures: args.selectedFeatures,
    featureKeys: args.dataset.featureKeys,
    featureTransforms: args.featureTransforms,
    trainExampleCount: args.dataset.splitCounts.train,
    validationExampleCount: args.dataset.splitCounts.validation,
    testExampleCount: args.dataset.splitCounts.test,
    fitOptions: args.fitOptions,
    evaluation: args.evaluation,
    holdoutEvaluation: args.holdoutEvaluation,
    holdoutSliceEvaluations: args.holdoutSliceEvaluations,
    holdoutScores: args.holdoutScores,
    calibrationAssessment: args.calibrationAssessment,
    calibration: args.calibration,
    approvalGradeEligibility,
    featureImportance: args.featureImportance,
    model: args.model,
  };

  return { datasetArtifact, modelArtifact };
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  const repoRoot = path.resolve(process.cwd(), "..");
  const supabase = createSupabaseClient();
  const splitConfig: BaselineSplitConfig = {
    trainRatio: options.trainRatio,
    validationRatio: options.validationRatio,
    testRatio: options.testRatio ?? undefined,
  };
  const splitStrategy = buildSplitStrategyLabel(splitConfig);
  {
    const games = await fetchSelectedGames(supabase, options);

    const selectedGames = selectGameRows(games, options);
    if (!selectedGames.length) {
      if (options.gameIds?.length) {
        throw new Error(
          `No games found for explicit gameIds: ${options.gameIds.join(", ")}.`
        );
      }

      throw new Error(`No games found for season ${options.season}.`);
    }

    const shotRows: NhlShotFeatureRow[] = [];
    const selectedFeatures = resolveSelectedFeatures(options);
    let processedGameCount = 0;

    for (const gameChunk of chunkNumbers(selectedGames.map((game) => game.id), 20)) {
      const gamesById = new Map(
        selectedGames
          .filter((game) => gameChunk.includes(game.id))
          .map((game) => [game.id, game])
      );
      const pbpRows = await fetchPbpRows(
        supabase,
        gameChunk,
        options.parserVersion,
        options.strengthVersion
      );
      const shiftRows = await fetchShiftRows(supabase, gameChunk, options.parserVersion);
      const pbpByGameId = groupByGameId(
        pbpRows.map((row) => ({ ...row, game_id: row.game_id }))
      );
      const shiftByGameId = groupByGameId(
        shiftRows.map((row) => ({ ...row, game_id: row.game_id }))
      );
      const stintsByGameId = buildShiftStintsByGameId(shiftRows);
      const onIcePlayerIds = Array.from(
        new Set(
          shiftRows
            .map((row) => {
              const playerId = row.player_id;
              return typeof playerId === "number" && Number.isInteger(playerId)
                ? playerId
                : null;
            })
            .filter((playerId): playerId is number => playerId != null)
        )
      );
      const positionByPlayerId = onIcePlayerIds.length
        ? await fetchPlayerRosterPositionMap(supabase, onIcePlayerIds)
        : new Map<number, RosterPositionCode>();

      for (const gameId of gameChunk) {
        const game = gamesById.get(gameId);
        if (!game) continue;
        const events = (pbpByGameId.get(game.id) ?? []) as unknown as ParsedNhlPbpEvent[];
        const shifts = shiftByGameId.get(game.id) ?? [];
        if (!events.length) continue;

        const builtRows = buildShotFeatureRows(events, shifts, game.homeTeamId, game.awayTeamId, {
          featureVersion: options.featureVersion,
        });

        shotRows.push(
          ...builtRows.map((row) => ({
            ...row,
            ...buildDeploymentContextForShot(
              row,
              stintsByGameId.get(row.gameId) ?? [],
              positionByPlayerId
            ),
          }))
        );
      }
      processedGameCount += gameChunk.length;

      console.error(
        JSON.stringify({
          phase: "build-shot-features",
          processedGames: processedGameCount,
          totalGames: selectedGames.length,
          chunkFirstGameId: gameChunk[0] ?? null,
          chunkLastGameId: gameChunk[gameChunk.length - 1] ?? null,
          cumulativeShotRows: shotRows.length,
        })
      );
    }

    const seasonShotRows = shotRows.filter((row) => row.seasonId === options.season);
    if (!seasonShotRows.length) {
      throw new Error(
        `No shot-feature rows were found for the selected games and season ${options.season}. Ingest nhl_api_pbp_events and nhl_api_shift_rows for those games first.`
      );
    }

    const seasonShotRowsWithTrainingContext = await enrichShotRowsWithHandedness(
      supabase,
      seasonShotRows,
      options.season
    );

    const dataset = buildEncodedBaselineDataset(seasonShotRowsWithTrainingContext, {
      predictionType: options.predictionType,
      featureFamily: options.featureFamily,
      seed: options.seed,
      splitConfig,
      featureSelection: {
        numericKeys: selectedFeatures.numeric as
          | (typeof NUMERIC_FEATURE_KEYS)[number][]
          | undefined,
        booleanKeys: selectedFeatures.boolean as
          | (typeof BOOLEAN_FEATURE_KEYS)[number][]
          | undefined,
        categoricalKeys: selectedFeatures.categorical as
          | (typeof CATEGORICAL_FEATURE_KEYS)[number][]
          | undefined,
      },
    });
    const featureTransforms = buildNumericStandardization(
      dataset.examples,
      selectedFeatures.numeric
    );
    const transformedExamples = applyFeatureTransforms(
      dataset.examples,
      selectedFeatures.numeric,
      featureTransforms
    );
    const trainExamples = transformedExamples
      .filter((example) => example.split === "train")
      .map((example) => ({
        features: example.features,
        label: example.label,
      }));

    let model: unknown;
    let fitOptions: Record<string, number>;
    let featureImportance:
      | Array<{ featureKey: string; importance: number }>
      | undefined;
    let rawScoredExamples: ScoredExample[];
    let scoredExamples: ScoredExample[];
    let calibration:
      | {
          selectedMethod: CalibrationMethodName;
          fitSplit: "validation" | "none";
          fitExampleCount: number;
          applied: boolean;
          reason: string;
          model: SerializedCalibrationModel;
        }
      | undefined;

    if (
      options.family === "logistic_unregularized" ||
      options.family === "logistic_l2" ||
      options.family === "logistic_elastic_net"
    ) {
      fitOptions = resolveFitOptions(options);
      const logisticModel = trainBinaryLogisticModel(trainExamples, fitOptions);
      model = logisticModel;
      rawScoredExamples = scoreExamples(logisticModel, transformedExamples);
    } else if (options.family === "xgboost_js") {
      fitOptions = resolveBoostingFitOptions(options);
      const booster = new XGBoost(fitOptions);
      booster.fit(
        trainExamples.map((example) => example.features),
        trainExamples.map((example) => example.label)
      );
      model = booster.toJSON();
      rawScoredExamples = transformedExamples.map((example) => ({
        ...example,
        prediction: Math.min(
          1,
          Math.max(0, Number(booster.predictSingle(example.features)))
        ),
      }));
      featureImportance = dataset.featureKeys.map((featureKey, index) => ({
        featureKey,
        importance: booster.getFeatureImportance()?.[index] ?? 0,
      }));
    } else {
      throw new Error(
        `Unsupported model family "${options.family}". Supported families: logistic_unregularized, logistic_l2, logistic_elastic_net, xgboost_js.`
      );
    }

    const calibrationResult = buildValidationCalibration({
      rawScoredExamples,
      featureKeys: dataset.featureKeys,
      splitCounts: dataset.splitCounts,
    });
    scoredExamples = calibrationResult.scoredExamples;
    calibration = calibrationResult.calibration;

    const examplesBySplit = {
      overall: scoredExamples,
      train: scoredExamples.filter((example) => example.split === "train"),
      validation: scoredExamples.filter((example) => example.split === "validation"),
      test: scoredExamples.filter((example) => example.split === "test"),
    };
    const evaluation = {
      overall: evaluateScoredExamples(examplesBySplit.overall),
      train: evaluateScoredExamples(examplesBySplit.train),
      validation: evaluateScoredExamples(examplesBySplit.validation),
      test: evaluateScoredExamples(examplesBySplit.test),
    };
    const holdoutExamples = scoredExamples.filter((example) => example.split !== "train");
    const holdoutEvaluation = evaluateScoredExamples(holdoutExamples);
    const holdoutSliceEvaluations = {
      strengthState: evaluateSlices(holdoutExamples, {
        sliceName: "strengthState",
        getSliceValue: (example) => example.strengthState ?? "unknown",
      }),
      rebound: evaluateSlices(holdoutExamples, {
        sliceName: "rebound",
        getSliceValue: (example) => (example.isReboundShot ? "rebound" : "non-rebound"),
      }),
      rush: evaluateSlices(holdoutExamples, {
        sliceName: "rush",
        getSliceValue: (example) => (example.isRushShot ? "rush" : "non-rush"),
      }),
    };
    const holdoutScores = holdoutExamples.map((example) => ({
      rowId: example.rowId,
      split: example.split,
      label: example.label,
      prediction: example.prediction,
      strengthState: example.strengthState,
      isReboundShot: example.isReboundShot,
      isRushShot: example.isRushShot,
    })) as HoldoutScoreRow[];
    const calibrationAssessment = assessCalibration(
      holdoutScores.map(
        (example): CalibrationExample => ({
          rowId: example.rowId,
          label: example.label,
          prediction: example.prediction,
        })
      ),
      {
        featureKeys: dataset.featureKeys,
        splitCounts: { test: dataset.splitCounts.test },
        sliceCoverage: {
          reboundPositiveCount: holdoutScores.filter(
            (example) => example.label === 1 && example.isReboundShot
          ).length,
          rushPositiveCount: holdoutScores.filter(
            (example) => example.label === 1 && example.isRushShot
          ).length,
        },
      }
    );
    const configSignature = buildConfigSignature({
      predictionType: options.predictionType,
      featureFamily: selectedFeatures.featureFamily,
      seed: options.seed,
      splitConfig,
      numericFeatures: selectedFeatures.numeric,
      booleanFeatures: selectedFeatures.boolean,
      categoricalFeatures: selectedFeatures.categorical,
      fitOptions,
    });
    const artifactTag = buildArtifactVersionTag({
      family: options.family,
      predictionType: options.predictionType,
      season: options.season,
      parserVersion: options.parserVersion,
      strengthVersion: options.strengthVersion,
      featureVersion: options.featureVersion,
      configSignature,
    });
    const outputRoot = path.resolve(options.outputDir, artifactTag);
    const commitSha = getCommitSha(repoRoot);

    const generatedAt = new Date().toISOString();
    const { datasetArtifact, modelArtifact } = buildBaselineArtifactPayloads({
      artifactTag,
      generatedAt,
      sourceCommitSha: commitSha,
      seasonScope: options.season,
      family: options.family,
      featureFamily: selectedFeatures.featureFamily,
      parserVersion: options.parserVersion,
      strengthVersion: options.strengthVersion,
      featureVersion: options.featureVersion,
      randomSeed: options.seed,
      splitConfig,
      splitStrategy,
      selectedFeatures,
      dataset,
      featureTransforms,
      fitOptions,
      evaluation,
      holdoutEvaluation,
      holdoutSliceEvaluations,
      holdoutScores,
      calibrationAssessment,
      calibration,
      featureImportance,
      model,
    });

    writeJsonArtifact(path.join(outputRoot, "dataset-artifact.json"), datasetArtifact);
    writeJsonArtifact(path.join(outputRoot, "model-artifact.json"), modelArtifact);

    console.log(
      JSON.stringify(
        {
          ok: true,
          artifactTag,
          outputRoot,
          predictionType: options.predictionType,
          featureFamily: selectedFeatures.featureFamily,
          games: selectedGames.length,
          shotRows: shotRows.length,
          eligibleRows: dataset.examples.length,
          splitCounts: dataset.splitCounts,
          evaluation,
          holdoutEvaluation,
          holdoutSliceEvaluations,
          calibrationAssessment,
        },
        null,
        2
      )
    );
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
