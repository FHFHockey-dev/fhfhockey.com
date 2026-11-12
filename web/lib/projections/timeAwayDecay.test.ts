import { describe, expect, it } from "vitest";
import {
  VALIDATED_TIME_AWAY_FIT, buildReturnObservations, fitAndValidateTimeAwayDecay, fitTimeAwayDecay, poissonDeviance,
  timeAwayDisclosure, timeAwayEvidence, type ReturnObservation, type SkaterGameRow,
} from "./timeAwayDecay";

// Deterministic pseudo-random draws so the synthetic returns are reproducible (invented data, mechanics only).
function rng(seed: number) {
  let state = seed >>> 0;
  return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
function poisson(mu: number, u: () => number) {
  let k = 0, p = Math.exp(-mu), cdf = p;
  const x = u();
  while (x > cdf && k < 200) { k++; p *= mu / k; cdf += p; }
  return k;
}
/** Returns whose true post-gap mean is `ratio(days)` times the undecayed line, dated across two seasons. */
function synthetic(ratio: (days: number) => number, n: number, seed: number): ReturnObservation[] {
  const u = rng(seed), out: ReturnObservation[] = [];
  for (let i = 0; i < n; i++) {
    const daysAway = i % 3 === 0 ? 2 + Math.floor(u() * 3) : 10 + Math.floor(u() * 150);
    const expected = 2 + 4 * u();
    const day = new Date(Date.UTC(2024, 9, 1) + Math.floor((i / n) * 540) * 86_400_000).toISOString().slice(0, 10);
    out.push({ playerId: 1 + (i % 400), returnDate: day, daysAway, expected, observed: poisson(expected * ratio(daysAway), u), postGames: 5 });
  }
  return out;
}

describe("time-away evidence and disclosure (decision 132.2)", () => {
  it("reports days away and keeps an unknown last game unknown", () => {
    expect(timeAwayEvidence("2026-10-20", "2026-11-20")).toEqual({ last_game_date: "2026-10-20", days_away: 31, status: "away" });
    expect(timeAwayEvidence("2026-11-18", "2026-11-20")).toMatchObject({ days_away: 2, status: "active" });
    expect(timeAwayEvidence(null, "2026-11-20")).toEqual({ last_game_date: null, days_away: null, status: "unknown" });
  });

  it("applies nothing while no fit is validated: the line stands and the widening is unquantified", () => {
    expect(VALIDATED_TIME_AWAY_FIT).toBeNull();
    expect(timeAwayDisclosure(timeAwayEvidence("2026-10-20", "2026-11-20")).decay)
      .toEqual({ status: "unvalidated", applied: false, mean_ratio: null, dispersion_ratio: null, uncertainty: "widened_unquantified" });
  });

  it("uses a fit's bin only when the fit passed held-out validation", () => {
    const obs = synthetic(days => (days > 5 ? 0.8 : 1), 3000, 7);
    const fit = fitAndValidateTimeAwayDecay(obs, { stat: "points", splitDate: "2025-08-01" });
    expect(fit.validation!.passed).toBe(true);
    const decay = timeAwayDisclosure(timeAwayEvidence("2026-10-20", "2026-11-20"), fit).decay;
    expect(decay).toMatchObject({ status: "validated", applied: true });
    // The 21–45-day bin's estimate of the true 0.8 (about 190 training returns, sampling error near 0.04).
    expect((decay as { mean_ratio: number }).mean_ratio).toBeGreaterThan(0.7);
    expect((decay as { mean_ratio: number }).mean_ratio).toBeLessThan(0.9);
    const unvalidated = { ...fit, validation: { ...fit.validation!, passed: false } };
    expect(timeAwayDisclosure(timeAwayEvidence("2026-10-20", "2026-11-20"), unvalidated).decay).toMatchObject({ applied: false });
  });
});

describe("time-away fit harness (rules 11, 12)", () => {
  it("builds one observation per gap from game rows, with the pre-gap per-game mean as the undecayed line", () => {
    const rows: SkaterGameRow[] = [];
    const add = (date: string, value: number) => rows.push({ playerId: 7, gameDate: date, value });
    for (let d = 1; d <= 10; d++) add(`2025-01-${String(d * 2).padStart(2, "0")}`, d % 2); // 10 games, 5 points
    for (let d = 1; d <= 5; d++) add(`2025-03-${String(d * 2).padStart(2, "0")}`, 0);     // return after 41 days (Jan 20 → Mar 2), 0 points
    const obs = buildReturnObservations(rows, { preGames: 10, postGames: 5 });
    expect(obs).toEqual([{ playerId: 7, returnDate: "2025-03-02", daysAway: 41, expected: 2.5, observed: 0, postGames: 5 }]);
  });

  it("recovers a true multiplicative decay by bin and the Poisson MLE equals observed over expected", () => {
    const obs = synthetic(days => (days > 45 ? 0.7 : 1), 6000, 11);
    const fit = fitTimeAwayDecay(obs, { stat: "points" });
    const bin = (min: number) => fit.bins.find(b => b.minDays === min)!;
    const inBin = obs.filter(o => o.daysAway >= 46 && o.daysAway <= 120);
    expect(bin(46).meanRatio).toBeCloseTo(inBin.reduce((s, o) => s + o.observed, 0) / inBin.reduce((s, o) => s + o.expected, 0), 12);
    expect(bin(46).meanRatio!).toBeGreaterThan(0.6);
    expect(bin(46).meanRatio!).toBeLessThan(0.8);
    expect(bin(10).meanRatio!).toBeGreaterThan(0.9);
    // Poisson data: dispersion near 1 in the control group.
    expect(fit.control.dispersion!).toBeGreaterThan(0.8);
    expect(fit.control.dispersion!).toBeLessThan(1.2);
  });

  it("fails validation when time away has no effect, so no decay is ever applied by default", () => {
    const fit = fitAndValidateTimeAwayDecay(synthetic(() => 1, 3000, 3), { stat: "points", splitDate: "2025-08-01" });
    expect(fit.validation!.heldOutReturns).toBeGreaterThan(100);
    expect(fit.validation!.passed).toBe(false);
  });

  it("scores deviance against the undecayed line: zero at the mean, positive elsewhere", () => {
    expect(poissonDeviance(3, 3)).toBe(0);
    expect(poissonDeviance(0, 2)).toBeCloseTo(4, 12);
    expect(poissonDeviance(5, 2)).toBeGreaterThan(0);
  });
});
