import { beforeEach, describe, expect, it, vi } from "vitest";

const { runGamePredictionAccuracyImprovementLoopMock } = vi.hoisted(() => ({
  runGamePredictionAccuracyImprovementLoopMock: vi.fn(),
}));

vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: any) => handler,
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => handler,
}));

vi.mock("lib/game-predictions/accountability", () => ({
  ACCURACY_IMPROVEMENT_ABLATION_VARIANT_KEYS: [
    "long_window_form_candidate",
    "market_anchored_candidate",
  ],
  DEFAULT_BACKTEST_ABLATION_VARIANTS: [
    {
      key: "long_window_form_candidate",
      label: "Long-window form candidate",
    },
    {
      key: "market_anchored_candidate",
      label: "Market-anchored candidate",
    },
  ],
  runGamePredictionAccuracyImprovementLoop:
    runGamePredictionAccuracyImprovementLoopMock,
}));

import handler from "../../../../../pages/api/v1/game-predictions/accuracy-loop";

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

describe("/api/v1/game-predictions/accuracy-loop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runGamePredictionAccuracyImprovementLoopMock.mockResolvedValue({
      featureSignal: {
        leakageChecks: [],
      },
      ablations: {
        promotionEvidencePersisted: true,
      },
    });
  });

  it("passes persistEvidence through while keeping the endpoint dry-run scoped", async () => {
    const { req, res, supabase } = createMockApiContext({
      method: "POST",
      query: {
        seasonId: "20252026",
        persistEvidence: "true",
        analysisEndDate: "2026-03-08",
        horizonDays: "0,3",
        maxReplayGames: "25",
        variants: "long_window_form_candidate,market_anchored_candidate",
      },
    });

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(runGamePredictionAccuracyImprovementLoopMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client: supabase,
        seasonId: 20252026,
        persistEvidence: true,
        analysisEndDate: "2026-03-08",
        horizonDays: [0, 3],
        maxReplayGames: 25,
        variantKeys: [
          "long_window_form_candidate",
          "market_anchored_candidate",
        ],
      }),
    );
    expect(res.body).toMatchObject({
      success: true,
      dryRun: true,
      evidencePersisted: true,
    });
  });

  it("rejects dryRun=false before evidence persistence can run", async () => {
    const { req, res } = createMockApiContext({
      method: "POST",
      query: {
        seasonId: "20252026",
        dryRun: "false",
        persistEvidence: "true",
      },
    });

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(400);
    expect(runGamePredictionAccuracyImprovementLoopMock).not.toHaveBeenCalled();
    expect(res.body).toEqual({
      success: false,
      error: "The accuracy loop endpoint is dry-run only.",
    });
  });

  it("rejects unknown candidate variants before the loop runs", async () => {
    const { req, res } = createMockApiContext({
      query: {
        seasonId: "20252026",
        variants: "market_anchored_candidate,unknown_candidate",
      },
    });

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(400);
    expect(runGamePredictionAccuracyImprovementLoopMock).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({
      success: false,
      error: "Unknown ablation variant key(s).",
      unknownVariantKeys: ["unknown_candidate"],
      availableVariants: [
        "long_window_form_candidate",
        "market_anchored_candidate",
      ],
    });
  });
});
