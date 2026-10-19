export type SeasonGamePoint = {
  gamesPlayed: number;
  conference?: string;
  division?: string;
};

// The regular-season length varies by season (82, 84, 48, 56, ...). When it is
// unknown, return null so callers keep the observed range instead of a guess.
function normalizeSeasonGameCount(
  seasonGameCount: number | null | undefined,
): number | null {
  return typeof seasonGameCount === "number" &&
    Number.isFinite(seasonGameCount) &&
    seasonGameCount > 0
    ? Math.floor(seasonGameCount)
    : null;
}

export function getAvailableSeasonGameRange(
  series: Iterable<ReadonlyArray<SeasonGamePoint>>,
  selectedConference = "All",
  selectedDivision = "All",
  seasonGameCount?: number | null,
): number {
  let maxGames = 0;

  for (const teamData of series) {
    const firstRecord = teamData[0];
    if (!firstRecord) continue;
    if (
      selectedConference !== "All" &&
      firstRecord.conference !== selectedConference
    ) {
      continue;
    }
    if (
      selectedDivision !== "All" &&
      firstRecord.division !== selectedDivision
    ) {
      continue;
    }

    for (const point of teamData) {
      if (Number.isFinite(point.gamesPlayed)) {
        maxGames = Math.max(maxGames, point.gamesPlayed);
      }
    }
  }

  const observedMax = Math.max(0, maxGames);
  const seasonMax = normalizeSeasonGameCount(seasonGameCount);
  return seasonMax === null ? observedMax : Math.min(seasonMax, observedMax);
}

export function buildGameAxisTicks(
  maxGames: number,
  seasonGameCount?: number | null,
): number[] {
  const requestedMax = Math.max(1, Math.floor(maxGames));
  const seasonMax = normalizeSeasonGameCount(seasonGameCount);
  const availableMax =
    seasonMax === null ? requestedMax : Math.min(seasonMax, requestedMax);
  const step = availableMax <= 20 ? 5 : 10;
  const ticks: number[] = [];

  for (let game = 0; game <= availableMax; game += step) {
    ticks.push(game);
  }

  const lastTick = ticks[ticks.length - 1] ?? 0;
  if (lastTick !== availableMax) {
    if (availableMax - lastTick < step * 0.6 && ticks.length > 1) {
      ticks.pop();
    }
    ticks.push(availableMax);
  }

  return ticks;
}
