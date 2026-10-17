import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { db, fetchNstTextByUrlMock, fetchCurrentSeasonMock } = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  return {
    db: {
      seasons: [] as any[],
      games: [] as any[],
      tables: {} as Record<string, any[]>,
      queries: [] as Array<{ table: string; filters: Array<[string, string, any]> }>,
      audits: [] as any[],
      auditReadError: false,
      auditWriteFailure: "",
      auditWriteCalls: 0,
      upsertPlan: [] as Array<{ result?: any; reject?: string; commit?: boolean }>,
      upsertCalls: [] as Array<{ table: string; rows: any[] }>
    },
    fetchNstTextByUrlMock: vi.fn(),
    fetchCurrentSeasonMock: vi.fn()
  };
});

vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));
vi.mock("utils/adminOnlyMiddleware", () => ({ default: (handler: unknown) => handler }));
vi.mock("utils/fetchCurrentSeason", () => ({ fetchCurrentSeason: fetchCurrentSeasonMock }));
vi.mock("lib/nst/client", async (importOriginal) => ({
  ...await importOriginal<typeof import("lib/nst/client")>(),
  fetchNstTextByUrl: fetchNstTextByUrlMock
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from(table: string) {
      const query = { table, filters: [] as Array<[string, string, any]> };
      db.queries.push(query);
      let limit: number | undefined;
      let descending = false;
      let orderColumn = "";
      const result = () => {
        if (table === "cron_job_audit" && db.auditReadError) return { data: null, error: { message: "read unavailable" } };
        let rows = [...(table === "seasons" ? db.seasons : table === "games" ? db.games
          : table === "cron_job_audit" ? db.audits : db.tables[table] ?? [])];
        for (const [op, column, value] of query.filters) {
          rows = rows.filter((row) => {
            const field = column.replace(/->>?/g, ".").split(".").reduce((current, key) => current?.[key], row);
            return op === "gte" ? field >= value : op === "lte" ? field <= value
              : op === "in" ? value.includes(field) : field === value;
          });
        }
        if (orderColumn) rows.sort((a, b) =>
          (a[orderColumn] < b[orderColumn] ? -1 : a[orderColumn] > b[orderColumn] ? 1 : 0) * (descending ? -1 : 1));
        return { data: limit === undefined ? rows : rows.slice(0, limit), error: null };
      };
      const builder: any = {
        select: () => builder,
        order(column: string, options: { ascending: boolean }) {
          orderColumn = column;
          descending = !options.ascending;
          return builder;
        },
        gte(column: string, value: any) { query.filters.push(["gte", column, value]); return builder; },
        lte(column: string, value: any) { query.filters.push(["lte", column, value]); return builder; },
        eq(column: string, value: any) { query.filters.push(["eq", column, value]); return builder; },
        in(column: string, value: any) { query.filters.push(["in", column, value]); return builder; },
        limit(value: number) { limit = value; return builder; },
        range: () => builder,
        maybeSingle: async () => ({ data: result().data?.[0] ?? null, error: null }),
        insert(rows: any[]) {
          db.auditWriteCalls++;
          if (db.auditWriteFailure !== "error" && db.auditWriteFailure !== "transport") {
            db.audits.push(...rows.map((row) => ({ ...row, run_time: new Date().toISOString() })));
          }
          if (db.auditWriteFailure === "error") return Promise.resolve({ error: { message: "insert rejected" } });
          if (db.auditWriteFailure === "transport" || db.auditWriteFailure === "lost_ack") return Promise.reject(new Error("transport lost"));
          if (db.auditWriteFailure === "malformed_ack") return Promise.resolve({});
          return Promise.resolve({ error: null });
        },
        upsert(rows: any[]) {
          db.upsertCalls.push({ table, rows });
          const plan = db.upsertPlan.shift();
          if (!plan || plan.commit || plan.result?.error === null) {
            const stored = db.tables[table] ?? [];
            for (const row of rows) {
              const index = stored.findIndex((existing) => existing.player_id === row.player_id && existing.date_scraped === row.date_scraped);
              if (index < 0) stored.push({ ...row }); else stored[index] = { ...row };
            }
            db.tables[table] = stored;
          }
          if (plan?.reject) return Promise.reject(new Error(plan.reject));
          if (plan) return Promise.resolve(plan.result);
          return Promise.resolve({ error: null, count: rows.length });
        },
        then(resolve: (value: unknown) => unknown) { return Promise.resolve(result()).then(resolve); }
      };
      return builder;
    }
  })
}));

import retainedNst from "../../../../fixtures/nst/oct1-identity-source.json";
import handler from "../../../../../pages/api/v1/db/update-nst-gamelog";
import { createNstFileBudgetStore, NstExecutionLimitError, withNstRequestBudget } from "../../../../../lib/nst/requestBudget";
import { NstResponseError } from "lib/nst/client";
import { fromZonedTime } from "date-fns-tz";
import {
  buildNstGamelogScope,
  NST_GAMELOG_BOOKMARK_TTL_MS,
  resolveNstGamelogBookmark,
  rotateNstGamelogQueue
} from "lib/nst/gamelogProgress";
import {
  NST_DATASET_GROUPS,
  buildNstScheduledDateMap,
  buildNstStatusUrl,
  filterReverseSeasonsForHistoricalDatedNst,
  getPlayerCacheCandidates,
  getNstPlayerIdFromHref,
  getDatesBetween,
  normalizeTargetDates,
  parseDatesParam,
  resolveNstSeasonTypeForGameType,
  resolveMappedPlayerName,
  shouldBlockHistoricalDatedNstRequest,
  type PlayerCacheRow
} from "../../../../../pages/api/v1/db/update-nst-gamelog";

