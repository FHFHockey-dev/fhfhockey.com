import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentSeasonMock, fromMock } = vi.hoisted(() => ({
  getCurrentSeasonMock: vi.fn(),
  fromMock: vi.fn()
}));

vi.mock("lib/supabase/server", () => ({ default: { from: fromMock } }));

vi.mock("../../../../../lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: unknown) => handler
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

describe("/api/v1/db/calculate-wigo-stats route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a structured dependency error instead of leaking html", async () => {
    getCurrentSeasonMock.mockRejectedValue(
      new Error(
        "<!DOCTYPE html><html><body>Error code 522 from supabase.co</body></html>"
      )
    );

    const req: any = {
      method: "GET",
      query: {},
      headers: { host: "localhost" }
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
      for (const method of ["select", "eq", "neq", "order", "range", "limit"]) {
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
    await handler({ method: "GET", query: {}, headers: { host: "localhost" } } as any, res);
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
});
