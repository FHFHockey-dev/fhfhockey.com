import { describe, expect, it } from "vitest";

import {
  mapLeagueSettingsToUserSettingsUpsert,
  mapUserSettingsRowToLeagueSettings
} from "./mappers";

describe("mapUserSettingsRowToLeagueSettings", () => {
  it("falls back to defaults when the row is missing", () => {
    const settings = mapUserSettingsRowToLeagueSettings(null);

    expect(settings.leagueType).toBe("points");
    expect(settings.scoringCategories.GOALS).toBe(3);
    expect(settings.rosterConfig.C).toBe(2);
    expect(settings.activeContext.source_type).toBe("manual");
  });

  it("merges persisted values over defaults", () => {
    const settings = mapUserSettingsRowToLeagueSettings({
      league_type: "categories",
      scoring_categories: {
        GOALS: 5,
        ASSISTS: 4
      },
      category_weights: {
        GOALS: 2,
        HITS: 3
      },
      roster_config: {
        C: 3,
        utility: 2
      },
      ui_preferences: {
        account_settings_section: "league-settings"
      },
      active_context: {
        source_type: "yahoo",
        provider: "yahoo",
        external_league_id: "league-1",
        external_team_id: "team-2"
      }
    });

    expect(settings.leagueType).toBe("categories");
    expect(settings.scoringCategories.GOALS).toBe(5);
    expect(settings.scoringCategories.SHOTS_ON_GOAL).toBe(0.2);
    expect(settings.categoryWeights.HITS).toBe(3);
    expect(settings.rosterConfig.C).toBe(3);
    expect(settings.rosterConfig.LW).toBe(2);
    expect(settings.activeContext.provider).toBe("yahoo");
    expect(settings.activeContext.external_team_id).toBe("team-2");
  });
});

describe("mapLeagueSettingsToUserSettingsUpsert", () => {
  it("serializes the account form state back to the database shape", () => {
    const upsert = mapLeagueSettingsToUserSettingsUpsert("user-1", {
      leagueType: "categories",
      scoringCategories: {
        GOALS: 5
      },
      categoryWeights: {
        GOALS: 2
      },
      rosterConfig: {
        C: 3,
        bench: 4,
        utility: 1
      },
      uiPreferences: {
        account_settings_section: "league-settings",
        league_settings_panel_open: true
      },
      activeContext: {
        source_type: "manual",
        provider: null,
        external_league_id: null,
        external_team_id: null
      }
    });

    expect(upsert).toEqual({
      user_id: "user-1",
      league_type: "categories",
      scoring_categories: {
        GOALS: 5
      },
      category_weights: {
        GOALS: 2
      },
      roster_config: {
        C: 3,
        bench: 4,
        utility: 1
      },
      ui_preferences: {
        account_settings_section: "league-settings",
        league_settings_panel_open: true
      },
      active_context: {
        source_type: "manual",
        provider: null,
        external_league_id: null,
        external_team_id: null
      }
    });
  });
});
