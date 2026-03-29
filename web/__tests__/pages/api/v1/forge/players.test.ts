import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, requireLatestSucceededRunIdMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  requireLatestSucceededRunIdMock: vi.fn()
}));

vi.mock("pages/api/v1/projections/_helpers", async () => {
  const actual = await vi.importActual<any>("pages/api/v1/projections/_helpers");
  return {
    ...actual,
    requireLatestSucceededRunId: requireLatestSucceededRunIdMock
  };
});

type QueryResult = {
  data?: any;
  count?: number;
  error: null;
};

function createQueryBuilder(resolver: () => QueryResult) {
  const state = {
    isHeadCount: false
  };
  const builder: any = {
    select(_columns: string, options?: { head?: boolean }) {
      state.isHeadCount = Boolean(options?.head);
      return builder;
    },
    eq() {
      return builder;
    },
    lte() {
      return builder;
    },
    order() {
      return builder;
    },
    limit() {
      return builder;
    },
    maybeSingle() {
      const out = resolver();
      const data = Array.isArray(out.data) ? (out.data[0] ?? null) : out.data ?? null;
      return Promise.resolve({ data, error: out.error });
    },
    then(resolve: (value: any) => any) {
      const out = resolver();
      if (state.isHeadCount) {
        return Promise.resolve(resolve({ count: out.count ?? 0, error: out.error }));
      }
      return Promise.resolve(resolve({ data: out.data ?? [], error: out.error }));
    }
  };
  return builder;
}

vi.mock("lib/supabase/server", () => ({
  default: {
    from: fromMock
  }
}));

import handler from "../../../../../pages/api/v1/forge/players";

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

describe("/api/v1/forge/players", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireLatestSucceededRunIdMock.mockResolvedValue("run-123");
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_player_projections") {
        return createQueryBuilder(() => ({
          data: [
            {
              player_id: 8478402,
              players: { fullName: "Nick Suzuki", position: "C" },
              teams: { name: "Canadiens" },
              proj_goals_es: 0.4,
              proj_goals_pp: 0.2,
              proj_goals_pk: 0,
              proj_assists_es: 0.5,
              proj_assists_pp: 0.1,
              proj_assists_pk: 0,
              proj_shots_es: 2.7,
              proj_shots_pp: 0.8,
              proj_shots_pk: 0,
              proj_hits: 0.6,
              proj_blocks: 0.4,
              uncertainty: {
                model: {
                  confidence_tier: "MEDIUM"
                }
              }
            }
          ],
          error: null
        }));
      }
      if (table === "seasons") {
        return createQueryBuilder(() => ({
          data: { id: 20252026 },
          error: null
        }));
      }
      if (table === "rosters") {
        return createQueryBuilder(() => ({
          data: [{ playerId: 8478402 }],
          error: null
        }));
      }
      return createQueryBuilder(() => ({ data: [], count: 0, error: null }));
    });
  });

  it("returns canonical skater aggregates from forge_player_projections", async () => {
    const req: any = {
      method: "GET",
      query: {
        date: "2026-02-07",
        horizon: "1"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      runId: "run-123",
      asOfDate: "2026-02-07",
      requestedDate: "2026-02-07",
      horizonGames: 1,
      fallbackApplied: false,
      scanSummary: {
        surface: "forge_players_reader",
        requestedDate: "2026-02-07",
        activeDataDate: "2026-02-07",
        fallbackApplied: false,
        status: "ready",
        rowCounts: {
          returned: 1
        },
        blockingIssueCount: 0
      },
      compatibilityInventory: {
        inventoryVersion: "forge-compatibility-inventory-v2",
        canonicalRoute: "/api/v1/forge/players",
        legacyRoute: "/api/v1/projections/players",
        status: "canonical_preferred"
      },
      serving: {
        requestedDate: "2026-02-07",
        resolvedDate: "2026-02-07",
        fallbackApplied: false,
        isSameDay: true,
        state: "same_day",
        strategy: "requested_date"
      }
    });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      player_id: 8478402,
      player_name: "Nick Suzuki",
      team_name: "Canadiens",
      position: "C",
      hit: 0.6,
      blk: 0.4
    });
    expect(res.body.data[0].g).toBeCloseTo(0.6, 6);
    expect(res.body.data[0].a).toBeCloseTo(0.6, 6);
    expect(res.body.data[0].pts).toBeCloseTo(1.2, 6);
    expect(res.body.data[0].ppp).toBeCloseTo(0.3, 6);
    expect(res.body.data[0].sog).toBeCloseTo(3.5, 6);
  });

  it("reports fallback serving state when it serves the latest prior date with skater rows", async () => {
    let projectionQueryCount = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_player_projections") {
        projectionQueryCount += 1;
        if (projectionQueryCount === 1) {
          return createQueryBuilder(() => ({
            data: [],
            error: null
          }));
        }
        if (projectionQueryCount === 2) {
          return createQueryBuilder(() => ({
            count: 1,
            error: null
          }));
        }
        return createQueryBuilder(() => ({
          data: [
            {
              player_id: 8478402,
              players: { fullName: "Fallback Skater", position: "C" },
              teams: { name: "Canadiens" },
              proj_goals_es: 0.3,
              proj_goals_pp: 0.1,
              proj_goals_pk: 0,
              proj_assists_es: 0.4,
              proj_assists_pp: 0.2,
              proj_assists_pk: 0,
              proj_shots_es: 2.1,
              proj_shots_pp: 0.7,
              proj_shots_pk: 0,
              proj_hits: 0.5,
              proj_blocks: 0.2,
              uncertainty: null
            }
          ],
          error: null
        }));
      }
      if (table === "forge_runs") {
        return createQueryBuilder(() => ({
          data: [
            {
              run_id: "run-122",
              as_of_date: "2026-02-06"
            }
          ],
          error: null
        }));
      }
      if (table === "seasons") {
        return createQueryBuilder(() => ({
          data: { id: 20252026 },
          error: null
        }));
      }
      if (table === "rosters") {
        return createQueryBuilder(() => ({
          data: [{ playerId: 8478402 }],
          error: null
        }));
      }
      return createQueryBuilder(() => ({ data: [], count: 0, error: null }));
    });

    const req: any = {
      method: "GET",
      query: {
        date: "2026-02-07",
        horizon: "1"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      runId: "run-122",
      asOfDate: "2026-02-06",
      requestedDate: "2026-02-07",
      fallbackApplied: true,
      scanSummary: {
        surface: "forge_players_reader",
        requestedDate: "2026-02-07",
        activeDataDate: "2026-02-06",
        fallbackApplied: true,
        status: "ready",
        rowCounts: {
          returned: 1
        },
        blockingIssueCount: 0
      },
      compatibilityInventory: {
        inventoryVersion: "forge-compatibility-inventory-v2",
        canonicalRoute: "/api/v1/forge/players",
        legacyRoute: "/api/v1/projections/players",
        status: "canonical_preferred"
      },
      serving: {
        requestedDate: "2026-02-07",
        resolvedDate: "2026-02-06",
        fallbackApplied: true,
        isSameDay: false,
        state: "fallback",
        strategy: "latest_available_with_data"
      }
    });
    expect(res.body.data[0]).toMatchObject({
      player_name: "Fallback Skater"
    });
  });
});
