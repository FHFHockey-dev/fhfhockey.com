import type { SupabaseClient } from "@supabase/supabase-js";

import type { BinaryLogisticModel } from "lib/xg/binaryLogistic";
import { evaluateProbabilityMetrics } from "lib/xg/calibration";
import type { Database, Json } from "lib/supabase/database-generated.types";
import {
  BASELINE_MODEL_NAME,
  BASELINE_MODEL_VERSION,
  BASELINE_WINNER_DECISION_THRESHOLD,
  buildBaselineTrainingDataset,
  predictGameWithBaselineModel,
  trainGamePredictionBaselineModel,
  type BaselineFeatureKey,
  type BaselineFeatureVectorOptions,
  type GamePredictionBaselineExample,
} from "./baselineModel";
import {
  buildGamePredictionFeatureSnapshotPayload,
  fetchGamePredictionFeatureInputs,
  type GamePredictionFeatureSnapshotPayload,
} from "./featureBuilder";
import { GAME_PREDICTION_FEATURE_SET_VERSION } from "./featureSources";
import {
  fetchCompletedGameOutcomes,
  type CompletedGameOutcome,
} from "./evaluation";

type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type AccountabilityPredictionRow = Pick<
  Tables<"game_prediction_history">,
  | "prediction_id"
  | "game_id"
  | "snapshot_date"
  | "prediction_cutoff_at"
  | "model_name"
  | "model_version"
  | "feature_set_version"
  | "home_team_id"
  | "away_team_id"
  | "home_win_probability"
  | "away_win_probability"
  | "predicted_winner_team_id"
  | "confidence_label"
  | "metadata"
  | "computed_at"
>;

export type AccountabilityGameRow = Pick<
  Tables<"games">,
  | "id"
  | "date"
  | "startTime"
  | "seasonId"
  | "homeTeamId"
  | "awayTeamId"
  | "type"
>;

export type AccountabilityTeamRow = Pick<
  Tables<"teams">,
  "id" | "abbreviation" | "name"
>;

export type PredictionCandlestick = {
  gameId: number;
  snapshotDate: string;
  startTime: string | null;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamAbbreviation: string;
  awayTeamAbbreviation: string;
  openHomeWinProbability: number;
  lowHomeWinProbability: number;
  highHomeWinProbability: number;
  finalHomeWinProbability: number;
  actualHomeWinProbability: 0 | 1;
  probabilitySpread: number;
  predictionCount: number;
  finalPredictionId: string | null;
  finalPredictionCutoffAt: string;
  predictedWinnerTeamId: number;
  actualWinnerTeamId: number;
  predictedWinnerCorrect: boolean;
  homeScore: number;
  awayScore: number;
};

export type AccountabilityDailyPoint = {
  asOfDate: string;
  evaluatedGames: number;
  correctGames: number;
  wrongGames: number;
  cumulativeAccuracy: number | null;
  rolling10Accuracy: number | null;
  rolling25Accuracy: number | null;
  rolling50Accuracy: number | null;
  brierScore: number | null;
  logLoss: number | null;
};

export type AccountabilitySummary = {
  evaluatedGames: number;
  correctGames: number;
  wrongGames: number;
  accuracy: number | null;
  rolling10Accuracy: number | null;
  rolling25Accuracy: number | null;
  rolling50Accuracy: number | null;
  brierScore: number | null;
  logLoss: number | null;
};

export type BacktestBaselineComparison = {
  key: string;
  label: string;
  evaluatedGames: number;
  correctGames: number;
  wrongGames: number;
  accuracy: number | null;
  brierScore: number | null;
  logLoss: number | null;
  averagePrediction: number | null;
};

export type ConfidenceCalibrationBucket = {
  label: string;
  minConfidence: number;
  maxConfidence: number;
  predictions: number;
  correctGames: number;
  accuracy: number | null;
  averageConfidence: number | null;
};

export type AccountabilityDashboard = {
  generatedAt: string;
  modelName: string;
  modelVersion: string;
  featureSetVersion: string;
  summary: AccountabilitySummary;
  daily: AccountabilityDailyPoint[];
  candles: PredictionCandlestick[];
  baselineComparisons?: BacktestBaselineComparison[];
  calibrationBuckets?: ConfidenceCalibrationBucket[];
};

export type WalkForwardBacktestResult = AccountabilityDashboard & {
  seasonId: number;
  trainingStartDate: string;
  trainingEndDate: string;
  replayStartDate: string;
  replayEndDate: string;
  trainingGames: number;
  replayGames: number;
  predictionSnapshots: number;
  retrainCadenceGames: number;
  horizonDays: number[];
  persisted: boolean;
  backtestRunId: string | null;
};

export type WalkForwardBacktestVariantOptions = {
  featureVectorOptions?: BaselineFeatureVectorOptions;
  disableDataQualityDampening?: boolean;
  winnerDecisionThreshold?: number;
};

export type BacktestAblationVariant = WalkForwardBacktestVariantOptions & {
  key: string;
  label: string;
};

export type BacktestAblationComparison = {
  key: string;
  label: string;
  modelVersion: string;
  excludedFeatureKeys: readonly BaselineFeatureKey[];
  disableDataQualityDampening: boolean;
  winnerDecisionThreshold: number;
  summary: AccountabilitySummary;
  deltaVsBaseline: {
    accuracy: number | null;
    brierScore: number | null;
    logLoss: number | null;
  };
  recommendation: "keep" | "reject" | "review";
};

export type BacktestAblationResult = {
  generatedAt: string;
  modelName: string;
  featureSetVersion: string;
  baselineKey: string;
  variants: BacktestAblationComparison[];
};

const DAY_MS = 86_400_000;

function roundMetric(value: number | null): number | null {
  return value == null || !Number.isFinite(value)
    ? null
    : Number(value.toFixed(6));
}

function accuracyFor(candles: PredictionCandlestick[]): number | null {
  if (candles.length === 0) return null;
  return roundMetric(
    candles.filter((row) => row.predictedWinnerCorrect).length / candles.length,
  );
}

function addDateDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function enumerateDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  for (let date = startDate; date <= endDate; date = addDateDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

function normalizeHorizonDays(horizonDays?: number[]): number[] {
  const values = horizonDays?.length ? horizonDays : [0];
  const normalized = Array.from(
    new Set(values.filter((value) => Number.isInteger(value) && value >= 0)),
  ).sort((a, b) => b - a);
  return normalized.length > 0 ? normalized : [0];
}

const RECENT_FORM_FEATURE_KEYS: readonly BaselineFeatureKey[] = [
  "homeMinusAwayRecent5GoalDifferentialPerGame",
  "homeMinusAwayRecent10GoalDifferentialPerGame",
  "homeMinusAwayRecent5XgfPct",
  "homeMinusAwayRecent10XgfPct",
  "homeMinusAwayRecent10PointPct",
];

export const DEFAULT_BACKTEST_ABLATION_VARIANTS: BacktestAblationVariant[] = [
  {
    key: "v4_default",
    label: "Current v4 default",
  },
  {
    key: "with_recent_point_pct",
    label: "Include recent point %",
    featureVectorOptions: {
      includeDefaultExcludedFeatureKeys: true,
    },
    winnerDecisionThreshold: 0.52,
  },
  {
    key: "v3_recent_form",
    label: "Prior v3 recent form",
    featureVectorOptions: {
      includeDefaultExcludedFeatureKeys: true,
    },
    winnerDecisionThreshold: 0.5,
  },
  {
    key: "no_recent_form",
    label: "No recent form features",
    featureVectorOptions: {
      excludedFeatureKeys: RECENT_FORM_FEATURE_KEYS,
    },
  },
  {
    key: "no_recent_goal_diff",
    label: "No recent goal differential",
    featureVectorOptions: {
      excludedFeatureKeys: [
        "homeMinusAwayRecent5GoalDifferentialPerGame",
        "homeMinusAwayRecent10GoalDifferentialPerGame",
      ],
    },
  },
  {
    key: "no_recent_xg",
    label: "No recent xG share",
    featureVectorOptions: {
      excludedFeatureKeys: [
        "homeMinusAwayRecent5XgfPct",
        "homeMinusAwayRecent10XgfPct",
      ],
    },
  },
  {
    key: "no_recent_point_pct",
    label: "No recent point %",
    featureVectorOptions: {
      excludedFeatureKeys: ["homeMinusAwayRecent10PointPct"],
    },
  },
  {
    key: "no_quality_dampening",
    label: "No data quality dampening",
    disableDataQualityDampening: true,
  },
  {
    key: "home_threshold_52",
    label: "Home decision threshold 52%",
    winnerDecisionThreshold: 0.52,
  },
];

function boundedEdgeProbability(
  edge: number | null | undefined,
  scale: number,
  baseConfidence = 0.55,
  maxConfidence = 0.75,
): number {
  if (edge == null || !Number.isFinite(edge) || Math.abs(edge) < 1e-9) {
    return 0.5;
  }
  const confidence =
    baseConfidence + Math.min(maxConfidence - baseConfidence, Math.abs(edge) / scale);
  return edge > 0 ? confidence : 1 - confidence;
}

function teamAbbreviation(
  teamsById: Map<number, AccountabilityTeamRow>,
  teamId: number,
): string {
  return teamsById.get(teamId)?.abbreviation ?? String(teamId);
}

function sortPredictions(
  predictions: AccountabilityPredictionRow[],
): AccountabilityPredictionRow[] {
  return [...predictions].sort((a, b) => {
    const left = a.prediction_cutoff_at ?? a.computed_at;
    const right = b.prediction_cutoff_at ?? b.computed_at;
    return left.localeCompare(right);
  });
}

function finalPregamePredictions(
  predictions: AccountabilityPredictionRow[],
  game?: AccountabilityGameRow,
): AccountabilityPredictionRow[] {
  const sorted = sortPredictions(predictions);
  if (!game?.startTime) return sorted;
  const beforeStart = sorted.filter(
    (prediction) =>
      (prediction.prediction_cutoff_at ?? prediction.computed_at) <=
      game.startTime,
  );
  return beforeStart.length > 0 ? beforeStart : sorted;
}

export function buildPredictionCandlestick(args: {
  predictions: AccountabilityPredictionRow[];
  outcome: CompletedGameOutcome;
  game?: AccountabilityGameRow;
  teamsById?: Map<number, AccountabilityTeamRow>;
}): PredictionCandlestick | null {
  const usablePredictions = finalPregamePredictions(
    args.predictions,
    args.game,
  );
  if (usablePredictions.length === 0) return null;

  const first = usablePredictions[0]!;
  const final = usablePredictions[usablePredictions.length - 1]!;
  const probabilities = usablePredictions.map((prediction) =>
    Number(prediction.home_win_probability),
  );
  if (probabilities.some((value) => !Number.isFinite(value))) return null;

  const actualWinnerTeamId = args.outcome.homeWon
    ? args.outcome.homeTeamId
    : args.outcome.awayTeamId;
  const predictedWinnerTeamId =
    final.predicted_winner_team_id ??
    (final.home_win_probability >= final.away_win_probability
      ? final.home_team_id
      : final.away_team_id);
  const teamsById = args.teamsById ?? new Map<number, AccountabilityTeamRow>();

  return {
    gameId: final.game_id,
    snapshotDate: final.snapshot_date,
    startTime: args.game?.startTime ?? null,
    homeTeamId: final.home_team_id,
    awayTeamId: final.away_team_id,
    homeTeamAbbreviation: teamAbbreviation(teamsById, final.home_team_id),
    awayTeamAbbreviation: teamAbbreviation(teamsById, final.away_team_id),
    openHomeWinProbability: first.home_win_probability,
    lowHomeWinProbability: Math.min(...probabilities),
    highHomeWinProbability: Math.max(...probabilities),
    finalHomeWinProbability: final.home_win_probability,
    actualHomeWinProbability: args.outcome.homeWon ? 1 : 0,
    probabilitySpread: roundMetric(
      Math.max(...probabilities) - Math.min(...probabilities),
    )!,
    predictionCount: usablePredictions.length,
    finalPredictionId: final.prediction_id,
    finalPredictionCutoffAt: final.prediction_cutoff_at ?? final.computed_at,
    predictedWinnerTeamId,
    actualWinnerTeamId,
    predictedWinnerCorrect: predictedWinnerTeamId === actualWinnerTeamId,
    homeScore: args.outcome.homeScore,
    awayScore: args.outcome.awayScore,
  };
}

export function buildAccountabilityDailySeries(
  candles: PredictionCandlestick[],
): AccountabilityDailyPoint[] {
  const sorted = [...candles].sort((a, b) =>
    a.snapshotDate === b.snapshotDate
      ? a.gameId - b.gameId
      : a.snapshotDate.localeCompare(b.snapshotDate),
  );
  const byDate = new Map<string, PredictionCandlestick[]>();
  for (const candle of sorted) {
    byDate.set(candle.snapshotDate, [
      ...(byDate.get(candle.snapshotDate) ?? []),
      candle,
    ]);
  }

  const cumulative: PredictionCandlestick[] = [];
  return Array.from(byDate.entries()).map(([asOfDate, dayCandles]) => {
    cumulative.push(...dayCandles);
    const correctGames = cumulative.filter(
      (row) => row.predictedWinnerCorrect,
    ).length;
    const probabilityMetrics = evaluateProbabilityMetrics(
      cumulative.map((row) => ({
        label: row.actualHomeWinProbability,
        prediction: row.finalHomeWinProbability,
      })),
    );

    return {
      asOfDate,
      evaluatedGames: cumulative.length,
      correctGames,
      wrongGames: cumulative.length - correctGames,
      cumulativeAccuracy: accuracyFor(cumulative),
      rolling10Accuracy: accuracyFor(cumulative.slice(-10)),
      rolling25Accuracy: accuracyFor(cumulative.slice(-25)),
      rolling50Accuracy: accuracyFor(cumulative.slice(-50)),
      brierScore: probabilityMetrics.brierScore,
      logLoss: probabilityMetrics.logLoss,
    };
  });
}

export function buildAccountabilitySummary(
  candles: PredictionCandlestick[],
): AccountabilitySummary {
  const correctGames = candles.filter(
    (row) => row.predictedWinnerCorrect,
  ).length;
  const probabilityMetrics = evaluateProbabilityMetrics(
    candles.map((row) => ({
      label: row.actualHomeWinProbability,
      prediction: row.finalHomeWinProbability,
    })),
  );

  return {
    evaluatedGames: candles.length,
    correctGames,
    wrongGames: candles.length - correctGames,
    accuracy: accuracyFor(candles),
    rolling10Accuracy: accuracyFor(candles.slice(-10)),
    rolling25Accuracy: accuracyFor(candles.slice(-25)),
    rolling50Accuracy: accuracyFor(candles.slice(-50)),
    brierScore: probabilityMetrics.brierScore,
    logLoss: probabilityMetrics.logLoss,
  };
}

function buildBaselineComparison(args: {
  key: string;
  label: string;
  candles: PredictionCandlestick[];
  probabilityFor: (candle: PredictionCandlestick) => number;
}): BacktestBaselineComparison {
  const predictions = args.candles.map((candle) => {
    const homeWinProbability = Math.min(
      0.95,
      Math.max(0.05, args.probabilityFor(candle)),
    );
    const predictedHome = homeWinProbability >= 0.5;
    const actualHome = candle.actualHomeWinProbability === 1;
    return {
      label: candle.actualHomeWinProbability,
      prediction: homeWinProbability,
      correct: predictedHome === actualHome,
    };
  });
  const metrics = evaluateProbabilityMetrics(predictions);
  const correctGames = predictions.filter((prediction) => prediction.correct).length;

  return {
    key: args.key,
    label: args.label,
    evaluatedGames: predictions.length,
    correctGames,
    wrongGames: predictions.length - correctGames,
    accuracy: predictions.length ? roundMetric(correctGames / predictions.length) : null,
    brierScore: metrics.brierScore,
    logLoss: metrics.logLoss,
    averagePrediction: metrics.averagePrediction,
  };
}

export function buildBacktestBaselineComparisons(args: {
  candles: PredictionCandlestick[];
  payloadsByGameId?: Map<number, GamePredictionFeatureSnapshotPayload>;
}): BacktestBaselineComparison[] {
  const { candles, payloadsByGameId = new Map() } = args;
  const payloadFor = (candle: PredictionCandlestick) =>
    payloadsByGameId.get(candle.gameId);

  return [
    buildBaselineComparison({
      key: "home_team_fixed_54",
      label: "Always home team",
      candles,
      probabilityFor: () => 0.54,
    }),
    buildBaselineComparison({
      key: "standings_point_pct",
      label: "Better standings point %",
      candles,
      probabilityFor: (candle) =>
        boundedEdgeProbability(
          payloadFor(candle)?.matchup.homeMinusAwayPointPctg,
          0.3,
          0.53,
          0.68,
        ),
    }),
    buildBaselineComparison({
      key: "goal_differential",
      label: "Better goal differential",
      candles,
      probabilityFor: (candle) =>
        boundedEdgeProbability(
          payloadFor(candle)?.matchup.homeMinusAwayGoalDifferential,
          100,
          0.53,
          0.68,
        ),
    }),
    buildBaselineComparison({
      key: "recent10_goal_differential",
      label: "Better last 10 goal differential",
      candles,
      probabilityFor: (candle) =>
        boundedEdgeProbability(
          payloadFor(candle)?.matchup
            .homeMinusAwayRecent10GoalDifferentialPerGame,
          3,
          0.53,
          0.68,
        ),
    }),
    buildBaselineComparison({
      key: "team_power_composite",
      label: "Team power composite",
      candles,
      probabilityFor: (candle) => {
        const matchup = payloadFor(candle)?.matchup;
        const edge =
          (matchup?.homeMinusAwayOffRating ?? 0) +
          (matchup?.homeMinusAwayDefRating ?? 0) +
          (matchup?.homeMinusAwayGoalieRating ?? 0) +
          (matchup?.homeMinusAwaySpecialRating ?? 0);
        return boundedEdgeProbability(edge, 120, 0.53, 0.72);
      },
    }),
    buildBaselineComparison({
      key: "goalie_gsaa",
      label: "Goalie GSAA edge",
      candles,
      probabilityFor: (candle) =>
        boundedEdgeProbability(
          payloadFor(candle)?.matchup.homeMinusAwayWeightedGoalieGsaaPer60,
          2,
          0.52,
          0.65,
        ),
    }),
  ];
}

export function buildConfidenceCalibrationBuckets(
  candles: PredictionCandlestick[],
): ConfidenceCalibrationBucket[] {
  const bucketEdges = [0.5, 0.55, 0.6, 0.65, 0.7, 0.8, 0.9, 1.000001];
  return bucketEdges.slice(0, -1).map((minConfidence, index) => {
    const maxConfidence = bucketEdges[index + 1]!;
    const bucketCandles = candles.filter((candle) => {
      const confidence = Math.max(
        candle.finalHomeWinProbability,
        1 - candle.finalHomeWinProbability,
      );
      return confidence >= minConfidence && confidence < maxConfidence;
    });
    const correctGames = bucketCandles.filter(
      (candle) => candle.predictedWinnerCorrect,
    ).length;
    const confidenceSum = bucketCandles.reduce(
      (sum, candle) =>
        sum +
        Math.max(
          candle.finalHomeWinProbability,
          1 - candle.finalHomeWinProbability,
        ),
      0,
    );

    return {
      label: `${Math.round(minConfidence * 100)}-${Math.round(
        Math.min(1, maxConfidence) * 100,
      )}%`,
      minConfidence,
      maxConfidence: Math.min(1, maxConfidence),
      predictions: bucketCandles.length,
      correctGames,
      accuracy: bucketCandles.length
        ? roundMetric(correctGames / bucketCandles.length)
        : null,
      averageConfidence: bucketCandles.length
        ? roundMetric(confidenceSum / bucketCandles.length)
        : null,
    };
  });
}

export function buildAccountabilityDashboard(args: {
  modelName: string;
  modelVersion: string;
  featureSetVersion: string;
  candles: PredictionCandlestick[];
  baselineComparisons?: BacktestBaselineComparison[];
  calibrationBuckets?: ConfidenceCalibrationBucket[];
  generatedAt?: string;
}): AccountabilityDashboard {
  const candles = [...args.candles].sort((a, b) =>
    a.snapshotDate === b.snapshotDate
      ? a.gameId - b.gameId
      : a.snapshotDate.localeCompare(b.snapshotDate),
  );

  return {
    generatedAt: args.generatedAt ?? new Date().toISOString(),
    modelName: args.modelName,
    modelVersion: args.modelVersion,
    featureSetVersion: args.featureSetVersion,
    summary: buildAccountabilitySummary(candles),
    daily: buildAccountabilityDailySeries(candles),
    candles,
    baselineComparisons: args.baselineComparisons,
    calibrationBuckets: args.calibrationBuckets,
  };
}

export async function fetchAccountabilityDashboard(args: {
  client: SupabaseClient<Database>;
  modelName?: string;
  modelVersion?: string;
  featureSetVersion?: string;
  backtestRunId?: string;
  latestBacktest?: boolean;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}): Promise<AccountabilityDashboard> {
  const modelName = args.modelName ?? BASELINE_MODEL_NAME;
  const modelVersion = args.modelVersion ?? BASELINE_MODEL_VERSION;
  const featureSetVersion =
    args.featureSetVersion ?? GAME_PREDICTION_FEATURE_SET_VERSION;
  const limit = Math.min(Math.max(args.limit ?? 250, 1), 1000);
  if (args.backtestRunId || args.latestBacktest) {
    return fetchPersistedBacktestDashboard({
      client: args.client,
      modelName,
      modelVersion: args.modelVersion,
      featureSetVersion,
      backtestRunId: args.backtestRunId,
      limit,
    });
  }

  let query = args.client
    .from("game_prediction_history")
    .select(
      "prediction_id,game_id,snapshot_date,prediction_cutoff_at,model_name,model_version,feature_set_version,home_team_id,away_team_id,home_win_probability,away_win_probability,predicted_winner_team_id,confidence_label,metadata,computed_at",
    )
    .eq("prediction_scope", "pregame")
    .eq("model_name", modelName)
    .eq("model_version", modelVersion)
    .eq("feature_set_version", featureSetVersion)
    .order("snapshot_date", { ascending: true })
    .order("prediction_cutoff_at", { ascending: true })
    .limit(limit * 5);

  if (args.fromDate) query = query.gte("snapshot_date", args.fromDate);
  if (args.toDate) query = query.lte("snapshot_date", args.toDate);

  const { data, error } = await query;
  if (error) throw error;

  const predictions = (data ?? []) as AccountabilityPredictionRow[];
  const gameIds = Array.from(new Set(predictions.map((row) => row.game_id)));
  const teamIds = Array.from(
    new Set(predictions.flatMap((row) => [row.home_team_id, row.away_team_id])),
  );

  const [gamesResult, teamsResult, outcomes] = await Promise.all([
    gameIds.length
      ? args.client
          .from("games")
          .select("id,date,startTime,seasonId,homeTeamId,awayTeamId,type")
          .in("id", gameIds)
      : Promise.resolve({ data: [], error: null }),
    teamIds.length
      ? args.client
          .from("teams")
          .select("id,abbreviation,name")
          .in("id", teamIds)
      : Promise.resolve({ data: [], error: null }),
    fetchCompletedGameOutcomes(args.client, gameIds),
  ]);
  if (gamesResult.error) throw gamesResult.error;
  if (teamsResult.error) throw teamsResult.error;

  const gamesById = new Map(
    ((gamesResult.data ?? []) as AccountabilityGameRow[]).map((game) => [
      game.id,
      game,
    ]),
  );
  const teamsById = new Map(
    ((teamsResult.data ?? []) as AccountabilityTeamRow[]).map((team) => [
      team.id,
      team,
    ]),
  );
  const outcomesByGameId = new Map(
    outcomes.map((outcome) => [outcome.gameId, outcome]),
  );
  const predictionsByGameId = new Map<number, AccountabilityPredictionRow[]>();
  for (const prediction of predictions) {
    predictionsByGameId.set(prediction.game_id, [
      ...(predictionsByGameId.get(prediction.game_id) ?? []),
      prediction,
    ]);
  }

  const candles = Array.from(predictionsByGameId.entries())
    .flatMap(([gameId, gamePredictions]) => {
      const outcome = outcomesByGameId.get(gameId);
      if (!outcome) return [];
      const candle = buildPredictionCandlestick({
        predictions: gamePredictions,
        outcome,
        game: gamesById.get(gameId),
        teamsById,
      });
      return candle ? [candle] : [];
    })
    .slice(-limit);

  return buildAccountabilityDashboard({
    modelName,
    modelVersion,
    featureSetVersion,
    candles,
  });
}

async function fetchPersistedBacktestDashboard(args: {
  client: SupabaseClient<Database>;
  modelName: string;
  modelVersion?: string;
  featureSetVersion: string;
  backtestRunId?: string;
  limit: number;
}): Promise<AccountabilityDashboard> {
  let backtestRunId = args.backtestRunId;
  let modelVersion = args.modelVersion;
  let modelName = args.modelName;
  let featureSetVersion = args.featureSetVersion;

  let runQuery = args.client
    .from("game_prediction_backtest_runs" as any)
    .select(
      "backtest_run_id,model_name,model_version,feature_set_version,metadata,completed_at",
    )
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1);
  if (backtestRunId) {
    runQuery = runQuery.eq("backtest_run_id", backtestRunId);
  } else if (args.modelVersion) {
    runQuery = runQuery.eq("model_version", args.modelVersion);
  }

  const { data: runRows, error: runError } = await runQuery;
  if (runError) throw runError;
  const latestRun = (runRows ?? [])[0] as any;
  if (!latestRun) {
    return buildAccountabilityDashboard({
      modelName,
      modelVersion: modelVersion ?? BASELINE_MODEL_VERSION,
      featureSetVersion,
      candles: [],
    });
  }

  backtestRunId = String(latestRun.backtest_run_id);
  modelName = String(latestRun.model_name);
  modelVersion = String(latestRun.model_version);
  featureSetVersion = String(latestRun.feature_set_version);
  const runMetadata =
    latestRun.metadata && typeof latestRun.metadata === "object"
      ? latestRun.metadata
      : {};

  const { data, error } = await args.client
    .from("game_prediction_accountability_games" as any)
    .select(
      "game_id,snapshot_date,home_team_id,away_team_id,open_home_win_probability,low_home_win_probability,high_home_win_probability,final_home_win_probability,actual_home_win_probability,prediction_count,predicted_winner_team_id,actual_winner_team_id,predicted_winner_correct,home_score,away_score,probability_spread,final_prediction_cutoff_at",
    )
    .eq("backtest_run_id", backtestRunId)
    .order("snapshot_date", { ascending: true })
    .limit(args.limit);
  if (error) throw error;

  const rows = (data ?? []) as any[];
  const teamIds = Array.from(
    new Set(rows.flatMap((row) => [row.home_team_id, row.away_team_id])),
  );
  const { data: teamRows, error: teamError } = teamIds.length
    ? await args.client
        .from("teams")
        .select("id,abbreviation,name")
        .in("id", teamIds)
    : { data: [], error: null };
  if (teamError) throw teamError;
  const teamsById = new Map(
    ((teamRows ?? []) as AccountabilityTeamRow[]).map((team) => [
      team.id,
      team,
    ]),
  );

  const candles: PredictionCandlestick[] = rows.map((row) => ({
    gameId: Number(row.game_id),
    snapshotDate: String(row.snapshot_date),
    startTime: null,
    homeTeamId: Number(row.home_team_id),
    awayTeamId: Number(row.away_team_id),
    homeTeamAbbreviation: teamAbbreviation(teamsById, Number(row.home_team_id)),
    awayTeamAbbreviation: teamAbbreviation(teamsById, Number(row.away_team_id)),
    openHomeWinProbability: Number(row.open_home_win_probability),
    lowHomeWinProbability: Number(row.low_home_win_probability),
    highHomeWinProbability: Number(row.high_home_win_probability),
    finalHomeWinProbability: Number(row.final_home_win_probability),
    actualHomeWinProbability: Number(row.actual_home_win_probability) as 0 | 1,
    probabilitySpread: Number(row.probability_spread),
    predictionCount: Number(row.prediction_count),
    finalPredictionId: null,
    finalPredictionCutoffAt: String(row.final_prediction_cutoff_at),
    predictedWinnerTeamId: Number(row.predicted_winner_team_id),
    actualWinnerTeamId: Number(row.actual_winner_team_id),
    predictedWinnerCorrect: Boolean(row.predicted_winner_correct),
    homeScore: Number(row.home_score),
    awayScore: Number(row.away_score),
  }));

  return buildAccountabilityDashboard({
    modelName,
    modelVersion: modelVersion ?? BASELINE_MODEL_VERSION,
    featureSetVersion,
    candles,
    baselineComparisons: Array.isArray(runMetadata.baseline_comparisons)
      ? runMetadata.baseline_comparisons
      : undefined,
    calibrationBuckets: Array.isArray(runMetadata.calibration_buckets)
      ? runMetadata.calibration_buckets
      : undefined,
  });
}

