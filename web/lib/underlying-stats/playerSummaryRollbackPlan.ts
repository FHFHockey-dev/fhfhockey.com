// Pure backup/rollback planning for the player underlying-summary snapshots.
//
// nhl_api_game_payloads_raw is append-only (no-update/no-delete triggers), and readers take the
// newest row per (game_id, source_url) by fetched_at. A rebuild cannot be undone by deleting its
// rows, and re-inserting the old payload unchanged is a no-op: its (game_id, endpoint,
// payload_hash) already exists, so ON CONFLICT does nothing and the rebuilt row stays newest.
// Rollback therefore re-inserts each backed-up payload as a NEW row whose generatedAt/fetched_at
// is strictly newer than every current head, which gives it a fresh payload_hash.
//
// This module has no runtime imports besides node:crypto so the local PostgreSQL proof
// (supabase/tests/player_summaries_rollback.py) can load it directly with Node type stripping.
import { createHash } from "node:crypto";

// Mirrors PLAYER_STATS_SUMMARY_STORAGE_ENDPOINT / _PARTITION_SOURCE_URL_PREFIX in
// playerStatsLandingServer.ts (asserted equal in the unit test).
export const PLAYER_SUMMARY_ENDPOINT = "landing";
export const PLAYER_SUMMARY_PARTITION_PREFIX = "derived://underlying-player-summary-v2/";
export const PLAYER_SUMMARY_ROLLBACK_BATCH_SIZE = 25;
export const PLAYER_SUMMARY_BACKUP_FORMAT = "fhfh-player-summary-backup/v1";

export type PartitionHeadRow = {
  id: number;
  game_id: number;
  source_url: string;
  fetched_at: string;
  payload_hash: string;
};

export type BackupRow = PartitionHeadRow & {
  endpoint: string;
  season_id: number | null;
  game_date: string | null;
  payload: Record<string, unknown>;
  created_at?: string | null;
};

export type BackupScope =
  | { kind: "game_ids"; gameIds: number[] }
  | { kind: "date_range"; seasonId: number; startDate: string; endDate: string };

export type BackupManifest = {
  format: typeof PLAYER_SUMMARY_BACKUP_FORMAT;
  createdAt: string;
  scope: BackupScope;
  gameIds: number[];
  gamesWithoutPartitions: number[];
  partitionCount: number;
  rowsFile: "rows.jsonl";
  rowsBytes: number;
  rowsSha256: string;
  ties: string[];
  partitions: Array<Pick<PartitionHeadRow, "id" | "game_id" | "source_url" | "fetched_at" | "payload_hash">>;
};

export type RollbackInsertRow = {
  game_id: number;
  endpoint: string;
  season_id: number | null;
  game_date: string | null;
  source_url: string;
  payload_hash: string;
  payload: Record<string, unknown>;
  fetched_at: string;
};

export type RollbackPlanEntry = {
  source_url: string;
  game_id: number;
  action: "restore" | "unchanged" | "already_restored";
  backup: Pick<PartitionHeadRow, "id" | "payload_hash" | "fetched_at">;
  current: Pick<PartitionHeadRow, "id" | "payload_hash" | "fetched_at">;
};

export type RollbackPlan = {
  entries: RollbackPlanEntry[];
  restoreCount: number;
  unchangedCount: number;
  alreadyRestoredCount: number;
  // Partitions the rebuild created that had no row before it: rollback cannot hide them.
  newPartitions: Array<Pick<PartitionHeadRow, "id" | "game_id" | "source_url" | "fetched_at" | "payload_hash">>;
  planSha256: string;
};

export function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

// Same hashing as the summary writer (sha256Json in playerStatsLandingServer.ts).
export function sha256Json(payload: unknown): string {
  return sha256Hex(JSON.stringify(payload));
}

const TIMESTAMP_PATTERN =
  /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}(?::?\d{2})?)$/;

/** Microseconds since the epoch for a PostgREST/pg timestamptz string (keeps sub-ms digits). */
export function timestampMicros(value: string): number {
  const match = TIMESTAMP_PATTERN.exec(value.trim());
  if (!match) throw new Error(`Unparseable timestamp: ${value}`);
  const [, date, time, fraction = "", zone] = match;
  let offset = zone;
  if (zone !== "Z") {
    const digits = zone.slice(1).replace(":", "");
    offset = `${zone[0]}${digits.slice(0, 2)}:${digits.slice(2, 4) || "00"}`;
  }
  const seconds = Date.parse(`${date}T${time}${offset}`);
  if (!Number.isFinite(seconds)) throw new Error(`Unparseable timestamp: ${value}`);
  return seconds * 1000 + Number(fraction.padEnd(6, "0").slice(0, 6));
}

