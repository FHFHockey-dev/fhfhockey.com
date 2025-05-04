import * as React from "react";

interface CronReportEmailProps {
  rows: Array<{
    jobname: string;
    scheduled: string;
    status: string;
    rowsAffected: number | null;
  }>;
}

export const CronReportEmail: React.FC<CronReportEmailProps> = ({ rows }) => (
  <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: 1.4 }}>
    <h1>Cron Job Report — last 24 hrs</h1>
    <table
      style={{ borderCollapse: "collapse", width: "100%" }}
      border={1}
      cellPadding={4}
    >
      <thead>
        <tr>
          <th>Job</th>
          <th>Scheduled</th>
          <th>Status</th>
          <th>Rows</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.jobname + r.scheduled}>
            <td>{r.jobname}</td>
            <td>{r.scheduled}</td>
            <td>{r.status}</td>
            <td>{r.rowsAffected ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
