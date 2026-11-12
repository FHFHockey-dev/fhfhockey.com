import { describe, expect, it } from "vitest";

import { poissonProbability } from "./poisson";
import {
  generateProbabilityMatrixWithTieBreaker,
  matrixFinalWinProbabilities
} from "./poissonHelpers";
import { OVERTIME_RULE } from "lib/game-predictions/overtimeRule";

describe("Game Grid Poisson helpers (BC W1-10 A; decision 45)", () => {
  it("rejects a negative or NaN rate instead of returning P(0) = 1", () => {
    expect(poissonProbability(0, -1)).toBeNaN();
    expect(poissonProbability(0, Number.NaN)).toBeNaN();
    expect(poissonProbability(0, 0)).toBe(1);
    expect(poissonProbability(2, 0)).toBe(0);
    expect(generateProbabilityMatrixWithTieBreaker(-0.5, 2)).toBeNull();
    expect(generateProbabilityMatrixWithTieBreaker(Number.NaN, 2)).toBeNull();
  });

  it("has no NaN when both rates are 0: the certain 0-0 tie splits by the shared OT rule", () => {
    const matrix = generateProbabilityMatrixWithTieBreaker(0, 0)!;
    expect(matrix.flat().every(Number.isFinite)).toBe(true);
    const final = matrixFinalWinProbabilities(matrix)!;
    expect(final.home).toBeCloseTo(OVERTIME_RULE.homeShareOfTie, 12);
    expect(final.home + final.away).toBeCloseTo(1, 12);
    expect(final.rule.version).toBe("ot_split_50_50_v1");
  });

  it("splits regulation ties 50/50, not in proportion to regulation wins", () => {
    const matrix = generateProbabilityMatrixWithTieBreaker(3.2, 2.4)!;
    let homeReg = 0;
    let tie = 0;
    matrix.forEach((row, i) => row.forEach((p, j) => {
      if (i > j) homeReg += p;
      if (i === j) tie += p;
    }));
    const final = matrixFinalWinProbabilities(matrix)!;
    const mass = matrix.flat().reduce((sum, p) => sum + p, 0);
    expect(final.home).toBeCloseTo((homeReg + 0.5 * tie) / mass, 12);
    expect(final.home + final.away).toBeCloseTo(1, 12);
  });
});
