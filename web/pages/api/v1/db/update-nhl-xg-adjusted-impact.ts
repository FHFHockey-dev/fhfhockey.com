import type { NextApiRequest, NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import supabase from "lib/supabase/server";
import { buildShiftStintsByGameId } from "lib/xg/deploymentContext";
import {
  ADJUSTED_IMPACT_TARGET_FAMILY,
  buildAdjustedImpactDesignRows,
  fitAdjustedImpactBaseline,
  validateAdjustedImpactHeldOut,
  validateAdjustedImpactLeakage,
  type AdjustedImpactUsageMode,
  type AdjustedImpactShotRow,
} from "lib/xg/adjustedImpact";

const PAGE_SIZE = 1000;
const DEFAULT_UPSERT_BATCH_SIZE = 500;

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseOptionalInteger(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value: string | null, fallback: number): number {
  return parseOptionalInteger(value) ?? fallback;
}

function parseNumber(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value: string | null): boolean {
  return value != null && ["1", "true", "yes", "y"].includes(value.toLowerCase());
}

function parseUsageMode(value: string | null): AdjustedImpactUsageMode {
  return value === "pregame" ? "pregame" : "postgame_descriptive";
}

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveAdjustedModelVersion(args: {
  queryValue: string | null;
  sourceModelVersion: string;
  featureVersion: number;
}): string {
  return (
    args.queryValue?.trim() ||
    `ridge_sgd_v1-${ADJUSTED_IMPACT_TARGET_FAMILY}-${args.sourceModelVersion}-f${args.featureVersion}`
  );
}

async function fetchApprovedShotGoalPredictions(args: {
  sourceModelVersion: string;
  featureVersion: number;
  seasonId: number | null;
  limit: number | null;
}) {
  const rows: Array<{
    model_version: string;
    feature_version: number;
    game_id: number;
    event_id: number;
    season_id: number | null;
    game_date: string | null;
    event_owner_team_id: number | null;
    goalie_in_net_id: number | null;
    xg: number;
  }> = [];

  for (
    let from = 0;
    args.limit == null || rows.length < args.limit;
    from += PAGE_SIZE
  ) {
    const pageSize =
      args.limit == null ? PAGE_SIZE : Math.min(PAGE_SIZE, args.limit - rows.length);
    let query = supabase
      .from("nhl_xg_shot_predictions" as any)
      .select(
        "model_version,feature_version,game_id,event_id,season_id,game_date,event_owner_team_id,goalie_in_net_id,xg"
      )
      .eq("model_version", args.sourceModelVersion)
      .eq("prediction_type", "shot_goal")
      .eq("feature_version", args.featureVersion)
      .eq("model_approved", true)
      .order("game_date", { ascending: true })
      .order("game_id", { ascending: true })
      .order("event_id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (args.seasonId != null) query = query.eq("season_id", args.seasonId);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch adjusted-impact xG rows: ${error.message}`);
    if (!data?.length) break;
    rows.push(...((data ?? []) as unknown as typeof rows));
    if (data.length < pageSize) break;
  }

  return rows;
}

async function fetchFeatureRows(predictions: Array<{ feature_version: number; game_id: number; event_id: number }>) {
  const rows = new Map<string, Record<string, unknown>>();
  const gameIds = Array.from(new Set(predictions.map((row) => row.game_id)));
  const eventIdsByGame = new Map<number, Set<number>>();
  for (const prediction of predictions) {
    const current = eventIdsByGame.get(prediction.game_id) ?? new Set<number>();
    current.add(prediction.event_id);
    eventIdsByGame.set(prediction.game_id, current);
  }

  for (const gameId of gameIds) {
    const eventIds = Array.from(eventIdsByGame.get(gameId) ?? []);
    for (const eventIdChunk of chunkRows(eventIds, 500)) {
      const { data, error } = await supabase
        .from("nhl_xg_shot_features" as any)
        .select(
          [
            "feature_version",
            "game_id",
            "event_id",
            "period_number",
            "period_seconds_elapsed",
            "strength_state",
            "strength_exact",
            "zone_code",
            "feature_payload",
          ].join(",")
        )
        .eq("game_id", gameId)
        .in("event_id", eventIdChunk);
      if (error) throw new Error(`Failed to fetch adjusted-impact feature rows: ${error.message}`);

      for (const row of (data ?? []) as unknown as Array<Record<string, unknown>>) {
        rows.set(`${row.feature_version}:${row.game_id}:${row.event_id}`, row);
      }
    }
  }
  return rows;
}

async function fetchGameRows(gameIds: number[]) {
  const rows = new Map<
    number,
    { id: number; homeTeamId: number | null; awayTeamId: number | null }
  >();
  for (const chunk of chunkRows(Array.from(new Set(gameIds)), 200)) {
    const { data, error } = await supabase
      .from("games")
      .select("id,homeTeamId,awayTeamId")
      .in("id", chunk);
    if (error) throw new Error(`Failed to fetch adjusted-impact game rows: ${error.message}`);
    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      rows.set(Number(row.id), {
        id: Number(row.id),
        homeTeamId: numberOrNull(row.homeTeamId),
        awayTeamId: numberOrNull(row.awayTeamId),
      });
    }
  }
  return rows;
}

async function fetchShiftRows(args: { gameIds: number[]; seasonId: number | null }) {
  const rows: Array<Record<string, unknown>> = [];
  for (const chunk of chunkRows(Array.from(new Set(args.gameIds)), 200)) {
    for (let from = 0; ; from += PAGE_SIZE) {
      let query = supabase
        .from("nhl_api_shift_rows" as any)
        .select(
          "game_id,shift_id,season_id,game_date,player_id,team_id,period,shift_number,start_seconds,end_seconds,duration_seconds"
        )
        .in("game_id", chunk)
        .order("game_id", { ascending: true })
        .order("period", { ascending: true })
        .order("start_seconds", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (args.seasonId != null) query = query.eq("season_id", args.seasonId);

      const { data, error } = await query;
      if (error) throw new Error(`Failed to fetch adjusted-impact shift rows: ${error.message}`);
      if (!data?.length) break;
      rows.push(...((data ?? []) as unknown as Array<Record<string, unknown>>));
      if (data.length < PAGE_SIZE) break;
    }
  }
  return rows;
}

function buildShotRows(args: {
  predictions: Awaited<ReturnType<typeof fetchApprovedShotGoalPredictions>>;
  featuresByKey: Map<string, Record<string, unknown>>;
  gamesById: Map<number, { id: number; homeTeamId: number | null; awayTeamId: number | null }>;
}): AdjustedImpactShotRow[] {
  return args.predictions.map((prediction) => {
    const feature =
      args.featuresByKey.get(
        `${prediction.feature_version}:${prediction.game_id}:${prediction.event_id}`
      ) ?? {};
    const game = args.gamesById.get(prediction.game_id);
    const payload =
      typeof feature.feature_payload === "object" && feature.feature_payload != null
        ? (feature.feature_payload as Record<string, unknown>)
        : {};

    return {
      model_version: prediction.model_version,
      feature_version: prediction.feature_version,
      game_id: prediction.game_id,
      event_id: prediction.event_id,
      season_id: prediction.season_id,
      game_date: prediction.game_date,
      event_owner_team_id: prediction.event_owner_team_id,
      home_team_id: game?.homeTeamId ?? null,
      away_team_id: game?.awayTeamId ?? null,
      period_number: numberOrNull(feature.period_number),
      period_seconds_elapsed: numberOrNull(feature.period_seconds_elapsed),
      strength_state: typeof feature.strength_state === "string" ? feature.strength_state : null,
      strength_exact: typeof feature.strength_exact === "string" ? feature.strength_exact : null,
      owner_score_diff_before_event: numberOrNull(payload.ownerScoreDiffBeforeEvent),
      owner_score_diff_bucket:
        typeof payload.ownerScoreDiffBucket === "string" ? payload.ownerScoreDiffBucket : null,
      zone_code: typeof feature.zone_code === "string" ? feature.zone_code : null,
      shot_zone_code:
        typeof payload.shotDangerBucket === "string" ? payload.shotDangerBucket : null,
      xg: Number(prediction.xg),
    };
  });
}

async function upsertRows(table: string, rows: unknown[], onConflict: string, batchSize: number) {
  let upserted = 0;
  for (const batch of chunkRows(rows, batchSize)) {
    const { error } = await supabase.from(table as any).upsert(batch as any, { onConflict });
    if (error) throw new Error(`Failed to upsert ${table}: ${error.message}`);
    upserted += batch.length;
  }
  return upserted;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const sourceModelVersion = firstQueryValue(req.query.modelVersion);
  if (!sourceModelVersion) {
    return res.status(400).json({
      success: false,
      error: "Provide modelVersion for the approved shot-goal source model.",
    });
  }

  const featureVersion = parseInteger(firstQueryValue(req.query.featureVersion), 1);
  const adjustedModelVersion = resolveAdjustedModelVersion({
    queryValue: firstQueryValue(req.query.adjustedModelVersion),
    sourceModelVersion,
    featureVersion,
  });
  const seasonId = parseOptionalInteger(firstQueryValue(req.query.seasonId));
  const limit = parseOptionalInteger(firstQueryValue(req.query.limit));
  const dryRun = parseBoolean(firstQueryValue(req.query.dryRun));
  const iterations = parseInteger(firstQueryValue(req.query.iterations), 500);
  const learningRate = parseNumber(firstQueryValue(req.query.learningRate), 0.03);
  const l2 = parseNumber(firstQueryValue(req.query.l2), 0.1);
  const minPlayerRows = parseInteger(firstQueryValue(req.query.minPlayerRows), 100);
  const validationFraction = parseNumber(firstQueryValue(req.query.validationFraction), 0.2);
  const minValidationRows = parseInteger(firstQueryValue(req.query.minValidationRows), 1000);
  const minimumMseImprovement = parseNumber(firstQueryValue(req.query.minimumMseImprovement), 0);
  const usageMode = parseUsageMode(firstQueryValue(req.query.usageMode));
  const upsertBatchSize = Math.max(
    1,
    parseInteger(firstQueryValue(req.query.upsertBatchSize), DEFAULT_UPSERT_BATCH_SIZE)
  );

  const predictions = await fetchApprovedShotGoalPredictions({
    sourceModelVersion,
    featureVersion,
    seasonId,
    limit,
  });
  const [featuresByKey, gamesById, shiftRows] = await Promise.all([
    fetchFeatureRows(predictions),
    fetchGameRows(predictions.map((row) => row.game_id)),
    fetchShiftRows({ gameIds: predictions.map((row) => row.game_id), seasonId }),
  ]);
  const design = buildAdjustedImpactDesignRows({
    shots: buildShotRows({ predictions, featuresByKey, gamesById }),
    stintsByGameId: buildShiftStintsByGameId(shiftRows as any[]),
    goaliePlayerIds: new Set(
      predictions
        .map((row) => row.goalie_in_net_id)
      .filter((id): id is number => id != null && Number.isFinite(id))
    ),
  });
  const leakage = validateAdjustedImpactLeakage({
    rows: design.rows,
    usageMode,
  });
  if (!leakage.passed) {
    return res.status(409).json({
      success: false,
      dryRun,
      sourceModelVersion,
      adjustedModelVersion,
      featureVersion,
      seasonId,
      leakage,
    });
  }
  const heldOutValidation = validateAdjustedImpactHeldOut(design.rows, {
    iterations,
    learningRate,
    l2,
    minPlayerRows,
    validationFraction,
    minValidationRows,
    minimumMseImprovement,
  });
  if (!heldOutValidation.passed) {
    return res.status(409).json({
      success: false,
      dryRun,
      sourceModelVersion,
      adjustedModelVersion,
      featureVersion,
      seasonId,
      leakage,
      heldOutValidation,
    });
  }
  const model = fitAdjustedImpactBaseline(design.rows, {
    iterations,
    learningRate,
    l2,
    minPlayerRows,
  });

  const generatedAt = new Date().toISOString();
  const modelRunRow = {
    adjusted_model_version: adjustedModelVersion,
    target_family: model.target_family,
    source_model_version: sourceModelVersion,
    feature_version: featureVersion,
    season_id: seasonId,
    model_family: model.model_family,
    iterations: model.iterations,
    learning_rate: model.learning_rate,
    l2: model.l2,
    intercept: model.intercept,
    training_rows: model.training_summary.rows,
    training_players: model.training_summary.players,
    context_features: model.training_summary.context_features,
    mean_response: model.training_summary.mean_response,
    mse: model.training_summary.mse,
    context_estimates: model.context_estimates,
    provenance: {
      sourceTables: ["nhl_xg_shot_predictions", "nhl_xg_shot_features", "nhl_api_shift_rows"],
      skippedRows: design.skippedRows.length,
      leakage,
      heldOutValidation,
      generatedAt,
    },
    updated_at: generatedAt,
  };
  const playerRows = model.player_estimates.map((row) => ({
    adjusted_model_version: adjustedModelVersion,
    target_family: model.target_family,
    source_model_version: sourceModelVersion,
    feature_version: featureVersion,
    season_id: seasonId,
    player_id: row.player_id,
    coefficient: row.coefficient,
    standard_error_approx: row.standard_error_approx,
    offensive_rows: row.offensive_rows,
    defensive_rows: row.defensive_rows,
    total_rows: row.total_rows,
    model_family: model.model_family,
    l2: model.l2,
    provenance: {
      sourceModelVersion,
      adjustedModelVersion,
      targetFamily: model.target_family,
      generatedAt,
      featureAvailability: leakage.feature_availability,
      heldOutValidation: {
        passed: heldOutValidation.passed,
        split: heldOutValidation.split,
        metrics: heldOutValidation.metrics,
      },
    },
    updated_at: generatedAt,
  }));
  const counts = {
    predictionRows: predictions.length,
    featureRows: featuresByKey.size,
    gameRows: gamesById.size,
    shiftRows: shiftRows.length,
    designRows: design.rows.length,
    skippedDesignRows: design.skippedRows.length,
    playerImpactRows: playerRows.length,
  };

  if (dryRun) {
    return res.status(200).json({
      success: true,
      dryRun,
      sourceModelVersion,
      adjustedModelVersion,
      featureVersion,
      seasonId,
      counts,
      leakage,
      heldOutValidation,
      model,
      skippedDesignRowSamples: design.skippedRows.slice(0, 10),
    });
  }

  const upserted = {
    modelRuns: await upsertRows(
      "nhl_xg_adjusted_impact_model_runs",
      [modelRunRow],
      "adjusted_model_version,target_family,feature_version",
      1
    ),
    playerImpacts: await upsertRows(
      "nhl_xg_adjusted_player_impacts",
      playerRows,
      "adjusted_model_version,target_family,feature_version,player_id",
      upsertBatchSize
    ),
  };

  return res.status(200).json({
    success: true,
    dryRun,
    sourceModelVersion,
    adjustedModelVersion,
    featureVersion,
    seasonId,
    counts,
    leakage,
    heldOutValidation,
    model: {
      ...model,
      player_estimates: model.player_estimates.slice(0, 25),
    },
    upserted,
    skippedDesignRowSamples: design.skippedRows.slice(0, 10),
  });
}

export default withCronJobAudit(handler, {
  jobName: "update-nhl-xg-adjusted-impact",
});
