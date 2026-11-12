/**
 * Time away from the lineup (decision 132.2). A returning skater's "if he plays" line comes from his last active games.
 * Time away may move that mean and widens its uncertainty, but both effects must be fitted and validated on held-out
 * returns (rules 11, 12); a fixed-rate decline is not allowed. Until a fit passes validation nothing is applied to the
 * line: rows carry the time-away evidence and say the decay is unvalidated and the widening unquantified.
 *
 * The fit harness below works on per-game skater rows exported once (bounded, owner-approved); it never reads the
 * database itself.
 */
export const TIME_AWAY_DECAY_VERSION = "forge-time-away-v1";

/** Days since the last game above which a row is labelled "away". A labelling threshold (presentation choice), not a
 * model coefficient: it changes no projected value. */
export const TIME_AWAY_LABEL_MIN_DAYS = 10;

export type TimeAwayEvidence = {
  last_game_date: string | null;
  days_away: number | null;
  status: "active" | "away" | "unknown";
};

export type TimeAwayBin = { minDays: number; maxDays: number | null; meanRatio: number | null; dispersion: number | null; returns: number };

export type TimeAwayValidation = {
  splitDate: string;
  heldOutReturns: number;
  /** Mean per-return Poisson deviance of the undecayed line minus that of the fitted decay (positive = fit better). */
  meanDevianceGain: number | null;
  /** Standard error of that mean, treating returns as independent (an approximation: one player can return twice). */
  standardError: number | null;
  /** Held-out Pearson dispersion of away returns divided by that of active (control) games, under the fitted means. */
  heldOutDispersionRatio: number | null;
  passed: boolean;
};

export type TimeAwayFit = {
  version: typeof TIME_AWAY_DECAY_VERSION;
  stat: string;
  controlMaxDays: number;
  control: TimeAwayBin;
  bins: TimeAwayBin[];
  validation: TimeAwayValidation | null;
};

/** The fit FORGE applies. Null until a fit passes held-out validation and is reviewed in. */
export const VALIDATED_TIME_AWAY_FIT: TimeAwayFit | null = null;

