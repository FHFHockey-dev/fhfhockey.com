import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  ingestEspnNhlOddsSnapshotsForWindowMock,
  parseRequestedOddsDateBatchesMock,
} = vi.hoisted(() => ({
  ingestEspnNhlOddsSnapshotsForWindowMock: vi.fn(),
  parseRequestedOddsDateBatchesMock: vi.fn(),
}));

vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: any) => handler,
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => handler,
}));

vi.mock("lib/game-predictions/espnOdds", () => ({
  ingestEspnNhlOddsSnapshotsForWindow:
    ingestEspnNhlOddsSnapshotsForWindowMock,
  parseRequestedOddsDateBatches: parseRequestedOddsDateBatchesMock,
}));

import handler from "../../../../../pages/api/v1/game-predictions/ingest-espn-odds";

function createMockApiContext(args?: {
  method?: string;
  query?: Record<string, string>;
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
      method: args?.method ?? "GET",
      query: args?.query ?? {},
      supabase,
    },
    res: response,
    supabase,
  };
}

describe("/api/v1/game-predictions/ingest-espn-odds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parseRequestedOddsDateBatchesMock.mockReturnValue([
      ["2026-06-01", "2026-06-02"],
      ["2026-06-03"],
    ]);
    ingestEspnNhlOddsSnapshotsForWindowMock.mockResolvedValue({
      requestedDates: ["2026-06-01", "2026-06-02", "2026-06-03"],
      capturedAt: "2026-06-01T12:00:00.000Z",
      fetchedGames: 3,
      candidateSnapshots: 3,
      insertedSnapshots: 3,
      skippedSnapshots: 0,
      postStartSkippedSnapshots: 0,
      missingMoneylineSnapshots: 0,
      unmappedGames: 0,
      provenanceRows: 3,
      rejectedProvenanceRows: 0,
      dryRun: true,
      batchCount: 2,
      batches: [],
    });
  });

  it("ingests a bounded date window in ESPN-safe batches", async () => {
    const { req, res, supabase } = createMockApiContext({
      query: {
        fromDate: "2026-06-01",
        toDate: "2026-07-15",
        fromOffsetDays: "-1",
        toOffsetDays: "1",
        maxDates: "21",
        dryRun: "true",
      },
    });

    await handler(req as never, res as never);

    expect(parseRequestedOddsDateBatchesMock).toHaveBeenCalledWith({
      dates: undefined,
      fromDate: "2026-06-01",
      toDate: "2026-07-15",
      fromOffsetDays: -1,
      toOffsetDays: 1,
      maxDates: 21,
    });
    expect(ingestEspnNhlOddsSnapshotsForWindowMock).toHaveBeenCalledWith({
      client: supabase,
      dateBatches: [
        ["2026-06-01", "2026-06-02"],
        ["2026-06-03"],
      ],
      dryRun: true,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      operationStatus: "success",
      dataQualityWarnings: [],
      result: {
        batchCount: 2,
        requestedDates: ["2026-06-01", "2026-06-02", "2026-06-03"],
      },
    });
  });

  it("surfaces degraded pre-start odds coverage in the cron response", async () => {
    ingestEspnNhlOddsSnapshotsForWindowMock.mockResolvedValue({
      requestedDates: ["2026-06-01"],
      capturedAt: "2026-06-01T12:00:00.000Z",
      fetchedGames: 2,
      candidateSnapshots: 0,
      insertedSnapshots: 0,
      skippedSnapshots: 1,
      postStartSkippedSnapshots: 0,
      missingMoneylineSnapshots: 1,
      unmappedGames: 1,
      provenanceRows: 1,
      rejectedProvenanceRows: 1,
      dryRun: false,
      batchCount: 1,
      batches: [],
    });
    const { req, res } = createMockApiContext();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      operationStatus: "warning",
      warning:
        "ESPN market odds ingestion completed with source-quality warnings. Treat market odds coverage as degraded until these warnings clear.",
      dataQualityWarnings: [
        "espn_odds_ingest_unmapped_games",
        "espn_odds_ingest_missing_moneyline",
        "espn_odds_ingest_no_usable_pre_start_snapshots",
      ],
    });
  });

  it("does not warn when every fetched row is rejected only because the window is post-start", async () => {
    ingestEspnNhlOddsSnapshotsForWindowMock.mockResolvedValue({
      requestedDates: ["2026-06-01"],
      capturedAt: "2026-06-02T12:00:00.000Z",
      fetchedGames: 2,
      candidateSnapshots: 0,
      insertedSnapshots: 0,
      skippedSnapshots: 2,
      postStartSkippedSnapshots: 2,
      missingMoneylineSnapshots: 0,
      unmappedGames: 0,
      provenanceRows: 2,
      rejectedProvenanceRows: 2,
      dryRun: false,
      batchCount: 1,
      batches: [],
    });
    const { req, res } = createMockApiContext();

    await handler(req as never, res as never);

    expect(res.body).toMatchObject({
      success: true,
      operationStatus: "success",
      warning: null,
      dataQualityWarnings: [],
    });
  });
});
