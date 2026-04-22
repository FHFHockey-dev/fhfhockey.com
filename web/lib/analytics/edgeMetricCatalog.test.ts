import { describe, expect, it } from "vitest";

import {
  getEdgeMetricsForEntityClass,
  getEdgeMetricsForSurface
} from "./edgeMetricCatalog";

describe("edgeMetricCatalog", () => {
  it("returns the expected official edge families for the sandbox surface", () => {
    const metrics = getEdgeMetricsForSurface("sandbox");

    expect(metrics.map((entry) => entry.key)).toEqual([
      "skater-shot-location-leaders",
      "skater-detail",
      "team-detail",
      "goalie-detail"
    ]);
  });

  it("scopes goalie metrics to goalie-compatible families", () => {
    const metrics = getEdgeMetricsForEntityClass("goalie");

    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toMatchObject({
      key: "goalie-detail",
      launchFit: "ready-now"
    });
  });
});
