/**
 * Decision 100: held-out comparison of empty-net handling in the xG
 * adjusted-impact regression (EN shots excluded vs explicitly identified).
 *
 * WRITTEN, NOT RUN. This script reads only a local JSON export and makes no
 * database, provider or network call. Producing that export is a bounded
 * production read that needs Chef/TJ approval first:
 *   - shots: nhl_xg_shot_predictions (one approved model + feature version,
 *     one season) joined to nhl_xg_shot_features (period_number,
 *     period_seconds_elapsed, strength_state, strength_exact, zone_code,
 *     is_empty_net_event) and games (home/away team ids), shaped as
 *     AdjustedImpactShotRow;
 *   - shiftRows: nhl_api_shift_rows for the same games, as the adjusted-impact
 *     route reads them;
 *   - goaliePlayerIds: goalie_in_net_id values from the same predictions.
 *
 * Usage (after an approved export):
 *   npx tsx scripts/compare-xg-adjusted-impact-empty-net.ts \
 *     --input <export.json> [--output <report.json>] \
 *     [--iterations 500] [--learningRate 0.03] [--l2 0.1] [--validationFraction 0.2]
 *
 * The report gives evidence only (chosen_treatment stays null); the chosen
 * definition and its evidence are recorded by the owner afterwards.
 */
import fs from "fs";
import path from "path";

import {
  compareAdjustedImpactEmptyNetTreatments,
  type AdjustedImpactShotRow,
} from "../lib/xg/adjustedImpact";
import { buildShiftStintsByGameId } from "../lib/xg/deploymentContext";

type ComparisonExport = {
  shots: AdjustedImpactShotRow[];
  shiftRows: unknown[];
  goaliePlayerIds: number[];
};

function argValue(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

function numberArg(name: string, fallback: number): number {
  const value = Number(argValue(name));
  return argValue(name) != null && Number.isFinite(value) ? value : fallback;
}

function main(): void {
  const input = argValue("input");
  if (!input) {
    console.error("Provide --input <export.json>. The export needs an approved bounded read; this script reads no database.");
    process.exit(1);
  }
  const payload = JSON.parse(fs.readFileSync(path.resolve(input), "utf8")) as ComparisonExport;
  const report = compareAdjustedImpactEmptyNetTreatments({
    shots: payload.shots,
    stintsByGameId: buildShiftStintsByGameId(payload.shiftRows as any[]),
    goaliePlayerIds: new Set(payload.goaliePlayerIds),
    options: {
      iterations: numberArg("iterations", 500),
      learningRate: numberArg("learningRate", 0.03),
      l2: numberArg("l2", 0.1),
      validationFraction: numberArg("validationFraction", 0.2),
    },
  });
  const output = argValue("output");
  const text = `${JSON.stringify({ input: path.basename(input), report }, null, 2)}\n`;
  if (output) fs.writeFileSync(path.resolve(output), text);
  else process.stdout.write(text);
}

main();
