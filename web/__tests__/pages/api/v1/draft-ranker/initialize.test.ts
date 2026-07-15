import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireApiUserMock, initializeDraftRankingMock } = vi.hoisted(() => ({
  requireApiUserMock: vi.fn(),
  initializeDraftRankingMock: vi.fn(),
}));

vi.mock("lib/api/requireApiUser", () => ({
  requireApiUser: requireApiUserMock,
}));
vi.mock("lib/draft-ranker/server", () => ({
  initializeDraftRanking: initializeDraftRankingMock,
}));

import handler from "../../../../../pages/api/v1/draft-ranker/initialize";

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

describe("POST /api/v1/draft-ranker/initialize", () => {
  const previousFlag = process.env.DRAFT_RANKER_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DRAFT_RANKER_ENABLED = "true";
    process.env.DRAFT_RANKER_ROLLOUT_STAGE = "authenticated";
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
    initializeDraftRankingMock.mockResolvedValue({
      status: "completed",
      rankingId: "ranking-1",
      seededCount: 313,
      top250Count: 250,
      candidateCount: 63,
      idempotentReplay: false,
    });
  });

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.DRAFT_RANKER_ENABLED;
    else process.env.DRAFT_RANKER_ENABLED = previousFlag;
    delete process.env.DRAFT_RANKER_ROLLOUT_STAGE;
  });

  it("initializes for the authenticated user and ignores forged ownership", async () => {
    const req: any = {
      method: "POST",
      headers: { "x-request-id": "request-seed-1" },
      body: {
        operationId: "019f5a20-0000-7000-8000-000000000001",
        scoringProfile: { goals: 3 },
      },
      query: { userId: "forged-user" },
    };
    const res = createMockRes();

    await handler(req, res as any);

    expect(initializeDraftRankingMock).toHaveBeenCalledWith("user-1", {
      operationId: "019f5a20-0000-7000-8000-000000000001",
      scoringProfile: { goals: 3 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      data: expect.objectContaining({
        seededCount: 313,
        top250Count: 250,
        candidateCount: 63,
      }),
      requestId: "request-seed-1",
    });
  });

  it("returns 200 for a successful idempotent replay", async () => {
    initializeDraftRankingMock.mockResolvedValue({
      status: "completed",
      rankingId: "ranking-1",
      seededCount: 313,
      idempotentReplay: true,
    });
    const req: any = {
      method: "POST",
      headers: {},
      body: {
        operationId: "019f5a20-0000-7000-8000-000000000001",
      },
    };
    const res = createMockRes();

    await handler(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(initializeDraftRankingMock).toHaveBeenCalledWith("user-1", {
      operationId: "019f5a20-0000-7000-8000-000000000001",
      scoringProfile: {},
    });
  });

  it("rejects malformed or owner-bearing payloads before the RPC", async () => {
    const req: any = {
      method: "POST",
      headers: { "x-request-id": "request-seed-invalid" },
      body: { operationId: "bad-id", userId: "forged-user" },
    };
    const res = createMockRes();

    await handler(req, res as any);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: expect.objectContaining({
        code: "validation_error",
        requestId: "request-seed-invalid",
      }),
    });
    expect(initializeDraftRankingMock).not.toHaveBeenCalled();
  });

  it("keeps the endpoint disabled by default", async () => {
    delete process.env.DRAFT_RANKER_ENABLED;
    const req: any = { method: "POST", headers: {}, body: {} };
    const res = createMockRes();

    await handler(req, res as any);

    expect(res.statusCode).toBe(503);
    expect(requireApiUserMock).not.toHaveBeenCalled();
  });
});
