import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CronReportEmail } from "components/CronReportEmail/CronReportEmail";

describe("CronReportEmail", () => {
  it("renders MMSS durations, optimization denotations, benchmark notes, and observation gaps", () => {
    render(
      <CronReportEmail
        sinceDate="2026-03-20T03:00:00.000Z"
        summary={{
          scheduledJobs: 1,
          scheduledJobsWithActivity: 1,
          auditRuns: 1,
          auditSuccesses: 1,
          auditFailures: 0,
          auditUnknown: 0,
          jobsOkLast: 1,
          jobsFailingLast: 0,
          jobsMissingLast: 0,
          jobsUnknownLast: 0,
          unscheduledRuns: 0,
          totalRowsUpserted: 42,
          totalFailedRows: 0,
          warnSlow: 1,
          warnPartialFailure: 0,
          warnMissingAudit: 0
        }}
        jobs={[
          {
            jobKey: "job-1",
            displayName: "run-forge-projection-v2",
            lastStatus: "success",
            lastStatusSource: "audit",
            scheduleTimeDisplay: "07:00 UTC",
            expectedRunDisplay: "3/20/2026, 7:00:00 AM",
            lastRunDisplay: "3/20/2026, 7:05:00 AM",
            method: "POST",
            route: "/api/v1/db/run-projection-v2",
            statusCode: 200,
            why: null,
            note: "OPTIMIZE: last runtime exceeded 4m30s.",
            okCount24h: 1,
            failCount24h: 0,
            rowsUpsertedLast: 42,
            failedRowsLast: 0,
            failedRowSamples: [],
            lastDurationMs: 301_000,
            optimizationDenotation: "OPTIMIZE",
            benchmarkAnnotations: [
              {
                kind: "bottleneck",
                note: "Projection run is preflight-gated and likely to overrun when upstream data lags."
              }
            ],
            missingObservationWarnings: [
              "Observed run does not have reliable timing metadata yet."
            ]
          }
        ]}
        failureHighlights={[]}
        missingJobs={[]}
        unscheduledRuns={[]}
        fetchErrors={[]}
        warnings={{
          slowMsThreshold: 270_000,
          slowJobDenotation: "OPTIMIZE",
          slowJobs: [
            {
              displayName: "run-forge-projection-v2",
              durationMs: 301_000,
              timer: "05:01",
              denotation: "OPTIMIZE"
            }
          ],
          partialFailureJobs: [],
          missingAuditJobs: [],
          missingObservationJobs: [
            {
              displayName: "run-forge-projection-v2",
              warnings: ["Observed run does not have reliable timing metadata yet."]
            }
          ]
        }}
      />
    );

    expect(screen.getByText(/OPTIMIZE: run-forge-projection-v2/i)).toBeTruthy();
    expect(screen.getAllByText("05:01").length).toBeGreaterThan(0);
    expect(screen.getByText("OPTIMIZE")).toBeTruthy();
    expect(screen.getByText("BOTTLENECK")).toBeTruthy();
    expect(
      screen.getByText(/Observation gaps: Observed run does not have reliable timing metadata yet\./i)
    ).toBeTruthy();
    expect(
      screen.getByText(/Benchmark: Projection run is preflight-gated/i)
    ).toBeTruthy();
  });
});
