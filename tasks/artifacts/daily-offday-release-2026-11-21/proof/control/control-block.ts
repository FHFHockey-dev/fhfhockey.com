
// ---- Scratch control (off-day proof, 2026-11-21): nonempty stored slate, real handler, no network ----
import { readFileSync as __readFileSync, writeFileSync as __writeFileSync } from "node:fs";
const __GAMES: Array<Record<string, unknown>> = JSON.parse(__readFileSync(process.env.CONTROL_GAMES_JSON!, "utf8"));
const __OUT = process.env.CONTROL_OUT_JSON!;
const __results: Record<string, unknown> = {};

describe("CONTROL nonempty NST plan", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unexpected outbound fetch in offline NST test")));
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.seasons = [
      { id: 20252026, startDate: "2025-10-07", endDate: "2026-06-25" },
      { id: 20262027, startDate: "2026-10-06", endDate: "2027-06-25" }
    ];
    db.tables = {}; db.queries = []; db.audits = [];
    db.auditReadError = false; db.auditWriteFailure = ""; db.auditWriteCalls = 0; db.auditProbe = null;
    db.upsertPlan = []; db.upsertCalls = [];
    fetchCurrentSeasonMock.mockReset().mockResolvedValue({
      id: 20262027, startDate: "2026-10-06", regularSeasonEndDate: "2027-04-15", endDate: "2027-06-25"
    });
    fetchNstTextByUrlMock.mockReset().mockResolvedValue({ text: "<body>No skaters found</body>", response: { status: 200 } });
  });
  afterEach(() => {
    vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
    __writeFileSync(__OUT, JSON.stringify(__results, null, 2));
  });

  async function run(query: Record<string, string>) {
    const res = {
      statusCode: 200, body: null as any,
      status(code: number) { this.statusCode = code; return this; },
      json(body: unknown) { this.body = body; return this; }
    };
    const pending = handler({ method: "GET", query, body: {}, headers: {} } as any, res as any);
    await vi.runAllTimersAsync();
    await pending;
    await vi.advanceTimersByTimeAsync(1);
    return res;
  }

  const cases: Array<[string, string, string, boolean]> = [
    // [label, source date, wall clock, pass the pipeline's deadlineAt]
    ["2026-11-19 pipeline query (deadlineAt)", "2026-11-19", "2026-11-20T10:05:31Z", true],
    ["2026-11-19 full plan (no deadline)", "2026-11-19", "2026-11-20T10:05:31Z", false],
    ["2026-11-21 stored slate, games not started", "2026-11-21", "2026-11-21T10:05:31Z", true],
  ];
  it.each(cases)("%s", async (label, date, now, withDeadline) => {
    vi.setSystemTime(new Date(now));
    db.games = __GAMES.filter((g) => g.date === date).map((g) => ({ ...g }));
    const query: Record<string, string> = { runMode: "incremental", startDate: date, endDate: date };
    // run-rolling-forge-pipeline: invocation start + 180 s budget - 20 s headroom.
    if (withDeadline) query.deadlineAt = String(Date.parse(now) + 160_000);
    const result = await run(query);
    const fetchMock = vi.mocked(fetch);
    const p = result.body?.nstProgress ?? {};
    __results[label] = {
      query,
      storedGames: db.games.length,
      statusCode: result.statusCode,
      success: result.body?.success,
      operationStatus: result.body?.operationStatus,
      nstState: p.state,
      plannedRequestCount: p.plannedRequestCount,
      networkAttempts: p.networkAttempts,
      missingScheduleDates: p.missingScheduleDates,
      verifiedOffDates: p.verifiedOffDates ?? "(field absent)",
      skippedUnstartedDates: p.skippedUnstartedDates,
      continuation: p.continuation,
      nstUrls: fetchNstTextByUrlMock.mock.calls.map(([url]) => url),
      globalFetchCalls: fetchMock.mock.calls.map(([url]) => String(url)),
      scheduleFallbackCalls: fetchMock.mock.calls.filter(([url]) => String(url).includes("api-web.nhle.com/v1/schedule")).length
    };
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/v1/schedule/")).length).toBe(0);
  });
});
