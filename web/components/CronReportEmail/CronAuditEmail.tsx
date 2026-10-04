import * as React from "react";

import { formatExecutionDuration, isNearRepositoryLimit } from "lib/cron/reportMetrics";
import { formatReportTime } from "lib/cron/reportSource";

type BenchmarkAnnotation = { kind: string; note: string };

interface AuditEntry {
  key: string;
  label: string;
  jobName: string;
  status: "success" | "failure" | "unknown" | "disabled";
  runTimeDisplay: string;
  method: string | null;
  route: string | null;
  routePath: string | null;
  targetTable: string | null;
  statusCode: number | null;
  durationMs: number | null;
  rowsUpserted: number | null;
  rowsAffected: number | null;
  failedRows: number | null;
  failedOperations?: number | null;
  repositoryLimitMs?: number | null;
  runtimeBudgetMs?: number | null;
  timingProvenance?: string;
  observedExecutionStatus?: "success" | "failure" | "unknown" | "missing" | "disabled";
  observationKind?: "scheduled" | "extra";
  reason: string | null;
  lastKnownSuccessDisplay: string | null;
  failedRowSamples: string[];
  optimizationDenotation?: string | null;
  benchmarkAnnotations?: BenchmarkAnnotation[];
  missingObservationWarnings?: string[];
}

interface CronAuditEmailProps {
  audits: AuditEntry[];
  sinceDate: string;
  untilDate?: string;
  totalsComplete?: boolean;
  fetchErrors?: string[];
  summary: {
    scheduledJobs?: number;
    jobsOkLast?: number;
    jobsFailingLast?: number;
    jobsMissingLast?: number;
    jobsUnknownLast?: number;
    childObservations?: number;
    metricRowsKnown?: number;
    metricErrorsKnown?: number;
    auditRuns: number;
    auditSuccesses: number;
    auditFailures: number;
    cronFailures?: number;
    omittedFailureObservations?: number;
    auditUnknown: number;
    auditDisabled?: number;
    slowJobDenotation?: string;
    slowMsThreshold?: number | null;
    annotatedJobCount?: number;
    slowRuns?: number;
    missingObservationRuns?: number;
    totalRowsUpserted: number;
    totalFailedRows: number;
  };
}

const skipped = (row: AuditEntry) => (row.missingObservationWarnings ?? []).some((warning) => warning.includes("Operation was skipped"));
const missing = (row: AuditEntry) => row.status === "unknown" && (row.missingObservationWarnings ?? []).some((warning) => warning.includes("No cron or audit observation matched"));
const nearLimit = (row: AuditEntry) => isNearRepositoryLimit(row.durationMs, row.repositoryLimitMs ?? null) || isNearRepositoryLimit(row.durationMs, row.runtimeBudgetMs ?? null);
const priority = (row: AuditEntry) => row.status === "failure" ? 0 : nearLimit(row) ? 1 : row.status === "unknown" || skipped(row) || (row.failedRows ?? 0) > 0 ? 2 : row.status === "disabled" ? 3 : 4;
const clean = (text: string) => text.replace(/\s+/g, " ").trim();
const concise = (text: string) => clean(text).length > 220 ? `${clean(text).slice(0, 219)}…` : clean(text);

