export function normalizeDurationMs(durationMs: unknown): number {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs)) {
    return 0;
  }

  return Math.max(0, durationMs);
}

export function formatDurationMsToMMSS(durationMs: number): string {
  const totalSeconds = Math.floor(normalizeDurationMs(durationMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatDurationMsToMinutesSecondsLabel(
  durationMs: number
): string {
  const totalSeconds = Math.floor(normalizeDurationMs(durationMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}m ${seconds}s`;
}