async function fetchCompletedSeasonGames(args: {
  client: SupabaseClient<Database>;
  seasonId: number;
  gameType?: number;
}): Promise<{
  games: AccountabilityGameRow[];
  outcomes: CompletedGameOutcome[];
}> {
  let gamesQuery = args.client
    .from("games")
    .select("id,date,startTime,seasonId,homeTeamId,awayTeamId,type")
    .eq("seasonId", args.seasonId)
    .order("date", { ascending: true })
    .order("startTime", { ascending: true });

  if (args.gameType != null) gamesQuery = gamesQuery.eq("type", args.gameType);

  const { data, error } = await gamesQuery;
  if (error) throw error;

  const games = (data ?? []) as AccountabilityGameRow[];
  const outcomes = await fetchCompletedGameOutcomes(
    args.client,
    games.map((game) => game.id),
  );
  const outcomeGameIds = new Set(outcomes.map((outcome) => outcome.gameId));

  return {
    games: games.filter((game) => outcomeGameIds.has(game.id)),
    outcomes,
  };
}

async function buildPayloadForGame(
  client: SupabaseClient<Database>,
  gameId: number,
  sourceAsOfDate?: string,
): Promise<GamePredictionFeatureSnapshotPayload> {
  return buildGamePredictionFeatureSnapshotPayload(
    await fetchGamePredictionFeatureInputs(client, gameId, { sourceAsOfDate }),
  );
}

