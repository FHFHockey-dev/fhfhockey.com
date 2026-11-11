import { describe, expect, it } from "vitest";

import {
  describeLockedBaselines,
  LOCKED_PLAYER_BASELINES,
  buildSkaterRecentSummaryCards,
  classifyTeamTemperature,
  formatGoalieTrendValue,
  formatPercentileOrdinal,
  formatRecentFormValue,
  formatRollingMetricValue,
  formatSkaterTrendWindowLabel,
  isLockedPlayerBaselineMode,
  summarizeTrendStreak,
  isPlayerQuickViewId
} from "./trendsSurface";
import {
  combineSkillMinusLuckComposite,
  computeLuck,
  computeLuckDeltas,
  summarizePairedCorrelation
} from "./utils";

describe("trendsSurface helpers", () => {
  it("formats skater window labels consistently", () => {
    expect(formatSkaterTrendWindowLabel(20)).toBe("20 GP");
  });

  it("formats recent-form values in each stat's own unit", () => {
    expect(formatRecentFormValue("timeOnIce", 1440.67)).toEqual({ value: "24:01", unit: "TOI/GP" });
    expect(formatRecentFormValue("powerPlayTime", 59.6)).toEqual({ value: "1:00", unit: "PP TOI/GP" });
    expect(formatRecentFormValue("shotsPer60", 9.259)).toEqual({ value: "9.3", unit: "shots/60" });
    expect(formatRecentFormValue("ixgPer60", 1.6667)).toEqual({ value: "1.67", unit: "ixG/60" });
    expect(formatRecentFormValue("ixgPer60", null)).toBeNull();
    expect(formatGoalieTrendValue("savePct", 0.97059)).toEqual({ value: ".971", unit: "SV%" });
    expect(formatGoalieTrendValue("qualityStartsPct", 0.6667)).toEqual({ value: "67%", unit: "QS" });
    expect(formatGoalieTrendValue("goalsAgainstAvg", 1.7156)).toEqual({ value: "1.72", unit: "GAA" });
    expect(formatGoalieTrendValue("saveVolume", 27.333)).toEqual({ value: "27.3", unit: "saves/GP" });
    expect(["100", "99.4", "1", "2.2", "3", "11", "12.4", "13", "21", "22"].map((p) =>
      formatPercentileOrdinal(Number(p))
    )).toEqual(["100th", "99th", "1st", "2nd", "3rd", "11th", "12th", "13th", "21st", "22nd"]);
  });

  it("locks the player baseline contract for strong v1", () => {
    expect(LOCKED_PLAYER_BASELINES.map((baseline) => baseline.key)).toEqual([
      "season",
      "3ya",
      "career",
      "all"
    ]);
    expect(describeLockedBaselines()).toBe(
      "Compared with Season, 3-Year, Career, and Cumulative baselines"
    );
    expect(isLockedPlayerBaselineMode("career")).toBe(true);
    expect(isLockedPlayerBaselineMode("lastYear")).toBe(false);
    expect(isPlayerQuickViewId("l30")).toBe(true);
    expect(isPlayerQuickViewId("weekly")).toBe(false);
  });

  it("ranks tied scan leaders by the stat, highest first", () => {
    const [, shots] = buildSkaterRecentSummaryCards({
      windowSize: 3,
      playerMetadata: {},
      categories: {
        shotsPer60: {
          rankings: [
            { playerId: 1, percentile: 100, delta: 0, latestValue: 9.3 },
            { playerId: 2, percentile: 100, delta: 0, latestValue: 12.4 },
            { playerId: 3, percentile: 100, delta: 0, latestValue: 14.8 },
            { playerId: 4, percentile: 99.4, delta: 0, latestValue: 20 },
            { playerId: 5, percentile: 100, delta: 0, latestValue: 14.7 }
          ]
        }
      }
    });
    expect(shots.leaders.map((leader) => leader.latestValue)).toEqual([14.8, 14.7, 12.4]);
  });

  it("builds recent-form summary cards from skater trend rankings", () => {
    const cards = buildSkaterRecentSummaryCards({
      windowSize: 10,
      categories: {
        timeOnIce: {
          rankings: [
            {
              playerId: 88,
              percentile: 92.4,
              delta: 3,
              latestValue: 20.7
            }
          ]
        },
        shotsPer60: {
          rankings: [
            {
              playerId: 91,
              percentile: 90.1,
              delta: 2,
              latestValue: 11.2
            }
          ]
        },
        powerPlayTime: {
          rankings: [
            {
              playerId: 92,
              percentile: 88.5,
              delta: 5,
              latestValue: 3.2
            }
          ]
        },
        ixgPer60: {
          rankings: [
            {
              playerId: 93,
              percentile: 86.4,
              delta: -1,
              latestValue: 1.45
            }
          ]
        }
      },
      playerMetadata: {
        "88": {
          id: 88,
          fullName: "Top Deployment",
          position: "C",
          teamAbbrev: "NJD",
          imageUrl: null
        },
        "91": {
          id: 91,
          fullName: "Shot Driver",
          position: "RW",
          teamAbbrev: "CAR",
          imageUrl: null
        },
        "92": {
          id: 92,
          fullName: "PP Anchor",
          position: "D",
          teamAbbrev: "EDM",
          imageUrl: null
        },
        "93": {
          id: 93,
          fullName: "Chance Creator",
          position: "LW",
          teamAbbrev: "VAN",
          imageUrl: null
        }
      }
    });

    expect(cards).toHaveLength(4);
    expect(cards[0]).toMatchObject({
      categoryId: "timeOnIce",
      label: "TOI Deployment",
      windowLabel: "10 GP"
    });
    expect(cards[0]?.leaders[0]).toMatchObject({
      fullName: "Top Deployment",
      teamAbbrev: "NJD"
    });
    expect(cards[2]).toMatchObject({
      categoryId: "powerPlayTime",
      label: "PP Usage"
    });
  });

  it("summarizes only complete metric/fantasy pairs and reports sample size", () => {
    expect(
      summarizePairedCorrelation([
        { x: 1, y: 2 },
        { x: null, y: 3 },
        { x: 2, y: 4 },
        { x: 3, y: 6 }
      ])
    ).toEqual({
      sampleSize: 3,
      xMean: 2,
      yMean: 4,
      r: 1,
      r2: 1
    });
  });

  it("does not publish a correlation below three paired games", () => {
    expect(
      summarizePairedCorrelation([
        { x: 1, y: 2 },
        { x: 2, y: 4 }
      ])
    ).toMatchObject({
      sampleSize: 2,
      xMean: 1.5,
      yMean: 3,
      r: null,
      r2: null
    });
  });
});

