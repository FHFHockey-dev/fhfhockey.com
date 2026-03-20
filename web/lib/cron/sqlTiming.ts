import {
  buildCronJobTiming,
  type CronJobTimingRecord
} from "lib/cron/timingContract";

export type SqlCronReportRow = {
  jobname?: string | null;
  scheduled_time?: string | null;
  end_time?: string | null;
  status?: unknown;
  return_message?: string | null;
  sql_text?: string | null;
};

export type SqlCronTimingObservation = {
  jobName: string;
  method: "SQL";
  source: "cron_report";
  status: "success" | "failure" | "unknown";
  sqlText: string | null;
  returnMessage: string | null;
  timing: CronJobTimingRecord | null;
};

function normalizeStatus(value: unknown): "success" | "failure" | "unknown" {
  const normalized = String(value ?? "")
    .toLowerCase()
    .trim();

  if (["success", "succeeded", "ok", "passed"].includes(normalized)) {
    return "success";
  }

  if (["failure", "failed", "error", "errored"].includes(normalized)) {
    return "failure";
  }

  return "unknown";
}

/**
 * SQL-only pg_cron jobs do not emit route JSON, so their comparable timing
 * surface comes from `cron_job_report.scheduled_time` and `end_time`.
 *
 * This helper normalizes that pg_cron metadata into the same canonical timing
 * contract used by HTTP route responses and audit observations.
 */
export function buildSqlCronTimingObservation(
  row: SqlCronReportRow
): SqlCronTimingObservation {
  const startedAt = row.scheduled_time ?? null;
  const endedAt = row.end_time ?? null;

  const timing =
    startedAt && endedAt
      ? {
          ...buildCronJobTiming(startedAt, endedAt),
          source: "cron_report" as const
        }
      : null;

  return {
    jobName: String(row.jobname ?? ""),
    method: "SQL",
    source: "cron_report",
    status: normalizeStatus(row.status),
    sqlText: row.sql_text ?? null,
    returnMessage: row.return_message ?? null,
    timing
  };
}
