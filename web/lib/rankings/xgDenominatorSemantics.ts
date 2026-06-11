export const XG_SHOT_UNIVERSE = "fenwick_unblocked" as const;

function finitePositive(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function finite(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function round(value: number, decimals = 6) {
  return Number(value.toFixed(decimals));
}

export function getXgAggregateUnblockedAttempts(row: {
  shot_attempts: number | null;
}) {
  return finite(row.shot_attempts);
}

export function getTeamXgAggregateFenwickFor(row: {
  shot_attempts_for: number | null;
}) {
  return finite(row.shot_attempts_for);
}

export function getGoalieXgAggregateFenwickAgainst(row: {
  shots_against: number | null;
}) {
  return finite(row.shots_against);
}

export function calculateExpectedShootingPercentage(args: {
  ixg: number | null;
  unblockedAttempts: number | null;
}) {
  const ixg = finite(args.ixg);
  const unblockedAttempts = finitePositive(args.unblockedAttempts);
  if (ixg == null || unblockedAttempts == null) return null;
  return round((ixg / unblockedAttempts) * 100);
}

export function calculateShootingAboveExpectedPercentage(args: {
  goals: number | null;
  ixg: number | null;
  unblockedAttempts: number | null;
}) {
  const goals = finite(args.goals);
  const ixg = finite(args.ixg);
  const unblockedAttempts = finitePositive(args.unblockedAttempts);
  if (goals == null || ixg == null || unblockedAttempts == null) return null;
  return round(((goals - ixg) / unblockedAttempts) * 100);
}

export function calculateTeamShotQuality(args: {
  xgFor: number | null;
  fenwickFor: number | null;
}) {
  const xgFor = finite(args.xgFor);
  const fenwickFor = finitePositive(args.fenwickFor);
  if (xgFor == null || fenwickFor == null) return null;
  return round(xgFor / fenwickFor);
}

export function calculateGoalieXgaPerUnblockedAttempt(args: {
  xgAgainst: number | null;
  fenwickAgainst: number | null;
}) {
  const xgAgainst = finite(args.xgAgainst);
  const fenwickAgainst = finitePositive(args.fenwickAgainst);
  if (xgAgainst == null || fenwickAgainst == null) return null;
  return round(xgAgainst / fenwickAgainst);
}
