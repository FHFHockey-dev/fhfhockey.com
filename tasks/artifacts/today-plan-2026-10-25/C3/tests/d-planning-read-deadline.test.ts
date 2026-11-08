// C3 (d): /api/v1/db/forge-served-forecast-snapshot "Planning read deadline exceeded" after 2m 20s.
// Offline only: fake clock, mocked Supabase builders, mocked audit/auth; rows are fabricated.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ loadPlanningInputs: vi.fn(), tables: {} as Record<string, unknown[]>, from: vi.fn() }));
vi.mock("lib/cron/withCronJobAudit", () => ({ withCronJobAudit: (handler: unknown) => handler }));
vi.mock("lib/cron/nhlOffSeason", () => ({ withNhlOffSeasonSkip: (handler: unknown) => handler }));
vi.mock("utils/adminOnlyMiddleware", () => ({ default: (handler: unknown) => handler }));
vi.mock("lib/supabase/server", () => ({ default: { from: mocks.from } }));

import { loadPlanningInputs, pages, PlanningReadDeadlineError } from "lib/rosterScheduleData/planningInputs";

/** A Supabase-like builder: each `range()` page is served by `serve`, which may delay or never resolve. */
function builder(serve: (from: number, signal: AbortSignal) => Promise<{ data: unknown[]; count: number; error: null }>) {
  const signals: AbortSignal[] = [];
  const build = () => {
    let from = 0;
    const query: any = {
      range(start: number) { from = start; return query; },
      abortSignal(signal: AbortSignal) { signals.push(signal); return serve(from, signal); },
    };
    return query;
  };
  return { build, signals };
}
const rows = (start: number, n: number) => Array.from({ length: n }, (_, i) => ({ id: start + i + 1 }));
const never = () => new Promise<never>(() => undefined);

describe("C3 (d) planningInputs deadline primitives (sha256 8193aa5d, identical on origin/master)", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-25T12:30:20Z")); });
  afterEach(() => vi.useRealTimers());

  it("partial-page control: a stalled second page rejects at the deadline and returns no partial rows", async () => {
    const { build, signals } = builder(async from => from === 0 ? { data: rows(0, 1000), count: 1500, error: null } : never());
    const result = pages(build, Date.now() + 8000).then(() => "resolved", error => error);
    await vi.advanceTimersByTimeAsync(7999);
    expect(signals).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    const error = await result;
    expect(error).toBeInstanceOf(PlanningReadDeadlineError);
    expect((error as Error).message).toBe("Planning read deadline exceeded");
  });

  it("cancel control: the in-flight request's signal is aborted when the deadline fires", async () => {
    const { build, signals } = builder(() => never());
    const result = pages(build, Date.now() + 3000).catch(error => error);
    await vi.advanceTimersByTimeAsync(3000);
    expect(await result).toBeInstanceOf(PlanningReadDeadlineError);
    expect(signals[0].aborted).toBe(true);
  });

  it("control: a complete multi-page read inside the budget returns every row", async () => {
    const { build } = builder(async from => ({ data: rows(from, Math.min(1000, 1500 - from)), count: 1500, error: null }));
    await expect(pages(build, Date.now() + 8000)).resolves.toHaveLength(1500);
  });

  it("a deadline already spent by earlier work throws at entry without issuing any read", async () => {
    const { build, signals } = builder(async () => ({ data: [], count: 0, error: null }));
    const deadline = Date.now() + 45000;
    vi.setSystemTime(Date.now() + 95000); // a non-read stage (CPU build or upsert) that no deadline bounds
    await expect(pages(build, deadline)).rejects.toThrow("Planning read deadline exceeded");
    expect(signals).toHaveLength(0);
  });

  it("loadPlanningInputs takes a fresh 8 s budget instead of the caller's remaining budget", async () => {
    const reads: string[] = [];
    const db: any = { from: (table: string) => {
      const query: any = new Proxy({}, { get: (_t, prop) => prop === "abortSignal"
        ? () => { reads.push(table); return Promise.resolve({ data: [], count: 0, error: null }); }
        : () => query });
      return query;
    } };
    vi.setSystemTime(Date.now() + 120000); // the snapshot route's own 45 s deadline would be long gone here
    await loadPlanningInputs(db, { seasonId: 20262027, startDate: "2026-10-25", endDate: "2026-10-25", timeZone: "America/New_York" }, new Date());
    expect(reads.sort()).toEqual(["fhfh_player_identities", "roster_optimizer_team_games", "rosters", "teams"]);
  });
});

describe("C3 (d) snapshot route: the 500 names no stage; the proposed patch does", () => {
  const dayGames = [{ id: 2026020186, date: "2026-10-25", seasonId: 20262027, startTime: "2026-10-25T23:00:00Z", homeTeamId: 1, awayTeamId: 2 }];

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-25T12:30:20Z"));
    mocks.from.mockImplementation((table: string) => {
      const query: any = new Proxy({}, { get: (_t, prop) => prop === "abortSignal"
        ? () => Promise.resolve({ data: table === "games" ? dayGames : [], count: table === "games" ? 1 : 0, error: null })
        : () => query });
      return query;
    });
    // Planning inputs return normally but slowly: 95 s of the route's fixed 45 s budget (e.g. a degraded database).
    vi.doMock("lib/rosterScheduleData/planningInputs", async (importOriginal) => ({
      ...await importOriginal<typeof import("lib/rosterScheduleData/planningInputs")>(),
      loadPlanningInputs: async () => { vi.setSystemTime(Date.now() + 95000); return { players: [], games: [], scheduleRows: [], scheduleProblems: [], evidence: {} }; },
    }));
  });
  afterEach(() => { vi.useRealTimers(); vi.doUnmock("lib/rosterScheduleData/planningInputs"); });

  async function call(path: string) {
    const handler = (await import(path)).default;
    const res: any = { statusCode: 200, body: null, setHeader: vi.fn(), status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; } };
    await handler({ method: "POST", query: { date: "2026-10-25" }, headers: {} }, res);
    return res;
  }

  it("released route reproduces the email text with no indication of which stage spent the budget", async () => {
    const res = await call("pages/api/v1/db/forge-served-forecast-snapshot");
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ success: false, date: "2026-10-25", error: "Planning read deadline exceeded" });
    expect(mocks.from.mock.calls.map(([table]) => table)).not.toContain("forge_served_forecast_ledger");
  });

  it("PROPOSED patch (unapplied): same failure and no writes, plus the throwing stage and per-stage elapsed time", async () => {
    const res = await call("../patched/forge-served-forecast-snapshot");
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ success: false, error: "Planning read deadline exceeded", stage: "forge_bridge" });
    expect(res.body.stageMs).toEqual({ day_games: 0, planning_inputs: 95000, forge_bridge: 0 });
    expect(mocks.from.mock.calls.map(([table]) => table)).not.toContain("forge_served_forecast_ledger");
  });
});