function toTrainingExample(args: {
  payload: GamePredictionFeatureSnapshotPayload;
  outcome: CompletedGameOutcome;
  featureVectorOptions?: BaselineFeatureVectorOptions;
}): GamePredictionBaselineExample {
  return buildBaselineTrainingDataset(
    [
      {
        featureSnapshotId: `walk-forward-${args.payload.gameId}`,
        payload: args.payload,
      },
    ],
    [{ gameId: args.outcome.gameId, homeWon: args.outcome.homeWon }],
    args.featureVectorOptions,
  )[0]!;
}

function predictionToAccountabilityRow(args: {
  prediction: ReturnType<typeof predictGameWithBaselineModel>;
  outcome: CompletedGameOutcome;
  teamAbbreviationsById: Map<number, string>;
}): PredictionCandlestick {
  const prediction = args.prediction;
  const predictedWinnerTeamId =
    prediction.predictedWinnerTeamId ??
    (prediction.homeWinProbability >= prediction.awayWinProbability
      ? prediction.homeTeamId
      : prediction.awayTeamId);
  const actualWinnerTeamId = args.outcome.homeWon
    ? args.outcome.homeTeamId
    : args.outcome.awayTeamId;

  return {
    gameId: prediction.gameId,
    snapshotDate: prediction.snapshotDate,
    startTime: prediction.predictionCutoffAt,
    homeTeamId: prediction.homeTeamId,
    awayTeamId: prediction.awayTeamId,
    homeTeamAbbreviation:
      args.teamAbbreviationsById.get(prediction.homeTeamId) ??
      String(prediction.homeTeamId),
    awayTeamAbbreviation:
      args.teamAbbreviationsById.get(prediction.awayTeamId) ??
      String(prediction.awayTeamId),
    openHomeWinProbability: prediction.homeWinProbability,
    lowHomeWinProbability: prediction.homeWinProbability,
    highHomeWinProbability: prediction.homeWinProbability,
    finalHomeWinProbability: prediction.homeWinProbability,
    actualHomeWinProbability: args.outcome.homeWon ? 1 : 0,
    probabilitySpread: 0,
    predictionCount: 1,
    finalPredictionId: null,
    finalPredictionCutoffAt: prediction.predictionCutoffAt,
    predictedWinnerTeamId,
    actualWinnerTeamId,
    predictedWinnerCorrect: predictedWinnerTeamId === actualWinnerTeamId,
    homeScore: args.outcome.homeScore,
    awayScore: args.outcome.awayScore,
  };
}

