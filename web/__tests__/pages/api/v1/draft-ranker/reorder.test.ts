import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireApiUserMock, reorderDraftRankingMock } = vi.hoisted(() => ({
  requireApiUserMock: vi.fn(),
  reorderDraftRankingMock: vi.fn(),
}));

vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: requireApiUserMock }));
vi.mock("lib/draft-ranker/server", () => ({
  reorderDraftRanking: reorderDraftRankingMock,
}));

import { DraftRankerApiError } from "lib/draft-ranker/api";
import handler from "../../../../../pages/api/v1/draft-ranker/reorder";

function createMockRes() {
  return {
    statusCode: 200,
    body: null as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

describe("POST /api/v1/draft-ranker/reorder", () => {
  const previousFlag = process.env.DRAFT_RANKER_ENABLED;
  const body = {
    operationId: "019f5a30-0000-7000-8000-000000000001",
    expectedVersion: 4,
    rankingId: "019f5a30-0000-7000-8000-000000000002",
    playerId: 101,
    action: "move_to_rank",
    targetRank: 12,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DRAFT_RANKER_ENABLED = "true";
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
    reorderDraftRankingMock.mockResolvedValue({
      status: "completed",
      rankingId: body.rankingId,
      playerId: 101,
      resultingRank: 12,
      resultingVersion: 5,
    });
  });

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.DRAFT_RANKER_ENABLED;
    else process.env.DRAFT_RANKER_ENABLED = previousFlag;
  });

  it("uses the authenticated owner and returns the resulting version", async () => {
    const req: any = {
      method: "POST",
      headers: { "x-request-id": "request-reorder-1" },
      body,
      query: { userId: "forged-user" },
    };
    const res = createMockRes();

    await handler(req, res as any);

    expect(reorderDraftRankingMock).toHaveBeenCalledWith("user-1", body);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      data: expect.objectContaining({
        resultingRank: 12,
        resultingVersion: 5,
      }),
      requestId: "request-reorder-1",
    });
  });

  it("rejects incomplete action payloads before database access", async () => {
    const req: any = {
      method: "POST",
      headers: {},
      body: { ...body, targetRank: undefined },
    };
    const res = createMockRes();

    await handler(req, res as any);

    expect(res.statusCode).toBe(400);
    expect(reorderDraftRankingMock).not.toHaveBeenCalled();
  });

  it("returns stable 409 conflict details", async () => {
    reorderDraftRankingMock.mockRejectedValue(
      new DraftRankerApiError(
        409,
        "stale_ranking_version",
        "The ranking changed. Reload before retrying.",
        { expectedVersion: 4, currentVersion: 5 },
      ),
    );
    const req: any = { method: "POST", headers: {}, body };
    const res = createMockRes();

    await handler(req, res as any);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      error: expect.objectContaining({
        code: "stale_ranking_version",
        details: { expectedVersion: 4, currentVersion: 5 },
      }),
    });
  });

  it("stays unavailable while the server flag is off", async () => {
    delete process.env.DRAFT_RANKER_ENABLED;
    const req: any = { method: "POST", headers: {}, body };
    const res = createMockRes();

    await handler(req, res as any);

    expect(res.statusCode).toBe(503);
    expect(requireApiUserMock).not.toHaveBeenCalled();
  });
});
