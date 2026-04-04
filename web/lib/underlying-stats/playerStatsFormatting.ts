export const PLAYER_STATS_EMPTY_VALUE = "—";

export type PlayerStatsFormattingToken =
  | "text"
  | "team"
  | "position"
  | "integer"
  | "decimal"
  | "percentage"
  | "toi"
  | "toiPerGame"
  | "per60"
  | "distance";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatFixed(value: number, digits: number): string {
  return value.toFixed(digits);
}

export function formatPlayerStatsToi(seconds: number | null | undefined): string {
  if (!isFiniteNumber(seconds) || seconds < 0) {
    return PLAYER_STATS_EMPTY_VALUE;
  }

  const flooredSeconds = Math.floor(seconds);
  const totalMinutes = Math.floor(flooredSeconds / 60);
  const remainingSeconds = flooredSeconds % 60;

  return `${totalMinutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function formatPlayerStatsPercentage(
  value: number | null | undefined
): string {
  if (!isFiniteNumber(value)) {
    return PLAYER_STATS_EMPTY_VALUE;
  }

  return `${formatFixed(value * 100, 1)}%`;
}

export function formatPlayerStatsPer60(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) {
    return PLAYER_STATS_EMPTY_VALUE;
  }

  return formatFixed(value, 2);
}

export function formatPlayerStatsDecimal(
  value: number | null | undefined
): string {
  if (!isFiniteNumber(value)) {
    return PLAYER_STATS_EMPTY_VALUE;
  }

  return formatFixed(value, 2);
}

export function formatPlayerStatsDistance(
  value: number | null | undefined
): string {
  if (!isFiniteNumber(value)) {
    return PLAYER_STATS_EMPTY_VALUE;
  }

  return formatFixed(value, 1);
}

export function formatPlayerStatsInteger(
  value: number | null | undefined
): string {
  if (!isFiniteNumber(value)) {
    return PLAYER_STATS_EMPTY_VALUE;
  }

  return Math.round(value).toLocaleString("en-US");
}

export function formatPlayerStatsText(
  value: string | number | null | undefined
): string {
  if (value === null || value === undefined || value === "") {
    return PLAYER_STATS_EMPTY_VALUE;
  }

  return String(value);
}

export function formatPlayerStatsValue(
  value: string | number | null | undefined,
  format: PlayerStatsFormattingToken
): string {
  if (value === null || value === undefined || value === "") {
    return PLAYER_STATS_EMPTY_VALUE;
  }

  switch (format) {
    case "text":
    case "team":
    case "position":
      return formatPlayerStatsText(value);
    case "integer":
      return formatPlayerStatsInteger(
        typeof value === "number" ? value : Number(value)
      );
    case "decimal":
      return formatPlayerStatsDecimal(
        typeof value === "number" ? value : Number(value)
      );
    case "percentage":
      return formatPlayerStatsPercentage(
        typeof value === "number" ? value : Number(value)
      );
    case "toi":
    case "toiPerGame":
      return formatPlayerStatsToi(typeof value === "number" ? value : Number(value));
    case "per60":
      return formatPlayerStatsPer60(typeof value === "number" ? value : Number(value));
    case "distance":
      return formatPlayerStatsDistance(
        typeof value === "number" ? value : Number(value)
      );
    default:
      return formatPlayerStatsText(value);
  }
}
