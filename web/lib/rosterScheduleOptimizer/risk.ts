import {
  DEFAULT_DUST_RISK_THRESHOLDS,
  type DustRisk,
  type DustRiskBoundary,
  type DustRiskLabel,
  type DustRiskThresholds,
} from "./types";

function meetsBoundary(
  marginalDustGames: number,
  dustRate: number,
  boundary: DustRiskBoundary,
): boolean {
  return (
    marginalDustGames >= boundary.minimumDustGames &&
    dustRate >= boundary.minimumDustRate
  );
}

export function classifyDustRisk(
  marginalDustGames: number,
  scheduledGames: number,
  thresholds: DustRiskThresholds = DEFAULT_DUST_RISK_THRESHOLDS,
): DustRisk {
  const safeDustGames = Math.max(0, marginalDustGames);
  const safeScheduledGames = Math.max(0, scheduledGames);
  const dustRate =
    safeScheduledGames === 0 ? 0 : safeDustGames / safeScheduledGames;
  let label: DustRiskLabel = "low";
  if (meetsBoundary(safeDustGames, dustRate, thresholds.high)) label = "high";
  else if (meetsBoundary(safeDustGames, dustRate, thresholds.elevated)) {
    label = "elevated";
  } else if (meetsBoundary(safeDustGames, dustRate, thresholds.moderate)) {
    label = "moderate";
  }
  return {
    label,
    marginalDustGames: safeDustGames,
    scheduledGames: safeScheduledGames,
    dustRate,
  };
}
