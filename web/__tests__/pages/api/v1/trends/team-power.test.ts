import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
});

const { fetchCurrentSeasonMock, rangeCalls, orderCalls, sourceRows } =
  vi.hoisted(() => ({
    fetchCurrentSeasonMock: vi.fn(),
    rangeCalls: [] as Array<{ table: string; from: number; to: number }>,
    orderCalls: [] as Array<{ table: string; column: string }>,
    sourceRows: new Map<string, Array<Record<string, unknown>>>(),
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
      return {
        select() {
          return this;
        },
        gte() {
          return this;
        },
        lte() {
          return this;
        },
        eq() {
          return this;
        },
        order(column: string) {
          orderCalls.push({ table, column });
          return this;
        },
        range(from: number, to: number) {
          rangeCalls.push({ table, from, to });
          return Promise.resolve({
            data: (sourceRows.get(table) ?? []).slice(from, to + 1),
            error: null,
          });
        },
      };
    },
  }),
}));

import handler from "../../../../../pages/api/v1/trends/team-power";

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

describe("/api/v1/trends/team-power", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rangeCalls.length = 0;
    orderCalls.length = 0;
    sourceRows.clear();
    fetchCurrentSeasonMock.mockResolvedValue({
      id: 20252026,
      startDate: "2025-10-07",
      regularSeasonEndDate: "2026-04-16",
      endDate: "2026-06-21",
    });
  });

  it("paginates every source and retains rows beyond the first PostgREST page", async () => {
    sourceRows.set(
      "nst_team_gamelogs_as_counts",
      Array.from({ length: 1001 }, (_, index) => ({
        team_abbreviation: index === 1000 ? "TOR" : "BOS",
        gp: index + 1,
        date: index === 1000 ? "2026-03-15" : "2026-03-14",
        gf: index === 1000 ? 2 : 1,
      })),
    );

    const res = createMockRes();
    await handler({ method: "GET" } as any, res);

    expect(res.statusCode).toBe(200);
    expect(rangeCalls).toEqual([
      { table: "nst_team_gamelogs_as_counts", from: 0, to: 999 },
      { table: "nst_team_gamelogs_as_counts", from: 1000, to: 1999 },
      { table: "nst_team_gamelogs_pp_counts", from: 0, to: 999 },
      { table: "nst_team_gamelogs_pk_counts", from: 0, to: 999 },
      { table: "wgo_team_stats", from: 0, to: 999 },
    ]);
    expect(orderCalls).toContainEqual({
      table: "nst_team_gamelogs_as_counts",
      column: "team_abbreviation",
    });
    expect(orderCalls).toContainEqual({
      table: "wgo_team_stats",
      column: "team_id",
    });
    expect(res.body.categories.offense.rankings).toEqual(
      expect.arrayContaining([expect.objectContaining({ team: "TOR" })]),
    );
    expect(res.body.generatedAt).toBe("2026-03-15T23:59:59.999Z");
    expect(res.body.dateUsed).toBe("2026-03-15");
    expect(res.body.coverage).toEqual({
      expectedTeams: 32,
      teamsWithData: 2,
      categoryCount: 4,
      sourceRows: { as: 1001, pp: 0, pk: 0, wgo: 0 },
      partial: true,
    });
    expect(res.body.warnings).toEqual([
      "Team trend coverage is incomplete for the current season.",
    ]);
  });
});