describe("update-nst-gamelog request scoping", () => {
  it("normalizes comma-separated exact dates for targeted backfills", () => {
    expect(
      parseDatesParam([
        "2026-04-12, 2026-01-12",
        "2026-04-12",
        "2026-03-07"
      ])
    ).toEqual(["2026-01-12", "2026-03-07", "2026-04-12"]);
  });

  it("rejects malformed targeted backfill dates", () => {
    expect(() => normalizeTargetDates(["2026-04-12", "2026/04/13"])).toThrow(
      "dates must be YYYY-MM-DD"
    );
  });

  it("exposes bounded dataset groups for ranking freshness backfills", () => {
    expect(NST_DATASET_GROUPS.allStrengths).toEqual([
      "allStrengthsCounts",
      "allStrengthsRates",
      "allStrengthsCountsOi",
      "allStrengthsRatesOi"
    ]);
    expect(NST_DATASET_GROUPS.powerPlay).toEqual([
      "powerPlayCounts",
      "powerPlayRates",
      "powerPlayCountsOi",
      "powerPlayRatesOi"
    ]);
    expect(NST_DATASET_GROUPS.rankingFreshnessSkaterSources).toEqual([
      ...NST_DATASET_GROUPS.allStrengths,
      "evenStrengthCounts",
      "evenStrengthRates",
      "evenStrengthCountsOi",
      "evenStrengthRatesOi",
      ...NST_DATASET_GROUPS.powerPlay,
      "penaltyKillCounts",
      "penaltyKillRates",
      "penaltyKillCountsOi",
      "penaltyKillRatesOi"
    ]);
  });

  it("matches NST hyphenated player names against normalized player cache keys", () => {
    const cache = new Map<string, PlayerCacheRow[]>([
      ["vikinggustafssonnyberg", [{ id: 8486166, position: "D" }]]
    ]);

    expect(getPlayerCacheCandidates(cache, "Viking Gustafsson-Nyberg")).toEqual([
      { id: 8486166, position: "D" }
    ]);
  });

  it("maps NST nickname variants to canonical player names", () => {
    expect(resolveMappedPlayerName("Freddy Gaudreau")).toBe(
      "Frederick Gaudreau"
    );
    expect(resolveMappedPlayerName("Frederic Gaudreau")).toBe(
      "Frederick Gaudreau"
    );
  });

  it("maps only the verified exact Josh Mahura spelling", () => {
    expect(resolveMappedPlayerName("Josh Mahura")).toBe("Joshua Mahura");
    expect(resolveMappedPlayerName("Josh Example")).toBe("Josh Example");
    expect(resolveMappedPlayerName("Joshua Mahura")).toBe("Joshua Mahura");
  });

  it("accepts only an NST playerreport link with one valid NHL player ID", () => {
    expect(getNstPlayerIdFromHref("playerreport.php?playerid=8481559&sit=all")).toBe(8481559);
    for (const href of ["https://example.com/playerreport.php?playerid=8481559", "playerreport.php?playerid=8481559&playerid=8483456", "playerreport.php?playerid=oops", "playerteams.php?playerid=8481559"]) {
      expect(getNstPlayerIdFromHref(href)).toBeNull();
    }
  });

  it("maps only the exact Joseph Veleno alias without changing other Joseph or Joe names", () => {
    expect(resolveMappedPlayerName("Joseph Veleno")).toBe("Joe Veleno");
    for (const name of ["Joe Veleno", "Joseph Woll", "Joe Pavelski", "Joseph Example", "Joseph Veleno Jr."]) {
      expect(resolveMappedPlayerName(name)).toBe(name);
    }
  });

  it("builds a single authenticated-status diagnostic URL from route params", () => {
    const diagnostic = buildNstStatusUrl({
      date: "2025-10-07",
      datasetGroup: "fiveOnFive"
    });

    expect(diagnostic).toMatchObject({
      date: "2025-10-07",
      seasonId: "20252026",
      datasetType: "fiveOnFiveRates",
      source: "constructed"
    });
    expect(diagnostic.url).toContain("sit=5v5");
    expect(diagnostic.url).toContain("rate=y");
    expect(diagnostic.url).toContain("fromseason=20252026");
    expect(new URL(diagnostic.url).searchParams.get("fd")).toBe("2025-10-07");
    expect(diagnostic.url).not.toContain("key=");
  });

  it("matches the NST daily date-filtered counts URL contract", () => {
    const diagnostic = buildNstStatusUrl({
      date: "2025-04-16",
      seasonId: "20242025",
      datasetType: "fiveOnFiveCounts"
    });

    const url = new URL(diagnostic.url);
    expect(url.origin + url.pathname).toBe(
      "https://data.naturalstattrick.com/playerteams.php"
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      sit: "5v5",
      score: "all",
      stdoi: "std",
      rate: "n",
      team: "ALL",
      fromseason: "20242025",
      thruseason: "20242025",
      stype: "2",
      pos: "S",
      loc: "B",
      toi: "0",
      gpfilt: "gpdate",
      fd: "2025-04-16",
      td: "2025-04-16",
      lines: "single",
      draftteam: "ALL",
      tgp: "410"
    });
  });

  it("accepts a custom diagnostic NST URL without requiring browser-visible keys", () => {
    const diagnostic = buildNstStatusUrl({
      testUrl:
        "https://data.naturalstattrick.com/playerteams.php?sit=5v5&fromseason=20242025&fd=2025-04-17&td=2025-04-17"
    });

    expect(diagnostic).toMatchObject({
      date: "2025-04-17",
      seasonId: "20242025",
      datasetType: "custom",
      source: "testUrl"
    });
  });

  it("maps NHL game types to NST stype values", () => {
    expect(resolveNstSeasonTypeForGameType(1)).toBe("1");
    expect(resolveNstSeasonTypeForGameType(2)).toBe("2");
    expect(resolveNstSeasonTypeForGameType(3)).toBe("3");
    expect(resolveNstSeasonTypeForGameType(4)).toBeNull();
    expect(resolveNstSeasonTypeForGameType(null)).toBeNull();
  });

  it("builds the NST scheduled-date aperture from actual game rows", () => {
    const scheduled = buildNstScheduledDateMap([
      { date: "2025-09-22", seasonId: 20252026, type: 1 },
      { date: "2025-10-07", seasonId: 20252026, type: 2 },
      { date: "2026-04-19", seasonId: 20252026, type: 3 },
      { date: "2026-06-30", seasonId: 20252026, type: 4 },
      { date: "2026-07-01", seasonId: 20252026, type: null }
    ]);

    expect(Array.from(scheduled.keys())).toEqual([
      "2025-09-22",
      "2025-10-07",
      "2026-04-19"
    ]);
    expect(scheduled.get("2025-09-22")).toMatchObject({
      seasonId: "20252026",
      gameType: 1,
      stype: "1"
    });
    expect(scheduled.get("2026-04-19")).toMatchObject({
      seasonId: "20252026",
      gameType: 3,
      stype: "3"
    });
  });

  it("uses explicit diagnostic stype for preseason and playoff status checks", () => {
    const preseason = buildNstStatusUrl({
      date: "2025-09-22",
      seasonId: "20252026",
      datasetType: "fiveOnFiveRates",
      stype: "1"
    });
    const playoffs = buildNstStatusUrl({
      date: "2026-04-19",
      seasonId: "20252026",
      datasetType: "fiveOnFiveRates",
      gameType: "3"
    });

    expect(preseason.url).toContain("stype=1");
    expect(playoffs.url).toContain("stype=3");
  });

  it("blocks prior-season dated NST backfills unless explicitly allowed", () => {
    expect(
      shouldBlockHistoricalDatedNstRequest({
        requestedStartDate: "2025-04-17",
        currentSeasonStartDate: "2025-10-07"
      })
    ).toBe(true);
    expect(
      shouldBlockHistoricalDatedNstRequest({
        requestedStartDate: "2025-04-17",
        currentSeasonStartDate: "2025-10-07",
        allowHistoricalDatedRequests: true
      })
    ).toBe(false);
    expect(
      shouldBlockHistoricalDatedNstRequest({
        requestedStartDate: "2025-10-07",
        currentSeasonStartDate: "2025-10-07"
      })
    ).toBe(false);
  });

  it("limits reverse NST date-filtered backfills to the current season by default", () => {
    const seasons = [
      { id: 20252026, startDate: "2025-10-07" },
      { id: 20242025, startDate: "2024-10-04" },
      { id: 20232024, startDate: "2023-10-10" }
    ];

    expect(
      filterReverseSeasonsForHistoricalDatedNst(seasons, "20252026")
    ).toEqual([{ id: 20252026, startDate: "2025-10-07" }]);
    expect(
      filterReverseSeasonsForHistoricalDatedNst(seasons, "20252026", true)
    ).toEqual(seasons);
  });
});

