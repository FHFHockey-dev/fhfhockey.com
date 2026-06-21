import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  importHistoricalMarketOddsSnapshotsMock,
  fetchAccuracyLoopExpectedMarketOddsGameIdsMock,
} = vi.hoisted(() => ({
  importHistoricalMarketOddsSnapshotsMock: vi.fn(),
  fetchAccuracyLoopExpectedMarketOddsGameIdsMock: vi.fn(),
}));

vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: any) => handler,
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => handler,
}));

vi.mock("lib/game-predictions/espnOdds", () => ({
  importHistoricalMarketOddsSnapshots: importHistoricalMarketOddsSnapshotsMock,
}));

vi.mock("lib/game-predictions/accountability", () => ({
  fetchAccuracyLoopExpectedMarketOddsGameIds:
    fetchAccuracyLoopExpectedMarketOddsGameIdsMock,
}));

import handler from "../../../../../pages/api/v1/game-predictions/import-market-odds";

function createMockApiContext(args?: {
  method?: string;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
}) {
  const supabase = {
    from: vi.fn(),
  };
  const response = {
    statusCode: 200,
    body: null as unknown,
    headers: {} as Record<string, string | string[]>,
    setHeader(key: string, value: string | string[]) {
      response.headers[key] = value;
    },
    status: vi.fn((code: number) => {
      response.statusCode = code;
      return response;
    }),
    json: vi.fn((payload: unknown) => {
      response.body = payload;
      return response;
    }),
  };

  return {
    req: {
      method: args?.method ?? "POST",
      query: args?.query ?? {},
      body: args?.body ?? {},
      supabase,
    },
    res: response,
    supabase,
  };
}

