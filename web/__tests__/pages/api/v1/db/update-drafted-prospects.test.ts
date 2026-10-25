// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// The real adminOnly guard and withCronJobAudit wrapper run; only their service
// clients and the NHL source are synthetic.
const mocks = vi.hoisted(() => {
  // A plain counter, so vi.clearAllMocks cannot hide an import-time request.
  const network = { requests: 0 };
  globalThis.fetch = (() => { network.requests += 1; throw new Error("Network forbidden in route test"); }) as any;
  const state = { updates: [] as any[], updateResults: [] as Array<() => Promise<{ error: unknown }>> };
  const chain: any = { select: () => chain, eq: () => chain,
    single: async () => ({ data: { payload: { latestYear: 2026, year: 2025, after: 219 } }, error: null }),
    update: (value: unknown) => { state.updates.push(value); return chain; },
    then: (resolve: any, reject: any) => (state.updateResults.shift() ?? (async () => ({ error: null })))().then(resolve, reject) };
  return { network, state, chain, preview: vi.fn(), importIdentity: vi.fn(), rpc: vi.fn(), auditInsert: vi.fn(),
    getUser: vi.fn(), role: vi.fn(), tokenClient: vi.fn() };
});
vi.mock("lib/supabase/server", () => ({ default: {
  from: (table: string) => table === "cron_job_audit" ? { insert: mocks.auditInsert } : mocks.chain,
  rpc: mocks.rpc,
} }));
vi.mock("lib/supabase", () => ({ createClientWithToken: mocks.tokenClient }));
vi.mock("lib/sources/nhlProspectIdentity", () => ({ previewNhlDraftBatch: mocks.preview, importNhlIdentity: mocks.importIdentity }));
import handler from "pages/api/v1/db/update-drafted-prospects";
const route = "/api/v1/db/update-drafted-prospects";
function fixture(query = {}, authorization: string | null = "Bearer synthetic-cron-secret", method = "GET") {
  const req: any = { method, url: `${route}?scheduled=true`, query, headers: authorization == null ? {} : { authorization }, socket: { remoteAddress: "198.51.100.2" } };
  const res: any = { statusCode: 200, body: null, headersSent: false, status: (code: number) => { res.statusCode = code; return res; },
    json: (value: any) => { res.body = value; res.headersSent = true; return res; }, end: () => { res.headersSent = true; return res; } };
  return { req, res, updates: mocks.state.updates };
}
const auditRow = () => {
  expect(mocks.auditInsert).toHaveBeenCalledTimes(1);
  return mocks.auditInsert.mock.calls[0][0];
};
const enableWrites = () => {
  vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true"); vi.stubEnv("NHL_PROSPECT_REFRESH_ENABLED", "true");
};
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-18T12:00:00Z"));
  vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("CRON_SECRET", "synthetic-cron-secret");
  mocks.state.updates.length = 0; mocks.state.updateResults.length = 0;
  mocks.preview.mockResolvedValue({ year: 2025, total: 1, players: [{ nhlId: 8485689 }], warnings: [], nextCursor: 220 });
  mocks.importIdentity.mockResolvedValue({ availableToPipeline: true });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.auditInsert.mockResolvedValue({ error: null });
  mocks.getUser.mockResolvedValue({ data: { user: { id: "synthetic-user" } }, error: null });
  mocks.role.mockResolvedValue({ data: { role: "admin" } });
  mocks.tokenClient.mockReturnValue({ auth: { getUser: mocks.getUser },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.role }) }) }) });
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
describe("bounded draft refresh", () => {
  it("defaults to a read-only preview", async () => {
    const { req, res } = fixture({ year: "2025" }); await handler(req, res);
    expect(res.body.dryRun).toBe(true); expect(mocks.importIdentity).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
    expect(auditRow()).toMatchObject({ job_name: route, status: "success", rows_affected: null });
  });
  it("keeps scheduled production writes disabled unless both gates are enabled", async () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    const { req, res } = fixture({ scheduled: "true" }); await handler(req, res);
    expect(res.body.skipped).toBe(true); expect(mocks.preview).not.toHaveBeenCalled();
    const row = auditRow();
    expect(row.status).toBe("success");
    expect(JSON.parse(row.details.response)).toEqual({ success: true, skipped: true, reason: "Prospect writes are disabled." });
  });
  it("resumes the claimed cursor and persists progress after the batch succeeds", async () => {
    enableWrites();
    const { req, res, updates } = fixture({ scheduled: "true" }); await handler(req, res);
    expect(mocks.preview).toHaveBeenCalledWith({ year: 2025, after: 219, limit: 25 });
    expect(res.body.imports).toHaveLength(1);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ status: "pending", attempts: 0, payload: { year: 2025, after: 220 } });
    const row = auditRow();
    expect(row).toMatchObject({ status: "success", details: { statusCode: 200, rowsUpserted: null, failedRows: null, error: null } });
    // Only bounded primitives persist; the player and import lists stay in the response.
    expect(JSON.parse(row.details.response)).toEqual({ success: true, dryRun: false, year: 2025, total: 1, nextCursor: 220 });
  });
  it("preserves the cursor and backs off when a write fails", async () => {
    enableWrites();
    mocks.importIdentity.mockRejectedValue(new Error("Identity conflict"));
    const { req, res, updates } = fixture({ scheduled: "true" }); await handler(req, res);
    expect(res.statusCode).toBe(400); expect(updates[0]).toMatchObject({ status: "failed", failure_stage: "prospect_identity_refresh" });
    expect(updates[0].payload).toBeUndefined();
    expect(auditRow()).toMatchObject({ status: "failure", details: { statusCode: 400, responseOutcome: { success: false } } });
  });
  it("records a partially imported batch as one failed run without advancing the cursor", async () => {
    enableWrites();
    mocks.preview.mockResolvedValue({ year: 2025, total: 2, players: [{ nhlId: 1 }, { nhlId: 2 }], warnings: [], nextCursor: 221 });
    mocks.importIdentity.mockResolvedValueOnce({ availableToPipeline: true }).mockRejectedValueOnce(new Error("Identity conflict"));
    const { req, res, updates } = fixture({ scheduled: "true" }); await handler(req, res);
    expect(mocks.importIdentity).toHaveBeenCalledTimes(2);
    expect(res.statusCode).toBe(400);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ status: "failed" }); expect(updates[0].payload).toBeUndefined();
    expect(auditRow()).toMatchObject({ status: "failure", details: { statusCode: 400 } });
  });
  it("records a throw from the failure write as one bounded wrapper failure", async () => {
    enableWrites();
    mocks.importIdentity.mockRejectedValue(new Error("Identity conflict"));
    mocks.state.updateResults.push(async () => { throw new Error("lease write failed"); });
    const { req, res, updates } = fixture({ scheduled: "true" }); await handler(req, res);
    expect(updates).toHaveLength(1);
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ success: false, error: "lease write failed" });
    expect(auditRow()).toMatchObject({ status: "failure", details: { statusCode: 500, error: "Handler failed." } });
  });
  it("does no work when another refresh holds the lease", async () => {
    enableWrites();
    const { req, res } = fixture({ scheduled: "true" }); mocks.rpc.mockResolvedValue({ data: false, error: null });
    await handler(req, res); expect(res.body.skipped).toBe(true); expect(mocks.preview).not.toHaveBeenCalled();
    expect(mocks.state.updates).toHaveLength(0);
    expect(auditRow().status).toBe("success");
  });
  it("honors an explicit dry run even when scheduled writes are enabled", async () => {
    enableWrites();
    const { req, res } = fixture({ scheduled: "true", dryRun: "true" }); await handler(req, res);
    expect(res.body.dryRun).toBe(true); expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.importIdentity).not.toHaveBeenCalled();
  });
  it.each([
    { name: "missing bearer", authorization: null, status: 401 },
    { name: "invalid user token", authorization: "Bearer invalid-token", status: 401 },
    { name: "non-admin token", authorization: "Bearer member-token", status: 403 },
  ])("rejects a $name before auditing or any refresh work", async ({ authorization, status }) => {
    enableWrites();
    if (status === 401 && authorization) mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("invalid token") });
    if (status === 403) mocks.role.mockResolvedValue({ data: { role: "member" } });
    const { req, res } = fixture({ scheduled: "true" }, authorization); await handler(req, res);
    expect(res.statusCode).toBe(status);
    expect(mocks.auditInsert).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.preview).not.toHaveBeenCalled();
  });
  it("admits a verified admin token with one audit row", async () => {
    const { req, res } = fixture({ year: "2025" }, "Bearer admin-token"); await handler(req, res);
    expect(res.statusCode).toBe(200); expect(mocks.getUser).toHaveBeenCalledTimes(1);
    expect(auditRow().status).toBe("success");
  });
  it("audits an admitted unsupported method as a failure without refresh work", async () => {
    const { req, res } = fixture({}, "Bearer synthetic-cron-secret", "DELETE"); await handler(req, res);
    expect(res.statusCode).toBe(405); expect(mocks.preview).not.toHaveBeenCalled();
    expect(auditRow()).toMatchObject({ status: "failure", details: { method: "DELETE", statusCode: 405 } });
  });
  it("makes no network request at import or during a run", () => {
    expect(mocks.network.requests).toBe(0);
  });
});
