import type { SupabaseClient } from "@supabase/supabase-js";

import supabase from "lib/supabase/server";
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
import {
  PUBLICATION_MIN_GP,
  PUBLICATION_MIN_TOI_SECONDS,
  publicationCompletionBlockers,
  upsertPublicationMarkers,
  type RankingPublicationInsert,
} from "./rankingPublications";
import { loadSkaterCompositeSeasonSources } from "./skaterCompositeSourceCoverage";
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
  // Distinct players in the WGO-anchored source-coverage population.
  expectedEntities: number;
};

const METHODOLOGY_VERSION = "contextual_rankings_v1";
const DEFAULT_UPSERT_CHUNK_SIZE = 100;
const MAX_UPSERT_CHUNK_SIZE = 500;
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

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return String(error);
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
      `Mid-rank percentile ${row.percentile.toFixed(1)} among qualified peers after metric directionality is applied (ties share the mid-rank).`,
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
  // Publish the complete WGO-anchored season population (as the composite
  // writer does), not the interactive 30-date / 200-game recent-row search.
  const { report: sourceCoverage, rows: completeSeasonRows } =
    await loadSkaterCompositeSeasonSources(supabase, {
      season: request.season,
      strength: request.strength,
      cutoffDate: request.asOfDate ?? new Date().toISOString().slice(0, 10),
    });
  if (!sourceCoverage.verified) {
    throw new Error(
      [
        "Source coverage is not verified; no entity metric rankings were built.",
        ...sourceCoverage.blockers,
      ].join(" "),
    );
  }

  for (const window of windows) {
    const snapshotRowsByMetric = await buildContextualRankingSnapshotRowsByMetric(
      contextualRequestForMetric({
        request,
        window,
        metric: metricKeys[0] ?? "points_per_60",
      }),
      metricKeys,
      { completeSeasonRows },
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
    expectedEntities: sourceCoverage.expectedPlayerCount,
  };
}

export async function upsertEntityMetricRankingRows(
  client: SupabaseClient<Database>,
  rows: EntityMetricRankingInsert[],
  options: { chunkSize?: number } = {},
) {
  return (await upsertEntityMetricRankingRowsCounted(client, rows, options))
    .rowsUpserted;
}

// dbWrittenRows sums the affected-row counts PostgREST reports for each
// chunk (count: "exact"); it is null when any chunk did not report one.
async function upsertEntityMetricRankingRowsCounted(
  client: SupabaseClient<Database>,
  rows: EntityMetricRankingInsert[],
  options: { chunkSize?: number } = {},
) {
  const chunkSize = Math.min(
    Math.max(options.chunkSize ?? DEFAULT_UPSERT_CHUNK_SIZE, 1),
    MAX_UPSERT_CHUNK_SIZE,
  );
  let rowsUpserted = 0;
  let dbWrittenRows: number | null = 0;

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    try {
      const counted = await upsertEntityMetricRankingChunk(client, chunk);
      rowsUpserted += counted.rows;
      dbWrittenRows =
        dbWrittenRows == null || counted.dbRows == null
          ? null
          : dbWrittenRows + counted.dbRows;
    } catch (error) {
      throw new Error(
        `Failed to upsert entity_metric_rankings: ${errorMessage(error)}`,
      );
    }
  }

  return { rowsUpserted, dbWrittenRows };
}

async function upsertEntityMetricRankingChunk(
  client: SupabaseClient<Database>,
  rows: EntityMetricRankingInsert[],
): Promise<{ rows: number; dbRows: number | null }> {
  try {
    const { error, count } = await client
      .from("entity_metric_rankings")
      .upsert(rows, { onConflict: UPSERT_CONFLICT_COLUMNS, count: "exact" });
    if (error) throw error;
    return { rows: rows.length, dbRows: typeof count === "number" ? count : null };
  } catch (error) {
    if (rows.length === 1) throw error;

    const midpoint = Math.ceil(rows.length / 2);
    const firstHalf = rows.slice(0, midpoint);
    const secondHalf = rows.slice(midpoint);
    console.warn(
      "[entityMetricRankingWriter] splitting failed upsert chunk",
      JSON.stringify({
        rows: rows.length,
        firstHalfRows: firstHalf.length,
        secondHalfRows: secondHalf.length,
        error: errorMessage(error),
      }),
    );
    const firstCount = await upsertEntityMetricRankingChunk(client, firstHalf);
    const secondCount = await upsertEntityMetricRankingChunk(client, secondHalf);
    return {
      rows: firstCount.rows + secondCount.rows,
      dbRows:
        firstCount.dbRows == null || secondCount.dbRows == null
          ? null
          : firstCount.dbRows + secondCount.dbRows,
    };
  }
}

