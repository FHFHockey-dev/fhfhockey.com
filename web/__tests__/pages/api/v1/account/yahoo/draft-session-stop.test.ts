import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireApiUser, stopYahooDraftSession } = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  stopYahooDraftSession: vi.fn(),
}));

vi.mock("lib/api/requireApiUser", () => ({ requireApiUser }));
vi.mock("lib/integrations/yahoo/liveDraftServer", () => ({ stopYahooDraftSession }));

import handler from "../../../../../../pages/api/v1/account/yahoo/draft-sessions/[sessionId]/stop";

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
});
