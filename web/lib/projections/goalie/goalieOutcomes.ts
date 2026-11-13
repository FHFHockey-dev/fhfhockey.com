// Goalie outcome math for FORGE (tasks 7.1, 7.2, 7.4 of
// tasks/TASKS/forge-projections/tasks-forge-projection-improvements-2026-10-22.md).
// Every constant below was fitted on 2018-19..2024-25 regular seasons (wgo_goalie_stats /
// wgo_team_stats, read-only, 2026-10-22); 2025-26 was held out for the backtest in
// scripts/forge-goalie-backtest.ts.
import { finalWinProbabilitiesFromRegulation } from "lib/game-predictions/overtimeRule";
import type { MarketSummaryQuote, MarketTypeSummary } from "../queries/market-queries";
import {
  MAX_VALID_BOOK_SUM,
  MIN_VALID_BOOK_SUM,
  americanToImpliedProbability,
  devigProportional,
  median
} from "../utils/devig";

// Beta prior strength (shots) for save %. Split-half reliability gave k ~2,200, year-over-year
// ~3,400, and the direct next-season prediction grid (prior = previous three seasons) was
// minimised at ~6,000 (flat from 4,000 to 11,000). Literature range: 3,000-11,000.
export const GOALIE_SAVE_PCT_PRIOR_SHOTS = 6000;
// Used only when the season-current league mean cannot be read (2025-26 regular season).
export const LEAGUE_SAVE_PCT_FALLBACK = 0.8955;
// Goalie played yesterday: own data +0.0006 +/- 0.0026 (419 starts, vs the goalie's own
// leave-one-out season save %), literature -0.005..-0.010. Precision-weighted: about -0.003.
export const GOALIE_B2B_SAVE_PCT_ADJUSTMENT = -0.003;
// Five or more appearances in the previous 14 days (not B2B): -0.0024 +/- 0.0009 (3,804 starts).
export const GOALIE_HEAVY_WORKLOAD_SAVE_PCT_ADJUSTMENT = -0.002;
export const GOALIE_HEAVY_WORKLOAD_MIN_STARTS_14D = 5;
// Unvalidated game-context save % shifts (shot-context %, 5v5 environment, rest splits) keep
// roughly their legacy effective weight (the legacy prior diluted them to ~5-30%). Sizing them to
// evidence belongs to task 9.
export const GOALIE_CONTEXT_SAVE_PCT_PASS_THROUGH = 0.25;
// Starters were credited with 98.4% of their teams' wins (8,347 of 8,483); the rest went to
// relievers after a pull or injury. Goalie W = P(team wins | starts) x this share x P(start),
// plus the relief share when another candidate starts (goalieWinPopulations).
export const STARTER_DECISION_SHARE = 0.984;
// P(starter is credited with the shutout | starter allowed no goals while in net): credited
// shutouts 5.45% of starts vs 5.88% of starts with zero goals against (exits for injury or rest,
// combined shutouts) -> 0.927.
export const SHUTOUT_FULL_GAME_PROBABILITY = 0.927;
// Team shots against per game around the trailing-10 mean: mean 29.8, residual variance 45.9
// -> negative binomial size ~68 (an upper bound on dispersion; it includes opponent mix).
export const SHOTS_AGAINST_NB_SIZE = 68;
// Goals | shots stay binomial: starts allowed zero goals less often than an independent binomial
// on their actual shots implies (5.88% vs 7.74%), so a beta save % mixture (which only adds zeros)
// is not supported.
// Poisson regulation ties occur 16% of the time; 21.6% of games reach OT/SO -> inflate ties x1.33.
export const WIN_MODEL_TIE_INFLATION = 1.33;
// Symmetric shrink of the two teams' expected goals toward their mean. On trailing-10 inputs
// the Brier optimum was 0.5 (0.2458 vs 0.2479 at 1.0). FORGE's skater-sum goals are less noisy
// than trailing-10 averages, so production uses 0.75 until the ledger can calibrate it.
export const WIN_MODEL_SPREAD_SHRINK = 0.75;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** One beta-binomial: all of a goalie's evidence shrunk toward the league mean with k shots. */
export function posteriorSavePct(args: {
  shots: number;
  goals: number;
  priorMean: number;
  priorShots?: number;
}): number {
  const k = args.priorShots ?? GOALIE_SAVE_PCT_PRIOR_SHOTS;
  const shots = Number.isFinite(args.shots) ? Math.max(0, args.shots) : 0;
  const goals = Number.isFinite(args.goals) ? clamp(args.goals, 0, shots) : 0;
  if (shots + k <= 0) return args.priorMean;
  return (shots - goals + k * args.priorMean) / (shots + k);
}

