import { describe, expect, it } from "vitest";

import {
  DEFERRED_PLAYER_BASELINE_NOTE,
  LOCKED_PLAYER_BASELINES,
  buildSkaterRecentSummaryCards,
  formatSkaterTrendWindowLabel,
  isLockedPlayerBaselineMode,
  isPlayerQuickViewId
} from "./trendsSurface";

describe("trendsSurface helpers", () => {
  it("formats skater window labels consistently", () => {
    expect(formatSkaterTrendWindowLabel(20)).toBe("20 GP");
  });

  it("locks the player baseline contract for strong v1", () => {
    expect(LOCKED_PLAYER_BASELINES.map((baseline) => baseline.key)).toEqual([
      "season",
      "3ya",
      "career",
      "all"
    ]);
    expect(DEFERRED_PLAYER_BASELINE_NOTE).toContain("Last Year");
    expect(isLockedPlayerBaselineMode("career")).toBe(true);
    expect(isLockedPlayerBaselineMode("lastYear")).toBe(false);
    expect(isPlayerQuickViewId("l30")).toBe(true);
    expect(isPlayerQuickViewId("weekly")).toBe(false);
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
});
