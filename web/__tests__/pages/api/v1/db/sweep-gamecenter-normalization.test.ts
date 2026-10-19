import { beforeEach, describe, expect, it, vi } from "vitest";

type Filters = {
  table: string;
  eq: Record<string, unknown>;
  neq: Record<string, unknown>;
  gte: Record<string, unknown>;
  in: Record<string, unknown[]>;
  order: Array<{ column: string; ascending: boolean }>;
  range: [number, number] | null;
  limit: number | null;
};

// Hosted PostgREST returns at most this many rows per request.
const MAX_ROWS = 1_000;

const {
  resolveQueryMock,
  persistCapturedGameNormalizationMock,
  refreshPlayerMock,
  refreshTeamMock,
  warmPlayerCacheMock,
} = vi.hoisted(() => ({
  resolveQueryMock: vi.fn(),
  persistCapturedGameNormalizationMock: vi.fn(),
  refreshPlayerMock: vi.fn(),
  refreshTeamMock: vi.fn(),
  warmPlayerCacheMock: vi.fn(),
}));

vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: any) => handler,
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => handler,
}));

vi.mock("lib/supabase/server", () => {
  function shape(filters: Filters, data: unknown) {
    if (!Array.isArray(data)) return data;
    let rows = [...data];
    if (filters.order.length > 0) {
      rows.sort((a: any, b: any) => {
        for (const { column, ascending } of filters.order) {
          if (a[column] === b[column]) continue;
          return (a[column] < b[column] ? -1 : 1) * (ascending ? 1 : -1);
        }
        return 0;
      });
    }
    if (filters.range) rows = rows.slice(filters.range[0], filters.range[1] + 1);
    if (filters.limit != null) rows = rows.slice(0, filters.limit);
    return rows.slice(0, MAX_ROWS);
  }
  function from(table: string) {
    const filters: Filters = {
      table,
      eq: {},
      neq: {},
      gte: {},
      in: {},
      order: [],
      range: null,
      limit: null,
    };
    const builder: any = {
      select: () => builder,
      order: (column: string, options?: { ascending?: boolean }) => {
        filters.order.push({ column, ascending: options?.ascending !== false });
        return builder;
      },
      limit: (count: number) => {
        filters.limit = count;
        return builder;
      },
      range: (fromIndex: number, toIndex: number) => {
        filters.range = [fromIndex, toIndex];
        return builder;
      },
      gte: (column: string, value: unknown) => {
        filters.gte[column] = value;
        return builder;
      },
      lt: () => builder,
      eq: (column: string, value: unknown) => {
        filters.eq[column] = value;
        return builder;
      },
      neq: (column: string, value: unknown) => {
        filters.neq[column] = value;
        return builder;
      },
      in: (column: string, values: unknown[]) => {
        filters.in[column] = values;
        return builder;
      },
      maybeSingle: async () => {
        const data = resolveQueryMock(filters);
        return { data: Array.isArray(data) ? (data[0] ?? null) : data, error: null };
      },
      then: (resolve: any, reject: any) =>
        Promise.resolve()
          .then(() => ({ data: shape(filters, resolveQueryMock(filters)), error: null }))
          .then(resolve, reject),
    };
    return builder;
  }
  return { default: { from } };
});

vi.mock("lib/supabase/Upserts/nhlRawGamecenter.mjs", () => ({
  persistCapturedGameNormalization: persistCapturedGameNormalizationMock,
}));

vi.mock("lib/underlying-stats/adminRouteHelpers", () => ({
  parsePositiveInteger: (value: string | string[] | undefined) => {
    const normalized = typeof value === "string" ? value : value?.[0];
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
  },
}));

vi.mock("lib/underlying-stats/playerStatsLandingServer", () => ({
  buildPlayerStatsSummaryPartitionSourceUrl: (args: {
    gameId: number;
    mode: string;
    strength: string;
  }) => `derived://underlying-player-summary-v2/${args.mode}/${args.strength}/${args.gameId}`,
}));

vi.mock("lib/underlying-stats/playerStatsSummaryRefresh", () => ({
  refreshPlayerUnderlyingSummarySnapshotsForGameIds: refreshPlayerMock,
  warmPlayerStatsLandingSeasonAggregateCache: warmPlayerCacheMock,
}));

