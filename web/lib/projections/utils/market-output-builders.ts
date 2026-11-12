import type { DispersionStat } from "../dispersion";
import type { MarketTypeSummary } from "../queries/market-queries";
import { probabilityOverLine } from "../uncertainty";
import {
  americanToDecimal,
  americanToImpliedProbability,
  devigTwoWayAmerican,
  devigYesOnly,
  impliedProbabilityToAmerican,
  median,
  type DevigMethod,
  type YesOnlyOverroundSource,
} from "./devig";

export const ANALYTICS_MODEL_NAME = "forge";
export const ANALYTICS_MODEL_VERSION = "market-context-v1";

// Goal-unit mean-versus-line thresholds. No flag is gated on them any more:
// every flag compares probabilities (DEFAULT_PROBABILITY_EDGE_THRESHOLD).
export const PLAYER_MARKET_EDGE_THRESHOLDS: Record<string, number> = {
  player_shots_on_goal: 0.5,
  player_goals: 0.2,
  player_assists: 0.25,
  player_points: 0.35,
  player_power_play_points: 0.15,
  player_blocked_shots: 0.4,
  player_total_saves: 1.5,
};

export const GAME_MARKET_EDGE_THRESHOLDS = {
  totals: 0.4,
  spreads: 0.5,
} as const;

export function getProjectionValueForPropMarket(args: {
  marketType: string;
  projection: {
    shots: number;
    goals: number;
    assists: number;
    powerPlayPoints: number;
    blockedShots: number;
    saves: number | null;
  };
}): number | null {
  switch (args.marketType) {
    case "player_shots_on_goal":
      return args.projection.shots;
    case "player_goals":
    case "player_goal_scorer_anytime":
      return args.projection.goals;
    case "player_assists":
      return args.projection.assists;
    case "player_points":
      return Number(
        (args.projection.goals + args.projection.assists).toFixed(3),
      );
    case "player_power_play_points":
      return args.projection.powerPlayPoints;
    case "player_blocked_shots":
      return args.projection.blockedShots;
    case "player_total_saves":
      return args.projection.saves;
    default:
      return null;
  }
}

/**
 * The line quoted by the most books (ties go to the lower line), the same rule
 * compareModelWithMarket uses. Lines are never averaged across books (decision
 * 30). Hand-built summaries without per-book quotes fall back to an outcome's
 * common line, which is null when books disagree.
 */
export function getConsensusLineValue(
  summary: MarketTypeSummary | undefined,
): number | null {
  if (!summary) return null;
  if (summary.quotes) {
    const booksByLine = new Map<number, Set<string>>();
    for (const quote of summary.quotes) {
      if (quote.line_value == null || !Number.isFinite(quote.line_value)) continue;
      const books = booksByLine.get(quote.line_value) ?? new Set<string>();
      books.add(quote.sportsbook_key);
      booksByLine.set(quote.line_value, books);
    }
    const modal = Array.from(booksByLine.entries()).sort(
      (a, b) => b[1].size - a[1].size || a[0] - b[0],
    )[0];
    return modal?.[0] ?? null;
  }
  const candidate = summary.outcomes.find(
    (outcome) => outcome.averageLineValue != null,
  );
  return candidate?.averageLineValue ?? null;
}

/**
 * |edge| / threshold, unclipped: how many flag thresholds the edge spans. Not a
 * probability or a confidence. It replaces the retired confidence_0_to_100 value
 * (min(100, 50 * |edge| / threshold)), which saturated at 100 even on a
 * wrong-way flag and read as a 0-100 confidence (W3-4 N2).
 */
function edgeToThresholdRatio(edgeValue: number, threshold: number): number | null {
  if (!Number.isFinite(edgeValue) || !Number.isFinite(threshold) || threshold <= 0) {
    return null;
  }
  return Number((Math.abs(edgeValue) / threshold).toFixed(4));
}

