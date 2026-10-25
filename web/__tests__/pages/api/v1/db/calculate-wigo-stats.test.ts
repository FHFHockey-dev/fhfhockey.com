import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentSeasonMock, fromMock } = vi.hoisted(() => ({
  getCurrentSeasonMock: vi.fn(),
  fromMock: vi.fn()
}));

vi.mock("lib/supabase/server", () => ({ default: { from: fromMock } }));

vi.mock("../../../../../lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: unknown) => handler
}));

vi.mock("../../../../../lib/cron/nhlOffSeason", () => ({
  withNhlOffSeasonSkip: (handler: unknown) => handler
}));

vi.mock("../../../../../lib/NHL/server", () => ({
  getCurrentSeason: getCurrentSeasonMock
}));

import handler from "../../../../../pages/api/v1/db/calculate-wigo-stats";

function createMockRes() {
  return {
    statusCode: 200,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    }
  } as any;
}

function recentGame(date: string, season = 20262027, serial = 1) {
  return {
    game_id: Math.floor(season / 10000) * 1000000 + 20000 + serial,
    season_id: season, season, date, date_scraped: date, games_played: 1, gp: 1,
    goals: 1, assists: 1, points: 2, total_primary_assists: 1, shots: 4,
    pp_goals: 0, pp_assists: 0, pp_points: 0, pp_toi: 120, pp_toi_pct_per_game: 0.5,
    hits: 2, blocked_shots: 1, penalty_minutes: 0,
    toi: 1200, ixg: 0.8, icf: 10, hdcf: 2, iscfs: 4,
    gf: 3, sf: 12, off_zone_starts: 2, def_zone_starts: 2
  };
}

function installRecentFrameMock(
  nhl: Record<string, any>[],
  individual: Record<string, any>[],
  onIce = individual,
  failedTable?: string,
  players = [{ id: 8476453, position: "R" }]
) {
  const writes: Record<string, any[]> = {};
  const traces: Array<{ table: string; calls: any[][] }> = [];
  const tables: Record<string, any[]> = {
    players,
    wgo_skater_stats: nhl,
    nst_gamelog_as_counts: individual,
    nst_gamelog_as_counts_oi: onIce
  };
  fromMock.mockImplementation((table: string) => {
    const calls: any[][] = [];
    traces.push({ table, calls });
    const filters: Array<(row: any) => boolean> = [];
    const orders: Array<[string, boolean]> = [];
    let columns = "*";
    let limit = Infinity;
    let from = 0;
    let to = Infinity;
    const query: any = {
      select(value: string) { columns = value; calls.push(["select", value]); return query; },
      eq(key: string, value: any) { filters.push(row => row[key] === value); calls.push(["eq", key, value]); return query; },
      neq(key: string, value: any) { filters.push(row => row[key] !== value); return query; },
      in(key: string, values: any[]) { filters.push(row => values.includes(row[key])); calls.push(["in", key, values]); return query; },
      order(key: string, options: { ascending: boolean }) { orders.push([key, options.ascending]); return query; },
      limit(value: number) { limit = value; calls.push(["limit", value]); return query; },
      range(start: number, end: number) { from = start; to = end; return query; },
      upsert(data: any[]) { writes[table] = data; return Promise.resolve({ error: null }); },
      then(resolve: (value: unknown) => unknown) {
        let rows = (tables[table] ?? []).map(row => ({ player_id: 8476453, ...row }))
          .filter(row => filters.every(filter => filter(row)));
        rows.sort((a, b) => {
          for (const [key, ascending] of orders) {
            const result = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
            if (result) return ascending ? result : -result;
          }
          return 0;
        });
        rows = rows.slice(from, Math.min(to + 1, from + limit));
        if (columns !== "*") rows = rows.map(row => Object.fromEntries(columns.split(",").map(key => key.trim()).map(key => [key, row[key]])));
        return Promise.resolve({ data: table === failedTable ? null : rows,
          error: table === failedTable ? { message: "synthetic source failure" } : null, count: rows.length }).then(resolve);
      }
    };
    return query;
  });
  return { writes, traces };
}

async function runRecentFixture() {
  const res = createMockRes();
  await handler({ method: "GET", query: {}, headers: { host: "localhost", authorization: "Bearer unit-test-cron-secret" } } as any, res);
  return res;
}

