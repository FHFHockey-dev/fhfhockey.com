export const SUSTAINABILITY_EXTREME_Z_THRESHOLD = 5;

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
