import { describe, expect, it } from "vitest";

import {
  shapePlayerSustainabilityPayload,
  shapePlayerSustainabilitySummaryPayload,
  shapeSustainabilityLeaderboardPayload,
  shapeUpcomingSustainabilityPayload
} from "./read";

describe("sustainability read contracts", () => {
  it("shapes score, bands, projections, flags, and explicit probability state", () => {
    const payload = shapePlayerSustainabilityPayload({
      playerId: 1,
      window: 10,
      horizon: 5,
      score: {
        player_id: 1,
        season_id: 20252026,
        snapshot_date: "2026-03-21",
        position_group: "F",
        window_code: "l10",
        s_raw: 1.2,
        s_100: 65,
        components: { z_shp: 1.4, z_ixg60: -0.2 },
        computed_at: "2026-03-21T00:00:00.000Z"
      },
      bands: [],
      projections: [
        {
          player_id: 1,
          snapshot_date: "2026-03-21",
          metric_key: "goals",
          horizon_games: 5,
          projection_type: "snapshot",
          scope_key: "overall",
          expected_value: 2.5,
          band50_lower: 1,
          band50_upper: 3,
          band80_lower: 0,
          band80_upper: 5,
          attempts: null,
          computed_at: "2026-03-21T00:00:00.000Z",
          distribution_model: "poisson",
          distribution_summary: {},
          expected_wins: null,
          game_id: null,
          metadata: {},
          opponent_adjustment: {},
          opponent_team_id: null,
          rate_per_60: 1.5,
          team_id: 14,
          toi_seconds: 1200,
          updated_at: "2026-03-21T00:00:00.000Z"
        }
      ]
    });

    expect(payload.flags.state).toBe("overperforming");
    expect(payload.probabilities.status).toBe("pending_calibration");
    expect(payload.explanations[0]).toMatchObject({ feature: "shp", impact: 1.4 });
    expect(payload.projections[0]).toMatchObject({ metric_key: "goals", expected_value: 2.5 });
  });

  it("groups opponent projections by game and honors the requested game count", () => {
    const base: any = {
      player_id: 1,
      snapshot_date: "2026-03-21",
      horizon_games: 1,
      projection_type: "opponent_game",
      expected_value: 1,
      band50_lower: 0,
      band50_upper: 1,
      band80_lower: 0,
      band80_upper: 2,
      opponent_adjustment: {},
      metadata: { gameDate: "2026-03-22", opponentTeamAbbreviation: "MTL" }
    };
    const payload = shapeUpcomingSustainabilityPayload({
      playerId: 1,
      games: 5,
      rows: [
        { ...base, game_id: 11, metric_key: "goals", scope_key: "game:11", team_id: 14, opponent_team_id: 8 },
        { ...base, game_id: 11, metric_key: "shots", scope_key: "game:11", team_id: 14, opponent_team_id: 8 }
      ]
    });
    expect(payload.games).toHaveLength(1);
    expect(payload.games[0]?.projections).toHaveLength(2);
  });

  it("selects the latest score for each canonical summary window", () => {
    const row = {
      player_id: 1,
      season_id: 20252026,
      position_group: "F",
      s_raw: 1,
      s_100: 73,
      components: {
        modelVersion: "sustainability_score_v2",
        configHash: "fnv1a_test"
      },
      computed_at: "2026-03-21T00:00:00.000Z"
    };
    const payload = shapePlayerSustainabilitySummaryPayload({
      playerId: 1,
      rows: [
        { ...row, window_code: "l10", snapshot_date: "2026-03-20" },
        { ...row, window_code: "l3", snapshot_date: "2026-03-21" },
        { ...row, window_code: "l10", snapshot_date: "2026-03-19" },
        { ...row, window_code: "l20", snapshot_date: "2026-03-18" }
      ]
    });

    expect(payload?.window_contract).toEqual(["l3", "l5", "l10", "l20"]);
    expect(payload?.snapshot_date).toBe("2026-03-21");
    expect(payload?.windows.map((item) => item.window_code)).toEqual([
      "l3",
      "l10",
      "l20"
    ]);
    expect(payload?.windows[1]).toMatchObject({
      snapshot_date: "2026-03-20",
      model_version: "sustainability_score_v2",
      config_hash: "fnv1a_test"
    });
  });

  it("filters and paginates the canonical leaderboard deterministically", () => {
    const score = {
      season_id: 20252026,
      snapshot_date: "2026-03-21",
      position_group: "F",
      window_code: "l10",
      s_raw: 1,
      components: {
        modelVersion: "sustainability_score_v2",
        configHash: "fnv1a_test"
      },
      computed_at: "2026-03-21T00:00:00.000Z"
    };
    const payload = shapeSustainabilityLeaderboardPayload({
      snapshotDate: "2026-03-21",
      seasonId: 20252026,
      scoreRows: [
        { ...score, player_id: 3, s_100: 80 },
        { ...score, player_id: 1, s_100: 80 },
        { ...score, player_id: 2, s_100: 70 }
      ],
      playerTotalRows: [
        {
          player_id: 1,
          player_name: "One",
          position_code: "C",
          season_id: 20252026,
          games_played: 8
        },
        {
          player_id: 2,
          player_name: "Two",
          position_code: "D",
          season_id: 20252026,
          games_played: 3
        },
        {
          player_id: 3,
          player_name: "Three",
          position_code: "C",
          season_id: 20252026,
          games_played: 10
        },
        {
          player_id: 3,
          player_name: "Three",
          position_code: "C",
          season_id: 20242025,
          games_played: 2
        }
      ],
      options: {
        windowCode: "l10",
        minGames: 5,
        minScore: 50,
        rookieOnly: true,
        page: 1,
        pageSize: 1,
        includeComponents: false
      }
    });

    expect(payload.pagination).toEqual({
      page: 1,
      page_size: 1,
      total: 1,
      total_pages: 1
    });
    expect(payload.rows[0]).toMatchObject({
      player_id: 1,
      player_name: "One",
      games_played: 8,
      rookie_status: true,
      model_version: "sustainability_score_v2",
      config_hash: "fnv1a_test"
    });
    expect(payload.rows[0]).not.toHaveProperty("components");
  });
});
