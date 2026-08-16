import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextApiResponse } from "next";

const runEspnScheduledSync = vi.hoisted(() => vi.fn());

vi.mock("lib/integrations/espn/server", () => ({
  runEspnScheduledSync,
}));

import handler from "../../../../pages/api/internal/espn-sync";

type TestResponse = NextApiResponse & {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
};

function response(): TestResponse {
  const result = {
    statusCode: 200,
    body: null as unknown,
    headers: {} as Record<string, string>,
  } as unknown as TestResponse;
  result.status = ((code: number) => {
    result.statusCode = code;
    return result;
  }) as TestResponse["status"];
  result.setHeader = ((name: string, value: string) => {
    result.headers[name] = value;
  }) as TestResponse["setHeader"];
  result.json = ((body: unknown) => {
    result.body = body;
    return result;
  }) as TestResponse["json"];
  return result;
}

describe("internal ESPN sync dispatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "cron-secret");
    runEspnScheduledSync.mockResolvedValue({
      processed: 2,
      changed: 1,
      failed: 0,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires the Vercel Cron bearer secret", async () => {
    const unauthorized = response();
    await handler({ method: "GET", headers: {} } as never, unauthorized);
    expect(unauthorized.statusCode).toBe(401);
    expect(runEspnScheduledSync).not.toHaveBeenCalled();

    const authorized = response();
    await handler(
      {
        method: "GET",
        headers: { authorization: "Bearer cron-secret" },
      } as never,
      authorized,
    );
    expect(authorized.statusCode).toBe(200);
    expect(authorized.body).toEqual({ processed: 2, changed: 1, failed: 0 });
    expect(runEspnScheduledSync).toHaveBeenCalledWith({});
  });

  it("fails closed when CRON_SECRET is absent and rejects unsupported methods", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const missing = response();
    await handler({ method: "GET", headers: {} } as never, missing);
    expect(missing.statusCode).toBe(503);

    const method = response();
    await handler({ method: "POST", headers: {} } as never, method);
    expect(method.statusCode).toBe(405);
    expect(method.headers.Allow).toBe("GET");
    expect(runEspnScheduledSync).not.toHaveBeenCalled();
  });
});
