import { describe, expect, it } from "vitest";

import { getMetricValue, getYDomainMax } from "./metricUtils";

describe("Team standings chart metric utils", () => {
  it("scales point percentage from decimal form but keeps special-teams rates in percentage form", () => {
    expect(getMetricValue(0.625, "pointPct")).toBe(62.5);
    expect(getMetricValue(24.8, "powerPlayPct")).toBe(24.8);
    expect(getMetricValue(81.4, "penaltyKillPct")).toBe(81.4);
  });

  it("keeps the expected 0-100 chart domain for percentage metrics", () => {
    expect(getYDomainMax("pointPct")).toBe(100);
    expect(getYDomainMax("powerPlayPct")).toBe(100);
    expect(getYDomainMax("penaltyKillPct")).toBe(100);
  });
});
