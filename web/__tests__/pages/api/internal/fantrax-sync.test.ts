import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runFantraxScheduledSync = vi.hoisted(() => vi.fn());
const auditInsert = vi.hoisted(() => vi.fn());

vi.mock("lib/integrations/fantrax/server", () => ({
  runFantraxScheduledSync,
}));
vi.mock("lib/supabase/server", () => ({ default: { from: vi.fn((table: string) => {
  if (table !== "cron_job_audit") throw new Error(`Unexpected synthetic table: ${table}`);
  return { insert: auditInsert };
}) } }));

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
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden in provider cron audit test"); }));
    auditInsert.mockResolvedValue({ error: null });
    runFantraxScheduledSync.mockResolvedValue({
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
    await handler({ method: "GET", headers: {} } as any, unauthorized);
    expect(unauthorized.statusCode).toBe(401);
    expect(runFantraxScheduledSync).not.toHaveBeenCalled();
    expect(auditInsert).not.toHaveBeenCalled();

    const authorized = response();
    await handler(
      {
        method: "GET",
        headers: { authorization: "Bearer cron-secret" },
      } as any,
      authorized,
    );
    expect(authorized.statusCode).toBe(200);
    expect(authorized.body).toEqual({ processed: 2, changed: 1, failed: 0, success: true });
    expect(runFantraxScheduledSync).toHaveBeenCalledOnce();
    expect(auditInsert).toHaveBeenCalledTimes(1);
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({ status: "success", rows_affected: null }));
  });

  it("fails closed when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = response();
    await handler({ method: "GET", headers: {} } as any, res);
    expect(res.statusCode).toBe(503);
    expect(runFantraxScheduledSync).not.toHaveBeenCalled();
    expect(auditInsert).not.toHaveBeenCalled();
    const method = response();
    await handler({ method: "POST", headers: {} } as any, method);
    expect(method.statusCode).toBe(405);
    expect(method.headers.Allow).toBe("GET");
    expect(runFantraxScheduledSync).not.toHaveBeenCalled();
    expect(auditInsert).not.toHaveBeenCalled();
  });

  it.each(["Bearer", "Bearer wrong-secret", "Basic cron-secret", "Bearer cron-secret "])("rejects %s before auditing or dispatch", async (authorization) => {
    const res = response();
    await handler({ method: "GET", headers: { authorization } } as any, res);
    expect(res.statusCode).toBe(401);
    expect(runFantraxScheduledSync).not.toHaveBeenCalled();
    expect(auditInsert).not.toHaveBeenCalled();
  });

  it.each([
    { name: "disabled", result: { processed: 0, changed: 0, failed: 0, disabled: true }, success: true },
    { name: "empty", result: { processed: 0, changed: 0, failed: 0 }, success: true },
    { name: "aggregate failure", result: { processed: 2, changed: 1, failed: 1 }, success: false },
  ])("records one honest audit for an admitted $name result", async ({ result, success }) => {
    runFantraxScheduledSync.mockResolvedValue(result);
    const res = response();
    await handler({ method: "GET", url: "/api/internal/fantrax-sync", headers: { authorization: "Bearer cron-secret" } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ...result, success });
    expect(runFantraxScheduledSync).toHaveBeenCalledExactlyOnceWith({});
    expect(auditInsert).toHaveBeenCalledTimes(1);
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      job_name: "/api/internal/fantrax-sync", status: success ? "success" : "failure", rows_affected: null,
      details: expect.objectContaining({ statusCode: 200, rowsUpserted: null, failedRows: null, responseOutcome: { success } }),
    }));
    expect(JSON.parse(auditInsert.mock.calls[0][0].details.response)).toEqual({ ...result, success });
    expect(JSON.stringify(auditInsert.mock.calls[0][0])).not.toContain("cron-secret");
  });

  it("keeps a thrown provider failure fixed and audits it once", async () => {
    runFantraxScheduledSync.mockRejectedValue(new Error("private provider credential detail"));
    const res = response();
    await handler({ method: "GET", headers: { authorization: "Bearer cron-secret" } } as any, res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "Fantrax sync failed." });
    expect(auditInsert).toHaveBeenCalledTimes(1);
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({ status: "failure", rows_affected: null,
      details: expect.objectContaining({ statusCode: 500, rowsUpserted: null, failedRows: null }),
    }));
    expect(JSON.stringify(auditInsert.mock.calls[0][0])).not.toContain("private provider credential detail");
  });
});
