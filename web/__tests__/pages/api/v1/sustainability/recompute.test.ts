import { beforeEach, describe, expect, it, vi } from "vitest";

const { runMock } = vi.hoisted(() => ({
  runMock: vi.fn()
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => handler
}));

vi.mock("lib/sustainability/recompute", () => ({
  runSustainabilityRecompute: runMock
}));

import { recomputeHandler } from "../../../../../pages/api/v1/sustainability/recompute";

function createRes() {
  return {
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.body = body;
      return this;
    }
  } as any;
}

describe("POST /api/v1/sustainability/recompute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runMock.mockResolvedValue({
      offset: 0,
      limit: 50,
      playersLoaded: 1,
      rowsBuilt: 14,
      rowsUpserted: 14,
      chunks: 1,
      skippedNoSource: 0,
      failures: [],
      hasMore: false
    });
  });

  it("validates method and date", async () => {
    const methodRes = createRes();
    await recomputeHandler({ method: "GET", query: {} }, methodRes);
    expect(methodRes.statusCode).toBe(405);
    expect(methodRes.headers.Allow).toBe("POST");

    const dateRes = createRes();
    await recomputeHandler(
      { method: "POST", query: { date: "not-a-date" }, supabase: {} },
      dateRes
    );
    expect(dateRes.statusCode).toBe(400);
    expect(runMock).not.toHaveBeenCalled();
  });

  it("bounds the batch and reports partial failures", async () => {
    runMock.mockResolvedValueOnce({
      offset: 12,
      limit: 50,
      playersLoaded: 2,
      rowsBuilt: 14,
      rowsUpserted: 14,
      chunks: 1,
      skippedNoSource: 0,
      failures: [{ playerId: 999, message: "source unavailable" }],
      hasMore: false
    });
    const res = createRes();
    await recomputeHandler(
      {
        method: "POST",
        query: { date: "2026-03-21", limit: "999", offset: "12" },
        supabase: { service: true }
      },
      res
    );

    expect(res.statusCode).toBe(207);
    expect(res.body.partial).toBe(true);
    expect(runMock).toHaveBeenCalledWith({
      client: { service: true },
      snapshotDate: "2026-03-21",
      offset: 12,
      limit: 50,
      dry: false
    });
  });
});
