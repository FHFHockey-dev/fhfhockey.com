import { describe, expect, it } from "vitest";

import {
  getEdgeMetricsForEntityClass,
  getEdgeMetricsForSurface
} from "./edgeMetricCatalog";

describe("edgeMetricCatalog", () => {
  it("returns the expected adopted edge families for the sandbox surface", () => {
    const metrics = getEdgeMetricsForSurface("sandbox");

    expect(metrics.map((entry) => entry.key)).toEqual([
      "skater-detail-now",
      "skater-shot-location-leaders",
      "skater-detail",
      "team-detail",
      "team-detail-now",
      "goalie-detail",
      "goalie-detail-now"
    ]);
  });

  it("scopes goalie metrics to goalie-compatible families", () => {
    const metrics = getEdgeMetricsForEntityClass("goalie");

    expect(metrics).toHaveLength(2);
    expect(metrics.map((entry) => entry.key)).toEqual([
      "goalie-detail",
      "goalie-detail-now"
    ]);
    expect(metrics.map((entry) => entry.launchFit)).toEqual([
      "ready-now",
      "supporting-context"
    ]);
  });
});