function assertPartitionRow(row: Pick<PartitionHeadRow, "id" | "game_id" | "source_url">) {
  if (!Number.isSafeInteger(row.id) || !Number.isSafeInteger(row.game_id)) {
    throw new Error(`Row ${String(row.id)} has a non-integer id or game_id.`);
  }
  if (!row.source_url.startsWith(PLAYER_SUMMARY_PARTITION_PREFIX) || !row.source_url.endsWith(`/${row.game_id}`)) {
    throw new Error(`Row ${row.id} source_url ${row.source_url} is not a v2 partition of game ${row.game_id}.`);
  }
}

/**
 * Effective row per partition, as readers see it: newest fetched_at, ties broken by lowest id
 * (the Supabase read path's order; the direct-PG path has no tiebreak, so ties are reported).
 */
export function selectPartitionHeads<T extends PartitionHeadRow>(rows: readonly T[]) {
  const heads = new Map<string, T>();
  const tied = new Set<string>();
  for (const row of rows) {
    assertPartitionRow(row);
    const existing = heads.get(row.source_url);
    if (!existing) {
      heads.set(row.source_url, row);
      continue;
    }
    const delta = timestampMicros(row.fetched_at) - timestampMicros(existing.fetched_at);
    if (delta === 0) tied.add(row.source_url);
    if (delta > 0 || (delta === 0 && row.id < existing.id)) heads.set(row.source_url, row);
  }
  // A tie only matters while it is still at the head.
  const ties = [...tied].filter((sourceUrl) => {
    const head = heads.get(sourceUrl)!;
    const headMicros = timestampMicros(head.fetched_at);
    return rows.some((row) => row.source_url === sourceUrl && row.id !== head.id && timestampMicros(row.fetched_at) === headMicros);
  });
  return { heads, ties: ties.sort() };
}

function headSummary(row: PartitionHeadRow) {
  return { id: row.id, game_id: row.game_id, source_url: row.source_url, fetched_at: row.fetched_at, payload_hash: row.payload_hash };
}

function bySourceUrl(left: { source_url: string }, right: { source_url: string }) {
  return left.source_url < right.source_url ? -1 : left.source_url > right.source_url ? 1 : 0;
}

export function buildBackupFiles(args: {
  scope: BackupScope;
  gameIds: readonly number[];
  rows: readonly BackupRow[];
  ties: readonly string[];
  createdAt: string;
}): { rowsText: string; manifest: BackupManifest } {
  const rows = [...args.rows].sort(bySourceUrl);
  const gameIds = [...new Set(args.gameIds)].sort((a, b) => a - b);
  const seen = new Set<string>();
  for (const row of rows) {
    assertPartitionRow(row);
    if (seen.has(row.source_url)) throw new Error(`Duplicate partition ${row.source_url} in backup.`);
    seen.add(row.source_url);
    if (!gameIds.includes(row.game_id)) throw new Error(`Row ${row.id} game ${row.game_id} is outside the scope.`);
  }
  const rowsText = rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : "");
  const covered = new Set(rows.map((row) => row.game_id));
  return {
    rowsText,
    manifest: {
      format: PLAYER_SUMMARY_BACKUP_FORMAT,
      createdAt: args.createdAt,
      scope: args.scope,
      gameIds,
      gamesWithoutPartitions: gameIds.filter((gameId) => !covered.has(gameId)),
      partitionCount: rows.length,
      rowsFile: "rows.jsonl",
      rowsBytes: Buffer.byteLength(rowsText, "utf8"),
      rowsSha256: sha256Hex(rowsText),
      ties: [...args.ties].sort(),
      partitions: rows.map(headSummary),
    },
  };
}

/** Verifies a backup's bytes and internal consistency; returns its rows keyed by source_url. */
export function verifyBackup(manifest: BackupManifest, rowsText: string): Map<string, BackupRow> {
  if (manifest.format !== PLAYER_SUMMARY_BACKUP_FORMAT) throw new Error(`Unknown backup format ${String(manifest.format)}.`);
  if (Buffer.byteLength(rowsText, "utf8") !== manifest.rowsBytes) throw new Error("Backup rows byte length does not match the manifest.");
  if (sha256Hex(rowsText) !== manifest.rowsSha256) throw new Error("Backup rows sha256 does not match the manifest.");
  const lines = rowsText.split("\n").filter((line) => line.length > 0);
  if (lines.length !== manifest.partitionCount || manifest.partitions.length !== manifest.partitionCount) {
    throw new Error("Backup row count does not match the manifest.");
  }
  const rows = new Map<string, BackupRow>();
  lines.forEach((line, index) => {
    const row = JSON.parse(line) as BackupRow;
    const expected = manifest.partitions[index];
    assertPartitionRow(row);
    if (row.id !== expected.id || row.source_url !== expected.source_url || row.payload_hash !== expected.payload_hash
      || row.fetched_at !== expected.fetched_at || row.game_id !== expected.game_id) {
      throw new Error(`Backup row ${index + 1} does not match manifest entry ${expected.source_url}.`);
    }
    if (row.endpoint !== PLAYER_SUMMARY_ENDPOINT) throw new Error(`Backup row ${row.id} endpoint ${row.endpoint} is not ${PLAYER_SUMMARY_ENDPOINT}.`);
    if (!manifest.gameIds.includes(row.game_id)) throw new Error(`Backup row ${row.id} is outside the manifest scope.`);
    const payload = row.payload as { generatedAt?: unknown; game?: { id?: unknown } };
    if (!payload || typeof payload !== "object" || typeof payload.generatedAt !== "string" || Number(payload.game?.id) !== row.game_id) {
      throw new Error(`Backup row ${row.id} payload is not a summary payload for game ${row.game_id}.`);
    }
    if (rows.has(row.source_url)) throw new Error(`Duplicate partition ${row.source_url} in backup.`);
    rows.set(row.source_url, row);
  });
  return rows;
}

