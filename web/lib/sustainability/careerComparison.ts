import {
  betaBinomialUsualRange,
  negativeBinomialUsualRange,
  type UsualRangeResult
} from "./usualRange";

/**
 * /charts "current vs career" (BC W1-9 D12): the current window is judged
 * against a usual range for a window of its own size, built from the pooled
 * career (completed seasons). Thresholds no longer ignore sample size.
 */

export type RatioComponents = {
  numerator: number | null;
  denominator: number | null;
};

export type CareerComparisonStat =
  | "S%"
  | "xS%"
  | "IPP"
  | "oiSH%"
  | "secA%"
  | "SOG/60"
  | "oZS%";

export type CareerComparisonStatus = "hot" | "cold" | "neutral" | "insufficient";

/** Successes-in-trials stats (beta-binomial); the rest are rates. */
const PROPORTIONS: ReadonlySet<CareerComparisonStat> = new Set([
  "S%",
  "IPP",
  "oiSH%",
  "secA%",
  "oZS%"
]);

function known(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function compareWindowToCareer(
  stat: CareerComparisonStat,
  current: RatioComponents | null | undefined,
  career: RatioComponents | null | undefined
): { status: CareerComparisonStatus; range: UsualRangeResult | null } {
  if (
    !current ||
    !career ||
    !known(current.numerator) ||
    !known(current.denominator) ||
    !known(career.numerator) ||
    !known(career.denominator) ||
    current.denominator <= 0 ||
    career.denominator <= 0 ||
    current.numerator < 0 ||
    career.numerator < 0
  ) {
    return { status: "insufficient", range: null };
  }

  let range: UsualRangeResult;
  if (PROPORTIONS.has(stat)) {
    if (
      current.numerator > current.denominator ||
      career.numerator > career.denominator
    ) {
      return { status: "insufficient", range: null };
    }
    range = betaBinomialUsualRange({
      baseline: career.numerator / career.denominator,
      baselineTrials: career.denominator,
      successes: current.numerator,
      trials: current.denominator,
      gamesInWindow: 1,
      gamesCovered: 1,
      baselineSeasons: []
    });
  } else {
    // Rates: count over exposure (shots over minutes; ixG over iFF, a
    // continuous count, labelled as such by the range family).
    range = negativeBinomialUsualRange({
      baselinePer60: (career.numerator / career.denominator) * 60,
      baselineMinutes: career.denominator,
      count: current.numerator,
      minutes: current.denominator,
      continuous: stat === "xS%",
      gamesInWindow: 1,
      gamesCovered: 1,
      baselineSeasons: []
    });
  }

  if ("unavailable" in range) return { status: "insufficient", range };
  return { status: range.status, range };
}