export function buildModelMarketFlagRow(args: {
  asOfDate: string;
  entityType: "game" | "player" | "team";
  entityId: number;
  gameId: number;
  marketType: string;
  flagType: string;
  edgeValue: number;
  reasons: Array<Record<string, unknown>>;
  provider: string | null;
  metadata?: Record<string, unknown>;
}): Record<string, unknown> {
  const now = new Date().toISOString();

  return {
    snapshot_date: args.asOfDate,
    entity_type: args.entityType,
    entity_id: args.entityId,
    game_id: args.gameId,
    model_name: ANALYTICS_MODEL_NAME,
    model_version: ANALYTICS_MODEL_VERSION,
    market_type: args.marketType,
    sportsbook_key: null,
    flag_type: args.flagType,
    edge_value: Number(args.edgeValue.toFixed(4)),
    // Retired (W3-4 N2): the old value was a clipped edge/threshold ratio, not a
    // confidence. Rows carry reasons[].edge_to_threshold_ratio instead.
    confidence_0_to_100: null,
    reasons: args.reasons,
    provenance: {
      provider: args.provider,
      input_family: "forge-market-comparison",
    },
    metadata: args.metadata ?? {},
    computed_at: now,
    updated_at: now,
  };
}

// ---------------------------------------------------------------------------
// Probability-space market comparison (tasks 6.1 / 6.2).
//
// The mean-versus-line helpers above stay unchanged for current callers. The
// helpers below compare the model's P(over line) with the de-vigged market
// probability and size the edge at the best offered price.
// ---------------------------------------------------------------------------

/** Default minimum |model - market| probability gap that raises a flag. */
export const DEFAULT_PROBABILITY_EDGE_THRESHOLD = 0.05;

/**
 * Injection point for the model's count distribution: returns P(X > line) for
 * the stat behind `marketType` given the projected mean, or null if unknown.
 * Defaults to Poisson; negative-binomial (or any other) distributions plug in
 * here without changing the comparison code.
 */
export type OverProbabilityFn = (args: {
  marketType: string;
  mean: number;
  line: number;
}) => number | null;

/** Poisson P(X > line) = 1 - CDF(floor(line)). */
export function poissonOverProbability(mean: number, line: number): number | null {
  if (!Number.isFinite(mean) || mean < 0 || !Number.isFinite(line)) return null;
  if (line < 0) return 1;
  const k = Math.floor(line);
  let term = Math.exp(-mean);
  let cdf = term;
  for (let i = 1; i <= k; i += 1) {
    term *= mean / i;
    cdf += term;
  }
  return Math.min(1, Math.max(0, 1 - cdf));
}

export const defaultOverProbability: OverProbabilityFn = ({ mean, line }) =>
  poissonOverProbability(mean, line);

// Prop markets whose stat has a fitted FORGE dispersion (dispersion.ts); points and
// power-play points stay Poisson.
const PROP_MARKET_STATS: Record<string, DispersionStat> = {
  player_shots_on_goal: "sog",
  player_goals: "g",
  player_goal_scorer_anytime: "g",
  player_assists: "a",
  player_blocked_shots: "blk",
  player_total_saves: "sv",
};

/** P(X > line) from FORGE's fitted count distribution for a player of this position. */
export function forgePropOverProbability(position: string | null | undefined): OverProbabilityFn {
  return ({ marketType, mean, line }) => {
    const stat = PROP_MARKET_STATS[marketType];
    return stat ? probabilityOverLine(stat, position, mean, line) : poissonOverProbability(mean, line);
  };
}

export type ModelLineProbabilities = {
  over: number;
  under: number;
  push: number;
  /** P(over | no push): comparable with de-vigged two-way prices, which refund pushes. */
  overGivenNoPush: number;
};

/**
 * Over / under / push probabilities at a line from an injected distribution.
 * Integer lines can push; push = P(X > line - 0.5) - P(X > line).
 */
