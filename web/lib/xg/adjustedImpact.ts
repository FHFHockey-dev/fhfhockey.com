import type { NhlShiftStint } from "../supabase/Upserts/nhlShiftStints";
import { findShiftStintAtTime } from "../supabase/Upserts/nhlShiftStints";

export const ADJUSTED_IMPACT_TARGET_FAMILY = "on_ice_xg_differential_v1" as const;

export type AdjustedImpactTargetFamily = typeof ADJUSTED_IMPACT_TARGET_FAMILY;

export type AdjustedImpactShotRow = {
  model_version: string;
  feature_version: number;
  game_id: number;
  event_id: number;
  season_id: number | null;
  game_date: string | null;
  event_owner_team_id: number | null;
  home_team_id: number | null;
  away_team_id: number | null;
  period_number: number | null;
  period_seconds_elapsed: number | null;
  strength_state: string | null;
  strength_exact: string | null;
  owner_score_diff_before_event: number | null;
  owner_score_diff_bucket: string | null;
  zone_code?: string | null;
  shot_zone_code?: string | null;
  owner_rest_days?: number | null;
  opponent_rest_days?: number | null;
  xg: number;
};

export type AdjustedImpactPlayerCoefficient = {
  player_id: number;
  team_id: number;
  side: "for" | "against";
  value: 1 | -1;
};

export type AdjustedImpactDesignRow = {
  target_family: AdjustedImpactTargetFamily;
  model_version: string;
  feature_version: number;
  game_id: number;
  event_id: number;
  season_id: number | null;
  game_date: string | null;
  response_xg_for: number;
  response_xg_differential: number;
  event_owner_team_id: number;
  opponent_team_id: number;
  is_home_event_for: boolean | null;
  period_number: number;
  period_seconds_elapsed: number;
  strength_state: string | null;
  strength_exact: string | null;
  owner_score_diff_before_event: number | null;
  owner_score_diff_bucket: string | null;
  zone_code: string | null;
  shot_zone_code: string | null;
  owner_rest_days: number | null;
  opponent_rest_days: number | null;
  player_coefficients: AdjustedImpactPlayerCoefficient[];
};

export type AdjustedImpactSkippedRow = {
  gameId: number;
  eventId: number;
  reason: string;
};

export type BuildAdjustedImpactDesignRowsResult = {
  targetFamily: AdjustedImpactTargetFamily;
  rows: AdjustedImpactDesignRow[];
  skippedRows: AdjustedImpactSkippedRow[];
};

export type AdjustedImpactFitOptions = {
  iterations?: number;
  learningRate?: number;
  l2?: number;
  minPlayerRows?: number;
};

export type AdjustedImpactPlayerEstimate = {
  player_id: number;
  coefficient: number;
  standard_error_approx: number;
  offensive_rows: number;
  defensive_rows: number;
  total_rows: number;
};

export type AdjustedImpactContextEstimate = {
  feature_key: string;
  coefficient: number;
};

export type AdjustedImpactBaselineModel = {
  target_family: AdjustedImpactTargetFamily;
  model_family: "ridge_sgd_v1";
  iterations: number;
  learning_rate: number;
  l2: number;
  intercept: number;
  player_estimates: AdjustedImpactPlayerEstimate[];
  context_estimates: AdjustedImpactContextEstimate[];
  training_summary: {
    rows: number;
    players: number;
    context_features: number;
    mean_response: number;
    mse: number;
  };
};

export type AdjustedImpactUsageMode = "postgame_descriptive" | "pregame";

export type AdjustedImpactLeakageValidationReport = {
  passed: boolean;
  usage_mode: AdjustedImpactUsageMode;
  feature_availability: "postgame_descriptive";
  blocking_reasons: string[];
  warnings: string[];
  temporal: {
    rows: number;
    missing_game_dates: number;
    min_game_date: string | null;
    max_game_date: string | null;
  };
};

const DEFAULT_FIT_ITERATIONS = 500;
const DEFAULT_FIT_LEARNING_RATE = 0.03;
const DEFAULT_FIT_L2 = 0.1;

function roundMetric(value: number): number {
  return Number(value.toFixed(6));
}