const DAY_MS = 86_400_000;
const isIsoDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`));

export function daysBetweenIso(later: string, earlier: string): number | null {
  if (!isIsoDate(later) || !isIsoDate(earlier)) return null;
  return Math.round((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / DAY_MS);
}

/** Evidence only: when he last played and how long ago. An unknown last game stays unknown, never "active". */
export function timeAwayEvidence(lastGameDate: string | null | undefined, asOfDate: string): TimeAwayEvidence {
  const days = lastGameDate ? daysBetweenIso(asOfDate, lastGameDate.slice(0, 10)) : null;
  if (days === null || days < 0) return { last_game_date: lastGameDate ?? null, days_away: null, status: "unknown" };
  return { last_game_date: lastGameDate!.slice(0, 10), days_away: days, status: days >= TIME_AWAY_LABEL_MIN_DAYS ? "away" : "active" };
}

const binFor = (bins: readonly TimeAwayBin[], days: number) =>
  bins.find(bin => days >= bin.minDays && (bin.maxDays === null || days <= bin.maxDays)) ?? null;

/** The serialized time-away block for a row: evidence plus the decay's status. With no validated fit the line is
 * unchanged (applied false) and an away player's widening is "unquantified", never a guessed number. */
export function timeAwayDisclosure(evidence: TimeAwayEvidence, fit: TimeAwayFit | null = VALIDATED_TIME_AWAY_FIT) {
  const bin = fit?.validation?.passed && evidence.days_away !== null && evidence.days_away > fit.controlMaxDays
    ? binFor(fit.bins, evidence.days_away) : null;
  return {
    version: TIME_AWAY_DECAY_VERSION,
    ...evidence,
    line_basis: "last_active_games" as const,
    decay: bin && bin.meanRatio !== null
      ? { status: "validated" as const, applied: true, mean_ratio: bin.meanRatio,
        dispersion_ratio: bin.dispersion !== null && fit!.control.dispersion ? bin.dispersion / fit!.control.dispersion : null }
      : { status: "unvalidated" as const, applied: false, mean_ratio: null, dispersion_ratio: null,
        uncertainty: evidence.status === "away" ? "widened_unquantified" as const
          : evidence.status === "unknown" ? "unknown" as const : "none" as const },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Fit harness (offline). Inputs are one player's games in date order; outputs are return observations.

export type SkaterGameRow = { playerId: number; gameDate: string; value: number };

export type ReturnObservation = {
  playerId: number;
  returnDate: string;
  daysAway: number;
  /** Undecayed if-plays expectation: pre-gap per-game mean times the post-gap games observed. */
  expected: number;
  observed: number;
  postGames: number;
};

/**
 * One observation per game gap: the mean of `value` over the `preGames` games before the gap, times the number of games
 * observed in the `postGames` games from the gap on, against their observed total. Gaps of any length are kept (short
 * gaps are the control group). A player needs `preGames` earlier games for an observation.
 */
export function buildReturnObservations(rows: readonly SkaterGameRow[],
  opts: { preGames?: number; postGames?: number; controlMaxDays?: number } = {}): ReturnObservation[] {
  const pre = opts.preGames ?? 10, post = opts.postGames ?? 5, shortGap = opts.controlMaxDays ?? 5;
  const byPlayer = new Map<number, SkaterGameRow[]>();
  for (const row of rows) {
    if (!Number.isSafeInteger(row.playerId) || !isIsoDate(row.gameDate) || !Number.isFinite(row.value) || row.value < 0) continue;
    byPlayer.set(row.playerId, [...(byPlayer.get(row.playerId) ?? []), row]);
  }
  const out: ReturnObservation[] = [];
  for (const [playerId, games] of [...byPlayer].sort((a, b) => a[0] - b[0])) {
    games.sort((a, b) => a.gameDate.localeCompare(b.gameDate));
    const gap = (i: number) => daysBetweenIso(games[i].gameDate, games[i - 1].gameDate) ?? 0;
    // Every long gap starts an observation; between long gaps, short-gap control windows are taken every `post` games.
    // Outcome windows never overlap, so one game belongs to at most one observation.
    for (let i = pre; i < games.length;) {
      let start = i;
      for (let j = i; j < Math.min(i + post, games.length); j++) if (gap(j) > shortGap) { start = j; break; }
      const before = games.slice(start - pre, start), after = games.slice(start, start + post);
      const days = gap(start);
      if (days > 0) {
        const mean = before.reduce((s, g) => s + g.value, 0) / pre;
        out.push({ playerId, returnDate: after[0].gameDate, daysAway: days, expected: mean * after.length,
          observed: after.reduce((s, g) => s + g.value, 0), postGames: after.length });
      }
      i = start + post;
    }
  }
  return out;
}

/** Poisson deviance of one observation against mean mu (mu > 0). */
export function poissonDeviance(y: number, mu: number): number {
  return 2 * ((y > 0 ? y * Math.log(y / mu) : 0) - (y - mu));
}

function fitBin(obs: readonly ReturnObservation[], minDays: number, maxDays: number | null): TimeAwayBin {
  const inBin = obs.filter(o => o.expected > 0 && o.daysAway >= minDays && (maxDays === null || o.daysAway <= maxDays));
  const sumExp = inBin.reduce((s, o) => s + o.expected, 0), sumObs = inBin.reduce((s, o) => s + o.observed, 0);
  // Poisson MLE of a multiplicative factor on the undecayed mean.
  const ratio = sumExp > 0 ? sumObs / sumExp : null;
  const dispersion = ratio !== null && ratio > 0 && inBin.length > 1
    ? inBin.reduce((s, o) => s + (o.observed - ratio * o.expected) ** 2 / (ratio * o.expected), 0) / (inBin.length - 1) : null;
  return { minDays, maxDays, meanRatio: ratio, dispersion, returns: inBin.length };
}

export const DEFAULT_TIME_AWAY_BIN_EDGES: ReadonlyArray<readonly [number, number | null]> = [[10, 20], [21, 45], [46, 120], [121, null]];

/** Fit per-bin mean ratios and dispersion against a control group of short gaps. Bin edges are a binning choice. */
export function fitTimeAwayDecay(obs: readonly ReturnObservation[], opts: { stat: string; controlMaxDays?: number;
  binEdges?: ReadonlyArray<readonly [number, number | null]> }): TimeAwayFit {
  const controlMaxDays = opts.controlMaxDays ?? 5;
  return { version: TIME_AWAY_DECAY_VERSION, stat: opts.stat, controlMaxDays,
    control: fitBin(obs, 1, controlMaxDays),
    bins: (opts.binEdges ?? DEFAULT_TIME_AWAY_BIN_EDGES).map(([min, max]) => fitBin(obs, min, max)), validation: null };
}

/**
 * Time-ordered held-out validation: fit on returns before `splitDate`, score returns on and after it. The fit passes
 * only when the held-out mean deviance gain over the undecayed line is more than two standard errors above zero with
 * at least `minHeldOut` away returns. A fit that does not pass is never applied.
 */
export function fitAndValidateTimeAwayDecay(obs: readonly ReturnObservation[], opts: { stat: string; splitDate: string;
  controlMaxDays?: number; binEdges?: ReadonlyArray<readonly [number, number | null]>; minHeldOut?: number }): TimeAwayFit {
  const train = obs.filter(o => o.returnDate < opts.splitDate), test = obs.filter(o => o.returnDate >= opts.splitDate);
  const fit = fitTimeAwayDecay(train, opts);
  const gains: number[] = [];
  const pearson = { away: 0, awayN: 0, control: 0, controlN: 0 };
  for (const o of test) {
    if (!(o.expected > 0)) continue;
    if (o.daysAway <= fit.controlMaxDays) {
      const mu = o.expected * (fit.control.meanRatio ?? 1);
      pearson.control += (o.observed - mu) ** 2 / mu; pearson.controlN++;
      continue;
    }
    const bin = binFor(fit.bins, o.daysAway);
    if (!bin || bin.meanRatio === null || bin.meanRatio <= 0) continue;
    const mu = o.expected * bin.meanRatio;
    gains.push(poissonDeviance(o.observed, o.expected) - poissonDeviance(o.observed, mu));
    pearson.away += (o.observed - mu) ** 2 / mu; pearson.awayN++;
  }
  const n = gains.length, mean = n ? gains.reduce((s, g) => s + g, 0) / n : null;
  const se = n > 1 && mean !== null ? Math.sqrt(gains.reduce((s, g) => s + (g - mean) ** 2, 0) / (n - 1) / n) : null;
  const ratio = pearson.awayN && pearson.controlN && pearson.control > 0
    ? (pearson.away / pearson.awayN) / (pearson.control / pearson.controlN) : null;
  return { ...fit, validation: { splitDate: opts.splitDate, heldOutReturns: n, meanDevianceGain: mean, standardError: se,
    heldOutDispersionRatio: ratio, passed: mean !== null && se !== null && n >= (opts.minHeldOut ?? 100) && mean - 2 * se > 0 } };
}
