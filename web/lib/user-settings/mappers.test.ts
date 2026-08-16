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
    expect(settings.goalieScoringCategories.WINS_GOALIE).toBe(4);
    expect(settings.rosterConfig.C).toBe(2);
    expect(settings.teamCount).toBe(12);
    expect(settings.draftOrderType).toBe("snake");
    expect(settings.activeContext.source_type).toBe("manual");
  });

  it("merges persisted values over defaults", () => {
    const settings = mapUserSettingsRowToLeagueSettings({
      league_type: "categories",
      scoring_categories: {
        GOALS: 5,
        ASSISTS: 4
      },
      goalie_scoring_categories: {
        WINS_GOALIE: 6,
        GAMES_PLAYED: 0.5
      },
      category_weights: {
        GOALS: 2,
        HITS: 3
      },
      roster_config: {
        C: 3,
        utility: 2
      },
      team_count: 16,
      draft_order_type: "straight",
      ui_preferences: {
        account_settings_section: "league-settings"
      },
      active_context: {
        source_type: "yahoo",
        provider: "yahoo",
        connected_account_id: "account-1",
        external_league_id: "league-1",
        external_team_id: "team-2",
        applied_settings_hash: null,
        applied_at: "2026-08-14T12:00:00.000Z"
      }
    });

    expect(settings.leagueType).toBe("categories");
    expect(settings.scoringCategories.GOALS).toBe(5);
    expect(settings.scoringCategories.SHOTS_ON_GOAL).toBe(0.2);
    expect(settings.goalieScoringCategories.WINS_GOALIE).toBe(6);
    expect(settings.goalieScoringCategories.GAMES_PLAYED).toBe(0.5);
    expect(settings.categoryWeights.HITS).toBe(3);
    expect(settings.rosterConfig.C).toBe(3);
    expect(settings.rosterConfig.LW).toBe(2);
    expect(settings.teamCount).toBe(16);
    expect(settings.draftOrderType).toBe("straight");
    expect(settings.activeContext.provider).toBe("yahoo");
    expect(settings.activeContext.connected_account_id).toBe("account-1");
    expect(settings.activeContext.external_team_id).toBe("team-2");
    expect(settings.activeContext.applied_settings_hash).toBeNull();
  });

  it("preserves an explicitly applied Fantrax point map without restoring omitted defaults", () => {
    const settings = mapUserSettingsRowToLeagueSettings({
      league_type: "points",
      scoring_categories: { GOALS: 5 },
      goalie_scoring_categories: { WINS_GOALIE: 6 },
      category_weights: {},
      roster_config: { C: 3 },
      team_count: 14,
      draft_order_type: "snake",
      ui_preferences: {},
      active_context: {
        source_type: "fantrax",
        provider: "fantrax",
        applied_settings_hash: "fantrax-hash"
      }
    });

    expect(settings.scoringCategories).toEqual({ GOALS: 5 });
    expect(settings.goalieScoringCategories).toEqual({ WINS_GOALIE: 6 });
    expect(settings.categoryWeights).toEqual({});
    expect(settings.scoringCategories.ASSISTS).toBeUndefined();
    expect(settings.goalieScoringCategories.SAVES_GOALIE).toBeUndefined();
  });

  it("preserves an explicitly applied Fantrax category map without adding categories", () => {
    const settings = mapUserSettingsRowToLeagueSettings({
      league_type: "categories",
      scoring_categories: { GOALS: 5 },
      goalie_scoring_categories: { WINS_GOALIE: 6 },
      category_weights: { HITS: 2 },
      roster_config: { C: 3 },
      team_count: 14,
      draft_order_type: "snake",
      ui_preferences: {},
      active_context: {
        source_type: "fantrax",
        provider: "fantrax",
        applied_settings_hash: "fantrax-category-hash"
      }
    });

    expect(settings.categoryWeights).toEqual({ HITS: 2 });
    expect(settings.categoryWeights.GOALS).toBeUndefined();
  });

  it("preserves an explicitly applied ESPN map without restoring site defaults", () => {
    const settings = mapUserSettingsRowToLeagueSettings({
      league_type: "points",
      scoring_categories: { SHOTS_ON_GOAL: 0.5 },
      goalie_scoring_categories: { SAVES_GOALIE: 0.2 },
      category_weights: {},
      roster_config: { C: 2 },
      team_count: 12,
      draft_order_type: "snake",
      ui_preferences: {},
      active_context: {
        source_type: "espn",
        provider: "espn",
        applied_settings_hash: "espn-hash"
      }
    });

    expect(settings.scoringCategories).toEqual({ SHOTS_ON_GOAL: 0.5 });
    expect(settings.goalieScoringCategories).toEqual({ SAVES_GOALIE: 0.2 });
    expect(settings.scoringCategories.GOALS).toBeUndefined();
    expect(settings.goalieScoringCategories.WINS_GOALIE).toBeUndefined();
  });
});

describe("mapLeagueSettingsToUserSettingsUpsert", () => {
  it("serializes the account form state back to the database shape", () => {
    const upsert = mapLeagueSettingsToUserSettingsUpsert("user-1", {
      leagueType: "categories",
      scoringCategories: {
        GOALS: 5
      },
      goalieScoringCategories: {
        WINS_GOALIE: 6
      },
      categoryWeights: {
        GOALS: 2
      },
      rosterConfig: {
        C: 3,
        bench: 4,
        utility: 1
      },
      teamCount: 16,
      draftOrderType: "straight",
      uiPreferences: {
        account_settings_section: "league-settings",
        league_settings_panel_open: true
      },
      activeContext: {
        source_type: "manual",
        provider: null,
        connected_account_id: null,
        external_league_id: null,
        external_team_id: null,
        applied_settings_hash: null,
        applied_at: null
      }
    });

    expect(upsert).toEqual({
      user_id: "user-1",
      league_type: "categories",
      scoring_categories: {
        GOALS: 5
      },
      goalie_scoring_categories: {
        WINS_GOALIE: 6
      },
      category_weights: {
        GOALS: 2
      },
      roster_config: {
        C: 3,
        bench: 4,
        utility: 1
      },
      team_count: 16,
      draft_order_type: "straight",
      ui_preferences: {
        account_settings_section: "league-settings",
        league_settings_panel_open: true
      },
      active_context: {
        source_type: "manual",
        provider: null,
        connected_account_id: null,
        external_league_id: null,
        external_team_id: null,
        applied_settings_hash: null,
        applied_at: null
      }
    });
  });
});
