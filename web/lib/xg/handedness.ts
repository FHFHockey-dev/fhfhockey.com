export type NormalizedHandedness = "L" | "R";
export type ShooterGoalieHandednessMatchup = "same-hand" | "opposite-hand";

export function normalizeShootsCatchesValue(
  value: string | null | undefined
): NormalizedHandedness | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  if (normalized === "L" || normalized.startsWith("LEFT")) {
    return "L";
  }

  if (normalized === "R" || normalized.startsWith("RIGHT")) {
    return "R";
  }

  return null;
}

export function buildShooterGoalieHandednessMatchup(
  shooterHandedness: NormalizedHandedness | null,
  goalieCatchHand: NormalizedHandedness | null
): ShooterGoalieHandednessMatchup | null {
  if (shooterHandedness == null || goalieCatchHand == null) {
    return null;
  }

  return shooterHandedness === goalieCatchHand ? "same-hand" : "opposite-hand";
}
