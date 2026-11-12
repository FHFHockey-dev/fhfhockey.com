import { describe, expect, it } from "vitest";
import { aggregatePlayerForecastRestOfSeason, loadPlayerForecastRestOfSeason } from "./restOfSeason";

const component = (playsProbability: number | null) =>
  ({ gameId: 1, scheduledStartAt: "2026-11-01T23:00:00Z", mean: 1, variance: 1, playsProbability });

describe("rest-of-season unknowns (BC W1-8 A)", () => {
  it("rejects a NaN plays probability instead of propagating it into the unconditional mean", () => {
    expect(() => aggregatePlayerForecastRestOfSeason({ components: [component(Number.NaN)], conditioning: "unconditional",
      seasonToDateActual: 3, scheduleRevisionHash: "schedule-v1" })).toThrow("plays probability");
  });

  it("refuses a full-season total without a known season-to-date actual", () => {
    for (const seasonToDateActual of [undefined, Number.NaN, -1]) {
      expect(() => aggregatePlayerForecastRestOfSeason({ components: [component(0.5)], conditioning: "unconditional",
        seasonToDateActual, scheduleRevisionHash: "schedule-v1" })).toThrow("unknown is not 0");
    }
    expect(aggregatePlayerForecastRestOfSeason({ components: [component(0.5)], conditioning: "unconditional",
      seasonToDateActual: 0, scheduleRevisionHash: "schedule-v1" }).fullSeasonMean).toBe(0.5);
  });

  it("does not serve a stored row whose actual is missing as a 0-based full-season total", async () => {
    const row = (id: number, season_to_date_actual: unknown) => ({ id, model_artifact_id: "a", season_id: 20262027, team_id: 1, player_id: id,
      population: "forward", target_key: "GOALS", conditioning: "unconditional", issued_at: "2026-11-01T00:00:00Z", schedule_revision_hash: "s",
      remaining_games: 2, season_to_date_actual, point_estimate: "1.5", variance: "1", quantiles: { p10: "0", p90: "3" }, fallback_flags: [] });
    const builder = (data: unknown[]) => { const query: any = { select: () => query, order: () => query, limit: () => query, eq: () => query,
      in: () => query, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve) }; return query; };
    const supabase = { from: (table: string) => builder(table === "players" ? [] : [row(1, null), row(2, "4")]) } as any;
    const served = await loadPlayerForecastRestOfSeason({ supabase });
    expect(served.map(forecast => [forecast.playerId, forecast.fullSeasonMean])).toEqual([[2, 5.5]]);
  });
});
