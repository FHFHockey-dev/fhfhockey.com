import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireApiUserMock, createYahooAuthorizationRequestMock } = vi.hoisted(() => ({
  requireApiUserMock: vi.fn(),
  createYahooAuthorizationRequestMock: vi.fn(),
}));

vi.mock("lib/api/requireApiUser", () => ({
  requireApiUser: requireApiUserMock,
}));

vi.mock("lib/integrations/yahoo/oauth", () => ({
  sanitizeYahooNextPath: (value: string | undefined) => value || "/account?section=connected-accounts",
  createYahooAuthorizationRequest: createYahooAuthorizationRequestMock,
}));

import handler from "../../../../../../pages/api/v1/account/yahoo/connect";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };

  return res;
}

describe("/api/v1/account/yahoo/connect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
    createYahooAuthorizationRequestMock.mockResolvedValue({
      authorizationUrl: "https://yahoo.test/auth",
      browserCookie: "fhfh_yahoo_oauth=binding; HttpOnly",
    });
  });

  it("returns an authorization url for authenticated users", async () => {
    const req: any = {
      method: "POST",
      body: {
        next: "/account?section=connected-accounts",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(createYahooAuthorizationRequestMock).toHaveBeenCalledWith({
      next: "/account?section=connected-accounts",
      userId: "user-1",
    });
    expect(res.headers["Set-Cookie"]).toContain("HttpOnly");
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      authorizationUrl: "https://yahoo.test/auth",
    });
  });
});
