import { beforeEach, describe, expect, it, vi } from "vitest";

const { mainMock, auditInsertMock } = vi.hoisted(() => ({
  mainMock: vi.fn(),
  auditInsertMock: vi.fn().mockResolvedValue({ error: null })
}));

vi.mock("lib/supabase/Upserts/fetchRollingPlayerAverages", () => ({
  main: mainMock
}));

vi.mock("lib/supabase", () => ({
  default: {
    from: vi.fn(() => ({
      insert: auditInsertMock
    }))
  }
}));

import handler from "./update-rolling-player-averages";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string | string[]>,
    body: null as any,
    headersSent: false,
    setHeader(key: string, value: string | string[]) {
      this.headers[key] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      this.headersSent = true;
      return this;
    },
    send(payload: any) {
      this.body = payload;
      this.headersSent = true;
      return this;
    }
  };
  return res;
}

describe("/api/v1/db/update-rolling-player-averages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mainMock.mockResolvedValue(undefined);
  });

  it("returns 405 for unsupported methods", async () => {
    const req: any = {
      method: "DELETE",
      query: {},
      url: "/api/v1/db/update-rolling-player-averages"
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("GET, POST, HEAD");
    expect(res.body).toEqual({ message: "Method not allowed" });
  });

  it("forwards dry-run and debug upsert controls with fast-mode defaults to main", async () => {
    const req: any = {
      method: "GET",
      query: {
        playerId: "8478402",
        season: "20252026",
        resumeFrom: "8478000",
        fullRefresh: "false",
        fullRefreshMode: "overwrite_only",
        deleteChunkSize: "25000",
        upsertBatchSize: "900",
        dryRunUpsert: "yes",
        debugUpsertPayload: "true",
        fastMode: "true"
      },
      url: "/api/v1/db/update-rolling-player-averages?playerId=8478402"
    };
    const res = createMockRes();

    await handler(req, res);

    expect(mainMock).toHaveBeenCalledWith({
      playerId: 8478402,
      season: 20252026,
      startDate: undefined,
      endDate: undefined,
      resumePlayerId: 8478000,
      forceFullRefresh: false,
      fullRefreshMode: "overwrite_only",
      fullRefreshDeleteChunkSize: 25000,
      playerConcurrency: 4,
      upsertBatchSize: 900,
      upsertConcurrency: 4,
      skipDiagnostics: true,
      dryRunUpsert: true,
      debugUpsertPayload: true
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      message: "Rolling player averages processed successfully.",
      executionProfile: "targeted_repair",
      runtimeBudget: expect.objectContaining({
        budgetMs: 600000,
        withinBudget: true
      })
    });
  });

  it("infers overnight tuning defaults for broad fast-mode season sweeps", async () => {
    const req: any = {
      method: "GET",
      query: {
        season: "20252026",
        fastMode: "true"
      },
      url: "/api/v1/db/update-rolling-player-averages?season=20252026&fastMode=true"
    };
    const res = createMockRes();

    await handler(req, res);

    expect(mainMock).toHaveBeenCalledWith({
      playerId: undefined,
      season: 20252026,
      startDate: undefined,
      endDate: undefined,
      resumePlayerId: undefined,
      forceFullRefresh: undefined,
      fullRefreshMode: undefined,
      fullRefreshDeleteChunkSize: undefined,
      playerConcurrency: 4,
      upsertBatchSize: 250,
      upsertConcurrency: 2,
      skipDiagnostics: true,
      dryRunUpsert: undefined,
      debugUpsertPayload: undefined
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      executionProfile: "overnight",
      runtimeBudget: expect.objectContaining({
        budgetMs: 1800000,
        withinBudget: true
      })
    });
  });

  it("returns 500 when the rolling writer throws", async () => {
    mainMock.mockRejectedValueOnce(new Error("upsert blocker"));

    const req: any = {
      method: "GET",
      query: {
        playerId: "8478402"
      },
      url: "/api/v1/db/update-rolling-player-averages?playerId=8478402"
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      message: "upsert blocker"
    });
  });
});
