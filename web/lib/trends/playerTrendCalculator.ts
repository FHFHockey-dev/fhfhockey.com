import type { Database } from "lib/supabase/database-generated.types";

type SkaterStatsRow =
  Database["public"]["Views"]["player_stats_unified"]["Row"];
type GoalieStatsRow =
  Database["public"]["Views"]["goalie_stats_unified"]["Row"];
type TrendSourceRow = SkaterStatsRow | GoalieStatsRow;


type MetricType = "skater" | "goalie";

type NumberOrNull = number | null;

type BaseTrendMetricDefinition<
  TRow extends TrendSourceRow,
  TMetricType extends MetricType
> = {
  key: string;
  label: string;
  metricType: TMetricType;
  sources: string[];
  accessor: (row: TRow) => NumberOrNull;
};

type SkaterTrendMetricDefinition = BaseTrendMetricDefinition<
  SkaterStatsRow,
  "skater"
>;

type GoalieTrendMetricDefinition = BaseTrendMetricDefinition<
  GoalieStatsRow,
  "goalie"
>;

export type TrendMetricDefinition =
  | SkaterTrendMetricDefinition
  | GoalieTrendMetricDefinition;

interface MetricAccumulator {
  count: number;
  sum: number;
  sumSquares: number;
  window3: number[];
  window5: number[];
  window10: number[];
}

export interface TrendRecord {
  player_id: number;
  season_id: number | null;
  game_date: string;
  position_code: string | null;
  metric_type: MetricType;
  metric_key: string;
  metric_label: string;
  raw_value: NumberOrNull;
  average_value: NumberOrNull;
  rolling_avg_3: NumberOrNull;
  rolling_avg_5: NumberOrNull;
  rolling_avg_10: NumberOrNull;
  variance_value: NumberOrNull;
  std_dev_value: NumberOrNull;
  sample_size: number;
}

const WINDOW_SIZE_MAP = {
  window3: 3,
  window5: 5,
  window10: 10
} as const;

type WindowKey = keyof typeof WINDOW_SIZE_MAP;

const ALL_WINDOWS: WindowKey[] = ["window3", "window5", "window10"];

function createAccumulator(): MetricAccumulator {
  return {
    count: 0,
    sum: 0,
    sumSquares: 0,
    window3: [],
    window5: [],
    window10: []
  };
}

function pushWindowValue(acc: MetricAccumulator, value: number) {
  for (const windowKey of ALL_WINDOWS) {
    const window = acc[windowKey];
    const size = WINDOW_SIZE_MAP[windowKey];
    window.push(value);
    if (window.length > size) {
      window.shift();
    }
  }
}

function safeNumber(value: NumberOrNull | undefined): NumberOrNull {
  if (value === null || value === undefined) {
    return null;
  }

  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return numericValue;
}

function computeRollingAverage(values: number[], windowSize: number) {
  if (values.length < windowSize) {
    return null;
  }

  const sum = values.reduce((acc, curr) => acc + curr, 0);
  return sum / windowSize;
}

function computeSampleVariance(
  count: number,
  sum: number,
  sumSquares: number
): NumberOrNull {
  if (count < 2) {
    return null;
  }

  const numerator = sumSquares - (sum * sum) / count;
  const variance = numerator / (count - 1);

  if (!Number.isFinite(variance)) {
    return null;
  }

  return Math.max(variance, 0);
}

function processMetric<
  TRow extends TrendSourceRow,
  TMetricType extends MetricType
>({
  row,
  metric,
  playerId,
  gameDate,
  currentState,
  results
}: {
  row: TRow;
  metric: BaseTrendMetricDefinition<TRow, TMetricType>;
  playerId: number;
  gameDate: string;
  currentState: Map<string, MetricAccumulator>;
  results: TrendRecord[];
}) {
  const accumulator = currentState.get(metric.key) ?? createAccumulator();

  const rawValue = safeNumber(metric.accessor(row));
  if (rawValue !== null) {
    accumulator.count += 1;
    accumulator.sum += rawValue;
    accumulator.sumSquares += rawValue * rawValue;
    pushWindowValue(accumulator, rawValue);
  }

  currentState.set(metric.key, accumulator);

  const averageValue =
    accumulator.count > 0 ? accumulator.sum / accumulator.count : null;
  const varianceValue = computeSampleVariance(
    accumulator.count,
    accumulator.sum,
    accumulator.sumSquares
  );
  const stdDevValue = varianceValue !== null ? Math.sqrt(varianceValue) : null;

  const rollingAvg3 = computeRollingAverage(
    accumulator.window3,
    WINDOW_SIZE_MAP.window3
  );
  const rollingAvg5 = computeRollingAverage(
    accumulator.window5,
    WINDOW_SIZE_MAP.window5
  );
  const rollingAvg10 = computeRollingAverage(
    accumulator.window10,
    WINDOW_SIZE_MAP.window10
  );

  results.push({
    player_id: playerId,
    season_id: row.season_id ?? null,
    game_date: gameDate,
    position_code: row.position_code ?? null,
    metric_type: metric.metricType,
    metric_key: metric.key,
    metric_label: metric.label,
    raw_value: rawValue,
    average_value: averageValue,
    rolling_avg_3: rollingAvg3,
    rolling_avg_5: rollingAvg5,
    rolling_avg_10: rollingAvg10,
    variance_value: varianceValue,
    std_dev_value: stdDevValue,
    sample_size: accumulator.count
  });
}

