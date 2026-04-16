import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, getCurrentSeasonMock, sharedSupabaseMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  getCurrentSeasonMock: vi.fn(),
  sharedSupabaseMock: {
    from: vi.fn((table: string) => ({
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

import handler from "../../../../../pages/api/v1/db/update-games";

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
