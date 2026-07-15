import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requestAdditionMock, requireApiUserMock } = vi.hoisted(() => ({
  requestAdditionMock: vi.fn(),
  requireApiUserMock: vi.fn(),
}));

vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: requireApiUserMock }));
vi.mock("lib/draft-ranker/server", () => ({
  requestDraftPlayerAddition: requestAdditionMock,
}));

import { DraftRankerApiError } from "lib/draft-ranker/api";
import handler from "../../../../../../pages/api/v1/draft-ranker/players/request-addition";

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

describe("POST /api/v1/draft-ranker/players/request-addition", () => {
  const previousFlag = process.env.DRAFT_RANKER_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DRAFT_RANKER_ENABLED = "true";
    requireApiUserMock.mockResolvedValue({ id: "authenticated-owner" });
    requestAdditionMock.mockResolvedValue({
      status: "completed",
      requestId: "request-1",
      requestStatus: "pending",
      created: true,
    });
  });

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.DRAFT_RANKER_ENABLED;
    else process.env.DRAFT_RANKER_ENABLED = previousFlag;
  });

  it("derives request ownership from auth and returns 201 for a new request", async () => {
    const body = {
      rawName: "Real Prospect",
      organization: "Boston College",
      candidatePlayerIds: [10],
    };
    const res = response();
    await handler(
      {
        method: "POST",
        headers: { "x-request-id": "addition-1" },
        body: { ...body, userId: "forged-owner" },
      } as any,
      res as any,
    );

    expect(res.statusCode).toBe(400);
    expect(requestAdditionMock).not.toHaveBeenCalled();

    await handler(
      { method: "POST", headers: {}, body } as any,
      res as any,
    );
    expect(requestAdditionMock).toHaveBeenCalledWith(
      "authenticated-owner",
      expect.objectContaining(body),
    );
    expect(res.statusCode).toBe(201);
  });

  it("returns an owner-safe 429 with Retry-After", async () => {
    requestAdditionMock.mockRejectedValue(
      new DraftRankerApiError(429, "rate_limited", "Five per day.", {
        retryAfterSeconds: 900,
      }),
    );
    const res = response();
    await handler(
      { method: "POST", headers: {}, body: { rawName: "Real Prospect" } } as any,
      res as any,
    );
    expect(res.statusCode).toBe(429);
    expect(res.headers["Retry-After"]).toBe("900");
  });

  it("keeps addition requests behind the disabled server flag", async () => {
    delete process.env.DRAFT_RANKER_ENABLED;
    const res = response();
    await handler(
      { method: "POST", headers: {}, body: { rawName: "Real Prospect" } } as any,
      res as any,
    );
    expect(res.statusCode).toBe(503);
    expect(requireApiUserMock).not.toHaveBeenCalled();
  });
});
