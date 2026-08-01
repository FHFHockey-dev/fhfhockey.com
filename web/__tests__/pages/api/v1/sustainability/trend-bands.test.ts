import { beforeEach, describe, expect, it, vi } from "vitest";

const { computeMock } = vi.hoisted(() => ({
  computeMock: vi.fn(),
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => async (req: any, res: any) => {
    if (req.headers?.authorization !== "Bearer current-secret") {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    return handler(req, res);
  },
}));

vi.mock("lib/sustainability/bandService", () => ({
  computeAndStoreTrendBands: computeMock,
  parseDateParam: (value: unknown) => String(value ?? "2026-03-21"),
  parseMetricParam: () => ["shp"],
  parseWindowParam: () => ["l3"],
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: () => {
      const query: any = {
        select: () => query,
        eq: () => query,
        in: () => query,
        order: () => query,
        gte: () => query,
        lt: () => query,
        limit: () => Promise.resolve({ data: [], error: null }),
      };
      return query;
    },
  },
}));

import handler from "../../../../../pages/api/v1/sustainability/trend-bands";

function createRes() {
  return {
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  } as any;
}

describe("/api/v1/sustainability/trend-bands auth split", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    computeMock.mockResolvedValue({ rows: [{ player_id: 8478402 }] });
  });

  it("keeps ordinary GET reads public", async () => {
    const res = createRes();

    await handler(
      { method: "GET", query: { player_id: "8478402" }, headers: {} } as any,
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, rows: [] });
    expect(computeMock).not.toHaveBeenCalled();
  });

  it.each([
    ["GET", { player_id: "8478402", recompute: "true" }],
    ["POST", { player_id: "8478402" }],
  ])("rejects unauthenticated %s mutation", async (method, query) => {
    const res = createRes();

    await handler({ method, query, body: {}, headers: {} } as any, res);

    expect(res.statusCode).toBe(401);
    expect(computeMock).not.toHaveBeenCalled();
  });

  it("allows the authorized mutation path", async () => {
    const res = createRes();

    await handler(
      {
        method: "POST",
        query: { player_id: "8478402" },
        body: {},
        headers: { authorization: "Bearer current-secret" },
      } as any,
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(computeMock).toHaveBeenCalledTimes(1);
  });
});
