export const SUSTAINABILITY_EXTREME_Z_THRESHOLD = 5;
export const SUSTAINABILITY_RECOMPUTE_TOLERANCE = 0.01;
export const SUSTAINABILITY_DRIFT_TOLERANCE = 5;

export function buildSustainabilityExtremeMetadata(
  rawZScores: Record<string, unknown>
) {
  const extremeMetrics = Object.entries(rawZScores)
    .filter(([, value]) => typeof value === "number" && Number.isFinite(value))
    .filter(([, value]) => Math.abs(Number(value)) > SUSTAINABILITY_EXTREME_Z_THRESHOLD)
    .map(([metric]) => metric)
    .sort();
  return {
    extremeFlag: extremeMetrics.length > 0,
    extremeMetrics,
    extremeThreshold: SUSTAINABILITY_EXTREME_Z_THRESHOLD
  };
}

export function countExtremeSustainabilityRows(
  rows: Array<{ components?: unknown }>
) {
  return rows.reduce((count, row) => {
    const components =
      row.components && typeof row.components === "object" && !Array.isArray(row.components)
        ? row.components as Record<string, unknown>
        : {};
    return count + (components.extremeFlag === true ? 1 : 0);
  }, 0);
}

type ScoreRow = {
  player_id: number;
  snapshot_date: string;
  window_code: string;
  s_raw: number;
  s_100: number;
};

export function compareSustainabilityScoreSample(
  recomputed: ScoreRow[],
  stored: ScoreRow[],
  tolerance = SUSTAINABILITY_RECOMPUTE_TOLERANCE
) {
  const storedByKey = new Map(
    stored.map((row) => [`${row.player_id}:${row.window_code}`, row])
  );
  const diffs = recomputed.flatMap((row) => {
    const prior = storedByKey.get(`${row.player_id}:${row.window_code}`);
    return prior
      ? [Math.max(Math.abs(row.s_raw - prior.s_raw), Math.abs(row.s_100 - prior.s_100))]
      : [];
  });
  const maxDiff = diffs.length ? Math.max(...diffs) : null;
  return {
    requested: recomputed.length,
    compared: diffs.length,
    missing_baseline: recomputed.length - diffs.length,
    max_diff: maxDiff,
    mean_diff: diffs.length
      ? diffs.reduce((sum, value) => sum + value, 0) / diffs.length
      : null,
    tolerance,
    alert: maxDiff != null && maxDiff > tolerance
  };
}

function distribution(values: number[]) {
  if (!values.length) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return { count: values.length, mean, stdev: Math.sqrt(variance) };
}

export function compareSustainabilityDistributionDrift(
  current: number[],
  priorDays: number[][],
  tolerance = SUSTAINABILITY_DRIFT_TOLERANCE
) {
  const currentStats = distribution(current);
  const priorStats = priorDays.map(distribution).filter(Boolean) as Array<{
    count: number;
    mean: number;
    stdev: number;
  }>;
  if (!currentStats || !priorStats.length) {
    return { status: "insufficient_baseline" as const, current: currentStats };
  }
  const baseline = {
    days: priorStats.length,
    mean: priorStats.reduce((sum, row) => sum + row.mean, 0) / priorStats.length,
    stdev: priorStats.reduce((sum, row) => sum + row.stdev, 0) / priorStats.length
  };
  const meanDelta = currentStats.mean - baseline.mean;
  const stdevDelta = currentStats.stdev - baseline.stdev;
  return {
    status:
      Math.abs(meanDelta) > tolerance || Math.abs(stdevDelta) > tolerance
        ? ("alert" as const)
        : ("ok" as const),
    current: currentStats,
    baseline,
    mean_delta: meanDelta,
    stdev_delta: stdevDelta,
    tolerance
  };
}
