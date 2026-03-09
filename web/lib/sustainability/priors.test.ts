import { describe, expect, it } from "vitest";

import {
  applyPositionLeagueFallback,
  betaFromMuK,
  ROOKIE_FALLBACK_MIN_TRIALS
} from "./priors";

describe("applyPositionLeagueFallback", () => {
  it("keeps the original position prior when trials meet the threshold", () => {
    const prior = betaFromMuK(0.1, 200);
    const result = applyPositionLeagueFallback(
      prior,
      "shp",
      ROOKIE_FALLBACK_MIN_TRIALS.shp
    );

    expect(result.alpha0).toBeCloseTo(prior.alpha0);
    expect(result.beta0).toBeCloseTo(prior.beta0);
    expect(result.fallback_weight).toBe(0);
  });

  it("boosts league-prior strength for low-sample players", () => {
    const prior = betaFromMuK(0.08, 200);
    const result = applyPositionLeagueFallback(prior, "shp", 20);

    expect(result.adjusted_k).toBeGreaterThan(prior.alpha0 + prior.beta0);
    expect(result.fallback_weight).toBeGreaterThan(0);
    expect(result.alpha0 / result.adjusted_k).toBeCloseTo(0.08);
  });

  it("applies the strongest fallback when a player has no usable trials", () => {
    const prior = betaFromMuK(0.65, 60);
    const result = applyPositionLeagueFallback(prior, "ipp", 0);

    expect(result.fallback_weight).toBe(1);
    expect(result.adjusted_k).toBeCloseTo((prior.alpha0 + prior.beta0) * 2);
    expect(result.alpha0 / result.adjusted_k).toBeCloseTo(0.65);
  });
});
