import { beforeEach, describe, expect, it, vi } from "vitest";

const runFantraxScheduledSync = vi.hoisted(() => vi.fn());

vi.mock("lib/integrations/fantrax/server", () => ({
  runFantraxScheduledSync,
}));

import handler from "../../../../pages/api/internal/fantrax-sync";

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
    json(body: any) {
      this.body = body;
      return this;
    },
  } as any;
}

describe("internal Fantrax sync dispatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "cron-secret");
    runFantraxScheduledSync.mockResolvedValue({
      processed: 2,
      changed: 1,
      failed: 0,
    });
  });

  it("requires the Vercel Cron bearer secret", async () => {
    const unauthorized = response();
    await handler({ method: "GET", headers: {} } as any, unauthorized);
    expect(unauthorized.statusCode).toBe(401);
    expect(runFantraxScheduledSync).not.toHaveBeenCalled();

    const authorized = response();
    await handler(
      {
        method: "GET",
        headers: { authorization: "Bearer cron-secret" },
      } as any,
      authorized,
    );
    expect(authorized.statusCode).toBe(200);
    expect(authorized.body).toEqual({ processed: 2, changed: 1, failed: 0 });
    expect(runFantraxScheduledSync).toHaveBeenCalledOnce();
  });

  it("fails closed when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = response();
    await handler({ method: "GET", headers: {} } as any, res);
    expect(res.statusCode).toBe(503);
  });
});
