import { beforeEach, describe, expect, it, vi } from "vitest";

type Filters = {
  table: string;
  eq: Record<string, unknown>;
  neq: Record<string, unknown>;
  in: Record<string, unknown[]>;
};

const {
  resolveQueryMock,
  persistCapturedGameNormalizationMock,
  refreshPlayerMock,
  refreshTeamMock,
} = vi.hoisted(() => ({
  resolveQueryMock: vi.fn(),
  persistCapturedGameNormalizationMock: vi.fn(),
  refreshPlayerMock: vi.fn(),
  refreshTeamMock: vi.fn(),
}));

vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: any) => handler,
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => handler,
}));

vi.mock("lib/supabase/server", () => {
  function from(table: string) {
    const filters: Filters = { table, eq: {}, neq: {}, in: {} };
    const builder: any = {
      select: () => builder,
      order: () => builder,
      limit: () => builder,
      gte: () => builder,
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
        Promise.resolve({ data: resolveQueryMock(filters), error: null }).then(
          resolve,
          reject,
        ),
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
}));

vi.mock("lib/underlying-stats/teamStatsSummaryRefresh", () => ({
  refreshTeamUnderlyingSummaryRowsForGameIds: refreshTeamMock,
}));

import handler from "../../../../../pages/api/v1/db/sweep-gamecenter-normalization";

const STALE_GAME = 2026020004;
const DERIVED_GAME = 2026020010;
const PBP_HASH = "a".repeat(64);
const SHIFT_HASH = "b".repeat(64);

function statusRow(gameId: number, status: string, completedAt: string | null) {
  return {
    game_id: gameId,
    season_id: 20262027,
    game_date: "2026-10-01",
    status,
    completed_at: completedAt,
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
        return db.markers.filter((marker) =>
          (filters.in.game_id ?? []).includes(marker.game_id),
        );
      case "nhl_xg_shot_features":
        return db.xgFeatures.filter((row) =>
          (filters.in.game_id ?? []).includes(row.game_id),
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
});
