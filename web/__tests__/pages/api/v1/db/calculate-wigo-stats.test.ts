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

  it("writes recent rates from seconds and PPTOI as average seconds for every timeframe", async () => {
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
      date: `2026-04-${15 - index}`, date_scraped: `2026-04-${15 - index}`,
      goals: 1, assists: 1, points: 2, total_primary_assists: 1,
      shots: 4, pp_goals: index === 0 ? 1 : 0, pp_assists: index === 1 ? 1 : 0,
      pp_points: index < 2 ? 1 : 0, pp_toi: 120, pp_toi_pct_per_game: 0.5,
      toi: 1200, ixg: 0.8, icf: 10, hdcf: 2, iscfs: 4,
      gf: 3, sf: 12, off_zone_starts: 2, def_zone_starts: 2
    }));
    const written: Record<string, any[]> = {};
    fromMock.mockImplementation((table: string) => {
      const rows = table === "players" ? [{ id: 1 }]
        : table === "wgo_skater_stats_totals" ? seasonal.map(row => ({ ...row, season: String(row.season) }))
        : table.startsWith("nst_seasonal") ? seasonal : games;
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
      expect(recent[`l${interval}_atoi`]).toBe(20);
      expect(recent[`l${interval}_pptoi`]).toBe(120);
      expect(recent[`l${interval}_g_per_60`]).toBe(3);
      expect(recent[`l${interval}_pts_per_60`]).toBe(6);
      expect(recent[`l${interval}_ppp_per_60`]).toBe(12);
    }
    for (const period of ["std", "ly", "ya3", "ca"]) {
      expect(written.wigo_career[0][`${period}_pptoi`]).toBe(120);
    }
  });
});
