import { describe, expect, it } from "vitest";
import { boundedSimplex, computeStarterProbabilities } from "./goalie-starter";

describe("computeStarterProbabilities: closed three-candidate set (W1-5)", () => {
  it("sums to 1 when a third, long-idle goalie falls below the floor", () => {
    // Two equal regulars and a third unseen for 200 days: softmax gives roughly .4999/.4999/.0002,
    // which per-value clamping used to lift to a vector summing to about 1.0098.
    const probs = computeStarterProbabilities({
      asOfDate: "2025-11-20",
      candidateGoalieIds: [1, 2, 3],
      starterContext: {
        startsByGoalie: new Map([[1, 5], [2, 5]]),
        lastPlayedDateByGoalie: new Map([[1, "2025-11-18"], [2, "2025-11-19"], [3, "2025-05-04"]]),
        totalGames: 10,
        previousGameDate: null,
        previousGameStarterGoalieId: null
      },
      priorStartProbByGoalieId: new Map([[1, 0.5], [2, 0.5], [3, 0.02]]),
      teamGoalsFor: null,
      opponentGoalsFor: null
    });
    const values = [probs.get(1)!, probs.get(2)!, probs.get(3)!];
    expect(values.reduce((sum, v) => sum + v, 0)).toBeCloseTo(1, 12);
    expect(probs.get(3)).toBeCloseTo(0.01, 12);
    expect(probs.get(1)! + probs.get(2)!).toBeCloseTo(0.99, 12);
  });
});

describe("boundedSimplex", () => {
  it("keeps order, bounds and closure", () => {
    const out = boundedSimplex([0.98, 0.0195, 0.0005], 0.01, 0.98);
    expect(out.reduce((sum, v) => sum + v, 0)).toBeCloseTo(1, 12);
    expect(out[2]).toBeCloseTo(0.01, 12);
    expect(out[0]).toBeGreaterThan(out[1]);
    expect(Math.max(...out)).toBeLessThanOrEqual(0.98 + 1e-12);
  });
});
