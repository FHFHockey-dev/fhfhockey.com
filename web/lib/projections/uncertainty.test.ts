import { describe, expect, it } from "vitest";

import { buildGoalieUncertainty, buildPlayerUncertainty } from "./uncertainty";

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
