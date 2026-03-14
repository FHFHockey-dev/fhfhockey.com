import { describe, expect, it } from "vitest";

import {
  DASHBOARD_ENDPOINT_BUDGETS,
  evaluatePayloadBudget,
  topHeavyBudgets
} from "lib/dashboard/perfBudget";

describe("Dashboard Performance Budget Audit", () => {
  it("includes all required endpoint budget entries", () => {
    const endpoints = DASHBOARD_ENDPOINT_BUDGETS.map((entry) => entry.endpoint);
    expect(endpoints).toEqual(
      expect.arrayContaining([
        "/api/team-ratings",
        "/api/v1/forge/goalies",
        "/api/v1/start-chart",
        "/api/v1/trends/team-ctpi",
        "/api/v1/trends/skater-power",
        "/api/v1/sustainability/trends"
      ])
    );
  });

  it("passes realistic small payloads within budget", () => {
    const evaluation = evaluatePayloadBudget("/api/team-ratings", {
      data: Array.from({ length: 32 }).map((_, idx) => ({
        team: `T${idx}`,
        off: 100 + idx,
        def: 100 - idx,
        pace: 100
      }))
    });

    expect(evaluation.withinBudget).toBe(true);
    expect(evaluation.payloadBytes).toBeGreaterThan(0);
  });

  it("flags oversized payloads that exceed budget", () => {
    const huge = {
      data: Array.from({ length: 4000 }).map((_, idx) => ({
        id: idx,
        text: "x".repeat(120)
      }))
    };

    const evaluation = evaluatePayloadBudget("/api/team-ratings", huge);
    expect(evaluation.withinBudget).toBe(false);
    expect(evaluation.payloadBytes).toBeGreaterThan(evaluation.maxPayloadBytes);
  });

  it("sorts endpoint evaluations by heaviest payload first", () => {
    const sorted = topHeavyBudgets([
      {
        endpoint: "a",
        payloadBytes: 50,
        maxPayloadBytes: 100,
        withinBudget: true
      },
      {
        endpoint: "b",
        payloadBytes: 500,
        maxPayloadBytes: 1000,
        withinBudget: true
      },
      {
        endpoint: "c",
        payloadBytes: 200,
        maxPayloadBytes: 250,
        withinBudget: true
      }
    ]);

    expect(sorted.map((row) => row.endpoint)).toEqual(["b", "c", "a"]);
  });
});