export function goalieRestSavePctAdjustment(workload: {
  isGoalieBackToBack: boolean;
  startsLast14Days: number;
}): number {
  if (workload.isGoalieBackToBack) return GOALIE_B2B_SAVE_PCT_ADJUSTMENT;
  if (workload.startsLast14Days >= GOALIE_HEAVY_WORKLOAD_MIN_STARTS_14D) {
    return GOALIE_HEAVY_WORKLOAD_SAVE_PCT_ADJUSTMENT;
  }
  return 0;
}

function poissonPmf(lambda: number): number[] {
  const max = Math.ceil(lambda + 10 * Math.sqrt(lambda) + 12);
  const pmf = [Math.exp(-lambda)];
  for (let k = 1; k <= max; k += 1) pmf.push((pmf[k - 1] * lambda) / k);
  return pmf;
}

/**
 * P(team wins, including OT/SO) from both teams' expected goals. The two teams' values sum to
 * exactly 1: regulation is an independent Poisson race with inflated ties, and a regulation tie is
 * split by the shared overtime rule (game-predictions/overtimeRule, 50/50).
 */
export function teamWinProbability(
  lambdaFor: number,
  lambdaAgainst: number,
  options: { spreadShrink?: number; tieInflation?: number } = {}
): number {
  if (!Number.isFinite(lambdaFor) || !Number.isFinite(lambdaAgainst) || lambdaFor < 0 || lambdaAgainst < 0) {
    throw new Error("Expected goals must be finite and nonnegative");
  }
  const shrink = options.spreadShrink ?? WIN_MODEL_SPREAD_SHRINK;
  const tieInflation = options.tieInflation ?? WIN_MODEL_TIE_INFLATION;
  const mean = (lambdaFor + lambdaAgainst) / 2;
  const f = Math.max(0, mean + (shrink * (lambdaFor - lambdaAgainst)) / 2);
  const a = Math.max(0, mean - (shrink * (lambdaFor - lambdaAgainst)) / 2);
  const pf = poissonPmf(f);
  const pa = poissonPmf(a);
  let win = 0;
  let tie = 0;
  let loss = 0;
  for (let i = 0; i < pf.length; i += 1) {
    for (let j = 0; j < pa.length; j += 1) {
      const p = pf[i] * pa[j];
      if (i > j) win += p;
      else if (i === j) tie += p;
      else loss += p;
    }
  }
  tie /= win + tie + loss;
  const inflatedTie = clamp(tie * tieInflation, 0, 0.95);
  const regulationWinShare = win + loss > 0 ? win / (win + loss) : 0.5;
  // OT/SO goes through the one shared rule (owner decision 45). The rule has no home edge
  // (homeShareOfTie 0.5), so placing this team in its home slot is exact without knowing the side.
  const final = finalWinProbabilitiesFromRegulation({
    homeRegulationWin: regulationWinShare * (1 - inflatedTie),
    awayRegulationWin: (1 - regulationWinShare) * (1 - inflatedTie),
    regulationTie: inflatedTie
  });
  if (!final) throw new Error("Regulation outcome probabilities must sum to 1");
  return clamp(final.home, 0, 1);
}