export const CronAuditEmail: React.FC<CronAuditEmailProps> = ({ audits, sinceDate, untilDate, totalsComplete = true, fetchErrors = [], summary }) => {
  const rows = audits.map((row, index) => ({ row, index })).sort((a, b) => priority(a.row) - priority(b.row) || a.index - b.index).map(({ row }) => row);
  const globalWarnings = Array.from(new Set([
    ...fetchErrors,
    ...audits.flatMap((row) => row.missingObservationWarnings ?? []).filter((warning) => warning.includes("Telemetry source unavailable")),
  ]));
  const metricStyle: React.CSSProperties = { display: "inline-block", minWidth: 76, marginRight: 8, marginTop: 6, verticalAlign: "top" };
  const muted: React.CSSProperties = { color: "#4B5563", fontSize: 12 };
  const metric = (label: string, value: string) => <span style={metricStyle}><span style={{ ...muted, display: "block" }}>{label}: </span><strong>{value}</strong>{" · "}</span>;
  const number = (value: number | null) => value == null ? "Unknown" : value.toLocaleString("en-US");

  const metricJobs = summary.scheduledJobs == null ? null : summary.scheduledJobs - audits.filter((row) => row.observationKind !== "extra" && row.routePath === "/api/v1/db/cron-report").length;
  const errorTotalKnown = totalsComplete && metricJobs != null && summary.metricErrorsKnown != null && summary.metricErrorsKnown >= metricJobs;
  const writeTotalKnown = totalsComplete && metricJobs != null && summary.metricRowsKnown != null && summary.metricRowsKnown >= metricJobs;

  const renderJobs = (group: AuditEntry[], compact: boolean) => <table role="presentation" style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}><tbody>
      {group.map((row) => {
        const isSkipped = skipped(row);
        const label = row.status === "failure" ? "FAIL" : isSkipped ? "SKIPPED / NO OUTPUT" : missing(row) ? "MISSING" : row.status === "success" ? (row.failedRows ?? 0) > 0 ? "PARTIAL" : "OK" : row.status.toUpperCase();
        const color = row.status === "failure" ? "#991B1B" : row.status === "success" && !isSkipped ? "#166534" : "#92400E";
        const warnings = (row.missingObservationWarnings ?? []).filter((warning) => !warning.includes("Telemetry source unavailable") && !warning.includes("timing metadata") && !warning.includes("Operation was skipped"));
        const reason = row.reason && !row.reason.includes("Telemetry source unavailable") ? row.reason : null;
        const details = Array.from(new Set([reason, ...warnings].filter((value): value is string => Boolean(value))));
        const noWrites = row.routePath === "/api/v1/db/cron-report";
        return <tr key={row.key}><td style={{ padding: "0 0 10px", overflowWrap: "anywhere" }}>
          <div style={{ padding: compact ? "12px 0" : 18, border: compact ? "none" : "1px solid #E1E3E0", borderBottom: compact ? "1px solid #E1E3E0" : "1px solid #E1E3E0", borderRadius: compact ? 0 : 12, backgroundColor: compact ? "transparent" : "#FFFFFF" }}>
          <div><strong style={{ color, fontSize: 12, marginRight: 8 }}>{label}</strong>{" "}<strong style={{ fontSize: compact ? 14 : 17 }}>{row.jobName}</strong>{nearLimit(row) ? <strong style={{ color: "#92400E", fontSize: 12 }}> · {isNearRepositoryLimit(row.durationMs, row.repositoryLimitMs ?? null) ? "NEAR LIMIT" : "NEAR BUDGET"}</strong> : null}</div>
          <div style={{ ...muted, marginTop: 4 }}>{row.observationKind === "extra" ? "Extra/child observation · " : ""}{row.runTimeDisplay}</div>
          {row.route && row.route !== row.jobName ? <div style={muted}>{row.method ?? ""} {row.route}</div> : null}
          <div>
            {metric("Elapsed", formatExecutionDuration(row.durationMs))}
            {metric("Upserted", noWrites ? "N/A" : number(row.rowsUpserted))}
            {metric("Error rows", noWrites ? "N/A" : number(row.failedRows))}
          </div>
          <div style={{ ...muted, marginTop: 4 }}>Timing: {row.timingProvenance ?? "Unknown; measurement scope unverified"}.</div>
          <div style={muted}>Repo route limit: {row.repositoryLimitMs == null ? "Unknown" : formatExecutionDuration(row.repositoryLimitMs)}; deployed override unverified.
            {row.runtimeBudgetMs != null ? ` Reported operation budget: ${formatExecutionDuration(row.runtimeBudgetMs)}.` : ""}
          </div>
          {row.status === "unknown" && row.observedExecutionStatus === "success" ? <div style={muted}>Observed route receipt: success; scheduled health remains unknown while telemetry is incomplete.</div> : null}
          {row.failedOperations != null && row.failedOperations > 0 ? <div style={{ color: "#991B1B", fontSize: 13 }}>{row.failedOperations} failed operations; error-row count unknown.</div> : null}
          {details.map((detail, index) => <div key={index} style={{ fontSize: 13, color: row.status === "failure" ? "#991B1B" : "#4B5563", marginTop: 4 }}>{row.status === "failure" ? clean(detail) : concise(detail)}</div>)}
          {priority(row) < 4 && (row.benchmarkAnnotations ?? []).length > 0 ? <div style={{ ...muted, marginTop: 4 }}>Benchmark: {concise(row.benchmarkAnnotations![0].note)}</div> : null}
          {row.failedRowSamples.length > 0 ? <div style={{ ...muted, marginTop: 4 }}>Evidence: {row.failedRowSamples.slice(0, 2).map(concise).join("; ")}</div> : null}
          {row.status === "failure" ? <div style={{ ...muted, marginTop: 6 }}><a href="https://vercel.com/fhfhockeydevs-projects/fhfhockey/logs" style={{ color: "#1D4ED8" }}>Inspect execution logs (sign in)</a>{" · Use the route and UTC time above."}</div> : null}
          {row.status === "failure" && row.lastKnownSuccessDisplay ? <div style={muted}>Last recorded success: {row.lastKnownSuccessDisplay}</div> : null}
          </div>
        </td></tr>;
      })}
    </tbody></table>;
  const attention = rows.filter((row) => priority(row) < 2);
  const other = rows.filter((row) => priority(row) >= 2);
  const hasFailures = summary.auditFailures > 0 || (summary.cronFailures ?? 0) > 0;
  const headline = hasFailures ? "Failures need attention." : rows.length === 0 ? "Execution health is unknown." : !totalsComplete ? "Coverage needs attention." : rows.some((row) => priority(row) < 4) ? "A few jobs need a look." : "Runs look healthy.";

  return <div style={{ backgroundColor: "#F7F7F2", fontFamily: "Arial, sans-serif", fontSize: 14, lineHeight: 1.5, color: "#202020", maxWidth: 640, margin: "0 auto", padding: 20 }}>
    <div style={{ borderTop: "4px solid #B45309", paddingTop: 16 }}>
      <div style={{ fontSize: 12, letterSpacing: "0.08em", fontWeight: 700, color: "#555950" }}>FHFH <span style={{ color: "#73766E", fontWeight: 400 }}> / OPERATIONS</span></div>
      <div style={{ ...muted, marginTop: 20 }}>Daily Cron Briefing</div>
      <h1 style={{ fontSize: 28, lineHeight: 1.15, letterSpacing: "-0.02em", margin: "6px 0 12px" }}>{headline}</h1>
      <div style={muted}>{formatReportTime(sinceDate).split(" / ")[1] ?? formatReportTime(sinceDate)}{untilDate ? ` through ${formatReportTime(untilDate).split(" / ")[1] ?? formatReportTime(untilDate)}` : ""}</div>
    </div>
    {summary.scheduledJobs != null ? <div style={{ margin: "16px 0", fontSize: 14 }}>
      <strong>{`${summary.jobsFailingLast ?? 0} failed · ${summary.jobsMissingLast ?? 0} missing · ${summary.jobsUnknownLast ?? 0} unknown`}</strong>
      <div style={{ ...muted, marginTop: 4 }}>{summary.jobsOkLast ?? 0}/{summary.scheduledJobs} jobs recorded success</div>
    </div> : null}
    {globalWarnings.length > 0 || !totalsComplete ? <div style={{ margin: "20px 0", padding: "12px 14px", borderLeft: "3px solid #B45309", backgroundColor: "#FFF5DE", borderRadius: 6, color: "#783F10" }}>
      <strong style={{ fontSize: 13 }}>Telemetry coverage incomplete; totals unknown.</strong>
      {globalWarnings.map((warning, index) => <div key={index} style={{ fontSize: 12, marginTop: 4 }}>{concise(warning)}</div>)}
      <div style={{ fontSize: 12, marginTop: 4 }}>Known failures remain visible. Missing receipts do not establish success.</div>
    </div> : null}
    {(summary.omittedFailureObservations ?? 0) > 0 ? <p style={{ color: "#991B1B", fontSize: 13 }}>{summary.omittedFailureObservations} additional failed observations are omitted from the compact detail list. All observed failure receipts remain in the counts.</p> : null}
    {attention.length > 0 ? <>
      <h2 style={{ fontSize: 17, margin: "24px 0 12px" }}>Needs attention</h2>
      {renderJobs(attention, false)}
    </> : null}
    {other.length > 0 ? <>
      <h2 style={{ fontSize: 17, margin: "24px 0 4px" }}>Other job results</h2>
      <div style={{ ...muted, marginBottom: 12 }}>Every remaining job, including healthy and skipped runs.</div>
      {renderJobs(other, true)}
    </> : null}
    {rows.length === 0 ? <p>No job observations available.</p> : null}
    <div style={{ ...muted, borderTop: "1px solid #D9DDD4", paddingTop: 18, marginTop: 20 }}>
      <strong style={{ color: "#30372B" }}>Coverage &amp; metric notes</strong>
      <div style={{ marginTop: 6 }}>{summary.auditRuns} observed audit runs · {summary.auditSuccesses} successful receipts · {totalsComplete ? `${summary.auditFailures} failed execution receipts` : `Failure total unknown (${summary.auditFailures} observed)`}
        {summary.cronFailures ? ` · ${summary.cronFailures} cron execution failure receipts` : ""}
        {summary.childObservations != null ? ` · ${summary.childObservations} extra/child observations` : ""}
      </div>
      <div style={{ marginTop: 6 }}>Receipts can overlap; these are not distinct failed jobs.</div>
      <div style={{ marginTop: 6 }}>Confirmed upserts: {summary.metricRowsKnown === 0 ? "total unknown (0 confirmed observations)" : `${summary.totalRowsUpserted.toLocaleString("en-US")} observed in latest scheduled receipts${writeTotalKnown ? "" : "; overall total unknown"}`}
        {summary.metricRowsKnown != null ? ` (${summary.metricRowsKnown}/${summary.scheduledJobs ?? 0} jobs report confirmed counts)` : ""}
        {` · Error rows: ${errorTotalKnown ? `${summary.totalFailedRows.toLocaleString("en-US")} explicitly reported` : `total unknown (${summary.totalFailedRows.toLocaleString("en-US")} observed in ${summary.metricErrorsKnown ?? 0}/${metricJobs ?? "unknown"} applicable job receipts)`}`}
      </div>
      <div style={{ marginTop: 6 }}>Unknown = evidence unavailable; N/A = metric does not apply; 0 = verified zero.</div>
      <div style={{ marginTop: 6 }}>UTC window: {sinceDate}{untilDate ? ` through ${untilDate}` : ""}</div>
      <div style={{ marginTop: 6 }}>Counts describe observations during collection; mutable cron history is not a transactional snapshot.</div>
    </div>
  </div>;
};