function opponentTeamId(
  shot: Pick<AdjustedImpactShotRow, "event_owner_team_id" | "home_team_id" | "away_team_id">
): number | null {
  if (shot.event_owner_team_id == null) return null;
  if (shot.event_owner_team_id === shot.home_team_id) return shot.away_team_id ?? null;
  if (shot.event_owner_team_id === shot.away_team_id) return shot.home_team_id ?? null;
  return null;
}

function isHomeEventFor(
  shot: Pick<AdjustedImpactShotRow, "event_owner_team_id" | "home_team_id" | "away_team_id">
): boolean | null {
  if (shot.event_owner_team_id == null) return null;
  if (shot.event_owner_team_id === shot.home_team_id) return true;
  if (shot.event_owner_team_id === shot.away_team_id) return false;
  return null;
}

function nonGoaliePlayers(playerIds: number[], goaliePlayerIds: ReadonlySet<number>): number[] {
  return playerIds.filter((playerId) => !goaliePlayerIds.has(playerId));
}

function addContextFeature(
  features: Map<string, number>,
  key: string,
  value: number | null | undefined
) {
  if (value == null || !Number.isFinite(value) || value === 0) return;
  features.set(key, value);
}

function addCategoricalContextFeature(
  features: Map<string, number>,
  key: string,
  value: string | null | undefined
) {
  const normalized = value?.trim();
  if (!normalized) return;
  features.set(`${key}:${normalized}`, 1);
}

function buildContextFeatures(row: AdjustedImpactDesignRow): Map<string, number> {
  const features = new Map<string, number>();
  addContextFeature(
    features,
    "is_home_event_for",
    row.is_home_event_for == null ? null : row.is_home_event_for ? 1 : -1
  );
  addContextFeature(
    features,
    "period_seconds_elapsed_scaled",
    row.period_seconds_elapsed / 1200
  );
  addContextFeature(features, "owner_score_diff_before_event", row.owner_score_diff_before_event);
  addContextFeature(
    features,
    "rest_days_diff",
    row.owner_rest_days != null && row.opponent_rest_days != null
      ? row.owner_rest_days - row.opponent_rest_days
      : null
  );
  addCategoricalContextFeature(features, "strength_state", row.strength_state);
  addCategoricalContextFeature(features, "strength_exact", row.strength_exact);
  addCategoricalContextFeature(features, "owner_score_diff_bucket", row.owner_score_diff_bucket);
  addCategoricalContextFeature(features, "zone_code", row.zone_code);
  addCategoricalContextFeature(features, "shot_zone_code", row.shot_zone_code);
  return features;
}

function sparsePrediction(args: {
  row: AdjustedImpactDesignRow;
  intercept: number;
  playerWeights: Map<number, number>;
  contextWeights: Map<string, number>;
}): number {
  let prediction = args.intercept;
  for (const coefficient of args.row.player_coefficients) {
    prediction += (args.playerWeights.get(coefficient.player_id) ?? 0) * coefficient.value;
  }
  for (const [key, value] of buildContextFeatures(args.row)) {
    prediction += (args.contextWeights.get(key) ?? 0) * value;
  }
  return prediction;
}

