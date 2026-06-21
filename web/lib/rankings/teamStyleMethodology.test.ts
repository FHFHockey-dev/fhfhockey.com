import { describe, expect, it } from "vitest";

import {
  TEAM_STYLE_SOURCE_CONTRACT,
  TEAM_SOURCE_PENDING_METRIC_CONTRACTS,
  calculateTeamGameContextComponents,
  calculateRunAndGunProfile,
  calculateTeamExpectedGoalsForPercentage,
  calculateTeamLuckComponents,
  calculateTeamShotQuality,
} from "./teamStyleMethodology";

describe("teamStyleMethodology", () => {
  it("labels current team style as raw/contextual until adjusted aggregates exist", () => {
    expect(TEAM_STYLE_SOURCE_CONTRACT.currentLabel).toBe("raw_contextual_5v5");
    expect(TEAM_STYLE_SOURCE_CONTRACT.adjustedTargetLabel).toContain(
      "Score- and venue-adjusted",
    );
    expect(TEAM_STYLE_SOURCE_CONTRACT.requiredAdjustedInputs).toContain(
      "score-state-adjusted 5v5 xGF and xGA",
    );
    expect(TEAM_STYLE_SOURCE_CONTRACT.caveats.join(" ")).toMatch(
      /Do not label current team-style helpers as adjusted/,
    );
  });

  it("uses Fenwick/unblocked team attempts for team shot quality", () => {
    expect(
      calculateTeamShotQuality({
        xgFor: 8,
        fenwickFor: 40,
      }),
    ).toBe(0.2);
    expect(
      calculateTeamShotQuality({
        xgFor: 8,
        fenwickFor: 0,
      }),
    ).toBeNull();
  });

  it("calculates team xGF% as control, separate from event rate", () => {
    expect(
      calculateTeamExpectedGoalsForPercentage({
        xgFor: 12,
        xgAgainst: 8,
      }),
    ).toBe(60);

    const profile = calculateRunAndGunProfile({
      xgFor: 12,
      xgAgainst: 8,
      gamesCount: 4,
      leagueAverageEventRate: 4,
    });

    expect(profile.eventRate).toBe(5);
    expect(profile.xgForPercentage).toBe(60);
    expect(profile.paceAxis).toBe("high_event");
    expect(profile.controlAxis).toBe("controls_play");
  });

  it("keeps run-and-gun event pace independent from weak control", () => {
    const profile = calculateRunAndGunProfile({
      xgFor: 7,
      xgAgainst: 13,
      gamesCount: 4,
      leagueAverageEventRate: 4,
    });

    expect(profile.eventRate).toBe(5);
    expect(profile.xgForPercentage).toBe(35);
    expect(profile.paceAxis).toBe("high_event");
    expect(profile.controlAxis).toBe("chasing_play");
  });

  it("calculates team luck without rewarding GA/xGA in the wrong direction", () => {
    const lucky = calculateTeamLuckComponents({
      goalsFor: 11,
      xgFor: 9,
      goalsAgainst: 7,
      xgAgainst: 10,
    });

    expect(lucky.finishingLuck).toBe(2);
    expect(lucky.saveLuck).toBe(3);
    expect(lucky.netGoalsAboveExpected).toBe(5);

    const unluckyDefense = calculateTeamLuckComponents({
      goalsFor: 9,
      xgFor: 9,
      goalsAgainst: 13,
      xgAgainst: 10,
    });

    expect(unluckyDefense.saveLuck).toBe(-3);
    expect(unluckyDefense.netGoalsAboveExpected).toBe(-3);
  });

  it("calculates source-backed team game-context components and publishes pending usage contracts", () => {
    const context = calculateTeamGameContextComponents({
      games: [
        {
          goalsFor: 3,
          goalsAgainst: 2,
          pointPct: 1,
          homeRoad: "home",
          powerPlayOpportunitiesPerGame: 4,
          penaltiesTakenPer60: 3.5,
        },
        {
          goalsFor: 1,
          goalsAgainst: 4,
          pointPct: 0,
          homeRoad: "road",
          powerPlayOpportunitiesPerGame: 2,
          penaltiesTakenPer60: 5.5,
        },
        {
          goalsFor: 2,
          goalsAgainst: 3,
          pointPct: 0.5,
          homeRoad: "home",
          powerPlayOpportunitiesPerGame: 3,
          penaltiesTakenPer60: 4,
        },
      ],
    });

    expect(context.oneGoalGameRate).toBe(66.666667);
    expect(context.homeRoadPointPctGap).toBe(75);
    expect(context.powerPlayOpportunityRate).toBe(3);
    expect(context.penaltiesTakenPer60).toBe(4.333333);
    expect(TEAM_SOURCE_PENDING_METRIC_CONTRACTS.map((contract) => contract.metricKey)).toEqual([
      "home_road_point_pct_gap",
      "forward_top_load_index",
      "defense_pair_top_load_index",
      "pp1_pp2_usage_share",
    ]);
  });
});
