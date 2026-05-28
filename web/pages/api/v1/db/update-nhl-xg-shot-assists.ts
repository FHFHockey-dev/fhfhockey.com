import type { NextApiRequest, NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import supabase from "lib/supabase/server";
import {
  buildShotAssistCandidateRows,
  type ShotAssistCandidateRow,
  type ShotAssistFeatureRow,
  type ShotAssistPredictionRow,
  type ShotAssistPriorEventRow,
} from "lib/xg/shotAssists";

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

async function fetchFeatureRows(args: {
  featureVersion: number;
  seasonId: number | null;
  limit: number | null;
}): Promise<ShotAssistFeatureRow[]> {
  const rows: ShotAssistFeatureRow[] = [];

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
          "shot_event_type",
          "is_unblocked_shot_attempt",
          "is_rebound_shot",
          "is_penalty_shot_event",
          "is_shootout_event",
          "previous_event_id",
          "previous_event_type_desc_key",
          "previous_event_team_id",
          "previous_event_same_team",
          "time_since_previous_event_seconds",
          "distance_from_previous_event",
          "feature_payload",
        ].join(",")
      )
      .eq("feature_version", args.featureVersion)
      .eq("is_unblocked_shot_attempt", true)
      .eq("is_penalty_shot_event", false)
      .eq("is_shootout_event", false)
      .not("previous_event_id", "is", null)
      .order("game_id", { ascending: true })
      .order("event_id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (args.seasonId != null) {
      query = query.eq("season_id", args.seasonId);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch xG shot features: ${error.message}`);
    if (!data?.length) break;

    rows.push(
      ...((data as unknown) as Array<Record<string, any>>).map((row) => ({
        feature_version: Number(row.feature_version),
        game_id: Number(row.game_id),
        event_id: Number(row.event_id),
        season_id: row.season_id == null ? null : Number(row.season_id),
        game_date: row.game_date ?? null,
        event_owner_team_id:
          row.event_owner_team_id == null ? null : Number(row.event_owner_team_id),
        shooter_player_id:
          row.shooter_player_id == null ? null : Number(row.shooter_player_id),
        shot_event_type: row.shot_event_type ?? null,
        is_unblocked_shot_attempt: row.is_unblocked_shot_attempt === true,
        is_rebound_shot: row.is_rebound_shot === true,
        is_penalty_shot_event: row.is_penalty_shot_event === true,
        is_shootout_event: row.is_shootout_event === true,
        previous_event_id:
          row.previous_event_id == null ? null : Number(row.previous_event_id),
        previous_event_type_desc_key: row.previous_event_type_desc_key ?? null,
        previous_event_team_id:
          row.previous_event_team_id == null
            ? null
            : Number(row.previous_event_team_id),
        previous_event_same_team: row.previous_event_same_team,
        time_since_previous_event_seconds:
          row.time_since_previous_event_seconds == null
            ? null
            : Number(row.time_since_previous_event_seconds),
        distance_from_previous_event:
          row.distance_from_previous_event == null
            ? null
            : Number(row.distance_from_previous_event),
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
}): Promise<ShotAssistPredictionRow[]> {
  const rows: ShotAssistPredictionRow[] = [];
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

      if (args.seasonId != null) {
        query = query.eq("season_id", args.seasonId);
      }

      const { data, error } = await query;
      if (error) throw new Error(`Failed to fetch xG predictions: ${error.message}`);
      if (!data?.length) break;
      rows.push(...((data ?? []) as unknown as ShotAssistPredictionRow[]));
      if (data.length < PAGE_SIZE) break;
    }
  }
  return rows;
}

async function fetchPriorEventRows(
  features: ShotAssistFeatureRow[]
): Promise<ShotAssistPriorEventRow[]> {
  const priorPairs = features
    .filter((row) => row.previous_event_id != null)
    .map((row) => ({ gameId: row.game_id, eventId: row.previous_event_id as number }));
  const gameIds = Array.from(new Set(priorPairs.map((row) => row.gameId)));
  const eventIds = Array.from(new Set(priorPairs.map((row) => row.eventId)));
  if (gameIds.length === 0 || eventIds.length === 0) return [];

  const rows: ShotAssistPriorEventRow[] = [];
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

      if (error) throw new Error(`Failed to fetch prior PBP events: ${error.message}`);
      rows.push(...((data ?? []) as unknown as ShotAssistPriorEventRow[]));
    }
  }
  return rows;
}

async function upsertCandidates(rows: ShotAssistCandidateRow[], batchSize: number) {
  let upserted = 0;
  for (const batch of chunkRows(rows, batchSize)) {
    const { error } = await supabase
      .from("nhl_xg_shot_assist_candidates" as any)
      .upsert(batch as any, {
        onConflict: "model_version,feature_version,game_id,event_id,candidate_rank",
      });
    if (error) {
      throw new Error(`Failed to upsert shot-assist candidates: ${error.message}`);
    }
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
      error: "Provide modelVersion for approved shot-goal shot-assist candidates.",
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
  const [predictions, priorEvents] = await Promise.all([
    fetchPredictionRows({
      modelVersion,
      featureVersion,
      seasonId,
      gameIds: features.map((row) => row.game_id),
    }),
    fetchPriorEventRows(features),
  ]);
  const candidates = buildShotAssistCandidateRows({
    features,
    predictions,
    priorEvents,
  });
  const counts = {
    featureRows: features.length,
    predictionRows: predictions.length,
    priorEventRows: priorEvents.length,
    candidateRows: candidates.length,
    highConfidenceCandidates: candidates.filter((row) => row.confidence_tier === "high").length,
    mediumConfidenceCandidates: candidates.filter((row) => row.confidence_tier === "medium").length,
    lowConfidenceCandidates: candidates.filter((row) => row.confidence_tier === "low").length,
    expectedPrimaryAssists: Number(
      candidates.reduce((sum, row) => sum + row.expected_primary_assists, 0).toFixed(6)
    ),
  };

  if (dryRun) {
    return res.status(200).json({
      success: true,
      dryRun,
      modelVersion,
      featureVersion,
      seasonId,
      counts,
      samples: candidates.slice(0, 10),
    });
  }

  const rowsUpserted = await upsertCandidates(candidates, upsertBatchSize);
  return res.status(200).json({
    success: true,
    dryRun,
    modelVersion,
    featureVersion,
    seasonId,
    counts,
    rowsUpserted,
    samples: candidates.slice(0, 10),
  });
}

export default withCronJobAudit(handler, {
  jobName: "update-nhl-xg-shot-assists",
});
