import { describe, expect, it } from "vitest";

import {
  displayScore,
  rateFromTotals,
  sustainabilityGap,
  vuduSaveGap,
  watchLabel,
  type RateBasis
} from "./gap";

const basis: RateBasis = "per_appearance";
const gapFor = (expected: number | null | undefined, recent: number | null | undefined, lowerIsBetter = false) =>
  sustainabilityGap({ expected: { value: expected, basis }, recent: { value: recent, basis }, basis, lowerIsBetter });

describe("Sustainability Gap", () => {
  it("hot-but-supported", () => {
    const result = gapFor(1.19, 1.2);
    expect(result.gap).toBeCloseTo(-0.01);
    expect(Math.abs(displayScore(result.orientedGap!, 0.4))).toBeLessThan(3);
    expect(watchLabel(result.orientedGap, 0.1)).toBeNull();
  });

  it("hot-and-overextended", () => {
    const result = gapFor(0.8, 1.2);
    expect(result.gap).toBeCloseTo(-0.4);
    expect(displayScore(result.orientedGap!, 0.4)).toBeCloseTo(-76.1594, 4);
    expect(watchLabel(result.orientedGap, 0.1)).toBe("Cooling watch");
  });

  it("cold-with-improving-role", () => {
    const result = gapFor(0.8, 0.4);
    expect(result.gap).toBeCloseTo(0.4);
    expect(displayScore(result.orientedGap!, 0.4)).toBeCloseTo(76.1594, 4);
    expect(watchLabel(result.orientedGap, 0.1)).toBe("Rebound watch");
  });

  it("cold-with-declining-role", () => {
    const result = gapFor(0.19, 0.2);
    expect(result.gap).toBeCloseTo(-0.01);
    expect(Math.abs(displayScore(result.orientedGap!, 0.4))).toBeLessThan(3);
    expect(watchLabel(result.orientedGap, 0.1)).toBeNull();
  });

  it("flips lower-is-better orientation while preserving the native gap", () => {
    const result = gapFor(2.4, 3.2, true);
    expect(result.gap).toBeCloseTo(-0.8);
    expect(result.orientedGap).toBeCloseTo(0.8);
    expect(watchLabel(result.orientedGap, 0.1)).toBe("Rebound watch");
    expect(watchLabel(gapFor(3.2, 2.4, true).orientedGap, 0.1)).toBe("Cooling watch");
  });

  it.each<RateBasis>(["per_scheduled_team_game", "per_appearance", "per_60", "per_100_on_net_shots"])(
    "preserves the %s basis", selectedBasis => {
      expect(sustainabilityGap({
        expected: { value: 2, basis: selectedBasis },
        recent: { value: 1, basis: selectedBasis },
        basis: selectedBasis
      })).toEqual({ gap: 1, orientedGap: 1, basis: selectedBasis });
    }
  );

  it("throws for mismatched bases, including a mismatched requested basis", () => {
    const rates = { expected: { value: 1, basis }, recent: { value: 1, basis: "per_60" as const }, basis };
    expect(() => sustainabilityGap(rates)).toThrow(/basis/);
    expect(() => sustainabilityGap({ ...rates, recent: rates.expected, basis: "per_60" })).toThrow(/basis/);
    expect(() => sustainabilityGap({ ...rates, expected: { value: null, basis } })).toThrow(/basis/);
  });

  it.each([null, undefined])("preserves missing %s inputs as null, not zero", missing => {
    expect(gapFor(missing, 0.4)).toEqual({ gap: null, orientedGap: null, basis });
    expect(gapFor(0.8, missing)).toEqual({ gap: null, orientedGap: null, basis });
    expect(rateFromTotals(missing, 100)).toBeNull();
    expect(rateFromTotals(90, missing)).toBeNull();
    expect(vuduSaveGap({ expectedSaveProb: missing, recentSaves: 90, recentShotsOnNet: 100 })).toBeNull();
    expect(vuduSaveGap({ expectedSaveProb: 0.92, recentSaves: missing, recentShotsOnNet: 100 })).toBeNull();
    expect(vuduSaveGap({ expectedSaveProb: 0.92, recentSaves: 90, recentShotsOnNet: missing })).toBeNull();
    expect(watchLabel(missing, 0.1)).toBeNull();
  });

  it("derives VuDu saves per 100 on-net shots from pooled totals", () => {
    expect(vuduSaveGap({ expectedSaveProb: 0.92, recentSaves: 90, recentShotsOnNet: 100 })).toBeCloseTo(2);
    expect(vuduSaveGap({ expectedSaveProb: 0.9, recentSaves: 95, recentShotsOnNet: 100 })).toBeCloseTo(-5);
    // 9/10 and 81/100 must be pooled as 90/110, not averaged as 0.855.
    expect(rateFromTotals(9 + 81, 10 + 100)).toBeCloseTo(90 / 110);
    expect(vuduSaveGap({ expectedSaveProb: 0.92, recentSaves: 9 + 81, recentShotsOnNet: 10 + 100 }))
      .toBeCloseTo(100 * (0.92 - 90 / 110));
    // GAA: total goals against * 60 / total minutes, not mean individual GAA.
    expect(rateFromTotals((1 + 4) * 60, 30 + 60)).toBeCloseTo(10 / 3);
  });

  it("returns null for zero exposure and preserves observed zero production", () => {
    expect(rateFromTotals(0, 0)).toBeNull();
    expect(rateFromTotals(3, 0)).toBeNull();
    expect(vuduSaveGap({ expectedSaveProb: 0.92, recentSaves: 0, recentShotsOnNet: 0 })).toBeNull();
    expect(vuduSaveGap({ expectedSaveProb: 0.92, recentSaves: 3, recentShotsOnNet: 0 })).toBeNull();
    expect(rateFromTotals(0, 100)).toBe(0);
    expect(gapFor(0, 0)).toEqual({ gap: 0, orientedGap: 0, basis });
    expect(gapFor(0, 0, true).orientedGap).toBe(0);
    expect(vuduSaveGap({ expectedSaveProb: 0, recentSaves: 0, recentShotsOnNet: 100 })).toBe(0);
  });

  it("normalizes display only and uses inclusive native-unit watch thresholds", () => {
    expect(displayScore(0, 0.4)).toBe(0);
    expect(displayScore(1e6, 0.4)).toBe(100);
    expect(displayScore(-1e6, 0.4)).toBe(-100);
    expect(watchLabel(0.1, 0.1)).toBe("Rebound watch");
    expect(watchLabel(-0.1, 0.1)).toBe("Cooling watch");
    expect(watchLabel(0.099, 0.1)).toBeNull();
    expect(watchLabel(-0.099, 0.1)).toBeNull();
    expect(watchLabel(0, 0)).toBeNull();
  });

  it.each([NaN, Infinity, -Infinity])("rejects non-finite input %s", invalid => {
    expect(() => gapFor(invalid, 1)).toThrow();
    expect(() => gapFor(1, invalid)).toThrow();
    expect(() => displayScore(invalid, 1)).toThrow();
    expect(() => displayScore(1, invalid)).toThrow();
    expect(() => rateFromTotals(invalid, 1)).toThrow();
    expect(() => rateFromTotals(1, invalid)).toThrow();
    expect(() => watchLabel(invalid, 0.1)).toThrow();
    expect(() => watchLabel(0.1, invalid)).toThrow();
    expect(() => vuduSaveGap({ expectedSaveProb: invalid, recentSaves: 90, recentShotsOnNet: 100 })).toThrow();
  });

  it("rejects invalid scales, exposures, save probabilities and counts", () => {
    for (const scale of [0, -1]) expect(() => displayScore(1, scale)).toThrow();
    expect(() => rateFromTotals(1, -1)).toThrow();
    expect(() => watchLabel(1, -1)).toThrow();
    for (const expectedSaveProb of [-0.1, 92]) {
      expect(() => vuduSaveGap({ expectedSaveProb, recentSaves: 90, recentShotsOnNet: 100 })).toThrow();
    }
    expect(() => vuduSaveGap({ expectedSaveProb: 0.92, recentSaves: -1, recentShotsOnNet: 100 })).toThrow();
    expect(() => vuduSaveGap({ expectedSaveProb: 0.92, recentSaves: 101, recentShotsOnNet: 100 })).toThrow();
    expect(() => vuduSaveGap({ expectedSaveProb: 0.92, recentSaves: 0, recentShotsOnNet: -1 })).toThrow();
    expect(() => gapFor(Number.MAX_VALUE, -Number.MAX_VALUE)).toThrow();
    expect(() => rateFromTotals(Number.MAX_VALUE, Number.MIN_VALUE)).toThrow();
  });
});