function predictionToSyntheticHistoryRow(args: {
  prediction: ReturnType<typeof predictGameWithBaselineModel>;
  sourceAsOfDate: string;
  horizonDays: number;
}): AccountabilityPredictionRow {
  const prediction = args.prediction;
  const predictedWinnerTeamId =
    prediction.predictedWinnerTeamId ??
    (prediction.homeWinProbability >= prediction.awayWinProbability
      ? prediction.homeTeamId
      : prediction.awayTeamId);

  return {
    prediction_id: `backtest-${prediction.gameId}-${args.sourceAsOfDate}-${args.horizonDays}`,
    game_id: prediction.gameId,
    snapshot_date: prediction.snapshotDate,
    prediction_cutoff_at: prediction.predictionCutoffAt,
    model_name: prediction.modelName,
    model_version: prediction.modelVersion,
    feature_set_version: prediction.featureSetVersion,
    home_team_id: prediction.homeTeamId,
    away_team_id: prediction.awayTeamId,
    home_win_probability: prediction.homeWinProbability,
    away_win_probability: prediction.awayWinProbability,
    predicted_winner_team_id: predictedWinnerTeamId,
    confidence_label: prediction.confidenceLabel,
    metadata: {
      blind_backtest: true,
      source_as_of_date: args.sourceAsOfDate,
      horizon_days: args.horizonDays,
    },
    computed_at: prediction.predictionCutoffAt,
  };
}

