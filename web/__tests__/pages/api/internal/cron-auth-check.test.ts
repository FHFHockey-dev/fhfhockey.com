import { afterEach, describe, expect, it } from "vitest";

import handler from "../../../../pages/api/internal/cron-auth-check";

function createMockRes() {
  return {
    statusCode: 200,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  } as any;
}

describe("/api/internal/cron-auth-check", () => {
  const originalSecret = process.env.CRON_SECRET;

  afterEach(() => {
    if (originalSecret == null) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it("accepts the configured bearer token without running a cron workload", () => {
    process.env.CRON_SECRET = "current-secret";
    const res = createMockRes();

    handler(
      {
        headers: { authorization: "Bearer current-secret" },
      } as any,
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("rejects missing and stale bearer tokens", () => {
    process.env.CRON_SECRET = "current-secret";

    for (const authorization of [undefined, "Bearer previous-secret"]) {
      const res = createMockRes();
      handler({ headers: { authorization } } as any, res);
      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({ ok: false, error: "Unauthorized" });
    }
  });

  it("fails closed when CRON_SECRET is not configured", () => {
    delete process.env.CRON_SECRET;
    const res = createMockRes();

    handler({ headers: {} } as any, res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({
      ok: false,
      error: "CRON_SECRET is not configured",
    });
  });
});
