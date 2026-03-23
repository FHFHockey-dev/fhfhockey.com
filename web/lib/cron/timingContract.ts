import { formatDurationMsToMMSS } from "lib/cron/formatDuration";

export const CRON_TIMER_PATTERN = /^\d{2,}:\d{2}$/;

export type CronTimingSource =
  | "response"
  | "audit"
  | "cron_report"
  | "sql_runner"
  | "benchmark_runner";

/**
 * Canonical timing contract for auditable cron jobs.
 *
 * `startedAt` and `endedAt` are ISO-8601 timestamps.
 * `durationMs` is the raw elapsed duration in milliseconds.
 * `timer` is the human-readable zero-padded MMSS representation.
 *
 * The contract is intentionally additive and transport-friendly so it can be
 * used in:
 * - route JSON payloads
 * - cron_job_audit.details
 * - benchmark-runner observations
 * - cron report normalization
 */
export type CronJobTimingContract = {
  startedAt: string;
  endedAt: string;
  durationMs: number;
  timer: string;
};

export type CronJobTimingRecord = CronJobTimingContract & {
  source: CronTimingSource;
};

export type CronTimingEnvelope = {
  timing: CronJobTimingContract;
};

export type CronTimedResponse<T extends Record<string, unknown>> =
  T & CronTimingEnvelope;

type TimingInput = number | string | Date;

function isIsoDateTime(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function toDate(input: TimingInput): Date {
  if (input instanceof Date) return new Date(input.getTime());
  if (typeof input === "number") return new Date(input);
  return new Date(input);
}

export function buildCronJobTiming(
  startedAtInput: TimingInput,
  endedAtInput: TimingInput = new Date()
): CronJobTimingContract {
  const startedAtDate = toDate(startedAtInput);
  const endedAtDate = toDate(endedAtInput);
  const rawDurationMs = endedAtDate.getTime() - startedAtDate.getTime();
  const durationMs = Number.isFinite(rawDurationMs)
    ? Math.max(0, rawDurationMs)
    : 0;

  return {
    startedAt: startedAtDate.toISOString(),
    endedAt: endedAtDate.toISOString(),
    durationMs,
    timer: formatDurationMsToMMSS(durationMs)
  };
}

export function withCronJobTiming<T extends Record<string, unknown>>(
  body: T,
  startedAtInput: TimingInput,
  endedAtInput: TimingInput = new Date()
): CronTimedResponse<T> {
  return {
    ...body,
    timing: buildCronJobTiming(startedAtInput, endedAtInput)
  };
}

export function hasCronJobTimingContract(
  value: unknown
): value is CronJobTimingContract {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<CronJobTimingContract>;

  return (
    isIsoDateTime(candidate.startedAt) &&
    isIsoDateTime(candidate.endedAt) &&
    typeof candidate.durationMs === "number" &&
    Number.isFinite(candidate.durationMs) &&
    candidate.durationMs >= 0 &&
    typeof candidate.timer === "string" &&
    CRON_TIMER_PATTERN.test(candidate.timer)
  );
}

export function hasCronTimingEnvelope(
  value: unknown
): value is CronTimingEnvelope {
  if (!value || typeof value !== "object") return false;

  return hasCronJobTimingContract((value as Partial<CronTimingEnvelope>).timing);
}
