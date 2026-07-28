export type SeasonGamePoint = {
  gamesPlayed: number;
  conference?: string;
  division?: string;
};

export function getAvailableSeasonGameRange(
  series: Iterable<ReadonlyArray<SeasonGamePoint>>,
  selectedConference = "All",
  selectedDivision = "All",
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

  return Math.min(82, Math.max(0, maxGames));
}

export function buildGameAxisTicks(maxGames: number): number[] {
  const availableMax = Math.min(82, Math.max(1, Math.floor(maxGames)));
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
