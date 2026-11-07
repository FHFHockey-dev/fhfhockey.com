import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { LEDGER_SOURCES, scorePairedLedger, type LedgerRow } from "../lib/player-forecasts/servedForecastLedger";

/** Read-only adapter for retained point forecasts. Never converts means to sample trajectories.
 * H10/H20 require a different, genuinely frozen cumulative artifact, not successive daily issues. */
export const LEDGER_EVALUATION_VERSION = "forge-retained-ledger-diagnostic-v1";
export type RetainedLedgerRow = LedgerRow & { created_at: string; updated_at?: string };
const time = (value: unknown) => typeof value === "string" ? Date.parse(value) : NaN;
const key = (row: LedgerRow) => [row.season_id, row.served_date, row.player_class, row.player_id, row.game_id].join(":");
const identity = (row: LedgerRow) => [row.season_id, row.player_id, row.game_id, row.team_id].every(n => Number.isSafeInteger(n) && n > 0)
  && /^\d{4}-\d{2}-\d{2}$/.test(row.served_date) && ["skater", "goalie"].includes(row.player_class) && LEDGER_SOURCES.includes(row.source);
const invalidCounts = (row: LedgerRow) => {
  const counts = row.player_class === "skater"
    ? [row.act_goals, row.act_assists, row.act_pp_points, row.act_shots, row.act_hits, row.act_blocks]
    : [row.act_saves, row.act_goals_against, row.act_shots_against, row.act_win, row.act_shutout];
  if (counts.some(n => n !== null && n !== undefined && (!Number.isSafeInteger(n) || n < 0))) return true;
  if ((row.act_win != null && row.act_win > 1) || (row.act_shutout != null && row.act_shutout > 1)) return true;
  if (row.act_pp_points != null && row.act_goals != null && row.act_assists != null && row.act_pp_points > row.act_goals + row.act_assists) return true;
  if (row.act_shots_against != null && row.act_saves != null && row.act_goals_against != null && row.act_shots_against !== row.act_saves + row.act_goals_against) return true;
  return row.dressed === false && counts.some(n => n != null && n !== 0);
};
const invalidPrediction = (row: LedgerRow) => {
  const means = [row.exp_goals, row.exp_assists, row.exp_pp_points, row.exp_shots, row.exp_hits, row.exp_blocks,
    row.exp_saves, row.exp_goals_against, row.exp_shots_against];
  if (means.some(n => n != null && (!Number.isFinite(n) || n < 0))) return true;
  if ([row.participation_probability, row.start_probability, row.exp_win_prob, row.exp_shutout_prob]
    .some(n => n != null && (!Number.isFinite(n) || n < 0 || n > 1))) return true;
  // Three independently rounded four-decimal ledger values can differ by at most .00015.
  const tolerance = 0.00015 + 1e-9;
  if (row.exp_pp_points != null && row.exp_goals != null && row.exp_assists != null && row.exp_pp_points > row.exp_goals + row.exp_assists + tolerance) return true;
  return row.exp_shots_against != null && row.exp_saves != null && row.exp_goals_against != null
    && Math.abs(row.exp_shots_against - row.exp_saves - row.exp_goals_against) > tolerance;
};
const compact = (rows: LedgerRow[]) => scorePairedLedger(rows).comparisons
  .filter(row => ["bridge_exact", "bridge_reaimed"].includes(row.source) && ["naive_last5", "naive_season"].includes(row.reference))
  .map(({ source, reference, player_class, pairing, heads, binary, scoringPopulation, binaryPopulation }) =>
    ({ source, reference, player_class, pairing, heads, binary, scoringPopulation, binaryPopulation }));

