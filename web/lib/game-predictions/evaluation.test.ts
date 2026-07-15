import { describe, expect, it } from "vitest";

import {
  attachOutcomesToPredictions,
  buildMetricInserts,
  buildSegmentMetrics,
  calculateAuc,
  deriveOutcomeFromScore,
  deriveOutcomeFromPbpGame,
  fetchCompletedGameOutcomes,
  type GamePredictionHistoryRow,
} from "./evaluation";

function createPrediction(
  overrides: Partial<GamePredictionHistoryRow> = {}
): GamePredictionHistoryRow {
  return {
    prediction_id: "prediction-1",
    game_id: 2025020001,
    snapshot_date: "2026-01-10",
    model_name: "nhl_game_baseline_logistic",
    model_version: "v1",
    feature_set_version: "game_features_v1",
    home_team_id: 1,
    away_team_id: 2,
    home_win_probability: 0.62,
    away_win_probability: 0.38,
    predicted_winner_team_id: 1,
    confidence_label: "medium",
    metadata: {},
    computed_at: "2026-01-10T18:00:00+00:00",
    ...overrides,
  };
}

describe("game prediction evaluation", () => {
  it("derives playoff fallback outcomes from pbp_games identity and scores", () => {
    expect(
      deriveOutcomeFromPbpGame({
        id: 2025030417,
        hometeamid: 22,
        awayteamid: 13,
        hometeamscore: 2,
        awayteamscore: 1,
        created_at: "2026-06-18T03:00:00.000Z",
      }),
    ).toMatchObject({
      gameId: 2025030417,
      homeTeamId: 22,
      awayTeamId: 13,
      homeScore: 2,
      awayScore: 1,
      homeWon: true,
    });
    expect(
      deriveOutcomeFromPbpGame({
        id: 2025030418,
        hometeamid: null,
        awayteamid: 13,
        hometeamscore: 3,
        awayteamscore: 2,
      }),
    ).toBeNull();
  });

  it("fetches regular and playoff outcomes in bounded chunks with primary-source precedence", async () => {
    const gameIds = Array.from({ length: 401 }, (_, index) => 2025030001 + index);
    const calls: Array<{ table: string; ids: number[] }> = [];
    const primaryGameId = gameIds[0];
    const client = {
      from(table: string) {
        return {
          select() {
            return {
              async in(_column: string, ids: number[]) {
                calls.push({ table, ids: [...ids] });
                if (table === "pp_timeframes") {
                  return {
                    data: ids.includes(primaryGameId)
                      ? [{
                          game_id: primaryGameId,
                          home_team_id: 1,
                          away_team_id: 2,
                          home_team_score: 4,
                          away_team_score: 1,
                          updated_at: "2026-05-01T03:00:00.000Z",
                        }]
                      : [],
                    error: null,
                  };
                }
                return {
                  data: ids.map((id) => ({
                    id,
                    hometeamid: 10,
                    awayteamid: 20,
                    hometeamscore: 2,
                    awayteamscore: 3,
                    created_at: "2026-06-18T03:00:00.000Z",
                  })),
                  error: null,
                };
              },
            };
          },
        };
      },
    };

    const outcomes = await fetchCompletedGameOutcomes(client as never, [
      ...gameIds,
      primaryGameId,
    ]);

    expect(calls.filter((call) => call.table === "pp_timeframes")).toHaveLength(3);
    expect(calls.filter((call) => call.table === "pbp_games")).toHaveLength(2);
    expect(calls.every((call) => call.ids.length <= 200)).toBe(true);
    expect(
      calls
        .filter((call) => call.table === "pbp_games")
        .some((call) => call.ids.includes(primaryGameId)),
    ).toBe(false);
    expect(outcomes).toHaveLength(401);
    expect(outcomes[0]).toMatchObject({ gameId: primaryGameId, homeScore: 4, homeWon: true });
    expect(outcomes[1]).toMatchObject({ gameId: gameIds[1], homeScore: 2, homeWon: false });
  });

  it("derives completed outcomes from score rows", () => {
    expect(
      deriveOutcomeFromScore({
        game_id: 1,
        home_team_id: 10,
        away_team_id: 20,
        home_team_score: 4,
        away_team_score: 2,
      })
    ).toMatchObject({
      gameId: 1,
      homeWon: true,
      homeScore: 4,
      awayScore: 2,
    });
    expect(
      deriveOutcomeFromScore({
        game_id: 1,
        home_team_id: 10,
        away_team_id: 20,
        home_team_score: 2,
        away_team_score: 2,
      })
    ).toBeNull();
  });

  it("attaches outcomes without mutating prediction rows", () => {
    const prediction = createPrediction();
    const evaluated = attachOutcomesToPredictions([prediction], [
      {
        gameId: 2025020001,
        homeTeamId: 1,
        awayTeamId: 2,
        homeScore: 3,
        awayScore: 1,
        homeWon: true,
      },
    ]);

    expect(evaluated).toHaveLength(1);
    expect(evaluated[0]).toMatchObject({
      label: 1,
      predictionProbability: 0.62,
      predictedWinnerCorrect: true,
    });
    expect(prediction).not.toHaveProperty("outcome");
  });

  it("calculates segment metrics and calibration bins", () => {
    const evaluated = attachOutcomesToPredictions(
      [
        createPrediction({
          prediction_id: "p1",
          game_id: 1,
          home_win_probability: 0.8,
          confidence_label: "high",
          metadata: { market_edge_bucket: "no_market" },
        }),
        createPrediction({
          prediction_id: "p2",
          game_id: 2,
          home_win_probability: 0.4,
          predicted_winner_team_id: 2,
          confidence_label: "medium",
          snapshot_date: "2026-03-15",
          metadata: { goalie_confirmation_state: "both_confirmed", game_type: 2 },
        }),
        createPrediction({
          prediction_id: "p3",
          game_id: 3,
          home_win_probability: 0.7,
          confidence_label: "high",
          metadata: { has_stale_source: true, goalie_confirmation_state: "projected_or_fallback", game_type: 3 },
        }),
      ],
      [
        { gameId: 1, homeTeamId: 1, awayTeamId: 2, homeScore: 4, awayScore: 1, homeWon: true },
        { gameId: 2, homeTeamId: 1, awayTeamId: 2, homeScore: 1, awayScore: 3, homeWon: false },
        { gameId: 3, homeTeamId: 1, awayTeamId: 2, homeScore: 2, awayScore: 3, homeWon: false },
      ]
    );
    const segments = buildSegmentMetrics(evaluated);

    expect(segments[0]).toMatchObject({
      segmentKey: "overall",
      evaluatedGames: 3,
    });
    expect(segments.some((segment) => segment.segmentKey === "confidence_label")).toBe(true);
    expect(segments.some((segment) => segment.segmentKey === "has_stale_source")).toBe(true);
    expect(segments[0].calibration).toHaveLength(10);
    expect(segments.some((segment) => segment.segmentKey === "season_phase")).toBe(true);
    expect(segments.some((segment) => segment.segmentKey === "predicted_side")).toBe(true);
    expect(segments.some((segment) => segment.segmentKey === "goalie_confirmation_state")).toBe(true);
    expect(
      segments.some(
        (segment) =>
          segment.segmentKey === "market_edge_bucket" &&
          segment.segmentValue === "no_market",
      ),
    ).toBe(true);
    expect(segments.some((segment) => segment.segmentKey === "game_type")).toBe(true);
  });

  it("calculates AUC when both classes are present", () => {
    const evaluated = attachOutcomesToPredictions(
      [
        createPrediction({ game_id: 1, home_win_probability: 0.9 }),
        createPrediction({ game_id: 2, home_win_probability: 0.2 }),
      ],
      [
        { gameId: 1, homeTeamId: 1, awayTeamId: 2, homeScore: 4, awayScore: 1, homeWon: true },
        { gameId: 2, homeTeamId: 1, awayTeamId: 2, homeScore: 1, awayScore: 4, homeWon: false },
      ]
    );

    expect(calculateAuc(evaluated)).toBe(1);
  });

  it("builds model metric rows for persistence", () => {
    const evaluated = attachOutcomesToPredictions([createPrediction()], [
      {
        gameId: 2025020001,
        homeTeamId: 1,
        awayTeamId: 2,
        homeScore: 3,
        awayScore: 2,
        homeWon: true,
      },
    ]);
    const rows = buildMetricInserts({
      evaluated,
      modelName: "nhl_game_baseline_logistic",
      modelVersion: "v1",
      featureSetVersion: "game_features_v1",
      evaluationStartDate: "2026-01-01",
      evaluationEndDate: "2026-01-31",
    });

    expect(rows[0]).toMatchObject({
      model_name: "nhl_game_baseline_logistic",
      model_version: "v1",
      feature_set_version: "game_features_v1",
      evaluation_start_date: "2026-01-01",
      evaluation_end_date: "2026-01-31",
      segment_key: "overall",
      evaluated_games: 1,
    });
  });
});