describe("update-nst-gamelog automatic season cursor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T07:25:38Z"));
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.seasons = [
      { id: 20252026, startDate: "2025-10-07", endDate: "2026-06-25" },
      { id: 20262027, startDate: "2026-09-29", endDate: "2027-06-25" },
      { id: 20272028, startDate: "2027-10-01", endDate: "2028-06-25" }
    ];
    db.games = [
      { date: "2026-04-03", seasonId: 20252026, type: 2 },
      { date: "2026-09-29", seasonId: 20262027, type: 2 },
      { date: "2026-10-02", seasonId: 20262027, type: 2 },
      { date: "2026-10-03", seasonId: 20262027, type: 2 }
    ];
    db.tables = {};
    db.queries = [];
    db.audits = [];
    db.auditReadError = false;
    db.auditWriteFailure = "";
    db.auditWriteCalls = 0;
    db.upsertPlan = [];
    db.upsertCalls = [];
    fetchCurrentSeasonMock.mockReset().mockResolvedValue({
      id: 20262027, startDate: "2026-09-29", regularSeasonEndDate: "2027-04-17", endDate: "2027-06-25"
    });
    fetchNstTextByUrlMock.mockReset().mockResolvedValue({
      text: "<body>No skaters found</body>", response: { status: 200 }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function run(query: Record<string, string> = {}, method = "GET") {
    const res = {
      statusCode: 200, body: null as any,
      status(code: number) { this.statusCode = code; return this; },
      json(body: unknown) { this.body = body; return this; }
    };
    const pending = handler({ method, query: method === "GET" ? query : {},
      body: method === "POST" ? query : {}, headers: {} } as any, res as any);
    await vi.runAllTimersAsync();
    await pending;
    // The network mock has no elapsed time; preserve distinct audit timestamps.
    await vi.advanceTimersByTimeAsync(1);
    return res;
  }

  function fetchedDates() {
    return fetchNstTextByUrlMock.mock.calls.map(([url]) => new URL(url).searchParams.get("fd"));
  }

  function supplyThreePlayerRows() {
    db.tables.players = Array.from({ length: 3 }, (_, i) => ({ id: i + 1, fullName: `Test Player ${i}`, position: "C" }));
    fetchNstTextByUrlMock.mockResolvedValue({ response: { status: 200 }, text:
      `<table><thead><tr><th>Player</th><th>Team</th><th>Position</th><th>TOI</th></tr></thead><tbody>${
        db.tables.players.map((player) => `<tr><td>${player.fullName}</td><td>BOS</td><td>C</td><td>10:00</td></tr>`).join("")
      }</tbody></table>` });
  }

  it.each(["timeout", "lost_ack", "malformed_ack", "null_ack"])(
    "stops after ambiguous %s batch acknowledgement without replaying rows or the source", async (failure) => {
      supplyThreePlayerRows();
      db.upsertPlan = [failure === "lost_ack" ? { reject: "transport lost", commit: true }
        : { result: failure === "timeout" ? { error: { message: "AbortError: timed out", code: "" }, count: null }
          : failure === "null_ack" ? null : {}, commit: true },
        { result: { error: null, count: 1 } }, { result: { error: { code: "23514", message: "row rejected" } } }];
      const res = await run({ dates: "2026-10-03", datasetType: "fiveOnFiveCounts" });
      expect(res.statusCode).toBe(500);
      expect(res.body.writePersistence).toBe("not_confirmed");
      expect(res.body.confirmedRowsAffected).toBe(0);
      expect(res.body.error).toContain("Do not automatically rerun");
      expect(db.upsertCalls).toHaveLength(1);
      expect(db.tables.nst_gamelog_5v5_counts).toHaveLength(3);
      expect(fetchNstTextByUrlMock).toHaveBeenCalledTimes(1);
      expect(db.audits[0].rows_affected).toBe(0);
      expect(db.audits[0].details.writePersistence).toBe("not_confirmed");
    }
  );

  it("preserves confirmed rows from an earlier source and definitive row fallback before rejection", async () => {
    supplyThreePlayerRows();
    db.upsertPlan = [{ result: { error: null, count: 3 } },
      { result: { error: { code: "23514", message: "batch constraint rejected" } } },
      { result: { error: null, count: 1 } },
      { result: { error: { code: "23514", message: "row constraint rejected" } } }];
    const res = await run({ dates: "2026-10-02,2026-10-03", datasetType: "fiveOnFiveCounts" });
    expect(res.statusCode).toBe(500);
    expect(res.body.writePersistence).toBe("rejected");
    expect(res.body.confirmedRowsAffected).toBe(4);
    expect(db.upsertCalls).toHaveLength(4);
    expect(db.tables.nst_gamelog_5v5_counts).toHaveLength(4);
    expect(fetchNstTextByUrlMock).toHaveBeenCalledTimes(2);
    expect(db.audits[0].rows_affected).toBe(4);
    expect(db.audits[0].details.sourceItem.date).toBe("2026-10-03");
  });

  it("preserves confirmed partial rows when a subsequent row loses its commit acknowledgement", async () => {
    supplyThreePlayerRows();
    db.upsertPlan = [{ result: { error: { code: "23514", message: "batch rejected" } } },
      { result: { error: null, count: 1 } }, { reject: "row acknowledgement lost", commit: true }];
    const res = await run({ dates: "2026-10-03", datasetType: "fiveOnFiveCounts" });
    expect(res.statusCode).toBe(500);
    expect(res.body.writePersistence).toBe("not_confirmed");
    expect(res.body.confirmedRowsAffected).toBe(1);
    expect(db.upsertCalls).toHaveLength(3);
    expect(db.tables.nst_gamelog_5v5_counts).toHaveLength(2);
    expect(db.audits[0].rows_affected).toBe(1);
    expect(fetchNstTextByUrlMock).toHaveBeenCalledTimes(1);
  });

  it("keeps separate status diagnostics at least 21 seconds apart without granting burst admission", async () => {
    const directory = mkdtempSync(join(tmpdir(), "nst-diagnostic-test-"));
    const starts: number[] = [];
    const store = createNstFileBudgetStore(directory);
    try {
      fetchNstTextByUrlMock.mockImplementation((url, options) => withNstRequestBudget(url, options.requestControl, async () => {
        starts.push(Date.now());
        return { text: "<table></table>", response: { status: 200 } };
      }, store));
      await run({ action: "nstStatus", date: "2026-10-03" });
      await run({ action: "nstStatus", date: "2026-10-03", bypassLocalWait: "yes" });
      expect(starts[1] - starts[0]).toBe(21_000);
      for (const [, options] of fetchNstTextByUrlMock.mock.calls) {
        expect(options.retries).toBe(0);
        expect(options.requestControl.minIntervalMs).toBe(21_000);
        expect(options.requestControl.maxAttempts).toBe(1);
      }
      expect(db.upsertCalls).toHaveLength(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("caps actual network attempts across both initial and failed-item retry passes", async () => {
    fetchNstTextByUrlMock.mockImplementation(async (_url, options) => {
      options.requestControl.attemptsStarted++;
      throw new Error("temporary provider failure");
    });
    const res = await run({ dates: "2026-10-03", datasetType: "fiveOnFiveCounts", maxRequests: "2" });
    expect(fetchNstTextByUrlMock).toHaveBeenCalledTimes(2);
    expect(fetchNstTextByUrlMock.mock.calls[0][1].requestControl).toBe(fetchNstTextByUrlMock.mock.calls[1][1].requestControl);
    expect(res.body.success).toBe(false);
    expect(res.body.nstProgress.networkAttempts).toBe(2);
    expect(res.body.nstProgress.stoppedEarly).toBe(true);
  });

  it("defers remaining source items when the network budget is exhausted", async () => {
    fetchNstTextByUrlMock.mockImplementation(async (_url, options) => {
      options.requestControl.attemptsStarted++;
      return { text: "<body>No skaters found</body>", response: { status: 200 } };
    });
    const res = await run({ dates: "2026-10-03", datasetGroup: "fiveOnFive", maxRequests: "2" }, "POST");
    expect(fetchNstTextByUrlMock).toHaveBeenCalledTimes(2);
    expect(res.body.nstProgress.deferredUrls).toBe(2);
    expect(res.body.nstProgress.stoppedEarly).toBe(true);
    expect(res.body.nstProgress.networkAttempts).toBe(2);
  });

  it("does not retry an admission deadline failure or report completion", async () => {
    fetchNstTextByUrlMock.mockRejectedValue(new NstExecutionLimitError("NST run deadline reached."));
    const res = await run({ dates: "2026-10-03", datasetType: "fiveOnFiveCounts" });
    expect(fetchNstTextByUrlMock).toHaveBeenCalledTimes(1);
    expect(res.body.success).toBe(false);
    expect(res.body.nstProgress.stoppedEarly).toBe(true);
    expect(res.body.nstProgress.deferredUrls).toBe(1);
  });

  it.each([["maxRequests", "41"], ["maxRequests", "0"], ["maxRuntimeMs", "220001"], ["maxRuntimeMs", "no"]])(
    "rejects invalid execution bounds before touching data: %s=%s", async (name, value) => {
      const res = await run({ [name]: value });
      expect(res.statusCode).toBe(500);
      expect(fetchNstTextByUrlMock).not.toHaveBeenCalled();
      expect(db.queries).toHaveLength(0);
    }
  );

  it("starts the default scheduled run in the current season when every cursor is historical", async () => {
    db.tables.nst_gamelog_as_counts = [{ date_scraped: "2026-04-02" }];
    const res = await run();
    expect(res.statusCode).toBe(200);
    // The existing strict six-request cap stops this unfiltered catch-up on its first date.
    expect(new Set(fetchedDates())).toEqual(new Set(["2026-09-29"]));
    expect(db.audits.at(-1).details.stoppedEarly).toBe(true);
    expect(db.audits.at(-1).details.urlsQueued).toBe(60);
    expect(db.queries.find((q) => q.table === "games")?.filters).toContainEqual(["gte", "date", "2026-09-29"]);
    expect(db.queries.find((q) => q.table === "games")?.filters).toContainEqual(["lte", "date", "2026-10-04"]);
    expect(fetchNstTextByUrlMock.mock.calls.every(([url]) =>
      new URL(url).searchParams.get("fromseason") === "20262027")).toBe(true);
  });

  it("resumes a partially populated date inclusively and ignores unrelated dataset cursors", async () => {
    db.tables.nst_gamelog_5v5_counts = [{ date_scraped: "2026-10-02" }];
    await run({ datasetType: "fiveOnFiveCounts" });
    // Earlier empty dates stay in the aperture even when a later row exists.
    expect(fetchedDates()).toEqual(["2026-09-29", "2026-10-02", "2026-10-03"]);
    expect(db.queries.some((q) => q.table === "nst_gamelog_as_counts")).toBe(false);
  });

  it("makes progress across repeated capped runs when provider rows are persisted and complete", async () => {
    db.tables.players = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1, fullName: `Test Player ${i}`, position: "C"
    }));
    fetchNstTextByUrlMock.mockResolvedValue({ response: { status: 200 }, text:
      `<table><thead><tr><th>Player</th><th>Team</th><th>Position</th><th>TOI</th></tr></thead><tbody>${
        db.tables.players.map((player) => `<tr><td>${player.fullName}</td><td>BOS</td><td>C</td><td>10:00</td></tr>`).join("")
      }</tbody></table>` });
    for (let i = 0; i < 4; i++) await run();
    expect(fetchNstTextByUrlMock).toHaveBeenCalledTimes(24);
    expect(fetchedDates().slice(0, 20)).toEqual(Array(20).fill("2026-09-29"));
    expect(fetchedDates().slice(20)).toEqual(Array(4).fill("2026-10-02"));
  });

  it("rotates capped empty attempts fairly without certifying completion or dropping earlier dates", async () => {
    await run();
    const second = await run();
    expect(fetchNstTextByUrlMock).toHaveBeenCalledTimes(12);
    expect(new Set(fetchedDates())).toEqual(new Set(["2026-09-29"]));
    expect(new Set(fetchNstTextByUrlMock.mock.calls.map(([url]) => url)).size).toBe(12);
    expect(db.audits.every((audit) => audit.details.stoppedEarly)).toBe(true);
    expect(second.body.success).toBe(false);
    expect(second.body.nstProgress.bookmarkRead).toBe("resumed");
    expect(second.body.nstProgress.sourceOutcomes.counts.empty_unverified).toBe(6);
    expect(second.body.nstProgress.sourceOutcomes.coverage).toBe("not_verified");
    for (let i = 0; i < 9; i++) await run();
    expect(fetchedDates().slice(20, 40)).toEqual(Array(20).fill("2026-10-02"));
    expect(fetchedDates().slice(40, 60)).toEqual(Array(20).fill("2026-10-03"));
    expect(fetchedDates().slice(60)).toEqual(Array(6).fill("2026-09-29"));
  });

  it("plans each current-season date once and resumes beyond the first date on Monday", async () => {
    vi.setSystemTime(new Date("2026-10-05T07:25:01.388Z"));
    db.games = Array.from({ length: 7 }, (_, i) => ({
      date: ["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"][i],
      seasonId: 20262027, type: 2
    }));
    for (let i = 0; i < 4; i++) await run();
    expect(db.audits.every((audit) => audit.details.urlsQueued === 140)).toBe(true);
    expect(fetchNstTextByUrlMock).toHaveBeenCalledTimes(24);
    expect(new Set(fetchNstTextByUrlMock.mock.calls.map(([url]) => url)).size).toBe(24);
    expect(fetchedDates().slice(0, 20)).toEqual(Array(20).fill("2026-09-29"));
    expect(fetchedDates().slice(20)).toEqual(Array(4).fill("2026-09-30"));
    expect(db.audits.at(-1).details.nstProgress.sourceOutcomes.coverage).toBe("not_verified");
  });

  it("resumes the least-current selected dataset rather than skipping its boundary date", async () => {
    for (const table of ["counts", "rates", "counts_oi", "rates_oi"]) {
      db.tables[`nst_gamelog_5v5_${table}`] = [{ date_scraped: table === "rates_oi" ? "2026-10-02" : "2026-10-03" }];
    }
    const res = await run({ datasetGroup: "fiveOnFive" });
    expect(new Set(fetchedDates())).toEqual(new Set(["2026-09-29", "2026-10-02"]));
    expect(res.body.nstProgress.stoppedEarly).toBe(true);
    expect(fetchNstTextByUrlMock.mock.calls[0][1].requestControl.minIntervalMs).toBe(21_000);
  });

  it("starts an empty current-season dataset at the season boundary, excluding future rows", async () => {
    db.tables.nst_gamelog_5v5_counts = [{ date_scraped: "2027-10-02" }];
    await run({ datasetType: "fiveOnFiveCounts" });
    expect(fetchedDates()).toEqual(["2026-09-29", "2026-10-02", "2026-10-03"]);
  });

  it("does not infer complete source coverage from a stored row sample", async () => {
    db.tables.nst_gamelog_5v5_counts = Array.from({ length: 5 }, (_, id) => ({
      date_scraped: "2026-10-02", player_id: id, goals: 1
    }));
    await run({ datasetType: "fiveOnFiveCounts" });
    expect(fetchedDates()).toEqual(["2026-09-29", "2026-10-02", "2026-10-03"]);
  });

  it("keeps explicit historical dates guarded instead of silently moving them", async () => {
    const res = await run({ startDate: "2026-04-03", endDate: "2026-04-03" });
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toContain("Requested startDate=2026-04-03");
    expect(fetchNstTextByUrlMock).not.toHaveBeenCalled();
  });

  it("preserves intentional historical exact dates and their season when explicitly opted in", async () => {
    const res = await run({ dates: "2026-04-03", datasetType: "fiveOnFiveCounts",
      allowHistoricalDatedRequests: "yes" }, "POST");
    expect(res.statusCode).toBe(200);
    expect(fetchedDates()).toEqual(["2026-04-03"]);
    expect(new URL(fetchNstTextByUrlMock.mock.calls[0][0]).searchParams.get("fromseason")).toBe("20252026");
  });

  it("honors explicit current-season dates without consulting the automatic cursor", async () => {
    await run({ dates: "2026-10-03", datasetType: "fiveOnFiveCounts" });
    expect(fetchedDates()).toEqual(["2026-10-03"]);
    expect(db.queries.some((q) => q.filters.some(([op]) => op === "gte") && q.table.startsWith("nst_gamelog"))).toBe(false);
  });

  it("retries the same explicit date without shifting the request window", async () => {
    fetchNstTextByUrlMock.mockRejectedValueOnce(new Error("temporary provider failure"));
    await run({ dates: "2026-10-03", datasetType: "fiveOnFiveCounts" });
    expect(fetchedDates()).toEqual(["2026-10-03", "2026-10-03"]);
    expect(db.audits.at(-1).details.failedRows).toBe(0);
  });

  it("makes no provider request when the selected window has no scheduled games", async () => {
    db.games = [];
    await run({ datasetType: "fiveOnFiveCounts" });
    expect(fetchNstTextByUrlMock).not.toHaveBeenCalled();
    expect(db.audits.at(-1).rows_affected).toBe(0);
  });

  it("keeps an offseason cursor in the last started season rather than a future season", async () => {
    vi.setSystemTime(new Date("2026-07-01T12:00:00Z"));
    db.tables.nst_gamelog_5v5_counts = [{ date_scraped: "2026-04-02" }];
    await run({ datasetType: "fiveOnFiveCounts" });
    expect(fetchedDates()).toEqual(["2026-04-03"]);
    expect(db.queries.find((q) => q.table === "games")?.filters).toContainEqual(["gte", "date", "2025-10-07"]);
  });

  it("rotates unavailable pages while exposing them as unresolved source failures", async () => {
    fetchNstTextByUrlMock.mockRejectedValue(new NstResponseError({ status: 404, redactedUrl: "https://data.naturalstattrick.com/playerteams.php" }));
    await run();
    const res = await run();
    expect(fetchNstTextByUrlMock).toHaveBeenCalledTimes(12);
    expect(new Set(fetchNstTextByUrlMock.mock.calls.map(([url]) => url)).size).toBe(12);
    expect(res.body.success).toBe(false);
    expect(res.body.nstProgress.sourceOutcomes.counts.unavailable).toBe(6);
    expect(db.audits.at(-1).status).toBe("failure");
  });

  it("distinguishes malformed/empty parsed pages from an explicit empty source", async () => {
    fetchNstTextByUrlMock.mockResolvedValue({ text: "<table><thead><tr><th>Player</th></tr></thead><tbody></tbody></table>", response: { status: 200 } });
    const res = await run({ dates: "2026-10-03", datasetType: "fiveOnFiveCounts" });
    expect(res.body.success).toBe(false);
    expect(res.body.nstProgress.sourceOutcomes.counts.parse_or_identity_unresolved).toBe(1);
    expect(res.body.nstProgress.sourceOutcomes.counts.empty_unverified).toBe(0);
    expect(res.body.nstProgress.bookmark).toBeNull();
  });

  it("restarts the season aperture after an audit read failure without claiming a resumed bookmark", async () => {
    await run();
    db.auditReadError = true;
    const res = await run();
    expect(fetchNstTextByUrlMock.mock.calls[6][0]).toBe(fetchNstTextByUrlMock.mock.calls[0][0]);
    expect(res.body.nstProgress.bookmarkRead).toBe("read_unconfirmed");
    expect(res.body.nstProgress.auditPersistence).toBe("confirmed");
    expect(res.body.success).toBe(false);
  });

  it("restarts after audit retention loss instead of advancing past earlier unresolved dates", async () => {
    await run();
    db.audits = [];
    db.tables.nst_gamelog_as_counts = [{ date_scraped: "2026-10-03" }];
    const res = await run();
    expect(fetchNstTextByUrlMock.mock.calls[6][0]).toBe(fetchNstTextByUrlMock.mock.calls[0][0]);
    expect(res.body.nstProgress.bookmarkRead).toBe("missing_or_retained_out");
  });

  it("resets expired, ambiguous, invalid-version and changed-queue bookmarks", async () => {
    await run();
    const saved = JSON.parse(JSON.stringify(db.audits[0]));
    const cases = [
      [{ ...saved, run_time: new Date(Date.now() - NST_GAMELOG_BOOKMARK_TTL_MS - 1).toISOString() }],
      [saved, saved],
      [{ ...saved, details: { ...saved.details, nstProgress: { ...saved.details.nstProgress,
        bookmark: { ...saved.details.nstProgress.bookmark, version: 999 } } } }],
      [{ ...saved, details: { ...saved.details, nstProgress: { ...saved.details.nstProgress,
        bookmark: { ...saved.details.nstProgress.bookmark, next: { seasonId: "20262027", date: "2026-09-30", datasetType: "allStrengthsCounts" } } } } }]
    ];
    for (const rows of cases) {
      db.audits = rows;
      const callIndex = fetchNstTextByUrlMock.mock.calls.length;
      const res = await run();
      expect(fetchNstTextByUrlMock.mock.calls[callIndex][0]).toBe(fetchNstTextByUrlMock.mock.calls[0][0]);
      expect(res.body.nstProgress.bookmarkRead).not.toBe("resumed");
    }
  });

  it("isolates season, dataset and overwrite scope identities", async () => {
    await run();
    const firstScope = db.audits[0].details.nstProgress.scope;
    const scoped = await run({ datasetGroup: "fiveOnFive", overwrite: "yes" });
    expect(scoped.body.nstProgress.scope).not.toBe(firstScope);
    expect(scoped.body.nstProgress.bookmarkRead).toBe("missing_or_retained_out");
    vi.setSystemTime(new Date("2027-10-03T12:00:00Z"));
    db.games.push({ date: "2027-10-02", seasonId: 20272028, type: 2 });
    const rolled = await run();
    expect(rolled.body.nstProgress.scope).not.toBe(firstScope);
    expect(rolled.body.nstProgress.bookmarkRead).toBe("missing_or_retained_out");
    expect(rolled.body.nstProgress.bookmark.next.seasonId).toBe("20272028");
  });

  it("keeps explicit end-date and forward requests outside automatic bookmark scope", async () => {
    await run();
    const explicitQueries: Record<string, string>[] = [{ endDate: "2026-10-03" }, { runMode: "forward", dates: "2026-10-03" }];
    for (const query of explicitQueries) {
      const queryIndex = db.queries.length;
      const res = await run(query);
      expect(res.body.nstProgress.bookmark).toBeNull();
      expect(db.queries.slice(queryIndex).some((q) => q.table === "cron_job_audit" && q.filters.length > 0)).toBe(false);
    }
  });

  it("keeps the current Eastern day and season start inclusive in default reverse mode", async () => {
    vi.setSystemTime(new Date("2026-10-05T07:25:01.388Z"));
    db.games.push({ date: "2026-10-05", seasonId: 20262027, type: 2 });
    await run({ runMode: "reverse", datasetType: "fiveOnFiveCounts" });
    expect(fetchedDates()).toEqual(["2026-10-05", "2026-10-03", "2026-10-02", "2026-09-29"]);
    expect(db.queries.some((q) => q.table === "cron_job_audit" && q.filters.length > 0)).toBe(false);
  });

  it("keeps a reverse request clamped to the season's first Eastern date inclusive", async () => {
    await run({ runMode: "reverse", startDate: "2026-09-29", datasetType: "fiveOnFiveCounts" });
    expect(fetchedDates()).toEqual(["2026-09-29"]);
  });

  it.each([
    { seasonId: "20252026", dates: ["2026-03-07", "2026-03-08", "2026-03-09"], now: "2026-03-10T12:00:00Z" },
    { seasonId: "20262027", dates: ["2026-10-31", "2026-11-01", "2026-11-02"], now: "2026-11-03T12:00:00Z" }
  ])("preserves opted-in reverse start/end dates across DST in season $seasonId", async ({ seasonId, dates, now }) => {
    vi.setSystemTime(new Date(now));
    db.games = dates.map((date) => ({ date, seasonId: Number(seasonId), type: 2 }));
    const res = await run({ runMode: "reverse", startDate: dates[2], seasonId,
      allowHistoricalDatedRequests: "yes", datasetType: "fiveOnFiveCounts" });
    expect(res.statusCode).toBe(200);
    expect(fetchedDates()).toEqual([...dates].reverse());
    expect(fetchNstTextByUrlMock.mock.calls.every(([url]) => new URL(url).searchParams.get("fromseason") === seasonId)).toBe(true);
    expect(db.queries.some((q) => q.table === "cron_job_audit" && q.filters.length > 0)).toBe(false);
  });

  it.each(["error", "transport", "lost_ack", "malformed_ack"])("reports unconfirmed audit persistence for %s without retrying the insert", async (failure) => {
    db.auditWriteFailure = failure;
    const res = await run();
    expect(res.statusCode).toBe(500);
    expect(res.body.auditPersistence).toBe("not_confirmed");
    expect(res.body.success).toBe(false);
    expect(db.auditWriteCalls).toBe(1);
    expect(db.audits.length).toBe(failure === "lost_ack" || failure === "malformed_ack" ? 1 : 0);
  });

  it("retains the original source error when its failure audit acknowledgement is lost", async () => {
    db.auditWriteFailure = "lost_ack";
    const res = await run({ startDate: "2026-04-03", endDate: "2026-04-03" });
    expect(res.body.error).toContain("Requested startDate=2026-04-03");
    expect(res.body.auditPersistence).toBe("not_confirmed");
    expect(db.auditWriteCalls).toBe(1);
    expect(fetchNstTextByUrlMock).not.toHaveBeenCalled();
  });

  it.each([401, 429])("stops immediately on provider %s and retains earlier confirmed row writes", async (status) => {
    db.tables.players = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, fullName: `Test Player ${i}`, position: "C" }));
    fetchNstTextByUrlMock.mockResolvedValueOnce({ response: { status: 200 }, text:
      `<table><thead><tr><th>Player</th><th>Team</th><th>Position</th><th>TOI</th></tr></thead><tbody>${
        db.tables.players.map((player) => `<tr><td>${player.fullName}</td><td>BOS</td><td>C</td><td>10:00</td></tr>`).join("")
      }</tbody></table>` }).mockRejectedValue(new NstResponseError({ status, redactedUrl: "https://data.naturalstattrick.com/playerteams.php" }));
    const res = await run();
    expect(res.statusCode).toBe(500);
    expect(fetchNstTextByUrlMock).toHaveBeenCalledTimes(2);
    expect(res.body.confirmedRowsAffected).toBe(5);
    expect(db.audits[0].rows_affected).toBe(5);
    expect(db.audits[0].status).toBe("failure");
    expect(db.audits[0].details.sourceItem.date).toBe("2026-09-29");
  });

  it("resolves the Monday Joseph Veleno spelling and persists all 180 fixture rows", async () => {
    // Synthetic rows reproduce the retained 180-to-179 identity failure, not provider HTML.
    db.tables.players = [
      { id: 8480813, fullName: "Joe Veleno", position: "C" },
      ...Array.from({ length: 179 }, (_, i) => ({ id: 9000000 + i, fullName: `Fixture Player ${i}`, position: "C" }))
    ];
    fetchNstTextByUrlMock.mockResolvedValue({ response: { status: 200 }, text:
      `<table><thead><tr><th>Player</th><th>Team</th><th>Position</th><th>TOI</th></tr></thead><tbody>${
        db.tables.players.map((player) => `<tr><td>${player.id === 8480813 ? "Joseph Veleno" : player.fullName}</td><td>NYR</td><td>C</td><td>10:00</td></tr>`).join("")
      }</tbody></table>` });
    const res = await run({ dates: "2026-09-29", datasetType: "allStrengthsCounts", overwrite: "yes" });
    expect(fetchNstTextByUrlMock).toHaveBeenCalledTimes(1);
    expect(fetchedDates()).toEqual(["2026-09-29"]);
    const rows = db.tables.nst_gamelog_as_counts;
    expect(rows).toHaveLength(180);
    expect(rows.filter((row) => row.player_id === 8480813)).toEqual([
      expect.objectContaining({ player_id: 8480813, date_scraped: "2026-09-29", season: 20262027 })
    ]);
    expect(res.body.success).toBe(true);
    expect(res.body.nstProgress.sourceOutcomes.counts.rows_persisted).toBe(1);
    expect(res.body.nstProgress.sourceOutcomes.counts.parse_or_identity_unresolved).toBe(0);
    expect(db.audits.at(-1).rows_affected).toBe(180);
  });


  it.each(["allStrengthsCounts", "allStrengthsRates"])("binds retained Oct1 %s rows to Mahura and NHL Jack Hughes", async (datasetType) => {
    // Provider HTML fragments retain original source hash and receipt time.
    db.tables.players = [
      { id: 8483456, fullName: "Jack Hughes", position: "C" },
      { id: 8481559, fullName: "Jack Hughes", position: "C" },
      { id: 8479372, fullName: "Joshua Mahura", position: "D" },
      { id: 8476539, fullName: "Jonathan Marchessault", position: "C" }
    ];
    const source = retainedNst.slices.find((slice) => slice.datasetType === datasetType)!;
    fetchNstTextByUrlMock.mockResolvedValue({ response: { status: 200 }, text: source.html });
    db.games.push({ date: source.date, seasonId: 20262027, type: 2 });
    const res = await run({ dates: source.date, datasetType, overwrite: "yes" });
    const table = datasetType === "allStrengthsCounts" ? "nst_gamelog_as_counts" : "nst_gamelog_as_rates";
    const rows = db.tables[table];
    expect(rows.map((row) => row.player_id).sort()).toEqual([8476539, 8479372, 8481559]);
    expect(rows.find((row) => row.player_id === 8481559)).toMatchObject({ toi: 1548, date_scraped: "2026-10-01" });
    expect(rows.every((row) => !Object.keys(row).some((key) => key.endsWith("_temp")))).toBe(true);
    expect(res.body.nstProgress.sourceOutcomes.counts.parse_or_identity_unresolved).toBe(0);
    expect(fetchNstTextByUrlMock).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, "playerreport.php?playerid=8483456", "playerreport.php?playerid=bad", "https://example.com/playerreport.php?playerid=8481559"])("preserves unresolved Hughes identity for missing or conflicting link %s", async (href) => {
    db.tables.players = [
      { id: 8483456, fullName: "Jack Hughes", position: "C" },
      { id: 8481559, fullName: "Jack Hughes", position: "C" }
    ];
    // A conflicting provider ID has no matching name candidate in this case.
    if (href?.includes("8483456")) db.tables.players[0].fullName = "Different Player";
    const name = href === undefined ? "Jack Hughes" : '<a href="' + href + '">Jack Hughes</a>';
    fetchNstTextByUrlMock.mockResolvedValue({ response: { status: 200 }, text:
      '<table><thead><tr><th>Player</th><th>Team</th><th>Position</th><th>TOI</th></tr></thead><tbody><tr><td>' + name + '</td><td>N.J</td><td>C</td><td>25:48</td></tr></tbody></table>' });
    db.games.push({ date: "2026-10-01", seasonId: 20262027, type: 2 });
    const res = await run({ dates: "2026-10-01", datasetType: "allStrengthsCounts", overwrite: "yes" });
    expect(db.tables.nst_gamelog_as_counts ?? []).toHaveLength(0);
    expect(res.body.nstProgress.sourceOutcomes.counts.parse_or_identity_unresolved).toBeGreaterThan(0);
  });

  it("preserves fractional PK rates from the retained Sep30 rows", async () => {
    db.tables.players = [
      { id: 8470613, fullName: "Brent Burns", position: "D" },
      { id: 8471724, fullName: "Kris Letang", position: "D" }
    ];
    const source = retainedNst.slices.find((slice) => slice.datasetType === "penaltyKillRatesOi")!;
    fetchNstTextByUrlMock.mockResolvedValue({ response: { status: 200 }, text: source.html });
    db.games.push({ date: source.date, seasonId: 20262027, type: 2 });
    await run({ dates: source.date, datasetType: source.datasetType, overwrite: "yes" });
    expect(db.tables.nst_gamelog_pk_rates_oi.map((row) => row.on_the_fly_starts_per_60)).toEqual([41.22, 156.52]);
  });

  it("refetches a partially resolved source instead of certifying five stored rows as complete", async () => {
    db.tables.players = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, fullName: "Test Player " + i, position: "C" }));
    const source = "<table><thead><tr><th>Player</th><th>Team</th><th>Position</th><th>TOI</th></tr></thead><tbody>" +
      db.tables.players.map((player) => "<tr><td>" + player.fullName + "</td><td>BOS</td><td>C</td><td>10:00</td></tr>").join("") +
      "<tr><td>Unmatched Example</td><td>BOS</td><td>C</td><td>10:00</td></tr></tbody></table>";
    fetchNstTextByUrlMock.mockResolvedValue({ response: { status: 200 }, text: source });
    const first = await run({ dates: "2026-10-03", datasetType: "allStrengthsCounts" });
    expect(db.tables.nst_gamelog_as_counts).toHaveLength(5);
    expect(first.body.nstProgress.sourceOutcomes.counts.parse_or_identity_unresolved).toBe(1);
    fetchNstTextByUrlMock.mockClear();
    const second = await run({ dates: "2026-10-03", datasetType: "allStrengthsCounts" });
    expect(fetchNstTextByUrlMock).toHaveBeenCalledTimes(1);
    expect(second.body.success).toBe(false);
    expect(second.body.nstProgress.sourceOutcomes.counts.parse_or_identity_unresolved).toBe(1);
    expect(second.body.nstProgress.sourceOutcomes.counts.already_present).toBe(0);
    expect(second.body.nstProgress.sourceOutcomes.coverage).toBe("not_verified");
    db.tables.players.push({ id: 6, fullName: "Unmatched Example", position: "C" });
    const recovered = await run({ dates: "2026-10-03", datasetType: "allStrengthsCounts" });
    expect(db.tables.nst_gamelog_as_counts).toHaveLength(6);
    expect(recovered.body.nstProgress.sourceOutcomes.counts.rows_persisted).toBe(1);
    expect(recovered.body.nstProgress.sourceOutcomes.coverage).toBe("not_verified");
  });

  it("retains unresolved identity evidence even when matched rows can be persisted", async () => {
    db.tables.players = [{ id: 1, fullName: "Test Player 0", position: "C" }];
    fetchNstTextByUrlMock.mockResolvedValue({ response: { status: 200 }, text:
      "<table><thead><tr><th>Player</th><th>Team</th><th>Position</th><th>TOI</th></tr></thead><tbody>" +
      "<tr><td>Test Player 0</td><td>BOS</td><td>C</td><td>10:00</td></tr>" +
      "<tr><td>Unmatched Example</td><td>BOS</td><td>C</td><td>10:00</td></tr></tbody></table>" });
    const res = await run({ dates: "2026-10-03", datasetType: "fiveOnFiveCounts" });
    expect(db.tables.nst_gamelog_5v5_counts).toHaveLength(1);
    expect(res.body.success).toBe(false);
    expect(res.body.nstProgress.sourceOutcomes.counts.parse_or_identity_unresolved).toBe(1);
    expect(res.body.nstProgress.sourceOutcomes.coverage).toBe("not_verified");
  });

  it("allows concurrent attempts to replay while keeping the unresolved window and unique audit identities", async () => {
    await run();
    const basedOnRunId = db.audits[0].details.nstProgress.runId;
    function response() {
      return { statusCode: 200, body: null as any,
        status(code: number) { this.statusCode = code; return this; },
        json(body: unknown) { this.body = body; return this; } };
    }
    const first = response();
    const second = response();
    const request = { method: "GET", query: {}, headers: {} } as any;
    const pending = [handler(request, first as any), handler(request, second as any)];
    await vi.runAllTimersAsync();
    await Promise.all(pending);
    expect(first.body.nstProgress.basedOnRunId).toBe(basedOnRunId);
    expect(second.body.nstProgress.basedOnRunId).toBe(basedOnRunId);
    expect(first.body.nstProgress.runId).not.toBe(second.body.nstProgress.runId);
    expect(first.body.nstProgress.bookmark.next).toEqual(second.body.nstProgress.bookmark.next);
    expect(first.body.nstProgress.concurrency).toContain("not_exclusive");
    expect(first.body.success).toBe(false);
    expect(second.body.success).toBe(false);
  });
});