async function persistBacktestResult(args: {
  client: SupabaseClient<Database>;
  result: WalkForwardBacktestResult;
}): Promise<string> {
  const { client, result } = args;
  const { error: modelVersionError } = await client
    .from("game_prediction_model_versions")
    .upsert(
      {
        model_name: result.modelName,
        model_version: result.modelVersion,
        feature_set_version: result.featureSetVersion,
        algorithm: "regularized_logistic_walk_forward",
        status: "candidate",
        training_start_date: result.trainingStartDate,
        training_end_date: result.trainingEndDate,
        validation_start_date: result.replayStartDate,
        validation_end_date: result.replayEndDate,
        training_metrics: result.summary as unknown as Json,
        validation_metrics: result.summary as unknown as Json,
        metadata: {
          season_id: result.seasonId,
          retrain_cadence_games: result.retrainCadenceGames,
          horizon_days: result.horizonDays,
          prediction_snapshots: result.predictionSnapshots,
          baseline_comparisons: result.baselineComparisons ?? [],
          calibration_buckets: result.calibrationBuckets ?? [],
          accountability_backtest: true,
        },
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "model_name,model_version,feature_set_version",
      },
    );
  if (modelVersionError) throw modelVersionError;

  const { data: run, error: runError } = await client
    .from("game_prediction_backtest_runs" as any)
    .insert({
      model_name: result.modelName,
      model_version: result.modelVersion,
      feature_set_version: result.featureSetVersion,
      season_id: result.seasonId,
      training_start_date: result.trainingStartDate,
      training_end_date: result.trainingEndDate,
      replay_start_date: result.replayStartDate,
      replay_end_date: result.replayEndDate,
      training_games: result.trainingGames,
      replay_games: result.replayGames,
      retrain_cadence_games: result.retrainCadenceGames,
      status: "completed",
      metrics: result.summary as unknown as Json,
      metadata: {
        horizon_days: result.horizonDays,
        prediction_snapshots: result.predictionSnapshots,
        baseline_comparisons: result.baselineComparisons ?? [],
        calibration_buckets: result.calibrationBuckets ?? [],
      },
      completed_at: new Date().toISOString(),
    })
    .select("backtest_run_id")
    .single();
  if (runError) throw runError;
  const backtestRunId = String((run as any).backtest_run_id);

  const gameRows = result.candles.map((candle) => ({
    backtest_run_id: backtestRunId,
    game_id: candle.gameId,
    snapshot_date: candle.snapshotDate,
    model_name: result.modelName,
    model_version: result.modelVersion,
    feature_set_version: result.featureSetVersion,
    home_team_id: candle.homeTeamId,
    away_team_id: candle.awayTeamId,
    open_home_win_probability: candle.openHomeWinProbability,
    low_home_win_probability: candle.lowHomeWinProbability,
    high_home_win_probability: candle.highHomeWinProbability,
    final_home_win_probability: candle.finalHomeWinProbability,
    actual_home_win_probability: candle.actualHomeWinProbability,
    prediction_count: candle.predictionCount,
    predicted_winner_team_id: candle.predictedWinnerTeamId,
    actual_winner_team_id: candle.actualWinnerTeamId,
    predicted_winner_correct: candle.predictedWinnerCorrect,
    home_score: candle.homeScore,
    away_score: candle.awayScore,
    probability_spread: candle.probabilitySpread,
    final_prediction_cutoff_at: candle.finalPredictionCutoffAt,
  }));
  if (gameRows.length > 0) {
    const { error } = await client
      .from("game_prediction_accountability_games" as any)
      .insert(gameRows);
    if (error) throw error;
  }

  const dailyRows = result.daily.map((point) => ({
    backtest_run_id: backtestRunId,
    model_name: result.modelName,
    model_version: result.modelVersion,
    feature_set_version: result.featureSetVersion,
    as_of_date: point.asOfDate,
    evaluated_games: point.evaluatedGames,
    correct_games: point.correctGames,
    wrong_games: point.wrongGames,
    cumulative_accuracy: point.cumulativeAccuracy,
    rolling_10_accuracy: point.rolling10Accuracy,
    rolling_25_accuracy: point.rolling25Accuracy,
    rolling_50_accuracy: point.rolling50Accuracy,
    brier_score: point.brierScore,
    log_loss: point.logLoss,
  }));
  if (dailyRows.length > 0) {
    const { error } = await client
      .from("game_prediction_accountability_daily" as any)
      .insert(dailyRows);
    if (error) throw error;
  }

  return backtestRunId;
}

