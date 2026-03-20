import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CronAuditEmail } from "components/CronReportEmail/CronAuditEmail";

describe("CronAuditEmail", () => {
  it("renders MMSS timing plus optimization and benchmark annotations", () => {
    render(
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
            statusCode: 500,
            durationMs: 301_000,
            rowsUpserted: 8,
            rowsAffected: 8,
            failedRows: 2,
            reason: "preflight gate failed",
            failedRowSamples: ["table: goalie_start_projections"],
            optimizationDenotation: "OPTIMIZE",
            benchmarkAnnotations: [
              {
                kind: "bottleneck",
                note: "Projection run is preflight-gated and likely to overrun when upstream data lags."
              }
            ],
            missingObservationWarnings: [
              "Observed audit run does not have reliable timing metadata yet."
            ]
          }
        ]}
      />
    );

    expect(screen.getByText(/1 OPTIMIZE runs/i)).toBeTruthy();
    expect(screen.getByText("05:01")).toBeTruthy();
    expect(screen.getByText("OPTIMIZE")).toBeTruthy();
    expect(screen.getByText("BOTTLENECK")).toBeTruthy();
    expect(
      screen.getByText(/Observation gaps: Observed audit run does not have reliable timing metadata yet\./i)
    ).toBeTruthy();
    expect(
      screen.getByText(/Benchmark: Projection run is preflight-gated/i)
    ).toBeTruthy();
  });
});
