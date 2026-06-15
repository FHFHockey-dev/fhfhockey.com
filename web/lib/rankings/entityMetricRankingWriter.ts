import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "lib/supabase/database-generated.types";

import {
  getContextualRankingMetricDefinition,
  type ContextualRankingMetricKey,
} from "./metricDefinitions";
import { getDefaultMatrixMetricColumns } from "./matrixMetricRegistry";
import type {
  ContextualRankingPeerGroupType,
  ContextualRankingRow,
} from "./rankingCalculator";
import { buildContextualRankingSnapshotRowsByMetric } from "./rankingQueries";
import type {
  ContextualRankingsDeploymentFilter,
  ContextualRankingsPositionFilter,
  ContextualRankingsRequest,
} from "./rankingTypes";
import type {
  SkaterProductionWindow,
  SkaterWindowStrengthState,
} from "./skaterWindowAggregation";

export type EntityMetricRankingInsert =
  Database["public"]["Tables"]["entity_metric_rankings"]["Insert"];

export type EntityMetricRankingBuildRequest = {
  season: number;
  asOfDate: string | null;
  windows: SkaterProductionWindow[];
  position: ContextualRankingsPositionFilter;
  deployment: ContextualRankingsDeploymentFilter;
  strength: SkaterWindowStrengthState;
  minGp: number | null;
  minToiSeconds: number | null;
  teamId: number | null;
  peerGroupType: ContextualRankingPeerGroupType;
  metricKeys: ContextualRankingMetricKey[];
};

export type EntityMetricRankingBuildResult = {
  request: EntityMetricRankingBuildRequest;
  rows: EntityMetricRankingInsert[];
  contexts: Array<{
    window: SkaterProductionWindow;
    snapshotDate: string | null;
    snapshotUpdatedAt: string | null;
    latestAvailableSnapshotDate: string | null;
    generatedRows: number;
  }>;
  sourceFreshness: Array<{
    window: SkaterProductionWindow;
    metricKey: ContextualRankingMetricKey;
    snapshotDate: string | null;
    snapshotUpdatedAt: string | null;
    unavailable: boolean;
    reason: string | null;
  }>;
  unavailableMetrics: Array<{
    window: SkaterProductionWindow;
    metricKey: ContextualRankingMetricKey;
    reason: string;
  }>;
};

const METHODOLOGY_VERSION = "contextual_rankings_v1";
const UPSERT_CONFLICT_COLUMNS =
  "entity_type,entity_id,season_id,snapshot_date,window_type,window_size,strength_state,metric_key,peer_group_type,peer_group_key";
const COMPOSITE_MATRIX_METRICS = new Set<string>([
  "offense_rating",
  "defense_rating",
  "mcm_score",
  "beast_tier",
  "results_luck_index",
]);

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function windowType(window: SkaterProductionWindow) {
  if (window === "last5") return "last_5";
  if (window === "last10") return "last_10";
  if (window === "last20") return "last_20";
  return "season";
}

function windowSize(window: SkaterProductionWindow) {
  if (window === "last5") return 5;
  if (window === "last10") return 10;
  if (window === "last20") return 20;
  return 0;
}

function windowSemantics(window: SkaterProductionWindow) {
  return window === "season" ? "season_to_date" : "player_last_n_games_played";
}

function explanationItems(row: ContextualRankingRow) {
  const items = [
    row.rawRank == null
      ? "Unranked because the row is unavailable or below the minimum sample."
      : `Rank ${row.rawRank} of ${row.qualifiedPeerCount} in ${row.peerGroupType}:${row.peerGroupKey}.`,
  ];
  if (row.percentile != null) {
    items.push(
      `Peer percentile ${row.percentile.toFixed(1)}%; higher is better after metric directionality is applied.`,
    );
  }
  if (!row.minimumSampleMet) {
    items.push("Minimum GP or TOI sample was not met before ranking.");
  }
  return items;
}

function rowTags(row: ContextualRankingRow) {
  return [
    ...(row.minimumSampleMet ? [] : ["low-sample"]),
    ...(row.deploymentBucket ? [row.deploymentBucket] : []),
  ];
}

function contextualRequestForMetric(args: {
  request: EntityMetricRankingBuildRequest;
  window: SkaterProductionWindow;
  metric: ContextualRankingMetricKey;
}): ContextualRankingsRequest {
  return {
    entity: "skaters",
    season: args.request.season,
    asOfDate: args.request.asOfDate,
    window: args.window,
    position: args.request.position,
    deployment: args.request.deployment,
    strength: args.request.strength,
    metric: args.metric,
    minGp: args.request.minGp,
    minToiSeconds: args.request.minToiSeconds,
    teamId: args.request.teamId,
    peerGroupType: args.request.peerGroupType,
    sort: "percentile",
    direction: "desc",
    limit: null,
    entityIds: null,
  };
}

