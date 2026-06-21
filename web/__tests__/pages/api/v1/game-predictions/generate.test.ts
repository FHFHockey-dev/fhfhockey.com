import { beforeEach, describe, expect, it, vi } from "vitest";

const { generatePregamePredictionForGameMock } = vi.hoisted(() => ({
  generatePregamePredictionForGameMock: vi.fn(),
}));

vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: any) => handler,
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => handler,
}));

vi.mock("lib/game-predictions/workflow", () => ({
  generatePregamePredictionForGame: generatePregamePredictionForGameMock,
}));

import handler from "../../../../../pages/api/v1/game-predictions/generate";

function createMockApiContext(args?: {
  query?: Record<string, string>;
}) {
  const supabase = {
    from: vi.fn(),
  };
  const response = {
    statusCode: 200,
    body: null as unknown,
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
      query: args?.query ?? {},
      supabase,
    },
    res: response,
    supabase,
  };
}

describe("/api/v1/game-predictions/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generatePregamePredictionForGameMock.mockResolvedValue({
      gameId: 1,
      featureSnapshotId: null,
      predictionId: null,
      homeWinProbability: 0.55,
      awayWinProbability: 0.45,
      skippedReason: null,
      dryRun: true,
    });
  });

  it("passes baseline bootstrap opt-in only when explicitly requested", async () => {
    const { req, res, supabase } = createMockApiContext({
      query: {
        gameId: "1",
        dryRun: "true",
      },
    });

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(generatePregamePredictionForGameMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client: supabase,
        gameId: 1,
        allowBaselineBootstrap: false,
        dryRun: true,
      }),
    );

    const optedIn = createMockApiContext({
      query: {
        gameId: "1",
        allowBaselineBootstrap: "true",
      },
    });
    await handler(optedIn.req as never, optedIn.res as never);

    expect(generatePregamePredictionForGameMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        allowBaselineBootstrap: true,
      }),
    );
  });

  it("requires a numeric game id", async () => {
    const { req, res } = createMockApiContext({
      query: {
        gameId: "not-a-game",
      },
    });

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(400);
    expect(generatePregamePredictionForGameMock).not.toHaveBeenCalled();
  });
});
