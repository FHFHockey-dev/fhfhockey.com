import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";

function diffPercentage(actual: number | null, projected: number | null) {
  if (actual == null || projected == null) return null;
  if (projected === 0) {
    if (actual === 0) return 0;
    return actual > 0 ? 99999 : -99999;
  }
  return ((actual - projected) / projected) * 100;
}

export function recalculateFantasyPoints(
  players: ProcessedPlayer[],
  pointValues: Record<string, number>
): ProcessedPlayer[] {
  return players.map((player) => {
    let projected = 0;
    let actual = 0;
    let hasProjected = false;
    let hasActual = false;
    for (const [statKey, stat] of Object.entries(player.combinedStats)) {
      const pointValue = pointValues[statKey];
      if (typeof pointValue !== "number" || pointValue === 0) continue;
      if (typeof stat?.projected === "number" && Number.isFinite(stat.projected)) {
        projected += stat.projected * pointValue;
        hasProjected = true;
      }
      if (typeof stat?.actual === "number" && Number.isFinite(stat.actual)) {
        actual += stat.actual * pointValue;
        hasActual = true;
      }
    }
    const projectedValue = hasProjected ? projected : null;
    const actualValue = hasActual ? actual : null;
    const projectedGames = player.combinedStats.GAMES_PLAYED?.projected;
    const actualGames = player.combinedStats.GAMES_PLAYED?.actual;
    return {
      ...player,
      fantasyPoints: {
        projected: projectedValue,
        actual: actualValue,
        diffPercentage: diffPercentage(actualValue, projectedValue),
        projectedPerGame:
          projectedValue != null &&
          typeof projectedGames === "number" &&
          projectedGames > 0
            ? projectedValue / projectedGames
            : null,
        actualPerGame:
          actualValue != null &&
          typeof actualGames === "number" &&
          actualGames > 0
            ? actualValue / actualGames
            : null
      }
    };
  });
}
