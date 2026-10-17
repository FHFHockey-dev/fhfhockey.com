import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "lib/supabase/database-generated.types";
import { fetchAllSupabaseFilterChunks } from "lib/supabase/pagination";

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
  latestSourceDate: string | null;
  latestProcessedSourceDate: string | null;
  missingBatchRows?: number;
}) {
  if (!args.latestSourceDate) {
    return { shouldProcess: true, reason: "source_date_unavailable" as const };
  }
  if (args.missingBatchRows) {
    return { shouldProcess: true, reason: "snapshot_batch_incomplete" as const };
  }
  if (!args.latestProcessedSourceDate) {
    return { shouldProcess: true, reason: "no_processed_source_cutoff" as const };
  }
  return args.latestSourceDate > args.latestProcessedSourceDate
    ? { shouldProcess: true, reason: "new_source_date" as const }
    : { shouldProcess: false, reason: "source_already_processed" as const };
}

// Each score row records its player's own newest game date, so the batch is
// current when every player/window row exists and the newest cutoff among them
// has reached the newest source date.
export function summarizeSustainabilityBatchScores(args: {
  playerIds: number[];
  windowCodes: readonly string[];
  rows: Array<{ player_id: number; window_code: string; source_date: string | null }>;
}) {
  const present = new Set(
    args.rows.map((row) => `${row.player_id}:${row.window_code}`)
  );
  let missingBatchRows = 0;
  for (const playerId of new Set(args.playerIds)) {
    for (const windowCode of args.windowCodes) {
      if (!present.has(`${playerId}:${windowCode}`)) missingBatchRows += 1;
    }
  }
  const processedDates = args.rows
    .map((row) => row.source_date)
    .filter((date): date is string => Boolean(date))
    .sort();
  return {
    missingBatchRows,
    latestProcessedSourceDate: processedDates.at(-1) ?? null
  };
}

export async function detectSustainabilitySourceAdvance(
  client: SupabaseClient<Database>,
  args: {
    snapshotDate: string;
    playerIds: number[];
    windowCodes: readonly string[];
  }
) {
  const [sourceResult, scoreRows] = await Promise.all([
    client
      .from("player_stats_unified")
      .select("date")
      .lte("date", args.snapshotDate)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    fetchAllSupabaseFilterChunks(args.playerIds, (chunk, range) =>
      client
        .from("sustainability_scores")
        .select("player_id, window_code, sourceCutoffs:components->sourceCutoffs")
        .eq("snapshot_date", args.snapshotDate)
        .in("player_id", chunk)
        .order("player_id", { ascending: true })
        .order("window_code", { ascending: true })
        .range(range.from, range.to)
    )
  ]);
  if (sourceResult.error) throw sourceResult.error;
  const latestSourceDate = sourceResult.data?.date ?? null;
  const { missingBatchRows, latestProcessedSourceDate } =
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
  return {
    snapshot_date: args.snapshotDate,
    batch_players: new Set(args.playerIds).size,
    missing_batch_rows: missingBatchRows,
    latest_source_date: latestSourceDate,
    latest_processed_source_date: latestProcessedSourceDate,
    ...classifySustainabilitySourceAdvance({
      latestSourceDate,
      latestProcessedSourceDate,
      missingBatchRows
    })
  };
}