export function getModelLineProbabilities(args: {
  marketType: string;
  mean: number;
  line: number;
  overProbability?: OverProbabilityFn;
}): ModelLineProbabilities | null {
  const fn = args.overProbability ?? defaultOverProbability;
  const over = fn({ marketType: args.marketType, mean: args.mean, line: args.line });
  if (over == null || !Number.isFinite(over)) return null;
  let push = 0;
  if (Number.isInteger(args.line)) {
    const atLeast = fn({
      marketType: args.marketType,
      mean: args.mean,
      line: args.line - 0.5,
    });
    if (atLeast == null || !Number.isFinite(atLeast)) return null;
    push = Math.max(0, atLeast - over);
  }
  const under = Math.max(0, 1 - over - push);
  const decided = over + under;
  return {
    over,
    under,
    push,
    overGivenNoPush: decided > 0 ? over / decided : 0,
  };
}

/** One sportsbook quote; the shape matches rows of (prop_)market_prices_daily. */
export type MarketPriceQuote = {
  sportsbook_key: string;
  outcome_key: string;
  line_value: number | null;
  price_american: number | null;
};

const OVER_KEYS = new Set(["over"]);
const UNDER_KEYS = new Set(["under"]);
const YES_KEYS = new Set(["yes"]);

function sideOf(outcomeKey: string): "over" | "under" | "yes" | null {
  const key = outcomeKey.trim().toLowerCase();
  if (OVER_KEYS.has(key)) return "over";
  if (UNDER_KEYS.has(key)) return "under";
  if (YES_KEYS.has(key)) return "yes";
  return null;
}

/** "Yes"-only markets (anytime goal scorer) without a line resolve at 0.5. */
const YES_ONLY_DEFAULT_LINE = 0.5;

/**
 * Per-book quotes for a MarketTypeSummary. Summaries from market-queries carry
 * one quote per book, outcome and line, so books at 2.5 and 3.5 stay separate
 * and are never averaged into 3.0 (decision 30, BC W1-6 D18).
 *
 * Hand-built summaries without per-book quotes fall back to one synthetic quote
 * per outcome, priced from the averaged implied probability; such an outcome
 * has a line only when every book quoted the same one.
 */
export function quotesFromMarketSummary(
  summary: MarketTypeSummary | undefined,
): MarketPriceQuote[] {
  if (!summary) return [];
  if (summary.quotes) return summary.quotes.map((quote) => ({ ...quote }));
  const quotes: MarketPriceQuote[] = [];
  for (const outcome of summary.outcomes) {
    const implied =
      outcome.averageImpliedProbability != null &&
      outcome.averageImpliedProbability > 0 &&
      outcome.averageImpliedProbability < 1
        ? outcome.averageImpliedProbability
        : americanToImpliedProbability(outcome.averagePriceAmerican);
    const price = implied == null ? null : impliedProbabilityToAmerican(implied);
    if (price == null) continue;
    quotes.push({
      sportsbook_key: "summary-average",
      outcome_key: outcome.outcomeKey,
      line_value: outcome.averageLineValue,
      price_american: price,
    });
  }
  return quotes;
}

/**
 * How the market probability was obtained. Two-way books are de-vigged on their
 * own over/under pair; Yes-only books have no opposing price, so their value is
 * an estimate under an assumed overround (see devigYesOnly), never a fair price.
 */
export type MarketProbabilityBasis =
  | "two-way-devig"
  | "yes-only-assumed-overround"
  | "mixed-two-way-and-yes-only";

/** The assumption behind the Yes-only books in a comparison, and its consequence. */
export type YesOnlyAssumption = {
  overround: number;
  overroundSource: YesOnlyOverroundSource;
  methods: Array<"proportional">;
  /** Median raw implied P(yes): the overround-0 bound, an upper bound on the estimate. */
  impliedProbabilityMedian: number;
};

