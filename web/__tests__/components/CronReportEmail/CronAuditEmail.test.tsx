import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CronAuditEmail } from "components/CronReportEmail/CronAuditEmail";

describe("CronAuditEmail", () => {
  it("renders MMSS timing plus optimization and benchmark annotations", () => {
    const email = (
      <CronAuditEmail
        sinceDate="2026-03-20T03:00:00.000Z"
        summary={{
          auditRuns: 1,
          auditSuccesses: 0,
          auditFailures: 1,
          auditUnknown: 0,
          slowJobDenotation: "OPTIMIZE",
          slowMsThreshold: 270_000,
          annotatedJobCount: 1,
          slowRuns: 1,
          missingObservationRuns: 1,
          totalRowsUpserted: 8,
          totalFailedRows: 2
        }}
        audits={[
          {
            key: "audit-1",
            label: "/api/v1/db/run-projection-v2",
            jobName: "run-forge-projection-v2",
            status: "failure",
            runTimeDisplay: "3/20/2026, 7:05:00 AM",
            method: "POST",
            route: "/api/v1/db/run-projection-v2",
            routePath: "/api/v1/db/run-projection-v2",
            targetTable: "projection_execution",
            statusCode: 500,
            durationMs: 301_000,
            rowsUpserted: 8,
            rowsAffected: 8,
            failedRows: 2,
            reason: "preflight gate failed",
            lastKnownSuccessDisplay: "3/19/2026, 7:05:00 AM",
            failedRowSamples: ["table: goalie_start_projections"],
            optimizationDenotation: "OPTIMIZE",
            benchmarkAnnotations: [
              {
                kind: "bottleneck",
                note: "Projection run is preflight-gated and likely to overrun when upstream data lags."
              },
              {
                kind: "rate_limited",
                note: "Projection run should remain spaced from other request-budget consumers."
              }
            ],
            missingObservationWarnings: [
              "Observed audit run does not have reliable timing metadata yet."
            ]
          }
        ]}
      />
    );

    render(email);

    expect(screen.getByText(/1 OPTIMIZE runs/i)).toBeTruthy();
    expect(screen.getByText("Critical failures")).toBeTruthy();
    expect(screen.getByText("05:01")).toBeTruthy();
    expect(screen.getByText("OPTIMIZE")).toBeTruthy();
    expect(screen.getByText("BOTTLENECK")).toBeTruthy();
    expect(
      screen.getByText(/Observation gaps: Observed audit run does not have reliable timing metadata yet\./i)
    ).toBeTruthy();
    expect(
      screen.getByText(/Benchmark: Projection run is preflight-gated/i)
    ).toBeTruthy();
    expect(renderToStaticMarkup(email)).toContain("BOTTLENECK</span> <span");
  });

  it("hides clean successful jobs from the briefing", () => {
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

    expect(screen.queryByText("update-teams-job")).toBeNull();
    expect(screen.getByText(/No scheduled audit failures/i)).toBeTruthy();
  });
});
