import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, fetchPublicGamePredictionsMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(() => ({ from: vi.fn() })),
  fetchPublicGamePredictionsMock: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

vi.mock("lib/game-predictions/publicPredictions", () => ({
  fetchPublicGamePredictions: fetchPublicGamePredictionsMock,
}));

import handler from "../../../../../pages/api/v1/game-predictions/latest";

function createMockApiContext(args?: {
  method?: string;
  query?: Record<string, string | string[]>;
}) {
  const response = {
    statusCode: 200,
    body: null as unknown,
    headers: {} as Record<string, string | string[]>,
    setHeader: vi.fn((key: string, value: string | string[]) => {
      response.headers[key] = value;
    }),
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
    },
    res: response,
  };
}

describe("/api/v1/game-predictions/latest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    fetchPublicGamePredictionsMock.mockResolvedValue({
      generatedAt: "2026-06-15T12:00:00.000Z",
      count: 0,
      predictions: [],
      performance: null,
    });
  });

  it("returns the production-gated public payload with cache headers", async () => {
    const { req, res } = createMockApiContext({
      query: {
        fromDate: "2026-06-15",
        toDate: "2026-06-22",
        limit: "12",
      },
    });

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(createClientMock).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-role-key",
      expect.objectContaining({
        auth: expect.objectContaining({
          persistSession: false,
        }),
      }),
    );
    expect(fetchPublicGamePredictionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fromDate: "2026-06-15",
        toDate: "2026-06-22",
        limit: 12,
      }),
    );
    expect(res.headers["Cache-Control"]).toBe(
      "s-maxage=300, stale-while-revalidate=900",
    );
    expect(res.body).toEqual({
      success: true,
      generatedAt: "2026-06-15T12:00:00.000Z",
      count: 0,
      predictions: [],
      performance: null,
    });
  });

  it("uses since/until aliases and ignores invalid date or limit values", async () => {
    const { req, res } = createMockApiContext({
      query: {
        since: "bad-date",
        until: "2026-06-22",
        limit: "abc",
      },
    });

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(fetchPublicGamePredictionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fromDate: undefined,
        toDate: "2026-06-22",
        limit: undefined,
      }),
    );
  });

  it("rejects non-GET requests without querying predictions", async () => {
    const { req, res } = createMockApiContext({ method: "POST" });

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(405);
    expect(fetchPublicGamePredictionsMock).not.toHaveBeenCalled();
    expect(res.headers.Allow).toBe("GET");
    expect(res.body).toEqual({
      success: false,
      error: "Method not allowed",
    });
  });
});
