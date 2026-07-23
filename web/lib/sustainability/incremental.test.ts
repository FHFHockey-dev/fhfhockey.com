import { describe, expect, it } from "vitest";

import { classifySustainabilitySourceAdvance } from "./incremental";

describe("sustainability incremental source detection", () => {
  it("processes only a source date newer than the persisted source cutoff", () => {
    expect(classifySustainabilitySourceAdvance({
      latestSourceDate: "2026-03-22",
      latestProcessedSourceDate: "2026-03-21"
    })).toEqual({ shouldProcess: true, reason: "new_source_date" });
    expect(classifySustainabilitySourceAdvance({
      latestSourceDate: "2026-03-21",
      latestProcessedSourceDate: "2026-03-21"
    })).toEqual({ shouldProcess: false, reason: "source_already_processed" });
  });

  it("fails open into prerequisite validation when either cutoff is unavailable", () => {
    expect(classifySustainabilitySourceAdvance({
      latestSourceDate: null,
      latestProcessedSourceDate: "2026-03-21"
    }).shouldProcess).toBe(true);
    expect(classifySustainabilitySourceAdvance({
      latestSourceDate: "2026-03-21",
      latestProcessedSourceDate: null
    }).shouldProcess).toBe(true);
  });
});