type PublicationWindowPlan = {
  windowType: string;
  windowSize: number;
  snapshotDate: string | null;
  peerGroupType: string;
  peerGroupKey: string;
  rows: EntityMetricRankingInsert[];
  writtenEntities: number;
  blockers: string[];
};

export type EntityMetricRankingPublicationPlan = {
  // A full publication (default metrics, floors and the all-skater cohort)
  // is marked; any other run writes rows the reader never serves.
  marked: boolean;
  notMarkedReasons: string[];
  expectedEntities: number;
  windows: Array<Omit<PublicationWindowPlan, "rows"> & { expectedRows: number }>;
};

function sameKeySet(left: readonly string[], right: readonly string[]) {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

function buildPublicationWindows(built: EntityMetricRankingBuildResult) {
  const { request } = built;
  const metricKeys = [...new Set(request.metricKeys)].sort();
  const notMarkedReasons: string[] = [];
  if (
    request.peerGroupType !== "all_skaters" ||
    request.teamId != null ||
    request.position !== "all" ||
    request.deployment !== "all"
  ) {
    notMarkedReasons.push("Only the all-skater cohort is a full publication.");
  }
  if (
    (request.minGp ?? PUBLICATION_MIN_GP) !== PUBLICATION_MIN_GP ||
    (request.minToiSeconds ?? PUBLICATION_MIN_TOI_SECONDS) !==
      PUBLICATION_MIN_TOI_SECONDS
  ) {
    notMarkedReasons.push("Custom sample floors are not a full publication.");
  }
  if (
    !sameKeySet(
      metricKeys,
      defaultEntityMetricRankingMetricKeys({ strength: request.strength }),
    )
  ) {
    notMarkedReasons.push("Only the default metric set is a full publication.");
  }
  if (built.unavailableMetrics.length > 0) {
    notMarkedReasons.push(
      `${built.unavailableMetrics.length} metric/window pairs were unavailable.`,
    );
  }

  const windows: PublicationWindowPlan[] = [];
  for (const window of [...new Set(request.windows)]) {
    const type = windowType(window);
    const size = windowSize(window);
    const rows = built.rows.filter(
      (row) => row.window_type === type && row.window_size === size,
    );
    const blockers: string[] = [];
    const dates = [...new Set(rows.map((row) => row.snapshot_date))];
    if (rows.length === 0) blockers.push(`${window}: no rows were built.`);
    if (dates.length > 1) {
      blockers.push(`${window}: rows span ${dates.length} snapshot dates (${dates.sort().join(", ")}).`);
    }
    const metricsWithRows = new Set(rows.map((row) => row.metric_key));
    const missingMetrics = metricKeys.filter((key) => !metricsWithRows.has(key));
    if (missingMetrics.length > 0) {
      blockers.push(`${window}: no rows for ${missingMetrics.join(", ")}.`);
    }
    const writtenEntities = new Set(rows.map((row) => row.entity_id)).size;
    if (writtenEntities !== built.expectedEntities) {
      blockers.push(
        `${window}: ${writtenEntities} skaters were built; the source-coverage population is ${built.expectedEntities}.`,
      );
    }
    windows.push({
      windowType: type,
      windowSize: size,
      snapshotDate: dates.length === 1 ? dates[0] ?? null : null,
      peerGroupType: rows[0]?.peer_group_type ?? request.peerGroupType,
      peerGroupKey: rows[0]?.peer_group_key ?? "all",
      rows,
      writtenEntities,
      blockers,
    });
  }
  return { marked: notMarkedReasons.length === 0, notMarkedReasons, windows };
}

export function planEntityMetricRankingPublication(
  built: EntityMetricRankingBuildResult,
): EntityMetricRankingPublicationPlan {
  const plan = buildPublicationWindows(built);
  return {
    marked: plan.marked,
    notMarkedReasons: plan.notMarkedReasons,
    expectedEntities: built.expectedEntities,
    windows: plan.windows.map(({ rows, ...window }) => ({
      ...window,
      expectedRows: rows.length,
    })),
  };
}

function publicationMarker(
  built: EntityMetricRankingBuildResult,
  window: PublicationWindowPlan,
  fields: Partial<RankingPublicationInsert>,
): RankingPublicationInsert {
  return {
    surface: "entity_metric_rankings",
    season_id: built.request.season,
    snapshot_date: window.snapshotDate as string,
    strength_state: built.request.strength,
    window_type: window.windowType,
    window_size: window.windowSize,
    peer_group_type: window.peerGroupType,
    peer_group_key: window.peerGroupKey,
    metric_set: [...new Set(built.request.metricKeys)].sort(),
    min_gp: PUBLICATION_MIN_GP,
    min_toi_seconds: PUBLICATION_MIN_TOI_SECONDS,
    methodology_version: METHODOLOGY_VERSION,
    expected_rows: window.rows.length,
    expected_entities: built.expectedEntities,
    ...fields,
  } as RankingPublicationInsert;
}

export type EntityMetricRankingPublishResult = {
  rowsUpserted: number;
  dbWrittenRows: number | null;
  marked: boolean;
  notMarkedReasons: string[];
  complete: boolean;
  windows: Array<{
    windowType: string;
    windowSize: number;
    snapshotDate: string | null;
    status: "writing" | "complete" | "unmarked";
    expectedRows: number;
    dbWrittenRows: number | null;
    writtenEntities: number;
    blockers: string[];
  }>;
};

// Writes a build and, for a full publication, its completion markers:
// every window is marked `writing` before the first row (a republish hides
// the date until it is rewritten), each window's rows go in with counted
// upserts, and a window turns `complete` only when the database confirmed
// its row count and the skater count matches the source-coverage population.
// A failure part-way leaves the markers at `writing`, so the reader keeps the
// last complete pair.
export async function publishEntityMetricRankingRows(
  client: SupabaseClient<Database>,
  built: EntityMetricRankingBuildResult,
  options: { chunkSize?: number } = {},
): Promise<EntityMetricRankingPublishResult> {
  const plan = buildPublicationWindows(built);
  if (!plan.marked) {
    const counted = await upsertEntityMetricRankingRowsCounted(
      client,
      built.rows,
      options,
    );
    return {
      ...counted,
      marked: false,
      notMarkedReasons: plan.notMarkedReasons,
      complete: false,
      windows: plan.windows.map((window) => ({
        windowType: window.windowType,
        windowSize: window.windowSize,
        snapshotDate: window.snapshotDate,
        status: "unmarked",
        expectedRows: window.rows.length,
        dbWrittenRows: null,
        writtenEntities: window.writtenEntities,
        blockers: [],
      })),
    };
  }

  const preflight = plan.windows.flatMap((window) => window.blockers);
  if (preflight.length > 0) {
    throw new Error(
      ["Full publication refused before writing any row.", ...preflight].join(" "),
    );
  }

  const startedAt = new Date().toISOString();
  await upsertPublicationMarkers(
    client,
    plan.windows.map((window) =>
      publicationMarker(built, window, {
        status: "writing",
        db_written_rows: null,
        written_entities: null,
        started_at: startedAt,
        completed_at: null,
      }),
    ),
  );

  let rowsUpserted = 0;
  let dbWrittenRows: number | null = 0;
  const windows: EntityMetricRankingPublishResult["windows"] = [];
  for (const window of plan.windows) {
    const counted = await upsertEntityMetricRankingRowsCounted(
      client,
      window.rows,
      options,
    );
    rowsUpserted += counted.rowsUpserted;
    dbWrittenRows =
      dbWrittenRows == null || counted.dbWrittenRows == null
        ? null
        : dbWrittenRows + counted.dbWrittenRows;
    const blockers = publicationCompletionBlockers({
      expectedRows: window.rows.length,
      dbWrittenRows: counted.dbWrittenRows,
      expectedEntities: built.expectedEntities,
      writtenEntities: window.writtenEntities,
    });
    const complete = blockers.length === 0;
    await upsertPublicationMarkers(client, [
      publicationMarker(built, window, {
        status: complete ? "complete" : "writing",
        db_written_rows: counted.dbWrittenRows,
        written_entities: window.writtenEntities,
        started_at: startedAt,
        completed_at: complete ? new Date().toISOString() : null,
      }),
    ]);
    windows.push({
      windowType: window.windowType,
      windowSize: window.windowSize,
      snapshotDate: window.snapshotDate,
      status: complete ? "complete" : "writing",
      expectedRows: window.rows.length,
      dbWrittenRows: counted.dbWrittenRows,
      writtenEntities: window.writtenEntities,
      blockers,
    });
  }

  return {
    rowsUpserted,
    dbWrittenRows,
    marked: true,
    notMarkedReasons: [],
    complete: windows.every((window) => window.status === "complete"),
    windows,
  };
}
