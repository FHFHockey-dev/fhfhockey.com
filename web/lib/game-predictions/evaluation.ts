import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "lib/supabase/database-generated.types";
import { evaluateProbabilityMetrics } from "lib/xg/calibration";

type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type GamePredictionHistoryRow = Pick<
  Tables<"game_prediction_history">,
  | "prediction_id"
  | "game_id"
  | "snapshot_date"
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

export type CompletedGameOutcome = {
  gameId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number;
  awayScore: number;
  homeWon: boolean;
  completedAt?: string | null;
};

export type EvaluatedGamePrediction = {
  prediction: GamePredictionHistoryRow;
  outcome: CompletedGameOutcome;
  label: 0 | 1;
  predictionProbability: number;
  predictedWinnerCorrect: boolean;
};

export type CalibrationBin = {
  minProbability: number;
  maxProbability: number;
  predictions: number;
  averagePrediction: number | null;
  observedHomeWinRate: number | null;
};

export type SegmentMetric = {
  segmentKey: string;
  segmentValue: string;
  evaluatedGames: number;
  logLoss: number | null;
  brierScore: number | null;
  accuracy: number | null;
  auc: number | null;
  calibration: CalibrationBin[];
};

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundMetric(value: number | null): number | null {
  return value == null || !Number.isFinite(value) ? null : Number(value.toFixed(6));
}

function readMetadataFlag(metadata: Json, key: string): boolean {
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const value = (metadata as Record<string, Json>)[key];
  return value === true;
}

function readMetadataString(metadata: Json, key: string): string | null {
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, Json>)[key];
  return typeof value === "string" ? value : null;
}

function readMetadataNumber(metadata: Json, key: string): number | null {
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  return toNumber((metadata as Record<string, Json>)[key] as number | string | null | undefined);
}

export function deriveOutcomeFromScore(row: {
  game_id: number;
  home_team_id: number;
  away_team_id: number;
  home_team_score: number | null;
  away_team_score: number | null;
  updated_at?: string | null;
}): CompletedGameOutcome | null {
  const homeScore = toNumber(row.home_team_score);
  const awayScore = toNumber(row.away_team_score);
  if (homeScore == null || awayScore == null || homeScore === awayScore) return null;

  return {
    gameId: row.game_id,
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id,
    homeScore,
    awayScore,
    homeWon: homeScore > awayScore,
    completedAt: row.updated_at ?? null,
  };
}

export function deriveOutcomeFromPbpGame(row: {
  id: number;
  hometeamid: number | null;
  awayteamid: number | null;
  hometeamscore: number | null;
  awayteamscore: number | null;
  created_at?: string | null;
}): CompletedGameOutcome | null {
  if (row.hometeamid == null || row.awayteamid == null) return null;
  return deriveOutcomeFromScore({
    game_id: row.id,
    home_team_id: row.hometeamid,
    away_team_id: row.awayteamid,
    home_team_score: row.hometeamscore,
    away_team_score: row.awayteamscore,
    updated_at: row.created_at ?? null,
  });
}

export function attachOutcomesToPredictions(
  predictions: GamePredictionHistoryRow[],
  outcomes: CompletedGameOutcome[]
): EvaluatedGamePrediction[] {
  const outcomesByGameId = new Map(outcomes.map((outcome) => [outcome.gameId, outcome]));

  return predictions.flatMap((prediction) => {
    const outcome = outcomesByGameId.get(prediction.game_id);
    if (!outcome) return [];
    if (prediction.home_team_id !== outcome.homeTeamId || prediction.away_team_id !== outcome.awayTeamId) {
      return [];
    }

    const homeProbability = toNumber(prediction.home_win_probability);
    if (homeProbability == null) return [];

    return [
      {
        prediction,
        outcome,
        label: outcome.homeWon ? 1 : 0,
        predictionProbability: homeProbability,
        predictedWinnerCorrect: prediction.predicted_winner_team_id
          ? prediction.predicted_winner_team_id === (outcome.homeWon ? outcome.homeTeamId : outcome.awayTeamId)
          : homeProbability >= 0.5 === outcome.homeWon,
      },
    ];
  });
}

export function buildCalibrationBins(
  evaluated: EvaluatedGamePrediction[],
  binCount = 10
): CalibrationBin[] {
  return Array.from({ length: binCount }, (_, index) => {
    const minProbability = index / binCount;
    const maxProbability = (index + 1) / binCount;
    const rows = evaluated.filter((row) => {
      const probability = row.predictionProbability;
      if (index === binCount - 1) return probability >= minProbability && probability <= maxProbability;
      return probability >= minProbability && probability < maxProbability;
    });
    const averagePrediction =
      rows.length === 0
        ? null
        : rows.reduce((sum, row) => sum + row.predictionProbability, 0) / rows.length;
    const observedHomeWinRate =
      rows.length === 0 ? null : rows.reduce((sum, row) => sum + row.label, 0) / rows.length;

    return {
      minProbability,
      maxProbability,
      predictions: rows.length,
      averagePrediction: roundMetric(averagePrediction),
      observedHomeWinRate: roundMetric(observedHomeWinRate),
    };
  });
}

