import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { loadCommunityMock, getUserMock } = vi.hoisted(() => ({
  loadCommunityMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock("lib/draft-ranker/communityReadServer", () => ({
  loadCommunityDraftRankings: loadCommunityMock,
}));
vi.mock("lib/supabase", () => ({
  createClientWithToken: () => ({ auth: { getUser: getUserMock } }),
}));

import handler from "../../../../../pages/api/v1/draft-ranker/community";

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

describe("GET /api/v1/draft-ranker/community", () => {
  const priorFlag = process.env.COMMUNITY_DRAFT_RANKINGS_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.COMMUNITY_DRAFT_RANKINGS_ENABLED = "true";
    loadCommunityMock.mockResolvedValue({
      status: "market_seeded",
      rows: [],
      emerging: [],
    });
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
  });

  afterEach(() => {
    if (priorFlag === undefined)
      delete process.env.COMMUNITY_DRAFT_RANKINGS_ENABLED;
    else process.env.COMMUNITY_DRAFT_RANKINGS_ENABLED = priorFlag;
  });

  it("fails closed before reading aggregates when the public flag is off", async () => {
    delete process.env.COMMUNITY_DRAFT_RANKINGS_ENABLED;
    const res = response();
    await handler({ method: "GET", headers: {}, query: {} } as any, res as any);
    expect(res.statusCode).toBe(503);
    expect(res.body.error.code).toBe("draft_ranker_disabled");
    expect(loadCommunityMock).not.toHaveBeenCalled();
  });

  it("serves signed-out aggregate results without requiring authentication", async () => {
    const res = response();
    await handler(
      {
        method: "GET",
        headers: { "x-request-id": "community-public" },
        query: { page: "2", limit: "50" },
      } as any,
      res as any,
    );
    expect(loadCommunityMock).toHaveBeenCalledWith({
      userId: null,
      query: { page: 2, limit: 50 },
    });
    expect(getUserMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it("adds only a validated session owner for private personal deltas", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "owner-1" } },
      error: null,
    });
    const res = response();
    await handler(
      {
        method: "GET",
        headers: { authorization: "Bearer valid-token" },
        query: {},
      } as any,
      res as any,
    );
    expect(getUserMock).toHaveBeenCalledWith("valid-token");
    expect(loadCommunityMock).toHaveBeenCalledWith({
      userId: "owner-1",
      query: { page: 1, limit: 50 },
    });
  });

  it("rejects unbounded pagination before querying snapshots", async () => {
    const res = response();
    await handler(
      {
        method: "GET",
        headers: {},
        query: { page: "1", limit: "1000" },
      } as any,
      res as any,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
    expect(loadCommunityMock).not.toHaveBeenCalled();
  });
});
