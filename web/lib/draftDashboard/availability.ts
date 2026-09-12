export type SelectionHorizon = {
  currentPick: number;
  targetPick: number;
  opposingPicks: number;
};

export const DEFAULT_AVAILABILITY_SPREAD = 12;
export function normalizeAvailabilitySpread(value: number) {
  return Number.isFinite(value) ? Math.max(2, Math.min(40, value)) : DEFAULT_AVAILABILITY_SPREAD;
}

// Log survival avoids cancellation for players whose ADP is long past.
function logNormalSurvival(z: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const polynomial = t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const logTail = -0.5 * z * z - 0.5 * Math.log(2 * Math.PI) + Math.log(polynomial);
  return z >= 0 ? logTail : Math.log1p(-Math.exp(logTail));
}

/** ADP heuristic, conditional on availability now; not a calibrated room forecast. */
export function estimatePlayerAvailability(adp: number | null | undefined, horizon: SelectionHorizon | null | undefined, spread = DEFAULT_AVAILABILITY_SPREAD): number | null {
  if (typeof adp !== "number" || !Number.isFinite(adp) || adp <= 0 || !horizon) return null;
  const { currentPick, targetPick, opposingPicks } = horizon;
  if (![currentPick, targetPick, opposingPicks].every(Number.isInteger) || currentPick < 1 || targetPick < currentPick || opposingPicks < 0 || opposingPicks > targetPick - currentPick) return null;
  if (!opposingPicks) return 1;
  const sd = normalizeAvailabilitySpread(spread);
  const now = (currentPick - 1 - adp) / sd;
  const later = (currentPick - 1 + opposingPicks - adp) / sd;
  return Math.max(0, Math.min(1, Math.exp(logNormalSurvival(later) - logNormalSurvival(now))));
}
