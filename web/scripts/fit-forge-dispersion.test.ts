import { describe, expect, it } from "vitest";
import { toiConditionalDispersionMoments } from "./fit-forge-dispersion";

// Seeded Poisson draws (Knuth) for a frozen simulation: no overdispersion by construction.
function rng(seed: number) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}
function poisson(mean: number, rand: () => number) {
  const limit = Math.exp(-mean);
  let k = 0, p = rand();
  while (p > limit) { k += 1; p *= rand(); }
  return k;
}

describe("TOI-conditional dispersion moments (W1-7 N3)", () => {
  it("is unbiased with unequal exposures when the true overdispersion is zero", () => {
    const rand = rng(20261112);
    let nc = 0, dc = 0, ncOld = 0, dcOld = 0;
    const players = 40000;
    for (let player = 0; player < players; player += 1) {
      // 20 games alternating exposures 1 and 3 at one count per unit of exposure.
      const games = Array.from({ length: 20 }, (_, g) => { const toi = g % 2 ? 3 : 1; return { toi, x: poisson(toi, rand) }; });
      const moments = toiConditionalDispersionMoments(games);
      nc += moments.nc; dc += moments.dc;
      const T = games.reduce((s, g) => s + g.toi, 0), r = games.reduce((s, g) => s + g.x, 0) / T;
      const smu = r * T, smu2 = games.reduce((s, g) => s + (r * g.toi) ** 2, 0);
      ncOld += moments.rss * 20 / 19 - smu; dcOld += smu2;
    }
    // Per-player excess (the alpha numerator): expected 0 here, the former correction -0.526
    // (= 37.5 x 20/19 - 40 at r = 1). The simulation SE of a 40,000-player mean is about 0.08.
    expect(Math.abs(nc / players)).toBeLessThan(0.25);
    expect(ncOld / players).toBeLessThan(-0.3);
    expect(dc).toBeGreaterThan(0);
    expect(dcOld).toBeGreaterThan(0);
  });

  it("reduces to the n/(n-1) correction at equal exposure", () => {
    const games = [2, 0, 1, 3, 1].map(x => ({ x, toi: 1 }));
    const { rss, expectedPoissonRss } = toiConditionalDispersionMoments(games);
    const smu = 7;
    expect(rss - expectedPoissonRss).toBeCloseTo(rss - smu * 4 / 5, 12);
  });
});
