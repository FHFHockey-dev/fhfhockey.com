import { describe, expect, it } from "vitest";

import { runWalkForwardBacktest, selectWalkForwardBacktestGameWindows } from "./accountability";
import { BASELINE_FEATURE_KEYS } from "./baselineModel";
import { buildGamePredictionFeatureSnapshotPayload } from "./featureBuilder";

// BC W1-10 A (leak), Astra R1: the default walk-forward replay must not learn a
// simultaneous (same-slate) game's result before predicting another game.

const teams = ["BOS", "MTL", "TOR", "OTT"].map((abbreviation, index) => ({
  id: index + 1, abbreviation, name: abbreviation,
}));
const games = [1, 2, 3, 4].map((id) => {
  const date = id < 3 ? "2026-01-09" : "2026-01-10";
  return {
    id, date, startTime: `${date}T23:00:00Z`, seasonId: 20252026,
    homeTeamId: id % 2 ? 1 : 3, awayTeamId: id % 2 ? 2 : 4, type: 2,
  };
});
const payloads = games.map((game) =>
  buildGamePredictionFeatureSnapshotPayload({
    game, sourceAsOfDate: game.date, predictionCutoffAt: `${game.date}T22:00:00Z`,
    homeTeam: teams[game.homeTeamId - 1], awayTeam: teams[game.awayTeamId - 1],
    priorGames: [], teamPowerRows: [], standingsRows: [], wgoTeamRows: [],
    nstTeamGamelogRows: [], teamCtpiRows: [], goalieStartRows: [],
    lineCombinationRows: [], linesCccRows: [], goaliePerformanceRows: [],
    forgeGoalieGameRows: [], wgoGoalieRows: [],
  } as any),
);
const featureSetVersion = payloads[0]!.featureSetVersion;

function client(firstReplayHomeWon: boolean) {
  return {
    from(table: string) {
      if (!["games", "teams", "pp_timeframes", "pbp_games"].includes(table)) {
        throw new Error(`Unapproved table: ${table}`);
      }
      const rows =
        table === "games" ? games
        : table === "teams" ? teams
        : table === "pbp_games" ? []
        : games.map((game) => ({
            game_id: game.id, home_team_id: game.homeTeamId, away_team_id: game.awayTeamId,
            home_team_score: game.id === 1 || (game.id === 3 && firstReplayHomeWon) ? 4 : 1,
            away_team_score: 2,
          }));
      const query: any = new Proxy({}, {
        get(_, key) {
          if (key === "then") return (resolve: any) => resolve({ data: rows, error: null });
          if (["select", "eq", "order", "in", "range"].includes(String(key))) return () => query;
          throw new Error(`Unapproved query method: ${String(key)}`);
        },
      });
      return query;
    },
  } as any;
}

async function secondReplayProbability(firstReplayHomeWon: boolean) {
  const result = await runWalkForwardBacktest({
    client: client(firstReplayHomeWon),
    seasonId: 20252026,
    payloadCache: new Map(payloads.map((payload) => [`${featureSetVersion}:${payload.gameId}:${payload.sourceAsOfDate}`, payload])),
    featureSetVersion,
    persist: false,
    retrainCadenceGames: 1,
    disableDataQualityDampening: true,
    initialModel: { featureCount: BASELINE_FEATURE_KEYS.length, weights: BASELINE_FEATURE_KEYS.map(() => 0), bias: 0 },
  } as any);
  expect(result.persisted).toBe(false);
  return result.candles.find((candle) => candle.gameId === 4)!.finalHomeWinProbability;
}

describe("walk-forward replay slate boundaries", () => {
  it("leaves a simultaneous game's prediction unchanged when another same-slate outcome flips", async () => {
    // Old code: 0.333998 vs 0.666002.
    expect(await secondReplayProbability(true)).toBe(await secondReplayProbability(false));
  });

  it("splits the initial training window at a date boundary", () => {
    const sameDay = [1, 2, 3, 4, 5].map((id) => ({
      ...games[0]!, id, date: id <= 1 ? "2026-01-08" : "2026-01-09",
    }));
    const { trainingGames, replayGames } = selectWalkForwardBacktestGameWindows({ games: sameDay });
    const trainingDates = new Set(trainingGames.map((game) => game.date));
    expect(replayGames.every((game) => !trainingDates.has(game.date))).toBe(true);
    expect(trainingGames.map((game) => game.id)).toEqual([1]);
  });
});

describe("completed-season game reads (BC W1-10 A misc)", () => {
  it("pages past the 1,000-row response cap with a deterministic order", async () => {
    const { fetchCompletedSeasonGames } = await import("./accountability");
    const seasonGames = Array.from({ length: 1500 }, (_, index) => ({
      id: index + 1, date: "2026-01-10", startTime: "2026-01-10T23:00:00Z",
      seasonId: 20252026, homeTeamId: 1, awayTeamId: 2, type: 2,
    }));
    const orders: string[] = [];
    const pagedClient = {
      from(table: string) {
        let rows: unknown[] =
          table === "games" ? seasonGames
          : table === "pp_timeframes" ? seasonGames.map((game) => ({ game_id: game.id, home_team_id: 1, away_team_id: 2, home_team_score: 3, away_team_score: 1 }))
          : [];
        const query: any = {
          select: () => query, eq: () => query,
          in: (column: string, values: number[]) => {
            rows = rows.filter((row: any) => values.includes(row[column]));
            return query;
          },
          order: (column: string) => { if (table === "games") orders.push(column); return query; },
          // PostgREST returns at most 1,000 rows per request.
          range: (from: number, to: number) => { rows = rows.slice(from, Math.min(to + 1, from + 1000)); return query; },
          then: (resolve: any) => resolve({ data: rows.slice(0, 1000), error: null }),
        };
        return query;
      },
    } as any;
    const { games } = await fetchCompletedSeasonGames({ client: pagedClient, seasonId: 20252026 });
    expect(games).toHaveLength(1500);
    expect(new Set(games.map((game) => game.id)).size).toBe(1500);
    expect(orders).toContain("id");
  });
});
