import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "lib/supabase/database-generated.types";
import {
  DEFAULT_SUPABASE_FILTER_CHUNK_SIZE,
  fetchAllSupabaseFilterChunks
} from "lib/supabase/pagination";

export function sourceDateFromComponents(value: Json | null): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const cutoffs = value.sourceCutoffs;
  if (!cutoffs || typeof cutoffs !== "object" || Array.isArray(cutoffs)) return null;
  const observed = cutoffs.observed;
  if (!observed || typeof observed !== "object" || Array.isArray(observed)) return null;
  if (typeof observed.player_stats_unified === "string") {
    return observed.player_stats_unified;
  }
  return typeof observed.player_stats_source_date === "string"
    ? observed.player_stats_source_date
    : null;
}

export function classifySustainabilitySourceAdvance(args: {
  batchPlayers: number;
  missingBatchRows: number;
  hasStaleRows: boolean;
  hasRepairableRows?: boolean;
}) {
  if (args.batchPlayers === 0) {
    return { shouldProcess: true, reason: "empty_batch" as const };
  }
  if (args.missingBatchRows > 0) {
    return { shouldProcess: true, reason: "snapshot_batch_incomplete" as const };
  }
  if (args.hasStaleRows) {
    return { shouldProcess: true, reason: "new_source_date" as const };
  }
  return args.hasRepairableRows
    ? { shouldProcess: true, reason: "luck_inputs_available" as const }
    : { shouldProcess: false, reason: "source_already_processed" as const };
}

// Score rows built while sustainability_window_z was absent zero those luck
// terms and record a `missing_window_z_<stat>` warning; returns the
// `player:window:stat` keys of those missing inputs.
export function missingWindowZKeys(
  rows: Array<{ player_id: number; window_code: string; warnings: unknown }>
) {
  const keys = new Set<string>();
  for (const row of rows) {
    if (!Array.isArray(row.warnings)) continue;
    for (const warning of row.warnings) {
      if (typeof warning === "string" && warning.startsWith("missing_window_z_")) {
        keys.add(
          `${row.player_id}:${row.window_code}:${warning.slice("missing_window_z_".length)}`
        );
      }
    }
  }
  return keys;
}

// Each score row records its player's own newest game date at build time. A
// player's rows are current when all windows exist and no player_stats_unified
// row for that player is newer than the oldest of those cutoffs (a null cutoff
// means the player had no source rows yet).
export function summarizeSustainabilityBatchScores(args: {
  playerIds: number[];
  windowCodes: readonly string[];
  rows: Array<{ player_id: number; window_code: string; source_date: string | null }>;
}) {
  const cutoffsByKey = new Map(
    args.rows.map((row) => [`${row.player_id}:${row.window_code}`, row.source_date])
  );
  let missingBatchRows = 0;
  const cutoffByPlayer = new Map<number, string | null>();
  for (const playerId of new Set(args.playerIds)) {
    let oldest: string | null | undefined;
    for (const windowCode of args.windowCodes) {
      const key = `${playerId}:${windowCode}`;
      if (!cutoffsByKey.has(key)) {
        missingBatchRows += 1;
        continue;
      }
      const cutoff = cutoffsByKey.get(key) ?? null;
      if (oldest === undefined || cutoff === null || (oldest !== null && cutoff < oldest)) {
        oldest = cutoff;
      }
    }
    if (oldest !== undefined) cutoffByPlayer.set(playerId, oldest);
  }
  const processedDates = args.rows
    .map((row) => row.source_date)
    .filter((date): date is string => Boolean(date))
    .sort();
  return {
    missingBatchRows,
    cutoffByPlayer,
    latestProcessedSourceDate: processedDates.at(-1) ?? null
  };
}

