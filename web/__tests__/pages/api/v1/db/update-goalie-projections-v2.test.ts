import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock, gamesGteMock, gamesLteMock, storedGameDate, upsertMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  gamesGteMock: vi.fn(),
  gamesLteMock: vi.fn(),
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
vi.mock("lib/cors-fetch", () => ({ default: fetchMock }));
vi.mock("lib/supabase/server", () => ({
  default: {
    from: (table: string) => {
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
        upsert: upsertMock
      };
    }
  }
}));

import handler, {
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
    storedGameDate.value = "2026-10-21";
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes("/season?")
          ? { data: [{ startDate: "2026-10-07T00:00:00" }] }
          : {
              data: [
                {
                  playerId: 8470000,
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
      expect.objectContaining({ game_id: 2, team_id: 2, player_id: 8470000, start_probability: 1 })
    ]);
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
      [{ id: 1 }, { id: 2 }, { id: 3 }],
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
      [{ id: 1 }, { id: 2 }],
      { onConflict: "game_id, player_id" }
    );
  });
});
