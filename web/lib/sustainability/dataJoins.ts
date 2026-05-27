export type SustainabilityRollingRow = {
  player_id: number;
  game_date: string;
  season: number | null;
  strength_state: string | null;
  [key: string]: unknown;
};

export type SustainabilityBaselineRow = {
  player_id: string | number;
  snapshot_date: string;
  season_id: number | null;
  win_season_prev?: Record<string, unknown> | null;
  win_3yr?: Record<string, unknown> | null;
  win_career?: Record<string, unknown> | null;
};

export type SustainabilitySeasonTotalRow = {
  player_id: number;
  season_id: number | null;
  [key: string]: unknown;
};

export type SustainabilityWgoRow = {
  player_id: number;
  date: string;
  [key: string]: unknown;
};

export type SustainabilityNstRow = {
  player_id: number;
  date: string;
  [key: string]: unknown;
};

export type SustainabilityJoinedFeatureRow = {
  playerId: number;
  snapshotDate: string;
  seasonId: number | null;
  metricKey: string;
  strengthState: string;
  rolling: SustainabilityRollingRow | null;
  baseline: {
    season: unknown;
    threeYear: unknown;
    career: unknown;
  };
  seasonTotal: SustainabilitySeasonTotalRow | null;
  wgo: SustainabilityWgoRow | null;
  nst: SustainabilityNstRow | null;
  warnings: string[];
};

function asDate(value: string): string {
  return value.slice(0, 10);
}

function latestAsOf<T extends { date?: string; game_date?: string }>(
  rows: T[],
  snapshotDate: string,
): T | null {
  return (
    rows
      .filter((row) => asDate(row.date ?? row.game_date ?? "") <= snapshotDate)
      .sort((a, b) =>
        asDate(b.date ?? b.game_date ?? "").localeCompare(
          asDate(a.date ?? a.game_date ?? ""),
        ),
      )[0] ?? null
  );
}

function readBaselineMetric(
  baselineWindow: Record<string, unknown> | null | undefined,
  metricKey: string,
): unknown {
  if (!baselineWindow) return null;
  return baselineWindow[metricKey] ?? null;
}

export function buildSustainabilityJoinedFeatureRow(args: {
  playerId: number;
  snapshotDate: string;
  metricKey: string;
  strengthState?: string;
  rollingRows: SustainabilityRollingRow[];
  baselineRows: SustainabilityBaselineRow[];
  seasonTotals: SustainabilitySeasonTotalRow[];
  wgoRows: SustainabilityWgoRow[];
  nstRows: SustainabilityNstRow[];
}): SustainabilityJoinedFeatureRow {
  const snapshotDate = asDate(args.snapshotDate);
  const strengthState = args.strengthState ?? "all";
  const rolling = latestAsOf(
    args.rollingRows.filter(
      (row) =>
        row.player_id === args.playerId &&
        (row.strength_state ?? "all") === strengthState,
    ),
    snapshotDate,
  );
  const baseline =
    args.baselineRows
      .filter(
        (row) =>
          Number(row.player_id) === args.playerId &&
          asDate(row.snapshot_date) <= snapshotDate,
      )
      .sort((a, b) => asDate(b.snapshot_date).localeCompare(asDate(a.snapshot_date)))[0] ??
    null;
  const seasonId = rolling?.season ?? baseline?.season_id ?? null;
  const seasonTotal =
    args.seasonTotals
      .filter(
        (row) =>
          row.player_id === args.playerId &&
          (seasonId == null || row.season_id === seasonId),
      )
      .sort((a, b) => (b.season_id ?? 0) - (a.season_id ?? 0))[0] ?? null;
  const wgo = latestAsOf(
    args.wgoRows.filter((row) => row.player_id === args.playerId),
    snapshotDate,
  );
  const nst = latestAsOf(
    args.nstRows.filter((row) => row.player_id === args.playerId),
    snapshotDate,
  );
  const warnings = [
    rolling ? null : "missing_rolling_metric_row",
    baseline ? null : "missing_baseline_row",
    seasonTotal ? null : "missing_season_total_row",
    wgo ? null : "missing_wgo_row",
    nst ? null : "missing_nst_row",
  ].filter((warning): warning is string => warning != null);

  return {
    playerId: args.playerId,
    snapshotDate,
    seasonId,
    metricKey: args.metricKey,
    strengthState,
    rolling,
    baseline: {
      season: readBaselineMetric(baseline?.win_season_prev, args.metricKey),
      threeYear: readBaselineMetric(baseline?.win_3yr, args.metricKey),
      career: readBaselineMetric(baseline?.win_career, args.metricKey),
    },
    seasonTotal,
    wgo,
    nst,
    warnings,
  };
}