export type MarketProbabilityComparison = {
  marketType: string;
  line: number;
  expectedValue: number;
  model: ModelLineProbabilities;
  /**
   * Median of per-book P(over | no push) at the consensus line: de-vigged for
   * two-way books, assumption-based for Yes-only books (see marketProbabilityBasis).
   */
  marketProbabilityOver: number;
  marketProbabilityBasis: MarketProbabilityBasis;
  /** Set when any Yes-only book contributed; null for pure two-way markets. */
  yesOnlyAssumption: YesOnlyAssumption | null;
  /**
   * Pure Yes-only markets only: model.overGivenNoPush - impliedProbabilityMedian,
   * the edge with no overround assumed. A model_over edge that survives here
   * does not depend on the assumption.
   */
  probabilityEdgeAtZeroOverround: number | null;
  /** model.overGivenNoPush - marketProbabilityOver; positive favours the over. */
  probabilityEdge: number;
  threshold: number;
  flagType: "model_over" | "model_under" | null;
  /**
   * "model_under" when the edge cleared the threshold but no book at the line
   * offers an under: it cannot be bet, and a Yes-only estimate has no
   * assumption-free lower bound, so the flag is withheld (TJ, 2026-10-22).
   */
  suppressedFlagType: "model_under" | null;
  /** Best (highest-payout) price per side across books at the consensus line. */
  bestOverPriceAmerican: number | null;
  bestUnderPriceAmerican: number | null;
  /** Expected profit per unit staked at the best price, from the model's unconditional probabilities. */
  expectedValueOver: number | null;
  expectedValueUnder: number | null;
  bookCount: number;
  twoWayBookCount: number;
  yesOnlyBookCount: number;
  devigMethod: DevigMethod;
  combine: "median-devig-probability/best-price";
};

function bestPrice(prices: number[]): number | null {
  let best: number | null = null;
  let bestDecimal = -Infinity;
  for (const price of prices) {
    const decimal = americanToDecimal(price);
    if (decimal != null && decimal > bestDecimal) {
      bestDecimal = decimal;
      best = price;
    }
  }
  return best;
}

function expectedValueWithPush(
  win: number,
  lose: number,
  price: number | null,
): number | null {
  const decimal = americanToDecimal(price);
  if (decimal == null) return null;
  return win * (decimal - 1) - lose;
}

/**
 * Compare the model with the market in probability space.
 *
 * Combining books: quotes are grouped by line; the consensus line is the one
 * quoted by the most books (ties go to the lower line). Each two-way book is
 * de-vigged on its own over/under pair (Shin by default); a book with only
 * "yes"/"over" gets devigYesOnly's assumption-based proportional estimate (overround from
 * `yesOnlyOverround`, else FORGE_YES_ONLY_OVERROUND, else the default). The
 * market probability is the median of the per-book values, and the expected
 * value uses the best price on each side. Lines are never averaged across books.
 * No "model_under" flag fires when no book at the line offers an under.
 */
