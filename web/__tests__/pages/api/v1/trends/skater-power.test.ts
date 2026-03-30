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

function buildSupabaseMock(metricRows: Array<Record<string, unknown>>) {
  return {
    from(table: string) {
      if (table === "player_trend_metrics") {
        const query = {
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
          range() {
            return this;
          },
          then(resolve: (value: { data: Array<Record<string, unknown>>; error: null }) => unknown) {
            return Promise.resolve(
              resolve({
                data: metricRows,
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
  });
});
