import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import writerTeamAuthority from "../../NHL/seasonAwareWriterTeams.cjs";

const { createSeasonAwareWriterTeamsFromLineageRecords } =
  writerTeamAuthority as {
    createSeasonAwareWriterTeamsFromLineageRecords: (
      seasonId: number,
      records: Array<Record<string, unknown>>,
    ) => Record<string, { franchiseId: number; id: number; name: string }>;
  };

const mocks = vi.hoisted(() => {
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
  return {
    fetch: vi.fn(),
    expectedTeamId: 0,
    latestProcessedDate: null as string | null,
    originalServiceRoleKey,
    originalSupabaseUrl,
    upsertedRows: [] as Array<Record<string, unknown>>,
  };
});

vi.mock("node-fetch", () => ({ default: mocks.fetch }));
vi.mock("progress", () => ({
  default: class ProgressBarMock {
    tick() {}
  },
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from(table: string) {
      if (table === "games") {
        const builder = {
          select: () => builder,
          eq: () => builder,
          range: async () => ({
            data: [
              {
                id: 9001,
                homeTeamId: mocks.expectedTeamId,
                awayTeamId: 6,
              },
            ],
            error: null,
          }),
        };
        return builder;
      }

      if (table === "wgo_team_stats") {
        const builder = {
          select: () => builder,
          eq: () => builder,
          order: () => builder,
          limit: async () => ({
            data: mocks.latestProcessedDate
              ? [{ date: mocks.latestProcessedDate }]
              : [],
            error: null,
          }),
          upsert: async (
            rows: Record<string, unknown> | Array<Record<string, unknown>>,
          ) => {
            mocks.upsertedRows.push(...(Array.isArray(rows) ? rows : [rows]));
            return { error: null };
          },
        };
        return builder;
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

import { main } from "lib/supabase/Upserts/fetchWGOdata.js";

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => "application/json" },
    json: async () => payload,
  };
}

function installOneDateSources(
  seasonId: number,
  date: string,
  franchiseId: number,
  teamId: number,
  teamName: string,
  teamAbbreviation: string,
) {
  const datasetRow = {
    franchiseId,
    franchiseName: "Deliberately stale upstream name",
    gamesPlayed: 1,
  };
  const season = {
    id: seasonId,
    formattedSeasonId: `${String(seasonId).slice(0, 4)}-${String(
      seasonId,
    ).slice(4)}`,
    startDate: `${date}T00:00:00Z`,
    regularSeasonEndDate: `${date}T00:00:00Z`,
    endDate: `${date}T00:00:00Z`,
  };

  mocks.fetch.mockImplementation(async (url: string) => {
    if (url.includes("/season?")) {
      return jsonResponse({ data: [season] });
    }
    if (url.includes("/franchise-team-totals")) {
      return jsonResponse({
        data: [
          {
            firstSeasonId: seasonId,
            franchiseId,
            gameTypeId: 2,
            lastSeasonId: seasonId,
            teamId,
            teamName,
            triCode: teamAbbreviation,
          },
        ],
      });
    }
    if (url.includes("/team/")) {
      return jsonResponse({ data: [datasetRow] });
    }
    throw new Error(`Unexpected URL: ${url}`);
  });
}

describe("fetchWGOdata season-aware writer identity", () => {
  afterAll(() => {
    if (mocks.originalSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = mocks.originalSupabaseUrl;
    }
    if (mocks.originalServiceRoleKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = mocks.originalServiceRoleKey;
    }
  });

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "time").mockImplementation(() => undefined);
    vi.spyOn(console, "timeEnd").mockImplementation(() => undefined);
    mocks.fetch.mockReset();
    mocks.upsertedRows.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    {
      seasonId: 20102011,
      date: "2010-10-08",
      franchiseId: 35,
      teamId: 11,
      teamName: "Atlanta Thrashers",
      teamAbbreviation: "ATL",
    },
    {
      seasonId: 20132014,
      date: "2013-10-03",
      franchiseId: 28,
      teamId: 27,
      teamName: "Phoenix Coyotes",
      teamAbbreviation: "PHX",
    },
    {
      seasonId: 20142015,
      date: "2014-10-09",
      franchiseId: 28,
      teamId: 53,
      teamName: "Arizona Coyotes",
      teamAbbreviation: "ARI",
    },
    {
      seasonId: 20232024,
      date: "2023-10-10",
      franchiseId: 28,
      teamId: 53,
      teamName: "Arizona Coyotes",
      teamAbbreviation: "ARI",
    },
    {
      seasonId: 20242025,
      date: "2024-10-10",
      franchiseId: 40,
      teamId: 59,
      teamName: "Utah Hockey Club",
      teamAbbreviation: "UTA",
    },
    {
      seasonId: 20252026,
      date: "2025-10-10",
      franchiseId: 40,
      teamId: 68,
      teamName: "Utah Mammoth",
      teamAbbreviation: "UTA",
    },
  ])(
    "writes canonical $seasonId identity from the per-season catalog",
    async ({
      seasonId,
      date,
      franchiseId,
      teamId,
      teamName,
      teamAbbreviation,
    }) => {
      mocks.expectedTeamId = teamId;
      installOneDateSources(
        seasonId,
        date,
        franchiseId,
        teamId,
        teamName,
        teamAbbreviation,
      );

      await main({ date, recent: false, allSeasons: true });

      expect(mocks.fetch).toHaveBeenCalledTimes(13);
      expect(mocks.upsertedRows).toHaveLength(1);
      expect(mocks.upsertedRows[0]).toMatchObject({
        season_id: String(seasonId),
        date,
        team_id: teamId,
        franchise_name: teamName,
        game_id: 9001,
        opponent_id: 6,
      });
    },
  );
});

