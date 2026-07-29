import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  buildCommunityMock,
  healthMock,
  normalizeMock,
  persistCommunityMock,
  queueReviewMock,
  buildDiscoveryMock,
} = vi.hoisted(() => ({
  buildCommunityMock: vi.fn(),
  healthMock: vi.fn(),
  normalizeMock: vi.fn(),
  persistCommunityMock: vi.fn(),
  queueReviewMock: vi.fn(),
  buildDiscoveryMock: vi.fn(),
}));

vi.mock("lib/draft-ranker/healthServer", () => ({
  loadDraftRankerHealth: healthMock,
  normalizeDraftRankingOrdering: normalizeMock,
  queueDraftRankerIdentityReview: queueReviewMock,
}));
vi.mock("lib/draft-ranker/communityServer", () => ({
  buildDraftRankerCommunitySnapshot: buildCommunityMock,
  communityCadenceForDate: vi.fn(() => "weekly"),
  communityRefreshIsDue: vi.fn(() => true),
  persistDraftRankerCommunitySnapshot: persistCommunityMock,
}));
vi.mock("lib/draft-ranker/discoveryServer", () => ({
  buildDraftRankerDiscoverySnapshot: buildDiscoveryMock,
  persistDraftRankerDiscoverySnapshot: vi.fn(),
}));

import { draftRankerHealthHandler } from "../../../../../pages/api/v1/db/draft-ranker-health";
import { refreshDraftRankerCommunityHandler } from "../../../../../pages/api/v1/db/refresh-draft-ranker-community";
import { refreshDraftRankerDiscoveryHandler } from "../../../../../pages/api/v1/db/refresh-draft-ranker-discovery";

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
    vi.spyOn(console, "error").mockImplementation(() => undefined);
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

  it.each([
    {
      name: "health",
      run: async (res: ReturnType<typeof response>) => {
        healthMock.mockRejectedValueOnce(
          new Error('relation "private_health_table" does not exist'),
        );
        await draftRankerHealthHandler(
          { method: "GET", headers: {}, query: {}, supabase: {} } as any,
          res as any,
        );
      },
      code: "DRAFT_RANKER_HEALTH_UNAVAILABLE",
    },
    {
      name: "community",
      run: async (res: ReturnType<typeof response>) => {
        buildCommunityMock.mockRejectedValueOnce(
          new Error('relation "private_comparison_table" does not exist'),
        );
        await refreshDraftRankerCommunityHandler(
          {
            method: "GET",
            headers: {},
            query: {},
            body: {},
            supabase: {},
          } as any,
          res as any,
        );
      },
      code: "DRAFT_RANKER_COMMUNITY_REFRESH_UNAVAILABLE",
    },
    {
      name: "discovery",
      run: async (res: ReturnType<typeof response>) => {
        buildDiscoveryMock.mockRejectedValueOnce(
          new Error('relation "private_discovery_table" does not exist'),
        );
        await refreshDraftRankerDiscoveryHandler(
          {
            method: "GET",
            headers: {},
            query: {},
            body: {},
            supabase: {},
          } as any,
          res as any,
        );
      },
      code: "DRAFT_RANKER_DISCOVERY_REFRESH_UNAVAILABLE",
    },
  ])("redacts raw $name dependency failures", async ({ run, code }) => {
    const res = response();
    await run(res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ success: false, code, failedRows: 1 });
    expect(JSON.stringify(res.body)).not.toContain("private_");
  });
});
