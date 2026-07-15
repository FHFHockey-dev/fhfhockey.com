import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireApiUserMock, loadDraftRankerBootstrapMock } = vi.hoisted(() => ({
  requireApiUserMock: vi.fn(),
  loadDraftRankerBootstrapMock: vi.fn(),
}));

vi.mock("lib/api/requireApiUser", () => ({
  requireApiUser: requireApiUserMock,
}));

vi.mock("lib/draft-ranker/server", () => ({
  loadDraftRankerBootstrap: loadDraftRankerBootstrapMock,
}));

import { DraftRankerApiError } from "lib/draft-ranker/api";
import handler from "../../../../../pages/api/v1/draft-ranker";

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

describe("GET /api/v1/draft-ranker", () => {
  const previousFlag = process.env.DRAFT_RANKER_ENABLED;
  const previousHomepageFlag = process.env.DRAFT_RANKER_HOMEPAGE_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DRAFT_RANKER_ENABLED = "true";
    delete process.env.DRAFT_RANKER_HOMEPAGE_ENABLED;
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
    loadDraftRankerBootstrapMock.mockResolvedValue({
      initialized: false,
      targetSeasonId: 20262027,
      ranking: null,
      counts: { entries: 0, watchlist: 0 },
      latestSeedRun: null,
    });
  });

  afterEach(() => {
    if (previousFlag === undefined) {
      delete process.env.DRAFT_RANKER_ENABLED;
    } else {
      process.env.DRAFT_RANKER_ENABLED = previousFlag;
    }
    if (previousHomepageFlag === undefined) {
      delete process.env.DRAFT_RANKER_HOMEPAGE_ENABLED;
    } else {
      process.env.DRAFT_RANKER_HOMEPAGE_ENABLED = previousHomepageFlag;
    }
  });

  it("fails closed before authentication when the server flag is off", async () => {
    delete process.env.DRAFT_RANKER_ENABLED;
    const req: any = { method: "GET", headers: {}, query: {} };
    const res = createMockRes();

    await handler(req, res as any);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({
      error: expect.objectContaining({
        code: "draft_ranker_disabled",
        requestId: expect.any(String),
      }),
    });
    expect(requireApiUserMock).not.toHaveBeenCalled();
  });

  it("returns a stable method error envelope", async () => {
    const req: any = {
      method: "POST",
      headers: { "x-request-id": "request-method-1" },
      query: {},
    };
    const res = createMockRes();

    await handler(req, res as any);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("GET");
    expect(res.body).toEqual({
      error: {
        code: "method_not_allowed",
        message: "Method not allowed.",
        requestId: "request-method-1",
        details: { allowed: ["GET"] },
      },
    });
  });

  it("adapts requireApiUser failures to the ranker 401 envelope", async () => {
    requireApiUserMock.mockImplementation(
      async (_req: unknown, _res: unknown, options: any) => {
        options.onUnauthorized("Authentication required.");
        return null;
      },
    );
    const req: any = {
      method: "GET",
      headers: { "x-request-id": "request-auth-1" },
      query: {},
    };
    const res = createMockRes();

    await handler(req, res as any);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      error: {
        code: "authentication_required",
        message: "Authentication required.",
        requestId: "request-auth-1",
        details: {},
      },
    });
    expect(loadDraftRankerBootstrapMock).not.toHaveBeenCalled();
  });

  it("loads only the authenticated user's bootstrap state", async () => {
    const req: any = {
      method: "GET",
      body: { userId: "forged-user" },
      headers: { "x-request-id": "request-owner-1" },
      query: { userId: "forged-user" },
    };
    const res = createMockRes();

    await handler(req, res as any);

    expect(loadDraftRankerBootstrapMock).toHaveBeenCalledWith("user-1");
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      data: expect.objectContaining({
        initialized: false,
        pairwiseEnabled: false,
        targetSeasonId: 20262027,
      }),
      requestId: "request-owner-1",
    });
  });

  it("preserves stable conflict codes and redacts unexpected failures", async () => {
    const req: any = {
      method: "GET",
      headers: { "x-request-id": "request-conflict-1" },
      query: {},
    };
    const res = createMockRes();
    loadDraftRankerBootstrapMock.mockRejectedValueOnce(
      new DraftRankerApiError(
        409,
        "stale_ranking_version",
        "The ranking changed. Reload before retrying.",
        { expectedVersion: 2, currentVersion: 3 },
      ),
    );

    await handler(req, res as any);
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      error: expect.objectContaining({
        code: "stale_ranking_version",
        details: { expectedVersion: 2, currentVersion: 3 },
      }),
    });

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const unexpectedRes = createMockRes();
    loadDraftRankerBootstrapMock.mockRejectedValueOnce(
      new Error("database-password-should-not-leak"),
    );
    await handler(req, unexpectedRes as any);

    expect(unexpectedRes.statusCode).toBe(500);
    expect(JSON.stringify(unexpectedRes.body)).not.toContain("database-password");
    errorSpy.mockRestore();
  });
});
