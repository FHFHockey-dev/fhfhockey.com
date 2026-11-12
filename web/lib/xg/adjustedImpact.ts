import type { NhlShiftStint } from "../supabase/Upserts/nhlShiftStints";
import { findShiftStintAtTime } from "../supabase/Upserts/nhlShiftStints";

export const ADJUSTED_IMPACT_TARGET_FAMILY = "on_ice_xg_differential_v1" as const;

export type AdjustedImpactTargetFamily = typeof ADJUSTED_IMPACT_TARGET_FAMILY;

/**
 * How shots at an empty net enter the regression (decision 100).
 * - included_with_strength_covariate: the historical treatment; EN shots
 *   are ordinary responses and only the strength covariates see them.
 * - excluded: shots at an empty net are not responses.
 * - explicit_indicator: they stay, with an explicit empty-net-target context
 *   feature (the shooter's own empty net shows in strength_exact).
 * No treatment is validated yet: compare them with
 * compareAdjustedImpactEmptyNetTreatments on held-out data first.
 */
export type AdjustedImpactEmptyNetTreatment =
  | "included_with_strength_covariate"
  | "excluded"
  | "explicit_indicator";

export const ADJUSTED_IMPACT_DEFAULT_EMPTY_NET_TREATMENT: AdjustedImpactEmptyNetTreatment =
  "included_with_strength_covariate";

export type AdjustedImpactEmptyNetTreatmentStatus = {
  treatment: AdjustedImpactEmptyNetTreatment;
  validation: "unvalidated";
  decision: 100;
  note: string;
};

export function adjustedImpactEmptyNetTreatmentStatus(
  treatment: AdjustedImpactEmptyNetTreatment = ADJUSTED_IMPACT_DEFAULT_EMPTY_NET_TREATMENT
): AdjustedImpactEmptyNetTreatmentStatus {
  return {
    treatment,
    validation: "unvalidated",
    decision: 100,
    note:
      "Empty-net handling in the adjusted-impact regression is unvalidated: a strength covariate alone does not establish it. Pending a held-out comparison of excluded vs explicitly identified empty-net shots.",
  };
}

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
  /** v2 definition: the shooter attacks the opponent's empty net. */
  is_empty_net_event?: boolean | null;
  goalie_in_net_id?: number | null;
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
  /** True for a shot at an empty net; null when the flags were not supplied. */
  empty_net_target?: boolean | null;
  /** 1/0 context feature, set only under the explicit_indicator treatment. */
  empty_net_indicator?: 0 | 1 | null;
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
  emptyNetTreatment: AdjustedImpactEmptyNetTreatmentStatus;
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

export type AdjustedImpactHeldOutValidationOptions = AdjustedImpactFitOptions & {
  validationFraction?: number;
  minTrainingRows?: number;
  minValidationRows?: number;
  minimumMseImprovement?: number;
};

export type AdjustedImpactHeldOutValidationReport = {
  passed: boolean;
  blocking_reasons: string[];
  warnings: string[];
  split: {
    strategy: "chronological_game_date";
    validation_fraction: number;
    training_rows: number;
    validation_rows: number;
    training_start_game_date: string | null;
    training_end_game_date: string | null;
    validation_start_game_date: string | null;
    validation_end_game_date: string | null;
  };
  metrics: {
    training_mean_response: number | null;
    validation_mse: number | null;
    baseline_mse: number | null;
    mse_improvement: number | null;
    mse_improvement_percentage: number | null;
  };
  model_summary: {
    training_players: number;
    validation_players: number;
    unseen_validation_players: number;
  };
};

const DEFAULT_FIT_ITERATIONS = 500;
const DEFAULT_FIT_LEARNING_RATE = 0.03;
const DEFAULT_FIT_L2 = 0.1;
const DEFAULT_VALIDATION_FRACTION = 0.2;

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
  addContextFeature(features, "empty_net_target", row.empty_net_indicator ?? null);
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

function baselineModelPrediction(row: AdjustedImpactDesignRow, model: AdjustedImpactBaselineModel): number {
  const playerWeights = new Map(
    model.player_estimates.map((estimate) => [estimate.player_id, estimate.coefficient])
  );
  const contextWeights = new Map(
    model.context_estimates.map((estimate) => [estimate.feature_key, estimate.coefficient])
  );
  return sparsePrediction({
    row,
    intercept: model.intercept,
    playerWeights,
    contextWeights,
  });
}

