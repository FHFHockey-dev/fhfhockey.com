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
} from "./devig";

export const ANALYTICS_MODEL_NAME = "forge";
export const ANALYTICS_MODEL_VERSION = "market-context-v1";

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

export function getConsensusLineValue(
  summary: MarketTypeSummary | undefined,
): number | null {
  if (!summary) return null;
  const candidate = summary.outcomes.find(
    (outcome) => outcome.averageLineValue != null,
  );
  return candidate?.averageLineValue ?? null;
}

function buildFlagConfidence(edgeValue: number, threshold: number): number {
  if (
    !Number.isFinite(edgeValue) ||
    !Number.isFinite(threshold) ||
    threshold <= 0
  ) {
    return 0;
  }
  return Number(
    Math.min(100, Math.max(0, (Math.abs(edgeValue) / threshold) * 50)).toFixed(
      2,
    ),
  );
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
  const threshold =
    args.entityType === "game"
      ? ((GAME_MARKET_EDGE_THRESHOLDS as Record<string, number>)[
          args.marketType
        ] ?? 0.25)
      : (PLAYER_MARKET_EDGE_THRESHOLDS[args.marketType] ?? 0.25);
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
    confidence_0_to_100: buildFlagConfidence(args.edgeValue, threshold),
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
 * Rebuild one synthetic quote per outcome from a MarketTypeSummary, for callers
 * that only hold the averaged summary. Prices come from the averaged implied
 * probability (averaging American prices across the +/-100 boundary is
 * meaningless). Lower quality than per-book quotes: lines and prices are
 * already averaged across books.
 */
export function quotesFromMarketSummary(
  summary: MarketTypeSummary | undefined,
): MarketPriceQuote[] {
  if (!summary) return [];
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

export type MarketProbabilityComparison = {
  marketType: string;
  line: number;
  expectedValue: number;
  model: ModelLineProbabilities;
  /** Median of per-book de-vigged P(over | no push) at the consensus line. */
  marketProbabilityOver: number;
  /** model.overGivenNoPush - marketProbabilityOver; positive favours the over. */
  probabilityEdge: number;
  threshold: number;
  flagType: "model_over" | "model_under" | null;
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
 * quoted by the most books (ties go to the lower line). Each book is de-vigged
 * on its own over/under pair (Shin by default; a book with only "yes"/"over"
 * uses devigYesOnly's equal-margin assumption), the market probability is the
 * median of those per-book fair probabilities, and the expected value uses the
 * best price on each side. Lines are never averaged across books.
 */
export function compareModelWithMarket(args: {
  marketType: string;
  expectedValue: number;
  quotes: MarketPriceQuote[];
  overProbability?: OverProbabilityFn;
  devigMethod?: DevigMethod;
  threshold?: number;
  yesOnlyOverround?: number;
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
    } else if (overPrice != null) {
      const yes = devigYesOnly(overPrice, { overround: args.yesOnlyOverround });
      if (yes) {
        fairOver.push(yes.probability);
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
  return {
    marketType: args.marketType,
    line,
    expectedValue: args.expectedValue,
    model,
    marketProbabilityOver,
    probabilityEdge,
    threshold,
    flagType:
      probabilityEdge >= threshold
        ? "model_over"
        : probabilityEdge <= -threshold
          ? "model_under"
          : null,
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
}): Record<string, unknown> | null {
  const c = args.comparison;
  if (!c.flagType) return null;
  const row = buildModelMarketFlagRow({
    asOfDate: args.asOfDate,
    entityType: args.entityType,
    entityId: args.entityId,
    gameId: args.gameId,
    marketType: c.marketType,
    flagType: c.flagType,
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
      },
    ],
    provider: args.provider,
    metadata: {
      ...(args.metadata ?? {}),
      comparison_basis: "probability",
      devig_method: c.devigMethod,
      book_combine: c.combine,
    },
  });
  row.confidence_0_to_100 = buildFlagConfidence(c.probabilityEdge, c.threshold);
  return row;
}
