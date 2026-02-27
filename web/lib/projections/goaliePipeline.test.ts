import { describe, expect, it } from "vitest";

import { getGoalieForgePipelineSpec } from "./goaliePipeline";

describe("goalie pipeline spec", () => {
  it("has strict stage ordering and dependency references", () => {
    const spec = getGoalieForgePipelineSpec();
    expect(spec.version).toBe("goalie-forge-pipeline-v1");
    expect(spec.stages).toHaveLength(7);

    const orders = spec.stages.map((s) => s.order);
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7]);

    const ids = new Set(spec.stages.map((s) => s.id));
    for (const stage of spec.stages) {
      for (const dep of stage.depends_on) {
        expect(ids.has(dep)).toBe(true);
      }
    }
  });
});

