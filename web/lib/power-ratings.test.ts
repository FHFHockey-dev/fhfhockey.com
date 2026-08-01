import { describe, expect, it } from "vitest";

import {
  POSTGREST_PAGE_SIZE,
  calculateEwma,
  calculateLeagueMetrics,
  calculateZScores,
  fetchPaginatedRows,
  type TeamGame,
} from "./power-ratings";

describe("power-ratings PostgREST pagination", () => {
  it("continues after a full 1,000-row page with deterministic ordering", async () => {
    const rows = Array.from(
      { length: POSTGREST_PAGE_SIZE + 7 },
      (_, index) => ({ id: index + 1 }),
    );
    const ranges: Array<[number, number]> = [];
    const orders: string[][] = [];

    const result = await fetchPaginatedRows<{ id: number }>(() => {
      const pageOrders: string[] = [];
      orders.push(pageOrders);

      return {
        order(column: string) {
          pageOrders.push(column);
          return this;
        },
        range(from: number, to: number) {
          ranges.push([from, to]);
          return Promise.resolve({
            data: rows.slice(from, to + 1),
            error: null,
          });
        },
      };
    }, ["date", "team_abbreviation"]);

    expect(result).toHaveLength(POSTGREST_PAGE_SIZE + 7);
    expect(result.at(-1)).toEqual({ id: POSTGREST_PAGE_SIZE + 7 });
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(orders).toEqual([
      ["date", "team_abbreviation"],
      ["date", "team_abbreviation"],
    ]);
  });

  it("surfaces a page error without retrying indefinitely", async () => {
    await expect(
      fetchPaginatedRows(
        () => ({
          order() {
            return this;
          },
          range() {
            return Promise.resolve({
              data: null,
              error: new Error("page failed"),
            });
          },
        }),
        ["date"],
      ),
    ).rejects.toThrow("page failed");
  });
});

describe("power-ratings missing PDO handling", () => {
  const teamGame = (team: string, pdo: number | null): TeamGame => ({
    team_abbreviation: team,
    date: "2026-03-10",
    season_id: 20252026,
    cf_per_60: 60,
    ca_per_60: 60,
    sf_per_60: 30,
    sa_per_60: 30,
    gf_per_60: 3,
    ga_per_60: 3,
    xgf_per_60: 3,
    xga_per_60: 3,
    gp: 1,
    toi_seconds: 3600,
    pace_per_60: 60,
    hdcf_per_60: 10,
    hdca_per_60: 10,
    pdo,
    data_mode: "all",
    pp_xgf_per_60: 6,
    pk_xga_per_60: 6,
    penalties_drawn_per_60: 2,
    penalties_taken_per_60: 2,
    rn_desc: 0,
    gp_to_date: 1,
  });

  it("records missing provenance and assigns a neutral PDO z-score", () => {
    const missing = calculateEwma([teamGame("ANA", null)], "2026-03-10")!;
    const observed = calculateEwma([teamGame("BOS", 1.01)], "2026-03-10")!;
    const league = calculateLeagueMetrics([missing, observed]);
    const result = calculateZScores(missing, league);

    expect(missing).toMatchObject({
      pdo_ewma: null,
      pdo_observation_count: 0,
    });
    expect(result).toMatchObject({
      pdo_z: 0,
      pdo_missing: true,
    });
    expect(league.league_pdo_avg).toBe(1.01);
  });
});
