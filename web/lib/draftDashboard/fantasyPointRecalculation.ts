import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";

export function pointValueForPlayerStat(
  player: Pick<ProcessedPlayer, "displayPosition">,
  statKey: string,
  pointValues: Record<string, number>,
): number | undefined {
  if (
    (statKey === "HITS" || statKey === "BLOCKED_SHOTS") &&
    player.displayPosition?.toUpperCase().split(/[,/]/).some((position) => position.trim() === "D")
  ) {
    return pointValues[`${statKey}_D`] ?? pointValues[statKey];
  }
  return pointValues[statKey];
}

function diffPercentage(actual: number | null, projected: number | null) {
  if (actual == null || projected == null) return null;
  if (projected === 0) {
    if (actual === 0) return 0;
    return actual > 0 ? 99999 : -99999;
  }
  return ((actual - projected) / projected) * 100;
}

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * Stats that are already rates (per game, per shot, per 60), so a
 * season-to-date value compares directly with the projected rate.
 */
const RATE_STAT_KEYS = new Set([
  "SHOOTING_PERCENTAGE",
  "FACEOFF_PERCENTAGE",
  "SAVE_PERCENTAGE",
  "GOALS_AGAINST_AVERAGE",
  "TIME_ON_ICE_PER_GAME",
]);

/**
 * Like-for-like difference (%) between a season-to-date actual and a
 * full-season projection (M-DRF-010). Counting stats compare the actual with
 * the projection pro-rated to the games actually played, which equals the
 * per-game difference; rate stats compare directly. Games played itself has
 * no like-for-like difference before the season ends. Unknown or zero games
 * leave the difference unknown, never 0.
 */
export function likeForLikeStatDiff(
  statKey: string,
  actual: number | null | undefined,
  projected: number | null | undefined,
  actualGames: number | null | undefined,
  projectedGames: number | null | undefined,
): number | null {
  if (statKey === "GAMES_PLAYED") return null;
  if (!finite(actual) || !finite(projected)) return null;
  if (RATE_STAT_KEYS.has(statKey)) return diffPercentage(actual, projected);
  if (!finite(actualGames) || actualGames <= 0) return null;
  if (!finite(projectedGames) || projectedGames <= 0) return null;
  return diffPercentage(actual, (projected * actualGames) / projectedGames);
}

type CombinedStats = ProcessedPlayer["combinedStats"];

/** Replace every per-stat difference with its like-for-like value. */
export function applyLikeForLikeStatDiffs(combinedStats: CombinedStats): void {
  const actualGames = combinedStats.GAMES_PLAYED?.actual;
  const projectedGames = combinedStats.GAMES_PLAYED?.projected;
  for (const [statKey, stat] of Object.entries(combinedStats)) {
    if (!stat) continue;
    stat.diffPercentage = likeForLikeStatDiff(
      statKey,
      stat.actual,
      stat.projected,
      actualGames,
      projectedGames,
    );
  }
}

/**
 * Fantasy points from combined stats. Projected and actual are summed
 * separately, so an unknown side stays unknown. The difference is per game
 * (actual season-to-date FP/G against projected FP/G), which equals the
 * season-to-date total against the projection pro-rated to games played.
 */
export function computeFantasyPoints(
  player: Pick<ProcessedPlayer, "displayPosition" | "combinedStats">,
  pointValues: Record<string, number>,
): ProcessedPlayer["fantasyPoints"] {
  let projected = 0;
  let actual = 0;
  let hasProjected = false;
  let hasActual = false;
  for (const [statKey, stat] of Object.entries(player.combinedStats)) {
    const pointValue = pointValueForPlayerStat(player, statKey, pointValues);
    if (typeof pointValue !== "number" || pointValue === 0) continue;
    if (finite(stat?.projected)) {
      projected += stat.projected * pointValue;
      hasProjected = true;
    }
    if (finite(stat?.actual)) {
      actual += stat.actual * pointValue;
      hasActual = true;
    }
  }
  const projectedValue = hasProjected ? projected : null;
  const actualValue = hasActual ? actual : null;
  const projectedGames = player.combinedStats.GAMES_PLAYED?.projected;
  const actualGames = player.combinedStats.GAMES_PLAYED?.actual;
  const projectedPerGame =
    projectedValue != null && finite(projectedGames) && projectedGames > 0
      ? projectedValue / projectedGames
      : null;
  const actualPerGame =
    actualValue != null && finite(actualGames) && actualGames > 0
      ? actualValue / actualGames
      : null;
  return {
    projected: projectedValue,
    actual: actualValue,
    diffPercentage: diffPercentage(actualPerGame, projectedPerGame),
    projectedPerGame,
    actualPerGame,
  };
}

/**
 * True when every stat the league scores (and the player carries) is known on
 * that side, so the fantasy-point total is not a partial subtotal.
 */
export function fantasyPointsComplete(
  player: Pick<ProcessedPlayer, "displayPosition" | "combinedStats" | "fantasyPoints">,
  pointValues: Record<string, number>,
  side: "projected" | "actual",
): boolean {
  if (!finite(player.fantasyPoints?.[side])) return false;
  for (const [statKey, stat] of Object.entries(player.combinedStats)) {
    const pointValue = pointValueForPlayerStat(player, statKey, pointValues);
    if (typeof pointValue !== "number" || pointValue === 0) continue;
    if (!finite(stat?.[side])) return false;
  }
  return true;
}

export function recalculateFantasyPoints(
  players: ProcessedPlayer[],
  pointValues: Record<string, number>
): ProcessedPlayer[] {
  return players.map((player) => ({
    ...player,
    fantasyPoints: computeFantasyPoints(player, pointValues),
  }));
}
