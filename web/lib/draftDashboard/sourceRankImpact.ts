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

  const ranks: Record<string, number> = {};
  for (const group of groups.values()) {
    group
      .sort(
        (a, b) =>
          b.fantasyPoints!.projected! - a.fantasyPoints!.projected! ||
          String(a.playerId).localeCompare(String(b.playerId))
      )
      .forEach((player, index) => {
        ranks[String(player.playerId)] = index + 1;
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