export function compareModelWithMarket(args: {
  marketType: string;
  expectedValue: number;
  quotes: MarketPriceQuote[];
  overProbability?: OverProbabilityFn;
  devigMethod?: DevigMethod;
  threshold?: number;
  yesOnlyOverround?: number;
  /** Game markets: a book without both sides at the line is skipped, never yes-only estimated. */
  twoWayOnly?: boolean;
}): MarketProbabilityComparison | null {
  if (!Number.isFinite(args.expectedValue)) return null;
  const method = args.devigMethod ?? "shin";
  const threshold = args.threshold ?? DEFAULT_PROBABILITY_EDGE_THRESHOLD;

  type BookSides = { over?: number; under?: number; yes?: number };
  const byLine = new Map<number, Map<string, BookSides>>();
  for (const quote of args.quotes) {
    const side = sideOf(quote.outcome_key);
    if (!side || americanToDecimal(quote.price_american) == null) continue;
    const line =
      quote.line_value ?? (side === "yes" ? YES_ONLY_DEFAULT_LINE : null);
    if (line == null || !Number.isFinite(line)) continue;
    if (!byLine.has(line)) byLine.set(line, new Map());
    const books = byLine.get(line)!;
    const sides = books.get(quote.sportsbook_key) ?? {};
    sides[side] = quote.price_american as number;
    books.set(quote.sportsbook_key, sides);
  }
  if (byLine.size === 0) return null;

  const [line, books] = Array.from(byLine.entries()).sort(
    (a, b) => b[1].size - a[1].size || a[0] - b[0],
  )[0];

  const fairOver: number[] = [];
  const overPrices: number[] = [];
  const underPrices: number[] = [];
  const yesOnlyImplied: number[] = [];
  const yesOnlyMethods = new Set<"proportional">();
  let yesOnlyOverround: { overround: number; source: YesOnlyOverroundSource } | null = null;
  let twoWayBookCount = 0;
  let yesOnlyBookCount = 0;
  for (const sides of books.values()) {
    const overPrice = sides.over ?? sides.yes;
    if (overPrice != null) overPrices.push(overPrice);
    if (sides.under != null) underPrices.push(sides.under);
    if (overPrice != null && sides.under != null) {
      const pair = devigTwoWayAmerican(overPrice, sides.under, method);
      if (pair) {
        fairOver.push(pair.fairA);
        twoWayBookCount += 1;
      }
    } else if (overPrice != null && !args.twoWayOnly) {
      const yes = devigYesOnly(overPrice, { overround: args.yesOnlyOverround });
      if (yes) {
        fairOver.push(yes.probability);
        yesOnlyImplied.push(yes.implied);
        yesOnlyMethods.add(yes.method);
        yesOnlyOverround = { overround: yes.overround, source: yes.overroundSource };
        yesOnlyBookCount += 1;
      }
    }
  }
  const marketProbabilityOver = median(fairOver);
  if (marketProbabilityOver == null) return null;

  const model = getModelLineProbabilities({
    marketType: args.marketType,
    mean: args.expectedValue,
    line,
    overProbability: args.overProbability,
  });
  if (!model) return null;

  const probabilityEdge = model.overGivenNoPush - marketProbabilityOver;
  const bestOverPriceAmerican = bestPrice(overPrices);
  const bestUnderPriceAmerican = bestPrice(underPrices);
  const impliedProbabilityMedian = median(yesOnlyImplied);
  const yesOnlyAssumption: YesOnlyAssumption | null =
    yesOnlyOverround && impliedProbabilityMedian != null
      ? {
          overround: yesOnlyOverround.overround,
          overroundSource: yesOnlyOverround.source,
          methods: Array.from(yesOnlyMethods).sort(),
          impliedProbabilityMedian,
        }
      : null;
  const rawFlag =
    probabilityEdge >= threshold
      ? "model_over"
      : probabilityEdge <= -threshold
        ? "model_under"
        : null;
  const suppressUnder = rawFlag === "model_under" && underPrices.length === 0;
  return {
    marketType: args.marketType,
    line,
    expectedValue: args.expectedValue,
    model,
    marketProbabilityOver,
    marketProbabilityBasis:
      yesOnlyBookCount === 0
        ? "two-way-devig"
        : twoWayBookCount === 0
          ? "yes-only-assumed-overround"
          : "mixed-two-way-and-yes-only",
    yesOnlyAssumption,
    probabilityEdgeAtZeroOverround:
      twoWayBookCount === 0 && yesOnlyAssumption
        ? model.overGivenNoPush - yesOnlyAssumption.impliedProbabilityMedian
        : null,
    probabilityEdge,
    threshold,
    flagType: suppressUnder ? null : rawFlag,
    suppressedFlagType: suppressUnder ? "model_under" : null,
    bestOverPriceAmerican,
    bestUnderPriceAmerican,
    expectedValueOver: expectedValueWithPush(
      model.over,
      model.under,
      bestOverPriceAmerican,
    ),
    expectedValueUnder: expectedValueWithPush(
      model.under,
      model.over,
      bestUnderPriceAmerican,
    ),
    bookCount: books.size,
    twoWayBookCount,
    yesOnlyBookCount,
    devigMethod: method,
    combine: "median-devig-probability/best-price",
  };
}

