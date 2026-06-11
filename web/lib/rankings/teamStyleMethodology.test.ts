import { describe, expect, it } from "vitest";

import {
  TEAM_STYLE_SOURCE_CONTRACT,
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
});
