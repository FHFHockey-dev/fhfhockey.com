/** Exact rectangular maximum-weight matching with an independent empty choice for each slot. */
export function weightedAssignment<Slot, Player>(
  slots: readonly Slot[],
  players: readonly Player[],
  weight: (slot: Slot, player: Player) => number | null,
): Array<{ slotIndex: number; playerIndex: number | null }> {
  const n = slots.length, m = players.length + n;
  const u = Array<number>(n + 1).fill(0), v = Array<number>(m + 1).fill(0);
  const p = Array<number>(m + 1).fill(0), way = Array<number>(m + 1).fill(0);
  const values = slots.map(slot => players.map(player => weight(slot, player)));
  const cost = (row: number, col: number) => {
    if (col > players.length) return 0;
    const value = values[row - 1][col - 1];
    return value === null || !Number.isFinite(value) ? 1e12 : -value;
  };
  for (let row = 1; row <= n; row++) {
    p[0] = row;
    let col = 0;
    const min = Array<number>(m + 1).fill(Infinity), used = Array<boolean>(m + 1).fill(false);
    do {
      used[col] = true;
      const current = p[col];
      let delta = Infinity, next = 0;
      for (let j = 1; j <= m; j++) if (!used[j]) {
        const reduced = cost(current, j) - u[current] - v[j];
        if (reduced < min[j]) { min[j] = reduced; way[j] = col; }
        if (min[j] < delta) { delta = min[j]; next = j; }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
        else min[j] -= delta;
      }
      col = next;
    } while (p[col] !== 0);
    do { const previous = way[col]; p[col] = p[previous]; col = previous; } while (col !== 0);
  }
  const result = slots.map((_, slotIndex) => ({ slotIndex, playerIndex: null as number | null }));
  for (let col = 1; col <= players.length; col++) if (p[col] && values[p[col] - 1][col - 1] !== null) {
    result[p[col] - 1].playerIndex = col - 1;
  }
  return result;
}