function quoteTimestamp(value: string | null | undefined): number | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * De-vigged moneyline P(team wins) from a stored h2h summary (outcome keys `team:<ABBR>`). Each
 * sportsbook is de-vigged on its own (proportional normalisation, utils/devig) and the books are
 * then combined by the median, so the two teams' values still sum to 1. A book counts only with a
 * complete pair from one observation: exactly one quote per side, both observed at the same time
 * and carrying a freshness expiry, and a sum inside the book sanity band. Quotes from different
 * books, ages or untimestamped rows are never paired; with no such pair the market is null.
 * Freshness against the decision time is enforced when the summary is built (market-queries).
 */
export function marketTeamWinProbability(
  h2h: MarketTypeSummary | null | undefined,
  teamAbbrev: string | null,
  opponentAbbrev: string | null
): number | null {
  if (!h2h || !teamAbbrev || !opponentAbbrev) return null;
  const teamKey = `team:${teamAbbrev}`;
  const opponentKey = `team:${opponentAbbrev}`;
  const sidesByBook = new Map<string, MarketSummaryQuote[]>();
  for (const quote of h2h.quotes ?? []) {
    if (quote.outcome_key !== teamKey && quote.outcome_key !== opponentKey) continue;
    const list = sidesByBook.get(quote.sportsbook_key) ?? [];
    list.push(quote);
    sidesByBook.set(quote.sportsbook_key, list);
  }
  const bookProbabilities: number[] = [];
  for (const quotes of sidesByBook.values()) {
    const team = quotes.filter((q) => q.outcome_key === teamKey);
    const opponent = quotes.filter((q) => q.outcome_key === opponentKey);
    if (team.length !== 1 || opponent.length !== 1) continue;
    const observedAt = [team[0], opponent[0]].map((q) => quoteTimestamp(q.source_observed_at));
    const expiresAt = [team[0], opponent[0]].map((q) => quoteTimestamp(q.freshness_expires_at));
    if (observedAt.some((t) => t == null) || expiresAt.some((t) => t == null)) continue;
    if (observedAt[0] !== observedAt[1]) continue;
    if (expiresAt.some((t) => t! < observedAt[0]!)) continue;
    const teamImplied = americanToImpliedProbability(team[0].price_american);
    const opponentImplied = americanToImpliedProbability(opponent[0].price_american);
    if (teamImplied == null || opponentImplied == null) continue;
    const bookSum = teamImplied + opponentImplied;
    if (bookSum < MIN_VALID_BOOK_SUM || bookSum > MAX_VALID_BOOK_SUM) continue;
    const devigged = devigProportional([teamImplied, opponentImplied]);
    if (devigged) bookProbabilities.push(devigged.probabilities[0]);
  }
  return median(bookProbabilities);
}

/**
 * P(team wins | this goalie starts): the team-level (paired) probability moved by the change in
 * the model win probability when the opponent's expected goals scale with this goalie's goals
 * per shot relative to the team's start-weighted expectation. A ratio of 1 returns the team value.
 */
export function goalieConditionalWinProbability(args: {
  teamWinProbability: number;
  lambdaFor: number;
  lambdaAgainst: number;
  goalsAgainstRatio: number;
}): number {
  const ratio = Number.isFinite(args.goalsAgainstRatio) && args.goalsAgainstRatio > 0 ? args.goalsAgainstRatio : 1;
  if (ratio === 1) return args.teamWinProbability;
  const delta =
    teamWinProbability(args.lambdaFor, args.lambdaAgainst * ratio) -
    teamWinProbability(args.lambdaFor, args.lambdaAgainst);
  return clamp(args.teamWinProbability + delta, 0.01, 0.99);
}

/**
 * P(no goals against over a full game) from a shots-against mixture: shots ~ negative binomial
 * around the expectation (size Infinity = Poisson), goals | shots ~ Binomial(shots, 1 - save %),
 * times P(the starter is credited with the full game | clean sheet). Multiply by P(start) outside.
 */
