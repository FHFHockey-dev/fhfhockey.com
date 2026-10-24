// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ablateContexts, opportunityCountMoments, projectContext, type ContextEffect } from "./context";

const base = { seconds: 1200, shotsPer60: 6, goalsPerShot: 0.1, onIceGoalsPer60: 3, assistShare: 0.5 };
describe("single-owned context candidates", () => {
  it("keeps shot danger out of shot volume and assist share", () => {
    const adjusted = projectContext(base, [{ effect: "shotDanger", owner: "skater", channel: "finishing", multiplier: 1.2, evidence: "synthetic only" }]);
    expect(adjusted.shots).toBe(2); expect(adjusted.goals).toBeCloseTo(0.24); expect(adjusted.assists).toBe(0.5);
  });

  it("applies a goalie effect once to goal environments without squaring its assist effect", () => {
    const effect: ContextEffect = { effect: "opponentGoalie", owner: "team", channel: "goalEnvironment", multiplier: 0.9, evidence: "synthetic only" };
    const result = projectContext(base, [effect]);
    expect(result.goals).toBeCloseTo(0.18); expect(result.assists).toBeCloseTo(0.45); expect(result.shots).toBe(2);
    expect(() => projectContext(base, [effect, effect])).toThrow("Duplicate context");
  });

  it("provides independently toggled effects on the identical neutral opportunity", () => {
    const effects: ContextEffect[] = [
      { effect: "rest", owner: "team", channel: "opportunity", multiplier: 0.9, evidence: "synthetic only" },
      { effect: "home", owner: "team", channel: "shotVolume", multiplier: 1.04, evidence: "synthetic only" },
    ];
    const result = ablateContexts(base, effects);
    expect(result.all.shots).toBeCloseTo(2 * 0.9 * 1.04);
    expect(result.omitted.rest.shots).toBeCloseTo(2 * 1.04);
    expect(result.omitted.home.shots).toBeCloseTo(2 * 0.9);
    expect(result.neutral.seconds).toBe(1200);
    expect(() => projectContext(base, [{ ...effects[0], evidence: "" }])).toThrow("evidence");
    expect(() => projectContext(base, [{ ...effects[1], owner: "skater" } as unknown as ContextEffect])).toThrow("owner");
  });

  it("increases count variance from opportunity uncertainty without a mean haircut", () => {
    const stable = opportunityCountMoments({ expectedSeconds: 1200, varianceSeconds: 0, ratePer60: 6 });
    const unstable = opportunityCountMoments({ expectedSeconds: 1200, varianceSeconds: 90000, ratePer60: 6 });
    expect(stable).toEqual({ mean: 2, variance: 2, opportunityVariance: 0 });
    expect(unstable.mean).toBe(stable.mean); expect(unstable.variance).toBeCloseTo(2.25);
    expect(() => opportunityCountMoments({ expectedSeconds: 0, varianceSeconds: 1, ratePer60: 6 })).toThrow();
  });
});
