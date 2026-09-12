import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireApiUser, stopYahooDraftSession } = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  stopYahooDraftSession: vi.fn(),
}));

vi.mock("lib/api/requireApiUser", () => ({ requireApiUser }));
vi.mock("lib/integrations/yahoo/liveDraftServer", () => ({ stopYahooDraftSession }));

import handler from "../../../../../../pages/api/v1/account/yahoo/draft-sessions/[sessionId]/stop";
import { YahooLiveDraftError } from "../../../../../../lib/integrations/yahoo/liveDraft";

function response() {
  return {
    body: null as unknown,
    headers: {} as Record<string, unknown>,
    statusCode: 200,
    json(body: unknown) { this.body = body; return this; },
    setHeader(name: string, value: unknown) { this.headers[name] = value; },
    status(statusCode: number) { this.statusCode = statusCode; return this; },
  } as any;
}

describe("Yahoo live-draft stop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUser.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
    stopYahooDraftSession.mockResolvedValue({ session: { status: "stopped" } });
  });

  it("allows the authenticated owner to stop after access or rollout changes", async () => {
    const res = response();
    await handler({ method: "POST", query: { sessionId: "22222222-2222-4222-8222-222222222222" } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(stopYahooDraftSession).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222");
  });

  it("returns 401 without calling the stop operation when signed out", async () => {
    requireApiUser.mockImplementation(async (_req: unknown, res: any) => {
      res.status(401).json({ error: "Authentication required." });
      return null;
    });
    const res = response();
    await handler({ method: "POST", query: { sessionId: "22222222-2222-4222-8222-222222222222" } } as any, res);
    expect(res.statusCode).toBe(401);
    expect(stopYahooDraftSession).not.toHaveBeenCalled();
  });

  it("returns the server ownership rejection for another owner", async () => {
    stopYahooDraftSession.mockRejectedValue(new YahooLiveDraftError("not found", 404, "yahoo_draft_session_not_found"));
    const res = response();
    await handler({ method: "POST", query: { sessionId: "22222222-2222-4222-8222-222222222222" } } as any, res);
    expect(res.statusCode).toBe(404);
    expect(stopYahooDraftSession).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", expect.any(String));
  });
});