export const SKATER_TREND_METRICS: SkaterTrendMetricDefinition[] = [
  {
    key: "shots_per_60",
    label: "Shots on Goal / 60",
    metricType: "skater",
    sources: ["nst_shots_per_60", "shots", "toi_per_game"],
    accessor: (row) => {
      const primary = safeNumber(row.nst_shots_per_60);
      if (primary !== null) {
        return primary;
      }

      const shots = safeNumber(row.shots);
      const toi = safeNumber(row.toi_per_game);
      if (shots === null || toi === null || toi === 0) {
        return null;
      }
      return (shots / toi) * 60;
    }
  },
  {
    key: "ixg_per_60",
    label: "ixG / 60",
    metricType: "skater",
    sources: ["nst_ixg_per_60", "nst_ixg", "toi_per_game"],
    accessor: (row) => {
      const primary = safeNumber(row.nst_ixg_per_60);
      if (primary !== null) {
        return primary;
      }

      const ixg = safeNumber(row.nst_ixg);
      const toi = safeNumber(row.toi_per_game);
      if (ixg === null || toi === null || toi === 0) {
        return null;
      }
      return (ixg / toi) * 60;
    }
  },
  {
    key: "shooting_percentage",
    label: "Shooting Percentage",
    metricType: "skater",
    sources: ["shooting_percentage"],
    accessor: (row) => safeNumber(row.shooting_percentage)
  },
  {
    key: "ixg_total",
    label: "ixG",
    metricType: "skater",
    sources: ["nst_ixg"],
    accessor: (row) => safeNumber(row.nst_ixg)
  },
  {
    key: "primary_points_pct",
    label: "Primary Points %",
    metricType: "skater",
    sources: ["goals", "nst_first_assists", "points"],
    accessor: (row) => {
      const goals = safeNumber(row.goals) ?? 0;
      const firstAssists = safeNumber(row.nst_first_assists) ?? 0;
      const points = safeNumber(row.points);
      if (points === null || points === 0) {
        return null;
      }
      return (goals + firstAssists) / points;
    }
  },
  {
    key: "expected_shooting_pct",
    label: "Expected Shooting %",
    metricType: "skater",
    sources: ["shots", "nst_ixg"],
    accessor: (row) => {
      const shots = safeNumber(row.shots);
      const ixg = safeNumber(row.nst_ixg);
      if (shots === null || ixg === null || ixg === 0) {
        return null;
      }
      return shots / ixg;
    }
  },
  {
    key: "ipp",
    label: "IPP",
    metricType: "skater",
    sources: ["nst_ipp"],
    accessor: (row) => safeNumber(row.nst_ipp)
  },
  {
    key: "iscf_per_60",
    label: "iSCF / 60",
    metricType: "skater",
    sources: ["nst_iscfs_per_60"],
    accessor: (row) => safeNumber(row.nst_iscfs_per_60)
  },
  {
    key: "ihdcf_per_60",
    label: "iHDCF / 60",
    metricType: "skater",
    sources: ["nst_hdcf_per_60"],
    accessor: (row) => safeNumber(row.nst_hdcf_per_60)
  },
  {
    key: "toi",
    label: "Time on Ice",
    metricType: "skater",
    sources: ["toi_per_game"],
    accessor: (row) => safeNumber(row.toi_per_game)
  },
  {
    key: "pp_toi",
    label: "Power Play TOI",
    metricType: "skater",
    sources: ["pp_toi"],
    accessor: (row) => safeNumber(row.pp_toi)
  },
  {
    key: "pp_toi_pct",
    label: "Power Play TOI %",
    metricType: "skater",
    sources: ["pp_toi_pct_per_game"],
    accessor: (row) => {
      return safeNumber(row.pp_toi_pct_per_game);
    }
  },
  {
    key: "on_ice_shooting_pct",
    label: "On-Ice Shooting %",
    metricType: "skater",
    sources: ["on_ice_shooting_pct"],
    accessor: (row) => safeNumber(row.on_ice_shooting_pct)
  },
  {
    key: "pdo",
    label: "PDO",
    metricType: "skater",
    sources: ["nst_oi_pdo"],
    accessor: (row) => safeNumber(row.nst_oi_pdo)
  },
  {
    key: "cf",
    label: "CF",
    metricType: "skater",
    sources: ["nst_oi_cf"],
    accessor: (row) => safeNumber(row.nst_oi_cf)
  },
  {
    key: "ff",
    label: "FF",
    metricType: "skater",
    sources: ["nst_oi_ff"],
    accessor: (row) => safeNumber(row.nst_oi_ff)
  },
  {
    key: "cf_per_60",
    label: "CF / 60",
    metricType: "skater",
    sources: ["nst_oi_cf_per_60"],
    accessor: (row) => safeNumber(row.nst_oi_cf_per_60)
  },
  {
    key: "ff_per_60",
    label: "FF / 60",
    metricType: "skater",
    sources: ["nst_oi_ff_per_60"],
    accessor: (row) => safeNumber(row.nst_oi_ff_per_60)
  },
  {
    key: "cf_pct",
    label: "CF %",
    metricType: "skater",
    sources: ["nst_oi_cf_pct", "nst_oi_cf_pct_rates"],
    accessor: (row) => {
      const primary = safeNumber(row.nst_oi_cf_pct);
      if (primary !== null) {
        return primary;
      }
      return safeNumber(row.nst_oi_cf_pct_rates);
    }
  },
  {
    key: "ff_pct",
    label: "FF %",
    metricType: "skater",
    sources: ["nst_oi_ff_pct", "nst_oi_ff_pct_rates"],
    accessor: (row) => {
      const primary = safeNumber(row.nst_oi_ff_pct);
      if (primary !== null) {
        return primary;
      }
      return safeNumber(row.nst_oi_ff_pct_rates);
    }
  },
  {
    key: "goals",
    label: "Goals",
    metricType: "skater",
    sources: ["goals"],
    accessor: (row) => safeNumber(row.goals)
  },
  {
    key: "assists",
    label: "Assists",
    metricType: "skater",
    sources: ["assists"],
    accessor: (row) => safeNumber(row.assists)
  },
  {
    key: "hits",
    label: "Hits",
    metricType: "skater",
    sources: ["hits"],
    accessor: (row) => safeNumber(row.hits)
  },
  {
    key: "blocked_shots",
    label: "Blocked Shots",
    metricType: "skater",
    sources: ["blocked_shots"],
    accessor: (row) => safeNumber(row.blocked_shots)
  },
  {
    key: "pp_goals",
    label: "Power Play Goals",
    metricType: "skater",
    sources: ["pp_goals"],
    accessor: (row) => safeNumber(row.pp_goals)
  },
  {
    key: "pp_assists",
    label: "Power Play Assists",
    metricType: "skater",
    sources: ["pp_assists"],
    accessor: (row) => safeNumber(row.pp_assists)
  },
  {
    key: "games_played",
    label: "Games Played",
    metricType: "skater",
    sources: ["games_played"],
    accessor: (row) => safeNumber(row.games_played)
  }
];