describe("/api/v1/game-predictions/import-market-odds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    importHistoricalMarketOddsSnapshotsMock.mockResolvedValue({
      importedAt: "2026-06-15T12:00:00.000Z",
      importBatchId: "market-import-2026-06-15",
      requestedRows: 1,
      candidateSnapshots: 1,
      importedSnapshots: 0,
      rowsInserted: 0,
      skippedSnapshots: 0,
      missingGameRows: 0,
      invalidRows: 0,
      postStartRejectedRows: 0,
      provenanceRows: 0,
      rejectedProvenanceRows: 0,
      dryRun: true,
      blocked: false,
      blockingReasons: [],
      rejectionReasons: {},
      preflight: {
        expectedGames: 1,
        rowGameIds: 1,
        matchedExpectedGames: 1,
        candidateSnapshotGames: 1,
        missingExpectedGameIds: [],
        missingExpectedGameIdCount: 0,
        missingExpectedGameIdsTruncated: false,
        coveragePct: 1,
        warnings: [],
      },
    });
    fetchAccuracyLoopExpectedMarketOddsGameIdsMock.mockResolvedValue({
      gameIds: [1, 2],
      gameCount: 2,
      windowStartDate: "2026-01-10",
      windowEndDate: "2026-01-11",
    });
  });

  it("imports posted market odds rows as a dry run by default", async () => {
    const rows = [
      {
        gameId: 1,
        provider: "DraftKings",
        capturedAt: "2026-01-10T15:00:00.000Z",
        sourceUrl: "https://example.com/odds/game-1",
        homeMoneyline: "-130",
        awayMoneyline: "+110",
      },
    ];
    const { req, res, supabase } = createMockApiContext({
      body: {
        rows,
        expectedGameIds: [1],
        importedAt: "2026-06-15T12:00:00.000Z",
        importBatchId: "market-import-2026-06-15",
      },
    });

    await handler(req as never, res as never);

    expect(importHistoricalMarketOddsSnapshotsMock).toHaveBeenCalledWith({
      client: supabase,
      rows,
      expectedGameIds: [1],
      importedAt: "2026-06-15T12:00:00.000Z",
      importBatchId: "market-import-2026-06-15",
      dryRun: true,
      allowIncompleteExpectedCoverage: false,
    });
    expect(fetchAccuracyLoopExpectedMarketOddsGameIdsMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      dryRun: true,
      expectedGameSource: "body_expected_game_ids",
      result: {
        candidateSnapshots: 1,
        preflight: {
          coveragePct: 1,
        },
      },
    });
  });

  it("derives expected market odds game ids from an accuracy-loop window", async () => {
    const rows = [
      {
        gameId: 1,
        provider: "DraftKings",
        capturedAt: "2026-01-10T15:00:00.000Z",
        sourceUrl: "https://example.com/odds/game-1",
        homeMoneyline: "-130",
        awayMoneyline: "+110",
      },
    ];
    const { req, res, supabase } = createMockApiContext({
      body: {
        rows,
        expectedWindow: {
          seasonId: 20252026,
          gameType: 2,
          trainStartDate: "2026-01-01",
          blindDate: "2026-01-09",
          analysisEndDate: "2026-01-12",
          horizonDays: [0, 1],
          maxReplayGames: 10,
        },
      },
    });

    await handler(req as never, res as never);

    expect(fetchAccuracyLoopExpectedMarketOddsGameIdsMock).toHaveBeenCalledWith({
      client: supabase,
      window: expect.objectContaining({
        seasonId: 20252026,
        gameType: 2,
        trainStartDate: "2026-01-01",
        blindDate: "2026-01-09",
        analysisEndDate: "2026-01-12",
        horizonDays: [0, 1],
        maxReplayGames: 10,
      }),
    });
    expect(importHistoricalMarketOddsSnapshotsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client: supabase,
        rows,
        expectedGameIds: [1, 2],
        dryRun: true,
        allowIncompleteExpectedCoverage: false,
      }),
    );
    expect(res.body).toMatchObject({
      success: true,
      expectedGameSource: "expected_window",
      expectedWindow: {
        gameIds: [1, 2],
        gameCount: 2,
        windowStartDate: "2026-01-10",
        windowEndDate: "2026-01-11",
      },
    });
  });

  it("returns conflict when non-dry-run import is blocked by preflight coverage", async () => {
    importHistoricalMarketOddsSnapshotsMock.mockResolvedValueOnce({
      importedAt: "2026-06-15T12:00:00.000Z",
      importBatchId: "market-import-2026-06-15",
      requestedRows: 1,
      candidateSnapshots: 1,
      importedSnapshots: 0,
      rowsInserted: 0,
      skippedSnapshots: 0,
      missingGameRows: 0,
      invalidRows: 0,
      postStartRejectedRows: 0,
      provenanceRows: 0,
      rejectedProvenanceRows: 0,
      dryRun: false,
      blocked: true,
      blockingReasons: [
        "historical_market_odds_import_incomplete_expected_coverage",
      ],
      rejectionReasons: {},
      preflight: {
        expectedGames: 2,
        rowGameIds: 1,
        matchedExpectedGames: 2,
        candidateSnapshotGames: 1,
        missingExpectedGameIds: [2],
        missingExpectedGameIdCount: 1,
        missingExpectedGameIdsTruncated: false,
        coveragePct: 0.5,
        warnings: ["historical_market_odds_import_missing_expected_games"],
      },
    });
    const rows = [
      {
        gameId: 1,
        provider: "DraftKings",
        capturedAt: "2026-01-10T15:00:00.000Z",
        sourceUrl: "https://example.com/odds/game-1",
        homeMoneyline: "-130",
        awayMoneyline: "+110",
      },
    ];
    const { req, res, supabase } = createMockApiContext({
      body: {
        rows,
        expectedGameIds: [1, 2],
        dryRun: false,
        confirmWrite: true,
      },
    });

    await handler(req as never, res as never);

    expect(importHistoricalMarketOddsSnapshotsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client: supabase,
        rows,
        expectedGameIds: [1, 2],
        dryRun: false,
        allowIncompleteExpectedCoverage: false,
      }),
    );
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({
      success: false,
      dryRun: false,
      error: "Historical market odds import blocked by preflight coverage guardrails.",
      result: {
        blocked: true,
        blockingReasons: [
          "historical_market_odds_import_incomplete_expected_coverage",
        ],
      },
    });
  });

  it("requires explicit confirmation before writing historical market odds", async () => {
    const rows = [
      {
        gameId: 1,
        provider: "DraftKings",
        capturedAt: "2026-01-10T15:00:00.000Z",
        sourceUrl: "https://example.com/odds/game-1",
        homeMoneyline: "-130",
        awayMoneyline: "+110",
      },
    ];
    const { req, res } = createMockApiContext({
      body: {
        rows,
        expectedGameIds: [1],
        dryRun: false,
      },
    });

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(400);
    expect(importHistoricalMarketOddsSnapshotsMock).not.toHaveBeenCalled();
    expect(res.body).toEqual({
      success: false,
      error: "Writing historical market odds requires confirmWrite=true.",
    });
  });

  it("requires a non-empty rows array", async () => {
    const { req, res } = createMockApiContext({ body: { rows: [] } });

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(400);
    expect(importHistoricalMarketOddsSnapshotsMock).not.toHaveBeenCalled();
  });
});