export function buildAdjustedImpactDesignRows(args: {
  shots: AdjustedImpactShotRow[];
  stintsByGameId: ReadonlyMap<number, NhlShiftStint[]>;
  goaliePlayerIds?: ReadonlySet<number>;
}): BuildAdjustedImpactDesignRowsResult {
  const goaliePlayerIds = args.goaliePlayerIds ?? new Set<number>();
  const rows: AdjustedImpactDesignRow[] = [];
  const skippedRows: AdjustedImpactSkippedRow[] = [];

  for (const shot of args.shots) {
    if (!Number.isFinite(shot.xg)) {
      skippedRows.push({ gameId: shot.game_id, eventId: shot.event_id, reason: "invalid_xg" });
      continue;
    }
    if (
      shot.event_owner_team_id == null ||
      shot.period_number == null ||
      shot.period_seconds_elapsed == null
    ) {
      skippedRows.push({
        gameId: shot.game_id,
        eventId: shot.event_id,
        reason: "missing_required_event_context",
      });
      continue;
    }

    const opponentId = opponentTeamId(shot);
    if (opponentId == null) {
      skippedRows.push({
        gameId: shot.game_id,
        eventId: shot.event_id,
        reason: "missing_opponent_team_id",
      });
      continue;
    }

    const stint = findShiftStintAtTime(
      args.stintsByGameId.get(shot.game_id) ?? [],
      shot.period_number,
      shot.period_seconds_elapsed
    );
    if (!stint) {
      skippedRows.push({
        gameId: shot.game_id,
        eventId: shot.event_id,
        reason: "missing_shift_stint",
      });
      continue;
    }

    const forTeam = stint.teams.find((team) => team.teamId === shot.event_owner_team_id) ?? null;
    const againstTeam = stint.teams.find((team) => team.teamId === opponentId) ?? null;
    if (!forTeam || !againstTeam) {
      skippedRows.push({
        gameId: shot.game_id,
        eventId: shot.event_id,
        reason: "missing_on_ice_team_side",
      });
      continue;
    }

    const forPlayers = nonGoaliePlayers(forTeam.playerIds, goaliePlayerIds);
    const againstPlayers = nonGoaliePlayers(againstTeam.playerIds, goaliePlayerIds);
    if (forPlayers.length === 0 || againstPlayers.length === 0) {
      skippedRows.push({
        gameId: shot.game_id,
        eventId: shot.event_id,
        reason: "missing_skater_coefficients",
      });
      continue;
    }

    rows.push({
      target_family: ADJUSTED_IMPACT_TARGET_FAMILY,
      model_version: shot.model_version,
      feature_version: shot.feature_version,
      game_id: shot.game_id,
      event_id: shot.event_id,
      season_id: shot.season_id,
      game_date: shot.game_date,
      response_xg_for: roundMetric(shot.xg),
      response_xg_differential: roundMetric(shot.xg),
      event_owner_team_id: shot.event_owner_team_id,
      opponent_team_id: opponentId,
      is_home_event_for: isHomeEventFor(shot),
      period_number: shot.period_number,
      period_seconds_elapsed: shot.period_seconds_elapsed,
      strength_state: shot.strength_state,
      strength_exact: shot.strength_exact,
      owner_score_diff_before_event: shot.owner_score_diff_before_event,
      owner_score_diff_bucket: shot.owner_score_diff_bucket,
      zone_code: shot.zone_code ?? null,
      shot_zone_code: shot.shot_zone_code ?? null,
      owner_rest_days: shot.owner_rest_days ?? null,
      opponent_rest_days: shot.opponent_rest_days ?? null,
      player_coefficients: [
        ...forPlayers.map((playerId) => ({
          player_id: playerId,
          team_id: shot.event_owner_team_id!,
          side: "for" as const,
          value: 1 as const,
        })),
        ...againstPlayers.map((playerId) => ({
          player_id: playerId,
          team_id: opponentId,
          side: "against" as const,
          value: -1 as const,
        })),
      ],
    });
  }

  return {
    targetFamily: ADJUSTED_IMPACT_TARGET_FAMILY,
    rows,
    skippedRows,
  };
}

