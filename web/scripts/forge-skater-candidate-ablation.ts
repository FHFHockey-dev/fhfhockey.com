import { readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { clusterBootstrap, summarize, type ScoredRow } from "./forge-counterfactual-backtest";

export type CandidateRow = {
  gameId: number; playerId: number; position: "F" | "D"; dressed: boolean;
  actual: Record<string, number | null>;
  predictions: Record<string, Record<string, number | null>>;
};
export type CandidateCohort = {
  evidence: "synthetic" | "historical_reconstruction" | "frozen_holdout";
  provenance: string;
  baseline: string; variants: string[]; heads: string[];
  fpWeights: Record<string, number>;
  rows: CandidateRow[];
};
type PairedRow = ScoredRow & { position: "F" | "D" };
const supported = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;

function fp(line: Record<string, number | null>, weights: Record<string, number>): number | null {
  let result = 0;
  for (const [head, weight] of Object.entries(weights)) {
    if (weight === 0) continue;
    if (!supported(line[head])) return null;
    result += line[head]! * weight;
  }
  return result;
}

/** Paired support per head across ALL variants, with explicit missingness counts. */
export function pairCandidateCohort(input: CandidateCohort) {
  if (!input.provenance?.trim() || !["synthetic", "historical_reconstruction", "frozen_holdout"].includes(input.evidence)) throw new Error("Missing cohort provenance");
  if (input.variants.length < 2 || new Set(input.variants).size !== input.variants.length || !input.variants.includes(input.baseline)) throw new Error("Invalid candidate variants");
  if (!input.heads.length || input.heads.includes("FP") || new Set(input.heads).size !== input.heads.length) throw new Error("Invalid candidate heads");
  if (!Object.keys(input.fpWeights).length || !Object.values(input.fpWeights).some((weight) => weight > 0)
    || Object.entries(input.fpWeights).some(([head, weight]) => !input.heads.includes(head) || !supported(weight))) throw new Error("Invalid FP weights");
  const heads = [...input.heads, "FP"];
  const excluded: Record<string, number> = { notDressed: 0 };
  const rows: PairedRow[] = [];
  const keys = new Set<string>();
  for (const source of input.rows) {
    if (!Number.isSafeInteger(source.gameId) || !Number.isSafeInteger(source.playerId) || !["F", "D"].includes(source.position)) throw new Error("Invalid candidate identity or position");
    const key = `${source.gameId}:${source.playerId}`;
    if (keys.has(key)) throw new Error("Duplicate candidate player-game");
    keys.add(key);
    if (source.dressed !== true) { excluded.notDressed++; continue; }
    const actual: Record<string, number | null> = { ...source.actual, FP: fp(source.actual, input.fpWeights) };
    const predictions: Record<string, Record<string, number | null>> = Object.fromEntries(input.variants.map((variant) => {
      const line = source.predictions[variant] ?? {};
      return [variant, { ...line, FP: fp(line, input.fpWeights) }];
    }));
    const eligible = heads.filter((head) => {
      const ok = supported(actual[head]) && input.variants.every((variant) => supported(predictions[variant][head]));
      if (!ok) excluded[head] = (excluded[head] ?? 0) + 1;
      return ok;
    });
    rows.push({ gameId: source.gameId, playerId: source.playerId, position: source.position, heads: eligible,
      actual: actual as Record<string, number>, preds: predictions as Record<string, Record<string, number>> });
  }
  return { rows, heads, excluded };
}

function metrics(rows: PairedRow[], variant: string, head: string) {
  const use = rows.filter((row) => row.heads.includes(head));
  const summary = summarize(use, variant, head);
  const xMean = summary.n ? summary.sumPred / summary.n : 0;
  const yMean = summary.n ? summary.sumActual / summary.n : 0;
  const variance = use.reduce((sum, row) => sum + (row.preds[variant][head] - xMean) ** 2, 0);
  const covariance = use.reduce((sum, row) => sum + (row.preds[variant][head] - xMean) * (row.actual[head] - yMean), 0);
  const slope = use.length >= 2 && variance > 0 ? covariance / variance : null;
  return { n: summary.n, bias: summary.n ? summary.bias : null, rmse: summary.n ? summary.rmse : null,
    sumActual: summary.sumActual, sumPredicted: summary.sumPred,
    actualOverPredicted: summary.sumPred > 0 ? summary.sumActual / summary.sumPred : null,
    mzSlope: slope, mzIntercept: slope === null ? null : yMean - slope * xMean };
}

/** Forecast-only ranks, fixed across variants; ID tie-break makes file order irrelevant. */
function deciles(rows: PairedRow[], baseline: string, rankHead: string) {
  const sorted = rows.filter((row) => row.heads.includes(rankHead)).sort((a, b) =>
    a.preds[baseline][rankHead] - b.preds[baseline][rankHead] || a.gameId - b.gameId || a.playerId - b.playerId);
  return Array.from({ length: 10 }, (_, bin) => sorted.filter((_, i) => Math.ceil((i + 1) * 10 / sorted.length) === bin + 1));
}

export function scoreCandidateCohort(input: CandidateCohort, reps = 2000) {
  if (!Number.isSafeInteger(reps) || reps < 1 || reps > 10000) throw new Error("Invalid bootstrap repetitions");
  const { rows, heads, excluded } = pairCandidateCohort(input);
  const groups = (["all", "F", "D"] as const).map((position) => {
    const group = rows.filter((row) => position === "all" || row.position === position);
    const stats = heads.map((head) => {
      const use = group.filter((row) => row.heads.includes(head));
      const headBins = deciles(use, input.baseline, head), fpBins = deciles(group, input.baseline, "FP");
      return { head, variants: input.variants.map((variant) => ({ variant, ...metrics(use, variant, head),
        byOwnHeadDecile: deciles(use, variant, head).map((bin, i) => ({ decile: i + 1, ...metrics(bin, variant, head) })),
        byBaselineHeadDecile: headBins.map((bin, i) => ({ decile: i + 1, ...metrics(bin, variant, head) })),
        byBaselineFpDecile: fpBins.map((bin, i) => ({ decile: i + 1, ...metrics(bin, variant, head) })),
        deltaVsBaseline: variant === input.baseline || !use.length ? null : clusterBootstrap(
          use.map((row) => ({ ...row, preds: { baseline: row.preds[input.baseline], candidate: row.preds[variant] } })), "candidate", head, 1, reps),
      })) };
    });
    return { position, rows: group.length, games: new Set(group.map((row) => row.gameId)).size, stats };
  });
  return { evidence: input.evidence, provenance: input.provenance, baseline: input.baseline, variants: input.variants,
    fpWeights: input.fpWeights, excluded, groups, bootstrap: { seed: 1, reps, unit: "game" },
    deciles: "Ascending forecast ranks within each position group; fixed baseline head/FP ranks for paired comparisons plus own-head ranks for calibration. Never outcome ranks.",
    qualification: "Unqualified candidate diagnostics; no automatic release or predictive-skill acceptance. MZ is descriptive without standard errors." };
}

type AuditRow = {
  game_id: number; player_id: number; pos: string; actual: Record<string, number | null>;
  proj: Record<string, Record<string, number | boolean | null>>;
};
const AUDIT_SHA256 = "f315992bd0e789b1a6da6e315e3031ef164248a13d2b290e287cb10940a6303b";

/** Adapter for the exact recorded dressed-only audit extract; never fit on these actuals. */
export function fromHistoricalAudit(bytes: Buffer): CandidateCohort {
  if (createHash("sha256").update(new Uint8Array(bytes)).digest("hex") !== AUDIT_SHA256) throw new Error("Historical audit hash mismatch");
  const source = JSON.parse(bytes.toString("utf8")) as AuditRow[];
  return { evidence: "historical_reconstruction", provenance: `2026-10-21 pre-R19 a/b/a0/b0, reconstructed later; sha256:${AUDIT_SHA256}`,
    baseline: "a", variants: ["a", "b", "a0", "b0"], heads: ["G", "A", "PPP", "SOG", "HIT", "BLK"],
    fpWeights: { G: 3, A: 2, PPP: 1, SOG: 0.2, HIT: 0.2, BLK: 0.25 },
    rows: source.map((row) => ({ gameId: row.game_id, playerId: row.player_id,
      position: row.pos === "D" ? "D" : ["F", "C", "L", "R", "LW", "RW"].includes(row.pos) ? "F" : (() => { throw new Error("Unknown audit position"); })(),
      dressed: true, actual: row.actual, predictions: Object.fromEntries(Object.entries(row.proj).map(([variant, line]) => {
        const sum = (...keys: string[]) => keys.every((key) => supported(line[key])) ? keys.reduce((s, key) => s + (line[key] as number), 0) : null;
        return [variant, { G: sum("proj_goals_es", "proj_goals_pp"), A: sum("proj_assists_es", "proj_assists_pp"),
          PPP: sum("proj_goals_pp", "proj_assists_pp"), SOG: sum("proj_shots_es", "proj_shots_pp"), HIT: sum("proj_hits"), BLK: sum("proj_blocks") }];
      })) })) };
}

export function runCandidateAblation(argv: string[]) {
  if (argv.length !== 4 || !["--historical-audit", "--cohort"].includes(argv[0]) || argv[2] !== "--output") throw new Error("Usage: --historical-audit|--cohort INPUT --output OUTPUT");
  const path = resolve(argv[1]), output = resolve(argv[3]);
  if (path === output) throw new Error("Refusing to overwrite input");
  if (statSync(path).size > 64 * 1024 * 1024) throw new Error("Input exceeds 64 MiB");
  const bytes = readFileSync(path);
  const cohort = argv[0] === "--historical-audit" ? fromHistoricalAudit(bytes) : JSON.parse(bytes.toString("utf8")) as CandidateCohort;
  const result = { inputSha256: createHash("sha256").update(new Uint8Array(bytes)).digest("hex"), ...scoreCandidateCohort(cohort) };
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
  return result;
}

if (require.main === module) {
  try { const result = runCandidateAblation(process.argv.slice(2)); console.log(JSON.stringify({ evidence: result.evidence, groups: result.groups.map(({ position, rows, games }) => ({ position, rows, games })) })); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
