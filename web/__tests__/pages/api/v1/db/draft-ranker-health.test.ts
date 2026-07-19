import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  buildCommunityMock,
  healthMock,
  normalizeMock,
  persistCommunityMock,
  queueReviewMock,
} = vi.hoisted(() => ({
  buildCommunityMock: vi.fn(),
  healthMock: vi.fn(),
  normalizeMock: vi.fn(),
  persistCommunityMock: vi.fn(),
  queueReviewMock: vi.fn(),
}));

vi.mock("lib/draft-ranker/healthServer", () => ({
  loadDraftRankerHealth: healthMock,
  normalizeDraftRankingOrdering: normalizeMock,
  queueDraftRankerIdentityReview: queueReviewMock,
}));
vi.mock("lib/draft-ranker/communityServer", () => ({
  buildDraftRankerCommunitySnapshot: buildCommunityMock,
  persistDraftRankerCommunitySnapshot: persistCommunityMock,
}));

import { draftRankerHealthHandler } from "../../../../../pages/api/v1/db/draft-ranker-health";

function response() {
  return {
    statusCode: 200,
    body: null as unknown,
    headers: {} as Record<string, unknown>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: unknown) {
      this.headers[name] = value;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

describe("admin Draft Ranker health operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    healthMock.mockResolvedValue({ status: "healthy" });
    normalizeMock.mockResolvedValue({
      status: "completed",
      changedEntryCount: 313,
    });
    queueReviewMock.mockResolvedValue({
      status: "queued",
      idempotentReplay: false,
    });
  });

  it("returns the aggregate health report without mutation", async () => {
    const res = response();
    await draftRankerHealthHandler(
      { method: "GET", headers: {}, query: {}, supabase: {} } as any,
      res as any,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      report: { status: "healthy" },
      rowsAffected: 0,
    });
    expect(normalizeMock).not.toHaveBeenCalled();
  });

  it("requires exact destructive confirmation before normalization", async () => {
    const res = response();
    await draftRankerHealthHandler(
      {
        method: "POST",
        headers: {},
        query: {},
        supabase: {},
        body: {
          action: "normalize_ordering",
          rankingId: "11111111-1111-4111-8111-111111111111",
          expectedVersion: 2,
          operationId: "22222222-2222-4222-8222-222222222222",
          reason: "Repair an exhausted sparse interval.",
          confirmation: "yes",
        },
      } as any,
      res as any,
    );
    expect(res.statusCode).toBe(400);
    expect(normalizeMock).not.toHaveBeenCalled();
  });

  it("runs an audited deterministic normalization with bounded input", async () => {
    const input = {
      action: "normalize_ordering",
      rankingId: "11111111-1111-4111-8111-111111111111",
      expectedVersion: 2,
      operationId: "22222222-2222-4222-8222-222222222222",
      reason: "Repair an exhausted sparse interval.",
      confirmation: "NORMALIZE_ORDERING",
    };
    const res = response();
    await draftRankerHealthHandler(
      {
        method: "POST",
        headers: {},
        query: {},
        supabase: { rpc: vi.fn() },
        body: input,
      } as any,
      res as any,
    );
    expect(normalizeMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining(input),
    );
    expect(res.body).toMatchObject({ success: true, rowsAffected: 313 });
  });

  it("queues identity review without creating or merging a player", async () => {
    const res = response();
    await draftRankerHealthHandler(
      {
        method: "POST",
        headers: {},
        query: {},
        supabase: {},
        body: {
          action: "queue_identity_review",
          playerId: 99,
          operationId: "22222222-2222-4222-8222-222222222222",
          reason: "Archived identity remains on an active board.",
          confirmation: "QUEUE_IDENTITY_REVIEW",
        },
      } as any,
      res as any,
    );
    expect(queueReviewMock).toHaveBeenCalledTimes(1);
    expect(res.body).toMatchObject({ success: true, rowsAffected: 1 });
  });
});
