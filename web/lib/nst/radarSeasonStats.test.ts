import { describe, expect, it } from "vitest";
import {
  NST_RADAR_STATS,
  fetchNstRadarSeason,
  isMissingViewError,
  isNstRadarStat,
  nstRadarComparison,
  nstRadarMinimumLabel,
  nstRadarStatValue,
  RADAR_STRENGTH_LABEL,
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
  it("covers every NST metric the radar offers and reads only the two 5v5 season views (decision 15)", () => {
    expect(Object.keys(NST_RADAR_STATS).sort()).toEqual(
      [
        "cf_pct", "ff_pct", "sf_pct", "gf_pct", "xgf_pct",
        "goals_per_60", "total_assists_per_60", "total_points_per_60", "shots_per_60",
        "ixg_per_60", "icf_per_60", "hdcf_per_60", "hdca_per_60", "hits_per_60", "pim_per_60",
      ].sort(),
    );
    Object.values(NST_RADAR_STATS).forEach((def) =>
      expect(["nst_seasonlong_5v5_rates", "nst_seasonlong_5v5_counts_oi"]).toContain(def.view),
    );
    // NST's HDCF/60 is on-ice (decision 9), not individual iHDCF/60.
    expect(NST_RADAR_STATS.hdcf_per_60.columns).toEqual(["hdcf", "toi_seconds_oi"]);
    expect(RADAR_STRENGTH_LABEL).toBe("5v5");
    expect(isNstRadarStat("cf_pct")).toBe(true);
    expect(isNstRadarStat("fow_percentage")).toBe(false);
    expect(isNstRadarStat("points")).toBe(false);
  });

  it("derives shares from on-ice for/against and per-60s from the rates view", () => {
    expect(nstRadarStatValue("cf_pct", { cf: 492, ca: 281 })).toBeCloseTo(63.65, 2);
    expect(nstRadarStatValue("xgf_pct", { xgf: "10", xga: "5" })).toBeCloseTo(66.67, 2);
    expect(nstRadarStatValue("goals_per_60", { goals_per_60: 1.5, toi_seconds: 24046 })).toBe(1.5);
    // On-ice: 72 team high-danger chances in 18,000 s on ice = 14.4 per 60.
    expect(nstRadarStatValue("hdcf_per_60", { hdcf: 72, toi_seconds_oi: 18000, ihdcf_per_60: 3.9 })).toBeCloseTo(14.4, 6);
    expect(nstRadarStatValue("hdca_per_60", { hdca: 60, toi_seconds_oi: 24046 })).toBeCloseTo(8.98, 2);
  });

  it("returns null for missing, zero or unknown inputs", () => {
    expect(nstRadarStatValue("cf_pct", { cf: 0, ca: 0 })).toBeNull();
    expect(nstRadarStatValue("cf_pct", { cf: null, ca: 3 })).toBeNull();
    expect(nstRadarStatValue("hdca_per_60", { hdca: 4, toi_seconds_oi: 0 })).toBeNull();
    expect(nstRadarStatValue("points", { points: 3 })).toBeNull();
    expect(nstRadarStatValue("cf_pct", null)).toBeNull();
  });

  it("applies the same sample minimum to the player and the cohort", () => {
    const small = { cf: 5, ca: 5, goals_per_60: 6, toi_seconds: 600 };
    expect(nstRadarStatValue("cf_pct", small)).toBeNull();
    expect(nstRadarStatValue("goals_per_60", small)).toBeNull();
    expect(nstRadarMinimumLabel("goals_per_60")).toBe("60 min of 5v5 ice time");
    expect(nstRadarMinimumLabel("cf_pct")).toBe("20 on-ice 5v5 events");
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
      nst_seasonlong_5v5_rates: { data: rates },
      nst_seasonlong_5v5_counts_oi: { data: onIce },
      wgo_skater_stats_per_game: { data: [{ player_id: 1 }, { player_id: 3 }] },
    });
    const season = await fetchNstRadarSeason(client, 20262027, ["goals_per_60", "cf_pct", "points"], ["C"]);

    const rateCall = calls.find((c) => c.table === "nst_seasonlong_5v5_rates")!;
    expect(rateCall.columns.split(",").sort()).toEqual(["goals_per_60", "player_id", "toi_seconds"]);
    expect(rateCall.filters).toEqual([["eq", "season", 20262027]]);
    expect(calls.find((c) => c.table === "wgo_skater_stats_per_game")!.filters).toEqual([
      ["eq", "season", "20262027"],
      ["in", "position_code", ["C"]],
    ]);
    expect(calls.filter((c) => c.table.startsWith("nst_"))).toHaveLength(2);

    // The player's own row is not a peer; the caller adds the player once.
    expect(nstRadarComparison("goals_per_60", season, 1)).toEqual({ playerValue: 1.5, peerValues: [], belowMinimum: false, viewMissing: false, error: null });
    expect(nstRadarComparison("cf_pct", season, 1)).toEqual({ playerValue: 60, peerValues: [], belowMinimum: false, viewMissing: false, error: null });
    // A player outside the position list still gets his value; peers stay position-filtered.
    expect(nstRadarComparison("cf_pct", season, 2)).toEqual({ playerValue: 45, peerValues: [60], belowMinimum: false, viewMissing: false, error: null });
    // Below the TOI minimum: unranked and reported, not ranked against qualified peers.
    expect(nstRadarComparison("goals_per_60", season, 3)).toEqual({ playerValue: null, peerValues: [1.5], belowMinimum: true, viewMissing: false, error: null });
  });

  it("skips the position read when there is no position filter", async () => {
    const { client, calls } = fakeClient({ nst_seasonlong_5v5_rates: { data: rates } });
    const season = await fetchNstRadarSeason(client, 20262027, ["goals_per_60"], []);
    expect(calls.map((c) => c.table)).toEqual(["nst_seasonlong_5v5_rates"]);
    expect(season.allowedPlayerIds).toBeNull();
    expect(nstRadarComparison("goals_per_60", season, 2).peerValues).toEqual([1.5]);
  });

  it("makes no reads when no NST stat is requested", async () => {
    const { client, calls } = fakeClient({});
    await fetchNstRadarSeason(client, 20262027, ["points", "hits"], ["C"]);
    expect(calls).toHaveLength(0);
  });

  it("falls back to no comparison data on errors, throws, missing players and empty leagues", async () => {
    const failed = await fetchNstRadarSeason(
      fakeClient({ nst_seasonlong_5v5_rates: { error: { message: "timeout" } } }).client,
      20262027, ["goals_per_60"], [],
    );
    expect(nstRadarComparison("goals_per_60", failed, 1)).toMatchObject({ playerValue: null, peerValues: [] });
    expect(nstRadarComparison("goals_per_60", failed, 1).error).toEqual({ message: "timeout" });

    const thrown = await fetchNstRadarSeason(
      fakeClient({ nst_seasonlong_5v5_rates: { throws: true } }).client, 20262027, ["goals_per_60"], [],
    );
    expect(nstRadarComparison("goals_per_60", thrown, 1).peerValues).toEqual([]);

    const positionFailed = await fetchNstRadarSeason(
      fakeClient({
        nst_seasonlong_5v5_rates: { data: rates },
        wgo_skater_stats_per_game: { error: { message: "denied" } },
      }).client,
      20262027, ["goals_per_60"], ["D"],
    );
    expect(nstRadarComparison("goals_per_60", positionFailed, 1)).toMatchObject({ playerValue: null, peerValues: [] });

    const ok = await fetchNstRadarSeason(
      fakeClient({ nst_seasonlong_5v5_rates: { data: rates } }).client, 20262027, ["goals_per_60"], [],
    );
    expect(nstRadarComparison("goals_per_60", ok, 999).playerValue).toBeNull();
    expect(nstRadarComparison("cf_pct", ok, 1)).toMatchObject({ playerValue: null, peerValues: [] });

    const empty = await fetchNstRadarSeason(
      fakeClient({ nst_seasonlong_5v5_rates: { data: [] } }).client, 20262027, ["goals_per_60"], [],
    );
    expect(nstRadarComparison("goals_per_60", empty, 1)).toMatchObject({ playerValue: null, peerValues: [] });
  });
});

