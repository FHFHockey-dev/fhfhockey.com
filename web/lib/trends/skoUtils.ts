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

export function buildSparklinePath(points: SparklinePoint[]): {
  line: string;
  area: string;
  baselineY: number;
} | null {
  if (!points.length) return null;
  const numericValues = points.map((p) => p.value ?? 0);
  const minValue = Math.min(...numericValues);
  const maxValue = Math.max(...numericValues);
  const range = maxValue - minValue || 1;

  const normalized = points.map((p, index) => {
    const x = points.length === 1 ? 0 : (index / (points.length - 1)) * 100;
    const yValue = p.value ?? minValue;
    const y = 40 - ((yValue - minValue) / range) * 32 - 4;
    return { x, y };
  });

  const line = normalized.map((p) => `${p.x},${p.y.toFixed(2)}`).join(" ");
  const area = `0,40 ${normalized
    .map((p) => `${p.x},${p.y.toFixed(2)}`)
    .join(" ")} 100,40`;
  const baselineRaw = 40 - ((0 - minValue) / range) * 32 - 4;
  const baselineY = Number.isNaN(baselineRaw)
    ? 40
    : Math.min(38, Math.max(2, baselineRaw));

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
