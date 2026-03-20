import { formatDurationMsToMMSS } from "lib/cron/formatDuration";

export const SLOW_JOB_THRESHOLD_MS = 270_000;
export const SLOW_JOB_DENOTATION = "OPTIMIZE" as const;

export type SlowJobWarning = {
  displayName: string;
  durationMs: number;
  timer: string;
  denotation: typeof SLOW_JOB_DENOTATION;
};

export function isSlowJobDuration(durationMs: number | null | undefined): boolean {
  return typeof durationMs === "number" && durationMs > SLOW_JOB_THRESHOLD_MS;
}

export function buildSlowJobWarning(
  displayName: string,
  durationMs: number
): SlowJobWarning {
  return {
    displayName,
    durationMs,
    timer: formatDurationMsToMMSS(durationMs),
    denotation: SLOW_JOB_DENOTATION
  };
}
