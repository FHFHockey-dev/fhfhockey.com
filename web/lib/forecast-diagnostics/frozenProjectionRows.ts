import { projectionInputHash } from "../projections/inputCapture";

/** Offline diagnostic view of forecast writes; matches current production write-hash normalization without changing its module. */
export function projectionForecastRows(writes: Array<Array<{ method: string; args: unknown[] }>>) {
  const tables = new Set(["forge_player_projections", "forge_team_projections", "forge_goalie_projections"]);
  const rows = writes.filter((ops) => tables.has(String(ops[0]?.args[0]))).flatMap((ops) => {
    const write = ops.find((op) => op.method === "upsert" || op.method === "insert");
    const values = Array.isArray(write?.args[0]) ? write.args[0] : [write?.args[0]];
    return values.map((row: any) => ({
      table: ops[0].args[0],
      row: Object.fromEntries(Object.entries(row ?? {}).filter(([key]) => !["updated_at", "created_at"].includes(key))),
    }));
  });
  return rows.sort((a, b) => projectionInputHash(a).localeCompare(projectionInputHash(b)));
}
