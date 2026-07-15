import { describe, expect, it } from "vitest";
import { buildLaggedResidualSkillLayers } from "./residualSkill";

describe("lagged residual skill", () => {
  it("uses only prior events and keeps shooter/goalie effects separate", () => {
    const rows = buildLaggedResidualSkillLayers(
      [
        { gameId: 2, eventId: 2, gameDate: "2026-01-02", shooterId: 10, goalieId: 20, baselineXg: 0.2, label: 0 },
        { gameId: 1, eventId: 1, gameDate: "2026-01-01", shooterId: 10, goalieId: 20, baselineXg: 0.2, label: 1 },
        { gameId: 3, eventId: 3, gameDate: "2026-01-03", shooterId: 10, goalieId: 20, baselineXg: 0.2, label: 1 },
      ],
      { minimumSamples: 2, priorStrength: 2 },
    );

    expect(rows[0]).toMatchObject({ shooterPriorSamples: 0, shooterFinishingEffect: null, goalieSaveEffect: null });
    expect(rows[1]).toMatchObject({ shooterPriorSamples: 1, shooterFinishingEffect: null, goalieSaveEffect: null });
    expect(rows[2].shooterFinishingEffect).toBe(0.15);
    expect(rows[2].goalieSaveEffect).toBe(-0.15);
    expect(rows[2].adjustedProbability).toBe(0.5);
  });
});

