import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "lib/supabase/database-generated.types";
import type { GamePredictionFeatureSnapshotPayload } from "lib/game-predictions/featureBuilder";
import type { GamePredictionResult } from "lib/game-predictions/baselineModel";

type SourceProvenanceInsert =
  Database["public"]["Tables"]["source_provenance_snapshots"]["Insert"];

const STALE_THRESHOLD_DAYS = 14;

function addDays(date: string, days: number): string {
  const parsed = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) return date;
  return new Date(parsed + days * 86_400_000).toISOString();
}

function toObservedAt(sourceDate: string | null, fallbackIso: string): string {
  return sourceDate ? `${sourceDate}T23:59:59.000Z` : fallbackIso;
}

function sortDateDesc(a: string | null, b: string | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return b.localeCompare(a);
}

function aggregateCutoffs(payload: GamePredictionFeatureSnapshotPayload) {
  const grouped = new Map<string, typeof payload.sourceCutoffs>();
  for (const cutoff of payload.sourceCutoffs) {
    grouped.set(cutoff.table, [...(grouped.get(cutoff.table) ?? []), cutoff]);
  }
  return Array.from(grouped.entries()).map(([sourceName, cutoffs]) => {
    const latestCutoff =
      cutoffs
        .map((cutoff) => cutoff.cutoff)
        .sort(sortDateDesc)[0] ?? null;
    const missing = cutoffs.every((cutoff) => cutoff.cutoff == null);
    const stale = cutoffs.some((cutoff) => cutoff.stale);
    const currentOnly = cutoffs.some((cutoff) => cutoff.asOfRule === "current_prediction_only");
    return {
      sourceName,
      latestCutoff,
      missing,
      stale,
      currentOnly,
      cutoffs,
    };
  });
}

export function buildGamePredictionSourceProvenanceRows(args: {
  payload: GamePredictionFeatureSnapshotPayload;
  prediction: GamePredictionResult;
}): SourceProvenanceInsert[] {
  const { payload, prediction } = args;
  const nowIso = new Date().toISOString();
  const featureRows = aggregateCutoffs(payload).map((source, index) => ({
    snapshot_date: payload.gameDate,
    source_type: "game_prediction_feature",
    entity_type: "game",
    entity_id: payload.gameId,
    game_id: payload.gameId,
    source_name: source.sourceName,
    source_url: null,
    source_rank: index + 1,
    is_official: false,
    status: source.stale || source.missing ? "stale" : "observed",
    observed_at: toObservedAt(source.latestCutoff, prediction.predictionCutoffAt),
    freshness_expires_at:
      source.latestCutoff == null
        ? null
        : source.currentOnly
          ? addDays(payload.sourceAsOfDate, 1)
          : addDays(source.latestCutoff, STALE_THRESHOLD_DAYS + 1),
    payload: {
      sourceAsOfDate: payload.sourceAsOfDate,
      cutoffs: source.cutoffs,
    } as unknown as Json,
    metadata: {
      modelName: prediction.modelName,
      modelVersion: prediction.modelVersion,
      featureSetVersion: prediction.featureSetVersion,
      currentOnly: source.currentOnly,
    } as unknown as Json,
    updated_at: nowIso,
  }));

  return [
    ...featureRows,
    {
      snapshot_date: payload.gameDate,
      source_type: "game_prediction_output",
      entity_type: "game",
      entity_id: payload.gameId,
      game_id: payload.gameId,
      source_name: "game_prediction_outputs",
      source_url: null,
      source_rank: featureRows.length + 1,
      is_official: false,
      status: "observed",
      observed_at: prediction.predictionCutoffAt,
      freshness_expires_at: addDays(payload.gameDate, 2),
      payload: {
        predictionScope: prediction.predictionScope,
        homeWinProbability: prediction.homeWinProbability,
        awayWinProbability: prediction.awayWinProbability,
        predictedWinnerTeamId: prediction.predictedWinnerTeamId,
        confidenceLabel: prediction.confidenceLabel,
      } as unknown as Json,
      metadata: {
        modelName: prediction.modelName,
        modelVersion: prediction.modelVersion,
        featureSetVersion: prediction.featureSetVersion,
      } as unknown as Json,
      updated_at: nowIso,
    },
  ];
}

export async function upsertGamePredictionSourceProvenanceRows(args: {
  client: SupabaseClient<Database>;
  payload: GamePredictionFeatureSnapshotPayload;
  prediction: GamePredictionResult;
}): Promise<number> {
  const rows = buildGamePredictionSourceProvenanceRows({
    payload: args.payload,
    prediction: args.prediction,
  });
  if (rows.length === 0) return 0;

  const { error } = await args.client
    .from("source_provenance_snapshots" as any)
    .upsert(rows as any, {
      onConflict: "snapshot_date,source_type,entity_type,entity_id,source_name,game_id",
    });
  if (error) throw error;
  return rows.length;
}
