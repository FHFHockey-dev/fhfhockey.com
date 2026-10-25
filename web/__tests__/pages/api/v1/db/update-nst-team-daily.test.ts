// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TABLES = [
  "nst_team_gamelogs_as_counts",
  "nst_team_gamelogs_as_rates",
  "nst_team_gamelogs_es_counts",
  "nst_team_gamelogs_es_rates",
  "nst_team_gamelogs_pp_counts",
  "nst_team_gamelogs_pp_rates",
  "nst_team_gamelogs_pk_counts",
  "nst_team_gamelogs_pk_rates",
];

type Game = { id: number; date: string; seasonId: number; type: number };

const state = vi.hoisted(() => ({
  stored: {} as Record<string, Set<string>>,
  games: [] as Game[],
  nstEmptyDates: new Set<string>(),
  fetches: [] as Array<{ at: number; fd: string; sit: string; rate: string }>,
  upserts: [] as Array<{ table: string; dates: string[] }>,
  audits: [] as Array<{ at: number; row: any }>,
}));

// Small in-memory stand-in for the PostgREST calls the route makes.
function query(table: string) {
  const filters: Array<(row: any) => boolean> = [];
  let ascending = true;
  let limitTo: number | null = null;
  let range: [number, number] | null = null;
  let head = false;

  const rows = (): any[] => {
    const source =
      table === "games"
        ? state.games
        : [...(state.stored[table] ?? [])].map((date) => ({ date }));
    const sorted = source
      .filter((row) => filters.every((keep) => keep(row)))
      .sort((a, b) =>
        ascending ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)
      );
    if (range) return sorted.slice(range[0], range[1] + 1);
    return limitTo === null ? sorted : sorted.slice(0, limitTo);
  };

  const builder: any = {
    select: (_columns: string, options?: { head?: boolean }) => {
      head = options?.head ?? false;
      return builder;
    },
    eq: (column: string, value: unknown) => {
      filters.push((row) => row[column] === value);
      return builder;
    },
    gte: (column: string, value: string) => {
      filters.push((row) => row[column] >= value);
      return builder;
    },
    lte: (column: string, value: string) => {
      filters.push((row) => row[column] <= value);
      return builder;
    },
    or: (filter: string) => {
      expect(filter).toBe("type.is.null,type.neq.1");
      filters.push((row) => row.type == null || row.type !== 1);
      return builder;
    },
    order: (column: string, options: { ascending: boolean }) => {
      if (column === "date") ascending = options.ascending;
      return builder;
    },
    limit: (count: number) => {
      limitTo = count;
      return builder;
    },
    range: (from: number, to: number) => {
      range = [from, to];
      return Promise.resolve({ data: rows(), error: null });
    },
    maybeSingle: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
    upsert: (inserted: Array<{ date: string }>) => {
      const dates = [...new Set(inserted.map((row) => row.date))];
      state.upserts.push({ table, dates });
      state.stored[table] ??= new Set();
      dates.forEach((date) => state.stored[table].add(date));
      return Promise.resolve({ error: null });
    },
    then: (resolve: (value: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(
        head ? { count: rows().length, error: null } : { data: rows(), error: null }
      ).then(resolve, reject),
  };
  return builder;
}

const mocks = vi.hoisted(() => ({ fetchSeason: vi.fn(), fetchNst: vi.fn() }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: (table: string) => query(table) }),
}));
vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));
vi.mock("utils/adminOnlyMiddleware", () => ({ default: (handler: unknown) => handler }));
vi.mock("lib/supabase/server", () => ({
  default: {
    from: () => ({
      insert: async (row: unknown) => {
        state.audits.push({ at: Date.now(), row });
        return { error: null };
      },
    }),
  },
}));
vi.mock("lib/cron/nhlOffSeason", () => ({ withNhlOffSeasonSkip: (handler: unknown) => handler }));
vi.mock("utils/fetchCurrentSeason", () => ({ fetchCurrentSeason: mocks.fetchSeason }));
vi.mock("lib/nst/client", () => ({ fetchNstTextByUrl: mocks.fetchNst, NST_DEFAULT_RETRIES: 2 }));

import handler from "pages/api/v1/db/update-nst-team-daily";

const teamTable = (gp: number) => `<table id="teams">
  <thead><tr><th></th><th>Team</th><th>GP</th><th>TOI</th></tr></thead>
  <tbody>
    <tr><td>1</td><td>Toronto Maple Leafs</td><td>${gp}</td><td>60:00</td></tr>
    <tr><td>2</td><td>Montreal Canadiens</td><td>${gp}</td><td>60:00</td></tr>
  </tbody></table>`;