function datedRows(rows: AdjustedImpactDesignRow[]): AdjustedImpactDesignRow[] {
  return rows
    .filter((row) => typeof row.game_date === "string" && row.game_date.length > 0)
    .sort((left, right) => {
      const dateDelta = left.game_date!.localeCompare(right.game_date!);
      if (dateDelta !== 0) return dateDelta;
      const gameDelta = left.game_id - right.game_id;
      return gameDelta !== 0 ? gameDelta : left.event_id - right.event_id;
    });
}

function responseMean(rows: AdjustedImpactDesignRow[]): number {
  return rows.reduce((sum, row) => sum + row.response_xg_differential, 0) / rows.length;
}

function meanSquaredError(rows: AdjustedImpactDesignRow[], predictor: (row: AdjustedImpactDesignRow) => number): number {
  return (
    rows.reduce((sum, row) => {
      const error = predictor(row) - row.response_xg_differential;
      return sum + error * error;
    }, 0) / rows.length
  );
}

function minMaxGameDate(rows: AdjustedImpactDesignRow[]): { min: string | null; max: string | null } {
  const dates = rows
    .map((row) => row.game_date)
    .filter((date): date is string => typeof date === "string" && date.length > 0)
    .sort();
  return {
    min: dates[0] ?? null,
    max: dates[dates.length - 1] ?? null,
  };
}