export function shutoutProbability(args: {
  expectedShotsAgainst: number;
  savePct: number;
  nbSize?: number;
  fullGameProbability?: number;
}): number {
  const mu = Math.max(0, Number.isFinite(args.expectedShotsAgainst) ? args.expectedShotsAgainst : 0);
  const sv = clamp(args.savePct, 0, 1);
  const r = args.nbSize ?? SHOTS_AGAINST_NB_SIZE;
  const fullGame = args.fullGameProbability ?? SHUTOUT_FULL_GAME_PROBABILITY;
  if (mu === 0) return clamp(fullGame, 0, 1);
  const finiteSize = Number.isFinite(r);
  const variance = finiteSize ? mu + (mu * mu) / r : mu;
  const maxShots = Math.ceil(mu + 12 * Math.sqrt(variance) + 20);
  let pShots = finiteSize ? Math.pow(r / (r + mu), r) : Math.exp(-mu);
  let pSaveAll = 1;
  let total = 0;
  for (let n = 0; n <= maxShots; n += 1) {
    total += pShots * pSaveAll;
    pShots *= finiteSize ? ((n + r) / (n + 1)) * (mu / (r + mu)) : mu / (n + 1);
    pSaveAll *= sv;
  }
  return clamp(total * fullGame, 0, 1);
}

/**
 * Two win populations that must not be mixed (Codex review 7.2):
 * - team: P(team wins the game), one value per team-game; the two teams sum to 1. Validated
 *   against game outcomes.
 * - goalie: P(this goalie is credited with the win), one value per candidate goalie. It is
 *   P(start) x P(team wins | starts) x STARTER_DECISION_SHARE plus the relief share of the wins
 *   when another candidate starts. Validated against credited wins, among starts (the
 *   conditional term) and among all candidates (the unconditional value).
 */
export type GoalieWinCandidate = {
  goalieId: number;
  /** P(this goalie starts); the candidates' values should sum to about 1. */
  startProbability: number;
  /** P(team wins | this goalie starts): a team-game quantity conditioned on the starter. */
  teamWinIfStarts: number;
};

export type GoalieWinPopulation = GoalieWinCandidate & {
  /** P(credited with the win | starts) = teamWinIfStarts x STARTER_DECISION_SHARE. */
  creditedWinIfStarts: number;
  /** P(starts and is credited with the win). */
  starterWin: number;
  /** P(another candidate starts, this goalie relieves and is credited with the win). */
  reliefWin: number;
  /** starterWin + reliefWin: the goalie's unconditional W for the game. */
  unconditionalWin: number;
};

/**
 * Per-candidate unconditional W. Relief wins (1 - decision share of the team's wins when h
 * starts) go to the other candidates in proportion to their start probabilities, i.e. the
 * dressed backup is the likelier non-starter. With start probabilities summing to 1 the
 * candidates' unconditional W sums to the start-weighted team win probability.
 */
export function goalieWinPopulations(
  candidates: GoalieWinCandidate[],
  decisionShare: number = STARTER_DECISION_SHARE
): { goalies: GoalieWinPopulation[]; startWeightedTeamWin: number | null; startProbabilityMass: number } {
  const cleaned = candidates.map((c) => ({
    ...c,
    startProbability: clamp(Number.isFinite(c.startProbability) ? c.startProbability : 0, 0, 1),
    teamWinIfStarts: clamp(c.teamWinIfStarts, 0, 1)
  }));
  const mass = cleaned.reduce((sum, c) => sum + c.startProbability, 0);
  const goalies = cleaned.map((g) => {
    let reliefWin = 0;
    for (const h of cleaned) {
      if (h.goalieId === g.goalieId || h.startProbability <= 0) continue;
      const others = mass - h.startProbability;
      if (others <= 0) continue;
      reliefWin += h.startProbability * h.teamWinIfStarts * (1 - decisionShare) * (g.startProbability / others);
    }
    const creditedWinIfStarts = g.teamWinIfStarts * decisionShare;
    const starterWin = g.startProbability * creditedWinIfStarts;
    return { ...g, creditedWinIfStarts, starterWin, reliefWin, unconditionalWin: clamp(starterWin + reliefWin, 0, 1) };
  });
  const startWeightedTeamWin = mass > 0
    ? cleaned.reduce((sum, c) => sum + c.startProbability * c.teamWinIfStarts, 0) / mass
    : null;
  return { goalies, startWeightedTeamWin, startProbabilityMass: mass };
}
