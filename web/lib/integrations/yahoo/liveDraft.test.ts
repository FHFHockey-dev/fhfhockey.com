import { describe, expect, it } from "vitest";

import {
  applyYahooTeamDraftPositionDiagnostics,
  hashYahooDraftSnapshot,
  parseRetryAfterSeconds,
  parseYahooDraftResults,
  parseYahooDraftSettings,
  parseYahooPlayoffWeeks,
  parseYahooBoardSettings,
} from "./liveDraft";

const GAME_CONTEXT = {
  gameCode: "nhl" as const,
  gameKey: "477",
  season: "2026",
  targetSeasonId: 20262027,
};

describe("Yahoo live draft parser", () => {
  it.each(["head", "roto", "headpoint"])("excludes display-only stats from %s scoring without excluding genuine goalie categories", (scoringType) => {
    const settings = parseYahooDraftSettings({
      league_key: "477.l.123", draft_type: "live", num_teams: "10",
      scoring_type: scoringType,
      stat_categories: { stats: [
        { stat: { stat_id: "22", abbr: "GA", is_only_display_stat: "1" } },
        { stat: { stat_id: "25", abbr: "SV", is_only_display_stat: 1 } },
        { stat: { stat_id: "24", abbr: "SA", is_only_display_stat: true } },
        { stat: { stat_id: "23", abbr: "GAA", is_only_display_stat: "0" } },
        { stat: { stat_id: "26", abbr: "SV%", is_only_display_stat: false } },
        { stat: { stat_id: "27", abbr: "SHO" } },
        { stat: { stat_id: "999", abbr: "DISPLAY", is_only_display_stat: "1" } },
      ] },
      stat_modifiers: { stats: [
        { stat_id: "23", value: -2 }, { stat_id: "26", value: 3 }, { stat_id: "27", value: 4 },
      ] },
    }, GAME_CONTEXT);
    expect(settings.categoryWeights).toEqual(scoringType === "headpoint" ? {} : {
      GOALS_AGAINST_AVERAGE: 1, SAVE_PERCENTAGE: 1, SHUTOUTS_GOALIE: 1,
    });
    expect(settings.scoringCategories).toEqual(scoringType === "headpoint" ? {
      GOALS_AGAINST_AVERAGE: -2, SAVE_PERCENTAGE: 3, SHUTOUTS_GOALIE: 4,
    } : {});
    expect(settings.diagnostics.unsupportedStatIds).toEqual([]);
    expect(settings.requiresScoringConfirmation).toBe(false);
  });

  it("reuses league scoring for in-season boards without applying auction draft restrictions", () => {
    const result = parseYahooBoardSettings({ draft_type: "auction", scoring_type: "headpoint", weekly_deadline: "intraday",
      roster_positions: [{ position: "C", count: 2 }, { position: "IR+", count: 1 }, { position: "F", count: 1 }],
      stat_categories: { stats: [{ stat_id: "1", abbr: "G" }, { stat_id: "999", abbr: "CUSTOM" }] },
      stat_modifiers: { stats: [{ stat_id: "1", value: "3" }] } });
    expect(result.scoringCategories).toEqual({ GOALS: 3 });
    expect(result.unsupportedStatIds).toEqual(["999"]);
    expect(result.weeklyDeadline).toBe("intraday");
    expect(result.rosterConfig).toMatchObject({ C: 2, FWD: 1 });
    expect(result.excludedInjurySlots).toEqual({ "IR+": 1 });
  });
  it("uses Yahoo's explicit playoff range and preserves unknown data", () => {
    expect(parseYahooPlayoffWeeks({ league: [{ end_week: "26" }, { settings: [{ uses_playoff: "1", playoff_start_week: "24" }] }] })).toEqual([24, 25, 26]);
    expect(parseYahooPlayoffWeeks({ uses_playoff: "0", playoff_start_week: "24", end_week: "26" })).toEqual([]);
    for (const value of [{}, { playoff_start_week: 24 }, { playoff_start_week: 27, end_week: 26 }, { playoff_start_week: 24.5, end_week: 26 }, { playoff_start_week: 1, end_week: 999 }]) {
      expect(parseYahooPlayoffWeeks(value)).toBeUndefined();
    }
  });

  it("normalizes json_f settings, roster slots, and category scoring", () => {
    const settings = parseYahooDraftSettings({
      fantasy_content: {
        league: {
          league_key: "477.l.123",
          draft_status: "predraft",
          draft_type: "live",
          is_auction_draft: "0",
          num_teams: "12",
          end_week: "26",
          settings: {
            scoring_type: "head",
            uses_playoff: "1",
            playoff_start_week: "24",
            is_snake_draft: "1",
            roster_positions: [
              { roster_position: { position: "C", count: "2" } },
              { roster_position: { position: "BN", count: "4" } },
              { roster_position: { position: "Util", count: "1" } },
              { roster_position: { position: "IR+", count: "2" } },
            ],
            stat_categories: {
              stats: [
                { stat: { stat_id: "1", abbr: "G" } },
                { stat: { stat_id: "14", abbr: "SOG" } },
                { stat: { stat_id: "31", abbr: "HIT" } },
                { stat: { stat_id: "12", abbr: "GWG" } },
                { stat: { stat_id: "15", abbr: "SH%" } },
                { stat: { stat_id: "18", abbr: "GS" } },
              ],
            },
          },
        },
      },
    }, GAME_CONTEXT);

    expect(settings).toMatchObject({
      teamCount: 12,
      playoffWeeks: [24, 25, 26],
      isSnakeDraft: true,
      draftOrder: "snake",
      leagueType: "categories",
      rosterConfig: { C: 2, bench: 4, utility: 1 },
      categoryWeights: {
        GOALS: 1,
        SHOTS_ON_GOAL: 1,
        HITS: 1,
        GAME_WINNING_GOALS: 1,
        SHOOTING_PERCENTAGE: 1,
        GAMES_STARTED: 1,
      },
      requiresConfirmation: false,
      diagnostics: { excludedInjurySlots: { "IR+": 2 } },
    });
  });

  it("normalizes nested Yahoo point modifiers using supported stat IDs", () => {
    const settings = parseYahooDraftSettings({
      league_key: "477.l.123",
      draft_type: "live",
      is_auction_draft: "0",
      num_teams: "10",
      settings: {
        scoring_type: "headpoint",
        roster_positions: [
          { roster_position: { position: "F", count: "6" } },
          { roster_position: { position: "D", count: "4" } },
          { roster_position: { position: "G", count: "2" } },
        ],
        stat_categories: {
          stats: [
            { stat: { stat_id: "8", abbr: "PPP" } },
            { stat: { stat_id: "4", abbr: "+/-" } },
            { stat: { stat_id: "34", abbr: "TOI/G" } },
            { stat: { stat_id: "25", abbr: "SV" } },
            { stat: { stat_id: "26", abbr: "SV%" } },
            { stat: { stat_id: "999", abbr: "Mystery" } },
          ],
        },
        stat_modifiers: {
          stats: [
            { stat: { stat_id: "8", value: "1.5" } },
            { stat: { stat_id: "4", value: "0.5" } },
            { stat: { stat_id: "34", value: "0.1" } },
            { stat: { stat_id: "25", value: "0.2" } },
            { stat: { stat_id: "26", value: "3" } },
            { stat: { stat_id: "999", value: "4" } },
          ],
        },
      },
    }, GAME_CONTEXT);

    expect(settings.scoringCategories).toEqual({
      PP_POINTS: 1.5,
      PLUS_MINUS: 0.5,
      TIME_ON_ICE_PER_GAME: 0.1,
      SAVES_GOALIE: 0.2,
      SAVE_PERCENTAGE: 3,
    });
    expect(settings.diagnostics.unsupportedStatIds).toEqual(["999"]);
    expect(settings.requiresConfirmation).toBe(true);
  });

  it("flags missing or duplicate team draft positions for confirmation", () => {
    const settings = parseYahooDraftSettings({
      league_key: "477.l.123",
      draft_type: "live",
      num_teams: "2",
      settings: {
        scoring_type: "head",
        roster_positions: [
          { roster_position: { position: "C", count: "1" } },
        ],
        stat_categories: {
          stats: [{ stat: { stat_id: "1", abbr: "G" } }],
        },
      },
    }, GAME_CONTEXT);
    const diagnosed = applyYahooTeamDraftPositionDiagnostics(settings, [
      { yahooTeamKey: "477.l.123.t.1", name: "One", draftPosition: 1, isOwned: true },
      { yahooTeamKey: "477.l.123.t.2", name: "Two", draftPosition: 1, isOwned: false },
    ]);
    expect(diagnosed.requiresDraftOrderConfirmation).toBe(true);
    expect(diagnosed.diagnostics.draftPositionsComplete).toBe(false);
    expect(diagnosed.diagnostics.draftPositionIssues).toContain("duplicate");
  });

  it("parses configured-season draft picks and hashes canonical order", () => {
    const first = parseYahooDraftResults({
      fantasy_content: {
        league: {
          league_key: "477.l.123",
          draft_status: "drafting",
          draft_results: {
            results: [
              {
                draft_result: {
                  pick: "2",
                  round: "1",
                  team_key: "477.l.123.t.2",
                  player_key: "477.p.20",
                },
              },
              {
                draft_result: {
                  pick: "1",
                  round: "1",
                  team_key: "477.l.123.t.1",
                  player_key: "477.p.10",
                },
              },
            ],
          },
        },
      },
    }, GAME_CONTEXT);
    const second = { ...first, picks: [...first.picks].reverse() };
    const metadataOnlyChange = {
      ...first,
      picks: first.picks.map((pick) => ({
        ...pick,
        nhlTeamAbbreviation: "NYR",
        playerName: "Canonical display name",
        position: "C",
      })),
    };
    expect(first.picks.map((pick) => pick.pickNumber)).toEqual([1, 2]);
    expect(first.picks[0].yahooPlayerId).toBe("10");
    expect(hashYahooDraftSnapshot(first)).toBe(hashYahooDraftSnapshot(second));
    expect(hashYahooDraftSnapshot(first)).toBe(
      hashYahooDraftSnapshot(metadataOnlyChange),
    );
    expect(hashYahooDraftSnapshot(first)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("supports ordinary JSON with a dynamic game key and rejects duplicate picks", () => {
    const context = {
      gameCode: "nhl" as const,
      gameKey: "500",
      season: "2027",
      targetSeasonId: 20272028,
    };
    expect(
      parseYahooDraftResults(
        {
          fantasy_content: {
            league: {
              league_key: "500.l.88",
              draft_status: "drafting",
              draft_results: [
                {
                  pick: 1,
                  round: 1,
                  team_key: "500.l.88.t.2",
                  player_key: "500.p.9001",
                },
              ],
            },
          },
        },
        context,
      ).picks[0],
    ).toMatchObject({ yahooPlayerId: "9001", yahooPlayerKey: "500.p.9001" });
    expect(() =>
      parseYahooDraftResults(
        {
          results: [
            { pick: 1, round: 1, team_key: "500.l.88.t.1", player_key: "500.p.1" },
            { pick: 1, round: 1, team_key: "500.l.88.t.2", player_key: "500.p.2" },
          ],
        },
        context,
      ),
    ).toThrow("duplicate draft pick numbers");
  });

  it("rejects missing rounds, game-key mismatches, and salary-cap drafts", () => {
    expect(() =>
      parseYahooDraftResults({
        draft_result: {
          pick: "1",
          team_key: "477.l.1.t.1",
          player_key: "477.p.1",
        },
      }, GAME_CONTEXT),
    ).toThrow("round number");
    expect(() =>
      parseYahooDraftResults({
        draft_result: {
          pick: "1",
          round: "1",
          team_key: "465.l.1.t.1",
          player_key: "465.p.1",
        },
      }, GAME_CONTEXT),
    ).toThrow("different game");
    expect(() =>
      parseYahooDraftSettings({
        league_key: "477.l.1",
        is_auction_draft: "1",
      }, GAME_CONTEXT),
    ).toThrow("Salary-cap");
  });

  it("parses Retry-After seconds and date forms", () => {
    expect(parseRetryAfterSeconds("12")).toBe(12);
    expect(
      parseRetryAfterSeconds(
        "Wed, 12 Aug 2026 12:00:10 GMT",
        new Date("2026-08-12T12:00:00Z"),
      ),
    ).toBe(10);
  });
});
