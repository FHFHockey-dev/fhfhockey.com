import { describe, expect, it } from "vitest";

import { buildPredictionCandlestick, buildAccountabilitySummary } from "./accountability";
import { predictGameWithBaselineModel } from "./baselineModel";
import { attachOutcomesToPredictions, calculateSegmentMetric } from "./evaluation";
import { buildPublicGamePredictionsPayload } from "./publicPredictions";
import { buildGamePredictionFeatureSnapshotPayload } from "./featureBuilder";
import { displayedWinnerTeamId, tallyWinnerPicks } from "./winnerPick";

// Decision 43: the pick follows the displayed probabilities and a displayed
// 50/50 is a tie (no pick). TJ 2026-11-11: ties are excluded from winner
// accuracy and counted apart.

const HOME = 10;
const AWAY = 20;

function payload() {
  return buildGamePredictionFeatureSnapshotPayload({
    game: {
      id: 1, date: "2026-01-10", startTime: "2026-01-10T23:00:00Z",
      seasonId: 20252026, homeTeamId: HOME, awayTeamId: AWAY, type: 2,
    } as any,
    sourceAsOfDate: "2026-01-10",
    predictionCutoffAt: "2026-01-10T22:00:00Z",
    homeTeam: { id: HOME, abbreviation: "BOS", name: "BOS" } as any,
    awayTeam: { id: AWAY, abbreviation: "MTL", name: "MTL" } as any,
    priorGames: [], teamPowerRows: [], standingsRows: [], wgoTeamRows: [],
    nstTeamGamelogRows: [], teamCtpiRows: [], goalieStartRows: [],
    lineCombinationRows: [], linesCccRows: [], goaliePerformanceRows: [],
    forgeGoalieGameRows: [], wgoGoalieRows: [],
  } as any);
}

function servedPick(homeProbability: number) {
  const p = payload();
  return predictGameWithBaselineModel({
    payload: p,
    model: {
      featureCount: 1,
      weights: [0],
      bias: Math.log(homeProbability / (1 - homeProbability)),
    },
    predictionCutoffAt: "2026-01-10T22:00:00Z",
    disableDataQualityDampening: true,
  });
}

