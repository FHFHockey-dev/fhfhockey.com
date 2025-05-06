// components/CronAuditEmail/CronAuditEmail.tsx
import * as React from "react";

interface AuditEntry {
  job_name: string;
  run_time: string; // Or Date, then format in component
  rows_affected: number | null;
}

interface CronAuditEmailProps {
  audits: Array<AuditEntry>;
  sinceDate: string; // To display the reporting period
}

export const CronAuditEmail: React.FC<CronAuditEmailProps> = ({
  audits,
  sinceDate
}) => (
  <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: 1.4 }}>
    <h1>Cron Job Audit Report</h1>
    <p>
      Displaying audit entries since: {new Date(sinceDate).toLocaleString()}
    </p>
    {audits.length > 0 ? (
      <table
        style={{ borderCollapse: "collapse", width: "100%" }}
        border={1}
        cellPadding={4}
      >
        <thead>
          <tr>
            <th>Job Name</th>
            <th>Run Time</th>
            <th>Rows Affected</th>
          </tr>
        </thead>
        <tbody>
          {audits.map((audit, index) => (
            <tr key={`${audit.job_name}-${audit.run_time}-${index}`}>
              {" "}
              {/* Improved key */}
              <td>{audit.job_name}</td>
              <td>{new Date(audit.run_time).toLocaleString()}</td>
              <td>{audit.rows_affected ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : (
      <p>No audit entries found for this period.</p>
    )}
  </div>
);
