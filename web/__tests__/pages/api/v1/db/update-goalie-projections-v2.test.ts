import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { leagueSavePctMock, fetchMock, gamesGteMock, gamesLteMock, deleteMock, deleteEqMock, rosterState, storedGameDate, upsertMock } = vi.hoisted(() => ({
  leagueSavePctMock: vi.fn(),
  fetchMock: vi.fn(),
  deleteMock: vi.fn(async () => ({ error: null, count: 0 })),
  deleteEqMock: vi.fn(),
  gamesGteMock: vi.fn(),
  gamesLteMock: vi.fn(),
  rosterState: { rows: [{ playerId: 8470000, teamId: 1 }, { playerId: 8470001, teamId: 2 }], error: null as null | { message: string }, count: undefined as number | undefined },
  storedGameDate: { value: "2026-10-21" },
  upsertMock: vi.fn(async () => ({ error: null }))
}));

vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: any) => handler
}));
vi.mock("lib/cron/nhlOffSeason", () => ({
  withNhlOffSeasonSkip: (handler: any) => handler
}));
vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => handler
}));
vi.mock("lib/projections/goalie/leagueSavePct", () => ({ getSeasonLeagueSavePct: leagueSavePctMock }));
vi.mock("lib/cors-fetch", () => ({ default: fetchMock }));
vi.mock("lib/supabase/server", () => ({
  default: {
    from: (table: string) => {
      if (table === "rosters") {
        const query: any = {
          select: () => query, eq: () => query, in: () => query,
          limit: async () => ({ data: rosterState.rows, error: rosterState.error, count: rosterState.count ?? rosterState.rows.length })
        };
        return query;
      }
      if (table === "games") {
        return {
          select: () => ({
            gte: (column: string, value: string) => {
              gamesGteMock(column, value);
              return {
              lte: (column: string, value: string) => {
                gamesLteMock(column, value);
                return {
                  order: async () => ({
                    data: [
                      { id: 1, homeTeamId: 1, awayTeamId: 2, date: "2026-10-21" },
                      { id: 2, homeTeamId: 1, awayTeamId: 2, date: "2026-10-22" }
                    ],
                    error: null
                  })
                };
              }
              };
            }
          })
        };
      }
      return {
        select: () => ({
          order: () => ({
            limit: () => ({
              single: async () => ({ data: { game_date: storedGameDate.value }, error: null })
            })
          })
        }),
        upsert: upsertMock,
        delete: () => {
          const query: any = { eq: (key: string, value: number) => { deleteEqMock(key, value); return query; },
            then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => deleteMock().then(resolve, reject) };
          return query;
        }
      };
    }
  }
}));

import handler, {
  historicalGoalieTeams,
  pruneIneligibleGoalieProjectionRows,
  upsertGoalieProjectionRows
} from "pages/api/v1/db/update-goalie-projections-v2";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    setHeader: vi.fn(),
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    }
  };
  return res;
}

