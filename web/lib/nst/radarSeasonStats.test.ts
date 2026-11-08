import { describe, expect, it } from "vitest";
import {
  NST_RADAR_STATS,
  fetchNstRadarSeason,
  isNstRadarStat,
  nstRadarComparison,
  nstRadarStatValue,
  type SupabaseLike,
} from "./radarSeasonStats";

// A fake Supabase client: records each query and answers from a table map.
function fakeClient(tables: Record<string, { data?: unknown; error?: unknown; throws?: boolean }>) {
  const calls: { table: string; columns: string; filters: unknown[][] }[] = [];
  const client: SupabaseLike = {
    from(table) {
      return {
        select(columns) {
          const call = { table, columns, filters: [] as unknown[][] };
          calls.push(call);
          const answer = tables[table] ?? { data: [] };
          const query: any = {
            eq: (c: string, v: unknown) => { call.filters.push(["eq", c, v]); return query; },
            in: (c: string, v: unknown[]) => { call.filters.push(["in", c, v]); return query; },
            then: (resolve: any, reject: any) =>
              (answer.throws
                ? Promise.reject(new Error("network"))
                : Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null })
              ).then(resolve, reject),
          };
          return query;
        },
      };
    },
  };
  return { client, calls };
}

describe("NST radar column mapping", () => {
  it("covers every NST metric the radar offers and reads only the two season views", () => {
    expect(Object.keys(NST_RADAR_STATS).sort()).toEqual(
      [
        "cf_pct", "ff_pct", "sf_pct", "gf_pct", "xgf_pct",
        "goals_per_60", "total_assists_per_60", "total_points_per_60", "shots_per_60",
        "ixg_per_60", "icf_per_60", "hdcf_per_60", "hdca_per_60", "hits_per_60", "pim_per_60",
      ].sort(),
    );
    Object.values(NST_RADAR_STATS).forEach((def) =>
      expect(["nst_seasonlong_as_rates", "nst_seasonlong_as_counts_oi"]).toContain(def.view),
    );
    expect(NST_RADAR_STATS.hdcf_per_60.columns).toContain("ihdcf_per_60");
    expect(isNstRadarStat("cf_pct")).toBe(true);
    expect(isNstRadarStat("fow_percentage")).toBe(false);
    expect(isNstRadarStat("points")).toBe(false);
  });

  it("derives shares from on-ice for/against and per-60s from the rates view", () => {
    expect(nstRadarStatValue("cf_pct", { cf: 492, ca: 281 }, false)).toBeCloseTo(63.65, 2);
    expect(nstRadarStatValue("xgf_pct", { xgf: "10", xga: "5" }, false)).toBeCloseTo(66.67, 2);
    expect(nstRadarStatValue("goals_per_60", { goals_per_60: 1.5, toi_seconds: 24046 }, false)).toBe(1.5);
    expect(nstRadarStatValue("hdcf_per_60", { ihdcf_per_60: 3.9, toi_seconds: 24046 }, false)).toBe(3.9);
    expect(nstRadarStatValue("hdca_per_60", { hdca: 60, toi_seconds_oi: 24046 }, false)).toBeCloseTo(8.98, 2);
  });

  it("returns null for missing, zero or unknown inputs", () => {
    expect(nstRadarStatValue("cf_pct", { cf: 0, ca: 0 }, false)).toBeNull();
    expect(nstRadarStatValue("cf_pct", { cf: null, ca: 3 }, false)).toBeNull();
    expect(nstRadarStatValue("hdca_per_60", { hdca: 4, toi_seconds_oi: 0 }, false)).toBeNull();
    expect(nstRadarStatValue("points", { points: 3 }, false)).toBeNull();
    expect(nstRadarStatValue("cf_pct", null, false)).toBeNull();
  });

  it("applies the sample minimum to league rows only", () => {
    const small = { cf: 5, ca: 5, goals_per_60: 6, toi_seconds: 600 };
    expect(nstRadarStatValue("cf_pct", small, true)).toBeNull();
    expect(nstRadarStatValue("cf_pct", small, false)).toBe(50);
    expect(nstRadarStatValue("goals_per_60", small, true)).toBeNull();
    expect(nstRadarStatValue("goals_per_60", small, false)).toBe(6);
  });
});

