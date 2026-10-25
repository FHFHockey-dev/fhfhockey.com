import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
});

const { fetchCurrentSeasonMock, supabaseState } = vi.hoisted(() => ({
  fetchCurrentSeasonMock: vi.fn(),
  supabaseState: {
    current: {
      from() {
        throw new Error("Supabase mock not configured for this test.");
      },
    } as { from: (table: string) => unknown },
  },
}));

vi.mock("dotenv", () => ({
  default: { config: vi.fn() },
}));

vi.mock("../../../../../utils/fetchCurrentSeason", () => ({
  fetchCurrentSeason: fetchCurrentSeasonMock,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from(table: string) {
      return supabaseState.current.from(table);
    },
  }),
}));

import handler from "../../../../../pages/api/v1/trends/goalie-power";
import { GOALIE_TREND_CATEGORIES } from "../../../../../lib/trends/goalieMetricConfig";

// Mirrors `max_rows` in supabase/config.toml: PostgREST silently caps every
// response at this many rows, whatever range the client asks for.
const SERVER_MAX_ROWS = 1000;

function buildSupabaseMock(
  metricRows: Array<Record<string, unknown>>,
  rangeCalls: Array<[number, number]>,
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
          order() {
            return this;
          },
          range(from: number, to: number) {
            this.rangeStart = from;
            this.rangeEnd = to;
            rangeCalls.push([from, to]);
            return this;
          },
          then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
            const requested = metricRows.slice(this.rangeStart, this.rangeEnd + 1);
            return Promise.resolve(
              resolve({ data: requested.slice(0, SERVER_MAX_ROWS), error: null }),
            );
          },
        };
        return query;
      }

      if (table === "players") {
        return {
          select() {
            return this;
          },
          in(_column: string, ids: number[]) {
            return Promise.resolve({
              data: ids.map((id) => ({
                id,
                fullName: `Goalie ${id}`,
                position: "G",
                team_id: 1,
                image_url: null,
              })),
              error: null,
            });
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

function createMockRes() {
  return {
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, string | string[]>,
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
    },
  } as any;
}

describe("/api/v1/trends/goalie-power", () => {
  it("redacts dependency details from internal-error responses", async () => {
    fetchCurrentSeasonMock.mockRejectedValueOnce(
      new Error("relation private_seasons denied Bearer secret"),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const res = createMockRes();

    await handler({ method: "GET", query: { limit: "10", window: "5", date: "2026-02-02" } } as any, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      message: "Failed to load goalie trend data.",
      error: "GOALIE_TRENDS_UNAVAILABLE",
      limit: 10,
      windowSize: 5,
    });
    expect(JSON.stringify(res.body)).not.toContain("secret");
    consoleError.mockRestore();
  });

  it("retries a failed load on the next request instead of replaying the rejection", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const query = { method: "GET", query: { limit: "12", window: "5", date: "2026-02-03" } } as any;
    fetchCurrentSeasonMock.mockClear();
    fetchCurrentSeasonMock.mockRejectedValueOnce(new Error("transient outage"));
    const failed = createMockRes();
    await handler(query, failed);
    expect(failed.statusCode).toBe(500);

    fetchCurrentSeasonMock.mockResolvedValueOnce({ id: 20252026, startDate: "2025-10-07" });
    supabaseState.current = buildSupabaseMock([], []);
    const retried = createMockRes();
    await handler(query, retried);

    expect(retried.statusCode).toBe(200);
    expect(fetchCurrentSeasonMock).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });

  it("keeps paging past a server-capped page instead of treating it as the last page", async () => {
    fetchCurrentSeasonMock.mockResolvedValueOnce({
      id: 20252026,
      startDate: "2025-10-07",
    });
    // 30 goalies x 50 games = 1,500 rows per metric, ordered by player then date,
    // so goalies 21-30 only appear after the first 1,000 rows.
    const metricRows: Array<Record<string, unknown>> = [];
    for (let playerId = 1; playerId <= 30; playerId += 1) {
      for (let game = 0; game < 50; game += 1) {
        const gameDate = new Date(Date.UTC(2025, 9, 8) + game * 86_400_000)
          .toISOString()
          .slice(0, 10);
        metricRows.push({
          player_id: playerId,
          game_date: gameDate,
          raw_value: 0.9 + playerId / 1000,
          rolling_avg_3: 0.9,
          rolling_avg_5: 0.9,
          rolling_avg_10: 0.9,
          season_id: 20252026,
        });
      }
    }
    const rangeCalls: Array<[number, number]> = [];
    supabaseState.current = buildSupabaseMock(metricRows, rangeCalls);

    const res = createMockRes();
    await handler(
      { method: "GET", query: { date: "2025-11-26", limit: "40" } } as any,
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.coverage.playerCount).toBe(30);
    expect(res.body.playerMetadata["30"]).toMatchObject({ id: 30 });
    for (const [from, to] of rangeCalls) {
      expect(to - from + 1).toBeLessThanOrEqual(SERVER_MAX_ROWS);
    }
    expect(rangeCalls.filter(([from]) => from === 1000)).toHaveLength(
      GOALIE_TREND_CATEGORIES.length,
    );
  });
});
