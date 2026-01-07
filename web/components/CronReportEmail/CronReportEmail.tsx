import * as React from "react";

interface CronReportEmailProps {
  sinceDate: string;
  summary: {
    jobs: number;
    auditRuns: number;
    auditSuccesses: number;
    auditFailures: number;
    auditUnknown: number;
    jobsOkLast: number;
    jobsFailingLast: number;
    jobsUnknownLast: number;
    warnZeroRows: number;
    warnUnknown: number;
    warnSlow: number;
  };
  jobs: Array<{
    jobName: string;
    lastStatus: "success" | "failure" | "unknown";
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
  }>;
  recentFailures: Array<{
    jobName: string;
    runTimeDisplay: string;
    rowsAffected: number | null;
    message: string;
    durationMs: number | null;
  }>;
  fetchErrors: string[];
  warnings: {
    slowMsThreshold: number;
    zeroRowsJobs: string[];
    unknownStatusJobs: string[];
    slowJobs: Array<{ jobName: string; durationMs: number }>;
  };
}

export const CronReportEmail: React.FC<CronReportEmailProps> = ({
  sinceDate,
  summary,
  jobs,
  recentFailures,
  fetchErrors,
  warnings
}) => {
  const container: React.CSSProperties = {
    fontFamily: "system-ui, sans-serif",
    lineHeight: 1.4
  };

  const badge = (
    status: "success" | "failure" | "unknown",
    source: "audit" | "cron" | "unknown"
  ) => {
    const common: React.CSSProperties = {
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700
    };
    const sourceNote =
      source === "audit" ? " (audit)" : source === "cron" ? " (cron)" : "";

    if (status === "failure") {
      return (
        <span style={{ ...common, background: "#FEE2E2", color: "#991B1B" }}>
          FAIL{sourceNote}
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

  const renderTable = (children: React.ReactNode) => (
    <table
      style={{ borderCollapse: "collapse", width: "100%" }}
      border={1}
      cellPadding={6}
    >
      {children}
    </table>
  );

  return (
    <div style={container}>
      <h1 style={{ margin: "0 0 8px" }}>Daily Cron Briefing — last 24 hrs</h1>
      <div style={{ margin: "0 0 12px", color: "#374151" }}>
        Since {new Date(sinceDate).toLocaleString()} • {summary.jobs} jobs •{" "}
        <span style={{ color: summary.jobsFailingLast ? "#991B1B" : "#166534" }}>
          {summary.jobsFailingLast} failing jobs
        </span>{" "}
        • {summary.jobsOkLast} ok
        {summary.jobsUnknownLast ? ` • ${summary.jobsUnknownLast} unknown` : ""}{" "}
        <br />
        {summary.auditRuns} audit runs •{" "}
        <span style={{ color: summary.auditFailures ? "#991B1B" : "#166534" }}>
          {summary.auditFailures} failures
        </span>{" "}
        • {summary.auditSuccesses} successes
        {summary.auditUnknown ? ` • ${summary.auditUnknown} unknown` : ""}
      </div>

      {summary.warnZeroRows + summary.warnUnknown + summary.warnSlow > 0 ? (
        <div style={{ margin: "0 0 16px" }}>
          <div style={{ fontWeight: 800 }}>Warnings</div>
          <div style={{ marginTop: 6, color: "#374151" }}>
            {summary.warnZeroRows ? `${summary.warnZeroRows} zero-row` : ""}
            {summary.warnZeroRows && (summary.warnUnknown || summary.warnSlow)
              ? " • "
              : ""}
            {summary.warnUnknown ? `${summary.warnUnknown} unknown` : ""}
            {summary.warnUnknown && summary.warnSlow ? " • " : ""}
            {summary.warnSlow
              ? `${summary.warnSlow} slow (>${Math.round(
                  warnings.slowMsThreshold / 1000
                )}s)`
              : ""}
          </div>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
            {warnings.zeroRowsJobs.slice(0, 6).map((j) => (
              <li key={`zero-${j}`}>Zero rows: {j}</li>
            ))}
            {warnings.unknownStatusJobs.slice(0, 6).map((j) => (
              <li key={`unk-${j}`}>Unknown status: {j}</li>
            ))}
            {warnings.slowJobs.slice(0, 6).map((j) => (
              <li key={`slow-${j.jobName}`}>
                Slow: {j.jobName} ({Math.round(j.durationMs / 1000)}s)
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {fetchErrors.length > 0 ? (
        <div style={{ margin: "0 0 16px" }}>
          <div style={{ fontWeight: 700, color: "#991B1B" }}>
            Report errors
          </div>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "#991B1B" }}>
            {fetchErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {recentFailures.length > 0 ? (
        <>
          <h2 style={{ margin: "16px 0 8px", color: "#991B1B" }}>
            Failures (top priority)
          </h2>
          {renderTable(
            <>
              <thead>
                <tr style={{ background: "#F9FAFB" }}>
                  <th align="left">Job</th>
                  <th align="left">Run Time</th>
                  <th align="right">Duration</th>
                  <th align="right">Rows</th>
                  <th align="left">Message</th>
                </tr>
              </thead>
              <tbody>
                {recentFailures.map((f, i) => (
                  <tr key={`${f.jobName}-${f.runTimeDisplay}-${i}`}>
                    <td style={{ fontWeight: 700 }}>{f.jobName}</td>
                    <td>{f.runTimeDisplay}</td>
                    <td align="right">
                      {typeof f.durationMs === "number"
                        ? `${Math.round(f.durationMs / 1000)}s`
                        : "—"}
                    </td>
                    <td align="right">{f.rowsAffected ?? "—"}</td>
                    <td style={{ color: "#991B1B" }}>{f.message}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </>
      ) : (
        <div style={{ margin: "12px 0", color: "#166534", fontWeight: 700 }}>
          No failures reported.
        </div>
      )}

      <h2 style={{ margin: "16px 0 8px" }}>Latest per job</h2>
      {renderTable(
        <>
          <thead>
            <tr style={{ background: "#F9FAFB" }}>
              <th align="left">Status</th>
              <th align="left">Job</th>
              <th align="left">Last Run</th>
              <th align="right">Duration</th>
              <th align="right">Rows (last)</th>
              <th align="right">Rows (24h)</th>
              <th align="right">OK</th>
              <th align="right">Fail</th>
              <th align="left">Note</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr
                key={j.jobName}
                style={
                  j.lastStatus === "failure"
                    ? { background: "#FEF2F2" }
                    : undefined
                }
              >
                <td>{badge(j.lastStatus, j.lastStatusSource)}</td>
                <td style={{ fontWeight: 700 }}>{j.jobName}</td>
                <td>{j.lastTimeDisplay}</td>
                <td align="right">
                  {typeof j.lastDurationMs === "number"
                    ? `${Math.round(j.lastDurationMs / 1000)}s`
                    : "—"}
                </td>
                <td align="right">{j.rowsLast ?? "—"}</td>
                <td align="right">{j.rowsTotal ?? "—"}</td>
                <td align="right">{j.okCount24h}</td>
                <td
                  align="right"
                  style={{ color: j.failCount24h ? "#991B1B" : undefined }}
                >
                  {j.failCount24h}
                </td>
                <td>{j.message ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </>
      )}
    </div>
  );
};
