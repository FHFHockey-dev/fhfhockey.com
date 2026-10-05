import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
      auditWriteCalls: 0
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
          const stored = db.tables[table] ?? [];
          for (const row of rows) {
            const index = stored.findIndex((existing) => existing.player_id === row.player_id && existing.date_scraped === row.date_scraped);
            if (index < 0) stored.push({ ...row }); else stored[index] = { ...row };
          }
          db.tables[table] = stored;
          return Promise.resolve({ error: null, count: rows.length });
        },
        then(resolve: (value: unknown) => unknown) { return Promise.resolve(result()).then(resolve); }
      };
      return builder;
    }
  })
}));

import handler from "../../../../../pages/api/v1/db/update-nst-gamelog";
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
    return res;
  }

  function fetchedDates() {
    return fetchNstTextByUrlMock.mock.calls.map(([url]) => new URL(url).searchParams.get("fd"));
  }

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
    await run({ datasetGroup: "fiveOnFive" });
    expect(new Set(fetchedDates())).toEqual(new Set(["2026-09-29", "2026-10-02", "2026-10-03"]));
  });

  it("starts an empty current-season dataset at the season boundary, excluding future rows", async () => {
    db.tables.nst_gamelog_5v5_counts = [{ date_scraped: "2027-10-02" }];
    await run({ datasetType: "fiveOnFiveCounts" });
    expect(fetchedDates()).toEqual(["2026-09-29", "2026-10-02", "2026-10-03"]);
  });

  it("skips already complete data when revisiting the resume date", async () => {
    db.tables.nst_gamelog_5v5_counts = Array.from({ length: 5 }, (_, id) => ({
      date_scraped: "2026-10-02", player_id: id, goals: 1
    }));
    await run({ datasetType: "fiveOnFiveCounts" });
    expect(fetchedDates()).toEqual(["2026-09-29", "2026-10-03"]);
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

  it("retains unresolved identity evidence even when matched rows can be persisted", async () => {
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
