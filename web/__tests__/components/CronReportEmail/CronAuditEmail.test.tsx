import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { renderAsync } from "@react-email/render";
import { describe, expect, it } from "vitest";

import { CronAuditEmail } from "components/CronReportEmail/CronAuditEmail";

describe("CronAuditEmail", () => {
  it("does not present an undated static benchmark as evidence about a current receipt", () => {
    const html = renderToStaticMarkup(<CronAuditEmail sinceDate="2026-10-03T15:55:00Z"
      summary={{ auditRuns: 1, auditSuccesses: 0, auditFailures: 1, auditUnknown: 0, totalRowsUpserted: 0, totalFailedRows: 0 }}
      audits={[{ key: "season", label: "season", jobName: "update-season-stats-current-season", status: "failure",
        runTimeDisplay: "2026-10-04T10:20:03Z / 6:20 AM EDT", durationMs: 2000,
        method: "GET", route: "/api/v1/db/update-season-stats", routePath: "/api/v1/db/update-season-stats",
        targetTable: null, statusCode: 500, rowsUpserted: null, rowsAffected: null, failedRows: null,
        reason: "Actual upstream request failed", lastKnownSuccessDisplay: null, failedRowSamples: [],
        benchmarkAnnotations: [{ kind: "bottleneck", note: "Route still hangs past the 180s validation probe" }] }]} />);
    expect(html).toContain("Actual upstream request failed");
    expect(html).toContain("2s");
    expect(html).not.toContain("hangs past");
    expect(html).not.toContain("Benchmark:");
  });

  it("orders exceptions first, shows each job once, and emits a source warning once", () => {
    const base = { runTimeDisplay: "EDT", method: "GET", route: "/example", routePath: "/example", targetTable: null,
      statusCode: 200, durationMs: 499, rowsUpserted: null, rowsAffected: 800, failedRows: null,
      reason: null, lastKnownSuccessDisplay: null, failedRowSamples: [],
      missingObservationWarnings: ["Telemetry source unavailable: cron_job_report."] };
    const html = renderToStaticMarkup(<CronAuditEmail sinceDate="2026-10-03T00:00:00Z" totalsComplete={false}
      summary={{ scheduledJobs: 4, metricRowsKnown: 0, metricErrorsKnown: 0, auditRuns: 3, auditSuccesses: 2, auditFailures: 1, auditUnknown: 0, totalRowsUpserted: 0, totalFailedRows: 0 }}
      audits={[
        { ...base, key: "healthy", jobName: "healthy-job", label: "healthy", status: "success" },
        { ...base, key: "near", jobName: "near-job", label: "near", status: "success", durationMs: 218000, repositoryLimitMs: 240000 },
        { ...base, key: "failed", jobName: "failed-job", label: "failed", status: "failure", reason: "database timeout" },
        { ...base, key: "missing", jobName: "missing-job", label: "missing", status: "unknown", missingObservationWarnings: ["No cron or audit observation matched this scheduled slot."] },
      ]} />);
    expect(html.indexOf("failed-job")).toBeLessThan(html.indexOf("near-job"));
    expect(html.indexOf("near-job")).toBeLessThan(html.indexOf("healthy-job"));
    expect(html.match(/healthy-job/g)).toHaveLength(1);
    expect(html.match(/Telemetry source unavailable: cron_job_report/g)).toHaveLength(1);
    expect(html).toContain("&lt;1s");
    expect(html).toContain("total unknown (0 confirmed observations)");
    expect(html).not.toContain(">800<");
    expect(html).not.toContain("<th");
    expect(html).toContain(">MISSING</strong>");
  });

  it("distinguishes unknown metrics, verified zero, non-writer N/A and failed operations", () => {
    const html = renderToStaticMarkup(<CronAuditEmail sinceDate="2026-10-03T00:00:00Z"
      summary={{ auditRuns: 2, auditSuccesses: 1, auditFailures: 1, auditUnknown: 0, totalRowsUpserted: 741, totalFailedRows: 0 }}
      audits={[
        { key: "pbp", label: "PBP", jobName: "PBP", status: "failure", runTimeDisplay: "EDT", method: "GET", route: "/api/v1/db/update-PbP", routePath: "/api/v1/db/update-PbP", targetTable: null, statusCode: 500, durationMs: null, rowsUpserted: 741, rowsAffected: 741, failedRows: null, failedOperations: 1, reason: "Shift clock/duration mismatch", lastKnownSuccessDisplay: null, failedRowSamples: [] },
        { key: "report", label: "Report", jobName: "Report", status: "success", runTimeDisplay: "EDT", method: "GET", route: "/api/v1/db/cron-report", routePath: "/api/v1/db/cron-report", targetTable: null, statusCode: 200, durationMs: 0, rowsUpserted: null, rowsAffected: null, failedRows: null, reason: null, lastKnownSuccessDisplay: null, failedRowSamples: [] },
      ]} />);
    expect(html).toContain("741");
    expect(html).toContain("Unknown</strong>");
    expect(html.match(/N\/A<\/strong>/g)).toHaveLength(2);
    expect(html).toContain("0s</strong>");
    expect(html).toContain("1 failed operations; error-row count unknown.");
  });

  it("renders compact execution metrics and retains concise failure evidence", () => {
    render(<CronAuditEmail sinceDate="2026-03-20T03:00:00.000Z"
      summary={{ auditRuns: 1, auditSuccesses: 0, auditFailures: 1, auditUnknown: 0, totalRowsUpserted: 8, totalFailedRows: 2 }}
      audits={[{ key: "audit-1", label: "projection", jobName: "projection", status: "failure", runTimeDisplay: "EDT", method: "POST", route: "/projection", routePath: "/projection", targetTable: null, statusCode: 500, durationMs: 301000, repositoryLimitMs: 240000, rowsUpserted: 8, rowsAffected: 8, failedRows: 2, reason: "preflight gate failed", lastKnownSuccessDisplay: "yesterday", failedRowSamples: ["table: goalie_start_projections"] }]} />);
    expect(screen.getByText("5m 1s")).toBeTruthy();
    expect(screen.getByText(/NEAR LIMIT/)).toBeTruthy();
    expect(screen.getByText("preflight gate failed")).toBeTruthy();
    expect(screen.getByText(/table: goalie_start_projections/)).toBeTruthy();
    expect(screen.getByText(/deployed override unverified/)).toBeTruthy();
  });

  it("includes clean successful jobs once in the briefing", () => {
    render(
      <CronAuditEmail
        sinceDate="2026-03-20T03:00:00.000Z"
        summary={{
          auditRuns: 1,
          auditSuccesses: 1,
          auditFailures: 0,
          auditUnknown: 0,
          totalRowsUpserted: 12,
          totalFailedRows: 0
        }}
        audits={[
          {
            key: "audit-ok",
            label: "/api/v1/db/update-teams",
            jobName: "update-teams-job",
            status: "success",
            runTimeDisplay: "3/20/2026, 12:00:00 AM",
            method: "GET",
            route: "/api/v1/db/update-teams",
            routePath: "/api/v1/db/update-teams",
            targetTable: "teams",
            statusCode: 200,
            durationMs: 1000,
            rowsUpserted: 12,
            rowsAffected: 12,
            failedRows: 0,
            reason: null,
            lastKnownSuccessDisplay: "3/20/2026, 12:00:00 AM",
            failedRowSamples: []
          }
        ]}
      />
    );

    expect(screen.getAllByText("update-teams-job")).toHaveLength(1);
    expect(screen.getByText("OK")).toBeTruthy();
  });
  it("renders incomplete totals as unknown and retains observed failures", () => {
    const markup = renderToStaticMarkup(<CronAuditEmail
      sinceDate="2026-10-02T21:15:00.000Z" untilDate="2026-10-03T21:15:00.000Z"
      totalsComplete={false} fetchErrors={["statement timeout"]} audits={[]}
      summary={{ auditRuns: 0, auditSuccesses: 0, auditFailures: 0, auditUnknown: 0, totalRowsUpserted: 0, totalFailedRows: 0 }}
    />);
    expect(markup).toContain("Failure total unknown (0 observed)");
    expect(markup).toContain("EDT");
    expect(markup).not.toContain("No scheduled audit failures");
    expect(markup).toContain("statement timeout");
  });

  it("shows skipped observations separately from execution failures", () => {
    const markup = renderToStaticMarkup(<CronAuditEmail
      sinceDate="2026-10-02T21:15:00.000Z"
      summary={{ auditRuns: 1, auditSuccesses: 0, auditFailures: 0, auditUnknown: 1, totalRowsUpserted: 0, totalFailedRows: 0 }}
      audits={[{ key: "skipped", label: "forecast", jobName: "forecast", status: "unknown", runTimeDisplay: "EDT",
        method: "GET", route: "/forecast", routePath: "/forecast", targetTable: "forecasts", statusCode: 200,
        durationMs: 100, rowsUpserted: 0, rowsAffected: 0, failedRows: 0, reason: "serving gate skipped", lastKnownSuccessDisplay: null,
        failedRowSamples: [], missingObservationWarnings: ["Operation was skipped or produced no output"] }]}
    />);
    expect(markup).toContain("SKIPPED / NO OUTPUT");
    expect(markup).toContain("serving gate skipped");
  });

  it("never prints a green no-failures assertion when omitted failures exist", () => {
    const markup = renderToStaticMarkup(<CronAuditEmail sinceDate="2026-03-20T12:00:00.000Z" audits={[]}
      summary={{ auditRuns: 3, auditSuccesses: 1, auditFailures: 1, auditUnknown: 1, omittedFailureObservations: 1, totalRowsUpserted: 1, totalFailedRows: 0 }} />);
    expect(markup).not.toContain("No scheduled audit failures");
    expect(markup).toContain("1 additional failed observations");
    expect(markup).toContain("not a transactional snapshot");
  });

  it("includes extra SQL failure receipts in the summary and suppresses a green no-failures assertion", () => {
    const markup = renderToStaticMarkup(<CronAuditEmail sinceDate="2026-03-20T12:00:00.000Z" audits={[]}
      summary={{ auditRuns: 1, auditSuccesses: 1, auditFailures: 0, cronFailures: 1, auditUnknown: 0, totalRowsUpserted: 1, totalFailedRows: 0 }} />);
    expect(markup).not.toContain("No scheduled audit failures");
    expect(markup).toContain("1 cron execution failure receipts");
  });

  it("shows every timing limit and provenance, readable plain metrics and unknown overall row totals", async () => {
    const element = <CronAuditEmail sinceDate="2026-10-03T13:00:48.447Z" totalsComplete={false}
      summary={{ scheduledJobs: 56, metricRowsKnown: 3, metricErrorsKnown: 7, auditRuns: 6247, auditSuccesses: 6028, auditFailures: 212, auditUnknown: 7, totalRowsUpserted: 741, totalFailedRows: 0 }}
      audits={[{ key: "teams", label: "teams", jobName: "teams", status: "unknown", observedExecutionStatus: "success", runTimeDisplay: "EDT", method: "GET", route: "/api/v1/db/update-teams", routePath: "/api/v1/db/update-teams", targetTable: "teams", statusCode: 200, durationMs: 351, timingProvenance: "Route audit timing receipt", repositoryLimitMs: 240000, rowsUpserted: null, rowsAffected: null, failedRows: null, reason: null, lastKnownSuccessDisplay: null, failedRowSamples: [] }]} />;
    const html = renderToStaticMarkup(element);
    expect(html).toContain("Repo route limit: 4m 0s");
    expect(html).toContain("Route audit timing receipt");
    expect(html).toContain("Observed route receipt: success; scheduled health remains unknown");
    expect(html).toContain("Error rows: total unknown (0 observed in 7/56 applicable job receipts)");
    expect(html).not.toContain("0 explicitly reported");
    const text = await renderAsync(element, { plainText: true });
    expect(text).toContain("Elapsed: <1s");
    expect(text).toContain("Upserted: Unknown");
    expect(text).toContain("Error rows: Unknown");
    expect(text).not.toContain("Execution<1sUpserted");
  });

  it("retains the full concise cause, provides a diagnostic link, and distinguishes operation budget from repository limit", () => {
    const cause = "NST prior-season date pages return404. " + "Evidence preserved. ".repeat(10) + "Use a current-season startDate; requested2026-04-03, season starts2026-09-29.";
    const html = renderToStaticMarkup(<CronAuditEmail sinceDate="2026-10-03T13:00:48.447Z"
      summary={{ auditRuns: 1, auditSuccesses: 0, auditFailures: 1, auditUnknown: 0, totalRowsUpserted: 0, totalFailedRows: 0 }}
      audits={[{ key: "pipeline", label: "pipeline", jobName: "pipeline", status: "failure", runTimeDisplay: "UTC / EDT", method: "GET", route: "/pipeline", routePath: "/pipeline", targetTable: null, statusCode: 500, durationMs: 195000, repositoryLimitMs: 240000, runtimeBudgetMs: 210000, timingProvenance: "Route audit timing receipt", rowsUpserted: null, rowsAffected: null, failedRows: null, reason: cause, lastKnownSuccessDisplay: null, failedRowSamples: [] }]} />);
    expect(html).toContain("season starts2026-09-29");
    expect(html).toContain("NEAR BUDGET");
    expect(html).toContain("Reported operation budget: 3m 30s");
    expect(html).toContain('href="https://vercel.com/fhfhockeydevs-projects/fhfhockey/logs"');
  });

});
