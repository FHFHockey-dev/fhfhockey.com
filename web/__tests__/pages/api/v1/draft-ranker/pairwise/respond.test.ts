import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { submitMock, requireApiUserMock } = vi.hoisted(() => ({
  submitMock: vi.fn(),
  requireApiUserMock: vi.fn(),
}));

vi.mock("lib/api/requireApiUser", () => ({
  requireApiUser: requireApiUserMock,
}));
vi.mock("lib/draft-ranker/server", () => ({
  submitDraftPairComparison: submitMock,
}));

import handler from "../../../../../../pages/api/v1/draft-ranker/pairwise/respond";

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
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

describe("/api/v1/draft-ranker/pairwise/respond", () => {
  const oldRanker = process.env.DRAFT_RANKER_ENABLED;
  const oldHomepage = process.env.DRAFT_RANKER_HOMEPAGE_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DRAFT_RANKER_ENABLED = "true";
    process.env.DRAFT_RANKER_ROLLOUT_STAGE = "authenticated";
    process.env.DRAFT_RANKER_HOMEPAGE_ENABLED = "true";
    requireApiUserMock.mockResolvedValue({ id: "owner-1" });
    submitMock.mockResolvedValue({ status: "completed" });
  });

  afterEach(() => {
    oldRanker === undefined
      ? delete process.env.DRAFT_RANKER_ENABLED
      : (process.env.DRAFT_RANKER_ENABLED = oldRanker);
    delete process.env.DRAFT_RANKER_ROLLOUT_STAGE;
    oldHomepage === undefined
      ? delete process.env.DRAFT_RANKER_HOMEPAGE_ENABLED
      : (process.env.DRAFT_RANKER_HOMEPAGE_ENABLED = oldHomepage);
  });

  it("submits only the bounded outcome contract for the authenticated owner", async () => {
    const body = {
      promptId: "11111111-1111-4111-8111-111111111111",
      outcome: "too_close",
      expectedVersion: 4,
      operationId: "22222222-2222-4222-8222-222222222222",
    };
    const res = response();
    await handler(
      { method: "POST", headers: {}, query: { userId: "forged" }, body } as any,
      res as any,
    );
    expect(submitMock).toHaveBeenCalledWith("owner-1", body);
    expect(res.statusCode).toBe(200);

    const forged = response();
    await handler(
      {
        method: "POST",
        headers: {},
        query: {},
        body: { ...body, preferredPlayerId: 99 },
      } as any,
      forged as any,
    );
    expect(forged.statusCode).toBe(400);
  });

  it("rejects arbitrary outcomes and unsupported methods", async () => {
    const bad = response();
    await handler(
      {
        method: "POST",
        headers: {},
        query: {},
        body: {
          promptId: "11111111-1111-4111-8111-111111111111",
          outcome: "player_a",
          expectedVersion: 0,
          operationId: "22222222-2222-4222-8222-222222222222",
        },
      } as any,
      bad as any,
    );
    expect(bad.statusCode).toBe(400);

    const method = response();
    await handler(
      { method: "GET", headers: {}, query: {} } as any,
      method as any,
    );
    expect(method.statusCode).toBe(405);
  });
});