function round(value: number | null, digits = 4): number | null {
  return value == null || !Number.isFinite(value)
    ? null
    : Number(value.toFixed(digits));
}

/**
 * Flag row for a probability-space comparison, or null when no flag fires.
 * Same columns as buildModelMarketFlagRow; edge_value is the signed
 * probability edge and metadata.comparison_basis is "probability". The
 * legacy reason fields (expected_value, line_value, sportsbook_count) are kept.
 */
export function buildModelMarketProbabilityFlagRow(args: {
  asOfDate: string;
  entityType: "game" | "player" | "team";
  entityId: number;
  gameId: number;
  comparison: MarketProbabilityComparison;
  provider: string | null;
  metadata?: Record<string, unknown>;
  /** Flag names for markets whose "over" side is not literally an over (spreads). */
  flagTypeLabels?: { over: string; under: string };
  /** Extra reason fields, merged after the standard ones. */
  extraReasons?: Record<string, unknown>;
}): Record<string, unknown> | null {
  const c = args.comparison;
  if (!c.flagType) return null;
  const flagType = args.flagTypeLabels
    ? c.flagType === "model_over"
      ? args.flagTypeLabels.over
      : args.flagTypeLabels.under
    : c.flagType;
  return buildModelMarketFlagRow({
    asOfDate: args.asOfDate,
    entityType: args.entityType,
    entityId: args.entityId,
    gameId: args.gameId,
    marketType: c.marketType,
    flagType,
    edgeValue: c.probabilityEdge,
    reasons: [
      {
        expected_value: c.expectedValue,
        line_value: c.line,
        sportsbook_count: c.bookCount,
        mean_minus_line: round(c.expectedValue - c.line),
        model_probability_over: round(c.model.over),
        model_probability_under: round(c.model.under),
        model_probability_push: round(c.model.push),
        model_probability_over_given_no_push: round(c.model.overGivenNoPush),
        market_probability_over: round(c.marketProbabilityOver),
        probability_edge: round(c.probabilityEdge),
        best_over_price_american: round(c.bestOverPriceAmerican, 2),
        best_under_price_american: round(c.bestUnderPriceAmerican, 2),
        expected_value_over: round(c.expectedValueOver),
        expected_value_under: round(c.expectedValueUnder),
        two_way_book_count: c.twoWayBookCount,
        yes_only_book_count: c.yesOnlyBookCount,
        market_probability_basis: c.marketProbabilityBasis,
        probability_edge_at_zero_overround: round(c.probabilityEdgeAtZeroOverround),
        probability_edge_threshold: c.threshold,
        edge_to_threshold_ratio: edgeToThresholdRatio(c.probabilityEdge, c.threshold),
        ...(args.extraReasons ?? {}),
      },
    ],
    provider: args.provider,
    metadata: {
      ...(args.metadata ?? {}),
      comparison_basis: "probability",
      // devig_method applies to two-way books only; Yes-only books are described by yes_only_assumption.
      devig_method: c.twoWayBookCount > 0 ? c.devigMethod : null,
      market_probability_basis: c.marketProbabilityBasis,
      yes_only_assumption: c.yesOnlyAssumption
        ? {
            assumed_overround: c.yesOnlyAssumption.overround,
            overround_source: c.yesOnlyAssumption.overroundSource,
            methods: c.yesOnlyAssumption.methods,
            implied_probability_median: round(c.yesOnlyAssumption.impliedProbabilityMedian),
          }
        : null,
      book_combine: c.combine,
    },
  });
}

