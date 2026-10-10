export type FourWeekMetricBand = "high" | "middle" | "low";

export const FOUR_WEEK_COLOR_LEGEND = "Colors show relative favorability: green = high, gold = middle, red = low. Higher GP, OFF and score are favorable. Lower OPP% is favorable. Missing values stay neutral.";

/** Split known observations into thirds using each tie group's midpoint rank. */
export function toFourWeekMetricBands(
  entries: { teamId: number; value: number | null | undefined }[],
  bestDirection: "asc" | "desc",
): Map<number, FourWeekMetricBand> {
  const sorted = entries.filter((entry): entry is { teamId: number; value: number } =>
    typeof entry.value === "number" && Number.isFinite(entry.value)
  ).sort((a, b) => bestDirection === "asc" ? a.value - b.value : b.value - a.value);
  const bands = new Map<number, FourWeekMetricBand>();
  for (let first = 0; first < sorted.length;) {
    let last = first + 1;
    while (last < sorted.length && sorted[last].value === sorted[first].value) last++;
    const percentile = (first + last) / (2 * sorted.length);
    const band = percentile <= 1 / 3 ? "high" : percentile >= 2 / 3 ? "low" : "middle";
    sorted.slice(first, last).forEach(({ teamId }) => bands.set(teamId, band));
    first = last;
  }
  return bands;
}
