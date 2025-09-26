import { teamsInfo } from "lib/teamsInfo";
import { SparklinePoint } from "./skoTypes";

export function formatNumber(
  value: number | null | undefined,
  digits = 1
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return Number(value).toFixed(digits);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

export function buildSparklinePath(
  rawPoints: SparklinePoint[]
): { line: string; area: string; baselineY: number } | null {
  if (!rawPoints.length) return null;

  // Filter out null / NaN values while preserving date order
  const points = rawPoints.filter(
    (p) => p.value != null && !Number.isNaN(p.value)
  );
  if (!points.length) return null;

  // If after filtering we only have one point, duplicate it so the polyline renders visibly
  const series = points.length === 1 ? [...points, { ...points[0] }] : points;

  const numericValues = series.map((p) => p.value as number);
  let minValue = Math.min(...numericValues);
  let maxValue = Math.max(...numericValues);

  // Expand a flat series slightly so it doesn't sit exactly on the (possibly) dashed baseline
  if (minValue === maxValue) {
    minValue -= 0.5;
    maxValue += 0.5;
  }
  const range = maxValue - minValue || 1;

  const normalized = series.map((p, index) => {
    const x = series.length === 1 ? 0 : (index / (series.length - 1)) * 100;
    const yValue = (p.value as number) ?? minValue;
    // Vertical padding (top/bottom) = 4px each, drawable band = 32
    const y = 40 - ((yValue - minValue) / range) * 32 - 4;
    return { x, y };
  });

  const line = normalized.map((p) => `${p.x},${p.y.toFixed(2)}`).join(" ");
  const area = `0,40 ${normalized.map((p) => `${p.x},${p.y.toFixed(2)}`).join(" ")} 100,40`;

  // Baseline anchored at 0. If 0 outside range, clamp inside view so dashed line stays visible.
  const baselineRaw = 40 - ((0 - minValue) / range) * 32 - 4;
  let baselineY = Number.isNaN(baselineRaw) ? 40 : baselineRaw;
  baselineY = Math.min(38, Math.max(2, baselineY));

  // If the line is effectively horizontal and overlaps the baseline, nudge baseline for contrast
  const allY = normalized.map((n) => Number(n.y.toFixed(2)));
  const uniqueY = new Set(allY);
  if (uniqueY.size === 1 && Math.abs(allY[0] - baselineY) < 1.25) {
    baselineY = Math.min(38, allY[0] + 3);
  }

  return { line, area, baselineY };
}

export function lookupTeamLabel(teamId?: number | null): string | null {
  if (!teamId) return null;
  const entry = Object.values(teamsInfo).find((team) => team.id === teamId);
  if (!entry) return null;
  return entry.abbrev ?? entry.shortName ?? entry.name;
}

export function formatIsoDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}
