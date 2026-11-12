type RankableProjection = {
  playerId: string | number;
  displayPosition?: string | null;
  fantasyPoints?: { projected?: number | null } | null;
};

export type SourceRankImpact = {
  previousRank: number;
  currentRank: number;
  delta: number;
};

export function rankProjectionPlayers(players: RankableProjection[]) {
  const groups = new Map<"skater" | "goalie", RankableProjection[]>([
    ["skater", []],
    ["goalie", []]
  ]);
  for (const player of players) {
    const score = player.fantasyPoints?.projected;
    if (typeof score !== "number" || !Number.isFinite(score)) continue;
    groups.get(player.displayPosition === "G" ? "goalie" : "skater")!.push(player);
  }

  // Competition ranks (1, 2, 2, 4): tied projections share a rank, so the
  // result never depends on input order or player id (rule 20).
  const ranks: Record<string, number> = {};
  for (const group of groups.values()) {
    const sorted = [...group].sort(
      (a, b) => b.fantasyPoints!.projected! - a.fantasyPoints!.projected!
    );
    sorted.forEach((player, index) => {
      const previous = sorted[index - 1];
      ranks[String(player.playerId)] =
        previous &&
        previous.fantasyPoints!.projected === player.fantasyPoints!.projected
          ? ranks[String(previous.playerId)]
          : index + 1;
    });
  }
  return ranks;
}

export function calculateSourceRankImpacts(
  previous: Record<string, number>,
  current: Record<string, number>,
  materialRankDelta = 3
): Record<string, SourceRankImpact> {
  const impacts: Record<string, SourceRankImpact> = {};
  for (const [playerId, currentRank] of Object.entries(current)) {
    const previousRank = previous[playerId];
    if (!previousRank) continue;
    const delta = previousRank - currentRank;
    if (Math.abs(delta) < materialRankDelta) continue;
    impacts[playerId] = { previousRank, currentRank, delta };
  }
  return impacts;
}
