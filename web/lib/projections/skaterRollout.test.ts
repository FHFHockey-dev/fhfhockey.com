import { describe, expect, it } from "vitest";

import {
  resolveSkaterRolloutConfig,
  selectSkaterRolloutScenarioMixture,
  selectSkaterRolloutStatLine,
  SKATER_BASELINE_MODEL_VERSION,
  SKATER_CANDIDATE_MODEL_VERSION,
  SKATER_ROLLOUT_GOVERNANCE,
} from "./skaterRollout";

describe("skater rollout governance", () => {
  it("fails closed to the baseline unless candidate mode is explicit", () => {
    expect(resolveSkaterRolloutConfig(undefined)).toMatchObject({
      mode: "baseline",
      modelVersion: SKATER_BASELINE_MODEL_VERSION,
      rollbackMode: "baseline",
    });
    expect(resolveSkaterRolloutConfig("unexpected")).toMatchObject({
      mode: "baseline",
      modelVersion: SKATER_BASELINE_MODEL_VERSION,
    });
    const candidateConfig = resolveSkaterRolloutConfig(" candidate ");
    expect(candidateConfig).toMatchObject({
      mode: "candidate",
      modelVersion: SKATER_CANDIDATE_MODEL_VERSION,
    });
    expect(
      selectSkaterRolloutStatLine({
        config: candidateConfig,
        candidate: { points: 3 },
        baseline: { points: 2 },
      }),
    ).toEqual({ points: 3 });
  });

  it("keeps candidate scenario uncertainty out of baseline rollback output", () => {
    const candidateMixture = [{ weight: 1, goals: 2 }];
    expect(
      selectSkaterRolloutScenarioMixture(
        resolveSkaterRolloutConfig(undefined),
        candidateMixture,
      ),
    ).toBeUndefined();
    expect(
      selectSkaterRolloutScenarioMixture(
        resolveSkaterRolloutConfig("candidate"),
        candidateMixture,
      ),
    ).toBe(candidateMixture);
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