describe("unpublished 5v5 views (L4a migration 136)", () => {
  it.each([
    { code: "42P01", message: 'relation "public.nst_seasonlong_5v5_rates" does not exist' },
    { code: "PGRST205", message: "Could not find the table 'public.nst_seasonlong_5v5_rates' in the schema cache" },
    { message: 'relation "nst_seasonlong_5v5_counts_oi" does not exist' },
  ])("reports a missing view as unavailable, not an error (%j)", async (error) => {
    const season = await fetchNstRadarSeason(
      fakeClient({ nst_seasonlong_5v5_rates: { error } }).client, 20262027, ["goals_per_60"], [],
    );
    expect(isMissingViewError(error)).toBe(true);
    expect(nstRadarComparison("goals_per_60", season, 1)).toEqual({
      playerValue: null, peerValues: [], belowMinimum: false, viewMissing: true, error: null,
    });
  });

  it("keeps any other failure an error", async () => {
    const error = { code: "57014", message: "canceling statement due to statement timeout" };
    const season = await fetchNstRadarSeason(
      fakeClient({ nst_seasonlong_5v5_rates: { error } }).client, 20262027, ["goals_per_60"], [],
    );
    expect(isMissingViewError(error)).toBe(false);
    expect(nstRadarComparison("goals_per_60", season, 1)).toMatchObject({ viewMissing: false, error });
  });
});
