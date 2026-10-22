// Goalie outcome math for FORGE (tasks 7.1, 7.2, 7.4 of
// tasks/TASKS/forge-projections/tasks-forge-projection-improvements-2026-10-22.md).
// Every constant below was fitted on 2018-19..2024-25 regular seasons (wgo_goalie_stats /
// wgo_team_stats, read-only, 2026-10-22); 2025-26 was held out for the backtest in
// scripts/forge-goalie-backtest.ts.
import type { MarketTypeSummary } from "../queries/market-queries";
import {
  MAX_VALID_BOOK_SUM,
  MIN_VALID_BOOK_SUM,
  americanToImpliedProbability,
  devigProportional
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
// relievers after a pull or injury. Goalie W = P(team wins | starts) x this share x P(start).
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
 * exactly 1: regulation is an independent Poisson race with inflated ties, and OT/SO goes to the
 * team with the larger share of scoring.
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
  const regulationWin = (win + loss > 0 ? win / (win + loss) : 0.5) * (1 - inflatedTie);
  const overtimeShare = f + a > 0 ? f / (f + a) : 0.5;
  return clamp(regulationWin + inflatedTie * overtimeShare, 0, 1);
}

/**
 * De-vigged moneyline P(team wins) from a stored h2h summary (outcome keys `team:<ABBR>`), by
 * proportional normalisation of the two implied probabilities (utils/devig). Null when either side
 * is missing or the pair does not look like a real book (e.g. decimal odds stored as American).
 */
export function marketTeamWinProbability(
  h2h: MarketTypeSummary | null | undefined,
  teamAbbrev: string | null,
  opponentAbbrev: string | null
): number | null {
  if (!h2h || !teamAbbrev || !opponentAbbrev) return null;
  const implied = (abbrev: string) => {
    const outcome = h2h.outcomes.find((o) => o.outcomeKey === `team:${abbrev}`);
    if (!outcome) return null;
    const direct = outcome.averageImpliedProbability;
    return direct != null && Number.isFinite(direct) && direct > 0 && direct < 1
      ? direct
      : americanToImpliedProbability(outcome.averagePriceAmerican);
  };
  const team = implied(teamAbbrev);
  const opponent = implied(opponentAbbrev);
  if (team == null || opponent == null) return null;
  const bookSum = team + opponent;
  if (bookSum < MIN_VALID_BOOK_SUM || bookSum > MAX_VALID_BOOK_SUM) return null;
  return devigProportional([team, opponent])?.probabilities[0] ?? null;
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
