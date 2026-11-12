import { incompleteBeta, logGamma } from "./bands";

/**
 * Usual range (owner decision 33): a player-specific expectation range for a
 * window of this size, built from a pre-window baseline (decision 34) and
 * adjusted for sample size and baseline uncertainty.
 *
 * - Count-per-minute metrics: negative binomial posterior predictive
 *   (baseline rate ~ Gamma, window count ~ Poisson(rate x window minutes)).
 * - Success-per-trial metrics: beta-binomial posterior predictive.
 *
 * The range is the central 80% of the exact predictive distribution, and the
 * observed window total is classified by its exact tail probabilities. It is
 * descriptive only: not validated as predictive (decision 33), and whether a
 * stretch is "supported" is judged separately.
 */

export const USUAL_RANGE_TAIL = 0.1;

export type UsualRangeStatus = "hot" | "cold" | "neutral";

export type UsualRangeFamily =
  | "negative_binomial"
  | "negative_binomial_continuous"
  | "beta_binomial";

export type UsualRange = {
  basis: "pre_window_baseline_predictive";
  interval: "central_80";
  validated: false;
  family: UsualRangeFamily;
  /** Observed window value in the metric's units (rate per 60 or fraction). */
  observed: number;
  /** Central-80% predictive range in the metric's units. */
  lower: number;
  upper: number;
  /** Baseline in the metric's units (pre-window seasons only). */
  baseline: number;
  /** P(X >= observed) and P(X <= observed) under the predictive. */
  upperTail: number;
  lowerTail: number;
  status: UsualRangeStatus;
  /** Window totals: counts and minutes, or successes and trials. */
  count: number;
  exposure: number;
  gamesInWindow: number;
  gamesCovered: number;
  /** Baseline evidence: minutes (counts) or trials (percentages). */
  baselineEvidence: number;
  baselineSeasons: number[];
};

export type UsualRangeUnavailable = {
  basis: "pre_window_baseline_predictive";
  unavailable: true;
  reason:
    | "no_prior_season_baseline"
    | "no_baseline_dispersion"
    | "no_covered_games"
    | "no_window_exposure"
    | "invalid_baseline";
  gamesInWindow: number;
  gamesCovered: number;
};

export type UsualRangeResult = UsualRange | UsualRangeUnavailable;

function round(value: number, digits = 6): number {
  return Number(value.toFixed(digits));
}

/** P(X <= x) for X ~ NB(r, p); exact at integer x, smooth between. */
function negBinomialCdf(x: number, r: number, p: number): number {
  if (x < 0) return 0;
  return incompleteBeta(p, r, x + 1);
}

/** Smallest x (continuous) with CDF(x) >= q, by bisection. */
function negBinomialContinuousQuantile(q: number, r: number, p: number): number {
  if (negBinomialCdf(0, r, p) >= q) return 0;
  let lo = 0;
  let hi = Math.max(10, ((r * (1 - p)) / p) * 10 + 10);
  while (negBinomialCdf(hi, r, p) < q) hi *= 2;
  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2;
    if (negBinomialCdf(mid, r, p) >= q) hi = mid;
    else lo = mid;
  }
  return hi;
}