export function buildAdjustedImpactDesignRows(args: {
  shots: AdjustedImpactShotRow[];
  stintsByGameId: ReadonlyMap<number, NhlShiftStint[]>;
  goaliePlayerIds?: ReadonlySet<number>;
  emptyNetTreatment?: AdjustedImpactEmptyNetTreatment;
}): BuildAdjustedImpactDesignRowsResult {
  const goaliePlayerIds = args.goaliePlayerIds ?? new Set<number>();
  const treatment = args.emptyNetTreatment ?? ADJUSTED_IMPACT_DEFAULT_EMPTY_NET_TREATMENT;
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

    const emptyNetKnown = shot.is_empty_net_event != null;
    const emptyNetTarget = emptyNetKnown ? shot.is_empty_net_event === true && shot.goalie_in_net_id == null : null;
    if (treatment !== "included_with_strength_covariate" && emptyNetTarget == null) {
      skippedRows.push({ gameId: shot.game_id, eventId: shot.event_id, reason: "empty_net_status_unknown" });
      continue;
    }
    if (treatment === "excluded" && emptyNetTarget === true) {
      skippedRows.push({ gameId: shot.game_id, eventId: shot.event_id, reason: "empty_net_target_excluded" });
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
      empty_net_target: emptyNetTarget,
      empty_net_indicator: treatment === "explicit_indicator" ? (emptyNetTarget ? 1 : 0) : null,
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
    emptyNetTreatment: adjustedImpactEmptyNetTreatmentStatus(treatment),
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

export function validateAdjustedImpactHeldOut(
  rows: AdjustedImpactDesignRow[],
  options: AdjustedImpactHeldOutValidationOptions = {}
): AdjustedImpactHeldOutValidationReport {
  const validationFraction = Math.min(
    Math.max(options.validationFraction ?? DEFAULT_VALIDATION_FRACTION, 0.05),
    0.5
  );
  const minTrainingRows = options.minTrainingRows ?? 1;
  const minValidationRows = options.minValidationRows ?? 1;
  const minimumMseImprovement = options.minimumMseImprovement ?? 0;
  const blockingReasons: string[] = [];
  const warnings: string[] = [];
  const withDates = datedRows(rows);
  const uniqueDates = Array.from(new Set(withDates.map((row) => row.game_date!)));

  if (withDates.length !== rows.length) {
    warnings.push("rows_without_game_dates_excluded_from_held_out_validation");
  }
  if (uniqueDates.length < 2) {
    blockingReasons.push("insufficient_distinct_game_dates_for_chronological_validation");
  }

  const validationDateCount = Math.max(1, Math.ceil(uniqueDates.length * validationFraction));
  const validationStartDate = uniqueDates[Math.max(1, uniqueDates.length - validationDateCount)] ?? null;
  const trainingRows = validationStartDate
    ? withDates.filter((row) => row.game_date! < validationStartDate)
    : [];
  const validationRows = validationStartDate
    ? withDates.filter((row) => row.game_date! >= validationStartDate)
    : [];
  const trainingDates = minMaxGameDate(trainingRows);
  const validationDates = minMaxGameDate(validationRows);

  if (trainingRows.length < minTrainingRows) {
    blockingReasons.push("insufficient_training_rows_for_held_out_validation");
  }
  if (validationRows.length < minValidationRows) {
    blockingReasons.push("insufficient_validation_rows_for_held_out_validation");
  }

  let trainingMean: number | null = null;
  let validationMse: number | null = null;
  let baselineMse: number | null = null;
  let mseImprovement: number | null = null;
  let mseImprovementPercentage: number | null = null;
  let trainingPlayers = 0;
  let validationPlayers = 0;
  let unseenValidationPlayers = 0;

  if (blockingReasons.length === 0) {
    const model = fitAdjustedImpactBaseline(trainingRows, options);
    const trainingPlayerIds = new Set(model.player_estimates.map((estimate) => estimate.player_id));
    const validationPlayerIds = new Set(
      validationRows.flatMap((row) => row.player_coefficients.map((coefficient) => coefficient.player_id))
    );
    trainingMean = roundMetric(responseMean(trainingRows));
    validationMse = roundMetric(meanSquaredError(validationRows, (row) => baselineModelPrediction(row, model)));
    baselineMse = roundMetric(meanSquaredError(validationRows, () => trainingMean!));
    mseImprovement = roundMetric(baselineMse - validationMse);
    mseImprovementPercentage =
      baselineMse === 0 ? null : roundMetric((mseImprovement / baselineMse) * 100);
    trainingPlayers = trainingPlayerIds.size;
    validationPlayers = validationPlayerIds.size;
    unseenValidationPlayers = Array.from(validationPlayerIds).filter(
      (playerId) => !trainingPlayerIds.has(playerId)
    ).length;

    if (mseImprovement < minimumMseImprovement) {
      blockingReasons.push("held_out_mse_does_not_improve_over_training_mean_baseline");
    }
  }

  return {
    passed: blockingReasons.length === 0,
    blocking_reasons: blockingReasons,
    warnings,
    split: {
      strategy: "chronological_game_date",
      validation_fraction: validationFraction,
      training_rows: trainingRows.length,
      validation_rows: validationRows.length,
      training_start_game_date: trainingDates.min,
      training_end_game_date: trainingDates.max,
      validation_start_game_date: validationDates.min,
      validation_end_game_date: validationDates.max,
    },
    metrics: {
      training_mean_response: trainingMean,
      validation_mse: validationMse,
      baseline_mse: baselineMse,
      mse_improvement: mseImprovement,
      mse_improvement_percentage: mseImprovementPercentage,
    },
    model_summary: {
      training_players: trainingPlayers,
      validation_players: validationPlayers,
      unseen_validation_players: unseenValidationPlayers,
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

export type AdjustedImpactEmptyNetComparisonReport = {
  decision: 100;
  target_family: AdjustedImpactTargetFamily;
  split: {
    strategy: "chronological_game_date";
    validation_start_game_date: string | null;
    training_rows: Record<"excluded" | "explicit_indicator", number>;
  };
  /** Both treatments scored on the same held-out shots that are not at an empty net. */
  common_non_empty_net_validation: {
    rows: number;
    mse: Record<"excluded" | "explicit_indicator", number | null>;
    training_mean_baseline_mse: number | null;
  };
  /** Held-out shots at an empty net: only the explicit model scores them. */
  empty_net_validation: { rows: number; explicit_indicator_mse: number | null };
  player_coefficients: {
    shared_players: number;
    pearson_correlation: number | null;
    mean_absolute_difference: number | null;
  };
  skipped: Record<"excluded" | "explicit_indicator", number>;
  /** The comparison reports evidence; choosing a definition is the owner's step. */
  chosen_treatment: null;
};

function pearson(left: number[], right: number[]): number | null {
  if (left.length < 2) return null;
  const meanLeft = left.reduce((sum, value) => sum + value, 0) / left.length;
  const meanRight = right.reduce((sum, value) => sum + value, 0) / right.length;
  let covariance = 0;
  let varianceLeft = 0;
  let varianceRight = 0;
  for (let index = 0; index < left.length; index += 1) {
    covariance += (left[index]! - meanLeft) * (right[index]! - meanRight);
    varianceLeft += (left[index]! - meanLeft) ** 2;
    varianceRight += (right[index]! - meanRight) ** 2;
  }
  return varianceLeft > 0 && varianceRight > 0 ? covariance / Math.sqrt(varianceLeft * varianceRight) : null;
}

/**
 * Decision 100 held-out comparison: a model that excludes shots at an empty
 * net vs one that keeps them with an explicit indicator, trained on the same
 * chronological training dates and scored on the same held-out non-empty-net
 * shots (the common target), with the explicit model's empty-net error and
 * the agreement of player coefficients reported beside it. Pure: the caller
 * supplies the frozen inputs.
 */
export function compareAdjustedImpactEmptyNetTreatments(args: {
  shots: AdjustedImpactShotRow[];
  stintsByGameId: ReadonlyMap<number, NhlShiftStint[]>;
  goaliePlayerIds?: ReadonlySet<number>;
  options?: AdjustedImpactHeldOutValidationOptions;
}): AdjustedImpactEmptyNetComparisonReport {
  const options = args.options ?? {};
  const build = (emptyNetTreatment: "excluded" | "explicit_indicator") =>
    buildAdjustedImpactDesignRows({
      shots: args.shots,
      stintsByGameId: args.stintsByGameId,
      goaliePlayerIds: args.goaliePlayerIds,
      emptyNetTreatment,
    });
  const excluded = build("excluded");
  const explicit = build("explicit_indicator");

  const validationFraction = Math.min(Math.max(options.validationFraction ?? DEFAULT_VALIDATION_FRACTION, 0.05), 0.5);
  const uniqueDates = Array.from(
    new Set(datedRows(explicit.rows).map((row) => row.game_date!))
  ).sort();
  const validationDateCount = Math.max(1, Math.ceil(uniqueDates.length * validationFraction));
  const validationStartDate =
    uniqueDates.length >= 2 ? uniqueDates[Math.max(1, uniqueDates.length - validationDateCount)]! : null;
  const before = (rows: AdjustedImpactDesignRow[]) =>
    validationStartDate ? datedRows(rows).filter((row) => row.game_date! < validationStartDate) : [];
  const from = (rows: AdjustedImpactDesignRow[]) =>
    validationStartDate ? datedRows(rows).filter((row) => row.game_date! >= validationStartDate) : [];

  const excludedTraining = before(excluded.rows);
  const explicitTraining = before(explicit.rows);
  const commonValidation = from(explicit.rows).filter((row) => row.empty_net_target === false);
  const emptyNetValidation = from(explicit.rows).filter((row) => row.empty_net_target === true);
  // Score the excluded model on identical rows, without the indicator.
  const commonValidationForExcluded = commonValidation.map((row) => ({ ...row, empty_net_indicator: null }));

  let excludedMse: number | null = null;
  let explicitMse: number | null = null;
  let baselineMse: number | null = null;
  let explicitEnMse: number | null = null;
  let correlation: number | null = null;
  let meanAbsDiff: number | null = null;
  let sharedPlayers = 0;
  if (excludedTraining.length > 0 && explicitTraining.length > 0 && commonValidation.length > 0) {
    const excludedModel = fitAdjustedImpactBaseline(excludedTraining, options);
    const explicitModel = fitAdjustedImpactBaseline(explicitTraining, options);
    excludedMse = roundMetric(meanSquaredError(commonValidationForExcluded, (row) => baselineModelPrediction(row, excludedModel)));
    explicitMse = roundMetric(meanSquaredError(commonValidation, (row) => baselineModelPrediction(row, explicitModel)));
    const trainingMean = responseMean(excludedTraining);
    baselineMse = roundMetric(meanSquaredError(commonValidation, () => trainingMean));
    if (emptyNetValidation.length > 0) {
      explicitEnMse = roundMetric(meanSquaredError(emptyNetValidation, (row) => baselineModelPrediction(row, explicitModel)));
    }
    const explicitByPlayer = new Map(explicitModel.player_estimates.map((row) => [row.player_id, row.coefficient]));
    const pairs = excludedModel.player_estimates
      .filter((row) => explicitByPlayer.has(row.player_id))
      .sort((left, right) => left.player_id - right.player_id)
      .map((row) => [row.coefficient, explicitByPlayer.get(row.player_id)!] as const);
    sharedPlayers = pairs.length;
    correlation = pearson(pairs.map((pair) => pair[0]), pairs.map((pair) => pair[1]));
    meanAbsDiff = pairs.length
      ? roundMetric(pairs.reduce((sum, pair) => sum + Math.abs(pair[0] - pair[1]), 0) / pairs.length)
      : null;
  }

  return {
    decision: 100,
    target_family: ADJUSTED_IMPACT_TARGET_FAMILY,
    split: {
      strategy: "chronological_game_date",
      validation_start_game_date: validationStartDate,
      training_rows: { excluded: excludedTraining.length, explicit_indicator: explicitTraining.length },
    },
    common_non_empty_net_validation: {
      rows: commonValidation.length,
      mse: { excluded: excludedMse, explicit_indicator: explicitMse },
      training_mean_baseline_mse: baselineMse,
    },
    empty_net_validation: { rows: emptyNetValidation.length, explicit_indicator_mse: explicitEnMse },
    player_coefficients: {
      shared_players: sharedPlayers,
      pearson_correlation: correlation == null ? null : roundMetric(correlation),
      mean_absolute_difference: meanAbsDiff,
    },
    skipped: { excluded: excluded.skippedRows.length, explicit_indicator: explicit.skippedRows.length },
    chosen_treatment: null,
  };
}
