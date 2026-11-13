import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  POSTGREST_PAGE_SIZE,
  buildGenuineTeamGames,
  calculateEwma,
  calculateFinalRating,
  calculateLeagueMetrics,
  calculateRawDistribution,
  calculateRawScores,
  calculateZScores,
  computeDailyPowerRatings,
  fetchGameLogs,
  fetchPaginatedRows,
  goalie5v5InputsFromCounts,
  type TeamGame,
} from "./power-ratings";

describe("power-ratings PostgREST pagination", () => {
  it("starts independent game log queries together", async () => {
    const started: string[] = [];
    let release = () => {};
    const pending = new Promise<{ data: []; error: null }>((resolve) => {
      release = () => resolve({ data: [], error: null });
    });
    const client = {
      from(table: string) {
        started.push(table);
        return {
          select() { return this; },
          eq() { return this; },
          gte() { return this; },
          lte() { return this; },
          order() { return this; },
          range() { return pending; },
          then(resolve: (value: { data: []; error: null }) => void) {
            return pending.then(resolve);
          },
        };
      },
    } as unknown as SupabaseClient;

    const result = fetchGameLogs(client, "2026-03-01", "2026-03-10");

    expect(started).toEqual([
      "nst_team_gamelogs_as_rates",
      "nst_team_5v5",
      "nst_team_gamelogs_es_counts",
      "nst_team_gamelogs_pp_rates",
      "nst_team_gamelogs_pk_rates",
      "wgo_team_stats",
      "teams",
    ]);
    release();
    await expect(result).resolves.toEqual([]);
  });

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

  it("records missing provenance and keeps the final variance flag neutral", () => {
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
    const raw = calculateRawScores(result);
    const rating = calculateFinalRating(raw, calculateRawDistribution([raw]));
    expect(rating.variance_flag).toBe(0);
  });
});