export async function runWalkForwardBacktest(args: {
  client: SupabaseClient<Database>;
  seasonId: number;
  gameType?: number;
  modelName?: string;
  modelVersion?: string;
  featureSetVersion?: string;
  trainStartDate?: string;
  blindDate?: string;
  replayEndDate?: string;
  horizonDays?: number[];
  maxSimulationDays?: number;
  retrainCadenceGames?: number;
  persist?: boolean;
  maxTrainingGames?: number;
  maxReplayGames?: number;
  initialModel?: BinaryLogisticModel;
  payloadCache?: Map<string, GamePredictionFeatureSnapshotPayload>;
  featureVectorOptions?: BaselineFeatureVectorOptions;
  disableDataQualityDampening?: boolean;
  winnerDecisionThreshold?: number;
}): Promise<WalkForwardBacktestResult> {
  const modelName = args.modelName ?? BASELINE_MODEL_NAME;
  const modelVersion =
    args.modelVersion ?? `${BASELINE_MODEL_VERSION}_walk_forward`;
  const featureSetVersion =
    args.featureSetVersion ?? GAME_PREDICTION_FEATURE_SET_VERSION;
  const retrainCadenceGames = Math.max(1, args.retrainCadenceGames ?? 1);
  const { games, outcomes } = await fetchCompletedSeasonGames({
    client: args.client,
    seasonId: args.seasonId,
    gameType: args.gameType ?? 2,
  });
  if (games.length < 4) {
    throw new Error(
      "At least four completed games are required for walk-forward backtest.",
    );
  }

  const outcomesByGameId = new Map(
    outcomes.map((outcome) => [outcome.gameId, outcome]),
  );
  const hasBlindWindow = Boolean(args.trainStartDate && args.blindDate);
  const splitIndex = Math.floor(games.length / 2);
  const allTrainingGames = hasBlindWindow
    ? games.filter(
        (game) =>
          game.date >= args.trainStartDate! && game.date <= args.blindDate!,
      )
    : games.slice(0, splitIndex);
  const trainingGames = args.maxTrainingGames
    ? allTrainingGames.slice(-args.maxTrainingGames)
    : allTrainingGames;
  const allReplayGames = hasBlindWindow
    ? games.filter(
        (game) =>
          game.date > args.blindDate! &&
          game.date <=
            (args.replayEndDate ?? games[games.length - 1]?.date ?? game.date),
      )
    : games.slice(splitIndex);
  const replayGames = args.maxReplayGames
    ? allReplayGames.slice(0, args.maxReplayGames)
    : allReplayGames;
  const teamIds = Array.from(
    new Set(games.flatMap((game) => [game.homeTeamId, game.awayTeamId])),
  );
  const { data: teamRows, error: teamError } = await args.client
    .from("teams")
    .select("id,abbreviation,name")
    .in("id", teamIds);
  if (teamError) throw teamError;
  const teamAbbreviationsById = new Map(
    ((teamRows ?? []) as AccountabilityTeamRow[]).map((team) => [
      team.id,
      team.abbreviation,
    ]),
  );

  const examples: GamePredictionBaselineExample[] = [];
  const payloadCache =
    args.payloadCache ?? new Map<string, GamePredictionFeatureSnapshotPayload>();
  const getPayload = async (gameId: number, sourceAsOfDate?: string) => {
    const key = `${gameId}:${sourceAsOfDate ?? "pregame"}`;
    const cached = payloadCache.get(key);
    if (cached) return cached;
    const payload = await buildPayloadForGame(
      args.client,
      gameId,
      sourceAsOfDate,
    );
    payloadCache.set(key, payload);
    return payload;
  };

  for (const game of trainingGames) {
    const outcome = outcomesByGameId.get(game.id);
    if (!outcome) continue;
    const payload = await getPayload(game.id, game.date);
    examples.push(
      toTrainingExample({
        payload,
        outcome,
        featureVectorOptions: args.featureVectorOptions,
      }),
    );
  }
  if (examples.length === 0) {
    throw new Error(
      "No training examples could be built for walk-forward backtest.",
    );
  }
  const initialTrainingExamples = examples.length;

  let model =
    args.initialModel ??
    trainGamePredictionBaselineModel(examples, {
      iterations: 800,
      learningRate: 0.03,
      l2: 0.02,
    });

  const candles: PredictionCandlestick[] = [];
  let predictionSnapshots = 0;
  let replayedSinceRetrain = 0;
  const addedTrainingGameIds = new Set(trainingGames.map((game) => game.id));

  if (hasBlindWindow) {
    const horizonDays = normalizeHorizonDays(args.horizonDays);
    const replayGamesByDate = new Map<string, AccountabilityGameRow[]>();
    for (const game of replayGames) {
      replayGamesByDate.set(game.date, [
        ...(replayGamesByDate.get(game.date) ?? []),
        game,
      ]);
    }
    const replayEndDate =
      replayGames[replayGames.length - 1]?.date ?? args.blindDate!;
    const simulationDates = enumerateDates(args.blindDate!, replayEndDate).slice(
      0,
      args.maxSimulationDays,
    );
    const syntheticRowsByGameId = new Map<number, AccountabilityPredictionRow[]>();

    for (const simulationDate of simulationDates) {
      let addedExamplesToday = 0;
      for (const game of replayGames) {
        if (game.date >= simulationDate || addedTrainingGameIds.has(game.id)) {
          continue;
        }
        const outcome = outcomesByGameId.get(game.id);
        if (!outcome) continue;
        const payload = await getPayload(game.id, game.date);
        examples.push(
          toTrainingExample({
            payload,
            outcome,
            featureVectorOptions: args.featureVectorOptions,
          }),
        );
        addedTrainingGameIds.add(game.id);
        addedExamplesToday += 1;
      }

      if (addedExamplesToday > 0) {
        model = trainGamePredictionBaselineModel(examples, {
          iterations: 800,
          learningRate: 0.03,
          l2: 0.02,
        });
      }

      for (const horizonDaysValue of horizonDays) {
        const targetDate = addDateDays(simulationDate, horizonDaysValue);
        const targetGames = replayGamesByDate.get(targetDate) ?? [];
        for (const game of targetGames) {
          const payload = await getPayload(game.id, simulationDate);
          const predictionCutoffAt =
            horizonDaysValue === 0 && game.startTime
              ? game.startTime
              : `${simulationDate}T16:00:00.000Z`;
          const prediction = predictGameWithBaselineModel({
            payload,
            model,
            modelName,
            modelVersion,
            predictionCutoffAt,
            featureVectorOptions: args.featureVectorOptions,
            disableDataQualityDampening: args.disableDataQualityDampening,
            winnerDecisionThreshold: args.winnerDecisionThreshold,
          });
          const row = predictionToSyntheticHistoryRow({
            prediction,
            sourceAsOfDate: simulationDate,
            horizonDays: horizonDaysValue,
          });
          syntheticRowsByGameId.set(game.id, [
            ...(syntheticRowsByGameId.get(game.id) ?? []),
            row,
          ]);
          predictionSnapshots += 1;
        }
      }
    }

    const teamsById = new Map(
      ((teamRows ?? []) as AccountabilityTeamRow[]).map((team) => [
        team.id,
        team,
      ]),
    );
    const gamesById = new Map(replayGames.map((game) => [game.id, game]));
    for (const [gameId, predictions] of syntheticRowsByGameId.entries()) {
      const outcome = outcomesByGameId.get(gameId);
      if (!outcome) continue;
      const candle = buildPredictionCandlestick({
        predictions,
        outcome,
        game: gamesById.get(gameId),
        teamsById,
      });
      if (candle) candles.push(candle);
    }
  } else {
    for (const game of replayGames) {
      const outcome = outcomesByGameId.get(game.id);
      if (!outcome) continue;
      const payload = await getPayload(game.id, game.date);
      const predictionCutoffAt = game.startTime || `${game.date}T12:00:00.000Z`;
      const prediction = predictGameWithBaselineModel({
        payload,
        model,
        modelName,
        modelVersion,
        predictionCutoffAt,
        featureVectorOptions: args.featureVectorOptions,
        disableDataQualityDampening: args.disableDataQualityDampening,
        winnerDecisionThreshold: args.winnerDecisionThreshold,
      });
      candles.push(
        predictionToAccountabilityRow({
          prediction,
          outcome,
          teamAbbreviationsById,
        }),
      );
      predictionSnapshots += 1;

      examples.push(
        toTrainingExample({
          payload,
          outcome,
          featureVectorOptions: args.featureVectorOptions,
        }),
      );
      replayedSinceRetrain += 1;
      if (replayedSinceRetrain >= retrainCadenceGames) {
        model = trainGamePredictionBaselineModel(examples, {
          iterations: 800,
          learningRate: 0.03,
          l2: 0.02,
        });
        replayedSinceRetrain = 0;
      }
    }
  }

  const payloadsByGameId = new Map<number, GamePredictionFeatureSnapshotPayload>();
  for (const candle of candles) {
    payloadsByGameId.set(
      candle.gameId,
      await getPayload(candle.gameId, candle.snapshotDate),
    );
  }
  const baselineComparisons = buildBacktestBaselineComparisons({
    candles,
    payloadsByGameId,
  });
  const calibrationBuckets = buildConfidenceCalibrationBuckets(candles);

  const dashboard = buildAccountabilityDashboard({
    modelName,
    modelVersion,
    featureSetVersion,
    candles,
    baselineComparisons,
    calibrationBuckets,
  });
  const result: WalkForwardBacktestResult = {
    ...dashboard,
    seasonId: args.seasonId,
    trainingStartDate: trainingGames[0]!.date,
    trainingEndDate: trainingGames[trainingGames.length - 1]!.date,
    replayStartDate:
      replayGames[0]?.date ?? trainingGames[trainingGames.length - 1]!.date,
    replayEndDate:
      replayGames[replayGames.length - 1]?.date ??
      trainingGames[trainingGames.length - 1]!.date,
    trainingGames: initialTrainingExamples,
    replayGames: candles.length,
    predictionSnapshots,
    retrainCadenceGames,
    horizonDays: hasBlindWindow ? normalizeHorizonDays(args.horizonDays) : [0],
    persisted: false,
    backtestRunId: null,
  };

  if (args.persist) {
    const backtestRunId = await persistBacktestResult({
      client: args.client,
      result,
    });
    return {
      ...result,
      persisted: true,
      backtestRunId,
    };
  }

  return result;
}

