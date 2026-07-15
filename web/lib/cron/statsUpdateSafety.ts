const MAX_CRON_DIAGNOSTIC_LENGTH = 240;

export type StatsPreWriteQuarantineFailureDetails = {
  kind: "stats_pre_write_quarantine_failure";
  code: "STATS_PRE_WRITE_QUARANTINE_ELIGIBLE";
  phase: "pre_write_validation";
  gameId: number;
  requestedRows: 1;
  reason: "game_not_finished";
  message: string;
};

export class StatsPreWriteQuarantineError extends Error {
  readonly details: StatsPreWriteQuarantineFailureDetails;

  constructor(
    details: Omit<StatsPreWriteQuarantineFailureDetails, "message"> & {
      message: unknown;
    },
  ) {
    const sanitizedMessage = sanitizeCronDiagnostic(details.message);
    super(sanitizedMessage);
    this.name = "StatsPreWriteQuarantineError";
    this.details = {
      ...details,
      message: sanitizedMessage,
    };
  }
}

function diagnosticText(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string") return message;
    if (message != null) return String(message);
  }
  return String(value ?? "Unknown failure");
}

export function sanitizeCronDiagnostic(value: unknown): string {
  const raw = diagnosticText(value).trim();
  const withoutHtml = /<!doctype\s+html|<html(?:\s|>)/i.test(raw)
    ? "Upstream HTML response redacted."
    : raw.replace(/<[^>]*>/g, " ");
  const sanitized = withoutHtml
    .replace(/\bBearer\s+[^\s,;"'<>]+/gi, "Bearer [redacted]")
    .replace(/https?:\/\/[^\s<>"']+/gi, "[redacted-url]")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const bounded = sanitized || "Unknown failure";

  return bounded.length <= MAX_CRON_DIAGNOSTIC_LENGTH
    ? bounded
    : `${bounded.slice(0, MAX_CRON_DIAGNOSTIC_LENGTH - 1)}…`;
}

export function getStatsPreWriteQuarantineFailureDetails(
  error: unknown,
): StatsPreWriteQuarantineFailureDetails | null {
  return error instanceof StatsPreWriteQuarantineError ? error.details : null;
}