describe("update-goalie-projections-v2 endDate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-21T10:00:00.000Z"));
    leagueSavePctMock.mockResolvedValue({ savePct: 0.92, source: "observed", warning: null });
    storedGameDate.value = "2026-10-21";
    rosterState.rows = [{ playerId: 8470000, teamId: 1 }, { playerId: 8470001, teamId: 2 }];
    rosterState.error = null;
    rosterState.count = undefined;
    upsertMock.mockResolvedValue({ error: null });
    deleteMock.mockResolvedValue({ error: null, count: 0 });
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes("/season?")
          ? { data: [{ id: 20262027, startDate: "2026-10-07T00:00:00" }] }
          : {
              data: [
                {
                  playerId: new URL(url).searchParams.get("cayenneExp")?.includes("franchiseId=22 ") ? 8470001 : 8470000,
                  goalieFullName: "Test Goalie",
                  gameDate: "2026-10-20",
                  gamesStarted: 1,
                  gamesPlayed: 1,
                  saves: 25,
                  shotsAgainst: 27,
                  timeOnIce: 3600
                }
              ]
            }
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const run = async (query: Record<string, string>) => {
    const res = createMockRes();
    await handler({ method: "GET", query } as any, res);
    return res;
  };

  it("keeps reading games through today when endDate is omitted", async () => {
    const res = await run({});

    expect(res.statusCode).toBe(200);
    expect(gamesLteMock).toHaveBeenCalledWith("date", "2026-10-21");
  });

  it("projects future games through endDate using goalie history through today", async () => {
    const res = await run({ endDate: "2026-10-22" });

    expect(res.statusCode).toBe(200);
    expect(gamesLteMock).toHaveBeenCalledWith("date", "2026-10-22");
    const rows = (upsertMock.mock.calls[0] as any[])[0];
    expect(rows.filter((row: any) => row.game_date === "2026-10-22")).toEqual([
      expect.objectContaining({ game_id: 2, team_id: 1, player_id: 8470000, start_probability: 1 }),
      expect.objectContaining({ game_id: 2, team_id: 2, player_id: 8470001, start_probability: 1 })
    ]);
  });

  it("uses only prior-date logs for pregame shares and GSAA", async () => {
    const normalFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string) => {
      const response = await normalFetch(url);
      if (url.includes("/season?")) return response;
      const payload = await response.json();
      payload.data.push({ ...payload.data[0], gameDate: "2026-10-21", gamesStarted: 0, saves: 1, shotsAgainst: 10, timeOnIce: 600 });
      return { ok: true, json: async () => payload };
    });
    const res = await run({});
    expect(res.statusCode).toBe(200);
    const rows = (upsertMock.mock.calls[0] as any[])[0];
    expect(rows.filter((row: any) => row.game_date === "2026-10-21")).toEqual([
      expect.objectContaining({ player_id: 8470000, games_played: 1, l10_start_pct: 1, season_start_pct: 1 }),
      expect.objectContaining({ player_id: 8470001, games_played: 1, l10_start_pct: 1, season_start_pct: 1 }),
    ]);
  });

  it("uses the season league baseline at each pregame cutoff and labels the legacy share", async () => {
    leagueSavePctMock.mockImplementation(async (date: string) => ({ savePct: date === "2026-10-21" ? 0.92 : 0.91, source: "observed", warning: null }));
    const res = await run({ endDate: "2026-10-22" });
    expect(res.statusCode).toBe(200);
    const rows = (upsertMock.mock.calls[0] as any[])[0];
    expect(rows.find((row: any) => row.game_id === 1).projected_gsaa_per_60).toBeCloseTo(25 - 27 * 0.92);
    expect(rows.find((row: any) => row.game_id === 2).projected_gsaa_per_60).toBeCloseTo(25 - 27 * 0.91);
    expect(res.body.observability.startProbabilityBasis).toBe("l10_start_share");
    expect(leagueSavePctMock.mock.calls.map(call => call[0])).toEqual(["2026-10-21", "2026-10-22"]);
  });

  it("re-processes today's games when tomorrow's rows are already stored", async () => {
    storedGameDate.value = "2026-10-22";

    const res = await run({ endDate: "2026-10-22" });

    expect(res.statusCode).toBe(200);
    expect(gamesGteMock).toHaveBeenCalledWith("date", "2026-10-21");
    const rows = (upsertMock.mock.calls[0] as any[])[0];
    expect(new Set(rows.map((row: any) => row.game_date))).toEqual(
      new Set(["2026-10-21", "2026-10-22"])
    );
  });

  it("filters traded goalies to their current team before the shared game/player upsert", async () => {
    const normalFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string) => {
      const response = await normalFetch(url);
      if (url.includes("/season?")) return response;
      const payload = await response.json();
      payload.data.push({ ...payload.data[0], playerId: 8470002, goalieFullName: "Traded Goalie" });
      return { ok: true, json: async () => payload };
    });
    rosterState.rows.push({ playerId: 8470002, teamId: 2 });
    const res = await run({ endDate: "2026-10-22" });
    expect(res.statusCode).toBe(200);
    const rows = (upsertMock.mock.calls[0] as any[])[0];
    expect(rows.filter((row: any) => row.player_id === 8470002)).toEqual([
      expect.objectContaining({ game_id: 1, team_id: 2 }),
      expect.objectContaining({ game_id: 2, team_id: 2 })
    ]);
    expect(new Set(rows.map((row: any) => `${row.game_id}:${row.player_id}`)).size).toBe(rows.length);
    expect(res.body.observability.excludedHistoricalCandidates).toBe(2);
    expect(deleteEqMock.mock.calls).toEqual([
      ["game_id", 1], ["team_id", 1], ["player_id", 8470002],
      ["game_id", 2], ["team_id", 1], ["player_id", 8470002],
    ]);
  });

  it.each([false, true])("excludes unrostered history and reports reconciliation failure=%s", async cleanupFails => {
    if (cleanupFails) deleteMock.mockResolvedValue({ error: { message: "cleanup failed" }, count: null } as any);
    const normalFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string) => {
      const response = await normalFetch(url);
      if (url.includes("/season?")) return response;
      const payload = await response.json();
      payload.data.push({ ...payload.data[0], playerId: 8470002 });
      return { ok: true, json: async () => payload };
    });
    const res = await run({});
    expect(res.statusCode).toBe(cleanupFails ? 207 : 200);
    expect(res.body.success).toBe(!cleanupFails);
    expect((upsertMock.mock.calls[0] as any[])[0].every((row: any) => row.player_id !== 8470002)).toBe(true);
    if (cleanupFails) expect(deleteMock).toHaveBeenCalledTimes(1);
  });

  it("does not remove old rows when replacement upsert failed", async () => {
    rosterState.rows = [{ playerId: 8470000, teamId: 2 }, { playerId: 8470001, teamId: 1 }];
    // Keep an eligible teammate on each side while also producing rejected candidates.
    const normalFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string) => {
      const response = await normalFetch(url);
      if (url.includes("/season?")) return response;
      const payload = await response.json();
      payload.data.push({ ...payload.data[0], playerId: payload.data[0].playerId === 8470000 ? 8470001 : 8470000 });
      return { ok: true, json: async () => payload };
    });
    upsertMock.mockResolvedValue({ error: { message: "write failed" } } as any);
    const res = await run({});
    expect(res.statusCode).toBe(500);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("excludes a former goalie whose current team is outside the scheduled window", async () => {
    rosterState.rows[0].teamId = 3;
    const res = await run({});
    expect(res.statusCode).toBe(422);
    expect(res.body.missingGameTeams).toContainEqual({ gameId: 1, teamId: 1 });
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it.each(["conflicting", "truncated", "failed"])("does not write with %s roster evidence", async mode => {
    if (mode === "conflicting") rosterState.rows.push({ playerId: 8470000, teamId: 2 });
    if (mode === "truncated") rosterState.count = 3;
    if (mode === "failed") rosterState.error = { message: "roster read failed" };
    const res = await run({});
    expect(res.statusCode).toBe(500);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("does not persist partial priors after a team log fetch fails", async () => {
    const normalFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string) => url.includes("/season?") ? normalFetch(url) : { ok: false, status: 503 });
    const res = await run({});
    expect(res.statusCode).toBe(500);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it.each(["2026-10-2", "2026-13-01", "tomorrow"])(
    "rejects malformed endDate %s with 400",
    async (endDate) => {
      const res = await run({ endDate });

      expect(res.statusCode).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it("rejects an endDate more than 7 days after today", async () => {
    expect((await run({ endDate: "2026-10-28" })).statusCode).toBe(200);

    const res = await run({ endDate: "2026-10-29" });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("2026-10-28");
  });
});

describe("update-goalie-projections-v2 persistence", () => {
  it("counts only successfully persisted chunks", async () => {
    const upsert = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "database unavailable" } });
    const client = {
      from: vi.fn(() => ({ upsert }))
    } as any;

    const result = await upsertGoalieProjectionRows(
      client,
      [{ game_id: 1, player_id: 1 }, { game_id: 1, player_id: 2 }, { game_id: 1, player_id: 3 }],
      2
    );

    expect(result).toEqual({
      rowsUpserted: 2,
      failedRows: 1,
      failures: [
        {
          stage: "goalie_start_projections_upsert",
          batchIndex: 1,
          rows: 1,
          error: "database unavailable"
        }
      ]
    });
    expect(upsert).toHaveBeenNthCalledWith(
      1,
      [{ game_id: 1, player_id: 1 }, { game_id: 1, player_id: 2 }],
      { onConflict: "game_id, player_id" }
    );
  });
});

describe("goalie projection identity guard", () => {
  it.each([1, 1000])("rejects duplicates before any writes, including across chunks of %s", async chunkSize => {
    const client = { from: vi.fn() } as any;
    await expect(upsertGoalieProjectionRows(client, [
      { game_id: 1, player_id: 9, team_id: 1 }, { game_id: 1, player_id: 9, team_id: 2 }
    ], chunkSize)).rejects.toThrow("Duplicate goalie projection identity");
    expect(client.from).not.toHaveBeenCalled();
  });
  it("rejects invalid identity and chunk size before writing", async () => {
    const client = { from: vi.fn() } as any;
    await expect(upsertGoalieProjectionRows(client, [{ game_id: 1, player_id: null }])).rejects.toThrow("invalid game/player");
    await expect(upsertGoalieProjectionRows(client, [], 0)).rejects.toThrow("positive integer");
    expect(client.from).not.toHaveBeenCalled();
  });
  it("uses historical evidence without backdating today's roster or future logs", () => {
    const logs = { 1: [{ playerId: 9, gameDate: "2026-10-10" }], 2: [{ playerId: 9, gameDate: "2026-10-20" }] };
    expect(historicalGoalieTeams(logs, "2026-10-15").get(9)).toBe(1);
    expect(historicalGoalieTeams(logs, "2026-10-21").get(9)).toBe(2);
    expect(historicalGoalieTeams(logs, "2026-10-20").get(9)).toBe(1);
    expect(historicalGoalieTeams({ ...logs, 3: [{ playerId: 9, gameDate: "2026-10-20" }] }, "2026-10-21").get(9)).toBeNull();
  });
});

describe("goalie stale-candidate reconciliation", () => {
  it("uses exact game, old team and player predicates, deduplicates, and counts acknowledged removals", async () => {
    const eq = vi.fn();
    const query: any = { eq: (column: string, value: number) => { eq(column, value); return query; },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null, count: 1 }).then(resolve) };
    const from = vi.fn(() => ({ delete: vi.fn(() => query) }));
    const row = { game_id: 2026020270, team_id: 1, player_id: 8482076 };
    expect(await pruneIneligibleGoalieProjectionRows({ from } as any, [row, row])).toEqual({ rowsRemoved: 1, failures: [] });
    expect(from).toHaveBeenCalledTimes(1);
    expect(eq.mock.calls).toEqual([["game_id", row.game_id], ["team_id", 1], ["player_id", row.player_id]]);
  });

  it.each([{ error: { message: "cleanup failed" }, count: null }, { error: null, count: null }])(
    "stops on a failed or unacknowledged removal", async outcome => {
      const query: any = { eq: () => query, then: (resolve: (value: unknown) => unknown) => Promise.resolve(outcome).then(resolve) };
      const from = vi.fn(() => ({ delete: () => query }));
      const result = await pruneIneligibleGoalieProjectionRows({ from } as any, [
        { game_id: 1, team_id: 1, player_id: 9 }, { game_id: 2, team_id: 1, player_id: 9 }
      ]);
      expect(result.rowsRemoved).toBe(0);
      expect(result.failures).toHaveLength(1);
      expect(from).toHaveBeenCalledTimes(1);
    });
});
