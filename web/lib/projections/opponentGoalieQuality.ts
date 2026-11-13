import supabase from "lib/supabase/server";
import { posteriorSavePct } from "./goalie/goalieOutcomes";
import { clamp } from "./utils/number-utils";

function assertSupabase() {
  if (!supabase) throw new Error("Supabase server client not available");
}

/**
 * Opponent-goalie finishing context for skater goals (W1 P0 #21). The context feature is the
 * goalie's posterior save % ("goalie_save_quality_posterior"): his own shots against and goals
 * allowed before the cutoff, shrunk toward the season league save % with the goalie model's fitted
 * prior strength (GOALIE_SAVE_PCT_PRIOR_SHOTS, held-out 2025-26). It reads observed history only,
 * never FORGE's modelled goalie line, so it is not circular with the goalie stage. NST GSAA stays a
 * descriptive column (decision 10) and is not read here.
 *
 * Decision 148 (Astra AF-06): neutral until validated. FORGE applies no opponent-goalie goal or
 * assist multiplier (factor 1.0). The mixture below is labelled context only: candidates weighted
 * by start probability, unresolved start mass a league-average goalie (never redistributed to a
 * named goalie), nothing clamped. Serving it as a finishing multiplier first needs a held-out,
 * time-ordered study of the final skater output (Codex goalie model work); W1 #21 stays partly fixed.
 */
export const OPPONENT_GOALIE_QUALITY_VERSION = "forge-opponent-goalie-save-quality-v2";
export const OPPONENT_GOALIE_QUALITY_FEATURE = "goalie_save_quality_posterior";
export const OPPONENT_GOALIE_ADJUSTMENT = "neutral_unvalidated";

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
  expectedGoalsAllowedPerShot: number;
  resolvedStartMass: number;
  unresolvedStartMass: number;
  startMassNormalized: boolean;
  adjustment: typeof OPPONENT_GOALIE_ADJUSTMENT;
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
    expectedGoalsAllowedPerShot,
    resolvedStartMass,
    unresolvedStartMass,
    startMassNormalized: scale !== 1,
    adjustment: OPPONENT_GOALIE_ADJUSTMENT,
    candidates,
  };
}

const HISTORY_GAMES = 200;

/** A known count is a non-negative integer; null, undefined, empty or non-numeric input is unknown, never zero. */
function knownCount(value: unknown): number | null {
  const parsed = typeof value === "number" ? value
    : typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

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
    // An unknown start probability drops the row before conversion; null never becomes a 0 start.
    weights = ((data ?? []) as Array<{ player_id: unknown; start_probability: unknown }>)
      .filter((row) => (typeof row.start_probability === "number" || typeof row.start_probability === "string")
        && String(row.start_probability).trim() !== "")
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
    // A game counts only when both counts are known integers with goals <= shots (Astra AF-02):
    // an unknown count drops the game; it never becomes a zero (a null goals row is not a shutout).
    const games = ((data ?? []) as Array<{ shots_against: unknown; goals_allowed: unknown }>)
      .flatMap((row) => {
        const shots = knownCount(row.shots_against);
        const goals = knownCount(row.goals_allowed);
        return shots != null && goals != null && goals <= shots ? [{ shots, goals }] : [];
      });
    out.push({
      goalieId: weight.goalieId,
      startProbability: weight.startProbability,
      historyShotsAgainst: games.reduce((sum, row) => sum + row.shots, 0),
      historyGoalsAllowed: games.reduce((sum, row) => sum + row.goals, 0),
    });
  }
  return out;
}
