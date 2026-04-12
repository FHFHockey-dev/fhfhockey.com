export type NumericMetric =
  | "pointPct"
  | "points"
  | "goalsAgainstPerGame"
  | "goalsForPerGame"
  | "penaltyKillPct"
  | "powerPlayPct"
  | "shotsAgainstPerGame"
  | "shotsForPerGame";

export function getYDomainMax(metric: NumericMetric): number {
  if (
    metric === "pointPct" ||
    metric === "penaltyKillPct" ||
    metric === "powerPlayPct"
  ) {
    return 100;
  }
  if (metric === "goalsAgainstPerGame" || metric === "goalsForPerGame") {
    return 10;
  }
  if (metric === "shotsAgainstPerGame" || metric === "shotsForPerGame") {
    return 50;
  }
  return 100;
}

export function getMetricValue(
  value: number,
  metric: NumericMetric
): number {
  if (metric === "pointPct") {
    return value * 100;
  }

  return value;
}
