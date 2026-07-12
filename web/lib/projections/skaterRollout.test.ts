import { describe, expect, it } from "vitest";

import {
  resolveSkaterRolloutConfig,
  selectSkaterRolloutStatLine,
  SKATER_ROLLOUT_GOVERNANCE,
} from "./skaterRollout";

describe("skater rollout governance", () => {
  it("preserves the current candidate behavior unless baseline rollback is explicit", () => {
    expect(resolveSkaterRolloutConfig(undefined)).toMatchObject({
      mode: "candidate",
      rollbackMode: "baseline",
    });
    const baselineConfig = resolveSkaterRolloutConfig("baseline");
    expect(
      selectSkaterRolloutStatLine({
        config: baselineConfig,
        candidate: { points: 3 },
        baseline: { points: 2 },
      }),
    ).toEqual({ points: 2 });
  });

  it("requires a real 14-day shadow window and explicit rollback triggers", () => {
    expect(SKATER_ROLLOUT_GOVERNANCE.shadowMinimumDays).toBe(14);
    expect(SKATER_ROLLOUT_GOVERNANCE.acceptance).toEqual(
      expect.arrayContaining([
        expect.stringContaining("14 distinct matched holdout dates"),
      ]),
    );
    expect(SKATER_ROLLOUT_GOVERNANCE.rollbackTriggers.length).toBeGreaterThan(
      0,
    );
    expect(SKATER_ROLLOUT_GOVERNANCE.monitoringCadence.weekly).toContain(
      "recalibration",
    );
  });
});
