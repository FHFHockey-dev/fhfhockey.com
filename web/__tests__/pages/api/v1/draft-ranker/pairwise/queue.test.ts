import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { issueMock, requireApiUserMock } = vi.hoisted(() => ({
  issueMock: vi.fn(),
  requireApiUserMock: vi.fn(),
}));

vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: requireApiUserMock }));
vi.mock("lib/draft-ranker/server", () => ({ issueNextDraftPairPrompt: issueMock }));

import handler from "../../../../../../pages/api/v1/draft-ranker/pairwise/queue";

function response() {
  return {
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, string>,
    status(code: number) { this.statusCode = code; return this; },
    setHeader(name: string, value: string) { this.headers[name] = value; },
    json(payload: unknown) { this.body = payload; return this; },
  };
}

describe("/api/v1/draft-ranker/pairwise/queue", () => {
  const oldRanker = process.env.DRAFT_RANKER_ENABLED;
  const oldHomepage = process.env.DRAFT_RANKER_HOMEPAGE_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DRAFT_RANKER_ENABLED = "true";
    process.env.DRAFT_RANKER_HOMEPAGE_ENABLED = "true";
    requireApiUserMock.mockResolvedValue({ id: "owner-1" });
    issueMock.mockResolvedValue({ prompt: { promptId: "prompt-1" } });
  });

  afterEach(() => {
    if (oldRanker === undefined) delete process.env.DRAFT_RANKER_ENABLED;
    else process.env.DRAFT_RANKER_ENABLED = oldRanker;
    if (oldHomepage === undefined) delete process.env.DRAFT_RANKER_HOMEPAGE_ENABLED;
    else process.env.DRAFT_RANKER_HOMEPAGE_ENABLED = oldHomepage;
  });

  it("lets the server select a matchup for the authenticated owner", async () => {
    const body = {
      rankingId: "11111111-1111-4111-8111-111111111111",
      mode: "quick_five",
      expectedVersion: 4,
      operationId: "22222222-2222-4222-8222-222222222222",
    };
    const res = response();
    await handler(
      { method: "POST", headers: {}, query: { userId: "forged" }, body } as any,
      res as any,
    );
    expect(issueMock).toHaveBeenCalledWith("owner-1", body);
    expect(res.statusCode).toBe(200);
  });

  it("rejects client-selected players and unknown queue modes", async () => {
    const common = {
      rankingId: "11111111-1111-4111-8111-111111111111",
      expectedVersion: 4,
      operationId: "22222222-2222-4222-8222-222222222222",
    };
    const selected = response();
    await handler(
      { method: "POST", headers: {}, query: {}, body: { ...common, playerAId: 1 } } as any,
      selected as any,
    );
    expect(selected.statusCode).toBe(400);

    const mode = response();
    await handler(
      { method: "POST", headers: {}, query: {}, body: { ...common, mode: "random" } } as any,
      mode as any,
    );
    expect(mode.statusCode).toBe(400);
  });

  it("fails closed unless both server flags are enabled", async () => {
    delete process.env.DRAFT_RANKER_HOMEPAGE_ENABLED;
    const res = response();
    await handler({ method: "POST", headers: {}, query: {}, body: {} } as any, res as any);
    expect(res.statusCode).toBe(503);
    expect(requireApiUserMock).not.toHaveBeenCalled();
  });
});