export function negativeBinomialUsualRange(args: {
  /** Pre-window baseline rate per 60 minutes. */
  baselinePer60: number;
  /** Pre-window baseline exposure in minutes (evidence behind the rate). */
  baselineMinutes: number;
  /** Window total count (integer for counts; real for ixG). */
  count: number;
  /** Window exposure in minutes. */
  minutes: number;
  continuous?: boolean;
  gamesInWindow: number;
  gamesCovered: number;
  baselineSeasons: number[];
}): UsualRangeResult {
  const base = {
    basis: "pre_window_baseline_predictive" as const,
    gamesInWindow: args.gamesInWindow,
    gamesCovered: args.gamesCovered
  };
  if (!(args.baselineMinutes > 0)) {
    return { ...base, unavailable: true, reason: "no_prior_season_baseline" };
  }
  if (!Number.isFinite(args.baselinePer60) || args.baselinePer60 < 0) {
    return { ...base, unavailable: true, reason: "invalid_baseline" };
  }
  if (args.gamesCovered <= 0) {
    return { ...base, unavailable: true, reason: "no_covered_games" };
  }
  if (!(args.minutes > 0)) {
    return { ...base, unavailable: true, reason: "no_window_exposure" };
  }

  const shape = (args.baselinePer60 / 60) * args.baselineMinutes;
  const p = args.baselineMinutes / (args.baselineMinutes + args.minutes);
  const c = args.count;
  const toRate = (value: number) => (value / args.minutes) * 60;

  let lowerCount: number;
  let upperCount: number;
  let lowerTail: number;
  let upperTail: number;
  let status: UsualRangeStatus;

  if (shape <= 0) {
    // A zero baseline rate predicts zero events: all mass at 0.
    lowerCount = 0;
    upperCount = 0;
    lowerTail = 1;
    upperTail = c > 0 ? 0 : 1;
    status = c > 0 ? "hot" : "neutral";
  } else if (args.continuous) {
    lowerCount = negBinomialContinuousQuantile(USUAL_RANGE_TAIL, shape, p);
    upperCount = negBinomialContinuousQuantile(1 - USUAL_RANGE_TAIL, shape, p);
    lowerTail = negBinomialCdf(c, shape, p);
    upperTail = 1 - lowerTail;
    status =
      upperTail < USUAL_RANGE_TAIL
        ? "hot"
        : lowerTail < USUAL_RANGE_TAIL
          ? "cold"
          : "neutral";
  } else {
    lowerCount = Math.ceil(
      negBinomialContinuousQuantile(USUAL_RANGE_TAIL, shape, p) - 1e-9
    );
    upperCount = Math.ceil(
      negBinomialContinuousQuantile(1 - USUAL_RANGE_TAIL, shape, p) - 1e-9
    );
    lowerTail = negBinomialCdf(c, shape, p);
    upperTail = c <= 0 ? 1 : 1 - negBinomialCdf(c - 1, shape, p);
    status =
      upperTail <= USUAL_RANGE_TAIL
        ? "hot"
        : lowerTail <= USUAL_RANGE_TAIL
          ? "cold"
          : "neutral";
  }

  return {
    ...base,
    validated: false,
    interval: "central_80",
    family: args.continuous ? "negative_binomial_continuous" : "negative_binomial",
    observed: round(toRate(c)),
    lower: round(toRate(lowerCount)),
    upper: round(toRate(upperCount)),
    baseline: round(args.baselinePer60),
    upperTail: round(upperTail),
    lowerTail: round(lowerTail),
    status,
    count: round(c),
    exposure: round(args.minutes, 3),
    baselineEvidence: round(args.baselineMinutes, 3),
    baselineSeasons: args.baselineSeasons
  };
}

function betaBinomialPmf(
  trials: number,
  alpha: number,
  beta: number
): number[] {
  const lnBeta = (a: number, b: number) =>
    logGamma(a) + logGamma(b) - logGamma(a + b);
  const lnChoose = (n: number, k: number) =>
    logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
  const base = lnBeta(alpha, beta);
  const pmf: number[] = [];
  for (let k = 0; k <= trials; k += 1) {
    pmf.push(
      Math.exp(lnChoose(trials, k) + lnBeta(k + alpha, trials - k + beta) - base)
    );
  }
  const total = pmf.reduce((sum, value) => sum + value, 0);
  return pmf.map((value) => value / total);
}

