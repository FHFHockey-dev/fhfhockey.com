import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireApiUserMock, loadDiscoveryMock } = vi.hoisted(() => ({
  requireApiUserMock: vi.fn(),
  loadDiscoveryMock: vi.fn(),
}));

vi.mock("lib/api/requireApiUser", () => ({
  requireApiUser: requireApiUserMock,
}));
vi.mock("lib/draft-ranker/discoveryReadServer", () => ({
  loadDraftRankerDiscovery: loadDiscoveryMock,
}));

import handler from "../../../../../pages/api/v1/draft-ranker/discovery";

function response() {
  return {
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    json(value: unknown) {
      this.body = value;
      return this;
    },
  };
}

describe("GET /api/v1/draft-ranker/discovery", () => {
  const priorRankerFlag = process.env.DRAFT_RANKER_ENABLED;
  const priorDiscoveryFlag = process.env.DRAFT_RANKER_DISCOVERY_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DRAFT_RANKER_ENABLED = "true";
    process.env.DRAFT_RANKER_ROLLOUT_STAGE = "authenticated";
    process.env.DRAFT_RANKER_DISCOVERY_ENABLED = "true";
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
    loadDiscoveryMock.mockResolvedValue({
      rankingId: "00000000-0000-4000-8000-000000000001",
      status: "empty",
      message: "No current signal.",
      cards: [],
    });
  });

  afterEach(() => {
    if (priorRankerFlag === undefined) delete process.env.DRAFT_RANKER_ENABLED;
    else process.env.DRAFT_RANKER_ENABLED = priorRankerFlag;
    delete process.env.DRAFT_RANKER_ROLLOUT_STAGE;
    if (priorDiscoveryFlag === undefined) {
      delete process.env.DRAFT_RANKER_DISCOVERY_ENABLED;
    } else {
      process.env.DRAFT_RANKER_DISCOVERY_ENABLED = priorDiscoveryFlag;
    }
  });

  it("fails closed before authentication when discovery is disabled", async () => {
    delete process.env.DRAFT_RANKER_DISCOVERY_ENABLED;
    const res = response();
    await handler({ method: "GET", headers: {}, query: {} } as any, res as any);
    expect(res.statusCode).toBe(503);
    expect(res.body.error.code).toBe("draft_ranker_disabled");
    expect(requireApiUserMock).not.toHaveBeenCalled();
  });

  it("derives ownership exclusively from the authenticated user", async () => {
    const rankingId = "00000000-0000-4000-8000-000000000001";
    const res = response();
    await handler(
      {
        method: "GET",
        headers: { "x-request-id": "discovery-owner-1" },
        query: { rankingId, userId: "forged-user", limit: "8" },
      } as any,
      res as any,
    );
    expect(loadDiscoveryMock).toHaveBeenCalledWith("user-1", {
      rankingId,
      limit: 8,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      data: expect.objectContaining({ status: "empty", cards: [] }),
      requestId: "discovery-owner-1",
    });
  });

  it("rejects invalid ranking IDs before reading private context", async () => {
    const res = response();
    await handler(
      { method: "GET", headers: {}, query: { rankingId: "not-a-uuid" } } as any,
      res as any,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
    expect(loadDiscoveryMock).not.toHaveBeenCalled();
  });
});
