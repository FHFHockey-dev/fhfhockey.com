import { describe, expect, it } from "vitest";

import {
  calculateAdjustedCoreNetshare,
  calculateGoalieGsax,
  getGoalieStartsShareBucket,
  isGoalieQualityStart,
  isGoalieReallyBadStart,
  isGoalieStealGame,
} from "./goalieMethodology";

describe("goalieMethodology", () => {
  it("calculates GSAx from existing xG goalie aggregate semantics", () => {
    expect(
      calculateGoalieGsax({
        xgAgainst: 3.2,
        goalsAgainst: 2,
      }),
    ).toBe(1.2);
    expect(
      calculateGoalieGsax({
        goalsSavedAboveExpected: 0.75,
        xgAgainst: 3.2,
        goalsAgainst: 2,
      }),
    ).toBe(0.75);
  });

  it("supports modern xG and classic compatibility quality-start modes", () => {
    const game = {
      goalieId: 1,
      started: true,
      shotsAgainst: 28,
      saves: 24,
      goalsAgainst: 4,
      xgAgainst: 4.1,
    };

    expect(isGoalieQualityStart(game, { mode: "modern_gsax" })).toBe(true);
    expect(isGoalieQualityStart(game, { mode: "classic_save_pct" })).toBe(false);
    expect(
      isGoalieQualityStart(
        {
          ...game,
          shotsAgainst: 18,
          saves: 16,
          goalsAgainst: 2,
          xgAgainst: 1.8,
        },
        { mode: "classic_save_pct" },
      ),
    ).toBe(true);
  });

  it("classifies really bad starts by mode", () => {
    const game = {
      goalieId: 1,
      started: true,
      shotsAgainst: 30,
      saves: 25,
      goalsAgainst: 5,
      xgAgainst: 2.4,
    };

    expect(isGoalieReallyBadStart(game, { mode: "modern_gsax" })).toBe(true);
    expect(isGoalieReallyBadStart(game, { mode: "classic_save_pct" })).toBe(true);
  });

  it("classifies steal games with a win plus strong shot-stopping", () => {
    const game = {
      goalieId: 1,
      started: true,
      won: true,
      shotsAgainst: 36,
      saves: 34,
      goalsAgainst: 2,
      xgAgainst: 3.4,
    };

    expect(isGoalieStealGame(game, { mode: "modern_gsax" })).toBe(true);
    expect(isGoalieStealGame(game, { mode: "classic_save_pct" })).toBe(true);
    expect(isGoalieStealGame({ ...game, won: false })).toBe(false);
  });

  it("assigns starts-share deployment buckets", () => {
    expect(getGoalieStartsShareBucket(0.72)).toBe("workhorse");
    expect(getGoalieStartsShareBucket(0.5)).toBe("lead_tandem");
    expect(getGoalieStartsShareBucket(0.34)).toBe("secondary_tandem");
    expect(getGoalieStartsShareBucket(0.2)).toBe("backup");
    expect(getGoalieStartsShareBucket(0.05)).toBe("spot_start");
    expect(getGoalieStartsShareBucket(null)).toBeNull();
  });

  it("excludes emergency-callup starts during confident top-two absence windows", () => {
    const result = calculateAdjustedCoreNetshare({
      coreGoalieIds: [10, 20],
      starts: [
        {
          goalieId: 10,
          date: "2026-01-01",
          started: true,
        },
        {
          goalieId: 30,
          date: "2026-01-02",
          started: true,
          isEmergencyCallup: true,
          topTwoUnavailableGoalieIds: [10, 20],
          absenceConfidence: "high",
        },
        {
          goalieId: 30,
          date: "2026-01-03",
          started: true,
          isEmergencyCallup: true,
          topTwoUnavailableGoalieIds: [10],
          absenceConfidence: "high",
        },
        {
          goalieId: 20,
          date: "2026-01-04",
          started: true,
        },
      ],
    });

    expect(result.excludedEmergencyStarts).toBe(1);
    expect(result.coreStarts).toBe(2);
    expect(result.totalStarts).toBe(3);
    expect(result.adjustedCoreNetshare).toBeCloseTo(0.666667, 6);
  });

  it("keeps low-confidence emergency starts in the denominator", () => {
    const result = calculateAdjustedCoreNetshare({
      coreGoalieIds: [10, 20],
      starts: [
        {
          goalieId: 30,
          date: "2026-01-02",
          started: true,
          isEmergencyCallup: true,
          topTwoUnavailableGoalieIds: [10, 20],
          absenceConfidence: "low",
        },
      ],
    });

    expect(result.excludedEmergencyStarts).toBe(0);
    expect(result.totalStarts).toBe(1);
    expect(result.adjustedCoreNetshare).toBe(0);
  });
});