function toInsertRow(args: {
  request: EntityMetricRankingBuildRequest;
  window: SkaterProductionWindow;
  row: ContextualRankingRow;
  snapshotDate: string;
  snapshotUpdatedAt: string | null;
}): EntityMetricRankingInsert {
  const definition = getContextualRankingMetricDefinition(args.row.metricKey);

  return {
    entity_type: "skater",
    entity_id: args.row.entityId,
    team_id: finite(args.row.teamId),
    season_id: args.request.season,
    snapshot_date: args.snapshotDate,
    window_type: windowType(args.window),
    window_size: windowSize(args.window),
    window_semantics: windowSemantics(args.window),
    strength_state: args.request.strength,
    metric_key: args.row.metricKey,
    peer_group_type: args.row.peerGroupType,
    peer_group_key: args.row.peerGroupKey,
    position_group: args.row.positionGroup ?? null,
    deployment_bucket: args.row.deploymentBucket ?? null,
    raw_value: args.row.calculatedRawValue,
    normalized_value: args.row.normalizedValue,
    raw_rank: args.row.rawRank,
    percentile: args.row.percentile,
    qualified_peer_count: args.row.qualifiedPeerCount,
    minimum_sample_met: args.row.minimumSampleMet,
    sample_confidence: args.row.sampleConfidence,
    games_played: finite(args.row.gamesPlayed),
    toi_seconds: finite(args.row.toiSeconds),
    tags: rowTags(args.row) as unknown as Json,
    explanation_items: explanationItems(args.row) as unknown as Json,
    provenance: {
      sourceTable: "rolling_player_game_metrics",
      writer: "entityMetricRankingWriter",
      snapshotUpdatedAt: args.snapshotUpdatedAt,
      methodologyVersion: METHODOLOGY_VERSION,
      metric: {
        key: args.row.metricKey,
        higherIsBetter: definition?.higherIsBetter ?? null,
        sourceFields: definition?.sourceFields ?? [],
        sourceQualityFlags: definition?.sourceQualityFlags ?? [],
      },
      warnings: args.row.warnings,
    } as unknown as Json,
    methodology_version: METHODOLOGY_VERSION,
  };
}

export function defaultEntityMetricRankingMetricKeys(args?: {
  strength?: SkaterWindowStrengthState;
}): ContextualRankingMetricKey[] {
  return getDefaultMatrixMetricColumns({ strength: args?.strength ?? "5v5" })
    .filter((column) => !COMPOSITE_MATRIX_METRICS.has(column.metricKey))
    .filter((column) => column.definition?.sourceTable === "rolling_player_game_metrics")
    .map((column) => column.metricKey);
}

export async function buildEntityMetricRankingRows(
  request: EntityMetricRankingBuildRequest,
): Promise<EntityMetricRankingBuildResult> {
  const rows: EntityMetricRankingInsert[] = [];
  const contexts: EntityMetricRankingBuildResult["contexts"] = [];
  const sourceFreshness: EntityMetricRankingBuildResult["sourceFreshness"] = [];
  const unavailableMetrics: EntityMetricRankingBuildResult["unavailableMetrics"] = [];
  const metricKeys = Array.from(new Set(request.metricKeys));
  const windows = Array.from(new Set(request.windows));

  for (const window of windows) {
    const snapshotRowsByMetric = await buildContextualRankingSnapshotRowsByMetric(
      contextualRequestForMetric({
        request,
        window,
        metric: metricKeys[0] ?? "points_per_60",
      }),
      metricKeys,
    );
    const contextStartRowCount = rows.length;
    let contextSnapshotDate: string | null = null;
    let contextSnapshotUpdatedAt: string | null = null;
    let contextLatestAvailableSnapshotDate: string | null = null;

    for (const metricKey of metricKeys) {
      const snapshot = snapshotRowsByMetric.get(metricKey);
      if (!snapshot) continue;
      contextSnapshotDate ??= snapshot.snapshotDate;
      contextSnapshotUpdatedAt ??= snapshot.snapshotUpdatedAt;
      contextLatestAvailableSnapshotDate ??= snapshot.latestAvailableSnapshotDate;
      sourceFreshness.push({
        window,
        metricKey,
        snapshotDate: snapshot.snapshotDate,
        snapshotUpdatedAt: snapshot.snapshotUpdatedAt,
        unavailable: snapshot.unavailable || snapshot.snapshotDate == null,
        reason:
          snapshot.unavailable || snapshot.snapshotDate == null
            ? snapshot.message ?? "No verified ranking snapshot rows were available."
            : null,
      });
      if (snapshot.unavailable || snapshot.snapshotDate == null) {
        unavailableMetrics.push({
          window,
          metricKey,
          reason:
            snapshot.message ?? "No verified ranking snapshot rows were available.",
        });
        continue;
      }
      rows.push(
        ...snapshot.rankedRows.map((row) =>
          toInsertRow({
            request,
            window,
            row,
            snapshotDate: snapshot.snapshotDate as string,
            snapshotUpdatedAt: snapshot.snapshotUpdatedAt,
          }),
        ),
      );
    }

    contexts.push({
      window,
      snapshotDate: contextSnapshotDate,
      snapshotUpdatedAt: contextSnapshotUpdatedAt,
      latestAvailableSnapshotDate: contextLatestAvailableSnapshotDate,
      generatedRows: rows.length - contextStartRowCount,
    });
  }

  return {
    request,
    rows,
    contexts,
    sourceFreshness,
    unavailableMetrics,
  };
}

export async function upsertEntityMetricRankingRows(
  client: SupabaseClient<Database>,
  rows: EntityMetricRankingInsert[],
) {
  const chunkSize = 500;
  let rowsUpserted = 0;

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const { error } = await client
      .from("entity_metric_rankings")
      .upsert(chunk, { onConflict: UPSERT_CONFLICT_COLUMNS });
    if (error) {
      throw new Error(`Failed to upsert entity_metric_rankings: ${error.message}`);
    }
    rowsUpserted += chunk.length;
  }

  return rowsUpserted;
}