export const GOALIE_TREND_METRICS: GoalieTrendMetricDefinition[] = [
  {
    key: "games_played",
    label: "Games Played",
    metricType: "goalie",
    sources: ["games_played"],
    accessor: (row) => safeNumber(row.games_played)
  },
  {
    key: "games_started",
    label: "Games Started",
    metricType: "goalie",
    sources: ["games_started"],
    accessor: (row) => safeNumber((row as any).games_started)
  },
  {
    key: "wins",
    label: "Wins",
    metricType: "goalie",
    sources: ["wins"],
    accessor: (row) => safeNumber((row as any).wins)
  },
  {
    key: "losses",
    label: "Losses",
    metricType: "goalie",
    sources: ["losses"],
    accessor: (row) => safeNumber((row as any).losses)
  },
  {
    key: "ot_losses",
    label: "OT Losses",
    metricType: "goalie",
    sources: ["ot_losses"],
    accessor: (row) => safeNumber((row as any).ot_losses)
  },
  {
    key: "save_pct",
    label: "Save Percentage",
    metricType: "goalie",
    sources: ["save_pct"],
    accessor: (row) => safeNumber((row as any).save_pct)
  },
  {
    key: "saves",
    label: "Saves",
    metricType: "goalie",
    sources: ["saves"],
    accessor: (row) => safeNumber((row as any).saves)
  },
  {
    key: "goals_against",
    label: "Goals Against",
    metricType: "goalie",
    sources: ["goals_against"],
    accessor: (row) => safeNumber((row as any).goals_against)
  },
  {
    key: "goals_against_avg",
    label: "Goals Against Avg",
    metricType: "goalie",
    sources: ["goals_against_avg"],
    accessor: (row) => safeNumber((row as any).goals_against_avg)
  },
  {
    key: "shots_against",
    label: "Shots Against",
    metricType: "goalie",
    sources: ["shots_against"],
    accessor: (row) => safeNumber((row as any).shots_against)
  },
  {
    key: "time_on_ice",
    label: "Time on Ice",
    metricType: "goalie",
    sources: ["time_on_ice"],
    accessor: (row) => safeNumber((row as any).time_on_ice)
  },
  {
    key: "shutouts",
    label: "Shutouts",
    metricType: "goalie",
    sources: ["shutouts"],
    accessor: (row) => safeNumber((row as any).shutouts)
  },
  {
    key: "complete_game_pct",
    label: "Complete Game %",
    metricType: "goalie",
    sources: ["complete_game_pct"],
    accessor: (row) => safeNumber((row as any).complete_game_pct)
  },
  {
    key: "quality_start",
    label: "Quality Starts",
    metricType: "goalie",
    sources: ["quality_start"],
    accessor: (row) => safeNumber((row as any).quality_start)
  },
  {
    key: "quality_starts_pct",
    label: "Quality Starts %",
    metricType: "goalie",
    sources: ["quality_starts_pct"],
    accessor: (row) => safeNumber((row as any).quality_starts_pct)
  },
  {
    key: "shots_against_per_60",
    label: "Shots Against / 60",
    metricType: "goalie",
    sources: ["shots_against_per_60"],
    accessor: (row) => safeNumber((row as any).shots_against_per_60)
  },
  {
    key: "goals",
    label: "Goals",
    metricType: "goalie",
    sources: ["goals"],
    accessor: (row) => safeNumber(row.goals)
  },
  {
    key: "assists",
    label: "Assists",
    metricType: "goalie",
    sources: ["assists"],
    accessor: (row) => safeNumber(row.assists)
  }
];

