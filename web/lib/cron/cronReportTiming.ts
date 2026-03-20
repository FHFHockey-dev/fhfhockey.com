import {
  hasCronJobTimingContract,
  type CronJobTimingRecord,
  type CronTimingSource
} from "lib/cron/timingContract";

function parseJsonMaybe(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function parseTimingSource(
  value: unknown,
  fallback: CronTimingSource
): CronTimingSource {
  switch (value) {
    case "response":
    case "audit":
    case "cron_report":
    case "sql_runner":
    case "benchmark_runner":
      return value;
    default:
      return fallback;
  }
}

export function parseTimingRecord(
  value: unknown,
  fallbackSource: CronTimingSource
): CronJobTimingRecord | null {
  const parsedValue = parseJsonMaybe(value);
  if (!parsedValue || typeof parsedValue !== "object") return null;
  if (!hasCronJobTimingContract(parsedValue)) return null;

  const candidate = parsedValue as CronJobTimingRecord;

  return {
    startedAt: candidate.startedAt,
    endedAt: candidate.endedAt,
    durationMs: candidate.durationMs,
    timer: candidate.timer,
    source: parseTimingSource(candidate.source, fallbackSource)
  };
}

export function extractAuditTimingRecord(
  details: unknown
): CronJobTimingRecord | null {
  const parsedDetails = parseJsonMaybe(details);
  if (!parsedDetails || typeof parsedDetails !== "object") return null;

  const detailsObject = parsedDetails as Record<string, unknown>;
  const detailsTiming = parseTimingRecord(detailsObject.timing, "audit");
  if (detailsTiming) return detailsTiming;

  const response = parseJsonMaybe(detailsObject.response);
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return null;
  }

  return parseTimingRecord(
    (response as Record<string, unknown>).timing,
    "response"
  );
}
