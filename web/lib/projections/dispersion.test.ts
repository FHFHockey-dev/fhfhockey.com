import { describe, expect, it } from "vitest";

import {
  FORGE_DISPERSION,
  compoundToiDispersion,
  getDispersionFit,
  normalizeDispersionPosition,
  resolveDispersionAlpha
} from "./dispersion";

describe("FORGE dispersion constants", () => {
  it("normalizes positions to F/D/G", () => {
    expect(normalizeDispersionPosition("C")).toBe("F");
    expect(normalizeDispersionPosition("lw")).toBe("F");
    expect(normalizeDispersionPosition("D")).toBe("D");
    expect(normalizeDispersionPosition("G")).toBe("G");
    expect(normalizeDispersionPosition(undefined)).toBeNull();
    expect(getDispersionFit("sv", "C")).toBeNull();
  });

  it("keeps goals and assists Poisson and the rest overdispersed", () => {
    for (const pos of ["F", "D"]) {
      expect(resolveDispersionAlpha("g", pos, 0.4)).toBe(0);
      expect(resolveDispersionAlpha("a", pos, 0.4)).toBe(0);
      for (const stat of ["sog", "hit", "blk"] as const) {
        expect(resolveDispersionAlpha(stat, pos, 1.5)).toBeGreaterThan(0);
      }
    }
    expect(resolveDispersionAlpha("sv", "G", 26)).toBeCloseTo(0.0401, 6);
    expect(resolveDispersionAlpha("sog", null, 2)).toBeNull();
  });

  it("matches the summed-game variance over a horizon", () => {
    const fit = FORGE_DISPERSION["sog:F"]!.unconditional;
    const perGame = 2.4;
    const horizon = 4;
    const perGameVar = perGame * (1 + fit.b) + fit.a * perGame * perGame;
    const total = perGame * horizon;
    const alpha = resolveDispersionAlpha("sog", "F", total, { horizonGames: horizon })!;
    expect(total + alpha * total * total).toBeCloseTo(perGameVar * horizon, 10);
  });

  it("compounds TOI noise into the TOI-conditional fit", () => {
    const compounded = compoundToiDispersion({ a: 0.02, b: 0.05 }, 0.15);
    expect(compounded.a).toBeCloseTo(0.02 * 1.0225 + 0.0225, 12);
    expect(compounded.b).toBe(0.05);
    expect(compoundToiDispersion({ a: 0.02, b: 0.05 }, 0)).toEqual({ a: 0.02, b: 0.05 });
    // TOI-conditional + measured TOI CV^2 should land near the unconditional fit.
    for (const key of ["sog:F", "sog:D", "blk:F", "blk:D", "sv:G", "sa:G"] as const) {
      const fit = FORGE_DISPERSION[key]!;
      const [stat, pos] = key.split(":") as ["sog" | "blk" | "sv" | "sa", string];
      for (const mu of stat === "sv" || stat === "sa" ? [24, 28] : [1, 2.5]) {
        const viaToi = resolveDispersionAlpha(stat, pos, mu, { toiCv: Math.sqrt(fit.toiCv2) })!;
        const direct = resolveDispersionAlpha(stat, pos, mu)!;
        expect(Math.abs(viaToi - direct) / direct).toBeLessThan(0.35);
      }
    }
  });
});