describe("power-ratings 5-on-5 goaltending (decision 145)", () => {
  const rowsClient = (rowsByTable: Record<string, unknown[]>) =>
    ({
      from(table: string) {
        const result = { data: rowsByTable[table] ?? [], error: null };
        const chain: any = {
          select: () => chain,
          eq: () => chain,
          gte: () => chain,
          lte: () => chain,
          order: () => chain,
          range: () => Promise.resolve(result),
          then: (resolve: any, reject: any) =>
            Promise.resolve(result).then(resolve, reject),
        };
        return chain;
      },
    }) as unknown as SupabaseClient;

  /** All-situations NST rate row (GA/60 over a 60-minute game). */
  const allRow = (team: string, date: string, gaPer60: number) => ({
    team_abbreviation: team,
    date,
    season_id: 20262027,
    situation: "all",
    gp: 1,
    toi_seconds: 3600,
    cf_per_60: 55,
    ca_per_60: 55,
    sf_per_60: 28,
    sa_per_60: 28,
    gf_per_60: 3,
    ga_per_60: gaPer60,
    xgf_per_60: 2.8,
    xga_per_60: 2.8,
    hdcf_per_60: 10,
    hdca_per_60: 10,
    pdo: 1,
  });

  /** NST 5v5 counts row: GA, SA, xGA and 5-on-5 TOI in seconds. */
  const counts5v5 = (
    team: string,
    date: string,
    ga: number | null,
    sa: number | null,
    xga: number | null,
    toi: number | null,
  ) => ({
    team_abbreviation: team,
    date,
    situation: "5v5",
    ga,
    sa,
    xga,
    toi_seconds: toi,
  });

  it("excludes an empty-net goal: LAK 2026-11-12 (5 GA incl. 1 EN; 3 GA at 5v5)", async () => {
    const date = "2026-11-12";
    // LAK's all-situations row carries the empty-net goal; TWN is identical at
    // 5-on-5 but allowed no empty-net goal.
    const logs = await fetchGameLogs(
      rowsClient({
        nst_team_gamelogs_as_rates: [
          allRow("LAK", date, 5),
          allRow("TWN", date, 4),
          allRow("AAA", date, 3),
          allRow("BBB", date, 2),
        ],
        nst_team_gamelogs_es_counts: [
          counts5v5("LAK", date, 3, 19, 1.25, 3077),
          counts5v5("TWN", date, 3, 19, 1.25, 3077),
          counts5v5("AAA", date, 2, 25, 2.1, 2900),
          counts5v5("BBB", date, 1, 22, 2.4, 2950),
        ],
      }),
      "2026-06-15",
      date,
    );

    const lak = logs.find((log) => log.team_abbreviation === "LAK")!;
    expect(lak.ga_per_60).toBe(5);
    expect(lak.goalie_5v5?.ga_per_60).toBeCloseTo((3 * 3600) / 3077, 9);
    expect(lak.goalie_5v5?.sa_per_60).toBeCloseTo((19 * 3600) / 3077, 9);
    expect(lak.goalie_5v5?.xga_per_60).toBeCloseTo((1.25 * 3600) / 3077, 9);
    expect(lak.goalie_5v5?.toi_seconds).toBe(3077);

    const ratings = computeDailyPowerRatings(buildGenuineTeamGames(logs), date);
    const lakRating = ratings.get("LAK")!.rating;
    const twnRating = ratings.get("TWN")!.rating;
    expect(lakRating.goalie_rating).not.toBeNull();
    expect(lakRating.goalie_rating!).toBeCloseTo(twnRating.goalie_rating!, 9);
    // The other components still read all situations (unchanged).
    expect(lakRating.ga60).toBeGreaterThan(twnRating.ga60);
  });

  it("keeps 5-on-5 goaltending unknown when a 5-on-5 row is missing or incomplete", async () => {
    const day1 = "2026-11-11";
    const day2 = "2026-11-12";
    const complete = ["AAA", "BBB", "CCC"];
    const logs = await fetchGameLogs(
      rowsClient({
        nst_team_gamelogs_as_rates: ["MIS", "INC", ...complete].flatMap(
          (team, i) => [allRow(team, day1, 2 + i / 2), allRow(team, day2, 3 + i / 3)],
        ),
        nst_team_gamelogs_es_counts: [
          // MIS has no 5-on-5 row for day 1; INC's day-2 row has no TOI.
          counts5v5("MIS", day2, 2, 20, 2.2, 2900),
          counts5v5("INC", day1, 2, 20, 2.2, 2900),
          counts5v5("INC", day2, 2, 20, 2.2, null),
          ...complete.flatMap((team, i) => [
            counts5v5(team, day1, i, 20 + i, 2 + i / 10, 2800 + 50 * i),
            counts5v5(team, day2, 3 - i, 24 - i, 2.5 - i / 10, 3000 - 40 * i),
          ]),
        ],
      }),
      "2026-06-15",
      day2,
    );

    const ratings = computeDailyPowerRatings(buildGenuineTeamGames(logs), day2);
    for (const team of ["MIS", "INC"]) {
      const rating = ratings.get(team)!.rating;
      expect(rating.goalie_rating).toBeNull();
      expect(Number.isFinite(rating.off_rating)).toBe(true);
    }
    for (const team of complete) {
      expect(Number.isFinite(ratings.get(team)!.rating.goalie_rating)).toBe(true);
    }
  });

  it("reads a 5-on-5 counts row as unknown unless GA, SA, xGA and TOI are all present", () => {
    const row = { ga: 3, sa: 19, xga: 1.25, toi_seconds: 3077 };
    expect(goalie5v5InputsFromCounts(row)).not.toBeNull();
    expect(goalie5v5InputsFromCounts(undefined)).toBeNull();
    expect(goalie5v5InputsFromCounts({ ...row, ga: null })).toBeNull();
    expect(goalie5v5InputsFromCounts({ ...row, sa: null })).toBeNull();
    expect(goalie5v5InputsFromCounts({ ...row, xga: "" })).toBeNull();
    expect(goalie5v5InputsFromCounts({ ...row, toi_seconds: 0 })).toBeNull();
  });
});