vi.mock("lib/underlying-stats/teamStatsSummaryRefresh", () => ({
  refreshTeamUnderlyingSummaryRowsForGameIds: refreshTeamMock,
}));

import handler from "../../../../../pages/api/v1/db/sweep-gamecenter-normalization";

const STALE_GAME = 2026020004;
const DERIVED_GAME = 2026020010;
const PBP_HASH = "a".repeat(64);
const SHIFT_HASH = "b".repeat(64);

function statusRow(
  gameId: number,
  status: string,
  completedAt: string | null,
  overrides: { season_id?: number; game_date?: string; updated_at?: string } = {},
) {
  return {
    game_id: gameId,
    season_id: 20262027,
    game_date: "2026-10-01",
    status,
    completed_at: completedAt,
    updated_at: "2026-10-02T00:00:00.000Z",
    ...overrides,
  };
}

type Db = {
  incomplete: ReturnType<typeof statusRow>[];
  complete: ReturnType<typeof statusRow>[];
  markers: Array<{ game_id: number; fetched_at: string }>;
  heads: Record<string, { raw_payload_id: number; payload_hash: string } | null>;
  raws: Record<number, { id: number; payload: unknown; payload_hash: string }>;
  xgFeatures: Array<{ game_id: number }>;
};

function installDb(db: Db) {
  resolveQueryMock.mockImplementation((filters: Filters) => {
    switch (filters.table) {
      case "nhl_api_game_normalization_status":
        return filters.neq.status === "complete" ? db.incomplete : db.complete;
      case "nhl_api_game_payload_snapshot_heads":
        return db.heads[`${filters.eq.game_id}:${filters.eq.endpoint}`] ?? null;
      case "nhl_api_game_payloads_raw":
        if (filters.eq.id != null) return db.raws[Number(filters.eq.id)] ?? null;
        return db.markers.filter(
          (marker) =>
            (filters.in.game_id ?? []).includes(marker.game_id) &&
            (filters.gte.fetched_at == null ||
              marker.fetched_at >= String(filters.gte.fetched_at)),
        );
      case "nhl_xg_shot_features":
        return db.xgFeatures.filter((row) =>
          filters.eq.game_id != null
            ? row.game_id === filters.eq.game_id
            : (filters.in.game_id ?? []).includes(row.game_id),
        );
      default:
        throw new Error(`Unexpected table ${filters.table}`);
    }
  });
}

function staleGameDb(overrides: Partial<Db> = {}): Db {
  return {
    incomplete: [statusRow(STALE_GAME, "stale", null)],
    complete: [],
    markers: [],
    heads: {
      [`${STALE_GAME}:play-by-play`]: { raw_payload_id: 11, payload_hash: PBP_HASH },
      [`${STALE_GAME}:shiftcharts`]: { raw_payload_id: 12, payload_hash: SHIFT_HASH },
    },
    raws: {
      11: { id: 11, payload: { id: STALE_GAME, plays: [] }, payload_hash: PBP_HASH },
      12: { id: 12, payload: { data: [] }, payload_hash: SHIFT_HASH },
    },
    xgFeatures: [],
    ...overrides,
  };
}

function createMockApiContext(query: Record<string, string> = {}) {
  const response = {
    statusCode: 200,
    body: null as any,
    setHeader: vi.fn(),
    status: vi.fn((code: number) => {
      response.statusCode = code;
      return response;
    }),
    json: vi.fn((payload: unknown) => {
      response.body = payload;
      return response;
    }),
  };
  return { req: { method: "GET", query, headers: {} }, res: response };
}

