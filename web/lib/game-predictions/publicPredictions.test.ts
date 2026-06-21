import { describe, expect, it } from "vitest";

import { buildPublicGamePredictionsPayload } from "./publicPredictions";

describe("public game predictions payload", () => {
  it("builds public predictions from serving rows, stored history, and feature snapshots", () => {
    const payload = buildPublicGamePredictionsPayload({
      generatedAt: "2026-04-27T12:00:00.000Z",
      outputs: [
        {
          game_id: 1,
          snapshot_date: "2026-04-28",
          home_team_id: 10,
          away_team_id: 20,
          home_win_probability: 0.61,
          away_win_probability: 0.39,
          model_name: "nhl_game_baseline_logistic",
          model_version: "v1",
          prediction_scope: "pregame",
          computed_at: "2026-04-27T10:00:00.000Z",
          components: {
            top_factors: [
              {
                featureKey: "homeMinusAwayOffRating",
                value: 0.4,
                contribution: 0.12,
              },
            ],
          },
          metadata: { confidence_label: "medium", has_stale_source: true },
          provenance: {},
          updated_at: "2026-04-27T10:01:00.000Z",
          away_expected_goals: null,
          home_expected_goals: null,
          spread_projection: null,
          total_expected_goals: null,
        },
      ] as any,
      histories: [
        {
          game_id: 1,
          model_name: "nhl_game_baseline_logistic",
          model_version: "v1",
          prediction_scope: "pregame",
          computed_at: "2026-04-27T10:00:00.000Z",
          confidence_label: "medium",
          predicted_winner_team_id: 10,
          feature_snapshot_id: "snap-1",
          feature_set_version: "game_features_v1",
          metadata: {
            public_explanation_feature_keys: ["homeMinusAwayGoalieRating"],
          },
          top_factors: [
            {
              featureKey: "homeMinusAwayGoalieRating",
              value: 0.2,
              contribution: -0.08,
            },
          ],
        },
      ] as any,
      featureSnapshots: [
        {
          feature_snapshot_id: "snap-1",
          feature_payload: {
            home: {
              daysRest: 2,
              teamPower: {
                offRating: 0.7,
                defRating: 0.3,
                goalieRating: 0.1,
                specialRating: 0.2,
              },
              goalie: {
                source: "lines_ccc",
                confirmed: true,
                topGoalieId: 35,
                topGoalieName: "Home Starter",
                weightedProjectedGsaaPer60: 0.14,
              },
              lineup: null,
            },
            away: {
              daysRest: 1,
              teamPower: {
                offRating: 0.2,
                defRating: 0.4,
                goalieRating: 0.5,
                specialRating: 0.1,
              },
              goalie: {
                source: "recent_usage",
                confirmed: false,
                topGoalieId: 40,
                topGoalieName: null,
                weightedProjectedGsaaPer60: -0.04,
              },
              lineup: null,
            },
            sourceCutoffs: [
              {
                table: "team_power_ratings_daily",
                cutoff: "2026-04-20",
                stale: true,
              },
            ],
            warnings: [{ code: "stale_source", message: "source is stale" }],
            market: {
              source: "game_prediction_market_odds_snapshots",
              sourceName: "historical_market_odds_import",
              oddsSnapshotId: "odds-1",
              provider: "DraftKings",
              capturedAt: "2026-04-27T14:00:00.000Z",
              importRecordedAt: "2026-04-27T15:00:00.000Z",
              importBatchId: "batch-1",
              capturedAgeHours: 5,
              sourceUrl: "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard",
              homeMoneyline: -130,
              awayMoneyline: 110,
              homeNoVigProbability: 0.553191,
              awayNoVigProbability: 0.446809,
              overround: 0.041958,
              homeSpreadLine: -1.5,
              homeSpreadOdds: 180,
              awaySpreadLine: 1.5,
              awaySpreadOdds: -220,
              totalLine: 5.5,
              overOdds: -105,
              underOdds: -115,
            },
          },
        },
      ] as any,
      teams: [
        { id: 10, abbreviation: "BOS", name: "Boston Bruins" },
        { id: 20, abbreviation: "MTL", name: "Montreal Canadiens" },
      ],
      games: [{ id: 1, startTime: "19:00:00" }],
      modelVersions: [
        {
          model_name: "nhl_game_baseline_logistic",
          model_version: "v1",
          feature_set_version: "game_features_v1",
          status: "production",
        },
      ] as any,
      metrics: [
        {
          model_name: "nhl_game_baseline_logistic",
          model_version: "candidate-v2",
          feature_set_version: "candidate_features_v2",
          segment_key: "overall",
          segment_value: "all",
          evaluated_games: 5,
          evaluation_start_date: "2026-04-01",
          evaluation_end_date: "2026-04-05",
          accuracy: 0.2,
          log_loss: 1.2,
          brier_score: 0.4,
          calibration: [{ count: 1 }],
          computed_at: "2026-04-27T11:00:00.000Z",
        },
        {
          model_name: "nhl_game_baseline_logistic",
          model_version: "v1",
          feature_set_version: "game_features_v1",
          segment_key: "overall",
          segment_value: "all",
          evaluated_games: 100,
          evaluation_start_date: "2025-10-01",
          evaluation_end_date: "2026-04-20",
          accuracy: 0.58,
          log_loss: 0.67,
          brier_score: 0.23,
          calibration: [{ count: 10 }],
          computed_at: "2026-04-27T09:00:00.000Z",
        },
      ] as any,
    });

    expect(payload.count).toBe(1);
    expect(payload.predictions[0].homeTeam.abbreviation).toBe("BOS");
    expect(payload.predictions[0].factors[0]).toMatchObject({
      featureKey: "homeMinusAwayGoalieRating",
      direction: "away",
    });
    expect(payload.predictions[0].freshness.staleSources[0].table).toBe(
      "team_power_ratings_daily",
    );
    expect(payload.predictions[0].matchup?.homeGoalieConfirmed).toBe(true);
    expect(payload.predictions[0].matchup?.homeGoalieSource).toBe("lines_ccc");
    expect(payload.predictions[0].matchup?.homeGoalieName).toBe("Home Starter");
    expect(payload.predictions[0].market).toMatchObject({
      source: "feature_snapshot",
      sourceName: "historical_market_odds_import",
      provider: "DraftKings",
      capturedAt: "2026-04-27T14:00:00.000Z",
      homeMoneyline: -130,
      awayMoneyline: 110,
      homeNoVigProbability: 0.553191,
      awayNoVigProbability: 0.446809,
    });
    expect(payload.performance?.evaluatedGames).toBe(100);
    expect(payload.performance?.calibrationSummary).toBe(
      "1 populated calibration bins",
    );
  });

  it("hides top factors when public explanation metadata is absent", () => {
    const payload = buildPublicGamePredictionsPayload({
      outputs: [
        {
          game_id: 1,
          snapshot_date: "2026-04-28",
          home_team_id: 10,
          away_team_id: 20,
          home_win_probability: 0.61,
          away_win_probability: 0.39,
          model_name: "nhl_game_baseline_logistic",
          model_version: "candidate-v1",
          prediction_scope: "pregame",
          computed_at: "2026-04-27T10:00:00.000Z",
          components: {
            top_factors: [
              {
                featureKey: "homeMinusAwayRecent20XgfPct",
                value: 0.08,
                contribution: 0.04,
              },
            ],
          },
          metadata: {
            confidence_label: "medium",
            feature_set_version: "game_features_candidate",
          },
          provenance: {},
          updated_at: "2026-04-27T10:01:00.000Z",
          away_expected_goals: null,
          home_expected_goals: null,
          spread_projection: null,
          total_expected_goals: null,
        },
      ] as any,
      modelVersions: [
        {
          model_name: "nhl_game_baseline_logistic",
          model_version: "candidate-v1",
          feature_set_version: "game_features_candidate",
          status: "production",
        },
      ] as any,
    });

    expect(payload.predictions[0].factors).toEqual([]);
  });

  it("filters serving rows to production model versions when provided", () => {
    const payload = buildPublicGamePredictionsPayload({
      outputs: [
        {
          game_id: 1,
          snapshot_date: "2026-04-28",
          home_team_id: 10,
          away_team_id: 20,
          home_win_probability: 0.61,
          away_win_probability: 0.39,
          model_name: "nhl_game_baseline_logistic",
          model_version: "candidate-v1",
          prediction_scope: "pregame",
          computed_at: "2026-04-27T11:00:00.000Z",
          components: {},
          metadata: { feature_set_version: "candidate_features_v1" },
          provenance: {},
          updated_at: "2026-04-27T11:01:00.000Z",
          away_expected_goals: null,
          home_expected_goals: null,
          spread_projection: null,
          total_expected_goals: null,
        },
        {
          game_id: 2,
          snapshot_date: "2026-04-28",
          home_team_id: 30,
          away_team_id: 40,
          home_win_probability: 0.55,
          away_win_probability: 0.45,
          model_name: "nhl_game_baseline_logistic",
          model_version: "v1",
          prediction_scope: "pregame",
          computed_at: "2026-04-27T10:00:00.000Z",
          components: {},
          metadata: { feature_set_version: "game_features_v1" },
          provenance: {},
          updated_at: "2026-04-27T10:01:00.000Z",
          away_expected_goals: null,
          home_expected_goals: null,
          spread_projection: null,
          total_expected_goals: null,
        },
      ] as any,
      modelVersions: [
        {
          model_name: "nhl_game_baseline_logistic",
          model_version: "v1",
          feature_set_version: "game_features_v1",
          status: "production",
        },
      ] as any,
      metrics: [
        {
          model_name: "nhl_game_baseline_logistic",
          model_version: "candidate-v1",
          feature_set_version: "candidate_features_v1",
          segment_key: "overall",
          segment_value: "all",
          evaluated_games: 20,
          evaluation_start_date: "2026-04-01",
          evaluation_end_date: "2026-04-20",
          accuracy: 0.65,
          log_loss: 0.6,
          brier_score: 0.2,
          calibration: [{ count: 2 }],
          computed_at: "2026-04-27T12:00:00.000Z",
        },
      ] as any,
    });

    expect(payload.count).toBe(1);
    expect(payload.predictions[0].gameId).toBe(2);
    expect(payload.predictions[0].modelVersion).toBe("v1");
    expect(payload.performance).toBeNull();
  });

  it("hides serving rows when production model-version evidence is absent", () => {
    const payload = buildPublicGamePredictionsPayload({
      outputs: [
        {
          game_id: 1,
          snapshot_date: "2026-04-28",
          home_team_id: 10,
          away_team_id: 20,
          home_win_probability: 0.61,
          away_win_probability: 0.39,
          model_name: "nhl_game_baseline_logistic",
          model_version: "candidate-v1",
          prediction_scope: "pregame",
          computed_at: "2026-04-27T11:00:00.000Z",
          components: {},
          metadata: { feature_set_version: "candidate_features_v1" },
          provenance: {},
          updated_at: "2026-04-27T11:01:00.000Z",
          away_expected_goals: null,
          home_expected_goals: null,
          spread_projection: null,
          total_expected_goals: null,
        },
      ] as any,
    });

    expect(payload.count).toBe(0);
    expect(payload.predictions).toEqual([]);
    expect(payload.performance).toBeNull();
  });

  it("labels only explicitly whitelisted candidate-era factors", () => {
    const payload = buildPublicGamePredictionsPayload({
      outputs: [
        {
          game_id: 1,
          snapshot_date: "2026-04-28",
          home_team_id: 10,
          away_team_id: 20,
          home_win_probability: 0.61,
          away_win_probability: 0.39,
          model_name: "nhl_game_baseline_logistic",
          model_version: "promoted-v1",
          prediction_scope: "pregame",
          computed_at: "2026-04-27T10:00:00.000Z",
          components: {
            top_factors: [
              {
                featureKey: "homeMinusAwayRecent20XgfPct",
                value: 0.08,
                contribution: 0.04,
              },
              {
                featureKey: "homeMarketNoVigProbability",
                value: 0.57,
                contribution: 0.03,
              },
              {
                featureKey: "homeMinusAwayRecent20ShotShare",
                value: 0.05,
                contribution: 0.02,
              },
            ],
          },
          metadata: {
            confidence_label: "medium",
            feature_set_version: "game_features_v5_accuracy_candidates",
            public_explanation_feature_keys: [
              "homeMinusAwayRecent20XgfPct",
              "homeMinusAwayRecent20ShotShare",
            ],
          },
          provenance: {},
          updated_at: "2026-04-27T10:01:00.000Z",
          away_expected_goals: null,
          home_expected_goals: null,
          spread_projection: null,
          total_expected_goals: null,
        },
      ] as any,
      modelVersions: [
        {
          model_name: "nhl_game_baseline_logistic",
          model_version: "promoted-v1",
          feature_set_version: "game_features_v5_accuracy_candidates",
          status: "production",
        },
      ] as any,
    });

    expect(payload.predictions[0].factors).toEqual([
      expect.objectContaining({
        featureKey: "homeMinusAwayRecent20XgfPct",
        label: "Last 20 xG share edge",
      }),
      expect.objectContaining({
        featureKey: "homeMinusAwayRecent20ShotShare",
        label: "Last 20 shot share edge",
      }),
    ]);
  });
});