export function betaBinomialUsualRange(args: {
  /** Pre-window baseline success rate (0-1). */
  baseline: number;
  /** Pre-window baseline trials (evidence behind the rate). */
  baselineTrials: number;
  successes: number;
  trials: number;
  gamesInWindow: number;
  gamesCovered: number;
  baselineSeasons: number[];
}): UsualRangeResult {
  const base = {
    basis: "pre_window_baseline_predictive" as const,
    gamesInWindow: args.gamesInWindow,
    gamesCovered: args.gamesCovered
  };
  if (!(args.baselineTrials > 0)) {
    return { ...base, unavailable: true, reason: "no_prior_season_baseline" };
  }
  if (!Number.isFinite(args.baseline) || args.baseline < 0 || args.baseline > 1) {
    return { ...base, unavailable: true, reason: "invalid_baseline" };
  }
  if (args.gamesCovered <= 0) {
    return { ...base, unavailable: true, reason: "no_covered_games" };
  }
  const n = Math.round(args.trials);
  const s = Math.round(args.successes);
  if (n <= 0) {
    return { ...base, unavailable: true, reason: "no_window_exposure" };
  }

  const alpha = args.baseline * args.baselineTrials;
  const beta = (1 - args.baseline) * args.baselineTrials;

  let pmf: number[];
  if (alpha <= 0) {
    pmf = Array.from({ length: n + 1 }, (_, k) => (k === 0 ? 1 : 0));
  } else if (beta <= 0) {
    pmf = Array.from({ length: n + 1 }, (_, k) => (k === n ? 1 : 0));
  } else {
    pmf = betaBinomialPmf(n, alpha, beta);
  }

  const cdf: number[] = [];
  pmf.reduce((sum, value, idx) => {
    cdf[idx] = sum + value;
    return cdf[idx];
  }, 0);
  const quantile = (q: number) => {
    const idx = cdf.findIndex((value) => value >= q - 1e-12);
    return idx === -1 ? n : idx;
  };
  const lowerTail = Math.min(1, cdf[s] ?? 1);
  const upperTail = s <= 0 ? 1 : Math.min(1, 1 - (cdf[s - 1] ?? 0));
  const status: UsualRangeStatus =
    upperTail <= USUAL_RANGE_TAIL
      ? "hot"
      : lowerTail <= USUAL_RANGE_TAIL
        ? "cold"
        : "neutral";

  return {
    ...base,
    validated: false,
    interval: "central_80",
    family: "beta_binomial",
    observed: round(s / n),
    lower: round(quantile(USUAL_RANGE_TAIL) / n),
    upper: round(quantile(1 - USUAL_RANGE_TAIL) / n),
    baseline: round(args.baseline),
    upperTail: round(upperTail),
    lowerTail: round(lowerTail),
    status,
    count: s,
    exposure: n,
    baselineEvidence: round(args.baselineTrials, 3),
    baselineSeasons: args.baselineSeasons
  };
}

export type BandUsualRangeStatus = UsualRangeStatus | "unknown";

/**
 * Reader for Sandbox and APIs: the band's status comes only from its usual
 * range. Rows written before the usual range existed (or where it is
 * unavailable) read as unknown, never as neutral, hot or cold.
 */
export function readUsualRange(
  distribution: unknown
): { status: BandUsualRangeStatus; range: UsualRange | null; reason: string | null } {
  const candidate =
    distribution && typeof distribution === "object"
      ? (distribution as Record<string, unknown>).usualRange
      : null;
  if (!candidate || typeof candidate !== "object") {
    return { status: "unknown", range: null, reason: "not_computed" };
  }
  const record = candidate as Record<string, unknown>;
  if (record.unavailable === true) {
    return {
      status: "unknown",
      range: null,
      reason: typeof record.reason === "string" ? record.reason : "unavailable"
    };
  }
  const status = record.status;
  if (
    (status === "hot" || status === "cold" || status === "neutral") &&
    typeof record.lower === "number" &&
    typeof record.upper === "number" &&
    typeof record.observed === "number"
  ) {
    return { status, range: candidate as UsualRange, reason: null };
  }
  return { status: "unknown", range: null, reason: "malformed" };
}

export const USUAL_RANGE_REASON_LABELS: Record<string, string> = {
  not_computed: "not computed for this snapshot yet",
  no_prior_season_baseline: "no prior-season history",
  no_baseline_dispersion: "not available for this metric yet",
  no_covered_games: "no games with this stat in the window",
  no_window_exposure: "no opportunities in the window",
  invalid_baseline: "baseline failed a domain check",
  unavailable: "unavailable",
  malformed: "unavailable"
};
