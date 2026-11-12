/**
 * Client-safe win-pair helpers shared by the homepage presentation and the
 * server enrichment in `lib/homepageGameAnalytics.ts` (which must not be
 * imported by client code: it pulls in server-only modules).
 */

const finiteNumber = (value: unknown): number | undefined => {
  if (value == null || value === "" || typeof value === "boolean") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * Presentation tolerance for a two-way probability pair: a pair whose sum is
 * off by more than half a displayed point cannot be shown as complementary
 * whole percentages, so it is treated as incoherent.
 */
const PROBABILITY_PAIR_TOLERANCE = 0.005;

export const coherentProbabilityPair = (
  away: unknown,
  home: unknown,
): { away: number; home: number } | null => {
  const awayValue = finiteNumber(away);
  const homeValue = finiteNumber(home);
  if (awayValue == null || homeValue == null) return null;
  if (awayValue < 0 || awayValue > 1 || homeValue < 0 || homeValue > 1) {
    return null;
  }
  if (Math.abs(awayValue + homeValue - 1) > PROBABILITY_PAIR_TOLERANCE) {
    return null;
  }
  return { away: awayValue, home: homeValue };
};

export type HomepageDisplayedWinPair = {
  awayPercent: number;
  homePercent: number;
  pick: "home" | "away" | "tie";
};

/**
 * The win pair as displayed (decision 43): the larger side is rounded to a
 * whole percent and the other side is its complement, so the pair always sums
 * to 100 and swapping sides swaps the result. The pick follows the displayed
 * numbers; a displayed 50/50 is a tie. Incoherent pairs return null.
 */
export function displayedWinPair(
  awayProbability: unknown,
  homeProbability: unknown,
): HomepageDisplayedWinPair | null {
  const pair = coherentProbabilityPair(awayProbability, homeProbability);
  if (!pair) return null;
  const homeLarger = pair.home >= pair.away;
  const largerPercent = Math.round(
    (homeLarger ? pair.home : pair.away) * 100,
  );
  const homePercent = homeLarger ? largerPercent : 100 - largerPercent;
  const awayPercent = 100 - homePercent;
  return {
    awayPercent,
    homePercent,
    pick:
      homePercent > awayPercent
        ? "home"
        : awayPercent > homePercent
          ? "away"
          : "tie",
  };
}
