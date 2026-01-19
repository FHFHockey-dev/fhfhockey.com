/**
 * Cron Report Coverage
 *
 * Any API route that writes to Supabase `cron_job_audit` (either directly, or via `withCronJobAudit`)
 * will appear in the Cron Report / briefing emails.
 *
 * Included routes (currently 53):
 * - web/pages/api/v1/db/build-projection-derived-v2.ts
 * - web/pages/api/v1/db/calculate-wigo-stats.ts
 * - web/pages/api/v1/db/check-missing-goalie-data.ts
 * - web/pages/api/v1/db/cron/update-stats-cron.ts
 * - web/pages/api/v1/db/manual-refresh-yahoo-token.ts
 * - web/pages/api/v1/db/powerPlayTimeFrame.ts
 * - web/pages/api/v1/db/run-fetch-wgo-data.ts
 * - web/pages/api/v1/db/run-projection-accuracy.ts
 * - web/pages/api/v1/db/run-projection-v2.ts
 * - web/pages/api/v1/db/shift-charts.ts
 * - web/pages/api/v1/db/skaterArray.ts
 * - web/pages/api/v1/db/sustainability/rebuild-baselines.ts
 * - web/pages/api/v1/db/update-PbP.ts
 * - web/pages/api/v1/db/update-expected-goals/index.ts
 * - web/pages/api/v1/db/update-games.ts
 * - web/pages/api/v1/db/update-goalie-projections-v2.ts
 * - web/pages/api/v1/db/update-goalie-projections.ts
 * - web/pages/api/v1/db/update-last-7-14-30.ts
 * - web/pages/api/v1/db/update-line-combinations/[id].ts
 * - web/pages/api/v1/db/update-line-combinations/index.ts
 * - web/pages/api/v1/db/update-nst-current-season.ts
 * - web/pages/api/v1/db/update-nst-gamelog.ts
 * - web/pages/api/v1/db/update-nst-goalies.ts
 * - web/pages/api/v1/db/update-nst-last-ten.ts
 * - web/pages/api/v1/db/update-nst-player-reports.ts
 * - web/pages/api/v1/db/update-nst-team-daily.ts
 * - web/pages/api/v1/db/update-player/[playerId].ts
 * - web/pages/api/v1/db/update-players.ts
 * - web/pages/api/v1/db/update-power-play-combinations/[gameId].ts
 * - web/pages/api/v1/db/update-power-rankings.ts
 * - web/pages/api/v1/db/update-rolling-games.ts
 * - web/pages/api/v1/db/update-rolling-player-averages.ts
 * - web/pages/api/v1/db/update-season-stats.ts
 * - web/pages/api/v1/db/update-seasons.ts
 * - web/pages/api/v1/db/update-sko-stats.ts
 * - web/pages/api/v1/db/update-standings-details/index.ts
 * - web/pages/api/v1/db/update-start-chart-projections.ts
 * - web/pages/api/v1/db/update-stats/[gameId].ts
 * - web/pages/api/v1/db/update-team-ctpi-daily.ts
 * - web/pages/api/v1/db/update-team-power-ratings-new.ts
 * - web/pages/api/v1/db/update-team-power-ratings.ts
 * - web/pages/api/v1/db/update-team-sos.ts
 * - web/pages/api/v1/db/update-team-yearly-summary.ts
 * - web/pages/api/v1/db/update-teams.ts
 * - web/pages/api/v1/db/update-wgo-averages.ts
 * - web/pages/api/v1/db/update-wgo-goalie-totals.ts
 * - web/pages/api/v1/db/update-wgo-goalies.ts
 * - web/pages/api/v1/db/update-wgo-ly.ts
 * - web/pages/api/v1/db/update-wgo-skaters.ts
 * - web/pages/api/v1/db/update-wgo-totals.ts
 * - web/pages/api/v1/db/update-yahoo-players.ts
 * - web/pages/api/v1/db/update-yahoo-weeks.ts
 * - web/pages/api/v1/db/upsert-csv.ts
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { CronReportEmail } from "components/CronReportEmail/CronReportEmail"; // For job run details
import { CronAuditEmail } from "components/CronReportEmail/CronAuditEmail";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

type NormalizedStatus = "success" | "failure" | "unknown";
type JobSummary = {
  jobName: string;
  lastStatus: NormalizedStatus;
  lastStatusSource: "audit" | "cron" | "unknown";
  lastTimeDisplay: string;
  message: string | null;
  runsCount: number;
  auditRunsCount: number;
  okCount24h: number;
  failCount24h: number;
  rowsLast: number | null;
  rowsTotal: number | null;
  lastDurationMs: number | null;
  avgDurationMs: number | null;
};

function normalizeStatus(value: unknown): NormalizedStatus {
  const v = String(value ?? "").toLowerCase().trim();
  if (!v) return "unknown";
  if (["success", "succeeded", "ok", "passed"].includes(v)) return "success";
  if (["failure", "failed", "error", "errored"].includes(v)) return "failure";
  return "unknown";
}

function extractDetailsMessage(details: unknown): string | null {
  if (!details) return null;
  if (typeof details === "string") return details;
  if (typeof details !== "object") return String(details);

  const asAny = details as any;
  const direct =
    asAny.message ??
    asAny.error ??
    asAny.err ??
    asAny.reason ??
    asAny.return_message ??
    asAny.returnMessage;
  if (typeof direct === "string" && direct.trim()) return direct;

  try {
    const json = JSON.stringify(details);
    return json === "{}" ? null : json;
  } catch {
    return null;
  }
}

type ParsedAuditDetails = {
  durationMs: number | null;
  statusCode: number | null;
  url: string | null;
  method: string | null;
  error: string | null;
};

function parseAuditDetails(details: unknown): ParsedAuditDetails {
  const empty: ParsedAuditDetails = {
    durationMs: null,
    statusCode: null,
    url: null,
    method: null,
    error: null
  };

  if (!details) return empty;

  let obj: any = details;
  if (typeof details === "string") {
    try {
      obj = JSON.parse(details);
    } catch {
      return empty;
    }
  }

  if (!obj || typeof obj !== "object") return empty;

  return {
    durationMs:
      typeof obj.durationMs === "number" && Number.isFinite(obj.durationMs)
        ? obj.durationMs
        : null,
    statusCode:
      typeof obj.statusCode === "number" && Number.isFinite(obj.statusCode)
        ? obj.statusCode
        : null,
    url: typeof obj.url === "string" ? obj.url : null,
    method: typeof obj.method === "string" ? obj.method : null,
    error: typeof obj.error === "string" ? obj.error : null
  };
}

function parseRowsAffectedFromReturnMessage(
  returnMessage: string | null
): number | null {
  if (!returnMessage) return null;
  const msg = String(returnMessage);
  const toFiniteNumber = (value: string) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const insertMatch = msg.match(/INSERT\s+\d+\s+(\d+)/i);
  if (insertMatch?.[1]) return toFiniteNumber(insertMatch[1]);

  const updateMatch = msg.match(/UPDATE\s+(\d+)/i);
  if (updateMatch?.[1]) return toFiniteNumber(updateMatch[1]);

  const deleteMatch = msg.match(/DELETE\s+(\d+)/i);
  if (deleteMatch?.[1]) return toFiniteNumber(deleteMatch[1]);

  const selectMatch = msg.match(/SELECT\s+(\d+)/i);
  if (selectMatch?.[1]) return toFiniteNumber(selectMatch[1]);

  const copyMatch = msg.match(/COPY\s+(\d+)/i);
  if (copyMatch?.[1]) return toFiniteNumber(copyMatch[1]);

  const rowWordMatch = msg.match(/(\d+)\s+row(s)?\b/i);
  if (rowWordMatch?.[1]) return toFiniteNumber(rowWordMatch[1]);

  return null;
}

function safeDurationMs(startIso: string | null, endIso: string | null) {
  if (!startIso || !endIso) return null;
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const duration = end - start;
  return duration >= 0 ? duration : null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const emailRecipient = process.env.CRON_REPORT_EMAIL_RECIPIENT!;

  let jobRunDetailsEmailResult: any = null;
  let auditEmailResult: any = null;
  const errors: string[] = [];

  // 1. Fetch data for job_run_details (cron_job_report)
  const { data: runs, error: runErr } = await supabase
    .from("cron_job_report")
    .select("jobname, scheduled_time, status, return_message, end_time, sql_text")
    .gte("scheduled_time", since)
    .order("scheduled_time", { ascending: true });

  if (runErr) {
    console.error("Error fetching cron_job_report:", runErr.message);
    // Not returning immediately, to allow audit email to proceed if desired
    errors.push(`Failed to fetch job run details: ${runErr.message}`);
  }

  // 2. Fetch data for cron_job_audit
  const { data: audits, error: auditErr } = await supabase
    .from("cron_job_audit")
    .select("job_name, run_time, rows_affected, status, details")
    .gte("run_time", since)
    .order("run_time", { ascending: true });

  if (auditErr) {
    console.error("Error fetching cron_job_audit:", auditErr.message);
    errors.push(`Failed to fetch cron job audit: ${auditErr.message}`);
  }

  const auditRows = (audits ?? []).map((a: any) => ({
    jobName: String(a.job_name ?? ""),
    time: String(a.run_time ?? ""),
    rowsAffected: (a.rows_affected ?? null) as number | null,
    rawStatus: a.status as unknown,
    status: normalizeStatus(a.status),
    details: a.details as unknown,
    detailsMessage: extractDetailsMessage(a.details),
    parsed: parseAuditDetails(a.details)
  }));

  const runRows = (runs ?? []).map((r: any) => ({
    jobName: String(r.jobname ?? ""),
    time: String(r.scheduled_time ?? ""),
    rawStatus: r.status as unknown,
    status: normalizeStatus(r.status),
    returnMessage: (r.return_message ?? null) as string | null,
    sqlText: (r.sql_text ?? null) as string | null,
    endTime: (r.end_time ?? null) as string | null,
    rowsAffected: parseRowsAffectedFromReturnMessage(
      (r.return_message ?? null) as string | null
    ),
    durationMs: safeDurationMs(
      (r.scheduled_time ?? null) as string | null,
      (r.end_time ?? null) as string | null
    )
  }));

  const jobNames = new Set<string>([
    ...auditRows.map((a) => a.jobName).filter(Boolean),
    ...runRows.map((r) => r.jobName).filter(Boolean)
  ]);

  const jobSummaries: JobSummary[] = Array.from(jobNames)
    .map((jobName): JobSummary => {
      const jobAudits = auditRows
        .filter((a) => a.jobName === jobName)
        .sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
      const jobRuns = runRows
        .filter((r) => r.jobName === jobName)
        .sort((a, b) => Date.parse(b.time) - Date.parse(a.time));

      const lastAudit = jobAudits[0] ?? null;
      const lastRun = jobRuns[0] ?? null;

      const auditSuccesses = jobAudits.filter((a) => a.status === "success")
        .length;
      const auditFailures = jobAudits.filter((a) => a.status === "failure")
        .length;

      const runSuccesses = jobRuns.filter((r) => r.status === "success").length;
      const runFailures = jobRuns.filter((r) => r.status === "failure").length;
      const hasAnyAudit = jobAudits.length > 0;

      const rowsTotalCounted = jobAudits.filter(
        (a) => typeof a.rowsAffected === "number"
      ).length;
      const runRowsCounted = jobRuns.filter(
        (r) => typeof r.rowsAffected === "number"
      ).length;

      const durations = jobAudits
        .map((a) => a.parsed.durationMs)
        .filter((d): d is number => typeof d === "number" && Number.isFinite(d));
      const runDurations = jobRuns
        .map((r) => r.durationMs)
        .filter((d): d is number => typeof d === "number" && Number.isFinite(d));

      const lastStatus: NormalizedStatus =
        lastAudit?.status ?? lastRun?.status ?? "unknown";
      const lastStatusSource: JobSummary["lastStatusSource"] = lastAudit
        ? "audit"
        : lastRun
          ? "cron"
          : "unknown";
      const lastMessage =
        lastAudit?.detailsMessage ??
        lastRun?.returnMessage ??
        null;

      const lastTimeIso = lastAudit?.time ?? lastRun?.time ?? null;

      const rowsLast =
        (typeof lastAudit?.rowsAffected === "number"
          ? lastAudit.rowsAffected
          : null) ??
        (typeof lastRun?.rowsAffected === "number" ? lastRun.rowsAffected : null);
      const rowsTotal =
        rowsTotalCounted > 0
          ? jobAudits.reduce((acc, a) => acc + (a.rowsAffected ?? 0), 0)
          : runRowsCounted > 0
            ? jobRuns.reduce((acc, r) => acc + (r.rowsAffected ?? 0), 0)
            : null;

      const avgDurationMs =
        durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : runDurations.length > 0
            ? Math.round(
                runDurations.reduce((a, b) => a + b, 0) / runDurations.length
              )
            : null;

      const okCount24h = hasAnyAudit ? auditSuccesses : runSuccesses;
      const failCount24h = hasAnyAudit ? auditFailures : runFailures;

      return {
        jobName,
        lastStatus,
        lastStatusSource,
        lastTimeDisplay: lastTimeIso
          ? new Date(lastTimeIso).toLocaleString()
          : "—",
        message: lastMessage,
        runsCount: jobRuns.length,
        auditRunsCount: jobAudits.length,
        okCount24h,
        failCount24h,
        rowsLast,
        rowsTotal,
        lastDurationMs: lastAudit?.parsed.durationMs ?? lastRun?.durationMs ?? null,
        avgDurationMs
      };
    })
    .sort((a, b) => {
      if (a.lastStatus !== b.lastStatus) {
        if (a.lastStatus === "failure") return -1;
        if (b.lastStatus === "failure") return 1;
      }
      return a.jobName.localeCompare(b.jobName);
    });

  const auditFailuresList = auditRows
    .filter((a) => a.status === "failure")
    .map((a) => ({
      jobName: a.jobName,
      time: a.time,
      runTimeDisplay: new Date(a.time).toLocaleString(),
      rowsAffected: a.rowsAffected,
      message: a.detailsMessage ?? "—",
      durationMs: a.parsed.durationMs
    }));
  const cronFailuresList = runRows
    .filter((r) => r.status === "failure")
    .map((r) => ({
      jobName: r.jobName,
      time: r.time,
      runTimeDisplay: new Date(r.time).toLocaleString(),
      rowsAffected: r.rowsAffected,
      message: r.returnMessage ?? "—",
      durationMs: r.durationMs
    }));
  const failures = [...auditFailuresList, ...cronFailuresList]
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
    .map(({ time, ...rest }) => rest);

  const WARN_ZERO_ROWS = jobSummaries
    .filter((j) => j.rowsLast === 0 && j.lastStatus !== "failure")
    .map((j) => j.jobName);
  const WARN_UNKNOWN = jobSummaries
    .filter((j) => j.lastStatus === "unknown")
    .map((j) => j.jobName);
  const WARN_SLOW_MS = 60_000;
  const WARN_SLOW = jobSummaries
    .filter((j) => (j.lastDurationMs ?? 0) > WARN_SLOW_MS)
    .map((j) => ({ jobName: j.jobName, durationMs: j.lastDurationMs! }));

  const counts = {
    jobs: jobSummaries.length,
    auditRuns: auditRows.length,
    auditSuccesses: auditRows.filter((a) => a.status === "success").length,
    auditFailures: auditRows.filter((a) => a.status === "failure").length,
    auditUnknown: auditRows.filter((a) => a.status === "unknown").length,
    jobsOkLast: jobSummaries.filter((j) => j.lastStatus === "success").length,
    jobsFailingLast: jobSummaries.filter((j) => j.lastStatus === "failure")
      .length,
    jobsUnknownLast: jobSummaries.filter((j) => j.lastStatus === "unknown")
      .length,
    warnZeroRows: WARN_ZERO_ROWS.length,
    warnUnknown: WARN_UNKNOWN.length,
    warnSlow: WARN_SLOW.length
  };

  // 3. Send Cron Job Audit Email
  if (auditRows.length > 0) {
    const formattedAudits = auditRows.map((a) => ({
      job_name: a.jobName,
      run_time: a.time,
      rows_affected: a.rowsAffected,
      status: a.status,
      message: a.detailsMessage,
      duration_ms: a.parsed.durationMs
    }));

    try {
      const { data, error } = await resend.emails.send({
        from: "audit-report@fhfhockey.com",
        to: emailRecipient,
        subject:
          counts.auditFailures > 0
            ? `❌ Cron Job Audit — ${counts.auditFailures} failures`
            : `✅ Cron Job Audit — ${counts.auditSuccesses} successes`,
        react: CronAuditEmail({
          audits: formattedAudits,
          sinceDate: since,
          summary: counts
        })
      });

      if (error) {
        console.error("Resend error for audit email:", error.message);
        errors.push(`Audit email failed: ${error.message}`);
        auditEmailResult = { success: false, error: error.message };
      } else {
        auditEmailResult = { success: true, emailId: data?.id };
      }
    } catch (e: any) {
      console.error("Exception sending audit email:", e.message);
      errors.push(`Audit email exception: ${e.message}`);
      auditEmailResult = { success: false, error: e.message };
    }
  } else if (!auditErr) {
    auditEmailResult = { success: true, message: "No audit data to send." };
  }

  // 4. Prepare and Send Job Run Details Email (similar to your original logic)
  if (runRows.length > 0 || auditRows.length > 0) {
    try {
      const { data, error } = await resend.emails.send({
        from: "job-status@fhfhockey.com", // Can be a different 'from' address
        to: emailRecipient,
        subject:
          counts.jobsFailingLast > 0
            ? `❌ Daily Job Runs — ${counts.jobsFailingLast} failing jobs`
            : "✅ Daily Job Runs",
        react: CronReportEmail({
          sinceDate: since,
          summary: counts,
          jobs: jobSummaries,
          recentFailures: failures,
          fetchErrors: errors,
          warnings: {
            slowMsThreshold: WARN_SLOW_MS,
            zeroRowsJobs: WARN_ZERO_ROWS,
            unknownStatusJobs: WARN_UNKNOWN,
            slowJobs: WARN_SLOW
          }
        })
      });

      if (error) {
        console.error("Resend error for job run details email:", error.message);
        errors.push(`Job run details email failed: ${error.message}`);
        jobRunDetailsEmailResult = { success: false, error: error.message };
      } else {
        jobRunDetailsEmailResult = { success: true, emailId: data?.id };
      }
    } catch (e: any) {
      console.error("Exception sending job run details email:", e.message);
      errors.push(`Job run details email exception: ${e.message}`);
      jobRunDetailsEmailResult = { success: false, error: e.message };
    }
  } else if (!runErr) {
    jobRunDetailsEmailResult = {
      success: true,
      message: "No job run data to send."
    };
  }

  // 5. Return the result
  if (
    errors.length > 0 &&
    (!auditEmailResult?.success || !jobRunDetailsEmailResult?.success)
  ) {
    return res.status(500).json({
      message: "One or more operations failed.",
      errors,
      auditEmailResult,
      jobRunDetailsEmailResult
    });
  }

  return res.status(200).json({
    success: true,
    auditEmailResult,
    jobRunDetailsEmailResult
  });
}
