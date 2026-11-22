import { readFileSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { selectPendingProjectionDerivedDates } from "./projectionDerivedQueue";
it("production derived queue rows (read-only snapshot) -> pending dates", () => {
  const rows = JSON.parse(readFileSync(process.env.QUEUE_ROWS_JSON!, "utf8"));
  const dates = selectPendingProjectionDerivedDates({ rows, maxDates: 3 });
  writeFileSync(process.env.QUEUE_OUT_JSON!, JSON.stringify({ rowCount: rows.length, dates }, null, 2));
  // Hypothetical: 0357 relationship becomes current (after a re-ingest + relationship build) -> 11-19 queued.
  const fixed = rows.map((r: any) => r.game_id === 2026020357 ? { ...r, relationship_status: "complete",
    relationship_input_fingerprint: r.input_fingerprint, relationship_algorithm_version: rows.find((x: any) => x.game_id === 2026020356).relationship_algorithm_version } : r);
  writeFileSync(process.env.QUEUE_OUT_JSON! + ".fixed.json", JSON.stringify({ dates: selectPendingProjectionDerivedDates({ rows: fixed, maxDates: 3 }) }));
  expect(Array.isArray(dates)).toBe(true);
});
