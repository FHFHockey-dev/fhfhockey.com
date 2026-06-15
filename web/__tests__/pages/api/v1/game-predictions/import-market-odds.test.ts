import { beforeEach, describe, expect, it, vi } from "vitest";

const { importHistoricalMarketOddsSnapshotsMock } = vi.hoisted(() => ({
  importHistoricalMarketOddsSnapshotsMock: vi.fn(),
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
      rejectionReasons: {},
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
        importedAt: "2026-06-15T12:00:00.000Z",
        importBatchId: "market-import-2026-06-15",
      },
    });

    await handler(req as never, res as never);

    expect(importHistoricalMarketOddsSnapshotsMock).toHaveBeenCalledWith({
      client: supabase,
      rows,
      importedAt: "2026-06-15T12:00:00.000Z",
      importBatchId: "market-import-2026-06-15",
      dryRun: true,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      dryRun: true,
      result: {
        candidateSnapshots: 1,
      },
    });
  });

  it("requires a non-empty rows array", async () => {
    const { req, res } = createMockApiContext({ body: { rows: [] } });

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(400);
    expect(importHistoricalMarketOddsSnapshotsMock).not.toHaveBeenCalled();
  });
});