export function evaluateRetainedLedger(rows: RetainedLedgerRow[], asOf: string) {
  if (!Number.isFinite(time(asOf)) || !Array.isArray(rows) || rows.length > 10000) throw new Error("Invalid asOf or bounded ledger input");
  const accepted: LedgerRow[] = [], scorable: LedgerRow[] = [], excluded: Array<{ index: number; reason: string }> = [];
  const forecastUnavailable: Array<{ index: number; reason: string }> = [];
  const outcomeUnavailable: Array<{ index: number; reason: string }> = [];
  for (const [index, row] of rows.entries()) {
    let reason: string | null = null;
    if (!identity(row)) reason = "invalid_identity";
    else if (![row.cutoff_at, row.issued_at, row.created_at, row.scheduled_at].every(v => Number.isFinite(time(v)))) reason = "missing_clock";
    else if (!(time(row.cutoff_at) <= time(row.issued_at) && time(row.issued_at) <= time(row.created_at)
      && time(row.created_at) < time(row.scheduled_at) && time(row.created_at) <= time(asOf))) reason = "not_retained_pregame";
    else if (!row.method_version || !row.source_watermark) reason = "missing_version_or_watermark";
    if (reason) { excluded.push({ index, reason }); continue; }
    const copy = { ...row };
    if (!row.settled_at || !(time(row.scheduled_at) <= time(row.settled_at) && time(row.settled_at) <= time(asOf)) || invalidCounts(row)) {
      outcomeUnavailable.push({ index, reason: !row.settled_at ? "unsettled" : invalidCounts(row) ? "invalid_observed_counts" : "invalid_or_immature_settlement" });
      for (const field of Object.keys(copy)) if (field.startsWith("act_")) (copy as unknown as Record<string, unknown>)[field] = null;
      copy.dressed = null; copy.started = null; copy.settled_at = null;
    }
    accepted.push(copy);
    if (invalidPrediction(copy)) forecastUnavailable.push({ index, reason: "invalid_prediction_accounting" });
    else scorable.push(copy);
  }
  const bySource = LEDGER_SOURCES.flatMap(source => ["skater", "goalie"].map(playerClass => {
    const list = accepted.filter(row => row.source === source && row.player_class === playerClass);
    return { source, playerClass, retained: list.length, knownAppearance: list.filter(row => row.dressed === true).length,
      knownDnp: list.filter(row => row.dressed === false).length, unknownAppearance: list.filter(row => row.dressed === null).length,
      settled: list.filter(row => row.settled_at).length };
  })).filter(row => row.retained);
  // Fixed seven-calendar-day clusters keep players and games sharing a date together.
  // Expose paired block estimates; this short, incomplete cohort does not justify a promotion CI.
  const blocks = new Map<number, LedgerRow[]>();
  for (const row of scorable) {
    const block = Math.floor(Date.parse(`${row.served_date}T00:00:00Z`) / (7 * 86400000));
    blocks.set(block, [...(blocks.get(block) ?? []), row]);
  }
  return { version: LEDGER_EVALUATION_VERSION, evidenceClass: "retained_pregame_point_forecasts", asOf,
    population: { inputRows: rows.length, acceptedRows: accepted.length, uniqueRetainedPlayerGames: new Set(accepted.map(key)).size,
      independentEligiblePopulation: null, bySource, excluded, outcomeUnavailable, forecastUnavailable },
    horizons: [{ horizon: 1, status: "partial_diagnostic", comparisons: compact(scorable) },
      ...[10, 20].map(horizon => ({ horizon, status: "unavailable", reason: "no_frozen_cumulative_window_in_served_ledger" }))],
    calendarBlocks: [...blocks].sort(([a], [b]) => a - b).map(([block, list]) => ({
      start: new Date(block * 7 * 86400000).toISOString(), comparisons: compact(list) })),
    uncertainty: { interval: null, reason: "Short, incompletely settled convenience cohort; report paired calendar blocks without a qualification interval." },
    promotion: "none", limitations: [
      "The union of retained forecast rows is not the independently captured forecast-time eligible population; rookies with no history or forecasts may be absent.",
      "All input rows remain in coverage accounting. Existing paired count metrics are dressed-only diagnostics, not unconditional population accuracy.",
      "The ledger is upserted, not an immutable forecast archive. created_at proves initial row retention, not the vintage of every current field.",
      "Bridge and baseline issuance/cutoff times can differ. This is a comparison of served outputs, not a controlled rate/exposure experiment.",
      "Captured naive_season is current-season appearance means; naive_last5 is five skater appearances but ten goalie starts. Neither is a shrunk prior-season benchmark.",
      "Historical source rows can be revised. Source watermarks do not contain full input snapshots, rights receipts or first-available timestamps.",
      "PIM, goalie minutes, relief, complete zero-exposure outcomes and joint samples are absent: no SV%, GAA, distribution, interval, or cumulative-trajectory scores are manufactured.",
    ] };
}

export function runLedgerEvaluation(argv: string[]) {
  const started = performance.now(), args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    if (!["--input", "--output", "--as-of"].includes(argv[i]) || !argv[i + 1] || args.has(argv[i])) throw new Error("Use --input FILE --as-of ISO [--output NEW_FILE]");
    args.set(argv[i], argv[i + 1]);
  }
  if (!args.has("--input") || !args.has("--as-of")) throw new Error("Input and as-of required");
  const path = resolve(args.get("--input")!);
  if (statSync(path).size > 16 * 1024 * 1024) throw new Error("Export exceeds 16 MiB");
  const bytes = readFileSync(path), input = JSON.parse(bytes.toString());
  if (input.schema !== "forge-served-ledger-export-v1" || !Array.isArray(input.columns) || !Array.isArray(input.rows)
    || new Set(input.columns).size !== input.columns.length || input.columns.some((column: unknown) => typeof column !== "string")
    || !["created_at", "issued_at", "cutoff_at", "scheduled_at", "settled_at", "dressed"].every(column => input.columns.includes(column))) throw new Error("Invalid export schema");
  const rows = input.rows.map((values: unknown[]) => {
    if (!Array.isArray(values) || values.length !== input.columns.length) throw new Error("Invalid export row");
    return Object.fromEntries(input.columns.map((column: string, i: number) => [column, values[i]])) as RetainedLedgerRow;
  });
  const report = { ...evaluateRetainedLedger(rows, args.get("--as-of")!), inputSha256: createHash("sha256").update(new Uint8Array(bytes)).digest("hex"),
    exportedAt: input.exportedAt, runtimeMs: performance.now() - started };
  if (args.has("--output")) writeFileSync(resolve(args.get("--output")!), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  return report;
}

if (require.main === module) {
  try { process.stdout.write(JSON.stringify(runLedgerEvaluation(process.argv.slice(2)), null, 2) + "\n"); }
  catch (error) { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; }
}
