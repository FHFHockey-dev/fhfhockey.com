import type { ProjectionSourceControls } from "./sourceControlPreferences";

export function getEffectiveSourceShares(
  controls: ProjectionSourceControls
): Record<string, number> {
  const total = Object.values(controls).reduce(
    (sum, control) =>
      control.isSelected && control.weight > 0 ? sum + control.weight : sum,
    0
  );
  return Object.fromEntries(
    Object.entries(controls).map(([id, control]) => [
      id,
      total > 0 && control.isSelected && control.weight > 0
        ? control.weight / total
        : 0
    ])
  );
}

export function normalizeSourceWeights(
  controls: ProjectionSourceControls
): ProjectionSourceControls {
  const shares = getEffectiveSourceShares(controls);
  if (!Object.values(shares).some((share) => share > 0)) return controls;
  return Object.fromEntries(
    Object.entries(controls).map(([id, control]) => [
      id,
      {
        ...control,
        weight:
          control.isSelected && shares[id] > 0
            ? Number(shares[id].toFixed(3))
            : control.weight
      }
    ])
  );
}

export function calculateWeightedProjection(
  values: Array<{ value: number | null; weight: number }>
): number | null {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const item of values) {
    if (
      item.value == null ||
      !Number.isFinite(item.value) ||
      !Number.isFinite(item.weight) ||
      item.weight <= 0
    ) {
      continue;
    }
    weightedSum += item.value * item.weight;
    totalWeight += item.weight;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

export function equalizeSourceWeights(controls: ProjectionSourceControls): ProjectionSourceControls {
  const count = Object.values(controls).filter((control) => control.isSelected).length;
  if (!count) return controls;
  return Object.fromEntries(Object.entries(controls).map(([id, control]) => [
    id, control.isSelected ? { ...control, weight: 1 / count } : { ...control },
  ]));
}
