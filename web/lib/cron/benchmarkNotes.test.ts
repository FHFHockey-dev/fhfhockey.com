import { describe, expect, it } from "vitest";

import {
  getBenchmarkAnnotations,
  hasBenchmarkAnnotationKind
} from "lib/cron/benchmarkNotes";

describe("benchmarkNotes", () => {
  it("returns static benchmark annotations for known bottleneck jobs", () => {
    const annotations = getBenchmarkAnnotations("run-forge-projection-v2");

    expect(annotations.length).toBeGreaterThan(0);
    expect(hasBenchmarkAnnotationKind(annotations, "bottleneck")).toBe(true);
    expect(hasBenchmarkAnnotationKind(annotations, "dependency_sensitive")).toBe(
      true
    );
  });

  it("returns an empty list for jobs without curated benchmark notes", () => {
    expect(getBenchmarkAnnotations("update-games")).toEqual([]);
  });
});
