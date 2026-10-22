import * as React from "react";

import { formatExecutionDuration, isNearRepositoryLimit } from "lib/cron/reportMetrics";
import { formatReportTime } from "lib/cron/reportSource";

type BenchmarkAnnotation = { kind: string; note: string };

interface AuditEntry {
  key: string;
  label: string;
  jobName: string;
  status: "success" | "failure" | "unknown" | "disabled" | "continued";
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
  successHistory?: { since: string; until: string; complete: boolean; error: string | null };
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
const clean = (text: string) => text.replace(/\s+/g, " ").trim();
const concise = (text: string, max = 220) => clean(text).length > max ? `${clean(text).slice(0, max - 1)}…` : clean(text);
// Display times are "ISO / local"; the email shows the local half and compares the ISO half.
const isoOf = (display: string | null) => { const time = Date.parse(display?.split(" / ")[0] ?? ""); return Number.isFinite(time) ? time : null; };
const localOf = (display: string) => display.split(" / ")[1] ?? display;
const label = (row: AuditEntry) => row.status === "failure" ? "FAIL" : row.status === "continued" ? "CONTINUED / IN PROGRESS" : skipped(row) ? "SKIPPED / NO OUTPUT" : missing(row) ? "MISSING"
  : row.status === "success" ? (row.failedRows ?? 0) > 0 || (row.failedOperations ?? 0) > 0 ? "PARTIAL" : nearLimit(row) ? isNearRepositoryLimit(row.durationMs, row.repositoryLimitMs ?? null) ? "NEAR LIMIT" : "NEAR BUDGET" : "OK" : row.status.toUpperCase();
const details = (row: AuditEntry) => Array.from(new Set([
  row.reason && !row.reason.includes("Telemetry source unavailable") ? row.reason : null,
  ...(row.missingObservationWarnings ?? []).filter((warning) => !warning.includes("Telemetry source unavailable") && !warning.includes("timing metadata") && !warning.includes("Operation was skipped")),
].filter((value): value is string => Boolean(value))));
const LABEL_ORDER = ["MISSING", "PARTIAL", "NEAR LIMIT", "NEAR BUDGET", "CONTINUED / IN PROGRESS", "SKIPPED / NO OUTPUT", "UNKNOWN", "DISABLED"];

type FailureGroup = { jobName: string; rows: AuditEntry[]; latest: AuditEntry; lastSuccess: string | null; recovered: boolean };

export const CronAuditEmail: React.FC<CronAuditEmailProps> = ({ audits, sinceDate, untilDate, totalsComplete = true, fetchErrors = [], successHistory, summary }) => {
  const globalWarnings = Array.from(new Set([
    ...fetchErrors,
    ...audits.flatMap((row) => row.missingObservationWarnings ?? []).filter((warning) => warning.includes("Telemetry source unavailable")),
  ]));
  const muted: React.CSSProperties = { color: "#4B5563", fontSize: 12 };
  const red = "#991B1B";
  const amber = "#92400E";
  const number = (value: number | null) => value == null ? "Unknown" : value.toLocaleString("en-US");

  const metricJobs = summary.scheduledJobs == null ? null : summary.scheduledJobs - audits.filter((row) => row.observationKind !== "extra" && row.routePath === "/api/v1/db/cron-report").length;
  const errorTotalKnown = totalsComplete && metricJobs != null && summary.metricErrorsKnown != null && summary.metricErrorsKnown >= metricJobs;
  const writeTotalKnown = totalsComplete && metricJobs != null && summary.metricRowsKnown != null && summary.metricRowsKnown >= metricJobs;

  // One entry per failing job: repeated receipts collapse to a count, and a job
  // whose latest success is newer than its latest failure is listed as recovered.
  const failureGroups: FailureGroup[] = Array.from(audits.filter((row) => row.status === "failure").reduce((byJob, row) => {
    byJob.set(row.jobName, [...(byJob.get(row.jobName) ?? []), row]);
    return byJob;
  }, new Map<string, AuditEntry[]>())).map(([jobName, rows]) => {
    const latest = rows.reduce((best, row) => (isoOf(row.runTimeDisplay) ?? 0) > (isoOf(best.runTimeDisplay) ?? 0) ? row : best);
    const lastSuccess = rows.map((row) => row.lastKnownSuccessDisplay).filter((value): value is string => Boolean(value))
      .sort((a, b) => (isoOf(b) ?? 0) - (isoOf(a) ?? 0))[0] ?? null;
    const latestTime = isoOf(latest.runTimeDisplay);
    const successTime = isoOf(lastSuccess);
    return { jobName, rows, latest, lastSuccess, recovered: latestTime != null && successTime != null && successTime > latestTime };
  });
  const openFailures = failureGroups.filter((group) => !group.recovered);
  const recovered = failureGroups.filter((group) => group.recovered);

  // Non-failure exceptions collapse to one line per (status, cause), naming every job that shares it.
  const exceptionLines = Array.from(audits.filter((row) => row.status !== "failure" && label(row) !== "OK").reduce((byCause, row) => {
    const cause = details(row)[0] ?? (nearLimit(row) ? `${formatExecutionDuration(row.durationMs)} of ${formatExecutionDuration((isNearRepositoryLimit(row.durationMs, row.repositoryLimitMs ?? null) ? row.repositoryLimitMs : row.runtimeBudgetMs) ?? null)}` : "");
    const key = `${label(row)}|${cause}`;
    const entry = byCause.get(key) ?? { label: label(row), cause, jobs: [] as string[] };
    if (!entry.jobs.includes(row.jobName)) entry.jobs.push(row.jobName);
    byCause.set(key, entry);
    return byCause;
  }, new Map<string, { label: string; cause: string; jobs: string[] }>()).values())
    .sort((a, b) => LABEL_ORDER.indexOf(a.label) - LABEL_ORDER.indexOf(b.label));
  const healthyCount = audits.filter((row) => row.status !== "failure" && label(row) === "OK").length;

  const renderFailure = (group: FailureGroup) => {
    const row = group.latest;
    const noWrites = row.routePath === "/api/v1/db/cron-report";
    const causes = Array.from(new Set(group.rows.flatMap(details)));
    const samples = Array.from(new Set(group.rows.flatMap((entry) => entry.failedRowSamples)));
    const metrics = [
      row.durationMs != null ? `Elapsed: ${formatExecutionDuration(row.durationMs)}` : null,
      noWrites ? null : `Upserted: ${number(row.rowsUpserted)}`,
      noWrites ? null : `Error rows: ${number(row.failedRows)}`,
    ].filter(Boolean).join(" · ");
    return <div key={group.jobName} style={{ padding: "12px 14px", marginBottom: 10, border: "1px solid #E1E3E0", borderLeft: `3px solid ${red}`, borderRadius: 8, backgroundColor: "#FFFFFF", overflowWrap: "anywhere" }}>
      <div><strong style={{ color: red, fontSize: 12, marginRight: 8 }}>FAIL</strong>{" "}<strong style={{ fontSize: 15 }}>{group.jobName}</strong>
        {group.rows.length > 1 ? <span style={muted}> · {group.rows.length} failures</span> : null}
        {nearLimit(row) ? <strong style={{ color: amber, fontSize: 12 }}> · {isNearRepositoryLimit(row.durationMs, row.repositoryLimitMs ?? null) ? "NEAR LIMIT" : "NEAR BUDGET"}</strong> : null}</div>
      <div style={muted}>{localOf(row.runTimeDisplay)}{row.route && row.route !== row.jobName ? ` · ${row.method ?? ""} ${row.route}` : ""}</div>
      {causes.length > 0 ? causes.slice(0, 2).map((cause, index) => <div key={index} style={{ fontSize: 13, color: red, marginTop: 4 }}>{clean(cause)}</div>)
        : <div style={{ fontSize: 13, color: red, marginTop: 4 }}>No error message recorded; check the execution logs.</div>}
      {causes.length > 2 ? <div style={muted}>+{causes.length - 2} other error{causes.length === 3 ? "" : "s"}</div> : null}
      {samples.length > 0 ? <div style={{ ...muted, marginTop: 4 }}>Evidence: {samples.slice(0, 2).map((sample) => concise(sample)).join("; ")}</div> : null}
      {row.failedOperations != null && row.failedOperations > 0 ? <div style={{ color: red, fontSize: 13 }}>{row.failedOperations} failed operations; error-row count unknown.</div> : null}
      {metrics ? <div style={{ ...muted, marginTop: 4 }}>{metrics}{row.runtimeBudgetMs != null ? ` · Reported operation budget: ${formatExecutionDuration(row.runtimeBudgetMs)}` : ""}</div> : null}
      <div style={muted}>Last recorded success: {group.lastSuccess ? localOf(group.lastSuccess) : "Unknown; no matching success observed in the reported lookback."}</div>
    </div>;
  };

  const sectionTitle = (title: string) => <h2 style={{ fontSize: 16, margin: "22px 0 10px" }}>{title}</h2>;
  const hasFailures = summary.auditFailures > 0 || (summary.cronFailures ?? 0) > 0;
  const allRecovered = hasFailures && openFailures.length === 0 && recovered.length > 0 && !(summary.omittedFailureObservations ?? 0) && !(summary.cronFailures ?? 0);
  const headline = allRecovered ? "Earlier failures have recovered." : hasFailures ? "Failures need attention." : audits.length === 0 ? "Execution health is unknown." : !totalsComplete ? "Coverage needs attention." : exceptionLines.length > 0 ? "A few jobs need a look." : "Runs look healthy.";

  return <div style={{ backgroundColor: "#F7F7F2", fontFamily: "Arial, sans-serif", fontSize: 14, lineHeight: 1.5, color: "#202020", maxWidth: 640, margin: "0 auto", padding: 20 }}>
    <div style={{ borderTop: "4px solid #B45309", paddingTop: 16 }}>
      <div style={{ fontSize: 12, letterSpacing: "0.08em", fontWeight: 700, color: "#555950" }}>FHFH <span style={{ color: "#73766E", fontWeight: 400 }}> / OPERATIONS</span></div>
      <div style={{ ...muted, marginTop: 20 }}>Daily Cron Briefing</div>
      <h1 style={{ fontSize: 26, lineHeight: 1.15, letterSpacing: "-0.02em", margin: "6px 0 10px" }}>{headline}</h1>
      <div style={muted}>{localOf(formatReportTime(sinceDate))}{untilDate ? ` through ${localOf(formatReportTime(untilDate))}` : ""}</div>
    </div>
    {summary.scheduledJobs != null ? <div style={{ margin: "14px 0", fontSize: 14 }}>
      <strong>{`${summary.jobsFailingLast ?? 0} failed · ${summary.jobsMissingLast ?? 0} missing · ${summary.jobsUnknownLast ?? 0} unknown`}</strong>
      <span style={muted}>{` · ${summary.jobsOkLast ?? 0}/${summary.scheduledJobs} jobs recorded success`}</span>
    </div> : null}
    {globalWarnings.length > 0 || !totalsComplete ? <div style={{ margin: "16px 0", padding: "10px 14px", borderLeft: "3px solid #B45309", backgroundColor: "#FFF5DE", borderRadius: 6, color: "#783F10" }}>
      <strong style={{ fontSize: 13 }}>Telemetry coverage incomplete; totals unknown.</strong>
      {globalWarnings.map((warning, index) => <div key={index} style={{ fontSize: 12, marginTop: 4 }}>{concise(warning)}</div>)}
      <div style={{ fontSize: 12, marginTop: 4 }}>Missing receipts do not establish success.</div>
    </div> : null}

    {openFailures.length > 0 ? <>
      {sectionTitle("Needs attention")}
      {openFailures.map(renderFailure)}
      <div style={muted}><a href="https://vercel.com/fhfhockeydevs-projects/fhfhockey/logs" style={{ color: "#1D4ED8" }}>Inspect execution logs (sign in)</a> · search by route and the time shown.</div>
    </> : null}
    {(summary.omittedFailureObservations ?? 0) > 0 ? <p style={{ color: red, fontSize: 13 }}>{summary.omittedFailureObservations} additional failed observations are not listed; they remain in the counts.</p> : null}

    {recovered.length > 0 ? <>
      {sectionTitle("Recovered since failing")}
      {recovered.map((group) => <div key={group.jobName} style={{ fontSize: 13, padding: "6px 0", borderBottom: "1px solid #E1E3E0", overflowWrap: "anywhere" }}>
        <strong>{group.jobName}</strong>
        <span style={muted}>{` · failed ${localOf(group.latest.runTimeDisplay)}${group.rows.length > 1 ? ` (${group.rows.length}×)` : ""} · OK ${localOf(group.lastSuccess!)}`}</span>
        {details(group.latest)[0] ? <div style={muted}>{concise(details(group.latest)[0], 140)}</div> : null}
      </div>)}
    </> : null}

    {exceptionLines.length > 0 ? <>
      {sectionTitle("Worth a look")}
      {exceptionLines.map((line) => <div key={`${line.label}|${line.cause}`} style={{ fontSize: 13, padding: "6px 0", borderBottom: "1px solid #E1E3E0", overflowWrap: "anywhere" }}>
        <strong style={{ color: amber, fontSize: 12, marginRight: 6 }}>{line.label}</strong>
        <strong>{line.jobs.join(", ")}</strong>
        {line.cause ? <div style={muted}>{concise(line.cause, 260)}</div> : null}
      </div>)}
    </> : null}

    <p style={{ ...muted, marginTop: 18 }}>{healthyCount} healthy job{healthyCount === 1 ? "" : "s"}; not listed individually.</p>
    {audits.length === 0 ? <p>No job observations available.</p> : null}

    <div style={{ ...muted, borderTop: "1px solid #D9DDD4", paddingTop: 14, marginTop: 16 }}>
      <div>{summary.auditRuns} audit runs · {summary.auditSuccesses} successful · {totalsComplete ? `${summary.auditFailures} failed receipts` : `Failure total unknown (${summary.auditFailures} observed)`}
        {summary.cronFailures ? ` · ${summary.cronFailures} cron execution failure receipts` : ""}
        {` · Upserts: ${summary.metricRowsKnown === 0 ? "total unknown (0 confirmed observations)" : `${summary.totalRowsUpserted.toLocaleString("en-US")}${writeTotalKnown ? "" : " observed; total unknown"}`}`}
        {` · Error rows: ${errorTotalKnown ? `${summary.totalFailedRows.toLocaleString("en-US")} explicitly reported` : `total unknown (${summary.totalFailedRows.toLocaleString("en-US")} observed in ${summary.metricErrorsKnown ?? 0}/${metricJobs ?? "unknown"} applicable job receipts)`}`}
      </div>
      {successHistory ? <div style={{ marginTop: 4 }}>Success lookback {successHistory.since} – {successHistory.until}. {successHistory.complete ? "No match means unknown, not never succeeded." : "Lookup incomplete; latest success is unverified."}{successHistory.error ? ` ${concise(successHistory.error)}` : ""}</div> : null}
      <div style={{ marginTop: 4 }}>UTC window {sinceDate}{untilDate ? ` – ${untilDate}` : ""}. Counts are observations, not a transactional snapshot.</div>
    </div>
  </div>;
};
