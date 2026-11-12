import supabase from "lib/supabase/server";
import { posteriorSavePct } from "./goalie/goalieOutcomes";
import { clamp } from "./utils/number-utils";

function assertSupabase() {
  if (!supabase) throw new Error("Supabase server client not available");
}

/**
 * Opponent-goalie finishing context for skater goals (W1 P0 #21). The predictive feature is the
 * goalie's posterior save % ("goalie_save_quality_posterior"): his own shots against and goals
 * allowed before the cutoff, shrunk toward the season league save % with the goalie model's fitted
 * prior strength (GOALIE_SAVE_PCT_PRIOR_SHOTS, held-out 2025-26). It reads observed history only,
 * never FORGE's modelled goalie line, so it is not circular with the goalie stage. NST GSAA stays a
 * descriptive column (decision 10) and is not read here.
 *
 * Skater goals per shot scale by the mixture's goals allowed per shot over the league's: the
 * candidates are weighted by start probability, unresolved start mass is a league-average goalie
 * (never redistributed to a named goalie), and nothing is clamped before or after mixing.
 * The full pass-through of goalie quality to finishing is a modelling assumption still to be
 * checked on held-out games (decision 27 pattern); the payload labels it so.
 */
export const OPPONENT_GOALIE_QUALITY_VERSION = "forge-opponent-goalie-save-quality-v1";
export const OPPONENT_GOALIE_QUALITY_FEATURE = "goalie_save_quality_posterior";

export type OpponentGoalieCandidateQuality = {
  goalieId: number;
  startProbability: number;
  historyShotsAgainst: number;
  historyGoalsAllowed: number;
};

export type OpponentGoalieFinishingContext = {
  version: typeof OPPONENT_GOALIE_QUALITY_VERSION;
  feature: typeof OPPONENT_GOALIE_QUALITY_FEATURE;
  leagueSavePct: number;
  goalRateMultiplier: number;
  expectedGoalsAllowedPerShot: number;
  resolvedStartMass: number;
  unresolvedStartMass: number;
  startMassNormalized: boolean;
  passThrough: "full_multiplicative_unvalidated";
  candidates: Array<{ goalieId: number; startProbability: number; posteriorSavePct: number; historyShotsAgainst: number }>;
};

export function computeOpponentGoalieFinishingContext(args: {
  candidates: readonly OpponentGoalieCandidateQuality[];
  leagueSavePct: number;
}): OpponentGoalieFinishingContext {
  const league = args.leagueSavePct;
  if (!(league > 0 && league < 1)) throw new Error("Opponent goalie quality needs a league save % in (0, 1)");
  const rows = args.candidates.map((c) => ({ ...c, startProbability: clamp(Number.isFinite(c.startProbability) ? c.startProbability : 0, 0, 1) }));
  const rawMass = rows.reduce((sum, c) => sum + c.startProbability, 0);
  // Start probabilities above one in total are not a distribution; scale to one and say so.
  const scale = rawMass > 1 ? 1 / rawMass : 1;
  const candidates = rows.map((c) => ({
    goalieId: c.goalieId,
    startProbability: c.startProbability * scale,
    posteriorSavePct: posteriorSavePct({ shots: c.historyShotsAgainst, goals: c.historyGoalsAllowed, priorMean: league }),
    historyShotsAgainst: Math.max(0, c.historyShotsAgainst),
  }));
  const resolvedStartMass = candidates.reduce((sum, c) => sum + c.startProbability, 0);
  const unresolvedStartMass = Math.max(0, 1 - resolvedStartMass);
  const expectedGoalsAllowedPerShot = candidates.reduce((sum, c) => sum + c.startProbability * (1 - c.posteriorSavePct), 0)
    + unresolvedStartMass * (1 - league);
  return {
    version: OPPONENT_GOALIE_QUALITY_VERSION,
    feature: OPPONENT_GOALIE_QUALITY_FEATURE,
    leagueSavePct: league,
    goalRateMultiplier: expectedGoalsAllowedPerShot / (1 - league),
    expectedGoalsAllowedPerShot,
    resolvedStartMass,
    unresolvedStartMass,
    startMassNormalized: scale !== 1,
    passThrough: "full_multiplicative_unvalidated",
    candidates,
  };
}

const HISTORY_GAMES = 200;

/**
 * Candidates from the upstream start table (the same rows the goalie stage starts from); a
 * confirmed starter replaces them. History is the goalie's last 200 games before the cutoff in
 * forge_goalie_game, the window the goalie stage's own posterior uses.
 */
export async function fetchOpponentGoalieCandidateQuality(args: {
  gameId: number;
  opponentTeamId: number;
  asOfDate: string;
  confirmedGoalieId?: number;
}): Promise<OpponentGoalieCandidateQuality[]> {
  assertSupabase();
  let weights: Array<{ goalieId: number; startProbability: number }>;
  if (args.confirmedGoalieId != null) {
    weights = [{ goalieId: args.confirmedGoalieId, startProbability: 1 }];
  } else {
    const { data, error } = await supabase
      .from("goalie_start_projections")
      .select("player_id,start_probability")
      .eq("game_id", args.gameId)
      .eq("team_id", args.opponentTeamId)
      .order("start_probability", { ascending: false })
      .limit(3);
    if (error) throw error;
    weights = ((data ?? []) as Array<{ player_id: unknown; start_probability: unknown }>)
      .map((row) => ({ goalieId: Number(row.player_id), startProbability: Number(row.start_probability) }))
      .filter((row) => Number.isSafeInteger(row.goalieId) && row.goalieId > 0 && Number.isFinite(row.startProbability));
  }
  const out: OpponentGoalieCandidateQuality[] = [];
  for (const weight of weights) {
    const { data, error } = await supabase
      .from("forge_goalie_game")
      .select("shots_against,goals_allowed")
      .eq("goalie_id", weight.goalieId)
      .lt("game_date", args.asOfDate)
      .order("game_date", { ascending: false })
      .limit(HISTORY_GAMES);
    if (error) throw error;
    // A game counts only with both values known; a missing count never becomes zero.
    const games = ((data ?? []) as Array<{ shots_against: unknown; goals_allowed: unknown }>)
      .map((row) => ({ shots: Number(row.shots_against), goals: Number(row.goals_allowed) }))
      .filter((row) => row.shots >= 0 && row.goals >= 0 && row.goals <= row.shots
        && Number.isFinite(row.shots) && Number.isFinite(row.goals));
    out.push({
      goalieId: weight.goalieId,
      startProbability: weight.startProbability,
      historyShotsAgainst: games.reduce((sum, row) => sum + row.shots, 0),
      historyGoalsAllowed: games.reduce((sum, row) => sum + row.goals, 0),
    });
  }
  return out;
}
