import type { NextApiRequest, NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import supabase from "lib/supabase/server";
import {
  buildTransitionRows,
  type TransitionAggregateRow,
  type TransitionEventRow,
  type TransitionFeatureRow,
  type TransitionPredictionRow,
  type TransitionSourceEventRow,
} from "lib/xg/transitions";

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

async function fetchFeatureRows(args: {
  featureVersion: number;
  seasonId: number | null;
  limit: number | null;
}): Promise<TransitionFeatureRow[]> {
  const rows: TransitionFeatureRow[] = [];

  for (
    let from = 0;
    args.limit == null || rows.length < args.limit;
    from += PAGE_SIZE
  ) {
    const pageSize =
      args.limit == null ? PAGE_SIZE : Math.min(PAGE_SIZE, args.limit - rows.length);
    let query = supabase
      .from("nhl_xg_shot_features" as any)
      .select(
        [
          "feature_version",
          "game_id",
          "event_id",
          "season_id",
          "game_date",
          "event_owner_team_id",
          "shooter_player_id",
          "is_unblocked_shot_attempt",
          "is_rebound_shot",
          "is_penalty_shot_event",
          "is_shootout_event",
          "is_rush_shot",
          "rush_source_event_id",
          "rush_time_since_source_seconds",
          "previous_event_id",
          "previous_event_type_desc_key",
          "previous_event_same_team",
          "time_since_previous_event_seconds",
          "feature_payload",
        ].join(",")
      )
      .eq("feature_version", args.featureVersion)
      .eq("is_unblocked_shot_attempt", true)
      .eq("is_penalty_shot_event", false)
      .eq("is_shootout_event", false)
      .or("is_rush_shot.eq.true,feature_payload->>possessionEnteredOffensiveZone.eq.true")
      .order("game_id", { ascending: true })
      .order("event_id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (args.seasonId != null) query = query.eq("season_id", args.seasonId);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch xG transition features: ${error.message}`);
    if (!data?.length) break;

    rows.push(
      ...((data as unknown) as Array<Record<string, any>>).map((row) => ({
        feature_version: Number(row.feature_version),
        game_id: Number(row.game_id),
        event_id: Number(row.event_id),
        season_id: numberOrNull(row.season_id),
        game_date: row.game_date ?? null,
        event_owner_team_id: numberOrNull(row.event_owner_team_id),
        shooter_player_id: numberOrNull(row.shooter_player_id),
        is_unblocked_shot_attempt: row.is_unblocked_shot_attempt === true,
        is_rebound_shot: row.is_rebound_shot === true,
        is_penalty_shot_event: row.is_penalty_shot_event === true,
        is_shootout_event: row.is_shootout_event === true,
        is_rush_shot: row.is_rush_shot === true,
        rush_source_event_id: numberOrNull(row.rush_source_event_id),
        rush_source_type_desc_key: row.feature_payload?.rushSourceTypeDescKey ?? null,
        rush_time_since_source_seconds: numberOrNull(row.rush_time_since_source_seconds),
        previous_event_id: numberOrNull(row.previous_event_id),
        previous_event_type_desc_key: row.previous_event_type_desc_key ?? null,
        previous_event_same_team: row.previous_event_same_team,
        time_since_previous_event_seconds: numberOrNull(
          row.time_since_previous_event_seconds
        ),
        feature_payload: row.feature_payload ?? null,
      }))
    );
    if (data.length < pageSize) break;
  }

  return rows;
}

async function fetchPredictionRows(args: {
  modelVersion: string;
  featureVersion: number;
  seasonId: number | null;
  gameIds: number[];
}): Promise<TransitionPredictionRow[]> {
  const rows: TransitionPredictionRow[] = [];
  const gameIds = Array.from(new Set(args.gameIds)).filter((id) => Number.isFinite(id));
  if (gameIds.length === 0) return rows;

  for (const gameIdChunk of chunkRows(gameIds, 200)) {
    for (let from = 0; ; from += PAGE_SIZE) {
      let query = supabase
        .from("nhl_xg_shot_predictions" as any)
        .select("model_version,prediction_type,feature_version,game_id,event_id,xg,model_approved")
        .eq("model_version", args.modelVersion)
        .eq("prediction_type", "shot_goal")
        .eq("feature_version", args.featureVersion)
        .eq("model_approved", true)
        .in("game_id", gameIdChunk)
        .order("game_id", { ascending: true })
        .order("event_id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (args.seasonId != null) query = query.eq("season_id", args.seasonId);

      const { data, error } = await query;
      if (error) throw new Error(`Failed to fetch xG predictions: ${error.message}`);
      if (!data?.length) break;
      rows.push(...((data ?? []) as unknown as TransitionPredictionRow[]));
      if (data.length < PAGE_SIZE) break;
    }
  }
  return rows;
}

function sourceEventPairs(features: TransitionFeatureRow[]) {
  const pairs: Array<{ gameId: number; eventId: number }> = [];
  for (const feature of features) {
    const ids = [
      feature.rush_source_event_id,
      feature.previous_event_id,
      feature.feature_payload?.possessionStartEventId ?? null,
    ];
    for (const eventId of ids) {
      if (eventId != null) pairs.push({ gameId: feature.game_id, eventId });
    }
  }
  return pairs;
}

async function fetchSourceEventRows(
  features: TransitionFeatureRow[]
): Promise<TransitionSourceEventRow[]> {
  const pairs = sourceEventPairs(features);
  const gameIds = Array.from(new Set(pairs.map((row) => row.gameId)));
  const eventIds = Array.from(new Set(pairs.map((row) => row.eventId)));
  if (gameIds.length === 0 || eventIds.length === 0) return [];

  const rows: TransitionSourceEventRow[] = [];
  for (const gameIdChunk of chunkRows(gameIds, 200)) {
    for (const eventIdChunk of chunkRows(eventIds, 500)) {
      const { data, error } = await supabase
        .from("nhl_api_pbp_events" as any)
        .select(
          [
            "game_id",
            "event_id",
            "type_desc_key",
            "event_owner_team_id",
            "player_id",
            "shooting_player_id",
            "scoring_player_id",
            "winning_player_id",
            "hitting_player_id",
            "blocking_player_id",
            "zone_code",
          ].join(",")
        )
        .in("game_id", gameIdChunk)
        .in("event_id", eventIdChunk);
      if (error) throw new Error(`Failed to fetch transition source events: ${error.message}`);
      rows.push(...((data ?? []) as unknown as TransitionSourceEventRow[]));
    }
  }
  return rows;
}

async function upsertRows(table: string, rows: unknown[], onConflict: string, batchSize: number) {
  let upserted = 0;
  for (const batch of chunkRows(rows, batchSize)) {
    const { error } = await supabase
      .from(table as any)
      .upsert(batch as any, { onConflict });
    if (error) throw new Error(`Failed to upsert ${table}: ${error.message}`);
    upserted += batch.length;
  }
  return upserted;
}

function summarize(events: TransitionEventRow[], aggregates: TransitionAggregateRow[]) {
  return {
    eventRows: events.length,
    aggregateRows: aggregates.length,
    controlledEntries: events.filter((row) => row.transition_type === "controlled_entry_proxy").length,
    dumpInEntries: events.filter((row) => row.transition_type === "dump_in_entry_proxy").length,
    controlledExits: events.filter((row) => row.transition_type === "controlled_exit_proxy").length,
    failedExitsAgainst: events.filter((row) => row.transition_type === "failed_exit_against_proxy").length,
    entryAssists: events.filter((row) => row.transition_type === "entry_assist_proxy").length,
    transitionCreatedShots: events.filter((row) => row.transition_type === "transition_created_shot").length,
    transitionCreatedXg: Number(
      events
        .filter((row) => row.transition_type === "transition_created_shot")
        .reduce((sum, row) => sum + row.transition_created_xg, 0)
        .toFixed(6)
    ),
  };
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
      error: "Provide modelVersion for approved shot-goal transition metrics.",
    });
  }

  const featureVersion = parseInteger(firstQueryValue(req.query.featureVersion), 1);
  const seasonId = parseOptionalInteger(firstQueryValue(req.query.seasonId));
  const limit = parseOptionalInteger(firstQueryValue(req.query.limit));
  const dryRun = parseBoolean(firstQueryValue(req.query.dryRun));
  const upsertBatchSize = Math.max(
    1,
    parseInteger(firstQueryValue(req.query.upsertBatchSize), DEFAULT_UPSERT_BATCH_SIZE)
  );

  const features = await fetchFeatureRows({ featureVersion, seasonId, limit });
  const [predictions, sourceEvents] = await Promise.all([
    fetchPredictionRows({
      modelVersion,
      featureVersion,
      seasonId,
      gameIds: features.map((row) => row.game_id),
    }),
    fetchSourceEventRows(features),
  ]);
  const transitionRows = buildTransitionRows({
    modelVersion,
    features,
    predictions,
    sourceEvents,
  });

  const counts = {
    featureRows: features.length,
    predictionRows: predictions.length,
    sourceEventRows: sourceEvents.length,
    ...summarize(transitionRows.events, transitionRows.aggregates),
  };

  if (dryRun) {
    return res.status(200).json({
      success: true,
      dryRun,
      modelVersion,
      featureVersion,
      seasonId,
      counts,
      samples: transitionRows.events.slice(0, 10),
    });
  }

  const upserted = {
    eventRows: await upsertRows(
      "nhl_xg_transition_events",
      transitionRows.events,
      "model_version,feature_version,game_id,event_id,transition_type",
      upsertBatchSize
    ),
    aggregateRows: await upsertRows(
      "nhl_xg_transition_game_aggregates",
      transitionRows.aggregates,
      "model_version,feature_version,game_id,entity_type,entity_id",
      upsertBatchSize
    ),
  };

  return res.status(200).json({
    success: true,
    dryRun,
    modelVersion,
    featureVersion,
    seasonId,
    counts,
    upserted,
    samples: transitionRows.events.slice(0, 10),
  });
}

export default withCronJobAudit(handler, {
  jobName: "update-nhl-xg-transitions",
});
