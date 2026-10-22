export type MetricsTimelineMetricKey =
  | "pointPct"
  | "goalsForPerGame"
  | "goalsAgainstPerGame"
  | "powerPlayPct"
  | "shotsForPerGame"
  | "xgf"
  | "xga";

export type MetricsTimelinePoint = {
  date: string;
  label: string;
  wgoGamesPlayed: number | null;
  xgGameId: number | null;
  pointPct: number | null;
  goalsForPerGame: number | null;
  goalsAgainstPerGame: number | null;
  powerPlayPct: number | null;
  shotsForPerGame: number | null;
  xgf: number | null;
  xga: number | null;
};

type WgoTimelineRow = {
  date: string;
  points: number | null;
  games_played: number | null;
  goals_for_per_game: number | null;
  goals_against_per_game: number | null;
  power_play_pct: number | null;
  shots_for_per_game: number | null;
};

type XgTimelineRow = {
  game_date: string | null;
  game_id: number | null;
  source_model_approved: boolean | null;
  source_prediction_type: string | null;
  xg_for: number | null;
  xg_against: number | null;
};

export function buildMetricsTimelineRows(args: {
  wgoRows: readonly WgoTimelineRow[];
  xgRows: readonly XgTimelineRow[];
}): MetricsTimelinePoint[] {
  const wgoByDate = new Map(
    args.wgoRows.map((row) => [row.date.slice(0, 10), row])
  );
  const xgByDate = new Map<string, XgTimelineRow | null>();
  for (const row of args.xgRows) {
    // The aggregate writer admits approved shot-goal predictions only. Keep
    // that provenance at the adapter boundary even when query filtering changes.
    if (
      row.source_model_approved !== true || row.source_prediction_type !== "shot_goal" ||
      !row.game_date || !Number.isSafeInteger(row.game_id) || (row.game_id ?? 0) <= 0
    ) continue;
    const date = row.game_date.slice(0, 10);
    if (!xgByDate.has(date)) {
      // Query order prefers the newest feature version/update of the same game.
      xgByDate.set(date, row);
    } else if (xgByDate.get(date)?.game_id !== row.game_id) {
      // A daily slot cannot represent two different per-game totals.
      xgByDate.set(date, null);
    }
  }

  const xgValue = (value: number | null | undefined) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;

  return Array.from(new Set([...wgoByDate.keys(), ...xgByDate.keys()]))
    .map((dateKey) => {
      const row = wgoByDate.get(dateKey);
      const xg = xgByDate.get(dateKey);
      const points = row?.points ?? null;
      const gamesPlayed = row?.games_played ?? null;

      return {
        date: dateKey,
        label: dateKey.slice(5),
        wgoGamesPlayed: gamesPlayed,
        xgGameId: xg?.game_id ?? null,
        pointPct:
          points != null && gamesPlayed != null && gamesPlayed > 0
            ? points / (gamesPlayed * 2)
            : null,
        goalsForPerGame: row?.goals_for_per_game ?? null,
        goalsAgainstPerGame: row?.goals_against_per_game ?? null,
        powerPlayPct: row?.power_play_pct ?? null,
        shotsForPerGame: row?.shots_for_per_game ?? null,
        xgf: xgValue(xg?.xg_for),
        xga: xgValue(xg?.xg_against),
      } satisfies MetricsTimelinePoint;
    })
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function calculateTimelineDelta(args: {
  rows: readonly MetricsTimelinePoint[];
  metric: MetricsTimelineMetricKey;
  lookback?: number;
}) {
  const lookback = args.lookback ?? 5;
  const rowsWithMetric = args.rows.filter(
    (row) => typeof row[args.metric] === "number"
  );
  const latest = rowsWithMetric.at(-1)?.[args.metric] as number | undefined;
  const comparison =
    rowsWithMetric.length > lookback
      ? (rowsWithMetric.at(-(lookback + 1))?.[args.metric] as number | undefined)
      : undefined;

  if (latest == null || comparison == null) {
    return null;
  }

  return Number((latest - comparison).toFixed(3));
}
