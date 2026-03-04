import { describe, expect, it } from "vitest";

import {
  buildDashboardFreshnessChecks,
  evaluateFreshness
} from "lib/dashboard/freshness";

describe("Dashboard Freshness Audit", () => {
  const now = Date.parse("2026-03-04T18:00:00.000Z");

  it("passes when all sources are within freshness windows", () => {
    const checks = buildDashboardFreshnessChecks({
      teamRatingsDate: "2026-03-04",
      goalieAsOfDate: "2026-03-04",
      startChartDateUsed: "2026-03-04",
      teamCtpiGeneratedAt: "2026-03-04T15:00:00.000Z",
      skaterPowerGeneratedAt: "2026-03-03T18:00:00.000Z",
      sustainabilitySnapshotDate: "2026-03-03"
    });

    const result = evaluateFreshness(checks, now);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("fails when error-severity snapshot feeds are stale", () => {
    const checks = buildDashboardFreshnessChecks({
      teamRatingsDate: "2026-03-01",
      goalieAsOfDate: "2026-02-28",
      startChartDateUsed: "2026-03-04",
      teamCtpiGeneratedAt: "2026-03-04T12:00:00.000Z",
      skaterPowerGeneratedAt: "2026-03-04T12:00:00.000Z",
      sustainabilitySnapshotDate: "2026-03-04"
    });

    const result = evaluateFreshness(checks, now);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.source === "team-ratings")).toBe(
      true
    );
    expect(result.issues.some((issue) => issue.source === "forge-goalies")).toBe(
      true
    );
  });

  it("returns warnings for trend-feed staleness without failing", () => {
    const checks = buildDashboardFreshnessChecks({
      teamRatingsDate: "2026-03-04",
      goalieAsOfDate: "2026-03-04",
      startChartDateUsed: "2026-03-04",
      teamCtpiGeneratedAt: "2026-02-25T00:00:00.000Z",
      skaterPowerGeneratedAt: "2026-02-25T00:00:00.000Z",
      sustainabilitySnapshotDate: "2026-02-25"
    });

    const result = evaluateFreshness(checks, now);
    expect(result.ok).toBe(true);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.every((issue) => issue.severity === "warn")).toBe(true);
  });

  it("flags missing/invalid timestamps", () => {
    const checks = buildDashboardFreshnessChecks({
      teamRatingsDate: null,
      goalieAsOfDate: "not-a-date",
      startChartDateUsed: "2026-03-04",
      teamCtpiGeneratedAt: null,
      skaterPowerGeneratedAt: "2026-03-04T00:00:00.000Z",
      sustainabilitySnapshotDate: "2026-03-04"
    });

    const result = evaluateFreshness(checks, now);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes("Missing or invalid"))).toBe(
      true
    );
  });
});
