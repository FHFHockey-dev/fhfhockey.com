import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
});

const { fetchCurrentSeasonMock, createClientMock, supabaseState } = vi.hoisted(() => ({
  fetchCurrentSeasonMock: vi.fn(),
  createClientMock: vi.fn(),
  supabaseState: {
    current: {
      from() {
        throw new Error("Supabase mock not configured for this test.");
      }
    } as { from: (table: string) => unknown }
  }
}));

vi.mock("dotenv", () => ({
  default: {
    config: vi.fn()
  }
}));

vi.mock("../../../../../utils/fetchCurrentSeason", () => ({
  fetchCurrentSeason: fetchCurrentSeasonMock
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => {
    createClientMock(...args);
    return {
      from(table: string) {
        return supabaseState.current.from(table);
      }
    };
  }
}));

import handler from "../../../../../pages/api/v1/trends/skater-power";

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

function buildSupabaseMock(
  metricRows: Array<Record<string, unknown>>,
  rangeCalls: Array<[number, number]> = []
) {
  return {
    from(table: string) {
      if (table === "player_trend_metrics") {
        const query = {
          rangeStart: 0,
          rangeEnd: metricRows.length - 1,
          select() {
            return this;
          },
          eq() {
            return this;
          },
          gte() {
            return this;
          },
          lte() {
            return this;
          },
          in() {
            return this;
          },
          order() {
            return this;
          },
          range(from: number, to: number) {
            this.rangeStart = from;
            this.rangeEnd = to;
            rangeCalls.push([from, to]);
            return this;
          },
          then(resolve: (value: { data: Array<Record<string, unknown>>; error: null }) => unknown) {
            return Promise.resolve(
              resolve({
                data: metricRows.slice(this.rangeStart, this.rangeEnd + 1),
                error: null
              })
            );
          }
        };
        return query;
      }

      if (table === "players") {
        return {
          select() {
            return this;
          },
          in() {
            return Promise.resolve({
              data: [
                {
                  id: 8471214,
                  fullName: "Fallback Skater",
                  position: "C",
                  team_id: 1,
                  image_url: null
                }
              ],
              error: null
            });
          }
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }
  };
}

describe("/api/v1/trends/skater-power", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchCurrentSeasonMock.mockResolvedValue({
      id: 20252026,
      startDate: "2025-10-07"
    });
  });

  it("returns a blocked serving contract when the latest trend scope is materially older than requested", async () => {
    supabaseState.current = buildSupabaseMock([
      {
        player_id: 8471214,
        game_date: "2025-10-16",
        raw_value: 2.1,
        rolling_avg_3: 2.0,
        rolling_avg_5: 1.9,
        rolling_avg_10: 1.8,
        season_id: 20252026,
        position_code: "C"
      }
    ]);

    const req: any = {
      method: "GET",
      query: {
        date: "2026-02-07",
        position: "forward",
        window: "5",
        limit: "10"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      requestedDate: "2026-02-07",
      dateUsed: "2025-10-16",
      fallbackApplied: true,
      serving: {
        requestedDate: "2026-02-07",
        resolvedDate: "2025-10-16",
        fallbackApplied: true,
        state: "fallback",
        strategy: "latest_available_with_data",
        severity: "error",
        status: "blocked"
      }
    });
    expect(res.body.serving.gapDays).toBeGreaterThanOrEqual(14);
    expect(res.body.serving.message).toContain("materially stale");
    expect(res.body.generatedAt).toBe("2025-10-16T23:59:59.999Z");
  });

  it("returns requested-date serving when the latest scope matches the dashboard date", async () => {
    supabaseState.current = buildSupabaseMock([
      {
        player_id: 8471214,
        game_date: "2026-02-08",
        raw_value: 2.1,
        rolling_avg_3: 2.0,
        rolling_avg_5: 1.9,
        rolling_avg_10: 1.8,
        season_id: 20252026,
        position_code: "C"
      }
    ]);

    const req: any = {
      method: "GET",
      query: {
        date: "2026-02-08",
        position: "forward",
        window: "5",
        limit: "10"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      requestedDate: "2026-02-08",
      dateUsed: "2026-02-08",
      fallbackApplied: false,
      serving: {
        requestedDate: "2026-02-08",
        resolvedDate: "2026-02-08",
        fallbackApplied: false,
        state: "same_day",
        strategy: "requested_date",
        severity: "none",
        status: "requested_date",
        message: null
      }
    });
    expect(res.body.serving.gapDays).toBe(0);
    expect(res.body.generatedAt).toBe("2026-02-08T23:59:59.999Z");
  });

  it("continues past the default 1000-row PostgREST page cap", async () => {
    const rangeCalls: Array<[number, number]> = [];
    supabaseState.current = buildSupabaseMock(
      Array.from({ length: 1001 }, (_, index) => ({
        player_id: 8_470_000 + index,
        game_date: index === 1000 ? "2026-02-09" : "2026-02-08",
        raw_value: index + 1,
        rolling_avg_3: index + 1,
        rolling_avg_5: index + 1,
        rolling_avg_10: index + 1,
        season_id: 20252026,
        position_code: "C"
      })),
      rangeCalls
    );

    const req: any = {
      method: "GET",
      query: {
        date: "2026-02-09",
        position: "forward",
        window: "5",
        limit: "10"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.dateUsed).toBe("2026-02-09");
    expect(rangeCalls).toContainEqual([0, 999]);
    expect(rangeCalls).toContainEqual([1000, 1999]);
  });

  it("supports a 20-game window by averaging the trailing raw values", async () => {
    supabaseState.current = buildSupabaseMock(
      Array.from({ length: 21 }, (_, index) => ({
        player_id: 8471214,
        game_date: `2026-02-${String(index + 1).padStart(2, "0")}`,
        raw_value: index + 1,
        rolling_avg_3: index + 1,
        rolling_avg_5: index + 1,
        rolling_avg_10: index + 1,
        season_id: 20252026,
        position_code: "C"
      }))
    );

    const req: any = {
      method: "GET",
      query: {
        date: "2026-02-21",
        position: "forward",
        window: "20",
        limit: "10"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.windowSize).toBe(20);
    expect(res.body.categories.shotsPer60.rankings[0].latestValue).toBeCloseTo(11.5, 5);
  });

  it("shrinks tiny-sample percentiles toward neutral and suppresses rank deltas", async () => {
    supabaseState.current = buildSupabaseMock(
      [8471214, 8471215].flatMap((playerId, playerIndex) =>
        Array.from({ length: 6 }, (_, index) => ({
          player_id: playerId,
          game_date: `2026-04-${String(index + 1).padStart(2, "0")}`,
          raw_value: playerIndex === 0 ? index + 10 : index + 1,
          rolling_avg_3: playerIndex === 0 ? index + 10 : index + 1,
          rolling_avg_5: playerIndex === 0 ? index + 10 : index + 1,
          rolling_avg_10: playerIndex === 0 ? index + 10 : index + 1,
          season_id: 20252026,
          position_code: "C"
        }))
      )
    );

    const req: any = {
      method: "GET",
      query: {
        date: "2026-04-06",
        position: "forward",
        window: "1",
        limit: "10"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.samplePolicy).toEqual({
      minimumGames: 10,
      lowSamplePercentiles: "shrink_to_neutral",
      suppressLowSampleRankDelta: true
    });
    expect(res.body.categories.shotsPer60.rankings[0]).toMatchObject({
      percentile: 80,
      rawPercentile: 100,
      gp: 6,
      sampleConfidence: "low",
      minimumSampleGames: 10,
      previousRank: null,
      delta: 0
    });
  });
});
