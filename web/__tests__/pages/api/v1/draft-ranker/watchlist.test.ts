import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  applyDraftPlayerActionMock,
  loadDraftPlayerActionsMock,
  requireApiUserMock,
} = vi.hoisted(() => ({
  applyDraftPlayerActionMock: vi.fn(),
  loadDraftPlayerActionsMock: vi.fn(),
  requireApiUserMock: vi.fn(),
}));

vi.mock("lib/api/requireApiUser", () => ({
  requireApiUser: requireApiUserMock,
}));
vi.mock("lib/draft-ranker/server", () => ({
  applyDraftPlayerAction: applyDraftPlayerActionMock,
  loadDraftPlayerActions: loadDraftPlayerActionsMock,
}));

import handler from "../../../../../pages/api/v1/draft-ranker/watchlist";

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

describe("/api/v1/draft-ranker/watchlist", () => {
  const previousFlag = process.env.DRAFT_RANKER_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DRAFT_RANKER_ENABLED = "true";
    process.env.DRAFT_RANKER_ROLLOUT_STAGE = "authenticated";
    requireApiUserMock.mockResolvedValue({ id: "owner-1" });
    loadDraftPlayerActionsMock.mockResolvedValue({
      watchlist: [],
      preferences: [],
    });
    applyDraftPlayerActionMock.mockResolvedValue({ status: "completed" });
  });

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.DRAFT_RANKER_ENABLED;
    else process.env.DRAFT_RANKER_ENABLED = previousFlag;
    delete process.env.DRAFT_RANKER_ROLLOUT_STAGE;
  });

  it("owner-scopes the current watchlist and preferences", async () => {
    const res = response();
    await handler(
      {
        method: "GET",
        headers: {},
        query: {
          rankingId: "11111111-1111-4111-8111-111111111111",
          userId: "forged-owner",
        },
      } as any,
      res as any,
    );

    expect(loadDraftPlayerActionsMock).toHaveBeenCalledWith(
      "owner-1",
      "11111111-1111-4111-8111-111111111111",
    );
    expect(res.statusCode).toBe(200);
  });

  it("validates and applies a real player action for the session owner", async () => {
    const body = {
      rankingId: "11111111-1111-4111-8111-111111111111",
      playerId: 9320,
      action: "watch",
      operationId: "22222222-2222-4222-8222-222222222222",
    };
    const res = response();
    await handler(
      { method: "POST", headers: {}, query: {}, body } as any,
      res as any,
    );

    expect(applyDraftPlayerActionMock).toHaveBeenCalledWith("owner-1", {
      ...body,
      sourceContext: "search",
    });
    expect(res.statusCode).toBe(200);
  });

  it("rejects forged fields, invalid actions, and unsupported methods", async () => {
    const badRes = response();
    await handler(
      {
        method: "POST",
        headers: {},
        query: {},
        body: {
          rankingId: "11111111-1111-4111-8111-111111111111",
          playerId: 9320,
          action: "invent_player",
          operationId: "22222222-2222-4222-8222-222222222222",
          userId: "forged-owner",
        },
      } as any,
      badRes as any,
    );
    expect(badRes.statusCode).toBe(400);

    const methodRes = response();
    await handler(
      { method: "DELETE", headers: {}, query: {} } as any,
      methodRes as any,
    );
    expect(methodRes.statusCode).toBe(405);
    expect(methodRes.headers.Allow).toBe("GET, POST");
  });
});