function deltaMetric(
  value: number | null,
  baseline: number | null,
): number | null {
  if (value == null || baseline == null) return null;
  return roundMetric(value - baseline);
}

function recommendAblationVariant(args: {
  summary: AccountabilitySummary;
  baseline: AccountabilitySummary;
}): BacktestAblationComparison["recommendation"] {
  const accuracyDelta = deltaMetric(args.summary.accuracy, args.baseline.accuracy) ?? 0;
  const brierDelta =
    deltaMetric(args.summary.brierScore, args.baseline.brierScore) ?? 0;
  const logLossDelta =
    deltaMetric(args.summary.logLoss, args.baseline.logLoss) ?? 0;

  if (accuracyDelta > 0 && brierDelta <= 0 && logLossDelta <= 0) {
    return "keep";
  }

  if (accuracyDelta < 0 && brierDelta >= 0 && logLossDelta >= 0) {
    return "reject";
  }

  return "review";
}

export async function runWalkForwardBacktestAblations(args: {
  client: SupabaseClient<Database>;
  seasonId: number;
  gameType?: number;
  modelName?: string;
  baseModelVersion?: string;
  featureSetVersion?: string;
  trainStartDate?: string;
  blindDate?: string;
  replayEndDate?: string;
  horizonDays?: number[];
  maxSimulationDays?: number;
  retrainCadenceGames?: number;
  maxTrainingGames?: number;
  maxReplayGames?: number;
  variants?: BacktestAblationVariant[];
}): Promise<BacktestAblationResult> {
  const modelName = args.modelName ?? BASELINE_MODEL_NAME;
  const featureSetVersion =
    args.featureSetVersion ?? GAME_PREDICTION_FEATURE_SET_VERSION;
  const variants = args.variants?.length
    ? args.variants
    : DEFAULT_BACKTEST_ABLATION_VARIANTS;
  const baselineKey = variants[0]?.key ?? "baseline";
  const sharedPayloadCache = new Map<string, GamePredictionFeatureSnapshotPayload>();
  const results: Array<{
    variant: BacktestAblationVariant;
    result: WalkForwardBacktestResult;
  }> = [];

  for (const variant of variants) {
    const modelVersion =
      `${args.baseModelVersion ?? BASELINE_MODEL_VERSION}_ablation_${variant.key}_${args.seasonId}`;
    const result = await runWalkForwardBacktest({
      client: args.client,
      seasonId: args.seasonId,
      gameType: args.gameType,
      modelName,
      modelVersion,
      featureSetVersion,
      trainStartDate: args.trainStartDate,
      blindDate: args.blindDate,
      replayEndDate: args.replayEndDate,
      horizonDays: args.horizonDays,
      maxSimulationDays: args.maxSimulationDays,
      retrainCadenceGames: args.retrainCadenceGames,
      maxTrainingGames: args.maxTrainingGames,
      maxReplayGames: args.maxReplayGames,
      persist: false,
      payloadCache: sharedPayloadCache,
      featureVectorOptions: variant.featureVectorOptions,
      disableDataQualityDampening: variant.disableDataQualityDampening,
      winnerDecisionThreshold: variant.winnerDecisionThreshold,
    });
    results.push({ variant, result });
  }

  const baselineSummary = results[0]?.result.summary ?? {
    evaluatedGames: 0,
    correctGames: 0,
    wrongGames: 0,
    accuracy: null,
    rolling10Accuracy: null,
    rolling25Accuracy: null,
    rolling50Accuracy: null,
    brierScore: null,
    logLoss: null,
  };

  return {
    generatedAt: new Date().toISOString(),
    modelName,
    featureSetVersion,
    baselineKey,
    variants: results.map(({ variant, result }) => {
      const deltaVsBaseline = {
        accuracy: deltaMetric(result.summary.accuracy, baselineSummary.accuracy),
        brierScore: deltaMetric(
          result.summary.brierScore,
          baselineSummary.brierScore,
        ),
        logLoss: deltaMetric(result.summary.logLoss, baselineSummary.logLoss),
      };

      return {
        key: variant.key,
        label: variant.label,
        modelVersion: result.modelVersion,
        excludedFeatureKeys:
          variant.featureVectorOptions?.excludedFeatureKeys ?? [],
        disableDataQualityDampening:
          variant.disableDataQualityDampening ?? false,
        winnerDecisionThreshold:
          variant.winnerDecisionThreshold ?? BASELINE_WINNER_DECISION_THRESHOLD,
        summary: result.summary,
        deltaVsBaseline,
        recommendation:
          variant.key === baselineKey
            ? "review"
            : recommendAblationVariant({
                summary: result.summary,
                baseline: baselineSummary,
              }),
      };
    }),
  };
}
