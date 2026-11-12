import { describe, expect, it } from "vitest";

import {
  buildPredictionCandlestick,
  persistedFeatureSnapshotRowToPayload,
} from "./accountability";
import {
  buildGamePredictionFeatureSnapshotPayload,
  fetchGamePredictionFeatureInputs,
} from "./featureBuilder";
import { isPregamePredictionCutoff } from "./workflow";

// BC W1-10 A (issuance), rule 10: an issued forecast must be published before
// the frozen game start; unknown timing is not verified pregame evidence.

const game = {
  id: 3, date: "2026-01-10", startTime: "2026-01-10T23:00:00Z",
  seasonId: 20252026, homeTeamId: 1, awayTeamId: 2, type: 2,
};
const outcome = { gameId: 3, homeTeamId: 1, awayTeamId: 2, homeScore: 3, awayScore: 1, homeWon: true };
function prediction(overrides: Record<string, unknown> = {}) {
  return {
    prediction_id: "p", game_id: 3, snapshot_date: "2026-01-10",
    prediction_cutoff_at: "2026-01-10T22:00:00Z", computed_at: "2026-01-10T21:30:00Z",
    model_name: "m", model_version: "v", feature_set_version: "f",
    home_team_id: 1, away_team_id: 2, home_win_probability: 0.6,
    away_win_probability: 0.4, predicted_winner_team_id: 1,
    confidence_label: "low", metadata: {}, ...overrides,
  };
}

describe("issued-forecast eligibility", () => {
  it("accepts a forecast computed and cut off before the start", () => {
    expect(buildPredictionCandlestick({ predictions: [prediction()] as any, outcome, game: game as any })).not.toBeNull();
  });

  it("rejects a forecast computed after the start even with an earlier cutoff stamp", () => {
    const late = prediction({ computed_at: "2026-01-11T03:00:00Z" });
    expect(buildPredictionCandlestick({ predictions: [late] as any, outcome, game: game as any })).toBeNull();
  });

  it("rejects every forecast when the game start is unknown", () => {
    expect(
      buildPredictionCandlestick({ predictions: [prediction()] as any, outcome, game: { ...game, startTime: null } as any }),
    ).toBeNull();
    expect(buildPredictionCandlestick({ predictions: [prediction()] as any, outcome })).toBeNull();
  });

  it("orders issuances by publication time, keeping the last pregame one as final", () => {
    const early = prediction({ prediction_id: "a", computed_at: "2026-01-10T15:00:00Z", prediction_cutoff_at: "2026-01-10T22:00:00Z", home_win_probability: 0.55, away_win_probability: 0.45 });
    const later = prediction({ prediction_id: "b", computed_at: "2026-01-10T21:00:00Z", prediction_cutoff_at: "2026-01-10T16:00:00Z", home_win_probability: 0.7, away_win_probability: 0.3 });
    const candle = buildPredictionCandlestick({ predictions: [early, later] as any, outcome, game: game as any });
    expect(candle?.finalHomeWinProbability).toBe(0.7);
  });

  it("generation refuses a cutoff when the start time is unknown", () => {
    expect(isPregamePredictionCutoff({ game: { date: "2026-01-10", startTime: null }, predictionCutoffAt: "2026-01-10T16:00:00Z" })).toBe(false);
  });
});

function payloadWithCutoff(predictionCutoffAt: string) {
  return {
    ...buildGamePredictionFeatureSnapshotPayload({
      game, sourceAsOfDate: "2026-01-10", predictionCutoffAt,
      homeTeam: { id: 1, abbreviation: "BOS", name: "BOS" },
      awayTeam: { id: 2, abbreviation: "MTL", name: "MTL" },
      priorGames: [], teamPowerRows: [], standingsRows: [], wgoTeamRows: [],
      nstTeamGamelogRows: [], teamCtpiRows: [], goalieStartRows: [],
      lineCombinationRows: [], linesCccRows: [], goaliePerformanceRows: [],
      forgeGoalieGameRows: [], wgoGoalieRows: [],
    } as any),
    predictionCutoffAt,
  };
}

