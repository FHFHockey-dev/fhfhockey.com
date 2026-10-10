import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { state, getCurrentSeasonMock, fetchMock } = vi.hoisted(() => ({
  state: {
    latestDate: "2026-10-07",
    setupMs: 0,
    upsertMs: {} as Record<string, number>,
    emptyCurrent: false,
    failureScope: "" as "" | "date" | "current",
    stored: {} as Record<string, Record<string, unknown>[]>,
    upserts: [] as { table: string; rows: Record<string, unknown>[]; conflict: string }[],
  },
  getCurrentSeasonMock: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock("utils/adminOnlyMiddleware", () => ({ default: (handler: unknown) => handler }));
vi.mock("lib/cron/withCronJobAudit", () => ({ withCronJobAudit: (handler: unknown) => handler }));
vi.mock("lib/NHL/server", () => ({ getCurrentSeason: getCurrentSeasonMock }));

import handler from "../../../../pages/api/Teams/nst-team-stats";

const NOW = Date.parse("2026-10-09T10:55:00Z");
const DAILY = ["nst_team_all", "nst_team_5v5", "nst_team_pp", "nst_team_pk"];
const season = {
  seasonId: 20262027,
  lastSeasonId: 20252026,
  regularSeasonStartDate: "2026-09-29",
  seasonEndDate: "2027-06-10",
};
const sourceRow = {
  Team: "Utah Mammoth", GP: "2", TOI: "120:00", W: "1", L: "1", OTL: "0", Points: "2",
  CF: "80", CA: "70", FF: "60", FA: "50", SF: "40", SA: "38", GF: "4", GA: "3", xGF: "5.5", xGA: "4.2",
  SCF: "20", SCA: "18", HDCF: "10", HDCA: "9", HDSF: "8", HDSA: "7", HDGF: "2", HDGA: "1",
  CFPct: null, FFPct: null, SFPct: null, GFPct: null, xGFPct: null, SCFPct: null,
  HDCFPct: null, HDSFPct: null, HDGFPct: null, SHPct: null, SVPct: null, PDO: "100",
};

function createDatabase() {
  return {
    from(table: string) {
      let from = "2026-09-29";
      let to = state.latestDate;
      const query = {
        select: () => query,
        order: () => query,
        limit: () => query,
        gte(column: string, value: string) { if (column === "date") from = value; return query; },
        lte(column: string, value: string) { if (column === "date") to = value < to ? value : to; return query; },
        maybeSingle: async () => ({ data: table === "seasons" ? { id: season.seasonId } : { date: state.latestDate }, error: null }),
        then(resolve: (value: unknown) => unknown) {
          if (table === "seasons") return Promise.resolve({ data: [{ id: season.seasonId, startDate: season.regularSeasonStartDate, endDate: season.seasonEndDate }], error: null }).then(resolve);
          const dates = [];
          for (let date = from; date <= to && date <= state.latestDate;) {
            dates.push({ date });
            date = new Date(Date.parse(date + "T00:00:00Z") + 86_400_000).toISOString().slice(0, 10);
          }
          return Promise.resolve({ data: dates, error: null }).then(resolve);
        },
        async upsert(rows: Record<string, unknown>[], options: { onConflict: string }) {
          state.upserts.push({ table, rows, conflict: options.onConflict });
          state.stored[table] = rows;
          vi.setSystemTime(Date.now() + (state.upsertMs[table] ?? 0));
          return { error: null };
        },
      };
      return query;
    },
  };
}

async function run(query: Record<string, string> = {}) {
  const res = {
    statusCode: 200,
    body: null as Record<string, unknown> | null,
    status(code: number) { this.statusCode = code; return this; },
    json(body: Record<string, unknown>) { this.body = body; return this; },
  };
  const pending = handler({ query, supabase: createDatabase() } as never, res as never);
  await vi.runAllTimersAsync();
  await pending;
  return res;
}

const requests = () => fetchMock.mock.calls.map(([url]) => new URL(url));
const currentRequests = () => requests().filter((url) => !url.searchParams.has("fd") && url.searchParams.get("from_season") === "20262027");
const lastRequests = () => requests().filter((url) => !url.searchParams.has("fd") && url.searchParams.get("from_season") === "20252026");

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  state.latestDate = "2026-10-07";
  state.setupMs = 0;
  state.upsertMs = {};
  state.emptyCurrent = false;
  state.failureScope = "";
  state.stored = {};
  state.upserts = [];
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", fetchMock);
  getCurrentSeasonMock.mockImplementation(async () => {
    vi.setSystemTime(NOW + state.setupMs);
    return season;
  });
  fetchMock.mockImplementation(async (value: string) => {
    const params = new URL(value).searchParams;
    const current = !params.has("fd") && params.get("from_season") === "20262027";
    const failed = state.failureScope === "date" ? params.has("fd") : state.failureScope === "current" && current;
    return {
      ok: !failed,
      status: failed ? 503 : 200,
      text: async () => JSON.stringify(failed ? { error: { code: "missing_key" } } : {
        data: state.emptyCurrent && current ? [] : [{ ...sourceRow, situation: params.get("sit") }],
      }),
    };
  });
});

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("NST team stats current-season refresh", () => {
  it("refreshes the current season for the October 9 yesterday/today backlog without refreshing last season", async () => {
    const res = await run();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ processedDates: ["2026-10-08"], remainingDates: ["2026-10-09"], ranSeasonTables: true, failedRequests: 0 });
    expect(currentRequests()).toHaveLength(1);
    expect(lastRequests()).toHaveLength(0);
    expect(state.upserts.map(({ table }) => table)).toEqual([...DAILY, "nst_team_stats"]);
    expect(state.upserts.at(-1)).toMatchObject({ conflict: "team_abbreviation,season", rows: [{ team_abbreviation: "UTA", season: "20262027", situation: "all", gp: 2, points: 2, xgf: 5.5, xga: 4.2, toi: 7200 }] });
    expect(res.body?.nstRequestPlan).toMatchObject({ seasonRequestCount: 1 });
    expect(Object.fromEntries(currentRequests()[0].searchParams)).toEqual({ sit: "all", rate: "n", from_season: "20262027", thru_season: "20262027", stype: "2", score: "all", team: "all", loc: "B", gpf: "410" });
  });

  it("keeps the one-date cap and safe request plan for a longer backlog while refreshing current totals", async () => {
    state.latestDate = "2026-09-28";
    const res = await run();
    expect(res.body).toMatchObject({ processedDates: ["2026-09-29"], remainingDatesCount: 10, nextStartDate: "2026-09-30", ranSeasonTables: true });
    expect(requests().filter((url) => url.searchParams.has("fd"))).toHaveLength(4);
    expect(currentRequests()).toHaveLength(1);
    expect(lastRequests()).toHaveLength(0);
    expect(res.body?.nstRequestPlan).toMatchObject({ seasonRequestCount: 1, burstAllowed: false, requestIntervalMs: 21_000 });
  });

  it("reaches the existing season configurations when all daily dates are already current", async () => {
    state.latestDate = "2026-10-09";
    const res = await run();
    expect(res.body).toMatchObject({ processedDates: [], remainingDates: [], complete: true, ranSeasonTables: true });
    expect(state.upserts.map(({ table }) => table)).toEqual(["nst_team_stats", "nst_team_stats_ly"]);
    expect(currentRequests()).toHaveLength(1);
    expect(lastRequests()).toHaveLength(1);
  });

  it.each([
    [{ startDate: "2026-10-08" }, "2026-10-08", { nextStartDate: "2026-10-09", nextEndDate: null }],
    [{ startDate: "2026-10-07", endDate: "2026-10-08" }, "2026-10-08", { nextStartDate: null, nextEndDate: "2026-10-07" }],
  ])("keeps manual mode %j date-only and preserves its cursor", async (query, date, cursor) => {
    const res = await run(query);
    expect(res.body).toMatchObject({ processedDates: [date], ranSeasonTables: false, ...cursor });
    expect(state.upserts.map(({ table }) => table)).toEqual(DAILY);
    expect(requests()).toHaveLength(4);
  });

  it("preserves a single-date run's current and last-season source parameters and conflict keys", async () => {
    const res = await run({ date: "2026-10-08" });
    expect(res.body).toMatchObject({ processedDates: ["2026-10-08"], remainingDates: [], ranSeasonTables: true });
    expect(state.upserts.map(({ table }) => table)).toEqual([...DAILY, "nst_team_stats", "nst_team_stats_ly"]);
    expect(lastRequests()[0].searchParams.get("thru_season")).toBe("20252026");
    expect(state.upserts.slice(0, 4).every(({ conflict }) => conflict === "team_abbreviation,date")).toBe(true);
    expect(state.upserts.slice(4).every(({ conflict }) => conflict === "team_abbreviation,season")).toBe(true);
  });

  it("reserves current-season budget by deferring the daily batch without expanding last-season eligibility", async () => {
    state.setupMs = 16_000;
    const res = await run({ date: "2026-10-08" });
    expect(res.body).toMatchObject({ processedDates: [], remainingDates: ["2026-10-08"], ranSeasonTables: true });
    expect(state.upserts.map(({ table }) => table)).toEqual(["nst_team_stats"]);
    expect(currentRequests()).toHaveLength(1);
    expect(lastRequests()).toHaveLength(0);
  });

  it("rechecks the remaining budget after daily work instead of using the initial season decision", async () => {
    state.upsertMs = Object.fromEntries(DAILY.map((table) => [table, 60_000]));
    const res = await run({ date: "2026-10-08" });
    expect(res.body?.ranSeasonTables).toBe(false);
    expect(state.upserts.map(({ table }) => table)).toEqual(DAILY);
    expect(currentRequests()).toHaveLength(0);
    expect(lastRequests()).toHaveLength(0);
  });

  it("rechecks the budget between current and last-season requests", async () => {
    state.latestDate = "2026-10-09";
    state.upsertMs.nst_team_stats = 240_000;
    const res = await run();
    expect(res.body?.ranSeasonTables).toBe(true);
    expect(currentRequests()).toHaveLength(1);
    expect(lastRequests()).toHaveLength(0);
    expect(state.upserts.map(({ table }) => table)).toEqual(["nst_team_stats"]);
  });

  it("makes no requests when even the current-season budget is exhausted", async () => {
    state.setupMs = 240_000;
    const res = await run();
    expect(res.body).toMatchObject({ processedDates: [], remainingDates: ["2026-10-08", "2026-10-09"], ranSeasonTables: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.upserts).toEqual([]);
  });

  it("stops after a fatal daily configuration failure without trying either season", async () => {
    state.failureScope = "date";
    const res = await run({ date: "2026-10-08" });
    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ remainingDates: ["2026-10-08"], ranSeasonTables: false, failedRequests: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(state.upserts).toEqual([]);
  });

  it("stops after a fatal current-season configuration failure without trying last season", async () => {
    state.latestDate = "2026-10-09";
    state.failureScope = "current";
    const res = await run();
    expect(res.statusCode).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(lastRequests()).toHaveLength(0);
    expect(state.upserts).toEqual([]);
  });

  it("keeps an empty current-season source as a truthful skip without replacing stored totals", async () => {
    state.emptyCurrent = true;
    const before = [{ team_abbreviation: "UTA", season: "20262027", gp: 5 }];
    state.stored.nst_team_stats = before;
    const res = await run();
    expect(res.body).toMatchObject({ ranSeasonTables: true, skips: [{ scope: "season", table: "nst_team_stats", season: 20262027, reason: "empty_source" }] });
    expect(res.body?.processedTables).not.toContain("nst_team_stats:20262027");
    expect(state.stored.nst_team_stats).toEqual(before);
    expect(state.upserts.map(({ table }) => table)).toEqual(DAILY);
  });
});