describe("NST Eastern calendar aperture", () => {
  const midnight = (date: string) => fromZonedTime(`${date}T00:00:00`, "America/New_York");

  it("includes every Eastern day once through the actual Monday run time", () => {
    expect(getDatesBetween(midnight("2026-09-29"), new Date("2026-10-05T07:25:01.388Z"))).toEqual([
      "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"
    ]);
  });

  it("uses the Eastern end date before UTC midnight rolls into the Eastern day", () => {
    expect(getDatesBetween(midnight("2026-10-03"), new Date("2026-10-05T01:25:00Z"))).toEqual(["2026-10-03", "2026-10-04"]);
  });

  it("keeps a single explicit date inclusive", () => {
    expect(getDatesBetween(midnight("2026-10-03"), midnight("2026-10-03"))).toEqual(["2026-10-03"]);
  });

  it("keeps a reversed range empty", () => {
    expect(getDatesBetween(midnight("2026-10-04"), midnight("2026-10-03"))).toEqual([]);
  });

  it("steps through spring daylight saving without duplicates or missing days", () => {
    expect(getDatesBetween(midnight("2026-03-06"), midnight("2026-03-10"))).toEqual([
      "2026-03-06", "2026-03-07", "2026-03-08", "2026-03-09", "2026-03-10"
    ]);
  });

  it("steps through fall daylight saving without duplicates or missing days", () => {
    expect(getDatesBetween(midnight("2026-10-30"), midnight("2026-11-03"))).toEqual([
      "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03"
    ]);
  });
});

describe("NST bookmark identity validation", () => {
  it("rejects future times and mismatched scope rather than trusting an older audit", () => {
    const scope = buildNstGamelogScope({ seasonId: "20262027", seasonStartDate: "2026-09-29", datasets: ["fiveOnFiveCounts"], overwrite: false });
    const now = Date.parse("2026-10-04T07:25:00Z");
    const bookmark = { version: 1, scope, runId: "run-1", next: { seasonId: "20262027", date: "2026-10-03", datasetType: "fiveOnFiveCounts" } };
    expect(resolveNstGamelogBookmark({ scope, now, rows: [{ run_time: new Date(now + 1).toISOString(), details: { nstProgress: { bookmark } } }] }).bookmark).toBeNull();
    expect(resolveNstGamelogBookmark({ scope, now, rows: [{ run_time: new Date(now).toISOString(), details: { nstProgress: { bookmark: { ...bookmark, scope: "different" } } } }] }).bookmark).toBeNull();
    expect(rotateNstGamelogQueue([bookmark.next], { ...bookmark, next: { ...bookmark.next, seasonId: "20252026" } }).matched).toBe(false);
  });
});
