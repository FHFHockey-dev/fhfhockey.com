// Read-only backup of the effective player underlying-summary partitions for a bounded scope.
//
// Export: player-summaries-backup.ts --out-dir NEW_DIR (--game-ids 1,2,3 | --season-id S --start-date YYYY-MM-DD --end-date YYYY-MM-DD) [--max-games 100] [--pause-ms 250]
// Verify: player-summaries-backup.ts --verify DIR   (offline: bytes, sha256, manifest consistency)
//
// Writes DIR/rows.jsonl (one full row per partition, the newest per (game_id, source_url)) and
// DIR/manifest.json (scope, ids, hashes, sha256 of rows.jsonl). Reads metadata first, payloads by
// id 25 at a time, then re-reads the heads and fails if any moved while it exported.
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildBackupFiles,
  verifyBackup,
  type BackupManifest,
  type BackupScope,
} from "../lib/underlying-stats/playerSummaryRollbackPlan";
import {
  fetchBackupRowsByIds,
  fetchPartitionHeads,
  resolveScopeGameIds,
} from "../lib/underlying-stats/playerSummaryRollbackStore";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const DEFAULT_MAX_BACKUP_GAMES = 100;

export function parseBackupScope(values: {
  "game-ids"?: string; "season-id"?: string; "start-date"?: string; "end-date"?: string;
}): BackupScope {
  if (values["game-ids"]) {
    if (values["season-id"] || values["start-date"] || values["end-date"]) throw new Error("Use --game-ids or a date range, not both.");
    const gameIds = values["game-ids"].split(",").map((part) => Number(part.trim()));
    if (gameIds.length === 0 || gameIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) throw new Error("--game-ids must be positive integers.");
    return { kind: "game_ids", gameIds: [...new Set(gameIds)] };
  }
  const seasonId = Number(values["season-id"]);
  const startDate = values["start-date"] ?? "";
  const endDate = values["end-date"] ?? "";
  if (!Number.isSafeInteger(seasonId) || seasonId <= 0 || !ISO_DATE.test(startDate) || !ISO_DATE.test(endDate) || startDate > endDate) {
    throw new Error("Give --game-ids, or --season-id with --start-date <= --end-date (YYYY-MM-DD).");
  }
  return { kind: "date_range", seasonId, startDate, endDate };
}

/** Minimal strict --flag parser (this repo's @types/node predates util.parseArgs). */
export function parseFlags(argv: readonly string[], stringFlags: readonly string[], booleanFlags: readonly string[] = []) {
  const values: Record<string, string | boolean | undefined> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index].startsWith("--") ? argv[index].slice(2) : "";
    if (booleanFlags.includes(name)) { values[name] = true; continue; }
    if (!stringFlags.includes(name)) throw new Error(`Unknown argument ${argv[index]}.`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`--${name} needs a value.`);
    values[name] = value;
    index += 1;
  }
  return values;
}

export function readBackupDir(dir: string) {
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as BackupManifest;
  const rowsText = readFileSync(join(dir, manifest.rowsFile ?? "rows.jsonl"), "utf8");
  return { manifest, rows: verifyBackup(manifest, rowsText) };
}

function writePrivateFile(path: string, text: string) {
  const fd = openSync(path, "wx", 0o600);
  try { writeFileSync(fd, text); } finally { closeSync(fd); }
}

export async function runPlayerSummaryBackup(
  argv: string[],
  deps: { supabase?: SupabaseClient; now?: () => Date } = {},
) {
  const values = parseFlags(argv, [
    "out-dir", "verify", "game-ids", "season-id", "start-date", "end-date", "max-games", "pause-ms",
  ]) as Record<string, string | undefined>;

  if (values.verify) {
    const { manifest, rows } = readBackupDir(resolve(values.verify));
    return { status: "verified", partitions: rows.size, games: manifest.gameIds.length, rowsSha256: manifest.rowsSha256, databaseReads: 0 };
  }

  if (!values["out-dir"]) throw new Error("--out-dir NEW_DIR is required (or --verify DIR).");
  if (!deps.supabase) throw new Error("A Supabase client is required for export.");
  const supabase = deps.supabase;
  const scope = parseBackupScope(values);
  const maxGames = values["max-games"] ? Number(values["max-games"]) : DEFAULT_MAX_BACKUP_GAMES;
  const pauseMs = values["pause-ms"] ? Number(values["pause-ms"]) : 250;
  if (!Number.isSafeInteger(maxGames) || maxGames <= 0) throw new Error("--max-games must be a positive integer.");

  const gameIds = await resolveScopeGameIds(supabase, scope);
  if (gameIds.length === 0) throw new Error("The scope resolves to no games.");
  if (gameIds.length > maxGames) throw new Error(`The scope has ${gameIds.length} games, above --max-games ${maxGames}.`);

  const before = await fetchPartitionHeads(supabase, gameIds, { pauseMs });
  const heads = [...before.heads.values()];
  const rows = await fetchBackupRowsByIds(supabase, heads.map((head) => head.id), { pauseMs });

  // Stable snapshot: the effective rows must not have moved while the payloads were read.
  const after = await fetchPartitionHeads(supabase, gameIds, { pauseMs });
  const moved = heads.filter((head) => after.heads.get(head.source_url)?.id !== head.id);
  const added = [...after.heads.keys()].filter((sourceUrl) => !before.heads.has(sourceUrl));
  if (moved.length > 0 || added.length > 0) {
    throw new Error(`Summary heads changed during export (${moved.length} moved, ${added.length} new); nothing written. Rerun when no writer is active.`);
  }

  const { rowsText, manifest } = buildBackupFiles({
    scope, gameIds, rows, ties: before.ties, createdAt: (deps.now?.() ?? new Date()).toISOString(),
  });
  const dir = resolve(values["out-dir"]);
  mkdirSync(dir, { recursive: false, mode: 0o700 });
  writePrivateFile(join(dir, "rows.jsonl"), rowsText);
  writePrivateFile(join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  const verified = readBackupDir(dir);
  return {
    status: "exported_and_verified",
    dir,
    games: manifest.gameIds.length,
    gamesWithoutPartitions: manifest.gamesWithoutPartitions.length,
    partitions: verified.rows.size,
    versionsScanned: before.rows.length,
    ties: manifest.ties.length,
    rowsBytes: manifest.rowsBytes,
    rowsSha256: manifest.rowsSha256,
    databaseWrites: 0,
  };
}

export function createServiceRoleClientFromEnv(): SupabaseClient {
  const dotenv = require("dotenv") as typeof import("dotenv");
  const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
  dotenv.config({ path: resolve(process.cwd(), ".env.local") });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  return createClient(url, key, { auth: { persistSession: false } });
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const needsDb = !argv.includes("--verify");
  runPlayerSummaryBackup(argv, needsDb ? { supabase: createServiceRoleClientFromEnv() } : {})
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