export const PLAYER_TREND_METRICS: TrendMetricDefinition[] = [
  ...SKATER_TREND_METRICS,
  ...GOALIE_TREND_METRICS
];

const BASE_COLUMNS = ["player_id", "date", "season_id", "position_code"];

export const SKATER_TREND_REQUIRED_COLUMNS: string[] = Array.from(
  new Set([
    ...BASE_COLUMNS,
    "games_played",
    ...SKATER_TREND_METRICS.flatMap((metric) => metric.sources)
  ])
);

export const GOALIE_TREND_REQUIRED_COLUMNS: string[] = Array.from(
  new Set([
    ...BASE_COLUMNS,
    "games_played",
    ...GOALIE_TREND_METRICS.flatMap((metric) => metric.sources)
  ])
);

export const PLAYER_TREND_REQUIRED_COLUMNS: string[] = Array.from(
  new Set([
    ...SKATER_TREND_REQUIRED_COLUMNS,
    ...GOALIE_TREND_REQUIRED_COLUMNS
  ])
);

function formatDateString(rawDate: string) {
  if (!rawDate) {
    return rawDate;
  }
  // The date from Supabase is already YYYY-MM-DD but may include time if casted.
  const [datePart] = rawDate.split("T");
  return datePart;
}

export function buildPlayerTrendRecords(
  rows: TrendSourceRow[]
): TrendRecord[] {
  if (!rows.length) {
    return [];
  }

  const sortedRows = [...rows].sort((a, b) => {
    const playerA = a.player_id ?? 0;
    const playerB = b.player_id ?? 0;
    if (playerA !== playerB) {
      return playerA - playerB;
    }

    const dateA = a.date ?? "";
    const dateB = b.date ?? "";
    if (dateA < dateB) return -1;
    if (dateA > dateB) return 1;
    return 0;
  });

  const results: TrendRecord[] = [];
  let currentPlayerId: number | null = null;
  let currentState = new Map<string, MetricAccumulator>();

  for (const row of sortedRows) {
    const playerId = row.player_id;
    const date = row.date;
    if (playerId === null || playerId === undefined || !date) {
      continue;
    }

    if (playerId !== currentPlayerId) {
      currentPlayerId = playerId;
      currentState = new Map();
    }

    const gameDate = formatDateString(date);
    if (row.position_code === "G") {
      const goalieRow = row as GoalieStatsRow;
      for (const metric of GOALIE_TREND_METRICS) {
        processMetric({
          row: goalieRow,
          metric,
          playerId,
          gameDate,
          currentState,
          results
        });
      }
    } else {
      const skaterRow = row as SkaterStatsRow;
      for (const metric of SKATER_TREND_METRICS) {
        processMetric({
          row: skaterRow,
          metric,
          playerId,
          gameDate,
          currentState,
          results
        });
      }
    }
  }

  return results;
}