describe("/api/v1/db/sweep-gamecenter-normalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    persistCapturedGameNormalizationMock.mockResolvedValue({ idempotent: false });
    refreshPlayerMock.mockResolvedValue({ rowsUpserted: 28 });
    refreshTeamMock.mockResolvedValue({ rowsUpserted: 140 });
    warmPlayerCacheMock.mockResolvedValue(undefined);
  });

  it("normalizes a stale game from its snapshot-head payloads without fetching the NHL", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    installDb(staleGameDb());
    const { req, res } = createMockApiContext();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(persistCapturedGameNormalizationMock).toHaveBeenCalledTimes(1);
    expect(persistCapturedGameNormalizationMock.mock.calls[0][1]).toEqual({
      gameId: STALE_GAME,
      seasonId: 20262027,
      gameDate: "2026-10-01",
      pbp: { id: STALE_GAME, plays: [] },
      pbpPayloadHash: PBP_HASH,
      shiftPayload: { data: [] },
      shiftPayloadHash: SHIFT_HASH,
    });
    expect(refreshPlayerMock).toHaveBeenCalledWith(
      expect.objectContaining({ gameIds: [STALE_GAME], seasonId: 20262027, requestedGameType: 2 }),
    );
    expect(refreshTeamMock).toHaveBeenCalledWith(
      expect.objectContaining({ gameIds: [STALE_GAME] }),
    );
    expect(res.body).toMatchObject({
      success: true,
      normalizedGameIds: [STALE_GAME],
      refreshedGameIds: [STALE_GAME],
      nhlRequests: 0,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("refreshes summaries built before normalization completed without re-normalizing", async () => {
    installDb(
      staleGameDb({
        incomplete: [],
        complete: [
          statusRow(DERIVED_GAME, "complete", "2026-10-02T21:00:00.000Z"),
          statusRow(2026020011, "complete", "2026-10-02T10:00:00.000Z"),
        ],
        markers: [
          { game_id: DERIVED_GAME, fetched_at: "2026-10-02T10:25:00.000Z" },
          { game_id: 2026020011, fetched_at: "2026-10-02T09:00:00.000Z" },
          { game_id: 2026020011, fetched_at: "2026-10-02T10:25:00.000Z" },
        ],
      }),
    );
    const { req, res } = createMockApiContext();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(persistCapturedGameNormalizationMock).not.toHaveBeenCalled();
    expect(refreshPlayerMock).toHaveBeenCalledWith(
      expect.objectContaining({ gameIds: [DERIVED_GAME] }),
    );
    expect(res.body).toMatchObject({
      normalizedGameIds: [],
      derivedOnlyGameIds: [DERIVED_GAME],
      refreshedGameIds: [DERIVED_GAME],
    });
  });

  it("skips a game whose snapshot head is missing", async () => {
    installDb(
      staleGameDb({
        heads: {
          [`${STALE_GAME}:play-by-play`]: { raw_payload_id: 11, payload_hash: PBP_HASH },
        },
      }),
    );
    const { req, res } = createMockApiContext();

    await handler(req as any, res as any);

    expect(persistCapturedGameNormalizationMock).not.toHaveBeenCalled();
    expect(refreshPlayerMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body.skipped).toEqual([
      { gameId: STALE_GAME, reason: "missing_shift_head" },
    ]);
  });

  it("records a normalization failure and returns 502 when nothing was refreshed", async () => {
    persistCapturedGameNormalizationMock.mockRejectedValueOnce(
      new Error("NHL_NORMALIZATION_WRITER_BUSY"),
    );
    installDb(staleGameDb());
    const { req, res } = createMockApiContext();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(502);
    expect(res.body.failures).toEqual([
      {
        gameId: STALE_GAME,
        stage: "normalize_gamecenter",
        message: "NHL_NORMALIZATION_WRITER_BUSY",
      },
    ]);
    expect(refreshPlayerMock).not.toHaveBeenCalled();
  });

  it("stops normalizing once the deadline leaves only the summary reserve", async () => {
    installDb(
      staleGameDb({
        incomplete: [
          statusRow(STALE_GAME, "stale", null),
          statusRow(2026020005, "stale", null),
        ],
      }),
    );
    const nowSpy = vi.spyOn(Date, "now");
    let calls = 0;
    // startedAt, then the first deadline check passes and the second exceeds it.
    nowSpy.mockImplementation(() => {
      calls += 1;
      return calls <= 2 ? 1_000_000 : 1_000_000 + 200_000;
    });
    const { req, res } = createMockApiContext({ maxDurationMs: "240000" });

    await handler(req as any, res as any);
    nowSpy.mockRestore();

    expect(persistCapturedGameNormalizationMock).toHaveBeenCalledTimes(1);
    expect(res.body).toMatchObject({
      deadlineReached: true,
      normalizedGameIds: [STALE_GAME],
    });
  });

  it("caps the limit and reports games that still need an xG refresh", async () => {
    installDb(staleGameDb({ xgFeatures: [{ game_id: STALE_GAME }, { game_id: STALE_GAME }] }));
    const { req, res } = createMockApiContext({ limit: "500" });

    await handler(req as any, res as any);

    expect(res.body.limit).toBe(50);
    expect(res.body.xgRefreshNeededGameIds).toEqual([STALE_GAME]);
  });

  // Ported from the 2026-10-19 cross-check audit (A-07a). Before the fix the
  // player refresh wrote the completion marker before the team refresh ran, so
  // a team failure left the game looking finished and it was never retried.
  it("AUDIT: retries team summaries after player summary committed and team refresh failed", async () => {
    const db = staleGameDb({
      incomplete: [],
      complete: [statusRow(DERIVED_GAME, "complete", "2026-10-02T21:00:00.000Z")],
    });
    installDb(db);
    refreshPlayerMock.mockImplementation(async () => {
      db.markers = [{ game_id: DERIVED_GAME, fetched_at: "2026-10-02T22:00:00.000Z" }];
      return { rowsUpserted: 28 };
    });
    refreshTeamMock.mockRejectedValueOnce(new Error("synthetic team refresh failure"));

    const first = createMockApiContext();
    await handler(first.req as any, first.res as any);
    expect(first.res.statusCode).toBe(502);
    expect(first.res.body.failures).toEqual([
      {
        gameId: DERIVED_GAME,
        stage: "refresh_team_summaries",
        message: "synthetic team refresh failure",
      },
    ]);
    expect(refreshPlayerMock).not.toHaveBeenCalled();

    refreshTeamMock.mockResolvedValue({ rowsUpserted: 140 });
    const second = createMockApiContext();
    await handler(second.req as any, second.res as any);
    expect(refreshTeamMock).toHaveBeenCalledTimes(2);
    expect(refreshPlayerMock).toHaveBeenCalledTimes(1);
    expect(second.res.statusCode).toBe(200);
    expect(second.res.body.refreshedGameIds).toEqual([DERIVED_GAME]);

    const third = createMockApiContext();
    await handler(third.req as any, third.res as any);
    expect(third.res.body.candidateCount).toBe(0);
    expect(refreshTeamMock).toHaveBeenCalledTimes(2);
  });

  it("reports a cache-warm failure after the marker as 207 without holding the game", async () => {
    installDb(
      staleGameDb({
        incomplete: [],
        complete: [statusRow(DERIVED_GAME, "complete", "2026-10-02T21:00:00.000Z")],
      }),
    );
    warmPlayerCacheMock.mockRejectedValueOnce(new Error("warm failed"));
    const { req, res } = createMockApiContext();

    await handler(req as any, res as any);

    expect(refreshPlayerMock).toHaveBeenCalledWith(
      expect.objectContaining({ shouldWarmLandingCache: false }),
    );
    expect(res.statusCode).toBe(207);
    expect(res.body.success).toBe(false);
    expect(res.body.refreshedGameIds).toEqual([DERIVED_GAME]);
    expect(res.body.failures).toEqual([
      { gameId: DERIVED_GAME, stage: "warm_landing_cache", message: "warm failed" },
    ]);
  });

  it("keeps refreshing other groups after one group fails and returns 207", async () => {
    const otherSeasonGame = 2025020010;
    installDb(
      staleGameDb({
        incomplete: [],
        complete: [
          statusRow(otherSeasonGame, "complete", "2026-10-02T21:00:00.000Z", {
            season_id: 20252026,
            game_date: "2026-09-30",
          }),
          statusRow(DERIVED_GAME, "complete", "2026-10-02T21:00:00.000Z"),
        ],
      }),
    );
    refreshTeamMock.mockRejectedValueOnce(new Error("team boom"));
    const { req, res } = createMockApiContext();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(207);
    expect(res.body.refreshedGameIds).toEqual([DERIVED_GAME]);
    expect(res.body.failures).toEqual([
      { gameId: otherSeasonGame, stage: "refresh_team_summaries", message: "team boom" },
    ]);
    expect(refreshPlayerMock).toHaveBeenCalledTimes(1);
  });

  it("pages past more than 1,000 fresh games to reach a newer stale one", async () => {
    const freshGames = Array.from({ length: 1_000 }, (_, index) =>
      statusRow(2026020100 + index, "complete", "2026-10-02T10:00:00.000Z", {
        game_date: "2026-09-25",
      }),
    );
    const newerStale = statusRow(2026021500, "complete", "2026-10-03T10:00:00.000Z", {
      game_date: "2026-10-03",
    });
    installDb(
      staleGameDb({
        incomplete: [],
        complete: [...freshGames, newerStale],
        markers: freshGames.map((row) => ({
          game_id: row.game_id,
          fetched_at: "2026-10-02T11:00:00.000Z",
        })),
      }),
    );
    const { req, res } = createMockApiContext();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body.derivedOnlyGameIds).toEqual([2026021500]);
    expect(refreshPlayerMock).toHaveBeenCalledWith(
      expect.objectContaining({ gameIds: [2026021500] }),
    );
  });

  it("still normalizes a newer game and fills derived slots behind 15 failing games", async () => {
    const failingGames = Array.from({ length: 15 }, (_, index) =>
      statusRow(2026020200 + index, "stale", null, {
        updated_at: "2026-10-01T00:00:00.000Z",
      }),
    );
    const newerGame = statusRow(STALE_GAME, "stale", null, {
      game_date: "2026-10-05",
      updated_at: "2026-10-06T00:00:00.000Z",
    });
    const db = staleGameDb({
      incomplete: [...failingGames, newerGame],
      complete: [statusRow(DERIVED_GAME, "complete", "2026-10-02T21:00:00.000Z")],
    });
    for (const row of failingGames) {
      db.heads[`${row.game_id}:play-by-play`] = { raw_payload_id: 11, payload_hash: PBP_HASH };
      db.heads[`${row.game_id}:shiftcharts`] = { raw_payload_id: 12, payload_hash: SHIFT_HASH };
    }
    installDb(db);
    persistCapturedGameNormalizationMock.mockImplementation(async (_client, args) => {
      if (args.gameId !== STALE_GAME) throw new Error("permanent normalization failure");
      return { idempotent: false };
    });
    const { req, res } = createMockApiContext({ limit: "15" });

    await handler(req as any, res as any);

    expect(res.body.normalizedGameIds).toEqual([STALE_GAME]);
    expect(res.body.failures).toHaveLength(14);
    expect(res.body.refreshedGameIds).toEqual([STALE_GAME, DERIVED_GAME]);
    expect(res.statusCode).toBe(207);
  });

  it("reports every xG-affected game when the games hold more than 1,000 feature rows", async () => {
    const games = [2026020001, 2026020002, 2026020003];
    installDb(
      staleGameDb({
        incomplete: [],
        complete: games.map((gameId) =>
          statusRow(gameId, "complete", "2026-10-02T21:00:00.000Z"),
        ),
        xgFeatures: [
          ...Array.from({ length: 1_200 }, () => ({ game_id: games[0] })),
          { game_id: games[1] },
          { game_id: games[2] },
        ],
      }),
    );
    const { req, res } = createMockApiContext();

    await handler(req as any, res as any);

    expect(res.body.xgRefreshNeededGameIds).toEqual(games);
  });

  it("ends the window at today's Eastern date", async () => {
    installDb(staleGameDb({ incomplete: [] }));
    // 02:30Z on 10-20 is still 10-19 in New York.
    const nowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValue(Date.parse("2026-10-20T02:30:00.000Z"));
    const { req, res } = createMockApiContext();

    await handler(req as any, res as any);
    nowSpy.mockRestore();

    expect(res.body.window).toEqual({ startDate: "2026-09-19", endDate: "2026-10-19" });
  });

  it("does not echo backend error messages in the 500 response", async () => {
    persistCapturedGameNormalizationMock.mockRejectedValueOnce(
      new Error("relation private_internal_table is locked"),
    );
    const db = staleGameDb();
    installDb(db);
    const baseImplementation = resolveQueryMock.getMockImplementation()!;
    resolveQueryMock.mockImplementation((filters: Filters) => {
      if (filters.table === "nhl_api_game_normalization_status" && filters.eq.status === "complete") {
        throw new Error("permission denied for schema secret_internal");
      }
      return baseImplementation(filters);
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { req, res } = createMockApiContext();

    await handler(req as any, res as any);
    consoleSpy.mockRestore();

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      stage: "select_derived_stale",
      error: "Gamecenter normalization sweep failed during select_derived_stale",
      failures: [{ gameId: STALE_GAME, stage: "normalize_gamecenter" }],
    });
    expect(JSON.stringify(res.body)).not.toMatch(/secret_internal|private_internal_table/);
  });
});
