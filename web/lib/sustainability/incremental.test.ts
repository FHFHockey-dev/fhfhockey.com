import { describe, expect, it } from "vitest";

import {
  classifySustainabilitySourceAdvance,
  sourceDateFromComponents
} from "./incremental";

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

  it("reads current provenance and retains the legacy key as compatibility", () => {
    expect(
      sourceDateFromComponents({
        sourceCutoffs: {
          observed: { player_stats_unified: "2026-04-16" }
        }
      })
    ).toBe("2026-04-16");
    expect(
      sourceDateFromComponents({
        sourceCutoffs: {
          observed: { player_stats_source_date: "2026-04-15" }
        }
      })
    ).toBe("2026-04-15");
  });
});
