import { describe, expect, it } from "vitest";

import {
  evaluateFallbackReliability,
  evaluateModuleRuntimeReliability,
  mergeReliabilityResults
} from "lib/dashboard/reliability";

describe("Dashboard Reliability Audit", () => {
  it("passes valid fallback date transitions", () => {
    const result = evaluateFallbackReliability([
      {
        source: "start-chart",
        requestedDate: "2026-03-04",
        resolvedDate: "2026-03-04",
        fallbackApplied: false
      },
      {
        source: "forge-goalies",
        requestedDate: "2026-03-04",
        resolvedDate: "2026-03-03",
        fallbackApplied: true
      }
    ]);

    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("fails fallback reliability when resolved date drifts without fallback flag", () => {
    const result = evaluateFallbackReliability([
      {
        source: "forge-goalies",
        requestedDate: "2026-03-04",
        resolvedDate: "2026-03-03",
        fallbackApplied: false
      }
    ]);

    expect(result.ok).toBe(false);
    expect(
      result.issues.some((issue) => issue.message.includes("fallbackApplied=true"))
    ).toBe(true);
  });

  it("emits runtime warnings for degraded/empty states", () => {
    const result = evaluateModuleRuntimeReliability([
      {
        source: "team-power",
        loading: false,
        error: null,
        empty: true,
        stale: false
      },
      {
        source: "hot-cold",
        loading: false,
        error: "Timeout",
        empty: false,
        stale: true
      }
    ]);

    expect(result.ok).toBe(true);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.every((issue) => issue.severity === "warn")).toBe(true);
  });

  it("fails runtime reliability for impossible loading/error overlap", () => {
    const result = evaluateModuleRuntimeReliability([
      {
        source: "sustainability",
        loading: true,
        error: "Network",
        empty: false,
        stale: false
      }
    ]);

    expect(result.ok).toBe(false);
    expect(
      result.issues.some((issue) => issue.message.includes("simultaneously loading"))
    ).toBe(true);
  });

  it("merges multiple reliability result sets", () => {
    const merged = mergeReliabilityResults(
      evaluateFallbackReliability([
        {
          source: "start-chart",
          requestedDate: "2026-03-04",
          resolvedDate: "2026-03-04",
          fallbackApplied: false
        }
      ]),
      evaluateModuleRuntimeReliability([
        {
          source: "goalie-risk",
          loading: false,
          error: null,
          empty: false,
          stale: false
        }
      ])
    );

    expect(merged.ok).toBe(true);
    expect(merged.issues).toHaveLength(0);
  });
});
