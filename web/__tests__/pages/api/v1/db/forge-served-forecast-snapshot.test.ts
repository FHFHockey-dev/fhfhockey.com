import { beforeEach, describe, expect, it, vi } from "vitest";

const { tables, upsertMock, bridgeMock, planningMock } = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, any>[]>,
  upsertMock: vi.fn(async (..._args: any[]) => ({ error: null as null | { message: string } })),
  bridgeMock: vi.fn(),
  planningMock: vi.fn(),
}));

vi.mock("lib/cron/withCronJobAudit", () => ({ withCronJobAudit: (handler: any) => handler }));
vi.mock("lib/cron/nhlOffSeason", () => ({ withNhlOffSeasonSkip: (handler: any) => handler }));
vi.mock("utils/adminOnlyMiddleware", () => ({ default: (handler: any) => handler }));
vi.mock("lib/rosterScheduleData/planningInputs", async importOriginal => ({ ...(await importOriginal<any>()), loadPlanningInputs: planningMock }));
vi.mock("lib/rosterScheduleData/forgeDailyBridge", async importOriginal => ({ ...(await importOriginal<any>()), loadForgeDailyBridgeForecasts: bridgeMock }));
vi.mock("lib/supabase/server", () => ({
  default: {
    from: (table: string) => {
      const filters: Array<(row: any) => boolean> = [];
      const builder: any = {
        select: () => builder, order: () => builder, range: () => builder,
        eq: (column: string, value: unknown) => { filters.push(row => row[column] === value); return builder; },
        in: (column: string, values: unknown[]) => { filters.push(row => values.includes(row[column])); return builder; },
        lt: (column: string, value: string) => { filters.push(row => row[column] < value); return builder; },
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

import handler from "pages/api/v1/db/forge-served-forecast-snapshot";

const res = () => {
  const out: any = { statusCode: 200, body: null, setHeader: vi.fn(),
    status(code: number) { this.statusCode = code; return this; }, json(payload: any) { this.body = payload; return this; } };
  return out;
};
const side = (id: string, team: string, opponent: string, home: boolean, startsAt: string) =>
  ({ id, date: "2026-10-21", startsAt, teamAbbreviation: team, opponent, home, status: "scheduled", scheduleRevision: "r" });

describe("forge-served-forecast-snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-21T12:30:00Z"));
    Object.assign(tables, {
      games: [{ id: 100, date: "2026-10-21", seasonId: 20262027, startTime: "2026-10-21T23:00:00Z", homeTeamId: 1, awayTeamId: 2 },
        { id: 101, date: "2026-10-21", seasonId: 20262027, startTime: "2026-10-21T12:00:00Z", homeTeamId: 4, awayTeamId: 3 },
        { id: 90, date: "2026-10-20", seasonId: 20262027, homeTeamId: 1, awayTeamId: 5 }],
      forge_runs: [{ run_id: "run-today", as_of_date: "2026-10-21" }],
      wgo_skater_stats: [{ player_id: 11, date: "2026-10-20", game_id: 90, season_id: 20262027, goals: 1, assists: 0, pp_points: 0, shots: 2, hits: 1, blocked_shots: 0 }],
      wgo_goalie_stats: [], nhl_team_data: [], nst_team_stats: [],
    });
    planningMock.mockResolvedValue({
      players: [{ id: "p11", nhlId: 11, nhlTeamId: 1, rosterRevision: "x", teamAbbreviation: "AAA", playerClass: "skater", eligiblePositions: ["C"] },
        { id: "p99", nhlId: 99, nhlTeamId: 7, rosterRevision: "x", teamAbbreviation: "GGG", playerClass: "skater", eligiblePositions: ["C"] }],
      games: [side("100", "AAA", "BBB", true, "2026-10-21T23:00:00.000Z"), side("100", "BBB", "AAA", false, "2026-10-21T23:00:00.000Z"),
        side("101", "DDD", "CCC", true, "2026-10-21T12:00:00.000Z"), side("101", "CCC", "DDD", false, "2026-10-21T12:00:00.000Z")],
    });
    bridgeMock.mockResolvedValue({ limitations: [], forecasts: [{ playerId: "p11", gameId: "100", revisionId: "forge-daily-bridge-v1:run-today",
      stats: { GOALS: 0.4, ASSISTS: 0.5, PP_POINTS: 0.2, SHOTS_ON_GOAL: 3, HITS: 1, BLOCKED_SHOTS: 0.5 }, startProbability: null,
      issuedAt: "2026-10-21T10:30:00Z", cutoffAt: "2026-10-21T10:30:00Z", expiresAt: "2026-10-21T23:00:00Z", modelVersion: "v", conditioning: "unconditional" }] });
  });

  it("snapshots bridge and naive rows for unstarted games, refusing a started one", async () => {
    const out = res();
    await handler({ method: "POST", query: { date: "2026-10-21" } } as any, out);
    expect(out.statusCode).toBe(200);
    expect(out.body).toMatchObject({ success: true, games: 2, players: 1, rowsUpserted: 3, skippedGames: [101],
      countsBySource: { bridge_exact: 1, bridge_reaimed: 0, native: 0, naive_last5: 1, naive_season: 1 } });
    expect(bridgeMock.mock.calls[0][1].map((player: any) => player.id)).toEqual(["p11"]);
    const [table, rows, options] = upsertMock.mock.calls[0];
    expect(table).toBe("forge_served_forecast_ledger");
    expect(options).toEqual({ onConflict: "served_date,player_id,game_id,source" });
    expect(rows.find((row: any) => row.source === "bridge_exact")).toMatchObject({ player_id: 11, game_id: 100, team_rest_days: 1, run_id: "run-today" });
  });

  it("rejects a malformed date and an unsupported method without reading", async () => {
    const bad = res();
    await handler({ method: "GET", query: { date: "2026-13-01" } } as any, bad);
    expect(bad.statusCode).toBe(400);
    const put = res();
    await handler({ method: "PUT", query: {} } as any, put);
    expect(put.statusCode).toBe(405);
    expect(planningMock).not.toHaveBeenCalled();
  });

  it("reports a failed write", async () => {
    upsertMock.mockResolvedValueOnce({ error: { message: "denied" } });
    const out = res();
    await handler({ method: "GET", query: { date: "2026-10-21" } } as any, out);
    expect(out.statusCode).toBe(500);
    expect(out.body).toMatchObject({ success: false, rowsUpserted: 0, error: "denied" });
  });
});
