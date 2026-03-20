import * as React from "react";

import { formatDurationMsToMMSS } from "lib/cron/formatDuration";

type BenchmarkAnnotation = { kind: string; note: string };

interface AuditEntry {
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
  optimizationDenotation?: string | null;
  benchmarkAnnotations?: BenchmarkAnnotation[];
  missingObservationWarnings?: string[];
}

interface CronAuditEmailProps {
  audits: AuditEntry[];
  sinceDate: string;
  summary: {
    auditRuns: number;
    auditSuccesses: number;
    auditFailures: number;
    auditUnknown: number;
    slowJobDenotation?: string;
    slowMsThreshold?: number;
    annotatedJobCount?: number;
    slowRuns?: number;
    missingObservationRuns?: number;
    totalRowsUpserted: number;
    totalFailedRows: number;
  };
}

export const CronAuditEmail: React.FC<CronAuditEmailProps> = ({
  audits,
  sinceDate,
  summary
}) => {
  const failures = audits.filter((audit) => audit.status === "failure");
  const nonFailures = audits.filter((audit) => audit.status !== "failure");

  const container: React.CSSProperties = {
    fontFamily: "system-ui, sans-serif",
    lineHeight: 1.4
  };

  const badge = (status: AuditEntry["status"]) => {
    const common: React.CSSProperties = {
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700
    };

    if (status === "failure") {
      return (
        <span style={{ ...common, background: "#FEE2E2", color: "#991B1B" }}>
          FAIL
        </span>
      );
    }
    if (status === "success") {
      return (
        <span style={{ ...common, background: "#DCFCE7", color: "#166534" }}>
          OK
        </span>
      );
    }
    return (
      <span style={{ ...common, background: "#E5E7EB", color: "#374151" }}>
        UNKNOWN
      </span>
    );
  };

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

  const renderTable = (rows: AuditEntry[]) => (
    <table
      style={{ borderCollapse: "collapse", width: "100%" }}
      border={1}
      cellPadding={6}
    >
      <thead>
        <tr style={{ background: "#F9FAFB" }}>
          <th align="left">Status</th>
          <th align="left">Job</th>
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
        {rows.map((audit) => (
          <tr
            key={audit.key}
            style={
              audit.status === "failure"
                ? { background: "#FEF2F2" }
                : undefined
            }
          >
            <td>{badge(audit.status)}</td>
            <td style={{ fontWeight: 700 }}>{audit.jobName}</td>
            <td>{audit.runTimeDisplay}</td>
            <td>
              <div>{audit.route ?? audit.label}</div>
              <div style={{ fontSize: 12, color: "#6B7280" }}>
                {audit.method ?? "—"}
              </div>
            </td>
            <td align="right">{audit.statusCode ?? "—"}</td>
            <td align="right">{renderDuration(audit.durationMs)}</td>
            <td align="right">{audit.rowsUpserted ?? audit.rowsAffected ?? "—"}</td>
            <td align="right">{audit.failedRows ?? "—"}</td>
            <td>
              <div>{audit.reason ?? "—"}</div>
              {audit.optimizationDenotation
                ? pill(audit.optimizationDenotation, {
                    background: "#FEE2E2",
                    color: "#991B1B"
                  })
                : null}
              {(audit.benchmarkAnnotations ?? [])
                .filter((annotation) =>
                  ["bottleneck", "rate_limited", "side_effect"].includes(
                    annotation.kind
                  )
                )
                .slice(0, 2)
                .map((annotation) => (
                  <React.Fragment key={`${audit.key}-${annotation.kind}`}>
                    {pill(annotation.kind.replace(/_/g, " ").toUpperCase(), {
                      background: "#E0F2FE",
                      color: "#075985"
                    })}
                  </React.Fragment>
                ))}
              {(audit.missingObservationWarnings ?? []).length > 0 ? (
                <div style={{ marginTop: 4, fontSize: 12, color: "#92400E" }}>
                  Observation gaps: {audit.missingObservationWarnings?.join(" ")}
                </div>
              ) : null}
              {(audit.benchmarkAnnotations ?? []).length > 0 ? (
                <div style={{ marginTop: 4, fontSize: 12, color: "#4B5563" }}>
                  Benchmark:{" "}
                  {audit.benchmarkAnnotations?.map((annotation) => annotation.note).join(" ")}
                </div>
              ) : null}
              {audit.failedRowSamples.length > 0 ? (
                <div style={{ marginTop: 4, fontSize: 12, color: "#4B5563" }}>
                  Samples: {audit.failedRowSamples.join(" ; ")}
                </div>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div style={container}>
      <h1 style={{ margin: "0 0 8px" }}>Cron Audit — last 24 hrs</h1>
      <div style={{ margin: "0 0 12px", color: "#374151" }}>
        Since {new Date(sinceDate).toLocaleString()} • {summary.auditRuns} audit runs
        • {summary.auditSuccesses} successes •{" "}
        <span style={{ color: summary.auditFailures ? "#991B1B" : "#166534" }}>
          {summary.auditFailures} failures
        </span>
        {summary.auditUnknown ? ` • ${summary.auditUnknown} unknown` : ""}
        <br />
        {summary.slowRuns ?? 0} {summary.slowJobDenotation ?? "OPTIMIZE"} runs •{" "}
        {summary.annotatedJobCount ?? 0} annotated •{" "}
        {summary.missingObservationRuns ?? 0} observation gaps
        <br />
        {summary.totalRowsUpserted.toLocaleString()} rows upserted •{" "}
        {summary.totalFailedRows.toLocaleString()} failed rows
      </div>

      {failures.length > 0 ? (
        <>
          <h2 style={{ margin: "16px 0 8px", color: "#991B1B" }}>
            Failing audit runs
          </h2>
          {renderTable(failures)}
        </>
      ) : (
        <div style={{ margin: "12px 0", color: "#166534", fontWeight: 700 }}>
          No audit failures in this period.
        </div>
      )}

      {nonFailures.length > 0 ? (
        <>
          <h2 style={{ margin: "16px 0 8px" }}>All other audit runs</h2>
          {renderTable(nonFailures)}
        </>
      ) : null}
    </div>
  );
};
