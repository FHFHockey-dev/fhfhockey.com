import { describe, expect, it } from "vitest";

import {
  describeLockedBaselines,
  LOCKED_PLAYER_BASELINES,
  buildSkaterRecentSummaryCards,
  formatGoalieTrendValue,
  formatPercentileOrdinal,
  formatRecentFormValue,
  formatSkaterTrendWindowLabel,
  isLockedPlayerBaselineMode,
  isPlayerQuickViewId
} from "./trendsSurface";
import { summarizePairedCorrelation } from "./utils";

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
