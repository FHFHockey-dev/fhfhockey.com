import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";

export type SourceAccuracyMode = "total" | "perGame";

export type SourceAccuracyRow = {
  sourceName: string;
  projectionObservations: number;
  matchedActualObservations: number;
  coveragePercent: number;
  meanNormalizedErrorPercent: number | null;
  accuracyScorePercent: number | null;
};

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isRateStat = (key: string, dataType?: string) =>
  dataType === "percentage" ||
  /(?:PER_GAME|PER_60|AVERAGE|PERCENTAGE|_PCT|RATE)/.test(key);

export function calculateSourceAccuracy(
  players: ProcessedPlayer[],
  mode: SourceAccuracyMode
): SourceAccuracyRow[] {
  const buckets = new Map<
    string,
    { projected: number; matched: number; normalizedError: number }
  >();

  for (const player of players) {
    const gamesStat =
      player.combinedStats.GAMES_PLAYED ??
      player.combinedStats.GAMES_GOALIE ??
      player.combinedStats.GAMES_PLAYED_GOALIE;
    const actualGames = gamesStat?.actual;
    const projectedGamesBySource = new Map<string, number>();
    for (const source of gamesStat?.projectedDetail?.contributingSources ?? []) {
      if (finite(source.value) && source.value > 0) {
        projectedGamesBySource.set(source.name, source.value);
      }
    }

    for (const [statKey, stat] of Object.entries(player.combinedStats)) {
      if (statKey === "GAMES_PLAYED" || /GAMES.*GOALIE/.test(statKey)) continue;
      for (const source of stat.projectedDetail?.contributingSources ?? []) {
        if (!finite(source.value)) continue;
        const bucket = buckets.get(source.name) ?? {
          projected: 0,
          matched: 0,
          normalizedError: 0
        };
        bucket.projected += 1;
        if (!finite(stat.actual)) {
          buckets.set(source.name, bucket);
          continue;
        }

        let projected = source.value;
        let actual = stat.actual;
        if (
          mode === "perGame" &&
          !isRateStat(statKey, stat.projectedDetail?.statDefinition?.dataType)
        ) {
          const projectedGames = projectedGamesBySource.get(source.name);
          if (!finite(projectedGames) || projectedGames <= 0 || !finite(actualGames) || actualGames <= 0) {
            buckets.set(source.name, bucket);
            continue;
          }
          projected /= projectedGames;
          actual /= actualGames;
        }

        const denominator = Math.max(Math.abs(actual), 0.01);
        bucket.matched += 1;
        bucket.normalizedError += Math.abs(projected - actual) / denominator;
        buckets.set(source.name, bucket);
      }
    }
  }

  return Array.from(buckets, ([sourceName, bucket]) => {
    const meanError = bucket.matched
      ? (bucket.normalizedError / bucket.matched) * 100
      : null;
    return {
      sourceName,
      projectionObservations: bucket.projected,
      matchedActualObservations: bucket.matched,
      coveragePercent: bucket.projected
        ? (bucket.matched / bucket.projected) * 100
        : 0,
      meanNormalizedErrorPercent: meanError,
      accuracyScorePercent:
        meanError == null ? null : Math.max(0, Math.min(100, 100 - meanError))
    };
  }).sort(
    (left, right) =>
      (right.accuracyScorePercent ?? -1) - (left.accuracyScorePercent ?? -1) ||
      right.coveragePercent - left.coveragePercent ||
      left.sourceName.localeCompare(right.sourceName)
  );
}
