import { describe, expect, it } from "vitest";

import {
  buildGoalieUncertainty,
  buildPlayerUncertainty,
  countCdf,
  countPmf,
  countProbabilityAtLeast,
  countQuantile,
  overUnderPushProbabilities,
  probabilityOverLine,
  sampleNegativeBinomial,
  summarizeCountDistribution,
  summarizeStatDistribution
} from "./uncertainty";

describe("goalie uncertainty scenario mixture", () => {
  it("shifts quantiles when starter scenarios are mixed", () => {
    const single = buildGoalieUncertainty({
      shotsAgainst: 30,
      goalsAllowed: 2.7,
      saves: 27.3
    });
    const mixed = buildGoalieUncertainty(
      {
        shotsAgainst: 30,
        goalsAllowed: 3.1,
        saves: 26.9
      },
      1,
      undefined,
      [
        { weight: 0.65, shotsAgainst: 32, goalsAllowed: 2.8, saves: 29.2 },
        { weight: 0.35, shotsAgainst: 26, goalsAllowed: 3.7, saves: 22.3 }
      ]
    );

    expect(mixed.saves.p10).toBeLessThan(single.saves.p10);
    expect(mixed.saves.p90).toBeGreaterThan(single.saves.p90);
    expect(mixed.goals_allowed.p50).toBeGreaterThan(2.7);
  });
});

describe("player uncertainty scenario mixture", () => {
  it("widens goal/assist uncertainty when role scenarios are mixed", () => {
    const single = buildPlayerUncertainty({
      toiEsSeconds: 920,
      toiPpSeconds: 180,
      shotsEs: 7.8,
      shotsPp: 2.3,
      goalsEs: 0.78,
      goalsPp: 0.31,
      assistsEs: 0.84,
      assistsPp: 0.43,
      hits: 0.9,
      blocks: 0.7
    });
    const mixed = buildPlayerUncertainty(
      {
        toiEsSeconds: 920,
        toiPpSeconds: 180,
        shotsEs: 7.8,
        shotsPp: 2.3,
        goalsEs: 0.78,
        goalsPp: 0.31,
        assistsEs: 0.84,
        assistsPp: 0.43,
        hits: 0.9,
        blocks: 0.7
      },
      1,
      undefined,
      [
        { weight: 0.68, goalsEs: 0.52, goalsPp: 0.22, assistsEs: 0.58, assistsPp: 0.29 },
        { weight: 0.32, goalsEs: 1.36, goalsPp: 0.56, assistsEs: 1.48, assistsPp: 0.79 }
      ]
    );

    expect(mixed.g.p90).toBeGreaterThan(single.g.p90);
    expect(mixed.pts.p90).toBeGreaterThan(single.pts.p90);
  });

  it("keeps uncertainty close to baseline when scenario mixture is near-uniform around baseline", () => {
    const baseline = buildPlayerUncertainty({
      toiEsSeconds: 930,
      toiPpSeconds: 170,
      shotsEs: 6.2,
      shotsPp: 1.9,
      goalsEs: 0.63,
      goalsPp: 0.24,
      assistsEs: 0.66,
      assistsPp: 0.29,
      hits: 0.8,
      blocks: 0.65
    });
    const mixed = buildPlayerUncertainty(
      {
        toiEsSeconds: 930,
        toiPpSeconds: 170,
        shotsEs: 6.2,
        shotsPp: 1.9,
        goalsEs: 0.63,
        goalsPp: 0.24,
        assistsEs: 0.66,
        assistsPp: 0.29,
        hits: 0.8,
        blocks: 0.65
      },
      1,
      undefined,
      [
        { weight: 0.5, goalsEs: 0.6, goalsPp: 0.23, assistsEs: 0.64, assistsPp: 0.28 },
        { weight: 0.5, goalsEs: 0.66, goalsPp: 0.25, assistsEs: 0.68, assistsPp: 0.3 }
      ]
    );
    expect(Math.abs(mixed.g.p50 - baseline.g.p50)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(mixed.a.p50 - baseline.a.p50)).toBeLessThanOrEqual(0.5);
  });
});

const LEGACY_PLAYER_INPUT = {
  toiEsSeconds: 920,
  toiPpSeconds: 180,
  shotsEs: 2.4,
  shotsPp: 0.6,
  goalsEs: 0.28,
  goalsPp: 0.1,
  assistsEs: 0.3,
  assistsPp: 0.12,
  hits: 1.4,
  blocks: 0.6
};

function poissonPmfReference(mean: number, k: number): number {
  let logP = -mean;
  for (let i = 1; i <= k; i += 1) logP += Math.log(mean / i);
  return Math.exp(logP);
}

function seededRand(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (Math.imul(t, 1664525) + 1013904223) >>> 0;
    return t / 4294967296;
  };
}