export function fitAdjustedImpactBaseline(
  rows: AdjustedImpactDesignRow[],
  options: AdjustedImpactFitOptions = {}
): AdjustedImpactBaselineModel {
  if (rows.length === 0) {
    throw new Error("At least one adjusted-impact design row is required.");
  }

  const iterations = options.iterations ?? DEFAULT_FIT_ITERATIONS;
  const learningRate = options.learningRate ?? DEFAULT_FIT_LEARNING_RATE;
  const l2 = options.l2 ?? DEFAULT_FIT_L2;
  const minPlayerRows = options.minPlayerRows ?? 1;
  const playerWeights = new Map<number, number>();
  const contextWeights = new Map<string, number>();
  const playerRows = new Map<number, { offensive: number; defensive: number }>();
  const contextKeys = new Set<string>();
  let intercept = rows.reduce((sum, row) => sum + row.response_xg_differential, 0) / rows.length;

  for (const row of rows) {
    for (const coefficient of row.player_coefficients) {
      const current = playerRows.get(coefficient.player_id) ?? { offensive: 0, defensive: 0 };
      if (coefficient.value > 0) {
        current.offensive += 1;
      } else {
        current.defensive += 1;
      }
      playerRows.set(coefficient.player_id, current);
      playerWeights.set(coefficient.player_id, playerWeights.get(coefficient.player_id) ?? 0);
    }
    for (const key of buildContextFeatures(row).keys()) {
      contextKeys.add(key);
      contextWeights.set(key, contextWeights.get(key) ?? 0);
    }
  }

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let interceptGradient = 0;
    const playerGradients = new Map<number, number>();
    const contextGradients = new Map<string, number>();

    for (const row of rows) {
      const prediction = sparsePrediction({ row, intercept, playerWeights, contextWeights });
      const error = prediction - row.response_xg_differential;
      interceptGradient += error;

      for (const coefficient of row.player_coefficients) {
        playerGradients.set(
          coefficient.player_id,
          (playerGradients.get(coefficient.player_id) ?? 0) + error * coefficient.value
        );
      }
      for (const [key, value] of buildContextFeatures(row)) {
        contextGradients.set(key, (contextGradients.get(key) ?? 0) + error * value);
      }
    }

    intercept -= learningRate * (interceptGradient / rows.length);
    for (const [playerId, gradient] of playerGradients) {
      const current = playerWeights.get(playerId) ?? 0;
      playerWeights.set(
        playerId,
        current - learningRate * (gradient / rows.length + l2 * current)
      );
    }
    for (const [key, gradient] of contextGradients) {
      const current = contextWeights.get(key) ?? 0;
      contextWeights.set(
        key,
        current - learningRate * (gradient / rows.length + l2 * current)
      );
    }
  }

  const squaredErrors = rows.map((row) => {
    const error =
      sparsePrediction({ row, intercept, playerWeights, contextWeights }) -
      row.response_xg_differential;
    return error * error;
  });
  const meanResponse =
    rows.reduce((sum, row) => sum + row.response_xg_differential, 0) / rows.length;
  const mse = squaredErrors.reduce((sum, value) => sum + value, 0) / squaredErrors.length;
  const playerEstimates = Array.from(playerRows.entries())
    .map(([playerId, counts]) => ({
      player_id: playerId,
      coefficient: roundMetric(playerWeights.get(playerId) ?? 0),
      standard_error_approx: roundMetric(
        Math.sqrt(Math.max(mse, 0) / Math.max(counts.offensive + counts.defensive, 1))
      ),
      offensive_rows: counts.offensive,
      defensive_rows: counts.defensive,
      total_rows: counts.offensive + counts.defensive,
    }))
    .filter((row) => row.total_rows >= minPlayerRows)
    .sort((left, right) => {
      const coefficientDelta = right.coefficient - left.coefficient;
      return coefficientDelta !== 0 ? coefficientDelta : left.player_id - right.player_id;
    });

  return {
    target_family: ADJUSTED_IMPACT_TARGET_FAMILY,
    model_family: "ridge_sgd_v1",
    iterations,
    learning_rate: learningRate,
    l2,
    intercept: roundMetric(intercept),
    player_estimates: playerEstimates,
    context_estimates: Array.from(contextKeys)
      .map((key) => ({
        feature_key: key,
        coefficient: roundMetric(contextWeights.get(key) ?? 0),
      }))
      .sort((left, right) => left.feature_key.localeCompare(right.feature_key)),
    training_summary: {
      rows: rows.length,
      players: playerRows.size,
      context_features: contextKeys.size,
      mean_response: roundMetric(meanResponse),
      mse: roundMetric(mse),
    },
  };
}

export function validateAdjustedImpactLeakage(args: {
  rows: AdjustedImpactDesignRow[];
  usageMode: AdjustedImpactUsageMode;
}): AdjustedImpactLeakageValidationReport {
  const blockingReasons: string[] = [];
  const warnings: string[] = [];
  const dates = args.rows
    .map((row) => row.game_date)
    .filter((date): date is string => typeof date === "string" && date.length > 0)
    .sort();
  const missingGameDates = args.rows.length - dates.length;

  if (args.usageMode !== "postgame_descriptive") {
    blockingReasons.push("adjusted_impact_is_not_pregame_safe");
    blockingReasons.push("same_game_on_ice_target_leakage");
  }

  if (missingGameDates > 0) {
    warnings.push("missing_game_dates_reduce_temporal_auditability");
  }

  return {
    passed: blockingReasons.length === 0,
    usage_mode: args.usageMode,
    feature_availability: "postgame_descriptive",
    blocking_reasons: blockingReasons,
    warnings,
    temporal: {
      rows: args.rows.length,
      missing_game_dates: missingGameDates,
      min_game_date: dates[0] ?? null,
      max_game_date: dates[dates.length - 1] ?? null,
    },
  };
}