describe("decision 43 winner pick", () => {
  it("follows the displayed probability: 51% home is a home pick", () => {
    const prediction = servedPick(0.51);
    expect(prediction.homeWinProbability).toBeCloseTo(0.51, 6);
    expect(prediction.predictedWinnerTeamId).toBe(HOME);
  });

  it("gives no pick when the displayed pair is 50/50", () => {
    expect(servedPick(0.5).predictedWinnerTeamId).toBeNull();
    expect(servedPick(0.503).predictedWinnerTeamId).toBeNull();
    expect(servedPick(0.497).predictedWinnerTeamId).toBeNull();
  });

  it("is symmetric under swapping sides", () => {
    expect(
      displayedWinnerTeamId({ homeWinProbability: 0.49, awayWinProbability: 0.51, homeTeamId: HOME, awayTeamId: AWAY }),
    ).toBe(AWAY);
    expect(
      displayedWinnerTeamId({ homeWinProbability: 0.51, awayWinProbability: 0.49, homeTeamId: HOME, awayTeamId: AWAY }),
    ).toBe(HOME);
  });

  it("public payload ignores a stored 0.52-rule pick and follows the displayed pair", () => {
    const base = {
      game_id: 1, snapshot_date: "2026-01-10", home_team_id: HOME, away_team_id: AWAY,
      model_name: "m", model_version: "v", prediction_scope: "pregame",
      computed_at: "2026-01-10T18:00:00Z", components: {}, metadata: {}, provenance: {},
      updated_at: "2026-01-10T18:00:00Z", away_expected_goals: null,
      home_expected_goals: null, spread_projection: null, total_expected_goals: null,
    };
    const history = {
      game_id: 1, model_name: "m", model_version: "v", prediction_scope: "pregame",
      computed_at: "2026-01-10T18:00:00Z", confidence_label: "low",
      predicted_winner_team_id: AWAY, feature_snapshot_id: null,
      feature_set_version: "f", metadata: {}, top_factors: [],
    };
    const version = { model_name: "m", model_version: "v", feature_set_version: "f", status: "production" };
    const homeLean = buildPublicGamePredictionsPayload({
      outputs: [{ ...base, home_win_probability: 0.51, away_win_probability: 0.49 }] as any,
      histories: [history] as any,
      modelVersions: [version] as any,
    });
    expect(homeLean.predictions[0]?.predictedWinnerTeamId).toBe(HOME);
    const even = buildPublicGamePredictionsPayload({
      outputs: [{ ...base, home_win_probability: 0.5, away_win_probability: 0.5 }] as any,
      histories: [{ ...history, predicted_winner_team_id: HOME }] as any,
      modelVersions: [version] as any,
    });
    expect(even.predictions[0]?.predictedWinnerTeamId).toBeNull();
  });

  it("accountability candles derive the pick from the final displayed pair", () => {
    const row = (homeProbability: number, storedPick: number) => ({
      prediction_id: "p", game_id: 1, snapshot_date: "2026-01-10",
      prediction_cutoff_at: "2026-01-10T22:00:00Z", model_name: "m", model_version: "v",
      feature_set_version: "f", home_team_id: HOME, away_team_id: AWAY,
      home_win_probability: homeProbability, away_win_probability: 1 - homeProbability,
      predicted_winner_team_id: storedPick, confidence_label: "low", metadata: {},
      computed_at: "2026-01-10T21:00:00Z",
    });
    const outcome = { gameId: 1, homeTeamId: HOME, awayTeamId: AWAY, homeScore: 3, awayScore: 1, homeWon: true };
    const game = { id: 1, date: "2026-01-10", startTime: "2026-01-10T23:00:00Z" } as any;
    const lean = buildPredictionCandlestick({ predictions: [row(0.51, AWAY)] as any, outcome, game });
    expect(lean?.predictedWinnerTeamId).toBe(HOME);
    expect(lean?.predictedWinnerCorrect).toBe(true);
    const tie = buildPredictionCandlestick({ predictions: [row(0.5, AWAY)] as any, outcome, game });
    expect(tie?.predictedWinnerTeamId).toBeNull();
    expect(tie?.predictedWinnerCorrect).toBeNull();

    const summary = buildAccountabilitySummary([lean!, tie!]);
    expect(summary).toMatchObject({ evaluatedGames: 2, correctGames: 1, wrongGames: 0, tieGames: 1, accuracy: 1 });
  });

  it("evaluation accuracy excludes ties", () => {
    const pred = (id: string, home: number) => ({
      prediction_id: id, game_id: 1, snapshot_date: "2026-01-10",
      prediction_cutoff_at: "2026-01-10T22:00:00Z", home_team_id: HOME, away_team_id: AWAY,
      home_win_probability: home, away_win_probability: 1 - home,
      predicted_winner_team_id: AWAY, metadata: {}, computed_at: "2026-01-10T21:00:00Z",
    });
    const outcome = { gameId: 1, homeTeamId: HOME, awayTeamId: AWAY, homeScore: 3, awayScore: 1, homeWon: true };
    const evaluated = attachOutcomesToPredictions([pred("a", 0.51), pred("b", 0.5)] as any, [outcome]);
    expect(evaluated.map((row) => row.predictedWinnerCorrect)).toEqual([true, null]);
    expect(calculateSegmentMetric(evaluated).accuracy).toBe(1);
  });

  it("tallies ties apart", () => {
    expect(
      tallyWinnerPicks([
        { predictedWinnerCorrect: true },
        { predictedWinnerCorrect: false },
        { predictedWinnerCorrect: null },
      ]),
    ).toEqual({ correctGames: 1, wrongGames: 1, tieGames: 1, accuracy: 0.5 });
  });
});
