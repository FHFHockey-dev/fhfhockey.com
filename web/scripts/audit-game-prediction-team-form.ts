import path from "path";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import {
  BASELINE_MODEL_NAME,
  buildBaselineFeatureVector,
  buildBaselineTrainingDataset,
  getRecentTeamFormFeatureEligibility,
  predictBaselineModelRawHomeWinProbability,
  trainGamePredictionBaselineModel,
} from "lib/game-predictions/baselineModel";
import {
  attachOutcomesToPredictions,
  calculateSegmentMetric,
  fetchCompletedGameOutcomes,
  type GamePredictionHistoryRow,
} from "lib/game-predictions/evaluation";
import type { GamePredictionFeatureSnapshotPayload } from "lib/game-predictions/featureBuilder";
import type { Database, Json } from "lib/supabase/database-generated.types";
import { evaluateProbabilityMetrics } from "lib/xg/calibration";

const MODEL_VERSION = "v6_roster_ctpi_sos_threshold_52";
const FEATURE_SET_VERSION = "game_features_v4_roster_sos_context";
const TRAINING_END_DATE = "2026-01-31";
const EVALUATION_START_DATE = "2026-05-01";
const EVALUATION_END_DATE = "2026-06-17";

type SnapshotRow = {
  feature_snapshot_id: string;
  game_id: number;
  snapshot_date: string;
  prediction_cutoff_at: string;
  computed_at: string;
  model_version: string;
  feature_set_version: string;
  feature_payload: Json;
};

type GameRow = {
  id: number;
  type: number | null;
};

function loadEnv(): void {
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
  dotenv.config({ path: path.resolve(process.cwd(), "scripts/.env") });
  dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
}

function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
}

function asPayload(
  row: SnapshotRow,
): GamePredictionFeatureSnapshotPayload | null {
  if (!row.feature_payload || typeof row.feature_payload !== "object") {
    return null;
  }
  const payload =
    row.feature_payload as unknown as GamePredictionFeatureSnapshotPayload;
  if (
    payload.gameId !== row.game_id ||
    payload.featureSetVersion !== row.feature_set_version
  ) {
    return null;
  }
  return payload;
}

function latestSnapshotPerGame(rows: SnapshotRow[]): SnapshotRow[] {
  const latest = new Map<number, SnapshotRow>();
  for (const row of rows) {
    const existing = latest.get(row.game_id);
    if (
      !existing ||
      row.prediction_cutoff_at > existing.prediction_cutoff_at ||
      (row.prediction_cutoff_at === existing.prediction_cutoff_at &&
        row.computed_at > existing.computed_at)
    ) {
      latest.set(row.game_id, row);
    }
  }
  return [...latest.values()].sort(
    (left, right) =>
      left.snapshot_date.localeCompare(right.snapshot_date) ||
      left.game_id - right.game_id,
  );
}

function boundedEdgeProbability(
  edge: number | null | undefined,
  scale: number,
  baseConfidence = 0.53,
  maxConfidence = 0.68,
): number {
  if (edge == null || !Number.isFinite(edge) || Math.abs(edge) < 1e-9) {
    return 0.5;
  }
  const confidence =
    baseConfidence +
    Math.min(maxConfidence - baseConfidence, Math.abs(edge) / scale);
  return edge > 0 ? confidence : 1 - confidence;
}

function summarizeProbabilities(
  rows: Array<{
    label: 0 | 1;
    probability: number;
    predictedHome: boolean;
  }>,
) {
  const probabilityMetrics = evaluateProbabilityMetrics(
    rows.map((row) => ({
      label: row.label,
      prediction: row.probability,
    })),
  );
  const correct = rows.filter(
    (row) => row.predictedHome === (row.label === 1),
  ).length;
  return {
    evaluatedGames: rows.length,
    correctGames: correct,
    accuracy:
      rows.length > 0 ? Number((correct / rows.length).toFixed(6)) : null,
    brierScore: probabilityMetrics.brierScore,
    logLoss: probabilityMetrics.logLoss,
  };
}

