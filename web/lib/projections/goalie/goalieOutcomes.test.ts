import { describe, expect, it, vi } from "vitest";

import {
  GOALIE_B2B_SAVE_PCT_ADJUSTMENT,
  GOALIE_HEAVY_WORKLOAD_SAVE_PCT_ADJUSTMENT,
  goalieConditionalWinProbability,
  goalieRestSavePctAdjustment,
  marketTeamWinProbability,
  posteriorSavePct,
  shutoutProbability,
  teamWinProbability,
} from "./goalieOutcomes";
import { blendSeasonLeagueSavePct, LEAGUE_SAVE_PCT_CARRYOVER_SHOTS } from "./leagueSavePct";

vi.mock("lib/supabase/server", () => ({ default: { from: () => { throw new Error("no database in unit tests"); } } }));

describe("goalie outcome math", () => {
  it.each([[3, 3], [3.4, 2.6], [2.1, 3.9], [0, 0], [0, 2.5], [4.5, 1.2]])(
    "pairs the two teams' win probabilities to exactly 1 (%s vs %s)", (a, b) => {
      expect(teamWinProbability(a, b) + teamWinProbability(b, a)).toBeCloseTo(1, 12);
    });

  it("is even for equal teams and increasing in a team's own expected goals", () => {
    expect(teamWinProbability(3, 3)).toBeCloseTo(0.5, 12);
    expect(teamWinProbability(3.3, 3)).toBeGreaterThan(teamWinProbability(3, 3));
    expect(teamWinProbability(3, 3.3)).toBeLessThan(0.5);
    expect(() => teamWinProbability(Number.NaN, 3)).toThrow();
  });

  it("de-vigs a two-way moneyline by proportional normalisation", () => {
    const outcome = (key: string, price: number) => ({ outcomeKey: key, averageLineValue: null, averagePriceAmerican: price,
      averageImpliedProbability: null, sportsbookCount: 1 });
    const h2h = { marketType: "h2h", sourceRank: 1, sourceNames: ["synthetic"], sportsbookKeys: ["synthetic"], observedAt: null,
      freshnessExpiresAt: null, outcomes: [outcome("team:AAA", -150), outcome("team:BBB", 130)] };
    const home = marketTeamWinProbability(h2h, "AAA", "BBB")!;
    const away = marketTeamWinProbability(h2h, "BBB", "AAA")!;
    expect(home).toBeCloseTo(0.6 / (0.6 + 100 / 230), 10);
    expect(home + away).toBeCloseTo(1, 12);
    expect(marketTeamWinProbability(h2h, "AAA", "CCC")).toBeNull();
  });

  it("moves the team win probability by the starter's goals-per-shot ratio", () => {
    const args = { teamWinProbability: 0.55, lambdaFor: 3, lambdaAgainst: 3 };
    expect(goalieConditionalWinProbability({ ...args, goalsAgainstRatio: 1 })).toBe(0.55);
    expect(goalieConditionalWinProbability({ ...args, goalsAgainstRatio: 0.9 })).toBeGreaterThan(0.55);
    expect(goalieConditionalWinProbability({ ...args, goalsAgainstRatio: 1.1 })).toBeLessThan(0.55);
  });

  it("shrinks save % with the beta prior and falls back to the prior mean without evidence", () => {
    expect(posteriorSavePct({ shots: 0, goals: 0, priorMean: 0.9 })).toBe(0.9);
    expect(posteriorSavePct({ shots: 1000, goals: 80, priorMean: 0.9, priorShots: 1000 })).toBeCloseTo(0.91, 12);
  });

  it("uses the fitted B2B and heavy-workload adjustments", () => {
    expect(goalieRestSavePctAdjustment({ isGoalieBackToBack: true, startsLast14Days: 6 })).toBe(GOALIE_B2B_SAVE_PCT_ADJUSTMENT);
    expect(goalieRestSavePctAdjustment({ isGoalieBackToBack: false, startsLast14Days: 5 })).toBe(GOALIE_HEAVY_WORKLOAD_SAVE_PCT_ADJUSTMENT);
    expect(goalieRestSavePctAdjustment({ isGoalieBackToBack: false, startsLast14Days: 4 })).toBe(0);
  });

  it("reduces the shots mixture to e^-GA for Poisson shots and adds zeros for overdispersed shots", () => {
    const poisson = shutoutProbability({ expectedShotsAgainst: 30, savePct: 0.905, nbSize: Infinity, fullGameProbability: 1 });
    expect(poisson).toBeCloseTo(Math.exp(-30 * 0.095), 10);
    expect(shutoutProbability({ expectedShotsAgainst: 30, savePct: 0.905, fullGameProbability: 1 })).toBeGreaterThan(poisson);
    expect(shutoutProbability({ expectedShotsAgainst: 30, savePct: 0.905, nbSize: Infinity, fullGameProbability: 0.9 }))
      .toBeCloseTo(0.9 * poisson, 10);
    expect(shutoutProbability({ expectedShotsAgainst: 0, savePct: 0.9, fullGameProbability: 0.93 })).toBe(0.93);
  });

  it("blends the season-to-date league save % with last season's mean", () => {
    const early = blendSeasonLeagueSavePct({ currentShots: 0, currentGoals: 0, previousShots: 70000, previousGoals: 7000 });
    expect(early.savePct).toBeCloseTo(0.9, 12);
    const mid = blendSeasonLeagueSavePct({ currentShots: LEAGUE_SAVE_PCT_CARRYOVER_SHOTS, currentGoals: 2200,
      previousShots: 70000, previousGoals: 7000 });
    expect(mid.savePct).toBeCloseTo((0.89 + 0.9) / 2, 12);
  });
});