describe("fetchNstRadarSeason and nstRadarComparison", () => {
  const rates = [
    { player_id: 1, goals_per_60: 1.5, toi_seconds: 20000 },
    { player_id: 2, goals_per_60: 0.5, toi_seconds: 20000 },
    { player_id: 3, goals_per_60: 9, toi_seconds: 300 }, // below the TOI minimum
  ];
  const onIce = [
    { player_id: 1, cf: 60, ca: 40 },
    { player_id: 2, cf: 45, ca: 55 },
  ];

  it("reads each view once with the needed columns and filters league rows by position", async () => {
    const { client, calls } = fakeClient({
      nst_seasonlong_as_rates: { data: rates },
      nst_seasonlong_as_counts_oi: { data: onIce },
      wgo_skater_stats_per_game: { data: [{ player_id: 1 }, { player_id: 3 }] },
    });
    const season = await fetchNstRadarSeason(client, 20262027, ["goals_per_60", "cf_pct", "points"], ["C"]);

    const rateCall = calls.find((c) => c.table === "nst_seasonlong_as_rates")!;
    expect(rateCall.columns.split(",").sort()).toEqual(["goals_per_60", "player_id", "toi_seconds"]);
    expect(rateCall.filters).toEqual([["eq", "season", 20262027]]);
    expect(calls.find((c) => c.table === "wgo_skater_stats_per_game")!.filters).toEqual([
      ["eq", "season", "20262027"],
      ["in", "position_code", ["C"]],
    ]);
    expect(calls.filter((c) => c.table.startsWith("nst_"))).toHaveLength(2);

    expect(nstRadarComparison("goals_per_60", season, 1)).toEqual({ playerValue: 1.5, leagueValues: [1.5], error: null });
    expect(nstRadarComparison("cf_pct", season, 1)).toEqual({ playerValue: 60, leagueValues: [60], error: null });
  });

  it("skips the position read when there is no position filter", async () => {
    const { client, calls } = fakeClient({ nst_seasonlong_as_rates: { data: rates } });
    const season = await fetchNstRadarSeason(client, 20262027, ["goals_per_60"], []);
    expect(calls.map((c) => c.table)).toEqual(["nst_seasonlong_as_rates"]);
    expect(season.allowedPlayerIds).toBeNull();
    expect(nstRadarComparison("goals_per_60", season, 2).leagueValues).toEqual([1.5, 0.5]);
  });

  it("makes no reads when no NST stat is requested", async () => {
    const { client, calls } = fakeClient({});
    await fetchNstRadarSeason(client, 20262027, ["points", "hits"], ["C"]);
    expect(calls).toHaveLength(0);
  });

  it("falls back to no comparison data on errors, throws, missing players and empty leagues", async () => {
    const failed = await fetchNstRadarSeason(
      fakeClient({ nst_seasonlong_as_rates: { error: { message: "timeout" } } }).client,
      20262027, ["goals_per_60"], [],
    );
    expect(nstRadarComparison("goals_per_60", failed, 1)).toMatchObject({ playerValue: null, leagueValues: [] });
    expect(nstRadarComparison("goals_per_60", failed, 1).error).toEqual({ message: "timeout" });

    const thrown = await fetchNstRadarSeason(
      fakeClient({ nst_seasonlong_as_rates: { throws: true } }).client, 20262027, ["goals_per_60"], [],
    );
    expect(nstRadarComparison("goals_per_60", thrown, 1).leagueValues).toEqual([]);

    const positionFailed = await fetchNstRadarSeason(
      fakeClient({
        nst_seasonlong_as_rates: { data: rates },
        wgo_skater_stats_per_game: { error: { message: "denied" } },
      }).client,
      20262027, ["goals_per_60"], ["D"],
    );
    expect(nstRadarComparison("goals_per_60", positionFailed, 1)).toMatchObject({ playerValue: null, leagueValues: [] });

    const ok = await fetchNstRadarSeason(
      fakeClient({ nst_seasonlong_as_rates: { data: rates } }).client, 20262027, ["goals_per_60"], [],
    );
    expect(nstRadarComparison("goals_per_60", ok, 999).playerValue).toBeNull();
    expect(nstRadarComparison("cf_pct", ok, 1)).toMatchObject({ playerValue: null, leagueValues: [] });

    const empty = await fetchNstRadarSeason(
      fakeClient({ nst_seasonlong_as_rates: { data: [] } }).client, 20262027, ["goals_per_60"], [],
    );
    expect(nstRadarComparison("goals_per_60", empty, 1)).toMatchObject({ playerValue: null, leagueValues: [] });
  });
});
