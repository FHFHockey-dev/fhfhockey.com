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

type UnderlyingTimelineRow = {
  date: string;
  xgf: number | null;
  xga: number | null;
};

export function buildMetricsTimelineRows(args: {
  wgoRows: readonly WgoTimelineRow[];
  underlyingRows: readonly UnderlyingTimelineRow[];
}): MetricsTimelinePoint[] {
  const underlyingByDate = new Map(
    args.underlyingRows.map((row) => [row.date.slice(0, 10), row])
  );

  return args.wgoRows
    .map((row) => {
      const dateKey = row.date.slice(0, 10);
      const underlying = underlyingByDate.get(dateKey);
      const points = row.points ?? null;
      const gamesPlayed = row.games_played ?? null;

      return {
        date: dateKey,
        label: dateKey.slice(5),
        pointPct:
          points != null && gamesPlayed != null && gamesPlayed > 0
            ? points / (gamesPlayed * 2)
            : null,
        goalsForPerGame: row.goals_for_per_game ?? null,
        goalsAgainstPerGame: row.goals_against_per_game ?? null,
        powerPlayPct: row.power_play_pct ?? null,
        shotsForPerGame: row.shots_for_per_game ?? null,
        xgf: underlying?.xgf ?? null,
        xga: underlying?.xga ?? null,
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
