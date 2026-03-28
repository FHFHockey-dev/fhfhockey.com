import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, fetchCurrentSeasonMock, fetchTeamRatingsMock } = vi.hoisted(
  () => ({
    fromMock: vi.fn(),
    fetchCurrentSeasonMock: vi.fn(),
    fetchTeamRatingsMock: vi.fn()
  })
);

vi.mock("lib/supabase/server", () => ({
  default: {
    from: fromMock
  }
}));

vi.mock("utils/fetchCurrentSeason", () => ({
  fetchCurrentSeason: fetchCurrentSeasonMock
}));

vi.mock("lib/teamRatingsService", () => ({
  fetchTeamRatings: fetchTeamRatingsMock
}));

vi.mock("pages/api/v1/projections/_helpers", async () => {
  const actual = await vi.importActual<any>("pages/api/v1/projections/_helpers");
  return {
    ...actual,
    requireLatestSucceededRunId: vi.fn(async () => "run-123")
  };
});

type QueryResult = {
  data?: any;
  error: null;
};

function createQueryBuilder(resolver: () => QueryResult) {
  const builder: any = {
    select() {
      return builder;
    },
    eq() {
      return builder;
    },
    in() {
      return builder;
    },
    gte() {
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
      return Promise.resolve(resolve({ data: out.data ?? [], error: out.error }));
    }
  };
  return builder;
}

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

