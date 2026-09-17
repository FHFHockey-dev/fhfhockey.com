import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, getCurrentSeasonMock, sharedSupabaseMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  getCurrentSeasonMock: vi.fn(),
  sharedSupabaseMock: {
    from: vi.fn((table: string) => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          throwOnError: vi.fn().mockResolvedValue(
            table === "team_season"
              ? { data: [{ teamId: 1 }, { teamId: 2 }, { teamId: 3 }] }
              : {
                  data: [
                    { id: 1, abbreviation: "ANA" },
                    { id: 2, abbreviation: "BOS" },
                    { id: 3, abbreviation: "STL" }
                  ]
                }
          )
        })),
        in: vi.fn(() => ({
          throwOnError: vi.fn().mockResolvedValue({
            data: [
              { id: 1, abbreviation: "ANA" },
              { id: 2, abbreviation: "BOS" },
              { id: 3, abbreviation: "STL" }
            ]
          })
        }))
      }))
    }))
  }
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => async (req: any, res: any) => {
    req.supabase = req.mockSupabase;
    return handler(req, res);
  }
}));

vi.mock("lib/NHL/base", () => ({
  get: getMock
}));

vi.mock("lib/NHL/server", () => ({
  getCurrentSeason: getCurrentSeasonMock
}));

vi.mock("lib/supabase/server", () => ({
  default: sharedSupabaseMock
}));

import handler, { prepareBoundedSchedule } from "../../../../../pages/api/v1/db/update-games";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string | string[]>,
    body: null as any,
    setHeader(key: string, value: string | string[]) {
      this.headers[key] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload: any) {
      this.body = payload;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    }
  };
  return res;
}

function createMockSupabase() {
  const upsert = vi.fn().mockReturnValue({
    throwOnError: vi.fn().mockResolvedValue({})
  });

  return {
    upsert,
    from: vi.fn(() => ({
      upsert
    }))
  };
}

describe("/api/v1/db/update-games", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sharedSupabaseMock.from.mockClear();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    getCurrentSeasonMock.mockResolvedValue({ seasonId: 20252026 });
  });

  it("continues when one team schedule fetch fails but other teams provide the shared slate", async () => {
    getMock.mockImplementation((path: string) => {
      if (path.includes("/ANA/")) {
        return Promise.resolve({
          games: [
            {
              id: 101,
              gameDate: "2026-04-15",
              startTimeUTC: "2026-04-15T23:00:00Z",
              gameType: 2,
              homeTeam: { id: 1 },
              awayTeam: { id: 2 }
            }
          ]
        });
      }
      if (path.includes("/BOS/")) {
        return Promise.resolve({
          games: [
            {
              id: 101,
              gameDate: "2026-04-15",
              startTimeUTC: "2026-04-15T23:00:00Z",
              gameType: 2,
              homeTeam: { id: 1 },
              awayTeam: { id: 2 }
            }
          ]
        });
      }
      return Promise.reject(new Error("fetch failed"));
    });

    const req: any = {
      method: "GET",
      query: {},
      mockSupabase: createMockSupabase()
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      partialFailures: 1,
      warnings: expect.arrayContaining([expect.stringContaining("STL:")])
    });
  });

  it("fails when every team schedule fetch fails", async () => {
    getMock.mockRejectedValue(new Error("fetch failed"));

    const req: any = {
      method: "GET",
      query: {},
      mockSupabase: createMockSupabase()
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      message: expect.stringContaining("Failed to fetch games for every team")
    });
  });
});

