import * as React from "react";

import { formatDurationMsToMMSS } from "lib/cron/formatDuration";

type JobStatus = "success" | "failure" | "unknown" | "missing";
type BenchmarkAnnotation = { kind: string; note: string };

interface JobRow {
  jobKey: string;
  displayName: string;
  lastStatus: JobStatus;
  lastStatusSource: "audit" | "cron" | "missing" | "unknown";
  scheduleTimeDisplay: string;
  expectedRunDisplay: string;
  lastRunDisplay: string;
  method: string;
  route: string | null;
  statusCode: number | null;
  why: string | null;
  note: string | null;
  okCount24h: number;
  failCount24h: number;
  rowsUpsertedLast: number | null;
  failedRowsLast: number | null;
  failedRowSamples: string[];
  lastDurationMs: number | null;
  optimizationDenotation?: string | null;
  benchmarkAnnotations?: BenchmarkAnnotation[];
  missingObservationWarnings?: string[];
}

interface RunDigest {
  key: string;
  label: string;
  jobName: string;
  status: "success" | "failure" | "unknown";
  runTimeDisplay: string;
  method: string | null;
  route: string | null;
  statusCode: number | null;
  durationMs: number | null;
  rowsUpserted: number | null;
  rowsAffected: number | null;
  failedRows: number | null;
  reason: string | null;
  failedRowSamples: string[];
}

interface CronReportEmailProps {
  sinceDate: string;
  summary: {
    scheduledJobs: number;
    scheduledJobsWithActivity: number;
    auditRuns: number;
    auditSuccesses: number;
    auditFailures: number;
    auditUnknown: number;
    jobsOkLast: number;
    jobsFailingLast: number;
    jobsMissingLast: number;
    jobsUnknownLast: number;
    unscheduledRuns: number;
    totalRowsUpserted: number;
    totalFailedRows: number;
    warnSlow: number;
    warnPartialFailure: number;
    warnMissingAudit: number;
  };
  jobs: JobRow[];
  failureHighlights: JobRow[];
  missingJobs: JobRow[];
  unscheduledRuns: RunDigest[];
  fetchErrors: string[];
  warnings: {
    slowMsThreshold: number;
    slowJobDenotation?: string;
    slowJobs: Array<{
      displayName: string;
      durationMs: number;
      timer?: string;
      denotation?: string;
    }>;
    partialFailureJobs: Array<{ displayName: string; failedRows: number }>;
    missingAuditJobs: string[];
    missingObservationJobs?: Array<{ displayName: string; warnings: string[] }>;
  };
}

