/**
 * Chronological holdout validation of the H1–H10 predictive intervals (lib/forge-v2/h10Intervals.ts) on the
 * TJ-approved bounded reads. Local and read-only: nothing is written anywhere but the receipt file.
 *
 * Every evaluation cutoff E (09:00Z, every 3 days) issues bands exactly as the nightly route would at E. The model and
 * rate state come from rows received by E, and the calibration from the replay at E's ten earlier cutoffs, using only
 * outcomes received by E. Those bands are then scored on realized appearances (skaters) and starts (goalies) for each
 * team's next ten games. Coverage and width are reported by horizon, player type and category, with sample counts and
 * the sparse-history subset. They are compared with a simple baseline (Poisson or Bernoulli around the same mean) and
 * the uncalibrated kernel bands. Ordering and nesting are checked on every band.
 *
 *   LC_ALL=en_US.UTF-8 NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
 *     scripts/forge-h10-interval-validation.ts <packet-dir> <out.json>
 */
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { Interval, instant } from "../lib/forge-v2/contracts";
import { h10InputsFromRows } from "../lib/forge-v2/h10Reader.server";
import { Component } from "../lib/forge-v2/contracts";
import { GOALIE_BAND_POLICY, H10_INTERVAL_LEVELS, H10_INTERVAL_POLICY, IntervalCalibration, IntervalObservation, baselineBands, calibrate, calibrationAt, calibrationCutoffs, chooseBands,
  fitH10IntervalCalibration, intervalScore, intervalsValid, replayAtCutoff } from "../lib/forge-v2/h10Intervals";
import { realRows } from "./forge-h10-real-inputs";

const [packet, out, mode] = process.argv.slice(2);
if (!packet || !out) throw new Error("usage: <packet-dir> <out.json>");
const SEASON = 20262027, DATA_AT = "2026-11-23T17:20:00.000Z", MAX_TRAINING = 2000, DAY = 86400000;
const FIRST_EVAL = "2026-10-24T09:00:00.000Z", LAST_EVAL = "2026-11-20T09:00:00.000Z";

/** Left-continuous equal-tail quantiles of a Poisson (counts) or Bernoulli (WIN, SHUTOUT) with the same mean. */
function baseline(category: string, mean: number): Interval[] {
  const q = (p: number) => {
    if (category === "WIN" || category === "SHUTOUT") return p <= 1 - Math.min(1, Math.max(0, mean)) ? 0 : 1;
    let k = 0, term = Math.exp(-mean), cdf = term;
    while (cdf + 1e-12 < p && k < 1000) { k += 1; term *= mean / k; cdf += term; }
    return k;
  };
  return H10_INTERVAL_LEVELS.map(level => ({ level, lower: q((1 - level) / 2), upper: q((1 + level) / 2) }));
}
type Cell = { n: number; covered: number; width: number; score: number };
const blank = (): Cell => ({ n: 0, covered: 0, width: 0, score: 0 });
function add(cell: Cell, band: Interval, actual: number) {
  const alpha = 1 - band.level, width = band.upper - band.lower;
  cell.n += 1; cell.width += width;
  if (actual >= band.lower && actual <= band.upper) cell.covered += 1;
  cell.score += width + (2 / alpha) * Math.max(0, band.lower - actual) + (2 / alpha) * Math.max(0, actual - band.upper);
}
const summary = (cell: Cell) => cell.n ? { n: cell.n, coverage: Number((cell.covered / cell.n).toFixed(4)), meanWidth: Number((cell.width / cell.n).toFixed(4)), intervalScore: Number((cell.score / cell.n).toFixed(4)) } : { n: 0 };

