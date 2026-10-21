import { beforeEach, describe, expect, it, vi } from "vitest";

const { tables, upsertMock } = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, any>[]>,
  upsertMock: vi.fn(async (..._args: any[]) => ({ error: null as null | { message: string } })),
}));

vi.mock("lib/cron/withCronJobAudit", () => ({ withCronJobAudit: (handler: any) => handler }));
vi.mock("lib/cron/nhlOffSeason", () => ({ withNhlOffSeasonSkip: (handler: any) => handler }));
vi.mock("utils/adminOnlyMiddleware", () => ({ default: (handler: any) => handler }));
vi.mock("lib/supabase/server", () => ({
  default: {
    from: (table: string) => {
      const filters: Array<(row: any) => boolean> = [];
      const builder: any = {
        select: () => builder, order: () => builder, range: () => builder,
        lte: (column: string, value: string) => { filters.push(row => row[column] <= value); return builder; },
        gte: (column: string, value: string) => { filters.push(row => row[column] >= value); return builder; },
        abortSignal: async () => {
          const data = (tables[table] ?? []).filter(row => filters.every(filter => filter(row)));
          return { data, count: data.length, error: null };
        },
        upsert: (rows: any[], options: any) => upsertMock(table, rows, options),
      };
      return builder;
    },
  },
}));

import handler from "pages/api/v1/db/forge-served-forecast-settle";

const res = () => {
  const out: any = { statusCode: 200, body: null, setHeader: vi.fn(),
    status(code: number) { this.statusCode = code; return this; }, json(payload: any) { this.body = payload; return this; } };
  return out;
};
const ledger = (served_date: string, player_id: number, game_id: number, source: string, player_class = "skater") => ({ served_date, player_id, game_id, source,
  season_id: 20262027, player_class, team_id: 1, opponent_team_id: 2, is_home: true, scheduled_at: `${served_date}T23:00:00.000Z`, settled_at: null,
  exp_goals: 9, issued_at: "2026-01-01T00:00:00Z" });

describe("forge-served-forecast-settle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-22T11:00:00Z"));
    Object.assign(tables, {
      // Game 100 (10-20) has actuals; game 200 (10-21) has none yet; a row outside the window is ignored.
      forge_served_forecast_ledger: [ledger("2026-10-20", 11, 100, "bridge_exact"), ledger("2026-10-20", 11, 100, "naive_last5"),
        ledger("2026-10-20", 31, 100, "naive_season", "goalie"), ledger("2026-10-21", 12, 200, "bridge_exact"), ledger("2026-10-18", 11, 50, "bridge_exact")],
      wgo_skater_stats: [{ player_id: 11, game_id: 100, date: "2026-10-20", goals: 1, assists: 1, pp_points: 0, shots: 4, hits: 2, blocked_shots: 0 }],
      wgo_goalie_stats: [{ goalie_id: 31, game_id: 100, date: "2026-10-20", games_started: 1, saves: 30, goals_against: 2, shots_against: 32, wins: 1, shutouts: 0 }],
    });
  });

  it("settles games with actuals (goalies via wgo_goalie_stats game_id), leaves the rest, and writes only settlement columns", async () => {
    const out = res();
    await handler({ method: "POST", query: {} } as any, out);
    expect(out.statusCode).toBe(200);
    expect(out.body).toMatchObject({ success: true, date: "2026-10-21", dates: ["2026-10-19", "2026-10-20", "2026-10-21"], rowsRead: 4, rowsSettled: 3, rowsUnsettled: 1,
      rowsUpserted: 3, byDate: { "2026-10-19": { read: 0, settled: 0, unsettled: 0 }, "2026-10-20": { read: 3, settled: 3, unsettled: 0 }, "2026-10-21": { read: 1, settled: 0, unsettled: 1 } } });
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const [table, rows, options] = upsertMock.mock.calls[0];
    expect(table).toBe("forge_served_forecast_ledger");
    expect(options).toEqual({ onConflict: "served_date,player_id,game_id,source" });
    for (const row of rows) {
      expect(Object.keys(row).filter(key => key.startsWith("exp_") || ["issued_at", "run_id", "method_version", "created_at", "updated_at"].includes(key))).toEqual([]);
      expect(row.settled_at).toBe("2026-10-22T11:00:00.000Z");
    }
    expect(rows.find((row: any) => row.source === "bridge_exact")).toMatchObject({ player_id: 11, act_goals: 1, act_shots: 4, dressed: true, outcome_source: "wgo_skater_stats",
      season_id: 20262027, team_id: 1 });
    expect(rows.find((row: any) => row.player_id === 31)).toMatchObject({ act_saves: 30, act_win: 1, act_shutout: 0, started: true, dressed: true, outcome_source: "wgo_goalie_stats" });
    expect(rows.some((row: any) => row.game_id === 200)).toBe(false);
  });

  it("returns zero counts when there are no ledger rows and rejects bad input", async () => {
    tables.forge_served_forecast_ledger = [];
    const out = res();
    await handler({ method: "GET", query: { date: "2026-10-21" } } as any, out);
    expect(out.body).toMatchObject({ success: true, rowsRead: 0, rowsUpserted: 0 });
    expect(upsertMock).not.toHaveBeenCalled();
    const bad = res();
    await handler({ method: "GET", query: { date: "2026-02-30" } } as any, bad);
    expect(bad.statusCode).toBe(400);
    const put = res();
    await handler({ method: "PUT", query: {} } as any, put);
    expect(put.statusCode).toBe(405);
  });

  it("reports a failed write", async () => {
    upsertMock.mockResolvedValueOnce({ error: { message: "denied" } });
    const out = res();
    await handler({ method: "POST", query: { date: "2026-10-21" } } as any, out);
    expect(out.statusCode).toBe(500);
    expect(out.body).toMatchObject({ success: false, rowsUpserted: 0, error: "denied" });
  });
});
