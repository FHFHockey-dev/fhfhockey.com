import { beforeEach, describe, expect, it, vi } from "vitest";
import { evaluatePayloadBudget } from "lib/dashboard/perfBudget";
import { addStartChartPositionRanks } from "lib/projections/startChartFantasyScoring";
import { normalizeStartChartResponse } from "lib/projections/startChartContract";

const {
  fromMock,
  rpcMock,
  getSeasonForDateMock,
  fetchTeamRatingsAsOfMock,
  eqMock,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  getSeasonForDateMock: vi.fn(),
  fetchTeamRatingsAsOfMock: vi.fn(),
  eqMock: vi.fn(),
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: fromMock,
    rpc: rpcMock,
  },
}));

vi.mock("lib/NHL/server", () => ({
  getLatestStartedSeasonForDate: getSeasonForDateMock,
}));

vi.mock("lib/teamRatingsService", () => ({
  fetchTeamRatingsAsOf: fetchTeamRatingsAsOfMock,
}));

type QueryResult = {
  data?: any;
  error: { message?: string } | null;
};

function createQueryBuilder(resolver: () => QueryResult) {
  const builder: any = {
    select() {
      return builder;
    },
    eq(...args: unknown[]) {
      eqMock(...args);
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
    range() {
      return builder;
    },
    maybeSingle() {
      const out = resolver();
      const data = Array.isArray(out.data)
        ? (out.data[0] ?? null)
        : (out.data ?? null);
      return Promise.resolve({ data, error: out.error });
    },
    then(resolve: (value: any) => any) {
      const out = resolver();
      return Promise.resolve(
        resolve({ data: out.data ?? [], error: out.error }),
      );
    },
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
    },
  };
  return res;
}

const trustedTeamFormColumns = {
  publication_status: "approved",
  formula_version: "ctpi-formula-v1",
  input_version: "ctpi-one-game-input-v2",
  source_game_count: "10",
};

const defaultProjection = {
  run_id: "run-123",
  as_of_date: "2026-02-07",
  horizon_games: 1,
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
  proj_pim: 0.1,
};

