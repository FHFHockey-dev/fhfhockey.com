import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchTeamRatingsMock, fromMock } = vi.hoisted(() => ({
  fetchTeamRatingsMock: vi.fn(),
  fromMock: vi.fn()
}));

vi.mock("lib/teamRatingsService", () => ({
  fetchTeamRatings: fetchTeamRatingsMock,
  isValidIsoDate: (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: fromMock
  }
}));

vi.mock("lib/sustainability/bandService", () => ({
  computeAndStoreTrendBands: vi.fn(async () => ({ rows: [] })),
  parseDateParam: (value: unknown) => String(value ?? "2026-03-04"),
  parseMetricParam: () => ["sh_pct"],
  parseWindowParam: () => ["l10"]
}));

import teamRatingsHandler from "pages/api/team-ratings";
import trendBandsHandler from "pages/api/v1/sustainability/trend-bands";
import forgeGoaliesHandler from "pages/api/v1/forge/goalies";
import forgeAccuracyHandler from "pages/api/v1/forge/accuracy";

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
    json(payload: any) {
      this.body = payload;
      return this;
    }
  };
  return res;
}

describe("Dashboard Endpoint 4xx Behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchTeamRatingsMock.mockResolvedValue([]);
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          lte: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: null, error: null })
              })
            })
          })
        })
      })
    });
  });

  it("returns 400 for /api/team-ratings when date is invalid", async () => {
    const req: any = { method: "GET", query: { date: "03-04-2026" } };
    const res = createMockRes();

    await teamRatingsHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body?.error).toMatch(/YYYY-MM-DD/i);
  });

  it("returns 405 for /api/team-ratings on non-GET", async () => {
    const req: any = { method: "POST", query: {} };
    const res = createMockRes();

    await teamRatingsHandler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.body?.error).toMatch(/method not allowed/i);
  });

  it("returns 400 for /api/v1/sustainability/trend-bands when player_id missing", async () => {
    const req: any = { method: "GET", query: { window: "l10" } };
    const res = createMockRes();

    await trendBandsHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body?.message).toMatch(/invalid player_id/i);
  });

  it("returns 400 for /api/v1/forge/goalies when horizon is out of range", async () => {
    const req: any = {
      method: "GET",
      query: {
        date: "2026-03-04",
        horizon: "11"
      }
    };
    const res = createMockRes();

    await forgeGoaliesHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body?.error).toMatch(/invalid query parameters/i);
  });

  it("returns 400 for /api/v1/forge/accuracy when scope is invalid", async () => {
    const req: any = {
      method: "GET",
      query: {
        endDate: "2026-03-04",
        days: "30",
        scope: "invalid-scope"
      }
    };
    const res = createMockRes();

    await forgeAccuracyHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body?.error).toMatch(/invalid query parameters/i);
  });

  it.each([
    ["empty", []],
    ["all-zero", [{ date: "2026-03-04", accuracy_avg: 0 }]]
  ])("returns 200 empty for /api/v1/forge/accuracy when the series is %s", async (_label, rows) => {
    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          lte: () => ({
            order: () => ({
              limit: async () => ({ data: rows, error: null })
            })
          })
        })
      })
    });
    const req: any = {
      method: "GET",
      query: { endDate: "2026-03-04", days: "30", scope: "overall" }
    };
    const res = createMockRes();

    await forgeAccuracyHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      scope: "overall",
      endDate: "2026-03-04",
      days: 30,
      data: [],
      empty: true
    });
  });

  it("defaults /api/v1/forge/accuracy to the Eastern-time date, not the UTC date (L3)", async () => {
    const lteCalls: unknown[][] = [];
    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          lte: (...args: unknown[]) => {
            lteCalls.push(args);
            return { order: () => ({ limit: async () => ({ data: [], error: null }) }) };
          }
        })
      })
    });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-17T03:30:00Z"));
    try {
      const res = createMockRes();
      await forgeAccuracyHandler({ method: "GET", query: { scope: "overall" } } as any, res);
      expect(res.statusCode).toBe(200);
      expect(lteCalls).toEqual([["date", "2026-11-16"]]);
      expect(res.body.endDate).toBe("2026-11-16");
    } finally {
      vi.useRealTimers();
    }
  });
});