describe("legacy Poisson path", () => {
  it("is unchanged when no count model is passed", () => {
    const player = buildPlayerUncertainty(
      LEGACY_PLAYER_INPUT,
      3,
      [1, 0.9, 1.1],
      [
        { weight: 0.6, goalsEs: 0.25 },
        { weight: 0.4, goalsEs: 0.35 }
      ],
      1.2
    );
    expect(player.sog).toEqual({ p10: 4.2, p50: 9, p90: 12.6 });
    expect(player.hit).toEqual({ p10: 1.6, p50: 4, p90: 7.6 });
    expect(player.blk).toEqual({ p10: 0, p50: 2, p90: 4.4 });
    expect(player.pts).toEqual({ p10: 0.8, p50: 2, p90: 4.4 });
    const goalie = buildGoalieUncertainty(
      { shotsAgainst: 29, goalsAllowed: 2.8, saves: 26.2 },
      2
    );
    expect(goalie.saves).toEqual({ p10: 42, p50: 52, p90: 61 });
    expect(goalie.shots_against).toEqual({ p10: 48, p50: 57, p90: 68 });
  });
});

describe("count distributions (negative binomial / Poisson)", () => {
  const cases: Array<[number, number]> = [
    [0.3, 0],
    [0.3, 0.3],
    [2.5, 0.05],
    [2.5, 0.5],
    [25, 0.04],
    [150, 0.008]
  ];

  it.each(cases)("pmf sums to 1 with matching mean/variance (mu=%s, alpha=%s)", (mu, alpha) => {
    const pmf = countPmf(mu, alpha);
    const total = pmf.reduce((s, p) => s + p, 0);
    const mean = pmf.reduce((s, p, k) => s + p * k, 0);
    const variance = pmf.reduce((s, p, k) => s + p * (k - mean) ** 2, 0);
    expect(total).toBeCloseTo(1, 9);
    expect(mean).toBeCloseTo(mu, 6);
    expect(variance).toBeCloseTo(mu + alpha * mu * mu, 4);
    expect(countCdf(pmf.length + 10, mu, alpha)).toBeCloseTo(1, 9);
  });

  it("reduces to Poisson as alpha goes to 0", () => {
    for (const mu of [0.4, 2.2, 28]) {
      const poisson = countPmf(mu, 0);
      for (let k = 0; k < poisson.length; k += 1) {
        expect(poisson[k]).toBeCloseTo(poissonPmfReference(mu, k), 12);
      }
      const nearZero = countPmf(mu, 1e-7);
      const gap = Math.max(...poisson.map((p, k) => Math.abs(p - (nearZero[k] ?? 0))));
      expect(gap).toBeLessThan(1e-5);
      const small = countPmf(mu, 1e-3);
      const larger = countPmf(mu, 1e-2);
      const gapSmall = Math.max(...poisson.map((p, k) => Math.abs(p - (small[k] ?? 0))));
      const gapLarger = Math.max(...poisson.map((p, k) => Math.abs(p - (larger[k] ?? 0))));
      expect(gapSmall).toBeLessThan(gapLarger);
    }
    expect(countPmf(0, 0.2)).toEqual([1]);
  });

  it("keeps P(X >= k) and quantiles monotone", () => {
    for (const alpha of [0, 0.1, 0.6]) {
      let previous = 1;
      for (let k = 0; k <= 12; k += 1) {
        const tail = countProbabilityAtLeast(k, 2.8, alpha);
        expect(tail).toBeLessThanOrEqual(previous + 1e-12);
        expect(tail + countCdf(k - 1, 2.8, alpha)).toBeCloseTo(1, 10);
        previous = tail;
      }
      let previousQuantile = 0;
      for (const p of [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95]) {
        const q = countQuantile(p, 2.8, alpha);
        expect(q).toBeGreaterThanOrEqual(previousQuantile);
        expect(countCdf(q, 2.8, alpha)).toBeGreaterThanOrEqual(p - 1e-12);
        if (q > 0) expect(countCdf(q - 1, 2.8, alpha)).toBeLessThan(p);
        previousQuantile = q;
      }
      // Monotone in the mean too.
      expect(countProbabilityAtLeast(3, 3.2, alpha)).toBeGreaterThan(
        countProbabilityAtLeast(3, 2.8, alpha)
      );
      expect(countQuantile(0.9, 6, alpha)).toBeGreaterThanOrEqual(countQuantile(0.9, 2.8, alpha));
    }
  });

  it("fattens both tails relative to Poisson", () => {
    const poisson = summarizeCountDistribution(3, 0);
    const nb = summarizeCountDistribution(3, 0.1);
    expect(poisson.model).toBe("poisson");
    expect(nb.model).toBe("negative_binomial");
    expect(nb.variance).toBeCloseTo(3.9, 6);
    expect(nb.pAtLeast[1]).toBeLessThan(poisson.pAtLeast[1]);
    expect(nb.pAtLeast[5]).toBeGreaterThan(poisson.pAtLeast[5]);
    expect(nb.quantiles.p90).toBeGreaterThanOrEqual(poisson.quantiles.p90);
  });

  it("serves fitted stats and falls back to Poisson", () => {
    const sog = summarizeStatDistribution("sog", "C", 3);
    expect(sog.model).toBe("negative_binomial");
    expect(sog.alpha).toBeGreaterThan(0);
    expect(summarizeStatDistribution("g", "L", 0.4).model).toBe("poisson");
    const unknown = summarizeStatDistribution("sog", null, 3);
    expect(unknown).toEqual(summarizeCountDistribution(3, 0));
    const forced = summarizeStatDistribution("sog", "F", 3, { alphaOverride: null });
    expect(forced.model).toBe("poisson");
    const horizon = summarizeStatDistribution("sog", "F", 15, { horizonGames: 5 });
    expect(horizon.alpha).toBeLessThan(sog.alpha);
  });

  it("prices over/under lines with push handling", () => {
    const half = overUnderPushProbabilities(2.9, 0.08, 2.5);
    expect(half.push).toBe(0);
    expect(half.over).toBeCloseTo(countProbabilityAtLeast(3, 2.9, 0.08), 12);
    expect(half.over + half.under).toBeCloseTo(1, 10);
    const whole = overUnderPushProbabilities(2.9, 0.08, 3);
    expect(whole.push).toBeCloseTo(countPmf(2.9, 0.08)[3], 12);
    expect(whole.over + whole.under + whole.push).toBeCloseTo(1, 10);
    expect(whole.over).toBeCloseTo(countProbabilityAtLeast(4, 2.9, 0.08), 12);

    const nbOver = probabilityOverLine("sog", "F", 3, 4.5);
    const poissonOver = probabilityOverLine("sog", "F", 3, 4.5, { alphaOverride: null });
    expect(nbOver).toBeGreaterThan(poissonOver);
    expect(probabilityOverLine("sog", "F", 3, 0.5)).toBeLessThan(
      probabilityOverLine("sog", "F", 3, 0.5, { alphaOverride: null })
    );
    expect(probabilityOverLine("g", "F", 0.45, 0.5)).toBeCloseTo(1 - Math.exp(-0.45), 12);
    // Higher means price higher overs.
    expect(probabilityOverLine("sv", "G", 28, 25.5)).toBeGreaterThan(
      probabilityOverLine("sv", "G", 24, 25.5)
    );
  });

  it("samples negative binomial draws with the target moments", () => {
    const rand = seededRand(12345);
    const draws = Array.from({ length: 40000 }, () => sampleNegativeBinomial(2.5, 0.3, rand));
    const mean = draws.reduce((s, x) => s + x, 0) / draws.length;
    const variance = draws.reduce((s, x) => s + (x - mean) ** 2, 0) / draws.length;
    expect(mean).toBeGreaterThan(2.4);
    expect(mean).toBeLessThan(2.6);
    expect(variance).toBeGreaterThan(4.0);
    expect(variance).toBeLessThan(4.7);
  });
});