describe("bounded Starter Board schedule ingestion", () => {
  const input = { date: "2026-09-19", gameIds: [2026010003, 2026010001] };
  const game = (id: number) => ({ id, season: 20262027, gameType: 1, startTimeUTC: "2026-09-19T23:00:00Z",
    gameState: "FUT", gameScheduleState: "OK", homeTeam: { id: 19 }, awayTeam: { id: 25 } });
  const schedule = () => ({ gameWeek: [{ date: input.date, games: [game(2026010001), game(2026010003), game(2026010008)] }] });
  function database(existing: any[] = [], missingTeams = false) {
    const rows = [...existing];
    const insert = vi.fn((values: any[]) => ({ select: vi.fn(async () => { rows.push(...values); return { data: values.map(({ id }) => ({ id })), error: null }; }) }));
    const from = vi.fn((table: string) => ({ insert,
      select: vi.fn(() => ({ in: vi.fn(async () => ({ error: null, data: table === "games" ? [...rows]
        : table === "seasons" ? [{ id: 20262027 }] : missingTeams ? [] : [{ id: 19 }, { id: 25 }] })) })) }));
    return { from, insert, rows };
  }
  async function request(body: unknown, db = database(), query: any = { mode: "bounded_slate" }, method = "POST") {
    const res = createMockRes();
    await handler({ method, query, body, mockSupabase: db } as any, res);
    return { res, db };
  }
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-16T12:00:00Z"));
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    getMock.mockResolvedValue(schedule());
  });
  afterEach(() => vi.useRealTimers());

  it("previews only the selected games by default without season fetches or game writes", async () => {
    const { res, db } = await request(input);
    expect(res.statusCode).toBe(200);
    expect(res.headers["Cache-Control"]).toBe("private, no-store");
    expect(res.body).toMatchObject({ dryRun: true, rowsInserted: 0, wouldInsert: [2026010001, 2026010003] });
    expect(res.body.games).toHaveLength(2);
    expect(db.insert).not.toHaveBeenCalled();
    expect(getCurrentSeasonMock).not.toHaveBeenCalled();
    expect(getMock).toHaveBeenCalledWith("/schedule/2026-09-19", false, expect.any(AbortSignal));
    expect(prepareBoundedSchedule(schedule(), { ...input, gameIds: [...input.gameIds].reverse() }).planHash).toBe(res.body.planHash);
  });
  it("requires an exact reviewed plan, inserts once, and leaves existing rows untouched on retry", async () => {
    const { planHash, games } = prepareBoundedSchedule(schedule(), input);
    const db = database([{ ...games[0], startTime: "2026-09-19T23:00:00+00:00" }]);
    expect((await request({ ...input, dryRun: false }, db)).res.statusCode).toBe(400);
    expect((await request({ ...input, dryRun: false, expectedPlanHash: "0".repeat(64) }, db)).res.statusCode).toBe(409);
    expect(db.insert).not.toHaveBeenCalled();
    const body = { ...input, dryRun: false, expectedPlanHash: planHash };
    expect((await request(body, db)).res.body.rowsInserted).toBe(1);
    expect(db.insert).toHaveBeenCalledWith([games[1]]);
    expect((await request(body, db)).res.body.rowsInserted).toBe(0);
    expect(db.insert).toHaveBeenCalledTimes(1);
  });
  it("never overwrites changed existing games and identifies missing dependencies", async () => {
    const { games, planHash } = prepareBoundedSchedule(schedule(), input);
    const db = database([{ ...games[0], startTime: "2026-09-19T22:00:00Z" }]);
    const { res } = await request({ ...input, dryRun: false, expectedPlanHash: planHash }, db);
    expect(res.statusCode).toBe(409);
    expect(res.body.conflicts).toEqual([2026010001]);
    expect(db.insert).not.toHaveBeenCalled();
    const missing = await request(input, database([], true));
    expect(missing.res.statusCode).toBe(409);
    expect(missing.res.body.missingTeams).toEqual([19, 25]);
    expect(missing.db.insert).not.toHaveBeenCalled();
  });
  it("rejects malformed, unbounded and past requests before provider or database work", async () => {
    for (const body of [{ ...input, gameIds: [] }, { ...input, gameIds: [1, 1] }, { ...input, gameIds: Array.from({ length: 17 }, (_, i) => i + 1) },
      { ...input, date: "2026-09-15" }, { ...input, date: "2026-09-24" }, { ...input, date: "2026-02-30" }, { ...input, dryRun: "false" }]) {
      const { res, db } = await request(body);
      expect(res.statusCode).toBe(400);
      expect(db.from).not.toHaveBeenCalled();
    }
    expect((await request(input, database(), { mode: "bounded-slate" })).res.statusCode).toBe(400);
    expect((await request(input, database(), {})).res.statusCode).toBe(400);
    expect((await request(input, database(), { mode: "bounded_slate" }, "GET")).res.statusCode).toBe(405);
    expect(getMock).not.toHaveBeenCalled();
    expect(getCurrentSeasonMock).not.toHaveBeenCalled();
  });
  it("rejects partial, duplicate, postponed, live and inconsistent official games", async () => {
    const invalid = [
      { gameWeek: [] },
      { gameWeek: [schedule().gameWeek[0], schedule().gameWeek[0]] },
      { gameWeek: [{ date: input.date, games: [game(2026010001)] }] },
      { gameWeek: [{ date: input.date, games: [...schedule().gameWeek[0].games, game(2026010001)] }] },
      ...[{ gameState: "LIVE" }, { gameScheduleState: "PPD" }, { season: 20252026 }, { startTimeUTC: "2026-09-16T11:00:00Z" },
        { startTimeUTC: "2026-09-20T23:00:00Z" }, { awayTeam: { id: 19 } }]
        .map((change) => ({ gameWeek: [{ date: input.date, games: [{ ...game(2026010001), ...change }, game(2026010003)] }] })),
    ];
    for (const source of invalid) {
      getMock.mockResolvedValueOnce(source);
      const { res, db } = await request(input);
      expect(res.statusCode).toBe(503);
      expect(db.from).not.toHaveBeenCalled();
    }
  });
  it("surfaces a failed atomic insert without claiming success or falling back to whole-season ingestion", async () => {
    const db = database();
    db.insert.mockImplementation(() => ({ select: vi.fn(async () => ({ data: null, error: { code: "23505" } })) }) as any);
    const { planHash } = prepareBoundedSchedule(schedule(), input);
    const { res } = await request({ ...input, dryRun: false, expectedPlanHash: planHash }, db);
    expect(res.statusCode).toBe(503);
    expect(res.body.success).toBe(false);
    expect(getCurrentSeasonMock).not.toHaveBeenCalled();
  });
});
