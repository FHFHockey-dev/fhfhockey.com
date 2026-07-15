type VisibleProjection = {
  playerId: string | number;
  fullName: string;
  displayTeam?: string | null;
  displayPosition?: string | null;
  eligiblePositions?: string[];
  yahooAvgPick?: number | null;
};

export function getProjectionDisplayPosition(
  player: VisibleProjection,
  forwardGrouping: "split" | "fwd"
) {
  const rawTokens = (player.displayPosition || "")
    .toUpperCase()
    .split(",")
    .map((position) => position.trim())
    .filter(Boolean);
  const eligibleTokens = Array.isArray(player.eligiblePositions)
    ? player.eligiblePositions.map((position) => position.toUpperCase().trim()).filter(Boolean)
    : [];
  const tokens = eligibleTokens.length ? eligibleTokens : rawTokens;
  if (forwardGrouping !== "fwd") return tokens.join(", ");
  if (tokens.includes("G")) return "G";
  if (tokens.includes("D")) return "D";
  if (
    tokens.some((position) => ["C", "LW", "RW", "F", "FWD"].includes(position))
  ) {
    return "FWD";
  }
  return tokens.join(", ");
}

export function matchesProjectionPosition(
  player: VisibleProjection,
  positionFilter: string,
  forwardGrouping: "split" | "fwd"
) {
  if (positionFilter === "ALL") return true;
  const tokens = getProjectionDisplayPosition(player, forwardGrouping)
    .toUpperCase()
    .split(",")
    .map((position) => position.trim())
    .filter(Boolean);
  const isGoalie = tokens.includes("G");
  const isDefense = tokens.includes("D");
  const isForward = tokens.some((position) =>
    ["C", "LW", "RW", "F", "FWD"].includes(position)
  );
  if (positionFilter === "G") return isGoalie;
  if (positionFilter === "SKATER") return !isGoalie && (isDefense || isForward);
  if (positionFilter === "FORWARDS") return !isGoalie && isForward;
  return tokens.includes(positionFilter.toUpperCase());
}

export function matchesProjectionSearch(
  player: VisibleProjection,
  searchTerm: string
) {
  const query = searchTerm.trim().toLowerCase();
  if (!query) return true;
  return (
    player.fullName.toLowerCase().includes(query) ||
    (player.displayTeam || "").toLowerCase().includes(query)
  );
}

export function diagnoseProjectionVisibility({
  players,
  positionFilter,
  forwardGrouping,
  searchTerm,
  hideDrafted,
  draftedIds,
  favoritesOnly,
  favoriteIds
}: {
  players: VisibleProjection[];
  positionFilter: string;
  forwardGrouping: "split" | "fwd";
  searchTerm: string;
  hideDrafted: boolean;
  draftedIds: ReadonlySet<string>;
  favoritesOnly: boolean;
  favoriteIds: ReadonlySet<string>;
}) {
  const reasons: Record<string, number> = {};
  let shown = 0;
  const exclude = (reason: string) => {
    reasons[reason] = (reasons[reason] || 0) + 1;
  };
  for (const player of players) {
    if (!matchesProjectionPosition(player, positionFilter, forwardGrouping)) {
      exclude("positionFilter");
      continue;
    }
    if (!matchesProjectionSearch(player, searchTerm)) {
      exclude("searchFilter");
      continue;
    }
    if (hideDrafted && draftedIds.has(String(player.playerId))) {
      exclude("hideDrafted");
      continue;
    }
    if (favoritesOnly && !favoriteIds.has(String(player.playerId))) {
      exclude("favoritesOnly");
      continue;
    }
    shown += 1;
  }
  return {
    total: players.length,
    shown,
    excluded: players.length - shown,
    reasons
  };
}
