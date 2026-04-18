import { describe, expect, it } from "vitest";

import { buildUnderlyingStatsLandingDashboard } from "./teamLandingDashboard";

const buildTeam = (
  teamAbbr: string,
  overrides: Record<string, unknown> = {}
) => ({
  teamAbbr,
  offRating: 100,
  defRating: 100,
  paceRating: 100,
  trend10: 0,
  ppTier: 2 as const,
  pkTier: 2 as const,
  components: {
    xgf60: 3,
    gf60: 3,
    sf60: 28,
    xga60: 3,
    ga60: 3,
    sa60: 28,
    pace60: 57
  },
  finishingRating: 100,
  goalieRating: 100,
  dangerRating: 100,
  disciplineRating: 100,
  luckPdoZ: 0,
  luckStatus: "normal" as const,
  narrative: ["Balanced profile."],
  scheduleTexture: {
    backToBacksNext14: 0,
    gamesNext14: 5,
    gamesNext7: 2,
    homeGamesNext14: 3,
    restAdvantageGamesNext14: 0,
    restDisadvantageGamesNext14: 0,
    roadGamesNext14: 2,
    threeInFourNext14: 0
  },
  sosFuture: 0.53,
  ...overrides
});

describe("buildUnderlyingStatsLandingDashboard", () => {
  it("builds quadrant points and module slices from the current ratings rows", () => {
    const dashboard = buildUnderlyingStatsLandingDashboard([
      buildTeam("CAR", {
        offRating: 110,
        defRating: 109,
        trend10: 3.4,
        components: {
          xgf60: 3.8,
          gf60: 3.6,
          sf60: 32,
          xga60: 2.4,
          ga60: 2.5,
          sa60: 24,
          pace60: 58
        },
        narrative: [
          "5v5 offense is rising as expected goals and shot volume improve."
        ]
      }),
      buildTeam("PIT", {
        offRating: 106,
        defRating: 103,
        trend10: -2.1,
        components: {
          xgf60: 3.5,
          gf60: 2.8,
          sf60: 30,
          xga60: 2.9,
          ga60: 3.1,
          sa60: 27,
          pace60: 57
        },
        finishingRating: 95,
        luckPdoZ: -1.2,
        luckStatus: "cold"
      }),
      buildTeam("EDM", {
        offRating: 108,
        defRating: 99,
        trend10: 1.1,
        components: {
          xgf60: 3.4,
          gf60: 3.9,
          sf60: 31,
          xga60: 3.1,
          ga60: 2.8,
          sa60: 29,
          pace60: 60
        },
        finishingRating: 107,
        goalieRating: 106,
        luckPdoZ: 1.3,
        luckStatus: "hot"
      }),
      buildTeam("LAK", {
        offRating: 101,
        defRating: 106,
        trend10: 0.4,
        components: {
          xgf60: 2.8,
          gf60: 2.7,
          sf60: 27,
          xga60: 2.5,
          ga60: 2.3,
          sa60: 25,
          pace60: 55
        },
        scheduleTexture: {
          backToBacksNext14: 1,
          gamesNext14: 6,
          gamesNext7: 4,
          homeGamesNext14: 1,
          restAdvantageGamesNext14: 0,
          restDisadvantageGamesNext14: 2,
          roadGamesNext14: 5,
          threeInFourNext14: 1
        },
        sosFuture: 0.59
      })
    ]);

    expect(dashboard.quadrant.points).toHaveLength(4);
    expect(dashboard.risers.some((item) => item.teamAbbr === "CAR")).toBe(true);
    expect(dashboard.fallers.some((item) => item.teamAbbr === "PIT")).toBe(true);
    expect(
      dashboard.sustainability.buyLow.some((item) => item.teamAbbr === "PIT")
    ).toBe(true);
    expect(
      dashboard.sustainability.heatCheck.some((item) => item.teamAbbr === "EDM")
    ).toBe(true);
    expect(dashboard.context[0]?.teamAbbr).toBe("LAK");
    expect(
      dashboard.inefficiency.undervalued.some((item) => item.teamAbbr === "PIT")
    ).toBe(true);
    expect(
      dashboard.inefficiency.overvalued.some((item) => item.teamAbbr === "EDM")
    ).toBe(true);
  });
});