// PostgREST `or` filter matching any source row newer than its player's cutoff,
// grouped by cutoff so a batch needs one short filter.
export function buildStaleSourceFilter(cutoffByPlayer: Map<number, string | null>) {
  const playersByCutoff = new Map<string | null, number[]>();
  for (const [playerId, cutoff] of cutoffByPlayer) {
    playersByCutoff.set(cutoff, [...(playersByCutoff.get(cutoff) ?? []), playerId]);
  }
  return [...playersByCutoff]
    .map(([cutoff, playerIds]) =>
      cutoff === null
        ? `player_id.in.(${playerIds.join(",")})`
        : `and(date.gt.${cutoff},player_id.in.(${playerIds.join(",")}))`
    )
    .join(",");
}

export async function detectSustainabilitySourceAdvance(
  client: SupabaseClient<Database>,
  args: {
    snapshotDate: string;
    playerIds: number[];
    windowCodes: readonly string[];
  }
) {
  const scoreRows = await fetchAllSupabaseFilterChunks(
    args.playerIds,
    (chunk, range) =>
      client
        .from("sustainability_scores")
        .select(
          "player_id, window_code, sourceCutoffs:components->sourceCutoffs, warnings:components->warnings"
        )
        .eq("snapshot_date", args.snapshotDate)
        .in("player_id", chunk)
        .order("player_id", { ascending: true })
        .order("window_code", { ascending: true })
        .range(range.from, range.to)
  );
  const { missingBatchRows, cutoffByPlayer, latestProcessedSourceDate } =
    summarizeSustainabilityBatchScores({
      playerIds: args.playerIds,
      windowCodes: args.windowCodes,
      rows: scoreRows.map((row) => ({
        player_id: row.player_id,
        window_code: row.window_code,
        source_date: sourceDateFromComponents({
          sourceCutoffs: row.sourceCutoffs
        })
      }))
    });
  let hasStaleRows = false;
  if (cutoffByPlayer.size > 0 && missingBatchRows === 0) {
    const entries = [...cutoffByPlayer];
    for (
      let index = 0;
      index < entries.length && !hasStaleRows;
      index += DEFAULT_SUPABASE_FILTER_CHUNK_SIZE
    ) {
      const { data, error } = await client
        .from("player_stats_unified")
        .select("player_id")
        .lte("date", args.snapshotDate)
        .or(
          buildStaleSourceFilter(
            new Map(entries.slice(index, index + DEFAULT_SUPABASE_FILTER_CHUNK_SIZE))
          )
        )
        .limit(1);
      if (error) throw error;
      hasStaleRows = (data ?? []).length > 0;
    }
  }
  // Degraded rows become incomplete only once a missing window_z input exists,
  // so a rebuild that still lacks it keeps skipping.
  let hasRepairableRows = false;
  const missingKeys = missingWindowZKeys(scoreRows);
  if (missingKeys.size > 0 && missingBatchRows === 0 && !hasStaleRows) {
    const degradedPlayers = [
      ...new Set([...missingKeys].map((key) => Number(key.split(":")[0])))
    ];
    const missingStats = [...new Set([...missingKeys].map((key) => key.split(":")[2]))];
    const windowZRows = await fetchAllSupabaseFilterChunks(
      degradedPlayers,
      (chunk, range) =>
        client
          .from("sustainability_window_z")
          .select("player_id, window_code, stat_code")
          .eq("snapshot_date", args.snapshotDate)
          .in("player_id", chunk)
          .in("stat_code", missingStats)
          .order("player_id", { ascending: true })
          .order("window_code", { ascending: true })
          .order("stat_code", { ascending: true })
          .range(range.from, range.to)
    );
    hasRepairableRows = windowZRows.some((row) =>
      missingKeys.has(`${row.player_id}:${row.window_code}:${row.stat_code}`)
    );
  }
  const batchPlayers = new Set(args.playerIds).size;
  return {
    snapshot_date: args.snapshotDate,
    batch_players: batchPlayers,
    missing_batch_rows: missingBatchRows,
    stale_source_rows: hasStaleRows,
    repairable_luck_rows: hasRepairableRows,
    latest_processed_source_date: latestProcessedSourceDate,
    ...classifySustainabilitySourceAdvance({
      batchPlayers,
      missingBatchRows,
      hasStaleRows,
      hasRepairableRows
    })
  };
}
