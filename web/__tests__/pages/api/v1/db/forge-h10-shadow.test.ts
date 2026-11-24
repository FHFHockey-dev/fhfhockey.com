// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { H10_ROUTE, h10RunKey, signH10Dispatch } from "lib/forge-v2/h10Dispatch.server";

const { pools, queries, handle, beginStatus } = vi.hoisted(() => ({ pools: { created: 0, urls: [] as string[] }, queries: [] as string[], handle: vi.fn(), beginStatus: { value: "started" } }));
vi.mock("pg", () => ({
  Pool: class {
    constructor(options: { connectionString: string }) { pools.created += 1; pools.urls.push(options.connectionString); }
    async query(text: string) {
      queries.push(text);
      if (text.includes("forge_h10_dispatch_begin_v1")) return { rows: [{ status: beginStatus.value, outcome: beginStatus.value === "duplicate" ? "complete" : null }] };
      return { rows: [{ forge_h10_dispatch_finish_v1: "finished" }] };
    }
    async end() { return undefined; }
  },
}));
vi.mock("lib/cron/withCronJobAudit", () => ({ withCronJobAudit: (handler: unknown) => handler }));
vi.mock("lib/forge-v2/h10Route.server", async importOriginal => ({ ...await importOriginal<typeof import("lib/forge-v2/h10Route.server")>(), handleH10Shadow: handle }));

import route from "pages/api/v1/db/forge-h10-shadow";

const secret = "offline-h10-dispatch-signing-key-0123456789";
const dispatch = (now = Date.now()) => ({ dispatchId: "550e8400-e29b-41d4-a716-446655440000", mode: "nightly" as const, runKey: h10RunKey("nightly", now), expiresAt: Math.floor(now / 1000) + 90 });
function call(body: unknown, headers: Record<string, string>, url = H10_ROUTE, method = "POST") {
  const response = { setHeader: vi.fn(), code: 0, body: {} as Record<string, unknown>,
    status(code: number) { this.code = code; return this; }, json(value: Record<string, unknown>) { this.body = value; } };
  const query = Object.fromEntries(new URL(url, "http://x").searchParams);
  return (route as (req: unknown, res: unknown) => Promise<void>)({ method, url, query, headers, body }, response).then(() => response);
}

describe("hosted H1–H10 route: signed dispatches only", () => {
  beforeEach(() => {
    pools.created = 0; pools.urls.length = 0; queries.length = 0; handle.mockReset(); beginStatus.value = "started";
    vi.stubEnv("FORGE_H10_DISPATCH_SECRET", secret);
    vi.stubEnv("FORGE_H10_SHADOW_ENABLED", "true");
    vi.stubEnv("FORGE_H10_SHADOW_APPROVAL_ID", "offline-test");
    vi.stubEnv("FORGE_H10_SHADOW_APPROVED_AT", "2026-11-23T00:00:00Z");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "0123456789abcdef0123456789abcdef01234567");
    vi.stubEnv("SUPABASE_DB_URL", "postgres://offline.invalid/db");
    vi.stubEnv("POSTGRES_URL", "");
    vi.stubEnv("CRON_SECRET", "a-reusable-bearer-secret");
  });
  afterEach(() => { vi.unstubAllEnvs(); });

  it("refuses a bad signature, a bearer token, the wrong route or a query before any database or forecast work", async () => {
    const body = dispatch();
    for (const [headers, url] of [[{ "x-forge-h10-signature": "0".repeat(64) }, H10_ROUTE], [{ authorization: "Bearer a-reusable-bearer-secret" }, H10_ROUTE],
      [{ "x-forge-h10-signature": signH10Dispatch(secret, H10_ROUTE, body) }, `${H10_ROUTE}?mode=nightly`],
      [{ "x-forge-h10-signature": signH10Dispatch(secret, H10_ROUTE, body) }, "/api/v1/db/forge-pregame-capture"]] as const) {
      const response = await call(body, headers, url);
      expect(response.code).toBeGreaterThanOrEqual(400);
    }
    expect((await call({ ...body, mode: "material" }, { "x-forge-h10-signature": signH10Dispatch(secret, H10_ROUTE, body) })).body).toEqual({ status: "invalid_signature" });
    expect(pools.created).toBe(0);
    expect(handle).not.toHaveBeenCalled();
  });

  it("runs a valid dispatch once: consume, issue the signed mode, finish", async () => {
    handle.mockResolvedValue({ status: 200, body: { success: true, status: "complete" } });
    const body = dispatch(), response = await call(body, { "x-forge-h10-signature": signH10Dispatch(secret, H10_ROUTE, body) });
    expect(response).toMatchObject({ code: 200, body: { status: "complete", runKey: body.runKey } });
    expect(handle).toHaveBeenCalledTimes(1);
    expect(handle.mock.calls[0][0]).toMatchObject({ mode: "nightly" });
    expect(queries.map(q => q.match(/forge_h10_dispatch_(begin|finish)_v1/)?.[0])).toEqual(["forge_h10_dispatch_begin_v1", "forge_h10_dispatch_finish_v1"]);
  });

  it("a duplicate delivery reports the run and does no work", async () => {
    beginStatus.value = "duplicate";
    const body = dispatch(), response = await call(body, { "x-forge-h10-signature": signH10Dispatch(secret, H10_ROUTE, body) });
    expect(response).toMatchObject({ code: 200, body: { status: "duplicate", outcome: "complete", runKey: body.runKey } });
    expect(handle).not.toHaveBeenCalled();
  });

  it("without the signing secret nothing runs", async () => {
    vi.stubEnv("FORGE_H10_DISPATCH_SECRET", "");
    const body = dispatch();
    expect((await call(body, { "x-forge-h10-signature": signH10Dispatch(secret, H10_ROUTE, body) })).code).toBe(503);
    expect(pools.created).toBe(0);
  });

  it("uses SUPABASE_DB_URL, else POSTGRES_URL, and refuses before any work with neither", async () => {
    handle.mockResolvedValue({ status: 200, body: { success: true, status: "complete" } });
    const signed = () => { const body = dispatch(); return call(body, { "x-forge-h10-signature": signH10Dispatch(secret, H10_ROUTE, body) }); };
    vi.stubEnv("POSTGRES_URL", "postgres://pooler.offline.invalid:6543/db");
    expect((await signed()).code).toBe(200);
    vi.stubEnv("SUPABASE_DB_URL", "");
    expect((await signed()).code).toBe(200);
    expect(pools.urls).toEqual(["postgres://offline.invalid/db", "postgres://pooler.offline.invalid:6543/db"]);
    vi.stubEnv("POSTGRES_URL", "");
    expect((await signed()).body).toEqual({ success: false, status: "failed", reason: "database_url_missing" });
    expect(pools.created).toBe(2);
    expect(handle).toHaveBeenCalledTimes(2);
  });
});
