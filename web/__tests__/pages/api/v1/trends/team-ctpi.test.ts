import { beforeEach, describe, expect, it, vi } from "vitest";

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
      }
    } as { from: (table: string) => unknown }
  }
}));

vi.mock("dotenv", () => ({
  default: { config: vi.fn() }
}));

vi.mock("../../../../../utils/fetchCurrentSeason", () => ({
  fetchCurrentSeason: fetchCurrentSeasonMock
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from(table: string) {
      return supabaseState.current.from(table);
    }
  })
}));

import handler from "../../../../../pages/api/v1/trends/team-ctpi";

function createMockRes() {
  return {
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
}

describe("/api/v1/trends/team-ctpi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchCurrentSeasonMock.mockResolvedValue({
      id: 20252026,
      startDate: "2025-10-07"
    });
  });

  it("paginates daily rows and reports source-date freshness instead of request time", async () => {
    const rows = Array.from({ length: 1001 }, (_, index) => ({
      team: `T${index % 32}`,
      date: index === 1000 ? "2026-02-01" : "2026-01-31",
      ctpi_raw: 0.5,
      ctpi_0_to_100: 55,
      offense: 0.2,
      defense: 0.1,
      goaltending: 0.05,
      special_teams: 0.05,
      luck: 0.1,
      computed_at: "2026-02-02T12:00:00.000Z"
    }));
    const rangeCalls: Array<[number, number]> = [];

    supabaseState.current = {
      from(table: string) {
        if (table !== "team_ctpi_daily") {
          throw new Error(`Unexpected table: ${table}`);
        }
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          lte() {
            return this;
          },
          order() {
            return this;
          },
          range(from: number, to: number) {
            rangeCalls.push([from, to]);
            return Promise.resolve({
              data: rows.slice(from, to + 1),
              error: null
            });
          }
        };
      }
    };

    const req: any = {
      method: "GET",
      query: { date: "2026-02-02" }
    };
    const res = createMockRes();

    await handler(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(rangeCalls).toEqual([
      [0, 999],
      [1000, 1999]
    ]);
    expect(res.body).toMatchObject({
      requestedDate: "2026-02-02",
      dateUsed: "2026-02-01",
      fallbackApplied: true,
      generatedAt: "2026-02-01T23:59:59.999Z",
      source: {
        kind: "team_ctpi_daily",
        sourceDate: "2026-02-01",
        computedAt: "2026-02-02T12:00:00.000Z",
        rowCount: 1001
      },
      coverage: {
        expectedTeams: 32,
        teamCount: 32,
        sourceRowCount: 1001,
        partial: true
      }
    });
    expect(res.body.warnings).toEqual([
      "CTPI is using the latest available fallback date."
    ]);
    expect(res.body.teams).toHaveLength(32);
  });
});
