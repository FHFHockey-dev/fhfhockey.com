import { describe, expect, it } from "vitest";

import {
  ADJUSTED_DEFENSE_MODEL_ROADMAP,
  ADJUSTED_DEFENSE_MODEL_PREREQUISITES,
  DEFENSIVE_COMPOSITE_CAVEATS,
  DEFENSIVE_COMPOSITE_LABELS,
  DEFENSIVE_COMPOSITE_SOURCE_QUALITY_FLAGS,
} from "./defensiveCompositeMethodology";

describe("defensiveCompositeMethodology", () => {
  it("labels planned defensive composites as contextual impact", () => {
    expect(DEFENSIVE_COMPOSITE_LABELS.overall).toBe(
      "Defensive Impact in Context",
    );
    expect(DEFENSIVE_COMPOSITE_LABELS.deployment).toBe(
      "Deployment Defensive Impact in Context",
    );
  });

  it("documents unadjusted on-ice caveats and adjusted-model prerequisites", () => {
    expect(DEFENSIVE_COMPOSITE_SOURCE_QUALITY_FLAGS).toContain(
      "context_influenced_unadjusted_on_ice",
    );
    expect(DEFENSIVE_COMPOSITE_CAVEATS.join(" ")).toMatch(/teammates/);
    expect(DEFENSIVE_COMPOSITE_CAVEATS.join(" ")).toMatch(/opponents/);
    expect(DEFENSIVE_COMPOSITE_CAVEATS.join(" ")).toMatch(/score state/);
    expect(ADJUSTED_DEFENSE_MODEL_PREREQUISITES).toContain(
      "zone-start and score-state controls",
    );
    expect(ADJUSTED_DEFENSE_MODEL_ROADMAP.recommendedModelFamily).toMatch(
      /RAPM-like/,
    );
    expect(ADJUSTED_DEFENSE_MODEL_ROADMAP.currentSourceAudit.zoneStarts).toMatch(
      /NST 5v5/,
    );
    expect(ADJUSTED_DEFENSE_MODEL_ROADMAP.validationCriteria).toContain(
      "held-out error improvement over raw on-ice xGA/xGF baselines",
    );
    expect(ADJUSTED_DEFENSE_MODEL_ROADMAP.publishGate).toMatch(
      /Do not replace contextual defensive labels/,
    );
  });
});
