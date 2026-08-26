import { describe, expect, it } from "vitest";

import {
  applyYahooTeamDraftPositionDiagnostics,
  hashYahooDraftSnapshot,
  parseRetryAfterSeconds,
  parseYahooDraftResults,
  parseYahooDraftSettings,
} from "./liveDraft";

const GAME_CONTEXT = {
  gameCode: "nhl" as const,
  gameKey: "477",
  season: "2026",
  targetSeasonId: 20262027,
};

describe("Yahoo live draft parser", () => {
  it("normalizes json_f settings, roster slots, and category scoring", () => {
    const settings = parseYahooDraftSettings({
      fantasy_content: {
        league: {
          league_key: "477.l.123",
          draft_status: "predraft",
          draft_type: "live",
          is_auction_draft: "0",
          num_teams: "12",
          settings: {
            scoring_type: "head",
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
