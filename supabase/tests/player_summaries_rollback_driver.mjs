// Runs the real rollback planner (web/lib/underlying-stats/playerSummaryRollbackPlan.ts, loaded
// with Node type stripping) for the local PostgreSQL proof in player_summaries_rollback.py.
// stdin {"op": "backup", "gameIds": [...], "rows": [full rows, all versions], "createdAt": "..."}
//    -> {"rowsText": "...", "manifest": {...}}
// stdin {"op": "plan", "rowsText": "...", "manifest": {...}, "currentRows": [metadata rows], "nowMs": n}
//    -> {"plan": {...}, "rollbackAt": "...", "rows": [insert rows for the restores]}
// stdin {"op": "readback", "rows": [insert rows], "currentRows": [metadata rows]} -> {"mismatches": [...]}
import { readFileSync } from "node:fs";

import {
  buildBackupFiles,
  buildRollbackRow,
  chooseRollbackAt,
  findReadbackMismatches,
  planRollback,
  selectPartitionHeads,
  verifyBackup,
} from "../../web/lib/underlying-stats/playerSummaryRollbackPlan.ts";

const input = JSON.parse(readFileSync(0, "utf8"));
let output;
if (input.op === "backup") {
  const { heads, ties } = selectPartitionHeads(input.rows);
  const files = buildBackupFiles({
    scope: { kind: "game_ids", gameIds: input.gameIds },
    gameIds: input.gameIds,
    rows: [...heads.values()],
    ties,
    createdAt: input.createdAt,
  });
  verifyBackup(files.manifest, files.rowsText);
  output = files;
} else if (input.op === "plan") {
  const backup = verifyBackup(input.manifest, input.rowsText);
  const { heads } = selectPartitionHeads(input.currentRows);
  const plan = planRollback({ backup, currentHeads: heads });
  const rollbackAt = chooseRollbackAt(input.nowMs, heads.values());
  const rows = plan.entries
    .filter((entry) => entry.action === "restore")
    .map((entry) => buildRollbackRow(backup.get(entry.source_url), rollbackAt));
  output = { plan, rollbackAt, rows };
} else if (input.op === "readback") {
  const { heads } = selectPartitionHeads(input.currentRows);
  output = { mismatches: findReadbackMismatches(input.rows, heads) };
} else {
  throw new Error(`unknown op ${input.op}`);
}
process.stdout.write(JSON.stringify(output));
