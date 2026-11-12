import { describe, expect, it } from "vitest";

import {
  OVERTIME_RULE,
  finalWinProbabilitiesFromRegulation,
} from "./overtimeRule";

describe("shared overtime rule (decision 45)", () => {
  it("splits the regulation tie 50/50 and keeps the regulation and OT/SO parts apart", () => {
    const result = finalWinProbabilitiesFromRegulation({
      homeRegulationWin: 0.45,
      awayRegulationWin: 0.3,
      regulationTie: 0.25,
    })!;
    expect(result.home).toBeCloseTo(0.575, 12);
    expect(result.away).toBeCloseTo(0.425, 12);
    expect(result.home + result.away).toBeCloseTo(1, 12);
    expect(result.homeRegulationWin).toBe(0.45);
    expect(result.homeOvertimeWin).toBeCloseTo(0.125, 12);
    expect(result.awayOvertimeWin).toBeCloseTo(0.125, 12);
    expect(result.rule).toBe(OVERTIME_RULE);
    expect(OVERTIME_RULE.homeShareOfTie).toBe(0.5);
    expect(OVERTIME_RULE.label).toMatch(/approximation/i);
  });

  it("is symmetric under swapping sides (no assumed home edge)", () => {
    const a = finalWinProbabilitiesFromRegulation({ homeRegulationWin: 0.4, awayRegulationWin: 0.35, regulationTie: 0.25 })!;
    const b = finalWinProbabilitiesFromRegulation({ homeRegulationWin: 0.35, awayRegulationWin: 0.4, regulationTie: 0.25 })!;
    expect(a.home).toBeCloseTo(b.away, 12);
  });

  it("renormalises a truncated grid by its total mass and rejects invalid input", () => {
    const truncated = finalWinProbabilitiesFromRegulation({ homeRegulationWin: 0.44, awayRegulationWin: 0.3, regulationTie: 0.25 })!;
    expect(truncated.home + truncated.away).toBeCloseTo(1, 12);
    expect(truncated.capturedMass).toBeCloseTo(0.99, 12);
    for (const bad of [
      { homeRegulationWin: -0.1, awayRegulationWin: 0.6, regulationTie: 0.5 },
      { homeRegulationWin: Number.NaN, awayRegulationWin: 0.5, regulationTie: 0.5 },
      { homeRegulationWin: 0, awayRegulationWin: 0, regulationTie: 0 },
      { homeRegulationWin: 0.3, awayRegulationWin: 0.3, regulationTie: 0.2 },
    ]) {
      expect(finalWinProbabilitiesFromRegulation(bad)).toBeNull();
    }
  });
});
