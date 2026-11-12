import { describe, expect, it } from "vitest";

import { settlePlayerForecasts } from "./settlement";

// The served writer (settle cron → settlePlayerForecasts) must write v2 proper
// losses: no per-row skill index, invalid probabilities not evaluated.
describe("settlePlayerForecasts v2 scoring (decision 65, W3-5 F7/PR4)", () => {
  it("writes per-row proper losses under the bumped version and skips probability 1.2", async () => {
    const zero = { playerId: 77, toi: "00:00", goals: 0, assists: 0, shots: 0,
      blockedShots: 0, hits: 0, pim: 0 };
    const outputs = [
      { id: "plays", game_id: 100, team_id: 10, player_id: 77, population: "forward",
        target_key: "plays", conditioning: "playing_probability", point_estimate: null, probability: 1.2,
        distribution: null, quantiles: null },
      { id: "goals", game_id: 100, team_id: 10, player_id: 77, population: "forward",
        target_key: "goals", conditioning: "unconditional", point_estimate: 0.2, probability: null,
        distribution: { baselinePointEstimate: 0.5 }, quantiles: { p10: null, p90: null } },
    ];
    const tables: Record<string, any[]> = {
      games: [{ id: 100, seasonId: 20262027, startTime: "2026-10-05T20:00:00Z",
        date: "2026-10-05", homeTeamId: 10, awayTeamId: 20 }],
      player_forecast_outputs: outputs,
      nhl_api_game_payloads_raw: [{ id: "raw-1", game_id: 100, season_id: 20262027,
        payload_hash: "a".repeat(64), fetched_at: "2026-10-06T08:00:00Z",
        payload: { id: 100, season: 20262027, gameState: "FINAL",
          homeTeam: { id: 10 }, awayTeam: { id: 20 }, playerByGameStats: {
            homeTeam: { forwards: [zero], defense: [], goalies: [{ playerId: 78 }] },
            awayTeam: { forwards: [{ playerId: 88 }], defense: [], goalies: [{ playerId: 89 }] },
          } } }],
      player_forecast_outcome_revisions: [], player_forecast_evaluation_revisions: [],
    };
    const written: Array<{ table: string; row: Record<string, any> }> = [];
    const db = { from(table: string) {
      const query: any = {};
      for (const method of ["select", "gte", "lte", "in", "eq", "order"]) query[method] = () => query;
      query.range = async (from: number, to: number) => ({ data: tables[table].slice(from, to + 1),
        count: tables[table].length, error: null });
      query.upsert = (row: Record<string, unknown>) => ({ select: () => ({ maybeSingle: async () => {
        written.push({ table, row });
        return { data: { ...row, id: `${table}-${written.length}` }, error: null };
      } }) });
      return query;
    } };
    const result = await settlePlayerForecasts({ supabase: db as never,
      now: new Date("2026-10-06T12:00:00Z") });
    expect(result).toMatchObject({ outcomesAppended: 2, evaluationsAppended: 1 });
    const evaluations = written.filter((entry) => entry.table === "player_forecast_evaluation_revisions");
    expect(evaluations).toHaveLength(1);
    expect(evaluations[0].row).toMatchObject({
      forecast_output_id: "goals",
      scoring_version: "player-forecast-skill-v2",
      composite_skill_score: null,
      metrics: { actual: 0, forecast: 0.2, interval80Available: false },
      baseline_metrics: { forecast: 0.5 },
    });
    expect(evaluations[0].row.metrics.squaredError).toBeCloseTo(0.04);
    expect(evaluations[0].row.baseline_metrics.squaredError).toBeCloseTo(0.25);
    expect(evaluations[0].row.metrics).not.toHaveProperty("interval80Covered");
  });
});
