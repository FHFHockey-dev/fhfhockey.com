export type TeamNumeric = { teamId: number; value: number };

/** Equal values share competition ranks; the two color bands never overlap. */
export function toRankMaps(entries: TeamNumeric[], bestDirection: "asc" | "desc") {
  const sorted = entries.filter(({ value }) => Number.isFinite(value)).sort((a, b) =>
    bestDirection === "asc" ? a.value - b.value : b.value - a.value
  );
  const best = new Map<number, number>();
  const worst = new Map<number, number>();
  const band = Math.min(10, Math.floor(sorted.length / 2));

  for (let first = 0; first < sorted.length;) {
    let last = first + 1;
    while (last < sorted.length && sorted[last].value === sorted[first].value) last++;
    const bestRank = first + 1;
    const worstRank = sorted.length - last + 1;
    sorted.slice(first, last).forEach(({ teamId }) => {
      if (bestRank <= band && worstRank > band) best.set(teamId, bestRank);
      if (worstRank <= band && bestRank > band) worst.set(teamId, worstRank);
    });
    first = last;
  }
  return { best, worst };
}
