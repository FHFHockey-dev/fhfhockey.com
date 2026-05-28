import type { NextApiRequest, NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import supabase from "lib/supabase/server";
import {
  buildReboundControlAggregates,
  type ReboundControlGameRow,
  type ReboundControlOutcome,
  type ReboundControlSourceRow,
} from "lib/xg/reboundControl";

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

function parseBoolean(value: string | null): boolean {
  return value != null && ["1", "true", "yes", "y"].includes(value.toLowerCase());
}

function parseIntegerList(value: string | null): number[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((entry) => Number.isInteger(entry));
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

function boolOrFalse(value: unknown): boolean {
  return value === true;
}

function featurePayload(row: Record<string, unknown>): Record<string, unknown> {
  const payload = row.feature_payload;
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

function readOutcome(payload: Record<string, unknown>): ReboundControlOutcome | null {
  const value = payload.reboundControlOutcome;
  return value === "second_chance_allowed" ||
    value === "goalie_freeze" ||
    value === "covered_puck" ||
    value === "no_danger_continuation" ||
    value === "unknown"
    ? value
    : null;
}

async function fetchReboundPredictionRows(args: {
  modelVersion: string;
  featureVersion: number;
  seasonId: number | null;
  gameIds: number[];
  limit: number | null;
}): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];
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
        [
          "model_version",
          "prediction_type",
          "feature_version",
          "game_id",
          "event_id",
          "season_id",
          "game_date",
          "event_owner_team_id",
          "shooter_player_id",
          "goalie_in_net_id",
          "shot_event_type",
          "label",
          "xg",
          "raw_probability",
          "calibrated_probability",
          "model_approved",
        ].join(",")
      )
      .eq("model_version", args.modelVersion)
      .eq("prediction_type", "rebound_creation")
      .eq("feature_version", args.featureVersion)
      .order("game_date", { ascending: true })
      .order("game_id", { ascending: true })
      .order("event_id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (args.seasonId != null) query = query.eq("season_id", args.seasonId);
    if (args.gameIds.length) query = query.in("game_id", args.gameIds);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch rebound predictions: ${error.message}`);
    if (!data?.length) break;
    rows.push(...((data as unknown) as Array<Record<string, unknown>>));
    if (data.length < pageSize) break;
  }
  return rows;
}

async function fetchFeatureRows(
  predictionRows: Array<Record<string, unknown>>,
  featureVersion: number
): Promise<Map<string, Record<string, unknown>>> {
  const byGame = new Map<number, number[]>();
  for (const row of predictionRows) {
    const gameId = Number(row.game_id);
    const eventId = Number(row.event_id);
    if (!Number.isFinite(gameId) || !Number.isFinite(eventId)) continue;
    byGame.set(gameId, [...(byGame.get(gameId) ?? []), eventId]);
  }

  const out = new Map<string, Record<string, unknown>>();
  for (const [gameId, eventIds] of byGame) {
    for (const chunk of chunkRows(Array.from(new Set(eventIds)), 500)) {
      const { data, error } = await supabase
        .from("nhl_xg_shot_features" as any)
        .select(
          [
            "feature_version",
            "game_id",
            "event_id",
            "creates_rebound",
            "is_rebound_shot",
            "is_empty_net_event",
            "is_delayed_penalty_event",
            "feature_payload",
          ].join(",")
        )
        .eq("feature_version", featureVersion)
        .eq("game_id", gameId)
        .in("event_id", chunk);
      if (error) throw new Error(`Failed to fetch rebound-control features: ${error.message}`);
      for (const row of ((data ?? []) as unknown) as Array<Record<string, unknown>>) {
        out.set(`${row.game_id}:${row.event_id}`, row);
      }
    }
  }
  return out;
}

async function fetchGames(gameIds: number[]): Promise<ReboundControlGameRow[]> {
  if (gameIds.length === 0) return [];
  const rows: ReboundControlGameRow[] = [];
  for (const chunk of chunkRows(Array.from(new Set(gameIds)), 500)) {
    const { data, error } = await supabase
      .from("games")
      .select("id,seasonId,date,homeTeamId,awayTeamId")
      .in("id", chunk);
    if (error) throw new Error(`Failed to fetch rebound-control games: ${error.message}`);
    rows.push(
      ...(((data ?? []) as unknown) as Array<Record<string, unknown>>).map((row) => ({
        id: Number(row.id),
        seasonId: numberOrNull(row.seasonId),
        date: typeof row.date === "string" ? row.date : null,
        homeTeamId: numberOrNull(row.homeTeamId),
        awayTeamId: numberOrNull(row.awayTeamId),
      }))
    );
  }
  return rows;
}

function mapSourceRows(
  predictionRows: Array<Record<string, unknown>>,
  featureRows: Map<string, Record<string, unknown>>
): ReboundControlSourceRow[] {
  return predictionRows.map((prediction) => {
    const feature = featureRows.get(`${prediction.game_id}:${prediction.event_id}`) ?? {};
    const payload = featurePayload(feature);
    return {
      model_version: String(prediction.model_version),
      prediction_type: "rebound_creation",
      feature_version: Number(prediction.feature_version),
      game_id: Number(prediction.game_id),
      event_id: Number(prediction.event_id),
      season_id: numberOrNull(prediction.season_id),
      game_date: typeof prediction.game_date === "string" ? prediction.game_date : null,
      event_owner_team_id: numberOrNull(prediction.event_owner_team_id),
      shooter_player_id: numberOrNull(prediction.shooter_player_id),
      goalie_in_net_id: numberOrNull(prediction.goalie_in_net_id),
      shot_event_type: typeof prediction.shot_event_type === "string" ? prediction.shot_event_type : null,
      expected_rebound_probability: Number(prediction.xg),
      raw_probability: numberOrNull(prediction.raw_probability),
      calibrated_probability: numberOrNull(prediction.calibrated_probability),
      label: prediction.label == null ? null : prediction.label === true,
      model_approved: prediction.model_approved === true,
      creates_rebound: boolOrFalse(feature.creates_rebound),
      is_rebound_shot: boolOrFalse(feature.is_rebound_shot),
      is_empty_net_event: boolOrFalse(feature.is_empty_net_event),
      is_delayed_penalty_event: boolOrFalse(feature.is_delayed_penalty_event),
      rebound_control_outcome: readOutcome(payload),
      creates_goalie_freeze: boolOrFalse(payload.createsGoalieFreeze),
      creates_covered_puck: boolOrFalse(payload.createsCoveredPuck),
      creates_no_danger_continuation: boolOrFalse(payload.createsNoDangerContinuation),
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

  const modelVersion = firstQueryValue(req.query.modelVersion);
  if (!modelVersion) {
    return res.status(400).json({
      success: false,
      error: "Provide rebound_creation modelVersion.",
    });
  }

  const featureVersion = parseInteger(firstQueryValue(req.query.featureVersion), 1);
  const seasonId = parseOptionalInteger(firstQueryValue(req.query.seasonId));
  const gameIds = parseIntegerList(firstQueryValue(req.query.gameIds));
  const limit = parseOptionalInteger(firstQueryValue(req.query.limit));
  const dryRun = parseBoolean(firstQueryValue(req.query.dryRun));
  const upsertBatchSize = Math.max(
    1,
    parseInteger(firstQueryValue(req.query.upsertBatchSize), DEFAULT_UPSERT_BATCH_SIZE)
  );

  const predictionRows = await fetchReboundPredictionRows({
    modelVersion,
    featureVersion,
    seasonId,
    gameIds,
    limit,
  });
  const featureRows = await fetchFeatureRows(predictionRows, featureVersion);
  const sourceRows = mapSourceRows(predictionRows, featureRows);
  const games = await fetchGames(sourceRows.map((row) => row.game_id));
  const aggregates = buildReboundControlAggregates(sourceRows, games);
  const counts = {
    predictionRows: predictionRows.length,
    featureRows: featureRows.size,
    sourceRows: sourceRows.length,
    teamGameRows: aggregates.teamGameRows.length,
    playerGameRows: aggregates.playerGameRows.length,
    goalieGameRows: aggregates.goalieGameRows.length,
  };

  if (dryRun) {
    return res.status(200).json({
      success: true,
      dryRun,
      modelVersion,
      featureVersion,
      seasonId,
      gameIds,
      counts,
      qa: aggregates.qa,
      samples: aggregates.goalieGameRows.slice(0, 10),
    });
  }

  const upserted = {
    teamGameRows: await upsertRows(
      "nhl_xg_rebound_control_team_game_aggregates",
      aggregates.teamGameRows,
      "rebound_model_version,feature_version,game_id,team_id",
      upsertBatchSize
    ),
    playerGameRows: await upsertRows(
      "nhl_xg_rebound_control_player_game_aggregates",
      aggregates.playerGameRows,
      "rebound_model_version,feature_version,game_id,player_id",
      upsertBatchSize
    ),
    goalieGameRows: await upsertRows(
      "nhl_xg_rebound_control_goalie_game_aggregates",
      aggregates.goalieGameRows,
      "rebound_model_version,feature_version,game_id,goalie_player_id",
      upsertBatchSize
    ),
  };

  return res.status(200).json({
    success: true,
    dryRun,
    modelVersion,
    featureVersion,
    seasonId,
    gameIds,
    counts,
    qa: aggregates.qa,
    upserted,
    samples: aggregates.goalieGameRows.slice(0, 10),
  });
}

export default withCronJobAudit(handler, {
  jobName: "update-nhl-xg-rebound-control",
});
