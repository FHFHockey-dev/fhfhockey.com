import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { loadMock, setMock, requireApiUserMock } = vi.hoisted(() => ({
  loadMock: vi.fn(),
  setMock: vi.fn(),
  requireApiUserMock: vi.fn(),
}));

vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: requireApiUserMock }));
vi.mock("lib/draft-ranker/server", () => ({
  loadDraftContributionPreference: loadMock,
  setDraftContributionPreference: setMock,
}));

import handler from "../../../../../../pages/api/v1/draft-ranker/pairwise/consent";

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

describe("/api/v1/draft-ranker/pairwise/consent", () => {
  const oldRanker = process.env.DRAFT_RANKER_ENABLED;
  const oldHomepage = process.env.DRAFT_RANKER_HOMEPAGE_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DRAFT_RANKER_ENABLED = "true";
    process.env.DRAFT_RANKER_HOMEPAGE_ENABLED = "true";
    requireApiUserMock.mockResolvedValue({ id: "owner-1" });
    loadMock.mockResolvedValue({ contributionEnabled: false });
    setMock.mockResolvedValue({ contributionEnabled: true });
  });

  afterEach(() => {
    oldRanker === undefined ? delete process.env.DRAFT_RANKER_ENABLED : process.env.DRAFT_RANKER_ENABLED = oldRanker;
    oldHomepage === undefined ? delete process.env.DRAFT_RANKER_HOMEPAGE_ENABLED : process.env.DRAFT_RANKER_HOMEPAGE_ENABLED = oldHomepage;
  });

  it("loads only the authenticated owner's preference", async () => {
    const res = response();
    await handler({ method: "GET", headers: {}, query: { userId: "forged" } } as any, res as any);
    expect(loadMock).toHaveBeenCalledWith("owner-1");
    expect(res.statusCode).toBe(200);
  });

  it("accepts only explicit boolean consent with an operation ID", async () => {
    const body = {
      contributionEnabled: true,
      operationId: "11111111-1111-4111-8111-111111111111",
    };
    const res = response();
    await handler({ method: "POST", headers: {}, query: {}, body } as any, res as any);
    expect(setMock).toHaveBeenCalledWith("owner-1", body);

    const forged = response();
    await handler({ method: "POST", headers: {}, query: {}, body: { ...body, policyVersion: "forged" } } as any, forged as any);
    expect(forged.statusCode).toBe(400);
  });

  it("stays unavailable unless both ranker flags are enabled", async () => {
    process.env.DRAFT_RANKER_HOMEPAGE_ENABLED = "false";
    const res = response();
    await handler({ method: "GET", headers: {}, query: {} } as any, res as any);
    expect(res.statusCode).toBe(503);
    expect(loadMock).not.toHaveBeenCalled();
  });
});
