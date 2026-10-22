/**
 * Sportsbook price helpers: convert American odds to implied probabilities and
 * remove the bookmaker margin ("de-vig") so model probabilities can be compared
 * with market probabilities in probability space.
 *
 * Methods:
 * - "shin" (default): Shin (1993) insider-trading model. Solves for the insider
 *   share z so the fair probabilities sum to 1. For two-way markets Shin is
 *   mathematically identical to the additive / equal-margin method; it differs
 *   (and shades longshots harder than proportional) for three or more outcomes.
 * - "proportional": divide each implied probability by the overround. Known to
 *   overstate longshots.
 * - "equal-margin": subtract an equal share of the overround from each outcome.
 *
 * "Yes"-only markets (e.g. anytime goal scorer) have no opposing price, so the
 * overround cannot be observed. `devigYesOnly` assumes a total two-way
 * overround (DEFAULT_YES_ONLY_OVERROUND, configurable) and applies the
 * equal-margin rule: fair = implied - overround / 2.
 */

export type DevigMethod = "shin" | "proportional" | "equal-margin";

/**
 * Assumed total overround for "Yes"-only markets. Major props carry about
 * 4-6% and secondary props 6-10% (Wizard of Odds, cited in the deep-research
 * report); anytime goal scorer is a secondary market, so 8% is the midpoint
 * assumption until it is calibrated against two-way goal markets.
 */
export const DEFAULT_YES_ONLY_OVERROUND = 0.08;

/** Two-way books whose implied probabilities sum outside this band are rejected as bad data. */
export const MIN_VALID_BOOK_SUM = 0.98;
export const MAX_VALID_BOOK_SUM = 1.35;

/**
 * American odds are invalid in (-100, 100). Some stored rows hold decimal odds
 * (e.g. 1, 2) in price_american; those return null rather than a bogus price.
 */
export function isValidAmericanPrice(price: number | null | undefined): price is number {
  return (
    typeof price === "number" &&
    Number.isFinite(price) &&
    (price >= 100 || price <= -100)
  );
}

export function americanToDecimal(price: number | null | undefined): number | null {
  if (!isValidAmericanPrice(price)) return null;
  return price > 0 ? 1 + price / 100 : 1 + 100 / -price;
}

export function americanToImpliedProbability(
  price: number | null | undefined,
): number | null {
  const decimal = americanToDecimal(price);
  return decimal == null ? null : 1 / decimal;
}

function isProbability(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value < 1;
}

export type DevigResult = {
  probabilities: number[];
  /** Sum of the raw implied probabilities minus 1 (the book margin). */
  overround: number;
  method: DevigMethod;
  /** Shin insider share; only set for method "shin". */
  shinZ?: number;
};

function shinProbability(pi: number, total: number, z: number): number {
  return (Math.sqrt(z * z + (4 * (1 - z) * pi * pi) / total) - z) / (2 * (1 - z));
}

export function devigShin(implied: number[]): DevigResult | null {
  if (implied.length < 2 || !implied.every(isProbability)) return null;
  const total = implied.reduce((sum, p) => sum + p, 0);
  const overround = total - 1;
  if (overround <= 0) {
    // No margin (or an arbitrage): Shin has no positive insider share; normalise.
    return {
      probabilities: implied.map((p) => p / total),
      overround,
      method: "shin",
      shinZ: 0,
    };
  }
  // Sum of Shin probabilities decreases monotonically in z; bisection on [0, 1).
  const sumAt = (z: number) =>
    implied.reduce((sum, p) => sum + shinProbability(p, total, z), 0);
  let lo = 0;
  let hi = 0.999;
  for (let i = 0; i < 100; i += 1) {
    const mid = (lo + hi) / 2;
    if (sumAt(mid) > 1) lo = mid;
    else hi = mid;
  }
  const z = (lo + hi) / 2;
  const raw = implied.map((p) => shinProbability(p, total, z));
  const rawSum = raw.reduce((sum, p) => sum + p, 0);
  return {
    probabilities: raw.map((p) => p / rawSum),
    overround,
    method: "shin",
    shinZ: z,
  };
}