describe("/api/v1/start-chart", () => {
  it("assigns deterministic competition ranks per eligible position", () => {
    const ranked = addStartChartPositionRanks([
      {
        player_id: 30,
        positions: ["C", "RW"],
        proj_fantasy_points: 4.5,
      },
      {
        player_id: 10,
        positions: ["C"],
        proj_fantasy_points: 4.5,
      },
      {
        player_id: 20,
        positions: ["C"],
        proj_fantasy_points: 4,
      },
      {
        player_id: 40,
        positions: ["G"],
        proj_fantasy_points: null,
        start_probability: null,
      },
    ]);

    expect(
      ranked.map(({ player_id, position_ranks }) => ({
        player_id,
        position_ranks,
      })),
    ).toEqual([
      { player_id: 30, position_ranks: { C: 1, RW: 1 } },
      { player_id: 10, position_ranks: { C: 1 } },
      { player_id: 20, position_ranks: { C: 3 } },
      { player_id: 40, position_ranks: {} },
    ]);
    expect(addStartChartPositionRanks([...ranked].reverse())).toEqual(
      [...ranked].reverse(),
    );
  });

  it("keeps duplicate-player game rows distinct while ranking deterministic ties", () => {
    const ranked = addStartChartPositionRanks([
      {
        row_key: "run-1:game-2:7:1",
        game_id: 2,
        team_id: 20,
        player_id: 7,
        positions: ["C"],
        proj_fantasy_points: 5,
      },
      {
        row_key: "run-1:game-1:7:1",
        game_id: 1,
        team_id: 20,
        player_id: 7,
        positions: ["C"],
        proj_fantasy_points: 4,
      },
      {
        row_key: "run-1:game-3:8:1",
        game_id: 3,
        team_id: 10,
        player_id: 8,
        positions: ["C"],
        proj_fantasy_points: 4,
      },
    ]);

    expect(
      ranked.map((row) => ({
        row_key: row.row_key,
        rank: row.position_ranks.C,
      })),
    ).toEqual([
      { row_key: "run-1:game-2:7:1", rank: 1 },
      { row_key: "run-1:game-1:7:1", rank: 2 },
      { row_key: "run-1:game-3:8:1", rank: 2 },
    ]);
  });

  it("grades higher opponent xGA as easier with average ranks for ties", async () => {
    vi.resetModules();
    const {
      computeDefenseEaseGrades,
      getPregameTeamFormThroughDate,
      normalizeProjectedToiMinutes,
      sumProjectionParts,
    } = await import("../../../../pages/api/v1/start-chart");
    const rating = (teamAbbr: string, xga60: number | null) =>
      ({ teamAbbr, components: { xga60 } }) as any;

    const grades = computeDefenseEaseGrades([
      rating("BOS", 2),
      rating("MTL", 3),
      rating("TOR", 3),
      rating("SJS", 4),
      rating("NODATA", null),
    ]);

    expect(grades.get("BOS")).toBe(0);
    expect(grades.get("MTL")).toBe(50);
    expect(grades.get("TOR")).toBe(50);
    expect(grades.get("SJS")).toBe(100);
    expect(grades.has("NODATA")).toBe(false);
    expect(computeDefenseEaseGrades([rating("ONLY", 3.2)]).get("ONLY")).toBe(
      50,
    );
    expect(sumProjectionParts(0.4, 0.2, 0)).toBeCloseTo(0.6, 6);
    expect(sumProjectionParts(0.4, null, 0)).toBeCloseTo(0.4, 6);
    expect(sumProjectionParts(null, null, null)).toBeNull();
    expect(normalizeProjectedToiMinutes(900, 180, null)).toBe(18);
    expect(normalizeProjectedToiMinutes(null, null, null)).toBeNull();
    expect(normalizeProjectedToiMinutes(3901, null, null)).toBeNull();
    expect(normalizeProjectedToiMinutes(-1, 180, null)).toBeNull();
    expect(getPregameTeamFormThroughDate("2026-03-01")).toBe("2026-02-28");
  });

  it("resolves duplicate Yahoo identities by exact slate team and rejects unresolved ambiguity", async () => {
    vi.resetModules();
    const { resolveYahooPlayerMappings } =
      await import("../../../../pages/api/v1/start-chart");

    const { mapped, ambiguousPlayerIds } = resolveYahooPlayerMappings(
      [
        {
          nhl_player_id: "8478427",
          yahoo_player_id: "7654",
          yahoo_team: "PIT",
        },
        {
          nhl_player_id: "8478427",
          yahoo_player_id: "6777",
          yahoo_team: "CAR",
        },
        {
          nhl_player_id: "1",
          yahoo_player_id: "10",
          yahoo_team: "BOS",
        },
        {
          nhl_player_id: "1",
          yahoo_player_id: "11",
          yahoo_team: "NYR",
        },
        {
          nhl_player_id: "2",
          yahoo_player_id: "20",
        },
      ],
      new Map([
        [8478427, "CAR"],
        [1, null],
        [2, "MTL"],
      ]),
    );

    expect(mapped.get(8478427)).toBe(6777);
    expect(mapped.get(2)).toBe(20);
    expect(mapped.has(1)).toBe(false);
    expect(ambiguousPlayerIds).toEqual(new Set([1]));
  });

  it("uses only ownership observations available on or before the slate", async () => {
    vi.resetModules();
    const { parseOwnershipAsOf } =
      await import("../../../../pages/api/v1/start-chart");

    expect(
      parseOwnershipAsOf(
        {
          ownership_timeline: [
            { date: "2026-02-08", percent: 99 },
            { date: "2026-02-07", percent: 47 },
            { date: "2026-02-06", percent: 42 },
          ],
          percent_ownership: 88,
          last_updated: "2026-02-08T12:00:00Z",
        } as any,
        "2026-02-07",
      ),
    ).toEqual({ value: 47, asOfDate: "2026-02-07" });

    expect(
      parseOwnershipAsOf(
        {
          ownership_timeline: [{ date: "2026-02-08", percent: 99 }],
          percent_ownership: 88,
          last_updated: "2026-02-08T12:00:00Z",
        } as any,
        "2026-02-07",
      ),
    ).toEqual({ value: null, asOfDate: null });

    expect(
      parseOwnershipAsOf(
        {
          ownership_timeline: [{ date: "2026-02-07", percent: "" }],
          percent_ownership: null,
          last_updated: "2026-02-07T12:00:00Z",
        } as any,
        "2026-02-07",
      ),
    ).toEqual({ value: null, asOfDate: null });

    expect(
      parseOwnershipAsOf(
        {
          ownership_timeline: [{ date: "2026-02-07", percent: 0 }],
          percent_ownership: null,
          last_updated: "2026-02-07T12:00:00Z",
        } as any,
        "2026-02-07",
      ),
    ).toEqual({ value: 0, asOfDate: "2026-02-07" });
  });

  it("normalizes legacy and enriched fields without coercing missing values", () => {
    const normalized = normalizeStartChartResponse({
      dateUsed: "2026-02-07",
      requestedDate: "2026-02-08",
      fallbackApplied: true,
      serving: { mode: "fallback", gapDays: 1 },
      players: [
        {
          player_id: 7,
          name: "Historical Skater",
          positions: ["C"],
          proj_fantasy_points: null,
          games_remaining_week: null,
          percent_ownership: null,
        },
      ],
      games: [],
    });

    expect(normalized).toMatchObject({
      date: "2026-02-07",
      resolvedDate: "2026-02-07",
      requestedDate: "2026-02-08",
      fallbackApplied: true,
      serving: { mode: "fallback", ageDays: 1 },
    });
    expect(normalized.players[0]).toMatchObject({
      player_id: 7,
      proj_fantasy_points: null,
      games_remaining_week: null,
      percent_ownership: null,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "function is not installed" },
    });
    getSeasonForDateMock.mockResolvedValue({
      id: 20252026,
      startDate: "2025-10-07T00:00:00Z",
    });
    const ratings = [
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
          pace60: 61,
        },
        finishingRating: null,
        goalieRating: null,
        dangerRating: null,
        specialRating: null,
        disciplineRating: null,
        varianceFlag: null,
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
          pace60: 58,
        },
        finishingRating: null,
        goalieRating: null,
        dangerRating: null,
        specialRating: null,
        disciplineRating: null,
        varianceFlag: null,
      },
    ];
    fetchTeamRatingsAsOfMock.mockResolvedValue({
      requestedDate: "2026-02-07",
      resolvedDate: "2026-02-07",
      ratings,
    });

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
              awayTeamId: 8,
            },
          ],
          error: null,
        }));
      }
      if (table === "forge_player_projections") {
        throw new Error(
          "Start Chart should read projections through the selected FORGE run",
        );
      }
      if (table === "forge_runs") {
        return createQueryBuilder(() => ({
          data: [
            {
              run_id: "run-123",
              as_of_date: "2026-02-07",
              created_at: "2026-02-07T12:00:00Z",
              updated_at: "2026-02-07T12:05:00Z",
              git_sha: null,
              metrics: null,
              forge_player_projections: [defaultProjection],
            },
          ],
          error: null,
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
              confirmed_status: true,
              updated_at: "2026-02-07T12:00:00Z",
            },
          ],
          error: null,
        }));
      }
      if (table === "yahoo_nhl_player_map_read") {
        return createQueryBuilder(() => ({
          data: [
            { nhl_player_id: "8478402", yahoo_player_id: "5001" },
            { nhl_player_id: "9001", yahoo_player_id: "5002" },
          ],
          error: null,
        }));
      }
      if (table === "yahoo_players") {
        return createQueryBuilder(() => ({
          data: [
            {
              player_id: "5001",
              player_key: "449.p.5001",
              player_name: "Nick Suzuki",
              full_name: "Nick Suzuki",
              eligible_positions: ["C"],
              percent_ownership: 78,
              last_updated: "2026-02-07T12:00:00Z",
              ownership_timeline: [],
            },
            {
              player_id: "5002",
              player_key: "449.p.5002",
              player_name: "Goalie A",
              full_name: "Goalie A",
              eligible_positions: ["G"],
              percent_ownership: 41,
              last_updated: "2026-02-07T12:00:00Z",
              ownership_timeline: [],
            },
          ],
          error: null,
        }));
      }
      if (table === "yahoo_player_ownership_history") {
        return createQueryBuilder(() => ({ data: [], error: null }));
      }
      if (table === "team_ctpi_daily") {
        return createQueryBuilder(() => ({
          data: [
            {
              date: "2026-02-01",
              team: "MTL",
              ctpi_0_to_100: 55,
              ...trustedTeamFormColumns,
            },
            {
              date: "2026-02-01",
              team: "TOR",
              ctpi_0_to_100: 61,
              ...trustedTeamFormColumns,
            },
          ],
          error: null,
        }));
      }
      return createQueryBuilder(() => ({ data: [], error: null }));
    });
  });

  it("reads skaters through the exact FORGE run and exposes canonical-source metadata", async () => {
    vi.resetModules();
    const handler = (await import("../../../../pages/api/v1/start-chart"))
      .default;
    const req: any = {
      method: "GET",
      query: {
        date: "2026-02-07",
      },
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
        strategy: "requested_date",
        gapDays: 0,
        severity: "none",
        status: "requested_date",
        message: null,
      },
      projectionRunId: "run-123",
      skaterSource: "forge_player_projections",
      goalieSource: "goalie_start_projections",
      fantasyScoringContract: {
        version: "fhfh-default-skater-v1",
        label: "FHFH default skater",
        weights: {
          goals: 3,
          assists: 2,
          powerPlayPoints: 1,
          shotsOnGoal: 0.2,
          hits: 0.2,
          blockedShots: 0.25,
        },
      },
      rankingContract: {
        version: "start-chart-ranking-v2",
        scope: "eligible_position",
        tieMethod: "competition",
        scoreFields: {
          skater: "proj_fantasy_points",
          goalie: "start_probability",
        },
        unavailable: {
          categoryMode: true,
          riskP75: true,
        },
      },
      compatibilityInventory: {
        inventoryVersion: "forge-compatibility-inventory-v2",
        canonicalSkaterSource: "forge_player_projections",
        canonicalReadRoute: "/api/v1/start-chart",
        retiredLegacyMaterializerRoute:
          "/api/v1/db/update-start-chart-projections",
        legacyMaterializerRemoved: true,
        legacyPlayerProjectionsReadDisabled: true,
        goalieStartTable: {
          decisionVersion: "goalie-start-ownership-v1",
          table: "goalie_start_projections",
          decision: "retain_shared_table_name_for_now",
          canonicalWriterRoute: "/api/v1/db/update-goalie-projections-v2",
          canonicalWriterStatus: "single_writer",
          renameDeferred: true,
        },
      },
      legacyPlayerProjectionsUsed: false,
    });
    expect(res.body.request).toEqual({
      mode: "points",
      profile: "fhfh-default-skater-v1",
      position: null,
      modelVersion: "latest",
    });
    expect(res.body.pagination).toEqual({
      page: 1,
      pageSize: 2,
      totalPlayers: 2,
      totalPages: 1,
    });
    const skater = res.body.players.find(
      (player: any) => player.player_id === 8478402,
    );
    expect(skater).toBeTruthy();
    expect(skater.name).toBe("Nick Suzuki");
    expect(skater.proj_goals).toBeCloseTo(0.6, 6);
    expect(skater.proj_assists).toBeCloseTo(0.6, 6);
    expect(skater.proj_shots).toBeCloseTo(3.5, 6);
    expect(skater.proj_fantasy_points).toBeCloseTo(4.22, 6);
    expect(skater.position_ranks).toEqual({ C: 1 });
    expect(skater.context.flags).toContain("unverified_projection_provenance");
    const goalie = res.body.players.find(
      (player: any) => player.player_id === 9001,
    );
    expect(goalie).toMatchObject({
      positions: ["G"],
      confirmed_status: true,
      start_probability: 1,
    });
    expect(getSeasonForDateMock).toHaveBeenCalledWith(
      "2026-02-07",
      expect.anything(),
    );
    expect(eqMock).toHaveBeenCalledWith("as_of_date", "2026-02-07");
    expect(eqMock).toHaveBeenCalledWith(
      "forge_player_projections.as_of_date",
      "2026-02-07",
    );
    expect(eqMock).toHaveBeenCalledWith(
      "forge_player_projections.horizon_games",
      1,
    );
    expect(eqMock).toHaveBeenCalledWith("game_date", "2026-02-07");
    expect(fromMock.mock.calls.map((call) => call[0])).not.toContain(
      "player_projections",
    );

    const representativePage = {
      ...res.body,
      players: Array.from({ length: 200 }, (_, index) => ({
        ...skater,
        row_key: `run-123:${1000 + index}:${8478402 + index}:1`,
        game_id: 1000 + index,
        player_id: 8478402 + index,
      })),
    };
    expect(
      evaluatePayloadBudget("/api/v1/start-chart", representativePage)
        .withinBudget,
    ).toBe(true);
  });

  it("uses the bounded Yahoo as-of overlay reader without serial player/history reads", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          nhl_player_id: 8478402,
          yahoo_player_id: 5001,
          nhl_team_abbreviation: "MTL",
          yahoo_team: "MTL",
          player_name: "Nick Suzuki",
          full_name: "Nick Suzuki",
          eligible_positions: ["C"],
          percent_ownership: 78,
          ownership_as_of_date: "2026-02-06",
          last_updated: "2026-02-07T12:00:00",
        },
        {
          nhl_player_id: 9001,
          yahoo_player_id: 5002,
          nhl_team_abbreviation: "TOR",
          yahoo_team: "TOR",
          player_name: "Goalie A",
          full_name: "Goalie A",
          eligible_positions: ["G"],
          percent_ownership: 41,
          ownership_as_of_date: "2026-02-07",
          last_updated: "2026-02-07T12:00:00",
        },
      ],
      error: null,
    });

    vi.resetModules();
    const handler = (await import("../../../../pages/api/v1/start-chart"))
      .default;
    const res = createMockRes();
    await handler({ method: "GET", query: { date: "2026-02-07" } } as any, res);

    expect(res.statusCode).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith("read_yahoo_player_overlay_as_of", {
      p_nhl_player_ids: [8478402, 9001],
      p_season: 2025,
      p_as_of_date: "2026-02-07",
    });
    expect(fromMock.mock.calls.map(([table]) => table)).toContain(
      "yahoo_nhl_player_map_read",
    );
    expect(fromMock.mock.calls.map(([table]) => table)).not.toContain(
      "yahoo_players",
    );
    expect(fromMock.mock.calls.map(([table]) => table)).not.toContain(
      "yahoo_player_ownership_history",
    );
    expect(
      res.body.players.find((row: any) => row.player_id === 8478402),
    ).toMatchObject({
      name: "Nick Suzuki",
      positions: ["C"],
      percent_ownership: 78,
      ownership_as_of_date: "2026-02-06",
    });
    expect(res.body.coverage).toMatchObject({
      yahooMappedPlayers: 2,
      yahooUnmappedPlayers: 0,
    });
  });

  it("uses direct latest-on-or-before ownership history when the RPC is absent", async () => {
    const defaultImplementation = fromMock.getMockImplementation();
    fromMock.mockImplementation((table: string) => {
      if (table === "yahoo_players") {
        return createQueryBuilder(() => ({
          data: [
            {
              player_id: "5001",
              player_key: "449.p.5001",
              player_name: "Nick Suzuki",
              full_name: "Nick Suzuki",
              eligible_positions: ["C"],
              percent_ownership: 99,
              last_updated: "2026-03-01T12:00:00Z",
            },
            {
              player_id: "5002",
              player_key: "449.p.5002",
              player_name: "Goalie A",
              full_name: "Goalie A",
              eligible_positions: ["G"],
              percent_ownership: 99,
              last_updated: "2026-03-01T12:00:00Z",
            },
          ],
          error: null,
        }));
      }
      if (table === "yahoo_player_ownership_history") {
        return createQueryBuilder(() => ({
          data: [
            {
              player_key: "449.p.5001",
              ownership_date: "2026-02-01",
              ownership_pct: 60,
            },
            {
              player_key: "449.p.5002",
              ownership_date: "2026-02-07",
              ownership_pct: 41,
            },
            {
              player_key: "449.p.5001",
              ownership_date: "2026-02-06",
              ownership_pct: 73,
            },
          ],
          error: null,
        }));
      }
      return defaultImplementation!(table);
    });

    vi.resetModules();
    const handler = (await import("../../../../pages/api/v1/start-chart"))
      .default;
    const res = createMockRes();
    await handler({ method: "GET", query: { date: "2026-02-07" } } as any, res);

    expect(res.statusCode).toBe(200);
    expect(fromMock.mock.calls.map(([table]) => table)).toContain(
      "yahoo_players",
    );
    expect(fromMock.mock.calls.map(([table]) => table)).toContain(
      "yahoo_player_ownership_history",
    );
    expect(fromMock.mock.calls.map(([table]) => table)).not.toContain(
      "yahoo_players_with_normalized_history",
    );
    expect(
      res.body.players.find((row: any) => row.player_id === 8478402),
    ).toMatchObject({
      name: "Nick Suzuki",
      positions: ["C"],
      percent_ownership: 73,
      ownership_as_of_date: "2026-02-06",
    });

    await handler(
      {
        method: "GET",
        query: { date: "2026-02-07", page: "1", page_size: "10" },
      } as any,
      createMockRes(),
    );
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });

  it("keeps canonical players when the optional Yahoo overlay is unmapped", async () => {
    const defaultImplementation = fromMock.getMockImplementation();
    fromMock.mockImplementation((table: string) => {
      if (table === "players") {
        return createQueryBuilder(() => ({
          data: [{ id: 8478402, fullName: "Canonical Skater", position: "C" }],
          error: null,
        }));
      }
      if (table === "yahoo_nhl_player_map_read") {
        return createQueryBuilder(() => ({ data: [], error: null }));
      }
      return defaultImplementation!(table);
    });

    vi.resetModules();
    const handler = (await import("../../../../pages/api/v1/start-chart"))
      .default;
    const res = createMockRes();

    await handler({ method: "GET", query: { date: "2026-02-07" } } as any, res);

    const skater = res.body.players.find(
      (row: any) => row.player_id === 8478402,
    );
    expect(skater).toMatchObject({
      name: "Canonical Skater",
      positions: ["C"],
      ownership: null,
      percent_ownership: null,
      ownership_as_of_date: null,
      context: { flags: expect.arrayContaining(["ownership_unavailable"]) },
    });
    expect(res.body.coverage).toMatchObject({
      yahooMappedPlayers: 0,
      yahooUnmappedPlayers: 2,
    });
  });

  it("does not serve versioned but unapproved team-form rows as trusted context", async () => {
    const defaultImplementation = fromMock.getMockImplementation();
    fromMock.mockImplementation((table: string) => {
      if (table === "team_ctpi_daily") {
        return createQueryBuilder(() => ({
          data: [
            {
              date: "2026-02-01",
              team: "MTL",
              ctpi_0_to_100: 88,
              publication_status: "legacy_unapproved",
              formula_version: "ctpi-formula-v1",
              input_version: "ctpi-one-game-input-v2",
              source_game_count: "10",
            },
          ],
          error: null,
        }));
      }
      return defaultImplementation!(table);
    });

    vi.resetModules();
    const handler = (await import("../../../../pages/api/v1/start-chart"))
      .default;
    const res = createMockRes();
    await handler({ method: "GET", query: { date: "2026-02-07" } } as any, res);

    expect(res.body.ctpi).toEqual([]);
    expect(res.body.sourceStatus.ctpi).toMatchObject({
      state: "missing",
      formulaVersion: null,
      inputVersion: null,
      trustedRows: 0,
      untrustedRows: 1,
    });
    expect(res.body.sourceStatus.ctpi.message).toContain(
      "hidden rather than show a misleading score",
    );
    expect(res.body.sourceStatus.degradedReasons).toContain(
      "untrusted_team_form_history",
    );
  });

  it("reports previous-date fallback serving state when the requested slate has no games", async () => {
    let gamesQueryCount = 0;
    let forgeRunsQueryCount = 0;
    fetchTeamRatingsAsOfMock.mockResolvedValue({
      requestedDate: "2026-02-07",
      resolvedDate: null,
      ratings: [],
    });
    fromMock.mockImplementation((table: string) => {
      if (table === "player_projections") {
        throw new Error("legacy player_projections should not be queried");
      }
      if (table === "games") {
        gamesQueryCount += 1;
        if (gamesQueryCount === 1) {
          return createQueryBuilder(() => ({
            data: [],
            error: null,
          }));
        }
        return createQueryBuilder(() => ({
          data: [
            {
              id: 1002,
              date: "2026-02-07",
              homeTeamId: 10,
              awayTeamId: 8,
            },
          ],
          error: null,
        }));
      }
      if (table === "forge_runs") {
        forgeRunsQueryCount += 1;
        return createQueryBuilder(() => ({
          data:
            forgeRunsQueryCount === 1
              ? []
              : forgeRunsQueryCount === 2
                ? [
                    {
                      run_id: "run-123",
                      as_of_date: "2026-02-07",
                      forge_player_projections: [
                        {
                          as_of_date: "2026-02-07",
                          game_id: 1002,
                          horizon_games: 1,
                          games: { date: "2026-02-07" },
                        },
                      ],
                    },
                  ]
                : [
                    {
                      run_id: "run-123",
                      as_of_date: "2026-02-07",
                      created_at: "2026-02-07T12:00:00Z",
                      updated_at: "2026-02-07T12:05:00Z",
                      git_sha: null,
                      metrics: null,
                      forge_player_projections: [
                        {
                          ...defaultProjection,
                          game_id: 1002,
                          players: {
                            fullName: "Nick Suzuki",
                            position: "C",
                          },
                        },
                      ],
                    },
                  ],
          error: null,
        }));
      }
      if (table === "goalie_start_projections") {
        return createQueryBuilder(() => ({
          data: [],
          error: null,
        }));
      }
      if (table === "yahoo_nhl_player_map_read") {
        return createQueryBuilder(() => ({
          data: [{ nhl_player_id: "8478402", yahoo_player_id: "5001" }],
          error: null,
        }));
      }
      if (table === "yahoo_players") {
        return createQueryBuilder(() => ({
          data: [
            {
              player_id: "5001",
              player_key: "449.p.5001",
              player_name: "Nick Suzuki",
              full_name: "Nick Suzuki",
              eligible_positions: ["C"],
              percent_ownership: 78,
              ownership_timeline: [],
            },
          ],
          error: null,
        }));
      }
      if (table === "yahoo_player_ownership_history") {
        return createQueryBuilder(() => ({ data: [], error: null }));
      }
      if (table === "team_ctpi_daily") {
        return createQueryBuilder(() => ({
          data: [],
          error: null,
        }));
      }
      return createQueryBuilder(() => ({ data: [], error: null }));
    });

    vi.resetModules();
    const handler = (await import("../../../../pages/api/v1/start-chart"))
      .default;
    const req: any = {
      method: "GET",
      query: {
        date: "2026-02-08",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      dateUsed: "2026-02-07",
      requestedDate: "2026-02-08",
      fallbackApplied: true,
      compatibilityInventory: {
        inventoryVersion: "forge-compatibility-inventory-v2",
        canonicalSkaterSource: "forge_player_projections",
        canonicalReadRoute: "/api/v1/start-chart",
        retiredLegacyMaterializerRoute:
          "/api/v1/db/update-start-chart-projections",
        legacyMaterializerRemoved: true,
        legacyPlayerProjectionsReadDisabled: true,
        goalieStartTable: {
          decisionVersion: "goalie-start-ownership-v1",
          table: "goalie_start_projections",
          decision: "retain_shared_table_name_for_now",
          canonicalWriterRoute: "/api/v1/db/update-goalie-projections-v2",
          canonicalWriterStatus: "single_writer",
          renameDeferred: true,
        },
      },
      serving: {
        requestedDate: "2026-02-08",
        resolvedDate: "2026-02-07",
        fallbackApplied: true,
        isSameDay: false,
        state: "fallback",
        strategy: "previous_date_with_games",
        gapDays: 1,
        severity: "warn",
        status: "fallback_recent",
        message:
          "Start-chart slate is serving the nearest available date (2026-02-07), 1 day behind the requested date.",
      },
    });
  });

  it("resolves an older fallback with one joined run lookup and the exact run id", async () => {
    let gamesQueryCount = 0;
    let forgeRunsQueryCount = 0;
    fetchTeamRatingsAsOfMock.mockResolvedValue({
      requestedDate: "2026-02-05",
      resolvedDate: null,
      ratings: [],
    });
    fromMock.mockImplementation((table: string) => {
      if (table === "games") {
        gamesQueryCount += 1;
        return createQueryBuilder(() => ({
          data:
            gamesQueryCount <= 1
              ? []
              : [
                  {
                    id: 1005,
                    date: "2026-02-05",
                    homeTeamId: 10,
                    awayTeamId: 8,
                  },
                ],
          error: null,
        }));
      }
      if (table === "forge_runs") {
        forgeRunsQueryCount += 1;
        return createQueryBuilder(() => ({
          data:
            forgeRunsQueryCount === 1
              ? []
              : forgeRunsQueryCount === 2
                ? [
                    {
                      run_id: "fallback-run",
                      as_of_date: "2026-02-05",
                      forge_player_projections: [
                        {
                          as_of_date: "2026-02-05",
                          game_id: 1005,
                          horizon_games: 1,
                          games: { date: "2026-02-05" },
                        },
                      ],
                    },
                  ]
                : [
                    {
                      run_id: "fallback-run",
                      as_of_date: "2026-02-05",
                      created_at: "2026-02-05T12:00:00Z",
                      updated_at: "2026-02-05T12:05:00Z",
                      git_sha: null,
                      metrics: null,
                      forge_player_projections: [
                        {
                          ...defaultProjection,
                          run_id: "fallback-run",
                          as_of_date: "2026-02-05",
                          game_id: 1005,
                          players: {
                            fullName: "Fallback Skater",
                            position: "C",
                          },
                        },
                      ],
                    },
                  ],
          error: null,
        }));
      }
      return createQueryBuilder(() => ({ data: [], error: null }));
    });

    vi.resetModules();
    const handler = (await import("../../../../pages/api/v1/start-chart"))
      .default;
    const res = createMockRes();
    await handler({ method: "GET", query: { date: "2026-02-08" } } as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      requestedDate: "2026-02-08",
      resolvedDate: "2026-02-05",
      projectionRunId: "fallback-run",
      serving: {
        mode: "fallback",
        reason: "latest_available_with_data",
        ageDays: 3,
      },
    });
    expect(res.body.players[0]).toMatchObject({
      row_key: "fallback-run:1005:8478402:1",
      name: "Fallback Skater",
    });
    expect(
      fromMock.mock.calls.filter(
        ([table]) => table === "forge_player_projections",
      ),
    ).toHaveLength(0);
    expect(forgeRunsQueryCount).toBe(3);
  });

  it("retains an exact scheduled slate as partial when projections are missing", async () => {
    const defaultImplementation = fromMock.getMockImplementation();
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_runs") {
        return createQueryBuilder(() => ({
          data: [
            {
              run_id: "run-123",
              as_of_date: "2026-02-07",
              created_at: "2026-02-07T12:00:00Z",
              updated_at: "2026-02-07T12:05:00Z",
              git_sha: null,
              metrics: null,
              forge_player_projections: [],
            },
          ],
          error: null,
        }));
      }
      return defaultImplementation!(table);
    });

    vi.resetModules();
    const handler = (await import("../../../../pages/api/v1/start-chart"))
      .default;
    const res = createMockRes();

    await handler({ method: "GET", query: { date: "2026-02-07" } } as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      requestedDate: "2026-02-07",
      resolvedDate: "2026-02-07",
      fallbackApplied: false,
      serving: {
        mode: "partial",
        reason: "scheduled_games_missing_projections",
      },
      coverage: {
        slateGames: 1,
        projectionRows: 1,
      },
    });
    expect(res.body.games).toHaveLength(1);
    expect(
      res.body.players.filter((row: any) => row.positions.includes("C")),
    ).toHaveLength(0);
  });

  it("returns no_games when neither the date nor same-season history has an eligible slate", async () => {
    fetchTeamRatingsAsOfMock.mockResolvedValue({
      requestedDate: "2026-02-07",
      resolvedDate: null,
      ratings: [],
    });
    fromMock.mockImplementation((table: string) => {
      if (table === "games" || table === "forge_runs") {
        return createQueryBuilder(() => ({ data: [], error: null }));
      }
      return createQueryBuilder(() => ({ data: [], error: null }));
    });

    vi.resetModules();
    const handler = (await import("../../../../pages/api/v1/start-chart"))
      .default;
    const res = createMockRes();

    await handler({ method: "GET", query: { date: "2026-02-07" } } as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      requestedDate: "2026-02-07",
      resolvedDate: "2026-02-07",
      fallbackApplied: false,
      serving: {
        mode: "no_games",
        reason: "no_scheduled_games_or_eligible_fallback",
      },
      coverage: { slateGames: 0, slateTeams: 0 },
    });
    expect(res.body.players).toEqual([]);
    expect(res.body.games).toEqual([]);
  });

  it("bounds the route cache at 64 responses and clears completed in-flight work", async () => {
    fetchTeamRatingsAsOfMock.mockResolvedValue({
      requestedDate: "2026-01-01",
      resolvedDate: null,
      ratings: [],
    });
    fromMock.mockImplementation(() =>
      createQueryBuilder(() => ({ data: [], error: null })),
    );
    vi.resetModules();
    const route = await import("../../../../pages/api/v1/start-chart");
    route.clearStartChartCache();

    const dates = Array.from({ length: 65 }, (_, offset) => {
      const date = new Date("2026-01-01T00:00:00Z");
      date.setUTCDate(date.getUTCDate() + offset);
      return date.toISOString().slice(0, 10);
    });
    for (const date of dates) {
      await route.default(
        { method: "GET", query: { date } } as any,
        createMockRes(),
      );
    }

    expect(route.getStartChartCacheDiagnostics()).toEqual({
      responseEntries: 64,
      inFlightEntries: 0,
      maxResponseEntries: 64,
    });
    const queryCountBeforeOldestDateRetry = fromMock.mock.calls.length;
    await route.default(
      { method: "GET", query: { date: dates[0] } } as any,
      createMockRes(),
    );
    expect(fromMock.mock.calls.length).toBeGreaterThan(
      queryCountBeforeOldestDateRetry,
    );
    expect(route.getStartChartCacheDiagnostics().responseEntries).toBe(64);
  });

  it("reports games-remaining failures without coercing weekly volume to zero", async () => {
    const defaultImplementation = fromMock.getMockImplementation();
    let gamesQueryCount = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "games") {
        gamesQueryCount += 1;
        return createQueryBuilder(() =>
          gamesQueryCount === 1
            ? {
                data: [
                  {
                    id: 1001,
                    date: "2026-02-07",
                    homeTeamId: 10,
                    awayTeamId: 8,
                  },
                ],
                error: null,
              }
            : { data: [], error: { message: "fixture week query failed" } },
        );
      }
      return defaultImplementation!(table);
    });

    vi.resetModules();
    const handler = (await import("../../../../pages/api/v1/start-chart"))
      .default;
    const res = createMockRes();
    await handler({ method: "GET", query: { date: "2026-02-07" } } as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.sourceStatus.gamesRemaining).toMatchObject({
      state: "error",
      affectsRanking: false,
      date: null,
    });
    expect(
      res.body.players.every((row: any) => row.games_remaining_week === null),
    ).toBe(true);
  });

  it("preserves missing weekly-volume rows as null after a successful query", async () => {
    const defaultImplementation = fromMock.getMockImplementation();
    let gamesQueryCount = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "games") {
        gamesQueryCount += 1;
        return createQueryBuilder(() =>
          gamesQueryCount === 1
            ? {
                data: [
                  {
                    id: 1001,
                    date: "2026-02-07",
                    homeTeamId: 10,
                    awayTeamId: 8,
                  },
                ],
                error: null,
              }
            : { data: [], error: null },
        );
      }
      return defaultImplementation!(table);
    });

    vi.resetModules();
    const handler = (await import("../../../../pages/api/v1/start-chart"))
      .default;
    const res = createMockRes();
    await handler({ method: "GET", query: { date: "2026-02-07" } } as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.sourceStatus.gamesRemaining).toMatchObject({
      state: "missing",
      affectsRanking: false,
      date: null,
    });
    expect(
      res.body.players.every((row: any) => row.games_remaining_week === null),
    ).toBe(true);
  });

  it.each([
    [{ date: "2026-02-30" }, 400, "invalid_parameter", "date"],
    [
      { date: "2026-02-07", position: "F" },
      400,
      "invalid_parameter",
      "position",
    ],
    [
      { date: "2026-02-07", mode: "categories" },
      422,
      "control_unavailable",
      "mode",
    ],
    [{ date: "2026-02-07", tau: "0.5" }, 422, "control_unavailable", "tau"],
    [
      { date: "2026-02-07", model_version: "v1" },
      422,
      "control_unavailable",
      "model_version",
    ],
    [
      { date: "2026-02-07", page_size: "201" },
      400,
      "invalid_parameter",
      "page_size",
    ],
    [{ date: ["2026-02-07", "2026-02-08"] }, 400, "invalid_parameter", "date"],
  ])(
    "rejects invalid or unavailable controls with a structured response",
    async (query, status, code, field) => {
      vi.resetModules();
      const handler = (await import("../../../../pages/api/v1/start-chart"))
        .default;
      const res = createMockRes();

      await handler({ method: "GET", query } as any, res);

      expect(res.statusCode).toBe(status);
      expect(res.body).toMatchObject({
        error: { code, field },
      });
      expect(fromMock).not.toHaveBeenCalled();
    },
  );

  it("filters and paginates deterministically without changing canonical model ownership", async () => {
    vi.resetModules();
    const handler = (await import("../../../../pages/api/v1/start-chart"))
      .default;
    const res = createMockRes();

    await handler(
      {
        method: "GET",
        query: {
          date: "2026-02-07",
          position: "G",
          page: "1",
          page_size: "1",
          mode: "points",
          profile: "fhfh-default-skater-v1",
          model_version: "latest",
        },
      } as any,
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.request).toEqual({
      mode: "points",
      profile: "fhfh-default-skater-v1",
      position: "G",
      modelVersion: "latest",
    });
    expect(res.body.pagination).toEqual({
      page: 1,
      pageSize: 1,
      totalPlayers: 1,
      totalPages: 1,
    });
    expect(res.body.players).toHaveLength(1);
    expect(res.body.players[0]).toMatchObject({
      player_id: 9001,
      positions: ["G"],
    });
  });

  it("returns a stable public error when a dependency fails", async () => {
    const internalDetail =
      "private_relation failed with Bearer internal-service-token";
    getSeasonForDateMock.mockRejectedValue(new Error(internalDetail));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.resetModules();
    const handler = (await import("../../../../pages/api/v1/start-chart"))
      .default;
    const res = createMockRes();

    await handler({ method: "GET", query: { date: "2026-02-08" } } as any, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "START_CHART_UNAVAILABLE" });
    expect(JSON.stringify(res.body)).not.toContain(internalDetail);
    consoleError.mockRestore();
  });
});