describe("persisted feature snapshot eligibility", () => {
  const row = (payload: any) => ({
    feature_snapshot_id: "s", game_id: 3, feature_set_version: payload.featureSetVersion,
    prediction_cutoff_at: payload.predictionCutoffAt, feature_payload: payload,
    metadata: {}, computed_at: "2026-01-12T00:00:00Z",
  });

  it("rejects a payload whose cutoff is at or after the game start", () => {
    const late = payloadWithCutoff("2026-01-10T23:30:00Z");
    expect(
      persistedFeatureSnapshotRowToPayload({
        row: row(late) as any, featureSetVersion: late.featureSetVersion,
        sourceAsOfDate: "2026-01-10", gameStartTime: game.startTime,
      }),
    ).toBeNull();
  });

  it("rejects a payload cut off after the requested cutoff", () => {
    const later = payloadWithCutoff("2026-01-10T20:00:00Z");
    expect(
      persistedFeatureSnapshotRowToPayload({
        row: row(later) as any, featureSetVersion: later.featureSetVersion,
        sourceAsOfDate: "2026-01-10", gameStartTime: game.startTime,
        maxPredictionCutoffAt: "2026-01-10T16:00:00Z",
      }),
    ).toBeNull();
  });

  it("keeps a payload cut off before the start and the requested cutoff", () => {
    const ok = payloadWithCutoff("2026-01-10T16:00:00Z");
    expect(
      persistedFeatureSnapshotRowToPayload({
        row: row(ok) as any, featureSetVersion: ok.featureSetVersion,
        sourceAsOfDate: "2026-01-10", gameStartTime: game.startTime,
        maxPredictionCutoffAt: "2026-01-10T16:00:00Z",
      }),
    ).not.toBeNull();
  });
});

function recordingClient(tables: Record<string, unknown[]>) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const client = {
    from(table: string) {
      const data = tables[table] ?? [];
      const query: any = {};
      for (const method of ["select", "eq", "lt", "lte", "gte", "in", "or", "order", "limit", "not", "is", "filter"]) {
        query[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return query;
        };
      }
      query.single = async () => ({ data: game, error: null });
      query.maybeSingle = async () => ({ data: null, error: null });
      query.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data, error: null }).then(resolve);
      return query;
    },
  };
  return { client: client as any, calls };
}

describe("source rows are read up to the prediction cutoff, not end of day", () => {
  it("bounds goalie projections and line tweets by the cutoff and drops rows updated after it", async () => {
    const goalieRows = [
      { game_id: 3, team_id: 1, player_id: 30, game_date: "2026-01-10", start_probability: 0.9, confirmed_status: true, projected_gsaa_per_60: 0.2, created_at: "2026-01-10T12:00:00Z", updated_at: "2026-01-10T15:00:00Z" },
      { game_id: 3, team_id: 2, player_id: 31, game_date: "2026-01-10", start_probability: 0.95, confirmed_status: true, projected_gsaa_per_60: 0.1, created_at: "2026-01-10T12:00:00Z", updated_at: "2026-01-10T19:00:00Z" },
    ];
    const { client, calls } = recordingClient({
      teams: [{ id: 1, abbreviation: "BOS", name: "BOS" }, { id: 2, abbreviation: "MTL", name: "MTL" }],
      goalie_start_projections: goalieRows,
    });
    const inputs = await fetchGamePredictionFeatureInputs(client, 3, {
      sourceAsOfDate: "2026-01-10",
      predictionCutoffAt: "2026-01-10T16:00:00.000Z",
    });
    const bound = (table: string) =>
      calls.filter((call) => call.table === table && call.method === "lte").map((call) => call.args);
    expect(bound("goalie_start_projections")).toEqual([["created_at", "2026-01-10T16:00:00.000Z"]]);
    expect(bound("lines_ccc")).toEqual([["observed_at", "2026-01-10T16:00:00.000Z"]]);
    expect(inputs.goalieStartRows.map((row) => row.player_id)).toEqual([30]);
  });
});

describe("live issuance lineup (BC W1-10 A lineup)", () => {
  const lineup = { gameId: 3, teamId: 1, forwards: [1, 2, 3], defensemen: [4, 5], goalies: [6] };
  const lineQueryIds = async (options: Record<string, unknown>) => {
    const { client, calls } = recordingClient({
      teams: [{ id: 1, abbreviation: "BOS", name: "BOS" }, { id: 2, abbreviation: "MTL", name: "MTL" }],
      lineCombinations: [lineup],
    });
    await fetchGamePredictionFeatureInputs(client, 3, options as any);
    return calls.find((call) => call.table === "lineCombinations" && call.method === "in" && call.args[0] === "gameId")?.args[1];
  };

  it("admits the target game's current lineup for a live issuance with an explicit date", async () => {
    expect(await lineQueryIds({ sourceAsOfDate: "2026-01-10", predictionCutoffAt: "2026-01-10T16:00:00Z", admitTargetGameLineup: true })).toEqual([3]);
  });

  it("keeps historical reconstructions fail-closed", async () => {
    expect(await lineQueryIds({ sourceAsOfDate: "2026-01-10", predictionCutoffAt: "2026-01-10T16:00:00Z" })).toBeUndefined();
  });
});
