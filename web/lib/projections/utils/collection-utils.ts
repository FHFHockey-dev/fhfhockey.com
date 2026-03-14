export function pickLatestByPlayer<T extends { player_id: number; game_date: string }>(
  rows: T[]
): Map<number, T> {
  const byPlayer = new Map<number, T>();
  for (const row of rows) {
    const existing = byPlayer.get(row.player_id);
    if (!existing || row.game_date > existing.game_date) {
      byPlayer.set(row.player_id, row);
    }
  }
  return byPlayer;
}

export function toFiniteNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => Number(entry))
    .filter((n) => Number.isFinite(n));
}