export const CronReportEmail: React.FC<CronReportEmailProps> = ({
  sinceDate,
  summary,
  jobs,
  failureHighlights,
  missingJobs,
  unscheduledRuns,
  fetchErrors,
  warnings
}) => {
  const container: React.CSSProperties = {
    fontFamily: "system-ui, sans-serif",
    lineHeight: 1.4
  };
  const telemetryUnavailable =
    fetchErrors.length > 0 &&
    summary.scheduledJobsWithActivity === 0 &&
    summary.auditRuns === 0 &&
    summary.unscheduledRuns === 0;

  const renderTable = (children: React.ReactNode) => (
    <table
      style={{ borderCollapse: "collapse", width: "100%" }}
      border={1}
      cellPadding={6}
    >
      {children}
    </table>
  );

  const pill = (
    label: string,
    colors: { background: string; color: string }
  ) => (
    <span
      style={{
        display: "inline-block",
        marginRight: 6,
        marginTop: 4,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: colors.background,
        color: colors.color
      }}
    >
      {label}
    </span>
  );

  const renderDuration = (durationMs: number | null) =>
    typeof durationMs === "number" ? (
      <div>
        <div style={{ fontWeight: 700 }}>{formatDurationMsToMMSS(durationMs)}</div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>
          {Math.round(durationMs / 1000)}s
        </div>
      </div>
    ) : (
      "—"
    );

  const badge = (
    status: JobStatus | RunDigest["status"],
    source?: "audit" | "cron" | "missing" | "unknown"
  ) => {
    const common: React.CSSProperties = {
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700
    };
    const sourceNote =
      source === "audit"
        ? " (audit)"
        : source === "cron"
          ? " (cron)"
          : source === "missing"
            ? " (missing)"
            : "";

    if (status === "failure") {
      return (
        <span style={{ ...common, background: "#FEE2E2", color: "#991B1B" }}>
          FAIL{sourceNote}
        </span>
      );
    }
    if (status === "missing") {
      return (
        <span style={{ ...common, background: "#FEF3C7", color: "#92400E" }}>
          MISSING{sourceNote}
        </span>
      );
    }
    if (status === "success") {
      return (
        <span style={{ ...common, background: "#DCFCE7", color: "#166534" }}>
          OK{sourceNote}
        </span>
      );
    }
    return (
      <span style={{ ...common, background: "#E5E7EB", color: "#374151" }}>
        UNKNOWN{sourceNote}
      </span>
    );
  };

  const renderReasonCell = (
    reason: string | null,
    samples: string[],
    tone: "danger" | "neutral" = "neutral"
  ) => (
    <td style={tone === "danger" ? { color: "#991B1B" } : undefined}>
      <div>{reason ?? "—"}</div>
      {samples.length > 0 ? (
        <div style={{ marginTop: 4, fontSize: 12, color: "#4B5563" }}>
          Samples: {samples.join(" ; ")}
        </div>
      ) : null}
    </td>
  );

  return (
    <div style={container}>
      <h1 style={{ margin: "0 0 8px" }}>Daily Cron Summary — last 24 hrs</h1>
      <div style={{ margin: "0 0 12px", color: "#374151" }}>
        Since {new Date(sinceDate).toLocaleString()} • {summary.scheduledJobs} scheduled jobs
        • {summary.scheduledJobsWithActivity} observed •{" "}
        <span style={{ color: summary.jobsFailingLast ? "#991B1B" : "#166534" }}>
          {summary.jobsFailingLast} failing
        </span>{" "}
        • {summary.jobsMissingLast} missing • {summary.jobsOkLast} ok
        {summary.jobsUnknownLast ? ` • ${summary.jobsUnknownLast} unknown` : ""}
        <br />
        {summary.auditRuns} audit runs • {summary.auditSuccesses} successes •{" "}
        <span style={{ color: summary.auditFailures ? "#991B1B" : "#166534" }}>
          {summary.auditFailures} failures
        </span>
        {summary.auditUnknown ? ` • ${summary.auditUnknown} unknown` : ""}
        <br />
        {summary.totalRowsUpserted.toLocaleString()} rows upserted •{" "}
        {summary.totalFailedRows.toLocaleString()} failed rows •{" "}
        {summary.unscheduledRuns} unscheduled observations
      </div>

      {telemetryUnavailable ? (
        <div
          style={{
            margin: "0 0 16px",
            padding: "12px 14px",
            border: "1px solid #FCA5A5",
            background: "#FEF2F2",
            color: "#991B1B"
          }}
        >
          Cron telemetry was unavailable for this report window, so scheduled job status
          could not be evaluated. This email is reporting collection failure, not job
          execution health.
        </div>
      ) : null}

      {warnings.slowJobs.length > 0 ||
      warnings.partialFailureJobs.length > 0 ||
      warnings.missingAuditJobs.length > 0 ? (
        <div style={{ margin: "0 0 16px" }}>
          <div style={{ fontWeight: 800 }}>Attention</div>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
            {warnings.slowJobs.slice(0, 6).map((job) => (
              <li key={`slow-${job.displayName}`}>
                {job.denotation ?? warnings.slowJobDenotation ?? "Slow"}: {job.displayName} (
                {job.timer ?? formatDurationMsToMMSS(job.durationMs)}, threshold{" "}
                {formatDurationMsToMMSS(warnings.slowMsThreshold)})
              </li>
            ))}
            {warnings.partialFailureJobs.slice(0, 6).map((job) => (
              <li key={`partial-${job.displayName}`}>
                Partial success: {job.displayName} returned {job.failedRows} failed rows.
              </li>
            ))}
            {(warnings.missingObservationJobs ?? []).slice(0, 6).map((job) => (
              <li key={`missing-observation-${job.displayName}`}>
                Observation gap: {job.displayName} ({job.warnings[0] ?? "Missing cron telemetry."})
              </li>
            ))}
            {warnings.missingAuditJobs.slice(0, 6).map((job) => (
              <li key={`missing-audit-${job}`}>
                No audit row: {job}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {fetchErrors.length > 0 ? (
        <div style={{ margin: "0 0 16px" }}>
          <div style={{ fontWeight: 700, color: "#991B1B" }}>Report errors</div>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "#991B1B" }}>
            {fetchErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!telemetryUnavailable && failureHighlights.length > 0 ? (
        <>
          <h2 style={{ margin: "16px 0 8px", color: "#991B1B" }}>
            Failures requiring attention
          </h2>
          {renderTable(
            <>
              <thead>
                <tr style={{ background: "#F9FAFB" }}>
                  <th align="left">Scheduled</th>
                  <th align="left">Expected</th>
                  <th align="left">Last Run</th>
                  <th align="left">Route</th>
                  <th align="right">HTTP</th>
                  <th align="right">Duration</th>
                  <th align="right">Upserted</th>
                  <th align="right">Failed Rows</th>
                  <th align="left">Why</th>
                </tr>
              </thead>
              <tbody>
                {failureHighlights.map((job) => (
                  <tr key={job.jobKey} style={{ background: "#FEF2F2" }}>
                    <td style={{ fontWeight: 700 }}>{job.displayName}</td>
                    <td>{job.expectedRunDisplay}</td>
                    <td>{job.lastRunDisplay}</td>
                    <td>
                      <div>{job.route ?? "SQL"}</div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>
                        {job.method} • {job.scheduleTimeDisplay}
                      </div>
                    </td>
                    <td align="right">{job.statusCode ?? "—"}</td>
                    <td align="right">{renderDuration(job.lastDurationMs)}</td>
                    <td align="right">{job.rowsUpsertedLast ?? "—"}</td>
                    <td align="right">{job.failedRowsLast ?? "—"}</td>
                    {renderReasonCell(job.why ?? job.note, job.failedRowSamples, "danger")}
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </>
      ) : !telemetryUnavailable ? (
        <div style={{ margin: "12px 0", color: "#166534", fontWeight: 700 }}>
          No scheduled job failures in this period.
        </div>
      ) : null}

      {!telemetryUnavailable && missingJobs.length > 0 ? (
        <>
          <h2 style={{ margin: "16px 0 8px", color: "#92400E" }}>
            Missing scheduled runs
          </h2>
          {renderTable(
            <>
              <thead>
                <tr style={{ background: "#F9FAFB" }}>
                  <th align="left">Scheduled</th>
                  <th align="left">Expected</th>
                  <th align="left">Route</th>
                  <th align="left">Note</th>
                </tr>
              </thead>
              <tbody>
                {missingJobs.map((job) => (
                  <tr key={job.jobKey} style={{ background: "#FFFBEB" }}>
                    <td style={{ fontWeight: 700 }}>{job.displayName}</td>
                    <td>{job.expectedRunDisplay}</td>
                    <td>{job.route ?? "SQL"}</td>
                    <td>{job.note ?? "No matching cron or audit row was found."}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </>
      ) : null}

      {!telemetryUnavailable && unscheduledRuns.length > 0 ? (
        <>
          <h2 style={{ margin: "16px 0 8px" }}>Unscheduled activity</h2>
          {renderTable(
            <>
              <thead>
                <tr style={{ background: "#F9FAFB" }}>
                  <th align="left">Status</th>
                  <th align="left">Observed Job</th>
                  <th align="left">Run Time</th>
                  <th align="left">Route</th>
                  <th align="right">HTTP</th>
                  <th align="right">Duration</th>
                  <th align="right">Upserted</th>
                  <th align="right">Failed Rows</th>
                  <th align="left">Reason</th>
                </tr>
              </thead>
              <tbody>
                {unscheduledRuns.slice(0, 12).map((run) => (
                  <tr key={run.key}>
                    <td>{badge(run.status)}</td>
                    <td style={{ fontWeight: 700 }}>{run.jobName}</td>
                    <td>{run.runTimeDisplay}</td>
                    <td>
                      <div>{run.route ?? run.label}</div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>
                        {run.method ?? "—"}
                      </div>
                    </td>
                    <td align="right">{run.statusCode ?? "—"}</td>
                    <td align="right">{renderDuration(run.durationMs)}</td>
                    <td align="right">{run.rowsUpserted ?? run.rowsAffected ?? "—"}</td>
                    <td align="right">{run.failedRows ?? "—"}</td>
                    {renderReasonCell(run.reason, run.failedRowSamples)}
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </>
      ) : null}

      {!telemetryUnavailable ? (
        <>
          <h2 style={{ margin: "16px 0 8px" }}>Scheduled job status</h2>
          {renderTable(
            <>
              <thead>
                <tr style={{ background: "#F9FAFB" }}>
                  <th align="left">Status</th>
                  <th align="left">Scheduled</th>
                  <th align="left">Expected</th>
                  <th align="left">Last Run</th>
                  <th align="left">Route</th>
                  <th align="right">HTTP</th>
                  <th align="right">Duration</th>
                  <th align="right">Upserted</th>
                  <th align="right">Failed Rows</th>
                  <th align="right">OK</th>
                  <th align="right">Fail</th>
                  <th align="left">Note</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr
                    key={job.jobKey}
                    style={
                      job.lastStatus === "failure"
                        ? { background: "#FEF2F2" }
                        : job.lastStatus === "missing"
                          ? { background: "#FFFBEB" }
                          : undefined
                    }
                  >
                    <td>{badge(job.lastStatus, job.lastStatusSource)}</td>
                    <td style={{ fontWeight: 700 }}>{job.displayName}</td>
                    <td>{job.expectedRunDisplay}</td>
                    <td>{job.lastRunDisplay}</td>
                    <td>
                      <div>{job.route ?? "SQL"}</div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>
                        {job.method} • {job.scheduleTimeDisplay}
                      </div>
                    </td>
                    <td align="right">{job.statusCode ?? "—"}</td>
                    <td align="right">{renderDuration(job.lastDurationMs)}</td>
                    <td align="right">{job.rowsUpsertedLast ?? "—"}</td>
                    <td align="right">{job.failedRowsLast ?? "—"}</td>
                    <td align="right">{job.okCount24h}</td>
                    <td align="right">{job.failCount24h}</td>
                    <td>
                      <div>{job.note ?? job.why ?? "—"}</div>
                      {job.optimizationDenotation
                        ? pill(job.optimizationDenotation, {
                            background: "#FEE2E2",
                            color: "#991B1B"
                          })
                        : null}
                      {(job.benchmarkAnnotations ?? [])
                        .filter((annotation) =>
                          ["bottleneck", "rate_limited", "side_effect"].includes(
                            annotation.kind
                          )
                        )
                        .slice(0, 2)
                        .map((annotation) => (
                          <React.Fragment key={`${job.jobKey}-${annotation.kind}`}>
                            {pill(annotation.kind.replace(/_/g, " ").toUpperCase(), {
                              background: "#E0F2FE",
                              color: "#075985"
                            })}
                          </React.Fragment>
                        ))}
                      {(job.missingObservationWarnings ?? []).length > 0 ? (
                        <div style={{ marginTop: 4, fontSize: 12, color: "#92400E" }}>
                          Observation gaps: {job.missingObservationWarnings?.join(" ")}
                        </div>
                      ) : null}
                      {(job.benchmarkAnnotations ?? []).length > 0 ? (
                        <div style={{ marginTop: 4, fontSize: 12, color: "#4B5563" }}>
                          Benchmark: {job.benchmarkAnnotations?.map((annotation) => annotation.note).join(" ")}
                        </div>
                      ) : null}
                      {job.failedRowSamples.length > 0 ? (
                        <div style={{ marginTop: 4, fontSize: 12, color: "#4B5563" }}>
                          Samples: {job.failedRowSamples.join(" ; ")}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </>
      ) : null}
    </div>
  );
};