export function devigProportional(implied: number[]): DevigResult | null {
  if (implied.length < 2 || !implied.every(isProbability)) return null;
  const total = implied.reduce((sum, p) => sum + p, 0);
  return {
    probabilities: implied.map((p) => p / total),
    overround: total - 1,
    method: "proportional",
  };
}

export function devigEqualMargin(implied: number[]): DevigResult | null {
  if (implied.length < 2 || !implied.every(isProbability)) return null;
  const total = implied.reduce((sum, p) => sum + p, 0);
  const share = (total - 1) / implied.length;
  const shifted = implied.map((p) => p - share);
  // A heavy longshot can go non-positive under additive removal; fall back to proportional.
  if (!shifted.every((p) => p > 0)) return devigProportional(implied);
  return {
    probabilities: shifted,
    overround: total - 1,
    method: "equal-margin",
  };
}

export function devig(
  implied: number[],
  method: DevigMethod = "shin",
): DevigResult | null {
  switch (method) {
    case "proportional":
      return devigProportional(implied);
    case "equal-margin":
      return devigEqualMargin(implied);
    case "shin":
    default:
      return devigShin(implied);
  }
}

/**
 * De-vig a two-way market from its two American prices. Returns null when a
 * price is invalid or the book sum is outside [MIN_VALID_BOOK_SUM, MAX_VALID_BOOK_SUM].
 */
export function devigTwoWayAmerican(
  priceA: number | null | undefined,
  priceB: number | null | undefined,
  method: DevigMethod = "shin",
): (DevigResult & { fairA: number; fairB: number }) | null {
  const a = americanToImpliedProbability(priceA);
  const b = americanToImpliedProbability(priceB);
  if (a == null || b == null) return null;
  const total = a + b;
  if (total < MIN_VALID_BOOK_SUM || total > MAX_VALID_BOOK_SUM) return null;
  const result = devig([a, b], method);
  if (!result) return null;
  return {
    ...result,
    fairA: result.probabilities[0],
    fairB: result.probabilities[1],
  };
}

/**
 * Fair probability for a "Yes"-only price under an assumed total overround.
 * "equal-margin" (default): implied - overround / 2, i.e. the price an additive
 * (= two-way Shin) de-vig would give if the hidden "No" side carried the other
 * half of the margin. "proportional": implied / (1 + overround). Equal-margin
 * results at or below zero (extreme longshots) fall back to proportional.
 */
export function devigYesOnly(
  price: number | null | undefined,
  options: {
    overround?: number;
    method?: "equal-margin" | "proportional";
  } = {},
): { probability: number; implied: number; overround: number; method: "equal-margin" | "proportional" } | null {
  const implied = americanToImpliedProbability(price);
  if (implied == null) return null;
  const overround = options.overround ?? DEFAULT_YES_ONLY_OVERROUND;
  if (!Number.isFinite(overround) || overround < 0) return null;
  const proportional = implied / (1 + overround);
  if (options.method === "proportional") {
    return { probability: proportional, implied, overround, method: "proportional" };
  }
  const equalMargin = implied - overround / 2;
  if (equalMargin <= 0) {
    return { probability: proportional, implied, overround, method: "proportional" };
  }
  return { probability: equalMargin, implied, overround, method: "equal-margin" };
}

/** Expected profit per 1 unit staked at an American price, given a win probability. */
export function expectedValueAtAmericanPrice(
  probability: number,
  price: number | null | undefined,
): number | null {
  const decimal = americanToDecimal(price);
  if (decimal == null || !Number.isFinite(probability)) return null;
  return probability * decimal - 1;
}

export function median(values: number[]): number | null {
  const finite = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (finite.length === 0) return null;
  const mid = Math.floor(finite.length / 2);
  return finite.length % 2 === 1 ? finite[mid] : (finite[mid - 1] + finite[mid]) / 2;
}

/** Inverse of americanToImpliedProbability, for prices rebuilt from averaged probabilities. */
export function impliedProbabilityToAmerican(probability: number): number | null {
  if (!isProbability(probability)) return null;
  return probability >= 0.5
    ? -(100 * probability) / (1 - probability)
    : (100 * (1 - probability)) / probability;
}
