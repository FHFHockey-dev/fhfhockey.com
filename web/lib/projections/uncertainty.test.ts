import { describe, expect, it } from "vitest";

import { buildGoalieUncertainty } from "./uncertainty";

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