async function main(): Promise<void> {
  loadEnv();
  const client = createSupabaseClient();

  const { data: snapshotData, error: snapshotError } = await client
    .from("game_prediction_feature_snapshots")
    .select(
      "feature_snapshot_id,game_id,snapshot_date,prediction_cutoff_at,computed_at,model_version,feature_set_version,feature_payload",
    )
    .eq("model_version", MODEL_VERSION)
    .eq("feature_set_version", FEATURE_SET_VERSION)
    .order("snapshot_date", { ascending: true })
    .order("game_id", { ascending: true })
    .range(0, 999);
  if (snapshotError) throw snapshotError;

  const snapshots = (snapshotData ?? []) as SnapshotRow[];
  if (snapshots.length === 1000) {
    throw new Error("Snapshot audit reached its 1,000-row safety bound.");
  }

  const gameIds = [...new Set(snapshots.map((row) => row.game_id))];
  const { data: gameData, error: gameError } = await client
    .from("games")
    .select("id,type")
    .in("id", gameIds);
  if (gameError) throw gameError;
  const games = new Map(
    ((gameData ?? []) as GameRow[]).map((row) => [row.id, row]),
  );

  const latestSnapshots = latestSnapshotPerGame(snapshots);
  const trainingRows = latestSnapshots.filter(
    (row) =>
      row.snapshot_date <= TRAINING_END_DATE &&
      games.get(row.game_id)?.type === 2,
  );
  const evaluationRows = latestSnapshots.filter(
    (row) =>
      row.snapshot_date >= EVALUATION_START_DATE &&
      row.snapshot_date <= EVALUATION_END_DATE &&
      games.get(row.game_id)?.type === 3,
  );
  const allOutcomes = await fetchCompletedGameOutcomes(client, [
    ...trainingRows.map((row) => row.game_id),
    ...evaluationRows.map((row) => row.game_id),
  ]);
  const outcomesByGame = new Map(
    allOutcomes.map((outcome) => [outcome.gameId, outcome]),
  );

  const trainingPayloads = trainingRows.flatMap((row) => {
    const payload = asPayload(row);
    return payload
      ? [{ featureSnapshotId: row.feature_snapshot_id, payload }]
      : [];
  });
  const trainingExamples = buildBaselineTrainingDataset(
    trainingPayloads,
    allOutcomes,
  );
  if (trainingExamples.length < 20) {
    throw new Error(
      `At least 20 completed training snapshots are required; found ${trainingExamples.length}.`,
    );
  }
  const model = trainGamePredictionBaselineModel(trainingExamples);

  const candidatePredictions: Array<{
    label: 0 | 1;
    probability: number;
    predictedHome: boolean;
  }> = [];
  const goalDifferentialPredictions: Array<{
    label: 0 | 1;
    probability: number;
    predictedHome: boolean;
  }> = [];
  let evaluationApprovedPairs = 0;
  let evaluationLegacyPairsExcluded = 0;

  for (const row of evaluationRows) {
    const payload = asPayload(row);
    const outcome = outcomesByGame.get(row.game_id);
    if (!payload || !outcome) continue;
    const eligibility = getRecentTeamFormFeatureEligibility(payload);
    if (eligibility.eligible) evaluationApprovedPairs += 1;
    if (
      !eligibility.eligible &&
      Number.isFinite(payload.home.ctpi?.ctpi0To100) &&
      Number.isFinite(payload.away.ctpi?.ctpi0To100)
    ) {
      evaluationLegacyPairsExcluded += 1;
    }

    const probability = Math.min(
      0.95,
      Math.max(
        0.05,
        predictBaselineModelRawHomeWinProbability(
          model,
          buildBaselineFeatureVector(payload),
        ),
      ),
    );
    const label: 0 | 1 = outcome.homeWon ? 1 : 0;
    candidatePredictions.push({
      label,
      probability,
      predictedHome: probability >= 0.52,
    });

    const goalDifferentialProbability = boundedEdgeProbability(
      payload.matchup.homeMinusAwayGoalDifferential,
      100,
    );
    goalDifferentialPredictions.push({
      label,
      probability: goalDifferentialProbability,
      predictedHome: goalDifferentialProbability >= 0.5,
    });
  }

  const { data: historyData, error: historyError } = await client
    .from("game_prediction_history")
    .select(
      "prediction_id,game_id,snapshot_date,model_name,model_version,feature_set_version,home_team_id,away_team_id,home_win_probability,away_win_probability,predicted_winner_team_id,confidence_label,metadata,computed_at",
    )
    .eq("model_version", MODEL_VERSION)
    .eq("feature_set_version", FEATURE_SET_VERSION)
    .gte("snapshot_date", EVALUATION_START_DATE)
    .lte("snapshot_date", EVALUATION_END_DATE)
    .order("computed_at", { ascending: true })
    .range(0, 999);
  if (historyError) throw historyError;
  const historicalRows = (historyData ?? []) as GamePredictionHistoryRow[];
  const latestHistoryByGame = new Map<number, GamePredictionHistoryRow>();
  for (const row of historicalRows) {
    const existing = latestHistoryByGame.get(row.game_id);
    if (!existing || row.computed_at > existing.computed_at) {
      latestHistoryByGame.set(row.game_id, row);
    }
  }
  const historicalEvaluation = calculateSegmentMetric(
    attachOutcomesToPredictions([...latestHistoryByGame.values()], allOutcomes),
  );

  const candidate = summarizeProbabilities(candidatePredictions);
  const goalDifferential = summarizeProbabilities(goalDifferentialPredictions);
  const gate = {
    minimumGames: candidate.evaluatedGames >= 30,
    noWorseThanHistoricalAccuracy:
      historicalEvaluation.accuracy != null &&
      candidate.accuracy != null &&
      candidate.accuracy >= historicalEvaluation.accuracy,
    noWorseThanHistoricalBrier:
      historicalEvaluation.brierScore != null &&
      candidate.brierScore != null &&
      candidate.brierScore <= historicalEvaluation.brierScore,
    noWorseThanHistoricalLogLoss:
      historicalEvaluation.logLoss != null &&
      candidate.logLoss != null &&
      candidate.logLoss <= historicalEvaluation.logLoss,
    beatsGoalDifferentialAccuracy:
      candidate.accuracy != null &&
      goalDifferential.accuracy != null &&
      candidate.accuracy > goalDifferential.accuracy,
    beatsGoalDifferentialBrier:
      candidate.brierScore != null &&
      goalDifferential.brierScore != null &&
      candidate.brierScore < goalDifferential.brierScore,
    beatsGoalDifferentialLogLoss:
      candidate.logLoss != null &&
      goalDifferential.logLoss != null &&
      candidate.logLoss < goalDifferential.logLoss,
  };

  const inventoryEligibility = snapshots.reduce(
    (summary, row) => {
      const payload = asPayload(row);
      if (!payload) {
        summary.invalidPayloads += 1;
        return summary;
      }
      const eligibility = getRecentTeamFormFeatureEligibility(payload);
      if (eligibility.eligible) summary.approvedPairs += 1;
      if (
        !eligibility.eligible &&
        Number.isFinite(payload.home.ctpi?.ctpi0To100) &&
        Number.isFinite(payload.away.ctpi?.ctpi0To100)
      ) {
        summary.legacyNumericPairsExcluded += 1;
      }
      return summary;
    },
    { approvedPairs: 0, legacyNumericPairsExcluded: 0, invalidPayloads: 0 },
  );

  console.log(
    JSON.stringify(
      {
        audit: "game_prediction_recent_team_form_feature_contract_v1",
        persistenceApplied: false,
        modelVersion: MODEL_VERSION,
        featureSetVersion: FEATURE_SET_VERSION,
        snapshotInventory: {
          rows: snapshots.length,
          uniqueGames: latestSnapshots.length,
          ...inventoryEligibility,
        },
        training: {
          throughDate: TRAINING_END_DATE,
          snapshots: trainingRows.length,
          completedExamples: trainingExamples.length,
        },
        evaluation: {
          startDate: EVALUATION_START_DATE,
          endDate: EVALUATION_END_DATE,
          snapshots: evaluationRows.length,
          completedOutcomes: candidate.evaluatedGames,
          approvedPairs: evaluationApprovedPairs,
          legacyNumericPairsExcluded: evaluationLegacyPairsExcluded,
        },
        repairedContractCandidate: candidate,
        candidateEvaluationBoundary: {
          modelName: BASELINE_MODEL_NAME,
          winnerThreshold: 0.52,
          probabilityFloor: 0.05,
          dataQualityDampening:
            "not_applied_legacy_v4_snapshots_predate_required_metadata",
        },
        persistedHistoricalV6: {
          storedPredictions: historicalRows.length,
          uniqueGames: latestHistoryByGame.size,
          evaluatedGames: historicalEvaluation.evaluatedGames,
          accuracy: historicalEvaluation.accuracy,
          brierScore: historicalEvaluation.brierScore,
          logLoss: historicalEvaluation.logLoss,
          auc: historicalEvaluation.auc,
        },
        goalDifferentialBaseline: goalDifferential,
        gate: {
          ...gate,
          passed: Object.values(gate).every(Boolean),
        },
        decision: Object.values(gate).every(Boolean)
          ? "eligible_for_further_review_not_promotion"
          : "retain_existing_no_production_exception",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