export function calculateAuc(evaluated: EvaluatedGamePrediction[]): number | null {
  const positives = evaluated.filter((row) => row.label === 1);
  const negatives = evaluated.filter((row) => row.label === 0);
  if (positives.length === 0 || negatives.length === 0) return null;

  let wins = 0;
  let ties = 0;
  for (const positive of positives) {
    for (const negative of negatives) {
      if (positive.predictionProbability > negative.predictionProbability) wins += 1;
      if (positive.predictionProbability === negative.predictionProbability) ties += 1;
    }
  }

  return roundMetric((wins + ties * 0.5) / (positives.length * negatives.length));
}

export function calculateSegmentMetric(
  evaluated: EvaluatedGamePrediction[],
  segmentKey = "overall",
  segmentValue = "all"
): SegmentMetric {
  const probabilityMetrics = evaluateProbabilityMetrics(
    evaluated.map((row) => ({
      label: row.label,
      prediction: row.predictionProbability,
    }))
  );
  const accuracy =
    evaluated.length === 0
      ? null
      : evaluated.filter((row) => row.predictedWinnerCorrect).length / evaluated.length;

  return {
    segmentKey,
    segmentValue,
    evaluatedGames: evaluated.length,
    logLoss: probabilityMetrics.logLoss,
    brierScore: probabilityMetrics.brierScore,
    accuracy: roundMetric(accuracy),
    auc: calculateAuc(evaluated),
    calibration: buildCalibrationBins(evaluated),
  };
}

export function buildSegmentMetrics(evaluated: EvaluatedGamePrediction[]): SegmentMetric[] {
  const segments: SegmentMetric[] = [calculateSegmentMetric(evaluated)];
  const confidenceValues = Array.from(
    new Set(evaluated.map((row) => row.prediction.confidence_label).filter(Boolean))
  ) as string[];

  for (const confidence of confidenceValues) {
    segments.push(
      calculateSegmentMetric(
        evaluated.filter((row) => row.prediction.confidence_label === confidence),
        "confidence_label",
        confidence
      )
    );
  }

  for (const seasonPhase of ["early", "middle", "late", "playoff"]) {
    const rows = evaluated.filter((row) => getSeasonPhase(row) === seasonPhase);
    if (rows.length > 0) {
      segments.push(calculateSegmentMetric(rows, "season_phase", seasonPhase));
    }
  }

  for (const predictedSide of ["home", "away"]) {
    const rows = evaluated.filter((row) => getPredictedSide(row) === predictedSide);
    if (rows.length > 0) {
      segments.push(calculateSegmentMetric(rows, "predicted_side", predictedSide));
    }
  }

  const goalieStates = Array.from(
    new Set(
      evaluated
        .map((row) => readMetadataString(row.prediction.metadata, "goalie_confirmation_state"))
        .filter(Boolean)
    )
  ) as string[];
  for (const goalieState of goalieStates) {
    segments.push(
      calculateSegmentMetric(
        evaluated.filter(
          (row) => readMetadataString(row.prediction.metadata, "goalie_confirmation_state") === goalieState
        ),
        "goalie_confirmation_state",
        goalieState
      )
    );
  }

  const goalieUncertaintyBuckets = Array.from(
    new Set(evaluated.map(getGoalieUncertaintyBucket).filter(Boolean))
  ) as string[];
  for (const uncertaintyBucket of goalieUncertaintyBuckets) {
    segments.push(
      calculateSegmentMetric(
        evaluated.filter((row) => getGoalieUncertaintyBucket(row) === uncertaintyBucket),
        "goalie_start_uncertainty",
        uncertaintyBucket
      )
    );
  }

  const marketEdgeBuckets = Array.from(
    new Set(
      evaluated
        .map((row) => readMetadataString(row.prediction.metadata, "market_edge_bucket"))
        .filter(Boolean)
    )
  ) as string[];
  for (const marketEdgeBucket of marketEdgeBuckets) {
    segments.push(
      calculateSegmentMetric(
        evaluated.filter(
          (row) => readMetadataString(row.prediction.metadata, "market_edge_bucket") === marketEdgeBucket
        ),
        "market_edge_bucket",
        marketEdgeBucket
      )
    );
  }

  for (const staleValue of [true, false]) {
    const rows = evaluated.filter((row) =>
      readMetadataFlag(row.prediction.metadata, "has_stale_source") === staleValue
    );
    if (rows.length > 0) {
      segments.push(calculateSegmentMetric(rows, "has_stale_source", String(staleValue)));
    }
  }

  const gameTypes = Array.from(
    new Set(
      evaluated
        .map((row) => readMetadataNumber(row.prediction.metadata, "game_type"))
        .filter((value): value is number => value != null)
    )
  );
  for (const gameType of gameTypes) {
    segments.push(
      calculateSegmentMetric(
        evaluated.filter((row) => readMetadataNumber(row.prediction.metadata, "game_type") === gameType),
        "game_type",
        String(gameType)
      )
    );
  }

  return segments;
}

