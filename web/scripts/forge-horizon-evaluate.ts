import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { CumulativeHorizon, evaluateRollingOrigins, HORIZON_EVALUATION_VERSION, pairedCalendarBlocks, RollingCase, summarizeHorizonEvaluations } from "../lib/forge-v2/horizonEvaluation";
import { fixtureTime, horizonFixture } from "../lib/forge-v2/horizonEvaluation.fixtures";

/** Offline only. Input is {asOf, cases}; hashes must come from retained frozen artifacts.
 * --fixture exercises accounting, not NHL accuracy. No credentials, network or database imports. */
export function runHorizonEvaluation(argv: string[]) {
  const started = performance.now(), args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    if (!["--input", "--fixture", "--output", "--comparator", "--category", "--horizon", "--block-days"].includes(argv[i]) || !argv[i + 1] || args.has(argv[i])) throw new Error("Use --input FILE or --fixture true, optionally --output FILE and a paired block comparison");
    args.set(argv[i], argv[i + 1]);
  }
  if (args.has("--input") === args.has("--fixture") || args.has("--fixture") && args.get("--fixture") !== "true") throw new Error("Choose exactly one input source");
  let input: { asOf: string; cases: RollingCase[] };
  if (args.has("--fixture")) input = { asOf: fixtureTime(30), cases: [horizonFixture()] };
  else {
    const path = resolve(args.get("--input")!);
    if (statSync(path).size > 32 * 1024 * 1024) throw new Error("Input exceeds 32 MiB");
    input = JSON.parse(readFileSync(path, "utf8"));
  }
  if (!Array.isArray(input.cases) || !input.cases.length || input.cases.length > 10000) throw new Error("Expected 1–10000 frozen cases");
  const evidenceClasses = [...new Set(input.cases.map(row => row.candidate.forecast.evidenceClass))];
  if (evidenceClasses.length !== 1) throw new Error("Do not mix fixture, reconstructed and prospective evidence");
  const rows = evaluateRollingOrigins(input.cases, input.asOf);
  const evaluations = rows.flatMap(row => row.horizons.map(horizon => horizon.candidate));
  const pairArgs = ["--comparator", "--category", "--horizon", "--block-days"], requestedPair = pairArgs.some(key => args.has(key));
  if (requestedPair && (pairArgs.some(key => !args.has(key)) || ![1, 10, 20].includes(Number(args.get("--horizon"))))) throw new Error("Paired comparison needs comparator, category, horizon (1/10/20), and block-days");
  const pairedComparison = requestedPair ? pairedCalendarBlocks(input.cases, input.asOf, args.get("--comparator")!, args.get("--category")!,
    Number(args.get("--horizon")) as CumulativeHorizon, Number(args.get("--block-days"))) : null;
  const report = { version: HORIZON_EVALUATION_VERSION, evidenceClass: evidenceClasses[0], asOf: input.asOf,
    requested: evaluations.length, evaluated: evaluations.filter(row => row.state === "evaluated").length,
    unavailable: evaluations.filter(row => row.state === "unavailable"), pairedComparison, runtimeMs: performance.now() - started,
    summaries: summarizeHorizonEvaluations(evaluations), promotion: "none", limitations: ["Supplied artifacts only; provenance authenticity and eligible-population completeness require independent evidence.",
      "No model fit or accuracy gain is established by synthetic fixtures. Existing consumer contracts are unchanged."], rows };
  if (args.has("--output")) writeFileSync(resolve(args.get("--output")!), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  return report;
}

if (require.main === module) {
  try { process.stdout.write(JSON.stringify(runHorizonEvaluation(process.argv.slice(2)), null, 2) + "\n"); }
  catch (error) { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; }
}
