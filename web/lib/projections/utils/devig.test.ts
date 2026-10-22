import { describe, expect, it } from "vitest";
import {
  DEFAULT_YES_ONLY_OVERROUND,
  YES_ONLY_OVERROUND_ENV,
  americanToDecimal,
  americanToImpliedProbability,
  devig,
  devigShin,
  devigTwoWayAmerican,
  devigYesOnly,
  expectedValueAtAmericanPrice,
  impliedProbabilityToAmerican,
  isValidAmericanPrice,
  resolveYesOnlyOverround,
} from "./devig";

describe("American price conversion", () => {
  it("converts favourites and underdogs", () => {
    expect(americanToImpliedProbability(-150)).toBeCloseTo(0.6, 10);
    expect(americanToImpliedProbability(130)).toBeCloseTo(100 / 230, 10);
    expect(americanToDecimal(-110)).toBeCloseTo(1.909091, 6);
    expect(impliedProbabilityToAmerican(0.6)).toBeCloseTo(-150, 8);
    expect(impliedProbabilityToAmerican(0.25)).toBeCloseTo(300, 8);
  });

  it("rejects decimal odds stored as American prices", () => {
    expect(isValidAmericanPrice(1)).toBe(false);
    expect(isValidAmericanPrice(2)).toBe(false);
    expect(americanToImpliedProbability(2)).toBeNull();
    expect(devigTwoWayAmerican(1, 2)).toBeNull();
  });
});

describe("devig", () => {
  it("Shin on a known two-way market (-150 / +130)", () => {
    const result = devigTwoWayAmerican(-150, 130);
    expect(result?.fairA).toBeCloseTo(0.582609, 5);
    expect(result?.fairB).toBeCloseTo(0.417391, 5);
    expect(result?.shinZ).toBeCloseTo(0.034815, 5);
    expect(result?.overround).toBeCloseTo(0.034783, 5);
  });

  it("two-way Shin equals equal-margin; proportional differs", () => {
    const implied = [1 / 6, 8 / 9];
    const shin = devig(implied, "shin")!.probabilities;
    const equal = devig(implied, "equal-margin")!.probabilities;
    const prop = devig(implied, "proportional")!.probabilities;
    expect(shin[0]).toBeCloseTo(equal[0], 8);
    expect(shin[0]).toBeCloseTo(0.138889, 5);
    expect(prop[0]).toBeCloseTo(0.157895, 5);
  });

  it("Shin on a three-way market matches a reference solve", () => {
    const result = devigShin([1 / 2.1, 1 / 3.5, 1 / 3.9])!;
    expect(result.probabilities[0]).toBeCloseTo(0.469464, 5);
    expect(result.probabilities[1]).toBeCloseTo(0.279853, 5);
    expect(result.probabilities[2]).toBeCloseTo(0.250684, 5);
    expect(result.probabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });

  it("rejects books whose implied sum is implausible", () => {
    expect(devigTwoWayAmerican(-1000, -1000)).toBeNull();
  });

  it("Yes-only markets use equal margin with the assumed overround", () => {
    const result = devigYesOnly(300, { overround: 0.08 })!;
    expect(result.method).toBe("equal-margin");
    expect(result.probability).toBeCloseTo(0.21, 10);
    expect(devigYesOnly(300, { overround: 0.08, method: "proportional" })!.probability).toBeCloseTo(0.25 / 1.08, 10);
    // Extreme longshot falls back to proportional instead of going negative.
    expect(devigYesOnly(5000, { overround: 0.1 })!.method).toBe("proportional");
  });

  it("Yes-only estimates are labelled assumption-based and record where the overround came from", () => {
    expect(devigYesOnly(300, { env: {} })).toMatchObject({
      basis: "assumed-overround", overround: DEFAULT_YES_ONLY_OVERROUND, overroundSource: "default", implied: 0.25,
    });
    expect(devigYesOnly(300, { env: { [YES_ONLY_OVERROUND_ENV]: "0.06" } })).toMatchObject({
      overround: 0.06, overroundSource: "env", probability: 0.22,
    });
    expect(devigYesOnly(300, { overround: 0.1, env: { [YES_ONLY_OVERROUND_ENV]: "0.06" } })!.overroundSource).toBe("argument");
    // A bad configuration is refused rather than silently replaced by the default.
    expect(resolveYesOnlyOverround(undefined, { [YES_ONLY_OVERROUND_ENV]: "8" })).toBeNull();
    expect(resolveYesOnlyOverround(-0.01, {})).toBeNull();
    expect(devigYesOnly(300, { env: { [YES_ONLY_OVERROUND_ENV]: "abc" } })).toBeNull();
  });

  it("expected value at an offered price", () => {
    expect(expectedValueAtAmericanPrice(0.5, 100)).toBeCloseTo(0, 10);
    expect(expectedValueAtAmericanPrice(0.3, 300)).toBeCloseTo(0.2, 10);
  });
});
