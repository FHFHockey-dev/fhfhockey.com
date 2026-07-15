import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireApiUserMock, searchDraftPlayersMock } = vi.hoisted(() => ({
  requireApiUserMock: vi.fn(),
  searchDraftPlayersMock: vi.fn(),
}));

vi.mock("lib/api/requireApiUser", () => ({
  requireApiUser: requireApiUserMock,
}));
vi.mock("lib/draft-ranker/server", () => ({
  searchDraftPlayers: searchDraftPlayersMock,
}));

import handler from "../../../../../../pages/api/v1/draft-ranker/players/search";

function response() {
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

describe("GET /api/v1/draft-ranker/players/search", () => {
  const previousFlag = process.env.DRAFT_RANKER_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DRAFT_RANKER_ENABLED = "true";
    process.env.DRAFT_RANKER_ROLLOUT_STAGE = "authenticated";
    requireApiUserMock.mockResolvedValue({ id: "authenticated-owner" });
    searchDraftPlayersMock.mockResolvedValue({
      query: "Elias Pettersson",
      includeArchived: false,
      results: [{ playerId: 10, canonicalName: "Elias Pettersson" }],
    });
  });

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.DRAFT_RANKER_ENABLED;
    else process.env.DRAFT_RANKER_ENABLED = previousFlag;
    delete process.env.DRAFT_RANKER_ROLLOUT_STAGE;
  });

  it("authenticates and passes only bounded search inputs", async () => {
    const req: any = {
      method: "GET",
      headers: { "x-request-id": "search-1" },
      query: {
        q: "Elias Pettersson",
        includeArchived: "false",
        limit: "12",
        userId: "forged-owner",
      },
    };
    const res = response();
    await handler(req, res as any);

    expect(searchDraftPlayersMock).toHaveBeenCalledWith({
      query: "Elias Pettersson",
      includeArchived: false,
      limit: 12,
    });
    expect(res.statusCode).toBe(200);
  });

  it("rejects malformed boolean and oversized limit values", async () => {
    for (const query of [
      { q: "McDavid", includeArchived: "sometimes" },
      { q: "McDavid", limit: "1000" },
    ]) {
      const res = response();
      await handler({ method: "GET", headers: {}, query } as any, res as any);
      expect(res.statusCode).toBe(400);
    }
    expect(searchDraftPlayersMock).not.toHaveBeenCalled();
  });

  it("keeps search behind the disabled server flag", async () => {
    delete process.env.DRAFT_RANKER_ENABLED;
    const res = response();
    await handler(
      { method: "GET", headers: {}, query: { q: "McDavid" } } as any,
      res as any,
    );
    expect(res.statusCode).toBe(503);
    expect(requireApiUserMock).not.toHaveBeenCalled();
  });
});
