// One manpower / net-state and score-state predicate for every underlying-stats
// reader (decisions 11, 70; W2-P0-2, W2-P0-5). Built on L1's helpers, so no
// reader re-parses the away-first `strength_exact` string or a goal-only score.
import {
  matchesScoreState,
  type ScoreStateFilter,
} from "lib/supabase/Upserts/nhlScoreState";
import type { TeamManpowerContext } from "lib/supabase/Upserts/nhlStrengthState";

import type { PlayerStatsScoreState, PlayerStatsStrength } from "./playerStatsTypes";

const isExactWithBothGoalies = (
  context: TeamManpowerContext,
  teamSkaters: number,
  opponentSkaters: number
) =>
  !context.ownNetEmpty &&
  !context.opponentNetEmpty &&
  context.teamSkaters === teamSkaters &&
  context.opponentSkaters === opponentSkaters;

/**
 * Does a team-oriented manpower context fall in a strength split?
 * - Even strength / PP / PK follow the penalty advantage (decision 70): 4v4 and
 *   3v3 are ES, 6v5 with no penalty is ES, 6v4 is PP.
 * - 5v5, 5v4 PP, 4v5 PK and 3v3 are exact on-ice counts with both goalies in.
 * - With / against empty net are overlapping attributes (own net empty /
 *   attacking an empty net), never their own exclusive bucket.
 * - An unknown context (or a penalty shot) only counts toward all strengths.
 */
export function matchesUnderlyingStrength(
  strength: PlayerStatsStrength,
  context: TeamManpowerContext | null
): boolean {
  if (strength === "allStrengths") return true;
  if (context == null || context.manpowerState == null) return false;

  switch (strength) {
    case "evenStrength":
      return context.manpowerState === "ES";
    case "powerPlay":
      return context.manpowerState === "PP";
    case "penaltyKill":
      return context.manpowerState === "PK";
    case "fiveOnFive":
      return context.manpowerState === "ES" && isExactWithBothGoalies(context, 5, 5);
    case "fiveOnFourPP":
      return context.manpowerState === "PP" && isExactWithBothGoalies(context, 5, 4);
    case "fourOnFivePK":
      return context.manpowerState === "PK" && isExactWithBothGoalies(context, 4, 5);
    case "threeOnThree":
      return context.manpowerState === "ES" && isExactWithBothGoalies(context, 3, 3);
    case "withEmptyNet":
      return context.ownNetEmpty;
    case "againstEmptyNet":
      return context.opponentNetEmpty;
  }
}

/** Decision 11 score states over a team-relative goal differential (null = unknown). */
export function matchesUnderlyingScoreState(
  scoreState: PlayerStatsScoreState,
  teamScoreDiff: number | null
): boolean {
  return matchesScoreState(scoreState satisfies ScoreStateFilter, teamScoreDiff);
}
