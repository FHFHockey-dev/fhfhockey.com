export function deriveShortHandedAssists(
  shortHandedPoints: number | null | undefined,
  shortHandedGoals: number | null | undefined,
): number | null {
  if (
    typeof shortHandedPoints !== "number" ||
    !Number.isFinite(shortHandedPoints) ||
    typeof shortHandedGoals !== "number" ||
    !Number.isFinite(shortHandedGoals)
  ) {
    return null;
  }

  return Math.max(0, shortHandedPoints - shortHandedGoals);
}