function getSeasonPhase(row: EvaluatedGamePrediction): "early" | "middle" | "late" | "playoff" {
  const metadataPhase = readMetadataString(row.prediction.metadata, "season_phase");
  if (
    metadataPhase === "early" ||
    metadataPhase === "middle" ||
    metadataPhase === "late" ||
    metadataPhase === "playoff"
  ) {
    return metadataPhase;
  }
  const month = Number(row.prediction.snapshot_date.slice(5, 7));
  if (month === 10 || month === 11) return "early";
  if (month >= 3 && month <= 6) return "late";
  return "middle";
}

function getGoalieUncertaintyBucket(row: EvaluatedGamePrediction): string | null {
  const home = readMetadataNumber(row.prediction.metadata, "home_goalie_start_uncertainty");
  const away = readMetadataNumber(row.prediction.metadata, "away_goalie_start_uncertainty");
  const uncertainty = Math.max(home ?? 0, away ?? 0);
  if (uncertainty >= 0.75) return "high";
  if (uncertainty >= 0.25) return "medium";
  if (home != null || away != null) return "low";
  return null;
}

function getPredictedSide(row: EvaluatedGamePrediction): "home" | "away" {
  if (row.prediction.predicted_winner_team_id === row.prediction.away_team_id) return "away";
  if (row.prediction.predicted_winner_team_id === row.prediction.home_team_id) return "home";
  return row.predictionProbability >= 0.5 ? "home" : "away";
}

export function buildMetricInserts(args: {
  evaluated: EvaluatedGamePrediction[];
  modelName: string;
  modelVersion: string;
  featureSetVersion: string;
  evaluationStartDate: string;
  evaluationEndDate: string;
  runId?: string | null;
}): Database["public"]["Tables"]["game_prediction_model_metrics"]["Insert"][] {
  return buildSegmentMetrics(args.evaluated).map((segment) => ({
    run_id: args.runId ?? null,
    model_name: args.modelName,
    model_version: args.modelVersion,
    feature_set_version: args.featureSetVersion,
    evaluation_start_date: args.evaluationStartDate,
    evaluation_end_date: args.evaluationEndDate,
    segment_key: segment.segmentKey,
    segment_value: segment.segmentValue,
    evaluated_games: segment.evaluatedGames,
    log_loss: segment.logLoss,
    brier_score: segment.brierScore,
    accuracy: segment.accuracy,
    auc: segment.auc,
    calibration: segment.calibration as unknown as Json,
    coverage: {
      evaluated_games: segment.evaluatedGames,
      segment_key: segment.segmentKey,
      segment_value: segment.segmentValue,
    },
    metadata: {
      immutable_prediction_history: true,
    },
  }));
}

export async function persistMetricInserts(
  client: SupabaseClient<Database>,
  inserts: Database["public"]["Tables"]["game_prediction_model_metrics"]["Insert"][]
): Promise<void> {
  if (inserts.length === 0) return;
  const { error } = await client.from("game_prediction_model_metrics").upsert(inserts, {
    onConflict:
      "model_name,model_version,feature_set_version,evaluation_start_date,evaluation_end_date,segment_key,segment_value",
  });
  if (error) throw error;
}

export async function fetchCompletedGameOutcomes(
  client: SupabaseClient<Database>,
  gameIds: number[]
): Promise<CompletedGameOutcome[]> {
  if (gameIds.length === 0) return [];
  const uniqueGameIds = Array.from(new Set(gameIds));
  const chunks = Array.from(
    { length: Math.ceil(uniqueGameIds.length / 200) },
    (_, index) => uniqueGameIds.slice(index * 200, index * 200 + 200),
  );
  const outcomesByGameId = new Map<number, CompletedGameOutcome>();

  for (const chunk of chunks) {
    const { data, error } = await client
      .from("pp_timeframes")
      .select("game_id,home_team_id,away_team_id,home_team_score,away_team_score,updated_at")
      .in("game_id", chunk);
    if (error) throw error;
    for (const row of data ?? []) {
      const outcome = deriveOutcomeFromScore(row);
      if (outcome) outcomesByGameId.set(outcome.gameId, outcome);
    }
  }

  const unresolvedGameIds = uniqueGameIds.filter(
    (gameId) => !outcomesByGameId.has(gameId),
  );
  for (let index = 0; index < unresolvedGameIds.length; index += 200) {
    const chunk = unresolvedGameIds.slice(index, index + 200);
    const { data, error } = await client
      .from("pbp_games")
      .select("id,hometeamid,awayteamid,hometeamscore,awayteamscore,created_at")
      .in("id", chunk);
    if (error) throw error;
    for (const row of data ?? []) {
      const outcome = deriveOutcomeFromPbpGame(row);
      if (outcome) outcomesByGameId.set(outcome.gameId, outcome);
    }
  }

  return uniqueGameIds.flatMap((gameId) => {
    const outcome = outcomesByGameId.get(gameId);
    return outcome ? [outcome] : [];
  });
}
