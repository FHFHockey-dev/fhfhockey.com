import { describe, expect, it } from "vitest";

import {
  DEFAULT_ACTIVE_CONTEXT,
  DEFAULT_CATEGORY_WEIGHTS,
  DEFAULT_ROSTER_CONFIG,
  createDefaultUserLeagueSettings
} from "./defaults";

describe("createDefaultUserLeagueSettings", () => {
  it("returns the expected baseline league settings shape", () => {
    expect(createDefaultUserLeagueSettings()).toMatchObject({
      leagueType: "points",
      scoringCategories: {
        GOALS: 3,
        ASSISTS: 2
      },
      categoryWeights: DEFAULT_CATEGORY_WEIGHTS,
      rosterConfig: DEFAULT_ROSTER_CONFIG,
      activeContext: DEFAULT_ACTIVE_CONTEXT
    });
  });

  it("returns a fresh copy for mutable maps", () => {
    const first = createDefaultUserLeagueSettings();
    const second = createDefaultUserLeagueSettings();

    first.scoringCategories.GOALS = 99;
    first.rosterConfig.C = 7;

    expect(second.scoringCategories.GOALS).toBe(3);
    expect(second.rosterConfig.C).toBe(2);
  });
});
