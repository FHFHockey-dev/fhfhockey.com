import { computeProratedFantasyPoints } from "lib/projectionsConfig/proration";
import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import type { UseVORPParams } from "hooks/useVORPCalculations";
import { groupPlayerEligibility, normalizePlayerEligibility } from "./forwardGrouping";
import { calculateCategoryScores } from "lib/scoring/categoryScores";

/** Shared league-wide values; no availability or personalized replacement inputs. */
export function buildPlayerValues({ players, draftSettings, leagueType = "points", categoryWeights = {}, forwardGrouping = "split", prorate84 = false, fantasyPointSettings = {} }: Pick<UseVORPParams, "players" | "draftSettings" | "leagueType" | "categoryWeights" | "forwardGrouping" | "prorate84" | "fantasyPointSettings">) {
  // Value per player (points or categories composite)
  const values = new Map<string, number>();
  const eligibility = new Map<string, string[]>();
  const includeGenericForward =
    forwardGrouping === "split" &&
    (draftSettings.rosterConfig.FWD ?? 0) > 0;

  players.forEach((p) => {
    const id = String(p.playerId);
    const parsed = normalizePlayerEligibility(
      p.displayPosition,
      Array.isArray(p.eligiblePositions) ? p.eligiblePositions : undefined,
    );
    const elig = groupPlayerEligibility(
      parsed,
      forwardGrouping,
      includeGenericForward,
    );
    eligibility.set(id, elig);
  });

  // Compute player comparable values
  if (leagueType === "points") {
    // Points leagues: optionally recompute fantasy points using an 84G pace for skaters.
    players.forEach((p) => {
      const id = String(p.playerId);
      let val = p.fantasyPoints?.projected ?? 0;
      if (prorate84 && !eligibility.get(id)?.includes("G")) {
        const fp = computeProratedFantasyPoints(p, true, fantasyPointSettings);
        if (fp != null && Number.isFinite(fp)) val = fp;
      }
      values.set(id, Number.isFinite(val) ? val : 0);
    });
  } else {
    const categoryPlayers = players.map((player) => {
      const combinedStats = (player.combinedStats || {}) as Record<
        string,
        { projected?: unknown }
      >;
      const projectedValues = Object.fromEntries(
        Object.entries(combinedStats).flatMap(([key, stat]) =>
          typeof stat?.projected === "number" && Number.isFinite(stat.projected)
            ? [[key, stat.projected]]
            : [],
        ),
      );
      if (projectedValues.SHOTS_AGAINST_GOALIE == null) {
        const saves = projectedValues.SAVES_GOALIE;
        const goalsAgainst = projectedValues.GOALS_AGAINST_GOALIE;
        if (Number.isFinite(saves) && Number.isFinite(goalsAgainst)) {
          projectedValues.SHOTS_AGAINST_GOALIE = saves + goalsAgainst;
        }
      }
      if (projectedValues.GAMES_STARTED == null) {
        for (const key of [
          "STARTS_GOALIE",
          "GAMES_STARTED_GOALIE",
          "GAMES_GOALIE",
          "GAMES_PLAYED_GOALIE",
          "GP_GOALIE",
        ]) {
          if (Number.isFinite(projectedValues[key])) {
            projectedValues.GAMES_STARTED = projectedValues[key];
            break;
          }
        }
      }
      return {
        id: String(player.playerId),
        role: eligibility.get(String(player.playerId))?.includes("G")
          ? ("goalie" as const)
          : ("skater" as const),
        values: projectedValues,
      };
    });
    calculateCategoryScores(categoryPlayers, categoryWeights).forEach(
      (score, playerId) => values.set(playerId, score),
    );
  }

  return { values, eligibility };
}