async function main() {
  const rows = realRows(packet!);
  const built = h10InputsFromRows(rows, { asOf: DATA_AT, seasonId: SEASON, logIngestUtcMinute: 450, gameHours: 3.5, rosterMaxAgeHours: 36 });
  const input = { logs: built.logs, goalieLogs: built.goalieLogs, schedule: built.schedule, seasonId: SEASON, maximumTrainingExamples: MAX_TRAINING };
  const evals: string[] = [];
  for (let t = instant(FIRST_EVAL); t <= instant(LAST_EVAL); t += H10_INTERVAL_POLICY.calibrationStepDays * DAY) evals.push(new Date(t).toISOString());
  // Replay each grid cutoff once, scored on everything received by the data read; calibration later filters by E.
  const grid = [...new Set([...evals, ...evals.flatMap(e => calibrationCutoffs(e))])].sort();
  const started = performance.now(), replay = new Map<string, IntervalObservation[]>(), refusals = new Map<string, Map<string, number>>();
  for (const cutoff of grid) {
    const tally = new Map<string, number>();
    replay.set(cutoff, replayAtCutoff({ ...input, cutoff, until: DATA_AT, onRefusal: (cls, _c, horizon, reason) => { const k = `${cls}:H${horizon}:${reason}`; tally.set(k, (tally.get(k) ?? 0) + 1); } }));
    refusals.set(cutoff, tally);
  }
  const replayMs = performance.now() - started;

  const cells = new Map<string, Cell>(), gaps = new Map<string, number>(), checks = { raw: { bands: 0, invalid: 0 }, calibrated: { bands: 0, invalid: 0 }, baseline: { bands: 0, invalid: 0 } };
  const calibrations: Array<Record<string, unknown>> = [];
  const bump = (key: string, band: Interval, actual: number) => { const c = cells.get(key) ?? blank(); add(c, band, actual); cells.set(key, c); };
  for (const e of evals) {
    const cutoffs = calibrationCutoffs(e), calibration = fitH10IntervalCalibration(cutoffs.flatMap(c => replay.get(c) ?? []), e, cutoffs);
    const fitted = Object.values(calibration.cells).filter(c => c.padding).length;
    calibrations.push({ cutoff: e, version: calibration.version, observations: calibration.observations, cellsFitted: fitted, cellsThin: Object.keys(calibration.cells).length - fitted, dependencyAvailableAt: calibration.dependencyAvailableAt });
    // Leakage guard: every calibration observation arrived by E.
    if (calibration.dependencyAvailableAt && instant(calibration.dependencyAvailableAt) > instant(e)) throw new Error(`calibration_leak:${e}`);
    for (const o of replay.get(e) ?? []) {
      const calibrated = calibrate({ state: "available", value: o.raw }, calibration, o.cls, o.category, o.horizon), base = baseline(o.category, o.mean);
      for (const [name, bands] of [["raw", o.raw], ["baseline", base]] as const) { checks[name].bands += 1; if (!intervalsValid(bands, o.category)) checks[name].invalid += 1; }
      const sparse = o.sparseHistory ? "sparse" : "established";
      if (calibrated.state !== "available") { const k = `${o.cls}:H${o.horizon}:${calibrated.reason}`; gaps.set(k, (gaps.get(k) ?? 0) + 1); }
      else { checks.calibrated.bands += 1; if (!intervalsValid(calibrated.value, o.category)) checks.calibrated.invalid += 1; }
      for (const level of H10_INTERVAL_LEVELS) {
        const pick = (bands: Interval[]) => bands.find(b => b.level === level)!;
        for (const [method, band] of [["raw", pick(o.raw)], ["baseline", pick(base)], ...(calibrated.state === "available" ? [["calibrated", pick(calibrated.value)]] : [])] as Array<[string, Interval]>) {
          bump(`byHorizon|${o.cls}|H${o.horizon}|${level}|${method}`, band, o.actual);
          bump(`byCategory|${o.cls}|${o.category}|${level}|${method}`, band, o.actual);
          bump(`byHistory|${o.cls}|${sparse}|${level}|${method}`, band, o.actual);
          bump(`overall|${o.cls}|${level}|${method}`, band, o.actual);
          // Like-for-like: the baseline and raw bands scored on exactly the observations that got a calibrated band.
          if (calibrated.state === "available") bump(`matched|${o.cls}|${level}|${method}`, band, o.actual);
        }
      }
    }
  }
  const table = (prefix: string) => {
    const result: Record<string, Record<string, unknown>> = {};
    for (const [key, cell] of [...cells].filter(([k]) => k.startsWith(`${prefix}|`)).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))) {
      const parts = key.split("|"), method = parts.pop()!, group = parts.slice(1).join("|");
      (result[group] ??= {})[method] = summary(cell);
    }
    return result;
  };
  // ---- Goalie band policy (TJ, 2026-11-24). The rule is GOALIE_BAND_POLICY.rule, fixed before this scoring. ----
  const replayAt = (cutoff: string) => { if (!replay.has(cutoff)) replay.set(cutoff, replayAtCutoff({ ...input, cutoff, until: DATA_AT })); return replay.get(cutoff)!; };
  const calibrations2 = new Map<string, IntervalCalibration>();
  const calibrationFor = (e: string) => { if (!calibrations2.has(e)) { const cs = calibrationCutoffs(e); calibrations2.set(e, fitH10IntervalCalibration(cs.flatMap(c => replayAt(c)), e, cs)); } return calibrations2.get(e)!; };
  type Scored = { o: IntervalObservation; candidate: Component<Interval[]> };
  const goalieAt = (cutoffs: readonly string[], receivedBy?: string) => cutoffs.flatMap(e => replayAt(e).filter(o => o.cls === "goalie" && (!receivedBy || instant(o.outcomeAvailableAt) <= instant(receivedBy)))
    .map(o => ({ o, candidate: calibrate({ state: "available", value: o.raw }, calibrationFor(e), "goalie", o.category, o.horizon) })));
  // Deterministic bootstrap (mulberry32) over distinct starts.
  const rng = (seed: number) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const select = (rows: Scored[]) => {
    const rule = GOALIE_BAND_POLICY.rule, cells: Record<string, Record<string, unknown>> = {}, chosen: string[] = [];
    for (const category of ["GOALS_ALLOWED", "SAVES", "SHOTS_AGAINST", "SHUTOUT", "WIN"]) for (let h = 1; h <= 7; h++) {
      const byStart = new Map<string, number[]>();
      for (const { o, candidate } of rows) {
        if (o.category !== category || o.horizon !== h || candidate.state !== "available") continue;
        const base = baselineBands(o.category, o.mean); if (base.state !== "available") continue;
        const d = intervalScore(candidate.value[1], o.actual) - intervalScore(base.value[1], o.actual), k = `${o.playerId}:${o.gameId}`;
        byStart.set(k, [...(byStart.get(k) ?? []), d]);
      }
      const diffs = [...byStart.values()].map(ds => ds.reduce((a, b) => a + b, 0) / ds.length), n = diffs.length, mean = n ? diffs.reduce((a, b) => a + b, 0) / n : NaN;
      let upper: number | null = null;
      if (n) {
        const next = rng(rule.bootstrap.seed + h * 101 + category.length), means: number[] = [];
        for (let b = 0; b < rule.bootstrap.resamples; b++) { let sum = 0; for (let i = 0; i < n; i++) sum += diffs[Math.floor(next() * n)]; means.push(sum / n); }
        means.sort((a, b) => a - b); upper = means[Math.ceil(0.95 * means.length) - 1];
      }
      const selected = n >= rule.minimumDistinctStarts && upper !== null && upper < 0;
      cells[`${category}:H${h}`] = { distinctStarts: n, meanDifference: Number(mean.toFixed(4)), upper95: upper === null ? null : Number(upper.toFixed(4)), selected };
      if (selected) chosen.push(`${category}:H${h}`);
    }
    return { cells, chosen };
  };
  const scorePolicy = (rows: Scored[], candidate90: readonly string[]) => {
    const table: Record<string, Record<string, unknown>> = {}, methods: Record<string, number> = {};
    for (let h = 1; h <= 10; h++) for (const level of H10_INTERVAL_LEVELS) {
      const at = rows.filter(r => r.o.horizon === h), cell = { policy: blank(), candidate: blank(), baseline: blank() };
      for (const { o, candidate } of at) {
        const base = baselineBands(o.category, o.mean), chosen = chooseBands("goalie", o.category, h, candidate, { state: "available", value: o.mean }, { candidate90 });
        if (chosen.intervals.state === "available") { add(cell.policy, chosen.intervals.value.find(b => b.level === level)!, o.actual); const m = chosen.methods[String(level) as "0.5" | "0.9"]!; methods[`${level}:${m}`] = (methods[`${level}:${m}`] ?? 0) + 1; }
        if (candidate.state === "available") add(cell.candidate, candidate.value.find(b => b.level === level)!, o.actual);
        if (base.state === "available") add(cell.baseline, base.value.find(b => b.level === level)!, o.actual);
      }
      if (at.length) table[`H${h}|${level}`] = { distinctStarts: new Set(at.map(r => `${r.o.playerId}:${r.o.gameId}`)).size, policy: summary(cell.policy), candidate: summary(cell.candidate), baseline: summary(cell.baseline) };
    }
    return { byHorizon: table, bandsByMethod: methods };
  };
  const rule = GOALIE_BAND_POLICY.rule;
  const selection = select(goalieAt(evals, rule.selectionWindow.outcomesReceivedBy));
  if (mode === "--select") { process.stdout.write(`${JSON.stringify(selection, null, 1)}\n`); return; }
  if (JSON.stringify(selection.chosen) !== JSON.stringify(GOALIE_BAND_POLICY.candidate90)) throw new Error(`policy_cells_differ_from_rule: ${JSON.stringify(selection.chosen)}`);
  const holdoutRows = goalieAt(rule.holdout.cutoffs);
  // Supporting check of the rule itself (not of TJ's policy structure): select on earlier outcomes, score later cutoffs.
  const early = evals.filter(e => instant(e) <= instant("2026-11-05T09:00:00.000Z")), late = evals.filter(e => instant(e) >= instant("2026-11-08T09:00:00.000Z"));
  const earlySelection = select(goalieAt(early, "2026-11-08T09:00:00.000Z"));
  const goaliePolicy = {
    version: GOALIE_BAND_POLICY.version, rule, selection, candidate90: GOALIE_BAND_POLICY.candidate90,
    holdout: { cutoffs: rule.holdout.cutoffs, scoredPredictions: holdoutRows.length, distinctStarts: new Set(holdoutRows.map(r => `${r.o.playerId}:${r.o.gameId}`)).size, ...scorePolicy(holdoutRows, GOALIE_BAND_POLICY.candidate90) },
    ruleCheck: { selectedOn: { cutoffs: early, outcomesReceivedBy: "2026-11-08T09:00:00.000Z" }, chosen: earlySelection.chosen, scoredOn: late, ...scorePolicy(goalieAt(late), earlySelection.chosen) },
    selectionWindowInSample: scorePolicy(goalieAt(evals), GOALIE_BAND_POLICY.candidate90),
  };
  // The nightly cost: one calibration at the production cutoff, replayed from scratch.
  const nightStarted = performance.now();
  const production = calibrationAt({ ...input, asOf: "2026-11-23T09:00:00.000Z" });
  const nightlyCalibrationMs = Math.round(performance.now() - nightStarted);
  const receipt = {
    version: "forge-h10-interval-validation-v1", dataReadAt: DATA_AT, season: SEASON, policy: H10_INTERVAL_POLICY, levels: H10_INTERVAL_LEVELS,
    design: {
      evaluationCutoffs: evals, replayGrid: { cutoffs: grid.length, first: grid[0], last: grid[grid.length - 1] },
      information: "model, rates and calibration at each E use only rows received by E; calibration dependencyAvailableAt <= E is asserted",
      conditional: "skaters scored on realized appearances, goalies on realized starts (if-playing / if-starting bands)",
      baseline: "Poisson (counts) or Bernoulli (WIN, SHUTOUT) equal-tail bands around the same kernel mean",
      intervalScore: "Winkler: width + (2/alpha) * shortfall below + (2/alpha) * excess above; lower is better",
      horizon: "k-th game of the player's team after the cutoff (team schedule, regular season)",
    },
    replayMs: Math.round(replayMs), nightlyCalibrationMs,
    productionCalibration: { cutoff: production.fittedAt, version: production.version, observations: production.observations,
      cellsFitted: Object.values(production.cells).filter(c => c.padding).length, cellsThin: Object.entries(production.cells).filter(([, c]) => !c.padding).map(([k, c]) => ({ cell: k, n: c.n })) },
    calibrations, orderAndNesting: checks,
    // Realized outcomes at the evaluation cutoffs with no raw band (too-thin kernel support): open gaps before calibration.
    rawRefusalsAtEvaluationCutoffs: (() => { const all = new Map<string, number>(); for (const e of evals) for (const [k, n] of refusals.get(e) ?? []) all.set(k, (all.get(k) ?? 0) + n);
      return Object.fromEntries([...all].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))); })(),
    gapsByClassHorizonReason: Object.fromEntries([...gaps].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))),
    goaliePolicy,
    overall: table("overall"), matched: table("matched"), byHorizon: table("byHorizon"), byCategory: table("byCategory"), byHistory: table("byHistory"),
  };
  writeFileSync(out!, `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ goaliePolicyHoldout: goaliePolicy.holdout, selected: goaliePolicy.candidate90, ruleCheckChosen: goaliePolicy.ruleCheck.chosen }, null, 1)}\n`);
  process.stdout.write(`${JSON.stringify({ replayMs: receipt.replayMs, nightlyCalibrationMs, checks, overall: receipt.overall, matched: receipt.matched, production: { observations: production.observations, fitted: receipt.productionCalibration.cellsFitted, thin: receipt.productionCalibration.cellsThin.length } }, null, 1)}\n`);
}
main().catch(error => { console.error(error); process.exit(1); });
