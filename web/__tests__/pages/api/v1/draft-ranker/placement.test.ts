import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { loadDraftPlacementMock, mutateDraftPlacementMock, requireApiUserMock } =
  vi.hoisted(() => ({
    loadDraftPlacementMock: vi.fn(),
    mutateDraftPlacementMock: vi.fn(),
    requireApiUserMock: vi.fn(),
  }));

vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: requireApiUserMock }));
vi.mock("lib/draft-ranker/server", () => ({
  loadDraftPlacement: loadDraftPlacementMock,
  mutateDraftPlacement: mutateDraftPlacementMock,
}));

import handler from "../../../../../pages/api/v1/draft-ranker/placement";

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

describe("/api/v1/draft-ranker/placement", () => {
  const previousFlag = process.env.DRAFT_RANKER_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DRAFT_RANKER_ENABLED = "true";
    requireApiUserMock.mockResolvedValue({ id: "owner-1" });
    loadDraftPlacementMock.mockResolvedValue({ session: null });
    mutateDraftPlacementMock.mockResolvedValue({ session: { id: "session-1" } });
  });

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.DRAFT_RANKER_ENABLED;
    else process.env.DRAFT_RANKER_ENABLED = previousFlag;
  });

  it("owner-scopes active placement resume", async () => {
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
    expect(loadDraftPlacementMock).toHaveBeenCalledWith("owner-1", {
      rankingId: "11111111-1111-4111-8111-111111111111",
      sessionId: undefined,
    });
    expect(res.statusCode).toBe(200);
  });

  it("accepts only the deterministic placement action contract", async () => {
    const body = {
      action: "answer",
      sessionId: "11111111-1111-4111-8111-111111111111",
      outcome: "target_over_anchor",
      operationId: "22222222-2222-4222-8222-222222222222",
    };
    const res = response();
    await handler(
      { method: "POST", headers: {}, query: {}, body } as any,
      res as any,
    );
    expect(mutateDraftPlacementMock).toHaveBeenCalledWith("owner-1", body);
    expect(res.statusCode).toBe(200);

    const forgedRes = response();
    await handler(
      {
        method: "POST",
        headers: {},
        query: {},
        body: { ...body, intervalLow: 1, userId: "forged-owner" },
      } as any,
      forgedRes as any,
    );
    expect(forgedRes.statusCode).toBe(400);
  });

  it("rejects unsupported methods and disabled requests", async () => {
    const methodRes = response();
    await handler(
      { method: "DELETE", headers: {}, query: {} } as any,
      methodRes as any,
    );
    expect(methodRes.statusCode).toBe(405);
    expect(methodRes.headers.Allow).toBe("GET, POST");

    process.env.DRAFT_RANKER_ENABLED = "false";
    const disabledRes = response();
    await handler(
      {
        method: "GET",
        headers: {},
        query: { sessionId: "11111111-1111-4111-8111-111111111111" },
      } as any,
      disabledRes as any,
    );
    expect(disabledRes.statusCode).toBe(503);
  });
});
