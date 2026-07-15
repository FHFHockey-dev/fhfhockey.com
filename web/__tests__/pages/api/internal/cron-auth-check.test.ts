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

  it("fails closed when CRON_SECRET is missing, empty, or whitespace-only", () => {
    for (const secret of [undefined, "", "   "]) {
      if (secret === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = secret;
      const res = createMockRes();

      handler(
        {
          headers: {
            authorization:
              secret === undefined ? "Bearer undefined" : `Bearer ${secret}`,
          },
        } as any,
        res,
      );

      expect(res.statusCode).toBe(503);
      expect(res.body).toEqual({
        ok: false,
        error: "CRON_SECRET is not configured",
      });
    }
  });
});
