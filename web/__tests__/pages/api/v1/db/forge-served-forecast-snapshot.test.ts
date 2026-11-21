import { beforeEach, describe, expect, it, vi } from "vitest";
import { provenSnapshotRow, unprovenSnapshotRow } from "lib/projections/externalInputProof.fixtures";

const { tables, fromMock, upsertMock, bridgeMock, planningMock, flags, stalled, signals } = vi.hoisted(() => ({
  // buildDelayMs / marketBuildDelayMs: wall-clock time the ledger or market build appears to take (Date is faked).
  flags: { market: undefined as boolean | undefined, basis: undefined as boolean | undefined, buildDelayMs: 0, marketBuildDelayMs: 0 },
  fromMock: vi.fn(),
  tables: {} as Record<string, Record<string, any>[]>,
  // Reads of these tables settle only when their abort signal fires, as fetch does; each table's signals are kept.
  stalled: new Set<string>(),
  signals: {} as Record<string, AbortSignal[]>,
  upsertMock: vi.fn(async (..._args: any[]) => ({ error: null as null | { message: string } })),
  bridgeMock: vi.fn(),
  planningMock: vi.fn(),
}));

vi.mock("lib/cron/withCronJobAudit", () => ({ withCronJobAudit: (handler: any) => handler }));
vi.mock("lib/cron/nhlOffSeason", () => ({ withNhlOffSeasonSkip: (handler: any) => handler }));
vi.mock("utils/adminOnlyMiddleware", () => ({ default: (handler: any) => handler }));
vi.mock("lib/rosterScheduleData/planningInputs", async importOriginal => ({ ...(await importOriginal<any>()), loadPlanningInputs: planningMock }));
vi.mock("lib/rosterScheduleData/forgeDailyBridge", async importOriginal => ({ ...(await importOriginal<any>()), loadForgeDailyBridgeForecasts: bridgeMock }));
vi.mock("lib/player-forecasts/servedForecastLedger", async importOriginal => {
  const actual = await importOriginal<any>();
  // Unset: the real constant (decision 126); set: a scenario override.
  const slow = <A extends any[], R>(build: (...args: A) => R, delay: () => number) => (...args: A): R => {
    if (delay()) vi.setSystemTime(Date.now() + delay());
    return build(...args);
  };
  return { ...actual, get LEDGER_MARKET_ENABLED() { return flags.market ?? actual.LEDGER_MARKET_ENABLED; }, get LEDGER_BASIS_SCHEMA_ENABLED() { return flags.basis ?? actual.LEDGER_BASIS_SCHEMA_ENABLED; },
    buildLedgerRows: slow(actual.buildLedgerRows, () => flags.buildDelayMs), buildMarketLedgerRows: slow(actual.buildMarketLedgerRows, () => flags.marketBuildDelayMs) };
});
vi.mock("lib/supabase/server", () => ({
  default: {
    from: (table: string) => {
      fromMock(table);
      const filters: Array<(row: any) => boolean> = [];
      let signal: AbortSignal | undefined;
      const settle = async () => {
        if (stalled.has(table)) return new Promise(resolve => {
          const abort = () => resolve({ data: null, count: null, error: { message: "AbortError: This operation was aborted" } });
          if (signal?.aborted) abort(); else signal?.addEventListener("abort", abort, { once: true });
        });
        const data = (tables[table] ?? []).filter(row => filters.every(filter => filter(row)));
        return { data, count: data.length, error: null };
      };
      const builder: any = {
        select: () => builder, order: () => builder, range: () => builder,
        eq: (column: string, value: unknown) => { filters.push(row => row[column] === value); return builder; },
        in: (column: string, values: unknown[]) => { filters.push(row => values.includes(row[column])); return builder; },
        lt: (column: string, value: string) => { filters.push(row => row[column] < value); return builder; },
        lte: (column: string, value: string) => { filters.push(row => row[column] <= value); return builder; },
        gte: (column: string, value: string) => { filters.push(row => row[column] >= value); return builder; },
        abortSignal: (value: AbortSignal) => { signal = value; (signals[table] ??= []).push(value); return builder; },
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => settle().then(resolve, reject),
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
const bridgeResult = () => ({ limitations: [], forecasts: [{ playerId: "p11", gameId: "100", revisionId: "forge-daily-bridge-v1:run-today",
  stats: { GOALS: 0.4, ASSISTS: 0.5, PP_POINTS: 0.2, SHOTS_ON_GOAL: 3, HITS: 1, BLOCKED_SHOTS: 0.5 }, startProbability: null,
  issuedAt: "2026-10-21T10:30:00Z", cutoffAt: "2026-10-21T10:30:00Z", expiresAt: "2026-10-21T23:00:00Z", modelVersion: "v", conditioning: "unconditional" }] });

describe("forge-served-forecast-snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flags.market = undefined;
    flags.basis = undefined;
    flags.buildDelayMs = 0;
    flags.marketBuildDelayMs = 0;
    stalled.clear();
    for (const table of Object.keys(signals)) delete signals[table];
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-21T12:30:00Z"));
    Object.assign(tables, {
      games: [{ id: 100, date: "2026-10-21", seasonId: 20262027, startTime: "2026-10-21T23:00:00Z", homeTeamId: 1, awayTeamId: 2 },
        { id: 101, date: "2026-10-21", seasonId: 20262027, startTime: "2026-10-21T12:00:00Z", homeTeamId: 4, awayTeamId: 3 },
        { id: 90, date: "2026-10-20", seasonId: 20262027, homeTeamId: 1, awayTeamId: 5 }],
      forge_runs: [{ run_id: "run-today", as_of_date: "2026-10-21" }],
      player_forecast_source_observations: [provenSnapshotRow("run-today")],
      wgo_skater_stats: [{ player_id: 11, date: "2026-10-20", game_id: 90, season_id: 20262027, goals: 1, assists: 0, pp_points: 0, shots: 2, hits: 1, blocked_shots: 0 }],
      wgo_goalie_stats: [], nhl_team_data: [], nst_team_stats: [],
      prop_market_prices_daily: [["over", -120], ["under", 100]].map(([outcome_key, price_american]) => ({ snapshot_date: "2026-10-21", game_id: 100, player_id: 11,
        market_type: "player_shots_on_goal", sportsbook_key: "a", outcome_key, line_value: 2.5, price_american, source_observed_at: "2026-10-21T11:00:00Z" })),
      market_prices_daily: [],
    });
    planningMock.mockResolvedValue({
      players: [{ id: "p11", nhlId: 11, nhlTeamId: 1, rosterRevision: "x", teamAbbreviation: "AAA", playerClass: "skater", eligiblePositions: ["C"] },
        { id: "p99", nhlId: 99, nhlTeamId: 7, rosterRevision: "x", teamAbbreviation: "GGG", playerClass: "skater", eligiblePositions: ["C"] }],
      games: [side("100", "AAA", "BBB", true, "2026-10-21T23:00:00.000Z"), side("100", "BBB", "AAA", false, "2026-10-21T23:00:00.000Z"),
        side("101", "DDD", "CCC", true, "2026-10-21T12:00:00.000Z"), side("101", "CCC", "DDD", false, "2026-10-21T12:00:00.000Z")],
    });
    bridgeMock.mockResolvedValue(bridgeResult());
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
    expect(out.body.bridgeRunProofs).toEqual([{ runId: "run-today", basis: "captured_snapshot", releaseSha: null, closureSha256: null }]);
  });

  it("writes no bridge row from a run whose snapshot lacks external-input exclusion proof", async () => {
    tables.player_forecast_source_observations = [unprovenSnapshotRow("run-today")];
    const out = res();
    await handler({ method: "POST", query: { date: "2026-10-21" } } as any, out);
    expect(out.statusCode).toBe(200);
    expect(out.body).toMatchObject({ rowsUpserted: 2, countsBySource: { bridge_exact: 0, bridge_reaimed: 0, naive_last5: 1, naive_season: 1 } });
    expect(upsertMock.mock.calls[0][1].some((row: any) => row.source.startsWith("bridge") || row.run_id === "run-today")).toBe(false);
    expect(out.body.bridgeLimitations).toEqual([expect.stringContaining("1 interim FORGE player-games")]);
  });

  it("writes nothing when the proof read fails", async () => {
    fromMock.mockImplementation((table: string) => { if (table === "player_forecast_source_observations") throw new Error("proof read failed"); });
    const out = res();
    try {
      await handler({ method: "POST", query: { date: "2026-10-21" } } as any, out);
    } finally { fromMock.mockReset(); }
    expect(out.statusCode).toBe(500);
    expect(out.body).toMatchObject({ success: false, stage: "forge_bridge_proof" });
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("writes no market rows: the shipped market source is off (decision 126)", async () => {
    const out = res();
    await handler({ method: "POST", query: { date: "2026-10-21" } } as any, out);
    expect(out.body.countsBySource.market).toBe(0);
    expect(upsertMock.mock.calls.flatMap(call => call[1]).some((row: any) => row.source === "market" || "market_lines" in row)).toBe(false);
  });

  it("upserts market rows after the served sources once enabled", async () => {
    flags.market = true;
    const out = res();
    await handler({ method: "POST", query: { date: "2026-10-21" } } as any, out);
    expect(out.statusCode).toBe(200);
    expect(out.body).toMatchObject({ rowsUpserted: 4, countsBySource: { bridge_exact: 1, naive_last5: 1, naive_season: 1, market: 1 } });
    expect(upsertMock.mock.calls[0][1].some((row: any) => "market_lines" in row)).toBe(false);
    // Ledger rows, then the eligible universe (basis schema on), then market rows last.
    expect(upsertMock.mock.calls.map(call => call[0])).toEqual(["forge_served_forecast_ledger", "forge_served_forecast_universe", "forge_served_forecast_ledger"]);
    const [, [market]] = upsertMock.mock.calls[2];
    // Props price a dressed player: the if-dressed naive means get a model P(over), the unconditional bridge line does not (decision 41).
    expect(market).toMatchObject({ source: "market", player_id: 11, game_id: 100, market_lines: { props: { shots: { line: 2.5, books: 1, model_p_over: { naive_last5: expect.any(Number) } } } } });
    expect(market.market_lines.props.shots.model_p_over.bridge_exact).toBeUndefined();
  });

  it("keeps the served rows when the market write fails (migration not applied)", async () => {
    flags.market = true;
    // Ledger and universe writes succeed; the market write (third) fails.
    upsertMock.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: "violates check constraint" } });
    const out = res();
    await handler({ method: "POST", query: { date: "2026-10-21" } } as any, out);
    expect(out.statusCode).toBe(207);
    expect(out.body).toMatchObject({ success: false, rowsUpserted: 3, marketError: "violates check constraint" });
  });

  it("sends no basis column or universe with the flag off, and persists both as shipped (migration 138)", async () => {
    flags.basis = false;
    const off = res();
    await handler({ method: "POST", query: { date: "2026-10-21" } } as any, off);
    expect(upsertMock.mock.calls.flatMap(call => call[1]).some((row: any) => "forecast_basis" in row)).toBe(false);
    expect(upsertMock.mock.calls.some(call => call[0] === "forge_served_forecast_universe")).toBe(false);
    expect(off.body).toMatchObject({ coverageStatus: "unavailable_independent_universe_not_persisted", universeUpserted: 0, scoringVersion: "served-ledger-scoring-v2" });
    upsertMock.mockClear();
    flags.basis = undefined;
    const on = res();
    await handler({ method: "POST", query: { date: "2026-10-21" } } as any, on);
    const ledgerRows = upsertMock.mock.calls[0][1];
    expect(ledgerRows.find((row: any) => row.source === "bridge_exact").forecast_basis).toBe("unconditional");
    expect(ledgerRows.find((row: any) => row.source === "naive_last5")).toMatchObject({ forecast_basis: "conditional_dressed", participation_probability: null });
    const [table, universe, options] = upsertMock.mock.calls[1];
    expect(table).toBe("forge_served_forecast_universe");
    expect(options).toEqual({ onConflict: "served_date,player_id,game_id" });
    expect(universe).toEqual([{ served_date: "2026-10-21", season_id: 20262027, player_id: 11, game_id: 100, player_class: "skater", team_id: 1, dressed: null }]);
    expect(on.body).toMatchObject({ coverageStatus: "universe_persisted", universeUpserted: 1 });
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

  it("denies an unauthorized caller before actual audit storage or business work", async () => {
    // The ordinary business fixtures bypass wrappers. This control imports the
    // actual exported route with both real wrappers to verify their order.
    vi.resetModules();
    vi.doUnmock("lib/cron/withCronJobAudit");
    vi.doUnmock("utils/adminOnlyMiddleware");
    try {
      const { default: protectedHandler } = await import("pages/api/v1/db/forge-served-forecast-snapshot");
      const out = res();
      await protectedHandler({ method: "POST", query: { date: "2026-10-21" }, headers: {},
        url: "/api/v1/db/forge-served-forecast-snapshot", socket: { remoteAddress: "203.0.113.1" } } as any, out);
      expect(out.statusCode).toBe(401);
      expect(fromMock).not.toHaveBeenCalled();
      expect(planningMock).not.toHaveBeenCalled();
      expect(bridgeMock).not.toHaveBeenCalled();
      expect(upsertMock).not.toHaveBeenCalled();
    } finally {
      vi.doMock("lib/cron/withCronJobAudit", () => ({ withCronJobAudit: (handler: any) => handler }));
      vi.doMock("utils/adminOnlyMiddleware", () => ({ default: (handler: any) => handler }));
      vi.resetModules();
    }
  });

  it("names the throwing stage and per-stage elapsed time on a read deadline, without writing", async () => {
    const { PlanningReadDeadlineError } = await import("lib/rosterScheduleData/planningInputs");
    // Planning inputs return, but only after spending 95 s of the route's 45 s budget.
    planningMock.mockImplementationOnce(async () => {
      vi.setSystemTime(Date.now() + 95000);
      return { players: [], games: [] };
    });
    bridgeMock.mockRejectedValueOnce(new PlanningReadDeadlineError());
    const out = res();
    await handler({ method: "POST", query: { date: "2026-10-21" } } as any, out);
    expect(out.statusCode).toBe(500);
    expect(out.body).toEqual({ success: false, date: "2026-10-21", error: "Planning read deadline exceeded",
      stage: "forge_bridge", stageMs: { day_games: 0, planning_inputs: 95000, forge_bridge: 0 } });
    expect(upsertMock).not.toHaveBeenCalled();
  });

  describe("absolute deadline (F19: a blocked event loop delays the deadline timers)", () => {
    it("writes no ledger row from a bridge result that arrives after the deadline", async () => {
      // The bridge succeeds, but 50 s into the route's 45 s budget: its timers ran late, so the result won the race.
      bridgeMock.mockImplementationOnce(async () => { vi.setSystemTime(Date.now() + 50000); return bridgeResult(); });
      const out = res();
      await handler({ method: "POST", query: { date: "2026-10-21" } } as any, out);
      expect(out.statusCode).toBe(500);
      expect(out.body).toEqual({ success: false, date: "2026-10-21", error: "Planning read deadline exceeded", stage: "forge_bridge",
        stageMs: { day_games: 0, planning_inputs: 0, forge_bridge: 50000 }, lateMs: 5000 });
      expect(fromMock).not.toHaveBeenCalledWith("player_forecast_source_observations");
      expect(upsertMock).not.toHaveBeenCalled();
    });

    it("names the bridge branch still running and how late the deadline timer ran", async () => {
      const { PlanningReadDeadlineError } = await import("lib/rosterScheduleData/planningInputs");
      bridgeMock.mockImplementationOnce(async (...args: any[]) => {
        const timing = args[8];
        timing.startedAt.runs = Date.now(); timing.ms.runs = 12;
        timing.startedAt.skaters = Date.now();
        vi.setSystemTime(Date.now() + 141000);
        throw new PlanningReadDeadlineError(135000);
      });
      const out = res();
      await handler({ method: "POST", query: { date: "2026-10-21" } } as any, out);
      expect(out.statusCode).toBe(500);
      expect(out.body).toMatchObject({ stage: "forge_bridge", lateMs: 135000,
        bridge: { branchMs: { runs: 12, skaters: 141000 }, pending: ["skaters"], slowest: "skaters" } });
      expect(upsertMock).not.toHaveBeenCalled();
    });

    it("cancels a stalled write-boundary proof read at the deadline and writes nothing", async () => {
      // The Date-only fake from beforeEach is replaced, so the deadline timers run on the fake clock too.
      vi.useRealTimers();
      vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
      vi.setSystemTime(new Date("2026-10-21T12:30:00Z"));
      stalled.add("player_forecast_source_observations");
      try {
        const out = res();
        const done = handler({ method: "POST", query: { date: "2026-10-21" } } as any, out);
        for (let tick = 0; tick < 1000 && !signals.player_forecast_source_observations; tick++) await Promise.resolve();
        expect(signals.player_forecast_source_observations).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(45000);
        await done;
        expect(out.statusCode).toBe(500);
        expect(out.body).toMatchObject({ success: false, error: "Planning read deadline exceeded", stage: "forge_bridge_proof", lateMs: 0 });
        // The proof's snapshot read was aborted with the deadline; its attribution read never started.
        expect(signals.player_forecast_source_observations.map(signal => signal.aborted)).toEqual([true]);
        expect(fromMock).not.toHaveBeenCalledWith("forge_runs");
        expect(upsertMock).not.toHaveBeenCalled();
      } finally { vi.useRealTimers(); }
    });

    it("refuses at the write boundary when the ledger build ends after the deadline", async () => {
      flags.buildDelayMs = 46000;
      const out = res();
      await handler({ method: "POST", query: { date: "2026-10-21" } } as any, out);
      expect(out.statusCode).toBe(500);
      expect(out.body).toMatchObject({ success: false, error: "Planning read deadline exceeded", stage: "ledger_upsert", lateMs: 1000,
        stageMs: expect.objectContaining({ ledger_build: 46000 }) });
      expect(upsertMock).not.toHaveBeenCalled();
    });

    it("writes no market row once the deadline has passed, keeping the served rows written in time", async () => {
      flags.market = true;
      flags.marketBuildDelayMs = 46000;
      const out = res();
      await handler({ method: "POST", query: { date: "2026-10-21" } } as any, out);
      expect(out.statusCode).toBe(207);
      expect(out.body).toMatchObject({ success: false, rowsUpserted: 3, marketError: "Planning read deadline exceeded" });
      expect(upsertMock.mock.calls.map(call => call[0])).toEqual(["forge_served_forecast_ledger", "forge_served_forecast_universe"]);
    });
  });

  it("reports a failed write", async () => {
    upsertMock.mockResolvedValueOnce({ error: { message: "denied" } });
    const out = res();
    await handler({ method: "GET", query: { date: "2026-10-21" } } as any, out);
    expect(out.statusCode).toBe(500);
    expect(out.body).toMatchObject({ success: false, rowsUpserted: 0, error: "denied" });
  });
});
