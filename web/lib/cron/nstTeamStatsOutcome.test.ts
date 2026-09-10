import { describe, expect, it } from "vitest";

import {
  buildNstTeamStatsDiagnostics,
  isNstConfigurationFailure,
} from "./nstTeamStatsOutcome";

describe("NST team stats diagnostics", () => {
  it("recognizes a missing NST key as a fatal configuration failure", () => {
    expect(
      isNstConfigurationFailure(
        'HTTP 503: {"error":{"code":"missing_key"}}'
      )
    ).toBe(true);
    expect(isNstConfigurationFailure("HTTP 429: rate limited")).toBe(false);
  });

  it("keeps backlog dates and empty-source skips outside failed row counts", () => {
    expect(
      buildNstTeamStatsDiagnostics({
        failures: [],
        skips: [
          {
            scope: "date",
            table: "nst_team_all",
            date: "2026-07-01",
            reason: "empty_source",
          },
        ],
        deferredDates: ["2026-07-02", "2026-07-03"],
      })
    ).toMatchObject({
      failedRows: 0,
      failedRequests: 0,
      skippedRequests: 1,
      deferredDatesCount: 2,
      failures: [],
    });
  });

  it("reports request failures separately and bounds diagnostic samples", () => {
    const result = buildNstTeamStatsDiagnostics({
      failures: Array.from({ length: 12 }, (_, index) => `failure ${index}`),
      skips: [],
      deferredDates: [],
    });

    expect(result.failedRows).toBe(0);
    expect(result.failedRequests).toBe(12);
    expect(result.failures).toHaveLength(10);
  });

  it("counts the full backlog while bounding deferred date samples", () => {
    const deferredDates = Array.from(
      { length: 25 },
      (_, index) => `2026-01-${String(index + 1).padStart(2, "0")}`
    );
    const result = buildNstTeamStatsDiagnostics({
      failures: [],
      skips: [],
      deferredDates,
    });

    expect(result.deferredDatesCount).toBe(25);
    expect(result.deferredDates).toHaveLength(10);
  });
});
