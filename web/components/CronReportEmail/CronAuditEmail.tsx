// components/CronAuditEmail/CronAuditEmail.tsx
import * as React from "react";

interface AuditEntry {
  job_name: string;
  run_time: string; // Or Date, then format in component
  rows_affected: number | null;
  status: "success" | "failure" | "unknown";
  message: string | null;
}

interface CronAuditEmailProps {
  audits: Array<AuditEntry>;
  sinceDate: string; // To display the reporting period
  summary: {
    jobs: number;
    auditRuns: number;
    auditSuccesses: number;
    auditFailures: number;
    auditUnknown: number;
  };
}

export const CronAuditEmail: React.FC<CronAuditEmailProps> = ({
  audits,
  sinceDate,
  summary
}) => {
  const failures = audits.filter((a) => a.status === "failure");
  const nonFailures = audits.filter((a) => a.status !== "failure");

  const headerStyle: React.CSSProperties = {
    fontFamily: "system-ui, sans-serif",
    lineHeight: 1.4
  };

  const badge = (status: AuditEntry["status"]) => {
    const common: React.CSSProperties = {
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600
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

  const table = (rows: AuditEntry[]) => (
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
          <th align="right">Rows</th>
          <th align="left">Message</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((a, index) => (
          <tr
            key={`${a.job_name}-${a.run_time}-${index}`}
            style={
              a.status === "failure"
                ? { background: "#FEF2F2" }
                : undefined
            }
          >
            <td>{badge(a.status)}</td>
            <td style={{ fontWeight: 600 }}>{a.job_name}</td>
            <td>{new Date(a.run_time).toLocaleString()}</td>
            <td align="right">{a.rows_affected ?? "—"}</td>
            <td>{a.message ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div style={headerStyle}>
      <h1 style={{ margin: "0 0 8px" }}>Cron Job Audit — last 24 hrs</h1>
      <div style={{ margin: "0 0 12px", color: "#374151" }}>
        Since {new Date(sinceDate).toLocaleString()} • {summary.auditRuns} runs •{" "}
        <span style={{ color: summary.auditFailures ? "#991B1B" : "#166534" }}>
          {summary.auditFailures} failures
        </span>{" "}
        • {summary.auditSuccesses} successes
        {summary.auditUnknown ? ` • ${summary.auditUnknown} unknown` : ""}
      </div>

      {failures.length > 0 ? (
        <>
          <h2 style={{ margin: "16px 0 8px", color: "#991B1B" }}>
            Failures (top priority)
          </h2>
          {table(failures)}
        </>
      ) : (
        <div style={{ margin: "12px 0", color: "#166534", fontWeight: 600 }}>
          No failures in this period.
        </div>
      )}

      {nonFailures.length > 0 ? (
        <>
          <h2 style={{ margin: "16px 0 8px" }}>All Other Runs</h2>
          {table(nonFailures)}
        </>
      ) : null}
    </div>
  );
};
