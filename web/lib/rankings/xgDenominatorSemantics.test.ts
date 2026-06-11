import { describe, expect, it } from "vitest";

import {
  XG_SHOT_UNIVERSE,
  calculateExpectedShootingPercentage,
  calculateGoalieXgaPerUnblockedAttempt,
  calculateShootingAboveExpectedPercentage,
  calculateTeamShotQuality,
  getGoalieXgAggregateFenwickAgainst,
  getTeamXgAggregateFenwickFor,
  getXgAggregateUnblockedAttempts,
} from "./xgDenominatorSemantics";

describe("xgDenominatorSemantics", () => {
  it("documents the approved shot-goal xG universe as Fenwick/unblocked", () => {
    expect(XG_SHOT_UNIVERSE).toBe("fenwick_unblocked");
  });

  it("uses player unblocked attempts for xS% and SAX%", () => {
    const row = { ixg: 2.4, goals: 4, shot_attempts: 12 };
    const unblockedAttempts = getXgAggregateUnblockedAttempts(row);

    expect(unblockedAttempts).toBe(12);
    expect(
      calculateExpectedShootingPercentage({
        ixg: row.ixg,
        unblockedAttempts,
      }),
    ).toBe(20);
    expect(
      calculateShootingAboveExpectedPercentage({
        goals: row.goals,
        ixg: row.ixg,
        unblockedAttempts,
      }),
    ).toBe(13.333333);
  });

  it("uses team Fenwick for team shot quality instead of Corsi/all attempts", () => {
    const row = {
      xg_for: 8,
      shot_attempts_for: 40,
      cf_for: 55,
    };

    expect(getTeamXgAggregateFenwickFor(row)).toBe(40);
    expect(
      calculateTeamShotQuality({
        xgFor: row.xg_for,
        fenwickFor: getTeamXgAggregateFenwickFor(row),
      }),
    ).toBe(0.2);
  });

  it("uses goalie Fenwick against for xGA rate instead of shots on goal", () => {
    const row = {
      xg_against: 6,
      shots_against: 30,
      shots_on_goal_against: 21,
    };

    expect(getGoalieXgAggregateFenwickAgainst(row)).toBe(30);
    expect(
      calculateGoalieXgaPerUnblockedAttempt({
        xgAgainst: row.xg_against,
        fenwickAgainst: getGoalieXgAggregateFenwickAgainst(row),
      }),
    ).toBe(0.2);
  });

  it("refuses zero or missing denominators", () => {
    expect(
      calculateExpectedShootingPercentage({
        ixg: 1,
        unblockedAttempts: 0,
      }),
    ).toBeNull();
    expect(
      calculateTeamShotQuality({
        xgFor: 1,
        fenwickFor: null,
      }),
    ).toBeNull();
    expect(
      calculateGoalieXgaPerUnblockedAttempt({
        xgAgainst: 1,
        fenwickAgainst: 0,
      }),
    ).toBeNull();
  });
});
