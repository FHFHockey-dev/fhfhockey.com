import { describe, expect, it } from "vitest";

import { getBenchmarkExecutionPolicy } from "lib/cron/benchmarkExecutionPolicy";

describe("benchmarkExecutionPolicy", () => {
  it("skips broken local/dev jobs", () => {
    expect(
      getBenchmarkExecutionPolicy({
        name: "update-shift-charts",
        method: "GET",
        executionShape: "currently non-runnable in local/dev",
        notes: ["STATUS: 404 NOT FOUND"]
      })
    ).toMatchObject({
      action: "skip",
      reason: "STATUS: 404 NOT FOUND"
    });
  });

  it("uses a mocked fallback for side-effect sheet sync jobs", () => {
    expect(
      getBenchmarkExecutionPolicy({
        name: "sync-yahoo-players-to-sheet",
        method: "GET",
        executionShape: "HTTP route",
        notes: []
      })
    ).toMatchObject({
      action: "mock_fallback"
    });
  });

  it("uses observe-only mode for cron-report email delivery", () => {
    expect(
      getBenchmarkExecutionPolicy({
        name: "daily-cron-report",
        method: "GET",
        executionShape: "HTTP route",
        notes: []
      })
    ).toMatchObject({
      action: "observe_only"
    });
  });

  it("allows normal execution for safe local jobs", () => {
    expect(
      getBenchmarkExecutionPolicy({
        name: "update-games",
        method: "GET",
        executionShape: "HTTP route",
        notes: []
      })
    ).toMatchObject({
      action: "run",
      reason: null
    });
  });
});
