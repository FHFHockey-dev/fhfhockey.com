import { describe, expect, it } from "vitest";

import {
  calculateAdjustedCoreNetshare,
  formatGoalieDeploymentBucket,
  getGoalieDeploymentBucket,
  calculateGoalieGsax,
  calculateLeagueSavePct,
  classifyVollmanQualityStart,
  classifyVollmanReallyBadStart,
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

  it("assigns product-facing goalie deployment buckets", () => {
    expect(getGoalieDeploymentBucket(0.72)).toBe("g1_workhorse");
    expect(formatGoalieDeploymentBucket("g1_workhorse")).toBe("G1 Workhorse");
    expect(getGoalieDeploymentBucket(0.58)).toBe("g1_starter");
    expect(getGoalieDeploymentBucket(0.5)).toBe("g1a_tandem_lead");
    expect(getGoalieDeploymentBucket(0.34)).toBe("g1b_tandem_secondary");
    expect(getGoalieDeploymentBucket(0.2)).toBe("g2_backup");
    expect(getGoalieDeploymentBucket(0.05)).toBe("g2_reserve");
    expect(getGoalieDeploymentBucket(null)).toBeNull();
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

  describe("Vollman Quality Start (decision 40)", () => {
    const start = (saves: number, shotsAgainst: number, goalsAgainst = shotsAgainst - saves) => ({
      started: true, saves, shotsAgainst, goalsAgainst,
    });
    const league = 0.905;

    it("credits a start strictly above the league average and not one equal to it", () => {
      // 20/22 = .9091 > .905 with 2 GA; 181/200 = .905 exactly, 19 GA.
      expect(classifyVollmanQualityStart(start(20, 22), league)).toBe(true);
      expect(classifyVollmanQualityStart(start(181, 200), league)).toBe(false);
      expect(classifyVollmanQualityStart(start(182, 200), league)).toBe(true);
    });

    it("applies the .885 floor only when allowing two or fewer goals", () => {
      // .885 exactly with 2 GA qualifies; .8846 with 2 GA does not.
      expect(classifyVollmanQualityStart(start(177, 200, 2), league)).toBe(true);
      expect(classifyVollmanQualityStart(start(23, 26, 2), league)).toBe(false);
      // .8889 (24/27) with 3 GA is below league average and above two goals.
      expect(classifyVollmanQualityStart(start(24, 27), league)).toBe(false);
      // The .910 fixed threshold used by Splits would reject this start.
      expect(classifyVollmanQualityStart(start(25, 28), 0.89)).toBe(true);
    });

    it("never classifies relief, missing shots or a missing league average", () => {
      expect(classifyVollmanQualityStart({ ...start(10, 10), started: false }, league)).toBeNull();
      expect(classifyVollmanQualityStart({ ...start(10, 10), started: null }, league)).toBeNull();
      expect(classifyVollmanQualityStart(start(0, 0, 0), league)).toBeNull();
      expect(classifyVollmanQualityStart({ ...start(20, 22), shotsAgainst: null }, league)).toBeNull();
      expect(classifyVollmanQualityStart(start(20, 22), null)).toBeNull();
    });

    it("marks a Vollman really bad start below .850 only", () => {
      expect(classifyVollmanReallyBadStart(start(84, 100))).toBe(true);
      expect(classifyVollmanReallyBadStart(start(85, 100))).toBe(false);
      expect(classifyVollmanReallyBadStart({ ...start(1, 4), started: false })).toBeNull();
      expect(classifyVollmanReallyBadStart(start(0, 0, 0))).toBeNull();
    });

    it("pools league save percentage by shots and reports coverage", () => {
      const result = calculateLeagueSavePct([
        { saves: 9, shotsAgainst: 10 },
        { saves: 95, shotsAgainst: 100 },
        { saves: null, shotsAgainst: 30 },
      ]);
      // Pooled 104/110, not the mean of .90 and .95.
      expect(result.savePct).toBeCloseTo(104 / 110, 12);
      expect(result).toMatchObject({ coveredRows: 2, totalRows: 3 });
    });
  });
});
