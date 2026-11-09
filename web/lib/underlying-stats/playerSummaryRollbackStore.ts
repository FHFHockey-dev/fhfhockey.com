// Bounded Supabase reads/writes for the player summary backup and rollback scripts.
// Reads metadata first (no payloads), then payloads by id in small chunks; writes 25-row inserts.
import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchAllSupabasePages } from "lib/supabase/pagination";

import {
  PLAYER_SUMMARY_ENDPOINT,
  PLAYER_SUMMARY_PARTITION_PREFIX,
  PLAYER_SUMMARY_ROLLBACK_BATCH_SIZE,
  selectPartitionHeads,
  type BackupRow,
  type BackupScope,
  type PartitionHeadRow,
  type RollbackInsertRow,
} from "./playerSummaryRollbackPlan";

const HEAD_COLUMNS = "id,game_id,source_url,fetched_at,payload_hash";
const BACKUP_COLUMNS = "id,game_id,endpoint,season_id,game_date,source_url,payload_hash,payload,fetched_at,created_at";

export const PLAYER_SUMMARY_READ_CHUNK_SIZE = 25;

function chunk<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
}

function toInteger(value: unknown, label: string): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isSafeInteger(parsed)) throw new Error(`${label} is not an integer: ${String(value)}`);
  return parsed;
}

export async function resolveScopeGameIds(supabase: SupabaseClient, scope: BackupScope): Promise<number[]> {
  if (scope.kind === "game_ids") return [...new Set(scope.gameIds)].sort((a, b) => a - b);
  // Same selection as the rebuild route's startDate/endDate mode.
  const { data, error } = await supabase
    .from("games")
    .select("id,date")
    .eq("seasonId", scope.seasonId)
    .gte("date", scope.startDate)
    .lte("date", scope.endDate)
    .order("date", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => toInteger(row.id, "games.id"));
}

/** Every v2 partition row (all versions, metadata only) for the games, and the effective heads. */
export async function fetchPartitionHeads(
  supabase: SupabaseClient,
  gameIds: readonly number[],
  options: { chunkSize?: number; pauseMs?: number } = {},
) {
  const rows: PartitionHeadRow[] = [];
  for (const gameIdChunk of chunk(gameIds, options.chunkSize ?? PLAYER_SUMMARY_READ_CHUNK_SIZE)) {
    const page = await fetchAllSupabasePages<Record<string, unknown>>(({ from, to }) =>
      supabase
        .from("nhl_api_game_payloads_raw")
        .select(HEAD_COLUMNS)
        .eq("endpoint", PLAYER_SUMMARY_ENDPOINT)
        .like("source_url", `${PLAYER_SUMMARY_PARTITION_PREFIX}%`)
        .in("game_id", gameIdChunk)
        .order("id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: Record<string, unknown>[] | null; error: unknown }>,
    );
    for (const row of page) {
      rows.push({
        id: toInteger(row.id, "id"),
        game_id: toInteger(row.game_id, "game_id"),
        source_url: String(row.source_url),
        fetched_at: String(row.fetched_at),
        payload_hash: String(row.payload_hash),
      });
    }
    if (options.pauseMs) await new Promise((resolve) => setTimeout(resolve, options.pauseMs));
  }
  return { rows, ...selectPartitionHeads(rows) };
}

/** Full rows (with payload) by id, 25 ids per request; fails if any id is missing. */
export async function fetchBackupRowsByIds(
  supabase: SupabaseClient,
  ids: readonly number[],
  options: { chunkSize?: number; pauseMs?: number } = {},
): Promise<BackupRow[]> {
  const rows: BackupRow[] = [];
  for (const idChunk of chunk(ids, options.chunkSize ?? PLAYER_SUMMARY_READ_CHUNK_SIZE)) {
    const { data, error } = await supabase.from("nhl_api_game_payloads_raw").select(BACKUP_COLUMNS).in("id", idChunk);
    if (error) throw error;
    for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
      rows.push({
        id: toInteger(row.id, "id"),
        game_id: toInteger(row.game_id, "game_id"),
        endpoint: String(row.endpoint),
        season_id: row.season_id == null ? null : toInteger(row.season_id, "season_id"),
        game_date: row.game_date == null ? null : String(row.game_date),
        source_url: String(row.source_url),
        payload_hash: String(row.payload_hash),
        payload: row.payload as Record<string, unknown>,
        fetched_at: String(row.fetched_at),
        created_at: row.created_at == null ? null : String(row.created_at),
      });
    }
    if (options.pauseMs) await new Promise((resolve) => setTimeout(resolve, options.pauseMs));
  }
  const found = new Set(rows.map((row) => row.id));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length > 0 || rows.length !== ids.length) throw new Error(`Payload read returned ${rows.length}/${ids.length} rows; missing ${missing.slice(0, 10).join(",")}.`);
  return rows;
}

/**
 * One plain INSERT of at most 25 rows (no upsert: a hash collision must fail loudly).
 * Retries once on the BEFORE-statement NHL_NORMALIZATION_WRITER_BUSY guard, like the writer.
 */
export async function insertRollbackBatch(
  supabase: SupabaseClient,
  rows: readonly RollbackInsertRow[],
  options: { busyRetryDelayMs?: number } = {},
): Promise<{ attempts: number }> {
  if (rows.length === 0 || rows.length > PLAYER_SUMMARY_ROLLBACK_BATCH_SIZE) {
    throw new Error(`Rollback batches hold 1-${PLAYER_SUMMARY_ROLLBACK_BATCH_SIZE} rows, got ${rows.length}.`);
  }
  for (let attempts = 1; ; attempts += 1) {
    const { error } = await supabase.from("nhl_api_game_payloads_raw").insert([...rows]);
    if (!error) return { attempts };
    const busy = error.code === "P0001" && error.message === "NHL_NORMALIZATION_WRITER_BUSY";
    if (!busy || attempts >= 2) throw error;
    await new Promise((resolve) => setTimeout(resolve, options.busyRetryDelayMs ?? 500));
  }
}
