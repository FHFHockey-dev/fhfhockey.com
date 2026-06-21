import { beforeEach, describe, expect, it, vi } from "vitest";

const { generatePregamePredictionsForWindowMock } = vi.hoisted(() => ({
  generatePregamePredictionsForWindowMock: vi.fn(),
}));

vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: any) => handler,
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => handler,
}));

vi.mock("lib/game-predictions/workflow", () => ({
  generatePregamePredictionsForWindow: generatePregamePredictionsForWindowMock,
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
});
