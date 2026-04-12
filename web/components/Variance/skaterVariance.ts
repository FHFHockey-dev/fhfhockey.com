export interface SkaterVarianceGameRow {
  player_id: number | null;
  player_name: string | null;
  team_abbrev?: string | null;
  current_team_abbreviation?: string | null;
  position_code?: string | null;
  date: string | null;
  games_played?: number | null;
  points?: number | null;
  goals?: number | null;
  assists?: number | null;
  shots?: number | null;
  toi_per_game?: number | null;
}

export interface SkaterVarianceRow {
  playerId: number;
  playerName: string;
  team: string;
  position: string;
  gamesPlayed: number;
  productionProxy: number;
  goals: number;
  assists: number;
  shots: number;
  toiPerGame: number | null;
  gameVolatility: number | null;
}

const finiteOrZero = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const standardDeviation = (values: number[]) => {
  if (values.length < 2) {
    return null;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    values.length;

  return Math.sqrt(variance);
};

export const calculateSkaterProductionProxy = (row: SkaterVarianceGameRow) =>
  finiteOrZero(row.points) + finiteOrZero(row.shots) * 0.1;

export const buildSkaterVarianceRows = (
  rows: SkaterVarianceGameRow[]
): SkaterVarianceRow[] => {
  const byPlayerId = new Map<number, SkaterVarianceGameRow[]>();

  rows.forEach((row) => {
    if (typeof row.player_id !== "number" || !Number.isFinite(row.player_id)) {
      return;
    }

    const playerRows = byPlayerId.get(row.player_id) ?? [];
    playerRows.push(row);
    byPlayerId.set(row.player_id, playerRows);
  });

  return Array.from(byPlayerId.entries())
    .map(([playerId, playerRows]) => {
      const sortedRows = [...playerRows].sort((a, b) =>
        String(a.date ?? "").localeCompare(String(b.date ?? ""))
      );
      const latestRow = sortedRows.at(-1) ?? null;
      const gamesPlayed = playerRows.reduce(
        (sum, row) =>
          sum +
          (typeof row.games_played === "number" &&
          Number.isFinite(row.games_played)
            ? row.games_played
            : 1),
        0
      );
      const totalToi = playerRows.reduce(
        (sum, row) => sum + finiteOrZero(row.toi_per_game),
        0
      );
      const productionValues = playerRows.map(calculateSkaterProductionProxy);

      return {
        playerId,
        playerName:
          typeof latestRow?.player_name === "string"
            ? latestRow.player_name
            : "Unknown Skater",
        team:
          latestRow?.team_abbrev ??
          latestRow?.current_team_abbreviation ??
          "N/A",
        position: latestRow?.position_code ?? "N/A",
        gamesPlayed,
        productionProxy: productionValues.reduce(
          (sum, value) => sum + value,
          0
        ),
        goals: playerRows.reduce(
          (sum, row) => sum + finiteOrZero(row.goals),
          0
        ),
        assists: playerRows.reduce(
          (sum, row) => sum + finiteOrZero(row.assists),
          0
        ),
        shots: playerRows.reduce(
          (sum, row) => sum + finiteOrZero(row.shots),
          0
        ),
        toiPerGame: gamesPlayed > 0 ? totalToi / gamesPlayed : null,
        gameVolatility: standardDeviation(productionValues)
      };
    })
    .sort((a, b) => b.productionProxy - a.productionProxy);
};