// ---------------------------------------------------------------------------
// Game markets (totals and spreads) in probability space (decision 30).
// ---------------------------------------------------------------------------

/** Independent Poisson pmf over 0..n, with n large enough that the tail is negligible. */
function poissonPmf(mean: number): number[] {
  const n = Math.ceil(mean + 12 * Math.sqrt(mean) + 20);
  const pmf = [Math.exp(-mean)];
  for (let k = 1; k <= n; k += 1) pmf.push((pmf[k - 1] * mean) / k);
  return pmf;
}

/**
 * Overtime rule for spreads: a game tied after regulation is settled by exactly
 * one goal (overtime or shootout), so the final margin is never 0. A tie never
 * covers -1.5 and always covers +1.5; lines where the overtime winner matters
 * (e.g. -0.5, -1) need an overtime home-win probability, else the comparison is
 * unknown.
 */
export const SPREAD_OVERTIME_RULE = "regulation-tie-settled-by-one-goal";

/**
 * Final home margin distribution M = H - A from independent Poisson team-goal
 * means (the model's own team-goal distribution; empty-net and overtime goals
 * are already in the means and nothing is added). Returns P(M > x) as an
 * OverProbabilityFn: the home side covers handicap L exactly when M > -L, so a
 * spread maps to an over at line -L.
 */
export function spreadMarginOverProbability(args: {
  homeMean: number;
  awayMean: number;
  overtimeHomeWinProbability?: number | null;
}): OverProbabilityFn {
  const { homeMean, awayMean } = args;
  if (!Number.isFinite(homeMean) || !Number.isFinite(awayMean) || homeMean < 0 || awayMean < 0) {
    return () => null;
  }
  const home = poissonPmf(homeMean);
  const away = poissonPmf(awayMean);
  const margin = new Map<number, number>();
  for (let h = 0; h < home.length; h += 1) {
    for (let a = 0; a < away.length; a += 1) {
      const d = h - a;
      margin.set(d, (margin.get(d) ?? 0) + home[h] * away[a]);
    }
  }
  const tie = margin.get(0) ?? 0;
  const q = args.overtimeHomeWinProbability;
  return ({ line }) => {
    if (!Number.isFinite(line)) return null;
    let over = 0;
    for (const [d, p] of margin) if (d !== 0 && d > line) over += p;
    const homeTieCovers = 1 > line;
    const awayTieCovers = -1 > line;
    if (homeTieCovers === awayTieCovers) return over + (homeTieCovers ? tie : 0);
    if (q == null || !Number.isFinite(q) || q < 0 || q > 1) return null;
    return over + tie * q;
  };
}

/**
 * Probability that the home side covers its handicap `homeLine` (e.g. -1.5),
 * under SPREAD_OVERTIME_RULE. Integer lines can push.
 */
export function homeSpreadCoverProbabilities(args: {
  homeMean: number;
  awayMean: number;
  homeLine: number;
  overtimeHomeWinProbability?: number | null;
}): ModelLineProbabilities | null {
  return getModelLineProbabilities({
    marketType: "spreads",
    mean: args.homeMean - args.awayMean,
    line: -args.homeLine,
    overProbability: spreadMarginOverProbability(args),
  });
}

/**
 * Spread quotes rewritten as over/under quotes on the home margin: the home
 * side at handicap L is an over at -L; the away side, quoted at -L itself, is
 * the matching under at its own line. A book counts only when both sides land
 * on the same margin line.
 */
function spreadQuotesAsMarginQuotes(
  quotes: MarketPriceQuote[],
  homeTeamAbbreviation: string,
  awayTeamAbbreviation: string,
): MarketPriceQuote[] {
  const out: MarketPriceQuote[] = [];
  for (const quote of quotes) {
    if (quote.line_value == null || !Number.isFinite(quote.line_value)) continue;
    if (quote.outcome_key === `team:${homeTeamAbbreviation}`) {
      out.push({ ...quote, outcome_key: "over", line_value: -quote.line_value });
    } else if (quote.outcome_key === `team:${awayTeamAbbreviation}`) {
      // Away at +L is the other side of home at -L: home margin under L.
      out.push({ ...quote, outcome_key: "under", line_value: quote.line_value });
    }
  }
  return out;
}