describe("opt-in negative binomial simulation", () => {
  it("widens skater SOG/hits/blocks and goalie saves when enabled", () => {
    const poisson = buildPlayerUncertainty(LEGACY_PLAYER_INPUT, 1);
    const nb = buildPlayerUncertainty(LEGACY_PLAYER_INPUT, 1, undefined, undefined, 1, {
      negativeBinomial: true,
      position: "C"
    });
    expect(nb.hit.p90).toBeGreaterThanOrEqual(poisson.hit.p90);
    expect(nb.sog.p90).toBeGreaterThanOrEqual(poisson.sog.p90);
    expect(nb.blk.p90).toBeGreaterThanOrEqual(poisson.blk.p90);
    const unknownPosition = buildPlayerUncertainty(LEGACY_PLAYER_INPUT, 1, undefined, undefined, 1, {
      negativeBinomial: true,
      position: null
    });
    expect(unknownPosition.sog).toEqual(poisson.sog);

    const goalieInput = { shotsAgainst: 29, goalsAllowed: 2.8, saves: 26.2 };
    const goaliePoisson = buildGoalieUncertainty(goalieInput, 1);
    const goalieNb = buildGoalieUncertainty(goalieInput, 1, undefined, undefined, {
      negativeBinomial: true,
      position: "G"
    });
    expect(goalieNb.saves.p90 - goalieNb.saves.p10).toBeGreaterThan(
      goaliePoisson.saves.p90 - goaliePoisson.saves.p10
    );
  });
});