describe("/api/v1/start-chart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchCurrentSeasonMock.mockResolvedValue({ id: 20252026 });
    fetchTeamRatingsMock.mockResolvedValue([
      {
        teamAbbr: "TOR",
        date: "2026-02-07",
        offRating: 80,
        defRating: 75,
        paceRating: 78,
        ppTier: 1,
        pkTier: 2,
        trend10: 4,
        components: {
          xgf60: 3.1,
          gf60: 3.0,
          sf60: 32,
          xga60: 3.0,
          ga60: 2.9,
          sa60: 29,
          pace60: 61
        },
        finishingRating: null,
        goalieRating: null,
        dangerRating: null,
        specialRating: null,
        disciplineRating: null,
        varianceFlag: null
      },
      {
        teamAbbr: "MTL",
        date: "2026-02-07",
        offRating: 70,
        defRating: 68,
        paceRating: 71,
        ppTier: 2,
        pkTier: 2,
        trend10: -2,
        components: {
          xgf60: 2.6,
          gf60: 2.5,
          sf60: 28,
          xga60: 2.8,
          ga60: 2.9,
          sa60: 31,
          pace60: 58
        },
        finishingRating: null,
        goalieRating: null,
        dangerRating: null,
        specialRating: null,
        disciplineRating: null,
        varianceFlag: null
      }
    ]);

    fromMock.mockImplementation((table: string) => {
      if (table === "player_projections") {
        throw new Error("legacy player_projections should not be queried");
      }
      if (table === "games") {
        return createQueryBuilder(() => ({
          data: [
            {
              id: 1001,
              date: "2026-02-07",
              homeTeamId: 10,
              awayTeamId: 8
            }
          ],
          error: null
        }));
      }
      if (table === "forge_player_projections") {
        return createQueryBuilder(() => ({
          data: [
            {
              run_id: "run-123",
              as_of_date: "2026-02-07",
              player_id: 8478402,
              team_id: 8,
              game_id: 1001,
              opponent_team_id: 10,
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
              proj_pim: 0.1
            }
          ],
          error: null
        }));
      }
      if (table === "goalie_start_projections") {
        return createQueryBuilder(() => ({
          data: [
            {
              game_id: 1001,
              team_id: 10,
              player_id: 9001,
              start_probability: 0.72,
              projected_gsaa_per_60: 0.18,
              confirmed_status: true
            }
          ],
          error: null
        }));
      }
      if (table === "yahoo_nhl_player_map_mat") {
        return createQueryBuilder(() => ({
          data: [
            { nhl_player_id: "8478402", yahoo_player_id: "5001" },
            { nhl_player_id: "9001", yahoo_player_id: "5002" }
          ],
          error: null
        }));
      }
      if (table === "yahoo_players") {
        return createQueryBuilder(() => ({
          data: [
            {
              player_id: "5001",
              player_name: "Nick Suzuki",
              full_name: "Nick Suzuki",
              eligible_positions: ["C"],
              percent_ownership: 78,
              ownership_timeline: []
            },
            {
              player_id: "5002",
              player_name: "Goalie A",
              full_name: "Goalie A",
              eligible_positions: ["G"],
              percent_ownership: 41,
              ownership_timeline: []
            }
          ],
          error: null
        }));
      }
      if (table === "team_ctpi_daily") {
        return createQueryBuilder(() => ({
          data: [
            { date: "2026-02-01", team: "MTL", ctpi_0_to_100: 55 },
            { date: "2026-02-01", team: "TOR", ctpi_0_to_100: 61 }
          ],
          error: null
        }));
      }
      return createQueryBuilder(() => ({ data: [], error: null }));
    });
  });

  it("reads skaters from forge_player_projections and exposes canonical-source metadata", async () => {
    vi.resetModules();
    const handler = (await import("../../../../pages/api/v1/start-chart")).default;
    const req: any = {
      method: "GET",
      query: {
        date: "2026-02-07"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      dateUsed: "2026-02-07",
      requestedDate: "2026-02-07",
      fallbackApplied: false,
      serving: {
        requestedDate: "2026-02-07",
        resolvedDate: "2026-02-07",
        fallbackApplied: false,
        isSameDay: true,
        state: "same_day",
        strategy: "requested_date"
      },
      projectionRunId: "run-123",
      skaterSource: "forge_player_projections",
      goalieSource: "goalie_start_projections",
      legacyPlayerProjectionsUsed: false
    });
    const skater = res.body.players.find(
      (player: any) => player.player_id === 8478402
    );
    expect(skater).toBeTruthy();
    expect(skater.name).toBe("Nick Suzuki");
    expect(skater.proj_goals).toBeCloseTo(0.6, 6);
    expect(skater.proj_assists).toBeCloseTo(0.6, 6);
    expect(skater.proj_shots).toBeCloseTo(3.5, 6);
    expect(skater.proj_fantasy_points).toBeCloseTo(4.75, 6);
    expect(fromMock.mock.calls.map((call) => call[0])).not.toContain(
      "player_projections"
    );
  });

  it("reports previous-date fallback serving state when the requested slate has no games", async () => {
    let gamesQueryCount = 0;
    fetchTeamRatingsMock.mockResolvedValue([]);
    fromMock.mockImplementation((table: string) => {
      if (table === "player_projections") {
        throw new Error("legacy player_projections should not be queried");
      }
      if (table === "games") {
        gamesQueryCount += 1;
        if (gamesQueryCount === 1) {
          return createQueryBuilder(() => ({
            data: [],
            error: null
          }));
        }
        return createQueryBuilder(() => ({
          data: [
            {
              id: 1002,
              date: "2026-02-07",
              homeTeamId: 10,
              awayTeamId: 8
            }
          ],
          error: null
        }));
      }
      if (table === "forge_player_projections") {
        return createQueryBuilder(() => ({
          data: [
            {
              run_id: "run-123",
              as_of_date: "2026-02-07",
              player_id: 8478402,
              team_id: 8,
              game_id: 1002,
              opponent_team_id: 10,
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
              proj_pim: 0.1
            }
          ],
          error: null
        }));
      }
      if (table === "goalie_start_projections") {
        return createQueryBuilder(() => ({
          data: [],
          error: null
        }));
      }
      if (table === "yahoo_nhl_player_map_mat") {
        return createQueryBuilder(() => ({
          data: [{ nhl_player_id: "8478402", yahoo_player_id: "5001" }],
          error: null
        }));
      }
      if (table === "yahoo_players") {
        return createQueryBuilder(() => ({
          data: [
            {
              player_id: "5001",
              player_name: "Nick Suzuki",
              full_name: "Nick Suzuki",
              eligible_positions: ["C"],
              percent_ownership: 78,
              ownership_timeline: []
            }
          ],
          error: null
        }));
      }
      if (table === "team_ctpi_daily") {
        return createQueryBuilder(() => ({
          data: [],
          error: null
        }));
      }
      return createQueryBuilder(() => ({ data: [], error: null }));
    });

    vi.resetModules();
    const handler = (await import("../../../../pages/api/v1/start-chart")).default;
    const req: any = {
      method: "GET",
      query: {
        date: "2026-02-08"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      dateUsed: "2026-02-07",
      requestedDate: "2026-02-08",
      fallbackApplied: true,
      serving: {
        requestedDate: "2026-02-08",
        resolvedDate: "2026-02-07",
        fallbackApplied: true,
        isSameDay: false,
        state: "fallback",
        strategy: "previous_date_with_games"
      }
    });
  });
});