/**
 * Totals and spread flag rows for one game, compared per book in probability
 * space (decision 30): each book's two-way pair is de-vigged on its own, books
 * at different lines are never averaged, and the model side is a probability,
 * not a mean against a line.
 * - Totals: P(home + away goals > line) from independent Poisson team means.
 * - Spreads: P(home covers) under SPREAD_OVERTIME_RULE, against the de-vigged
 *   home price; flags are "model_home_cover" / "model_away_cover".
 * Unknown means, missing teams or unusable quotes give no row.
 */
export function buildGameMarketFlagRows(args: {
  asOfDate: string;
  gameId: number;
  homeExpectedGoals: number | null;
  awayExpectedGoals: number | null;
  homeTeamAbbreviation: string | null;
  awayTeamAbbreviation: string | null;
  totalsSummary: MarketTypeSummary | undefined;
  spreadsSummary: MarketTypeSummary | undefined;
  threshold?: number;
  overtimeHomeWinProbability?: number | null;
  metadata?: Record<string, unknown>;
}): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  const home = args.homeExpectedGoals;
  const away = args.awayExpectedGoals;
  if (home == null || away == null || !Number.isFinite(home) || !Number.isFinite(away)) {
    return rows;
  }
  const common = {
    asOfDate: args.asOfDate,
    entityType: "game" as const,
    entityId: args.gameId,
    gameId: args.gameId,
  };

  const totals = compareModelWithMarket({
    marketType: "totals",
    expectedValue: home + away,
    quotes: quotesFromMarketSummary(args.totalsSummary),
    threshold: args.threshold,
    twoWayOnly: true,
  });
  if (totals) {
    const row = buildModelMarketProbabilityFlagRow({
      ...common,
      comparison: totals,
      provider: args.totalsSummary?.sourceNames[0] ?? null,
      metadata: {
        ...(args.metadata ?? {}),
        model_distribution: "independent-poisson-team-goals",
        goals_added_for_en_ot: 0,
      },
    });
    if (row) rows.push(row);
  }

  if (args.homeTeamAbbreviation && args.awayTeamAbbreviation) {
    const spread = compareModelWithMarket({
      marketType: "spreads",
      expectedValue: home - away,
      quotes: spreadQuotesAsMarginQuotes(
        quotesFromMarketSummary(args.spreadsSummary),
        args.homeTeamAbbreviation,
        args.awayTeamAbbreviation,
      ),
      overProbability: spreadMarginOverProbability({
        homeMean: home,
        awayMean: away,
        overtimeHomeWinProbability: args.overtimeHomeWinProbability,
      }),
      threshold: args.threshold,
      twoWayOnly: true,
    });
    if (spread) {
      const row = buildModelMarketProbabilityFlagRow({
        ...common,
        comparison: spread,
        provider: args.spreadsSummary?.sourceNames[0] ?? null,
        flagTypeLabels: { over: "model_home_cover", under: "model_away_cover" },
        extraReasons: {
          home_line_value: -spread.line,
          home_margin_expected: round(home - away),
          model_probability_home_cover: round(spread.model.over),
          model_probability_home_cover_given_no_push: round(spread.model.overGivenNoPush),
          market_probability_home_cover: round(spread.marketProbabilityOver),
        },
        metadata: {
          ...(args.metadata ?? {}),
          model_distribution: "independent-poisson-team-goals",
          overtime_rule: SPREAD_OVERTIME_RULE,
          line_convention: "line_value is the home-margin line (-home handicap)",
        },
      });
      if (row) rows.push(row);
    }
  }
  return rows;
}
