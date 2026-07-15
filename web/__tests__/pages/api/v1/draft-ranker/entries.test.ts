import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { loadDraftRankingEntriesMock, requireApiUserMock } = vi.hoisted(() => ({
  loadDraftRankingEntriesMock: vi.fn(),
  requireApiUserMock: vi.fn(),
}));

vi.mock("lib/api/requireApiUser", () => ({
  requireApiUser: requireApiUserMock,
}));
vi.mock("lib/draft-ranker/server", () => ({
  loadDraftRankingEntries: loadDraftRankingEntriesMock,
}));

import handler from "../../../../../pages/api/v1/draft-ranker/entries";

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

describe("GET /api/v1/draft-ranker/entries", () => {
  const previousFlag = process.env.DRAFT_RANKER_ENABLED;
  const rankingId = "019f5a30-0000-7000-8000-000000000002";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DRAFT_RANKER_ENABLED = "true";
    process.env.DRAFT_RANKER_ROLLOUT_STAGE = "authenticated";
    requireApiUserMock.mockResolvedValue({ id: "authenticated-owner" });
    loadDraftRankingEntriesMock.mockResolvedValue({
      ranking: { id: rankingId, lockVersion: 4 },
      entries: [{ playerId: 10, rank: 1 }],
    });
  });

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.DRAFT_RANKER_ENABLED;
    else process.env.DRAFT_RANKER_ENABLED = previousFlag;
    delete process.env.DRAFT_RANKER_ROLLOUT_STAGE;
  });

  it("ignores forged ownership input and reads for the authenticated account", async () => {
    const req: any = {
      method: "GET",
      headers: { "x-request-id": "entries-1" },
      query: { rankingId, userId: "forged-user" },
    };
    const res = createMockRes();

    await handler(req, res as any);

    expect(loadDraftRankingEntriesMock).toHaveBeenCalledWith(
      "authenticated-owner",
      rankingId,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      data: expect.objectContaining({ entries: [{ playerId: 10, rank: 1 }] }),
      requestId: "entries-1",
    });
  });

  it("rejects malformed ranking IDs before querying", async () => {
    const req: any = {
      method: "GET",
      headers: {},
      query: { rankingId: "nope" },
    };
    const res = createMockRes();

    await handler(req, res as any);

    expect(res.statusCode).toBe(400);
    expect(loadDraftRankingEntriesMock).not.toHaveBeenCalled();
  });

  it("remains unavailable while the server flag is off", async () => {
    delete process.env.DRAFT_RANKER_ENABLED;
    const req: any = { method: "GET", headers: {}, query: { rankingId } };
    const res = createMockRes();

    await handler(req, res as any);

    expect(res.statusCode).toBe(503);
    expect(requireApiUserMock).not.toHaveBeenCalled();
  });
});