/**
 * Compares the backup with the current heads of the same games.
 * restoredIds: ids this backup's earlier rollback receipts inserted, per source_url, so a
 * resumed rollback does not restore a partition twice.
 */
export function planRollback(args: {
  backup: ReadonlyMap<string, BackupRow>;
  currentHeads: ReadonlyMap<string, PartitionHeadRow>;
  restoredIds?: ReadonlyMap<string, ReadonlySet<number>>;
}): RollbackPlan {
  const entries: RollbackPlanEntry[] = [];
  for (const backupRow of [...args.backup.values()].sort(bySourceUrl)) {
    const current = args.currentHeads.get(backupRow.source_url);
    if (!current) {
      throw new Error(`Partition ${backupRow.source_url} has no current row; the table should be append-only.`);
    }
    const action: RollbackPlanEntry["action"] = current.id === backupRow.id
      ? "unchanged"
      : args.restoredIds?.get(backupRow.source_url)?.has(current.id) ? "already_restored" : "restore";
    entries.push({
      source_url: backupRow.source_url,
      game_id: backupRow.game_id,
      action,
      backup: { id: backupRow.id, payload_hash: backupRow.payload_hash, fetched_at: backupRow.fetched_at },
      current: { id: current.id, payload_hash: current.payload_hash, fetched_at: current.fetched_at },
    });
  }
  const newPartitions = [...args.currentHeads.values()]
    .filter((head) => !args.backup.has(head.source_url))
    .sort(bySourceUrl)
    .map(headSummary);
  const digestInput = JSON.stringify({
    entries: entries.map((entry) => [entry.source_url, entry.action, entry.backup.id, entry.current.id, entry.current.payload_hash]),
    newPartitions: newPartitions.map((row) => [row.source_url, row.id]),
  });
  return {
    entries,
    restoreCount: entries.filter((entry) => entry.action === "restore").length,
    unchangedCount: entries.filter((entry) => entry.action === "unchanged").length,
    alreadyRestoredCount: entries.filter((entry) => entry.action === "already_restored").length,
    newPartitions,
    planSha256: sha256Hex(digestInput),
  };
}

/** A rollback timestamp strictly newer than every current head (readers order by fetched_at). */
export function chooseRollbackAt(nowMs: number, heads: Iterable<Pick<PartitionHeadRow, "fetched_at">>): string {
  let latestMs = -Infinity;
  for (const head of heads) latestMs = Math.max(latestMs, Math.floor(timestampMicros(head.fetched_at) / 1000));
  return new Date(Math.max(Math.trunc(nowMs), latestMs + 1)).toISOString();
}

export function buildRollbackRow(backupRow: BackupRow, rollbackAt: string): RollbackInsertRow {
  const payload = { ...backupRow.payload, generatedAt: rollbackAt };
  return {
    game_id: backupRow.game_id,
    endpoint: PLAYER_SUMMARY_ENDPOINT,
    season_id: backupRow.season_id,
    game_date: backupRow.game_date,
    source_url: backupRow.source_url,
    payload_hash: sha256Json(payload),
    payload,
    fetched_at: rollbackAt,
  };
}

/** Partitions whose current head moved since the plan was made (compare-and-set guard). */
export function findChangedHeads(entries: readonly RollbackPlanEntry[], heads: ReadonlyMap<string, PartitionHeadRow>): string[] {
  return entries
    .filter((entry) => {
      const head = heads.get(entry.source_url);
      return !head || head.id !== entry.current.id || head.payload_hash !== entry.current.payload_hash;
    })
    .map((entry) => entry.source_url);
}

/** Partitions whose head after insert is not the row the rollback wrote. */
export function findReadbackMismatches(rows: readonly RollbackInsertRow[], heads: ReadonlyMap<string, PartitionHeadRow>): string[] {
  return rows
    .filter((row) => {
      const head = heads.get(row.source_url);
      return !head || head.payload_hash !== row.payload_hash || timestampMicros(head.fetched_at) !== timestampMicros(row.fetched_at);
    })
    .map((row) => row.source_url);
}