describe("/api/v1/db/calculate-wigo-stats route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "unit-test-cron-secret");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("returns a structured dependency error instead of leaking html", async () => {
    getCurrentSeasonMock.mockRejectedValue(
      new Error(
        "<!DOCTYPE html><html><body>Error code 522 from supabase.co</body></html>"
      )
    );

    const req: any = {
      method: "GET",
      query: {},
      headers: { host: "localhost", authorization: "Bearer unit-test-cron-secret" }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain(
      "Upstream dependency returned an HTML error page"
    );
    expect(res.body.dependencyError).toMatchObject({
      kind: "dependency_error",
      classification: "html_upstream_response",
      source: "supabase_or_proxy",
      htmlLike: true
    });
  });

  it.each(["complete", "absent", "partial", "nonfinite", "zero", "missing PP", "wrong season", "missing season", "missing NHL season", "wrong date", "cross-season", "missing goals", "nonfinite goals", "missing points", "missing shots", "missing primary assists", "missing PP points", "missing PP percentage", "zero counts"])("writes recent rates with %s source coverage for every timeframe", async (coverage) => {
    getCurrentSeasonMock.mockResolvedValue({ seasonId: 20252026, lastSeasonId: 20242025 });
    const seasonal = [20252026, 20242025, 20232024].map(season => ({
      season, strength: "all", gp: 5, games_played: 5,
      goals: 5, assists: 5, points: 10, total_primary_assists: 3,
      shots: 20, pp_goals: 1, pp_assists: 1, pp_points: 2,
      pp_toi: 600, pp_toi_pct_per_game: 0.5,
      toi: 100, ixg: 4, icf: 50, ihdcf: 10, iscfs: 20,
      gf: 12, sf: 60, off_zone_starts: 10, def_zone_starts: 10
    }));
    const games = Array.from({ length: 5 }, (_, index) => ({
      game_id: (coverage === "cross-season" && index > 0 ? 2024 : 2025) * 1000000 + 20001 + index,
      games_played: 1,
      date: `${coverage === "cross-season" && index > 0 ? "2025" : "2026"}-04-${15 - index}`,
      date_scraped: `${coverage === "cross-season" && index > 0 ? "2025" : "2026"}-04-${15 - index}`,
      season_id: index === 0 && coverage === "missing NHL season" ? null : coverage === "cross-season" && index > 0 ? 20242025 : 20252026,
      season: coverage === "cross-season" && index > 0 ? 20242025 : 20252026,
      goals: 1, assists: 1, points: 2, total_primary_assists: 1,
      shots: 4, pp_goals: index === 0 ? 1 : 0, pp_assists: index === 1 ? 1 : 0,
      pp_points: index < 2 ? 1 : 0, pp_toi: 120, pp_toi_pct_per_game: 0.5,
      hits: 2, blocked_shots: 1, penalty_minutes: 0,
      toi: 1200, ixg: 0.8, icf: 10, hdcf: 2, iscfs: 4,
      gf: 3, sf: 12, off_zone_starts: 2, def_zone_starts: 2
    }));
    const written: Record<string, any[]> = {};
    const missingField = ({ "missing PP": "pp_toi", "missing goals": "goals", "nonfinite goals": "goals",
      "missing points": "points", "missing shots": "shots", "missing primary assists": "total_primary_assists",
      "missing PP points": "pp_points", "missing PP percentage": "pp_toi_pct_per_game" } as Record<string, string>)[coverage];
    const nhlGames = games.map((game, index) => ({ ...game,
      ...(coverage === "zero counts" ? { goals: 0, assists: 0, points: 0, total_primary_assists: 0, shots: 0,
        pp_goals: 0, pp_assists: 0, pp_points: 0, hits: 0, blocked_shots: 0, penalty_minutes: 0 } : {}),
      ...(index === 0 && missingField ? { [missingField]: coverage === "nonfinite goals" ? NaN : null } : {}),
    }));
    fromMock.mockImplementation((table: string) => {
      const nstGames = games.map((game, index) => ({ ...game,
        season: index === 0 && coverage === "wrong season" ? 20242025 : index === 0 && coverage === "missing season" ? null : game.season,
        date_scraped: index === 0 && coverage === "wrong date" ? "2026-04-16" : game.date_scraped,
      }));
      const rows = table === "players" ? [{ id: 1 }]
        : table === "wgo_skater_stats_totals" ? seasonal.map(row => ({ ...row, season: String(row.season) }))
        : table.startsWith("nst_seasonal") ? seasonal
        : table === "nst_gamelog_as_counts" ? coverage === "absent" ? []
          : nstGames.map((game, index) => ({ ...game, toi: coverage === "zero" ? 0 : index === 0 && coverage === "partial" ? null : index === 0 && coverage === "nonfinite" ? NaN : game.toi }))
        : table === "nst_gamelog_as_counts_oi" ? nstGames
        : table === "wgo_skater_stats" ? nhlGames
        : games;
      const builder: any = {};
      for (const method of ["select", "eq", "neq", "in", "order", "range", "limit"]) {
        builder[method] = () => builder;
      }
      builder.upsert = (data: any[]) => {
        written[table] = data;
        return Promise.resolve({ error: null });
      };
      builder.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(resolve);
      return builder;
    });
    const res = createMockRes();
    await handler({ method: "GET", query: {}, headers: { host: "localhost", authorization: "Bearer unit-test-cron-secret" } } as any, res);
    if (coverage === "missing NHL season") {
      expect(res.statusCode).toBe(207);
      expect(res.body).toMatchObject({ success: false, rejectedPlayerIds: [1] });
      expect(written).toEqual({});
      return;
    }
    expect(res.statusCode).toBe(200);
    const recent = written.wigo_recent[0];
    for (const interval of [5, 10, 20]) {
      const complete = !["absent", "partial", "nonfinite", "zero", "wrong season", "missing season", "missing NHL season", "wrong date"].includes(coverage);
      const missingGoals = ["missing goals", "nonfinite goals"].includes(coverage);
      const zeroCounts = coverage === "zero counts";
      expect(recent[`l${interval}_atoi`]).toBe(complete ? 20 : coverage === "zero" ? 0 : null);
      expect(recent[`l${interval}_pptoi`]).toBe(coverage === "missing PP" ? null : 120);
      expect(recent[`l${interval}_g_per_60`]).toBe(complete && !missingGoals ? zeroCounts ? 0 : 3 : null);
      expect(recent[`l${interval}_pts_per_60`]).toBe(complete && coverage !== "missing points" ? zeroCounts ? 0 : 6 : null);
      expect(recent[`l${interval}_ppp_per_60`]).toBe(["missing PP", "missing PP points"].includes(coverage) ? null : zeroCounts ? 0 : 12);
      const unmatched = ["absent", "wrong season", "missing season", "missing NHL season", "wrong date"].includes(coverage);
      expect(recent[`l${interval}_ixg`]).toBe(unmatched ? null : 4);
      if (unmatched && coverage !== "absent") expect(recent[`l${interval}_ipp`]).toBeNull();
      expect(recent[`l${interval}_g`]).toBe(missingGoals ? null : zeroCounts ? 0 : 5);
      if (missingGoals || ["missing points", "missing primary assists"].includes(coverage)) expect(recent[`l${interval}_pts1_pct`]).toBeNull();
      if (missingGoals || coverage === "missing primary assists") expect(recent[`l${interval}_pts1_per_60`]).toBeNull();
      if (coverage === "missing points") expect(recent[`l${interval}_ipp`]).toBeNull();
      if (coverage === "missing shots") {
        expect(recent[`l${interval}_sog`]).toBeNull();
        expect(recent[`l${interval}_sog_per_60`]).toBeNull();
        expect(recent[`l${interval}_s_pct`]).toBeNull();
      }
      if (coverage === "missing PP percentage") expect(recent[`l${interval}_pp_pct`]).toBeNull();
    }
    for (const period of ["std", "ly", "ya3", "ca"]) {
      expect(written.wigo_career[0][`${period}_pptoi`]).toBe(120);
    }
  });

  it.each([false, true])("uses the NHL frame despite intervening NST postseason rows (missing October 5: %s)", async (missingGame) => {
    getCurrentSeasonMock.mockResolvedValue({ seasonId: 20262027, lastSeasonId: 20252026 });
    const currentDates = ["23", "20", "17", "15", "13", "10", "08", "05", "03", "01"];
    const nhl = [
      ...currentDates.map((day, index) => recentGame(`2026-10-${day}`, 20262027, index + 1)),
      ...["15", "13", "11", "09", "07", "06", "04", "02"].map((day, index) => recentGame(`2026-04-${day}`, 20252026, index + 1)),
      recentGame("2026-03-31", 20252026, 9), recentGame("2026-03-26", 20252026, 10)
    ];
    const postseason = ["2026-05-03", "2026-05-01", "2026-04-29", "2026-04-26", "2026-04-24", "2026-04-21", "2026-04-19"]
      .map((date, index) => ({ ...recentGame(date, 20252026, index + 1), toi: 999999 }));
    const nst = [...nhl.filter(game => !missingGame || game.date !== "2026-10-05"), ...postseason];
    const { writes, traces } = installRecentFrameMock(nhl, nst);
    const res = await runRecentFixture();
    expect(res.statusCode).toBe(200);
    const recent = writes.wigo_recent[0];
    expect(recent.l5_gp).toBe(5);
    expect(recent.l5_atoi).toBe(20);
    expect(recent.l5_sog_per_60).toBe(12);
    expect(recent.l10_sog).toBe(40);
    expect(recent.l20_gp).toBe(20);
    expect(recent.l20_sog).toBe(80);
    for (const n of [10, 20]) {
      expect(recent[`l${n}_atoi`]).toBe(missingGame ? null : 20);
      expect(recent[`l${n}_sog_per_60`]).toBe(missingGame ? null : 12);
      if (missingGame) expect(recent[`l${n}_ixg_per_60`]).toBeNull();
      else expect(recent[`l${n}_ixg_per_60`]).toBeCloseTo(2.4);
    }
    for (const table of ["nst_gamelog_as_counts", "nst_gamelog_as_counts_oi"]) {
      const trace = traces.find(trace => trace.table === table)!;
      expect(trace.calls).toContainEqual(["in", "season", [20262027, 20252026]]);
      expect(trace.calls).toContainEqual(["in", "date_scraped", nhl.map(game => game.date)]);
      expect(trace.calls.some(call => call[0] === "limit")).toBe(false);
    }
  });

  it.each(["wgo_skater_stats_totals", "nst_seasonal_individual_counts", "nst_seasonal_on_ice_counts", "wgo_skater_stats", "nst_gamelog_as_counts", "nst_gamelog_as_counts_oi"])("does not publish aggregates after a %s read failure", async (failedTable) => {
    getCurrentSeasonMock.mockResolvedValue({ seasonId: 20262027, lastSeasonId: 20252026 });
    const game = recentGame("2026-10-23");
    const { writes } = installRecentFrameMock([game], [game], [game], failedTable);
    const res = await runRecentFixture();
    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain(failedTable);
    expect(writes).toEqual({});
  });

  it("excludes nonappearances without dropping valid zero-count games", async () => {
    getCurrentSeasonMock.mockResolvedValue({ seasonId: 20262027, lastSeasonId: 20252026 });
    const game = { ...recentGame("2026-10-23"), goals: 0, points: 0, shots: 0 };
    const scratch = { ...recentGame("2026-10-24", 20262027, 2), games_played: 0 };
    const { writes } = installRecentFrameMock([scratch, game], [game]);
    expect((await runRecentFixture()).statusCode).toBe(200);
    expect(writes.wigo_recent[0]).toMatchObject({ l5_gp: 1, l5_sog: 0, l5_sog_per_60: 0, l5_atoi: 20 });
  });

  it.each(["duplicate", "missing identity", "wrong season", "playoff identity"])("rejects an invalid NHL appearance frame (%s)", async (problem) => {
    getCurrentSeasonMock.mockResolvedValue({ seasonId: 20262027, lastSeasonId: 20252026 });
    const game = recentGame("2026-10-23");
    const bad = problem === "missing identity" ? { ...game, game_id: null }
      : problem === "wrong season" ? { ...game, season_id: 20252026 }
      : problem === "playoff identity" ? { ...game, game_id: 2026030001 }
      : { ...game, date: "2026-10-22" };
    const { writes } = installRecentFrameMock(problem === "duplicate" ? [game, bad] : [bad], [game]);
    const res = await runRecentFixture();
    expect(res.statusCode).toBe(207);
    expect(res.body).toMatchObject({ success: false, rejectedPlayerIds: [8476453] });
    expect(res.body.error).toBe("Invalid or duplicate regular-season NHL appearance for 1 player(s): 8476453.");
    expect(writes).toEqual({});
  });

  it("withholds only the rejected player's rows and still writes every valid player", async () => {
    getCurrentSeasonMock.mockResolvedValue({ seasonId: 20262027, lastSeasonId: 20252026 });
    const valid = { ...recentGame("2026-10-23"), player_id: 8478402 };
    const bad = { ...recentGame("2026-10-23"), game_id: null };
    const { writes } = installRecentFrameMock([bad, valid], [bad, valid], undefined, undefined,
      [{ id: 8476453, position: "R" }, { id: 8478402, position: "C" }]);
    const res = await runRecentFixture();
    expect(res.statusCode).toBe(207);
    expect(res.body).toMatchObject({ success: false, rejectedPlayerIds: [8476453] });
    expect(writes.wigo_recent.map(row => row.player_id)).toEqual([8478402]);
    expect(writes.wigo_career.map(row => row.player_id)).toEqual([8478402]);
  });
});