describe("player trend page scale formatting and streaks (P0 #11)", () => {
  it("formats each metric by its declared scale", () => {
    // Fraction scale (0–1): multiply by 100.
    expect(formatRollingMetricValue("primary_points_pct", 0.167)).toBe("16.7%");
    expect(formatRollingMetricValue("pp_share_pct", 0.42)).toBe("42.0%");
    // Percent scale (0–100): shown as stored.
    expect(formatRollingMetricValue("shooting_pct", 21.7)).toBe("21.7%");
    expect(formatRollingMetricValue("expected_sh_pct", 12)).toBe("12.0%");
    // PDO is an index, not a percentage.
    expect(formatRollingMetricValue("pdo", 1.093)).toBe("1.093");
    expect(formatRollingMetricValue("toi_seconds", 1474)).toBe("24:34");
    expect(formatRollingMetricValue("goals_per_60", 1.234)).toBe("1.23");
    expect(formatRollingMetricValue("ipp", null)).toBe("—");
  });

  it("counts a streak only while games stay beyond the label threshold", () => {
    // Latest +12 and +9 are hot; +3 is not, so the streak is 2 games, not 4.
    expect(summarizeTrendStreak([10, 3, 9, 12])).toEqual({
      direction: "hot",
      games: 2
    });
    expect(summarizeTrendStreak([-9, -2, -10])).toEqual({
      direction: "cold",
      games: 1
    });
    expect(summarizeTrendStreak([20, 5])).toEqual({ direction: "steady", games: 0 });
    expect(summarizeTrendStreak([])).toEqual({ direction: "steady", games: 0 });
  });
});

describe("luck deltas and the skill-minus-luck composite (decision 80, W3-7 D6)", () => {
  it("orients each luck component as observed minus expectation", () => {
    // Checked one component at a time: positive = above expectation.
    expect(computeLuckDeltas({ goals: 5, xg: 3 }).goals_minus_ixG).toBe(2);
    expect(computeLuckDeltas({ goals: 1, xg: 3 }).goals_minus_ixG).toBe(-2);
    expect(computeLuckDeltas({ onIceSH: 0.11 }).onIceSH_delta).toBeCloseTo(0.03, 9);
    expect(computeLuckDeltas({ pdo: 0.97 }).PDO_delta).toBeCloseTo(-0.03, 9);
    expect(computeLuckDeltas({ ipp: 70, ippBaseline: 60 }).IPP_delta).toBe(10);
    expect(computeLuck).toBe(computeLuckDeltas);
  });

  it("leaves a delta absent when its input is missing", () => {
    expect(computeLuckDeltas({ goals: 2 })).toEqual({});
    expect(computeLuckDeltas({ ipp: 50 })).toEqual({});
  });

  it("subtracts the luck deduction in the composite", () => {
    const base = { skillOffense01: 0.6, skillDefense01: 0.4, onIceImpact01: 0.5 };
    const lucky = combineSkillMinusLuckComposite({ ...base, luckInflation01: 0.8 });
    const unlucky = combineSkillMinusLuckComposite({ ...base, luckInflation01: 0.1 });
    expect(lucky.sustainability).toBeLessThan(unlucky.sustainability);
  });
});

describe("team temperature lists (W3-3 D8)", () => {
  it("puts a low team that moved up in one list only", () => {
    const rows = [
      { team: "AAA", percentile: 30, delta: 2 },
      { team: "BBB", percentile: 80, delta: 0 },
      { team: "CCC", percentile: 50, delta: 3 },
      { team: "DDD", percentile: 50, delta: -4 }
    ];
    const { hot, cold } = classifyTeamTemperature(rows);
    const hotTeams = hot.map((row) => row.team);
    const coldTeams = cold.map((row) => row.team);
    expect(hotTeams).toEqual(["BBB", "CCC"]);
    expect(coldTeams).toEqual(["AAA", "DDD"]);
    expect(hotTeams.filter((team) => coldTeams.includes(team))).toEqual([]);
  });

  it("does not depend on input order", () => {
    const rows = [
      { team: "AAA", percentile: 75, delta: 1 },
      { team: "BBB", percentile: 90, delta: 0 },
      { team: "CCC", percentile: 75, delta: 3 },
      { team: "DDD", percentile: 72, delta: 0 }
    ];
    const forward = classifyTeamTemperature(rows).hot.map((row) => row.team);
    const reversed = classifyTeamTemperature([...rows].reverse()).hot.map(
      (row) => row.team
    );
    expect(forward).toEqual(["BBB", "CCC", "AAA"]);
    expect(reversed).toEqual(forward);
  });
});
