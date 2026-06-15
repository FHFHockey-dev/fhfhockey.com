import { beforeEach, describe, expect, it, vi } from "vitest";

const { promoteGamePredictionModelVersionMock } = vi.hoisted(() => ({
  promoteGamePredictionModelVersionMock: vi.fn(),
}));

vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: any) => handler,
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => handler,
}));

vi.mock("lib/game-predictions/workflow", () => ({
  promoteGamePredictionModelVersion: promoteGamePredictionModelVersionMock,
}));

import handler from "../../../../../pages/api/v1/game-predictions/promote-model-version";

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

describe("/api/v1/game-predictions/promote-model-version", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    promoteGamePredictionModelVersionMock.mockResolvedValue({
      promoted: true,
      reasons: [],
      modelName: "nhl_game_baseline_logistic",
      modelVersion: "candidate-v1",
      featureSetVersion: "game_features_v5_accuracy_candidates",
      promotedAt: "2026-06-15T12:00:00.000Z",
      retiredProductionRows: 1,
    });
  });

  it("refuses mutation unless dryRun=false and confirm=true are explicit", async () => {
    const { req, res } = createMockApiContext({
      query: {
        modelName: "nhl_game_baseline_logistic",
        modelVersion: "candidate-v1",
        featureSetVersion: "game_features_v5_accuracy_candidates",
        confirm: "true",
      },
    });

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(400);
    expect(promoteGamePredictionModelVersionMock).not.toHaveBeenCalled();
    expect(res.body).toEqual({
      success: false,
      dryRun: true,
      error:
        "Promotion requires dryRun=false and confirm=true after persisted evidence review.",
    });
  });

  it("delegates confirmed promotion to the persisted-evidence gate", async () => {
    const { req, res, supabase } = createMockApiContext({
      query: {
        modelName: "nhl_game_baseline_logistic",
        modelVersion: "candidate-v1",
        featureSetVersion: "game_features_v5_accuracy_candidates",
        dryRun: "false",
        confirm: "true",
        minEvaluatedGames: "150",
      },
    });

    await handler(req as never, res as never);

    expect(promoteGamePredictionModelVersionMock).toHaveBeenCalledWith({
      client: supabase,
      modelName: "nhl_game_baseline_logistic",
      modelVersion: "candidate-v1",
      featureSetVersion: "game_features_v5_accuracy_candidates",
      minEvaluatedGames: 150,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      dryRun: false,
      result: {
        promoted: true,
        retiredProductionRows: 1,
      },
    });
  });

  it("returns conflict when persisted evidence blocks promotion", async () => {
    promoteGamePredictionModelVersionMock.mockResolvedValueOnce({
      promoted: false,
      reasons: ["Persisted promotion evidence is not eligible for promotion."],
      modelName: "nhl_game_baseline_logistic",
      modelVersion: "candidate-v1",
      featureSetVersion: "game_features_v5_accuracy_candidates",
      promotedAt: null,
      retiredProductionRows: 0,
    });
    const { req, res } = createMockApiContext({
      query: {
        modelName: "nhl_game_baseline_logistic",
        modelVersion: "candidate-v1",
        featureSetVersion: "game_features_v5_accuracy_candidates",
        dryRun: "false",
        confirm: "true",
      },
    });

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({
      success: false,
      dryRun: false,
      result: {
        promoted: false,
        reasons: ["Persisted promotion evidence is not eligible for promotion."],
      },
    });
  });
});
