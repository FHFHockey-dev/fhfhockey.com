import { beforeEach, describe, expect, it, vi } from "vitest";

const { generatePregamePredictionsForWindowMock, auditInsertMock } = vi.hoisted(() => ({
  generatePregamePredictionsForWindowMock: vi.fn(),
  auditInsertMock: vi.fn(),
}));

vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: any) => handler,
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => handler,
}));

vi.mock("lib/game-predictions/workflow", async (importOriginal) => ({
  ...(await importOriginal<typeof import("lib/game-predictions/workflow")>()),
  generatePregamePredictionsForWindow: generatePregamePredictionsForWindowMock,
}));

vi.mock("lib/supabase/server", () => ({
  default: { from: vi.fn(() => ({ insert: auditInsertMock })) },
}));

import handler from "../../../../../pages/api/v1/game-predictions/forecast";

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
      method: args?.method ?? "POST",
      query: args?.query ?? {},
      supabase,
    },
    res: response,
    supabase,
  };
}

describe("/api/v1/game-predictions/forecast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generatePregamePredictionsForWindowMock.mockResolvedValue({
      fromDate: "2026-06-15",
      toDate: "2026-06-22",
      sourceAsOfDate: "2026-06-15",
      requestedGames: 1,
      processedGames: 1,
      skippedGames: 0,
      stoppedForDeadline: false,
      dryRun: true,
      results: [],
    });
  });

  it("does not allow baseline bootstrap unless the query explicitly opts in", async () => {
    const { req, res, supabase } = createMockApiContext({
      query: {
        fromDate: "2026-06-15",
        toDate: "2026-06-22",
        predictionCutoffAt: "2026-06-15T16:00:00.000Z",
        dryRun: "true",
      },
    });

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(generatePregamePredictionsForWindowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client: supabase,
        fromDate: "2026-06-15",
        toDate: "2026-06-22",
        predictionCutoffAt: "2026-06-15T16:00:00.000Z",
        allowBaselineBootstrap: false,
        dryRun: true,
      }),
    );
  });

  it("passes explicit baseline bootstrap opt-in to the workflow", async () => {
    const { req, res } = createMockApiContext({
      query: {
        fromDate: "2026-06-15",
        toDate: "2026-06-22",
        allowBaselineBootstrap: "true",
      },
    });

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(generatePregamePredictionsForWindowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        allowBaselineBootstrap: true,
      }),
    );
  });

  it("rejects unsupported methods", async () => {
    const { req, res } = createMockApiContext({ method: "PUT" });

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(405);
    expect(generatePregamePredictionsForWindowMock).not.toHaveBeenCalled();
    expect(res.headers.Allow).toBe("GET, POST");
  });

  function windowResult(
    results: Array<{
      gameId: number;
      predictionId?: string | null;
      skippedReason?: string | null;
    }>,
  ) {
    const rows = results.map((row) => ({
      featureSnapshotId: row.predictionId ? "snapshot" : null,
      homeWinProbability: null,
      awayWinProbability: null,
      dryRun: false,
      predictionId: null,
      skippedReason: null,
      ...row,
    }));
    const processedGames = rows.filter((row) => !row.skippedReason).length;
    return {
      fromDate: "2026-10-18",
      toDate: "2026-10-18",
      sourceAsOfDate: "2026-10-18",
      requestedGames: rows.length,
      processedGames,
      skippedGames: rows.length - processedGames,
      stoppedForDeadline: false,
      dryRun: false,
      results: rows,
    };
  }

  async function runThroughCronAudit(result: ReturnType<typeof windowResult>) {
    generatePregamePredictionsForWindowMock.mockResolvedValue(result);
    const { withCronJobAudit } = await vi.importActual<
      typeof import("lib/cron/withCronJobAudit")
    >("lib/cron/withCronJobAudit");
    auditInsertMock.mockResolvedValue({ error: null });
    const { req, res } = createMockApiContext({ method: "GET" });
    await withCronJobAudit(handler as any, { jobName: "game-predictions-forecast" })(
      { ...req, url: "/api/v1/game-predictions/forecast" } as any,
      res as any,
    );
    return { body: res.body as any, audit: auditInsertMock.mock.calls.at(-1)?.[0] };
  }

  it("reports a no-production-model run as a healthy no-op that wrote nothing", async () => {
    const { body, audit } = await runThroughCronAudit(
      windowResult([
        { gameId: 1, skippedReason: "no_production_model_version" },
        { gameId: 2, skippedReason: "no_production_model_version" },
      ]),
    );

    expect(body).toMatchObject({
      success: true,
      status: "no_production_model",
      persistedPredictions: 0,
      skippedGames: 2,
      noProductionModelGames: 2,
      failedGames: 0,
    });
    expect(audit).toMatchObject({ job_name: "game-predictions-forecast", status: "success" });
  });

  it("fails the cron audit when a game errors instead of hiding it behind success", async () => {
    const { body, audit } = await runThroughCronAudit(
      windowResult([
        { gameId: 1, predictionId: "prediction-1" },
        { gameId: 2, skippedReason: "Missing team game rows for game 2" },
      ]),
    );

    expect(body).toMatchObject({
      success: false,
      status: "failed",
      persistedPredictions: 1,
      skippedGames: 1,
      failedGames: 1,
    });
    expect(audit).toMatchObject({ status: "failure" });
  });

  it("reports persisted predictions when the window writes", async () => {
    const { body, audit } = await runThroughCronAudit(
      windowResult([
        { gameId: 1, predictionId: "prediction-1" },
        { gameId: 2, skippedReason: "prediction_cutoff_at_or_after_puck_drop" },
      ]),
    );

    expect(body).toMatchObject({
      success: true,
      status: "persisted",
      persistedPredictions: 1,
      skippedGames: 1,
      failedGames: 0,
    });
    expect(audit).toMatchObject({ status: "success" });
  });
});