function storeComplete(...dates: string[]) {
  TABLES.forEach((table) => {
    state.stored[table] ??= new Set();
    dates.forEach((date) => state.stored[table].add(date));
  });
}

function schedule(dates: string[], type = 2) {
  dates.forEach((date) =>
    state.games.push({ id: state.games.length + 1, date, seasonId: 20262027, type })
  );
}

async function invoke(query: Record<string, string> = {}) {
  const res = {
    statusCode: 200,
    body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; },
    setHeader: vi.fn(),
  };
  const pending = handler({ method: "GET", url: "/api/v1/db/update-nst-team-daily", query } as any, res as any);
  await vi.runAllTimersAsync();
  await pending;
  return res;
}

const fetchedDates = () => [...new Set(state.fetches.map((f) => f.fd))];

describe("update-nst-team-daily incremental queue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 10:00 ET on 2026-10-18.
    vi.setSystemTime(new Date("2026-10-18T14:00:00.000Z"));
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    state.stored = {};
    state.games = [];
    state.nstEmptyDates = new Set();
    state.fetches = [];
    state.upserts = [];
    state.audits = [];
    mocks.fetchSeason.mockResolvedValue({ id: 20262027, startDate: "2026-10-07" });
    mocks.fetchNst.mockImplementation(async (url: string) => {
      const params = new URL(url).searchParams;
      const fd = params.get("fd")!;
      state.fetches.push({ at: Date.now(), fd, sit: params.get("sit")!, rate: params.get("rate")! });
      // A no-game date returns NST's season-to-date aggregate (GP > 1).
      return { text: teamTable(state.nstEmptyDates.has(fd) ? 4 : 1) };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("works through a backlog past a league-wide off day at 21 s spacing", async () => {
    schedule(["2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10"]);
    schedule(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"]);
    storeComplete("2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10");

    const res = await invoke();

    expect(res.statusCode).toBe(200);
    expect(fetchedDates()).toEqual(["2026-10-12"]);
    expect(state.fetches).toHaveLength(8);
    expect(res.body.nstRequestPlan).toMatchObject({ burstAllowed: false, requestIntervalMs: 21_000 });
    state.fetches.slice(1).forEach((fetch, index) => {
      expect(fetch.at - state.fetches[index].at).toBeGreaterThanOrEqual(21_000);
    });
    expect(res.body.summary).toMatchObject({ offDays: 1, totalDates: 7, processedDates: 1 });
    expect(res.body.nextStartDate).toBe("2026-10-13");

    // The next run resumes after the newly complete date.
    state.fetches = [];
    const next = await invoke();
    expect(fetchedDates()).toEqual(["2026-10-13"]);
    expect(next.body.nextStartDate).toBe("2026-10-14");
  });

  it("probes a scheduled date NST has no games for once and moves on", async () => {
    schedule(["2026-10-07", "2026-10-10", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"]);
    storeComplete("2026-10-07", "2026-10-10");
    state.nstEmptyDates.add("2026-10-12");

    const res = await invoke();

    expect(state.fetches.map((f) => f.fd)).toEqual(["2026-10-12", ...Array(8).fill("2026-10-13")]);
    expect(state.fetches[0]).toMatchObject({ sit: "all", rate: "n" });
    expect(res.body.summary.noGameDates).toEqual(["2026-10-12"]);
    expect(res.body.summary.requestsUsed).toBe(9);
    expect(res.body.nextStartDate).toBe("2026-10-14");
    expect(state.upserts.every((u) => !u.dates.includes("2026-10-12"))).toBe(true);
  });

  it("floors a prior-season latest date at the season's first regular-season game", async () => {
    storeComplete("2026-06-15");
    schedule(["2026-09-27", "2026-10-03"], 1);
    schedule(["2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);

    const res = await invoke();

    expect(fetchedDates()).toEqual(["2026-10-07"]);
    expect(res.body.summary).toMatchObject({ totalDates: 5, offDays: 7 });
    expect(res.body.nextStartDate).toBe("2026-10-08");
  });

  it("advances past a complete latest date instead of re-queueing it", async () => {
    schedule(["2026-10-07", "2026-10-16", "2026-10-17", "2026-10-18"]);
    storeComplete("2026-10-07", "2026-10-16");

    const res = await invoke();

    expect(fetchedDates()).toEqual(["2026-10-17", "2026-10-18"]);
    expect(res.body).toMatchObject({ success: true, complete: true });
    expect(res.body.summary).toMatchObject({ totalDates: 2, skippedDates: 0, processedDates: 2 });
  });

  it("fetches only the missing tables of a partially stored date", async () => {
    schedule(["2026-10-07", "2026-10-16", "2026-10-17"]);
    storeComplete("2026-10-07", "2026-10-16");
    state.stored.nst_team_gamelogs_pp_rates.delete("2026-10-16");

    const res = await invoke();

    expect(state.fetches.filter((f) => f.fd === "2026-10-16")).toEqual([
      expect.objectContaining({ sit: "pp", rate: "y" }),
    ]);
    expect(fetchedDates()).toEqual(["2026-10-16", "2026-10-17"]);
    expect(res.body.complete).toBe(true);
  });

  it("preserves a single requested reverse date on a UTC host", async () => {
    const res = await invoke({
      runMode: "reverse",
      startDate: "2026-10-18",
      endDate: "2026-10-18",
    });

    expect(res.statusCode).toBe(200);
    expect(fetchedDates()).toEqual(["2026-10-18"]);
  });

  it("includes both reverse range boundaries on a UTC host", async () => {
    const res = await invoke({
      runMode: "reverse",
      startDate: "2026-10-10",
      endDate: "2026-10-08",
    });

    expect(res.statusCode).toBe(200);
    expect(fetchedDates()).toEqual(["2026-10-10", "2026-10-09"]);
    expect(res.body.summary.totalDates).toBe(3);
    expect(res.body.nextStartDate).toBe("2026-10-08");
  });

  it("clamps a future reverse start to today's calendar date on a UTC host", async () => {
    const res = await invoke({
      runMode: "reverse",
      startDate: "2026-10-20",
      endDate: "2026-10-18",
    });

    expect(res.statusCode).toBe(200);
    expect(fetchedDates()).toEqual(["2026-10-18"]);
  });

  it("leaves time for a terminal audit and resumes a date after slow NST responses", async () => {
    schedule(["2026-10-07", "2026-10-16", "2026-10-17", "2026-10-18"]);
    storeComplete("2026-10-07", "2026-10-16");
    const normalFetch = mocks.fetchNst.getMockImplementation()!;
    mocks.fetchNst.mockImplementation(async (...args: any[]) => {
      await new Promise((resolve) => setTimeout(resolve, 45_000));
      return normalFetch(...args);
    });
    const startedAt = Date.now();

    const res = await invoke();

    expect(state.audits).toHaveLength(1);
    expect(state.audits[0].at - startedAt).toBeLessThan(240_000);
    expect(res.body).toMatchObject({ success: true, complete: false, nextStartDate: "2026-10-17" });
    expect(state.upserts.length).toBeGreaterThan(0);
    expect(state.upserts.length).toBeLessThan(8);
    mocks.fetchNst.mock.calls.forEach(([, options]) => {
      expect(options.requestControl).toMatchObject({
        deadlineAt: startedAt + 220_000,
        maxAttempts: 3,
        attemptsStarted: 0,
        minIntervalMs: 21_000,
      });
    });
    state.fetches.slice(1).forEach((fetch, index) => {
      expect(fetch.at - state.fetches[index].at).toBeGreaterThanOrEqual(21_000);
    });

    mocks.fetchNst.mockImplementation(normalFetch);
    state.fetches = [];
    const next = await invoke();
    expect(next.body).toMatchObject({ success: true, complete: true, nextStartDate: null });
    TABLES.forEach((table) => expect(state.stored[table].has("2026-10-17")).toBe(true));
  });

  it("keeps slow request failures explicit when the runtime budget defers the date", async () => {
    schedule(["2026-10-07", "2026-10-16", "2026-10-17", "2026-10-18"]);
    storeComplete("2026-10-07", "2026-10-16");
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.fetchNst.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 45_000));
      throw new Error("synthetic NST timeout");
    });
    const startedAt = Date.now();

    const res = await invoke();

    expect(res.statusCode).toBe(207);
    expect(res.body).toMatchObject({
      success: false,
      complete: false,
      nextStartDate: "2026-10-17",
      failedRequests: 4,
    });
    expect(state.upserts).toHaveLength(0);
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0].row.status).toBe("failure");
    expect(state.audits[0].at - startedAt).toBeLessThan(240_000);
  });
});
