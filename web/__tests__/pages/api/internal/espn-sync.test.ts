import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextApiResponse } from "next";

const runEspnScheduledSync = vi.hoisted(() => vi.fn());
const auditInsert = vi.hoisted(() => vi.fn());

vi.mock("lib/integrations/espn/server", () => ({
  runEspnScheduledSync,
}));
vi.mock("lib/supabase/server", () => ({ default: { from: vi.fn((table: string) => {
  if (table !== "cron_job_audit") throw new Error(`Unexpected synthetic table: ${table}`);
  return { insert: auditInsert };
}) } }));

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
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden in provider cron audit test"); }));
    auditInsert.mockResolvedValue({ error: null });
    runEspnScheduledSync.mockResolvedValue({
      processed: 2,
      changed: 1,
      failed: 0,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("requires the Vercel Cron bearer secret", async () => {
    const unauthorized = response();
    await handler({ method: "GET", headers: {} } as never, unauthorized);
    expect(unauthorized.statusCode).toBe(401);
    expect(runEspnScheduledSync).not.toHaveBeenCalled();
    expect(auditInsert).not.toHaveBeenCalled();

    const authorized = response();
    await handler(
      {
        method: "GET",
        headers: { authorization: "Bearer cron-secret" },
      } as never,
      authorized,
    );
    expect(authorized.statusCode).toBe(200);
    expect(authorized.body).toEqual({ processed: 2, changed: 1, failed: 0, success: true });
    expect(runEspnScheduledSync).toHaveBeenCalledWith({});
    expect(auditInsert).toHaveBeenCalledTimes(1);
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({ status: "success", rows_affected: null }));
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
    expect(auditInsert).not.toHaveBeenCalled();
  });

  it.each(["Bearer", "Bearer wrong-secret", "Basic cron-secret", "Bearer cron-secret "])("rejects %s before auditing or dispatch", async (authorization) => {
    const res = response();
    await handler({ method: "GET", headers: { authorization } } as never, res);
    expect(res.statusCode).toBe(401);
    expect(runEspnScheduledSync).not.toHaveBeenCalled();
    expect(auditInsert).not.toHaveBeenCalled();
  });

  it.each([
    { name: "disabled", result: { processed: 0, changed: 0, failed: 0, disabled: true }, success: true },
    { name: "empty", result: { processed: 0, changed: 0, failed: 0 }, success: true },
    { name: "aggregate failure", result: { processed: 2, changed: 1, failed: 1 }, success: false },
  ])("records one honest audit for an admitted $name result", async ({ result, success }) => {
    runEspnScheduledSync.mockResolvedValue(result);
    const res = response();
    await handler({ method: "GET", url: "/api/internal/espn-sync", headers: { authorization: "Bearer cron-secret" } } as never, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ...result, success });
    expect(runEspnScheduledSync).toHaveBeenCalledExactlyOnceWith({});
    expect(auditInsert).toHaveBeenCalledTimes(1);
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      job_name: "/api/internal/espn-sync", status: success ? "success" : "failure", rows_affected: null,
      details: expect.objectContaining({ statusCode: 200, rowsUpserted: null, failedRows: null, responseOutcome: { success } }),
    }));
    expect(JSON.parse(auditInsert.mock.calls[0][0].details.response)).toEqual({ ...result, success });
    expect(JSON.stringify(auditInsert.mock.calls[0][0])).not.toContain("cron-secret");
  });

  it("keeps a thrown provider failure fixed and audits it once", async () => {
    runEspnScheduledSync.mockRejectedValue(new Error("private provider credential detail"));
    const res = response();
    await handler({ method: "GET", headers: { authorization: "Bearer cron-secret" } } as never, res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "ESPN sync failed." });
    expect(auditInsert).toHaveBeenCalledTimes(1);
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({ status: "failure", rows_affected: null,
      details: expect.objectContaining({ statusCode: 500, rowsUpserted: null, failedRows: null }),
    }));
    expect(JSON.stringify(auditInsert.mock.calls[0][0])).not.toContain("private provider credential detail");
  });
});