describe("fetchWGOdata NHL.com request resilience", () => {
  const seasonId = 20262027;
  const teamRecord = {
    firstSeasonId: seasonId,
    franchiseId: 40,
    gameTypeId: 2,
    lastSeasonId: seasonId,
    teamId: 68,
    teamName: "Utah Mammoth",
    triCode: "UTA",
  };
  const season = {
    id: seasonId,
    formattedSeasonId: "2026-27",
    startDate: "2026-10-07T00:00:00Z",
    regularSeasonEndDate: "2027-04-15T00:00:00Z",
    endDate: "2027-06-20T00:00:00Z",
  };

  function statusResponse(status: number) {
    return {
      ok: false,
      status,
      headers: { get: () => "text/html" },
      json: async () => {
        throw new Error("not JSON");
      },
    };
  }

  // Never answers; rejects only when the writer aborts the request.
  function hangUntilAborted(init?: { signal?: AbortSignal }) {
    return new Promise((_, reject) => {
      init?.signal?.addEventListener("abort", () =>
        reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
      );
    });
  }

  type TeamResponder = (
    endpoint: string,
    date: string,
    init?: { signal?: AbortSignal },
  ) => unknown;

  function installSources(teamResponder: TeamResponder) {
    mocks.fetch.mockImplementation(
      async (url: string, init?: { signal?: AbortSignal }) => {
        if (url.includes("/season?")) {
          return jsonResponse({ data: [season] });
        }
        if (url.includes("/franchise-team-totals")) {
          return jsonResponse({ data: [teamRecord] });
        }
        const team = url.match(/\/team\/(\w+)\?/);
        const date = url.match(/\d{4}-\d{2}-\d{2}/);
        if (team && date) {
          return teamResponder(team[1], date[0], init);
        }
        throw new Error(`Unexpected URL: ${url}`);
      },
    );
  }

  const teamDay = () =>
    jsonResponse({
      data: [{ franchiseId: teamRecord.franchiseId, gamesPlayed: 1 }],
    });

  function teamCalls(endpoint: string, date: string) {
    return mocks.fetch.mock.calls.filter(
      ([url]) => url.includes(`/team/${endpoint}?`) && url.includes(date),
    ).length;
  }

  // Attach the expectation first so a rejection is never unhandled while
  // the fake clock runs.
  async function settle<T>(run: Promise<T>) {
    const outcome = run.then(
      () => null,
      (error: Error) => error,
    );
    await vi.runAllTimersAsync();
    return outcome;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "time").mockImplementation(() => undefined);
    vi.spyOn(console, "timeEnd").mockImplementation(() => undefined);
    mocks.fetch.mockReset();
    mocks.upsertedRows.length = 0;
    mocks.expectedTeamId = teamRecord.teamId;
  });

  afterEach(() => {
    mocks.latestProcessedDate = null;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("retries a 524 and a hung request, then writes the date", async () => {
    let powerPlayCalls = 0;
    installSources((endpoint, _date, init) => {
      if (endpoint === "powerplay") {
        powerPlayCalls++;
        if (powerPlayCalls === 1) return statusResponse(524);
        if (powerPlayCalls === 2) return hangUntilAborted(init);
      }
      return teamDay();
    });

    const error = await settle(
      main({ date: "2026-11-02", recent: false, allSeasons: true }),
    );

    expect(error).toBeNull();
    expect(teamCalls("powerplay", "2026-11-02")).toBe(3);
    expect(mocks.upsertedRows).toHaveLength(1);
    expect(mocks.upsertedRows[0]).toMatchObject({ date: "2026-11-02" });
  });

  it("does not retry a 404", async () => {
    installSources((endpoint) =>
      endpoint === "powerplay" ? statusResponse(404) : teamDay(),
    );

    const error = await settle(
      main({ date: "2026-11-02", recent: false, allSeasons: true }),
    );

    expect(teamCalls("powerplay", "2026-11-02")).toBe(1);
    expect(error?.message).toContain("2026-11-02");
    expect(error?.message).toContain("HTTP 404");
    expect(mocks.upsertedRows).toHaveLength(0);
  });

  it("stops at a date that still fails and rejects naming it", async () => {
    mocks.latestProcessedDate = "2026-11-01";
    installSources((endpoint, date) =>
      date === "2026-11-02" && endpoint === "powerplay"
        ? statusResponse(524)
        : teamDay(),
    );

    const error = await settle(main({ recent: true }));

    expect(teamCalls("powerplay", "2026-11-02")).toBe(3);
    expect(teamCalls("summary", "2026-11-03")).toBe(0);
    expect(mocks.upsertedRows.map((row) => row.date)).toEqual(["2026-11-01"]);
    expect(error?.message).toBe(
      "WGO team stats failed for 1 date(s): 2026-11-02 (Failed to fetch " +
        "https://api.nhle.com/stats/rest/en/team/powerplay: HTTP 524 after 3 attempts)",
    );
  });

  it("leaves the dates the run budget cannot fit for the next run, without calling them failures", async () => {
    mocks.latestProcessedDate = "2026-10-25";
    // Slow but inside the timeout, so each date takes 19 s.
    installSources((endpoint) =>
      endpoint === "powerplay"
        ? new Promise((resolve) => setTimeout(() => resolve(teamDay()), 19_000))
        : teamDay(),
    );

    const run = main({ recent: true });
    await vi.runAllTimersAsync();
    const result = await run;

    // A date starts only while 63 s of worst case still fits 210 s.
    expect(mocks.upsertedRows.map((row) => row.date)).toEqual([
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
    expect(teamCalls("summary", "2026-11-02")).toBe(0);
    expect(result).toEqual({ deferredDates: ["2026-11-02", "2026-11-03"] });
  });
});

describe("WGO franchise-team lineage contract", () => {
  const regularSeasonRecord = {
    firstSeasonId: 20102011,
    franchiseId: 35,
    gameTypeId: 2,
    lastSeasonId: 20102011,
    teamId: 11,
    teamName: "Atlanta Thrashers",
    triCode: "ATL",
  };

  it("selects exact regular-season identity and ignores playoff totals", () => {
    expect(
      createSeasonAwareWriterTeamsFromLineageRecords(20102011, [
        regularSeasonRecord,
        { ...regularSeasonRecord, gameTypeId: 3 },
      ]),
    ).toEqual({
      ATL: {
        franchiseId: 35,
        id: 11,
        name: "Atlanta Thrashers",
      },
    });
  });

  it("fails closed when no regular-season lineage covers the season", () => {
    expect(() =>
      createSeasonAwareWriterTeamsFromLineageRecords(20112012, [
        regularSeasonRecord,
      ]),
    ).toThrow("No NHL regular-season lineage exists");
  });

  it("fails closed on overlapping franchise lineage", () => {
    expect(() =>
      createSeasonAwareWriterTeamsFromLineageRecords(20102011, [
        regularSeasonRecord,
        {
          ...regularSeasonRecord,
          teamId: 52,
          teamName: "Winnipeg Jets",
          triCode: "WPG",
        },
      ]),
    ).toThrow("Ambiguous NHL lineage");
  });
});
