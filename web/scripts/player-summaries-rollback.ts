// Rollback of the player underlying-summary partitions to a verified backup.
//
// Dry run (default, read-only): player-summaries-rollback.ts --backup DIR
// Apply:                         player-summaries-rollback.ts --backup DIR --apply --expect-plan-sha256 HEX [--pause-ms 250]
//
// The raw table is append-only, so rollback re-inserts each backed-up payload as a new row whose
// generatedAt/fetched_at is strictly newer than every current head (fresh payload_hash). --apply
// must carry the planSha256 the dry run printed, so it acts only on the reviewed plan. Each
// 25-row batch re-reads its heads first (compare-and-set: abort if any moved since the plan),
// inserts, then reads back and aborts unless every partition's head is the row it wrote. A
// receipt (DIR/receipt-*.json) records each verified batch, so a resumed run skips them.
import { closeSync, openSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildRollbackRow,
  chooseRollbackAt,
  findChangedHeads,
  findReadbackMismatches,
  planRollback,
  PLAYER_SUMMARY_ROLLBACK_BATCH_SIZE,
} from "../lib/underlying-stats/playerSummaryRollbackPlan";
import { fetchPartitionHeads, insertRollbackBatch } from "../lib/underlying-stats/playerSummaryRollbackStore";
import { createServiceRoleClientFromEnv, parseFlags, readBackupDir } from "./player-summaries-backup";

export type RollbackReceipt = {
  format: "fhfh-player-summary-rollback-receipt/v1";
  backupRowsSha256: string;
  planSha256: string;
  rollbackAt: string;
  status: "in_progress" | "complete" | "aborted";
  error?: string;
  inserted: Array<{ source_url: string; id: number; payload_hash: string; backup_id: number; replaced_id: number }>;
};

export function loadRestoredIds(dir: string, backupRowsSha256: string) {
  const restored = new Map<string, Set<number>>();
  for (const name of readdirSync(dir).filter((file) => /^receipt-.*\.json$/.test(file))) {
    const receipt = JSON.parse(readFileSync(join(dir, name), "utf8")) as RollbackReceipt;
    if (receipt.backupRowsSha256 !== backupRowsSha256) throw new Error(`${name} belongs to another backup.`);
    for (const row of receipt.inserted) {
      if (!restored.has(row.source_url)) restored.set(row.source_url, new Set());
      restored.get(row.source_url)!.add(row.id);
    }
  }
  return restored;
}

function writeReceipt(path: string, receipt: RollbackReceipt) {
  const temp = `${path}.tmp`;
  const fd = openSync(temp, "w", 0o600);
  try { writeFileSync(fd, `${JSON.stringify(receipt, null, 2)}\n`); } finally { closeSync(fd); }
  renameSync(temp, path);
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
}

export async function runPlayerSummaryRollback(
  argv: string[],
  deps: { supabase: SupabaseClient; now?: () => Date; busyRetryDelayMs?: number },
) {
  const values = parseFlags(argv, ["backup", "expect-plan-sha256", "pause-ms"], ["apply"]) as {
    backup?: string; apply?: boolean; "expect-plan-sha256"?: string; "pause-ms"?: string;
  };
  if (!values.backup) throw new Error("--backup DIR is required.");
  const dir = resolve(values.backup);
  const pauseMs = values["pause-ms"] ? Number(values["pause-ms"]) : 250;
  const { manifest, rows: backup } = readBackupDir(dir);
  const restoredIds = loadRestoredIds(dir, manifest.rowsSha256);

  const current = await fetchPartitionHeads(deps.supabase, manifest.gameIds, { pauseMs });
  const plan = planRollback({ backup, currentHeads: current.heads, restoredIds });
  const summary = {
    backup: dir,
    backupRowsSha256: manifest.rowsSha256,
    games: manifest.gameIds.length,
    partitions: plan.entries.length,
    restore: plan.restoreCount,
    unchanged: plan.unchangedCount,
    alreadyRestored: plan.alreadyRestoredCount,
    newPartitionsNotRestorable: plan.newPartitions.length,
    newPartitionSample: plan.newPartitions.slice(0, 5).map((row) => row.source_url),
    currentTies: current.ties.length,
    restoreBatches: Math.ceil(plan.restoreCount / PLAYER_SUMMARY_ROLLBACK_BATCH_SIZE),
    planSha256: plan.planSha256,
  };

  if (!values.apply) return { status: "dry_run", ...summary, databaseWrites: 0 };
  if (values["expect-plan-sha256"] !== plan.planSha256) {
    throw new Error(`Plan changed since the dry run (expected ${values["expect-plan-sha256"] ?? "none"}, now ${plan.planSha256}); nothing written.`);
  }
  if (plan.restoreCount === 0) return { status: "nothing_to_restore", ...summary, databaseWrites: 0 };

  const nowMs = (deps.now?.() ?? new Date()).getTime();
  const rollbackAt = chooseRollbackAt(nowMs, current.heads.values());
  const receiptPath = join(dir, `receipt-${rollbackAt.replace(/[:.]/g, "-")}.json`);
  const receipt: RollbackReceipt = {
    format: "fhfh-player-summary-rollback-receipt/v1",
    backupRowsSha256: manifest.rowsSha256,
    planSha256: plan.planSha256,
    rollbackAt,
    status: "in_progress",
    inserted: [],
  };
  writeReceipt(receiptPath, receipt);

  const restoreEntries = plan.entries.filter((entry) => entry.action === "restore");
  let statements = 0;
  try {
    for (const entries of chunk(restoreEntries, PLAYER_SUMMARY_ROLLBACK_BATCH_SIZE)) {
      const gameIds = [...new Set(entries.map((entry) => entry.game_id))];
      const before = await fetchPartitionHeads(deps.supabase, gameIds, { pauseMs });
      const moved = findChangedHeads(entries, before.heads);
      if (moved.length > 0) throw new Error(`Compare-and-set failed: ${moved.length} head(s) moved since the plan (${moved.slice(0, 3).join(", ")}).`);

      const rows = entries.map((entry) => buildRollbackRow(backup.get(entry.source_url)!, rollbackAt));
      await insertRollbackBatch(deps.supabase, rows, { busyRetryDelayMs: deps.busyRetryDelayMs });
      statements += 1;

      const after = await fetchPartitionHeads(deps.supabase, gameIds, { pauseMs });
      const mismatched = findReadbackMismatches(rows, after.heads);
      if (mismatched.length > 0) throw new Error(`Readback failed: ${mismatched.length} partition(s) not at the restored row (${mismatched.slice(0, 3).join(", ")}).`);
      for (const [index, row] of rows.entries()) {
        const head = after.heads.get(row.source_url)!;
        receipt.inserted.push({
          source_url: row.source_url, id: head.id, payload_hash: row.payload_hash,
          backup_id: entries[index].backup.id, replaced_id: entries[index].current.id,
        });
      }
      writeReceipt(receiptPath, receipt);
    }
  } catch (error) {
    receipt.status = "aborted";
    receipt.error = error instanceof Error ? error.message : String(error);
    writeReceipt(receiptPath, receipt);
    throw error;
  }
  receipt.status = "complete";
  writeReceipt(receiptPath, receipt);
  return { status: "applied", ...summary, rollbackAt, rowsInserted: receipt.inserted.length, insertStatements: statements, receipt: receiptPath };
}

if (require.main === module) {
  runPlayerSummaryRollback(process.argv.slice(2), { supabase: createServiceRoleClientFromEnv() })
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
