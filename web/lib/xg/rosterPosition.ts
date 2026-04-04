export type NormalizedRosterPosition = "L" | "R" | "C" | "D" | "G";
export type ShooterPositionGroup = "forward" | "defense" | "goalie";

export function normalizeRosterPosition(
  value: string | null | undefined
): NormalizedRosterPosition | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (
    normalized === "L" ||
    normalized === "R" ||
    normalized === "C" ||
    normalized === "D" ||
    normalized === "G"
  ) {
    return normalized;
  }

  return null;
}

export function buildShooterPositionGroup(
  position: NormalizedRosterPosition | null
): ShooterPositionGroup | null {
  if (position == null) {
    return null;
  }

  if (position === "D") {
    return "defense";
  }

  if (position === "G") {
    return "goalie";
  }

  return "forward";
}
