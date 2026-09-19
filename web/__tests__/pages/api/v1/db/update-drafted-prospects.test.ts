// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ preview: vi.fn(), importIdentity: vi.fn() }));
vi.mock("utils/adminOnlyMiddleware", () => ({ default: (handler: unknown) => handler }));
vi.mock("lib/sources/nhlProspectIdentity", () => ({ previewNhlDraftBatch: mocks.preview, importNhlIdentity: mocks.importIdentity }));
import handler from "pages/api/v1/db/update-drafted-prospects";
function fixture(query = {}) {
  const updates: any[] = [];
  const chain: any = { select: () => chain, eq: () => chain, single: async () => ({ data: { payload: { latestYear: 2026, year: 2025, after: 219 } }, error: null }),
    update: (value: unknown) => { updates.push(value); return chain; }, then: (resolve: any) => Promise.resolve({ error: null }).then(resolve) };
  const req: any = { method: "GET", query, supabase: { from: () => chain, rpc: vi.fn(async () => ({ data: true, error: null })) } };
  const res: any = { statusCode: 200, body: null, status: (code: number) => { res.statusCode = code; return res; }, json: (value: any) => { res.body = value; return res; } };
  return { req, res, updates };
}
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-18T12:00:00Z"));
  mocks.preview.mockResolvedValue({ year: 2025, players: [{ nhlId: 8485689 }], warnings: [], nextCursor: 220 });
  mocks.importIdentity.mockResolvedValue({ availableToPipeline: true });
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
describe("bounded draft refresh", () => {
  it("defaults to a read-only preview", async () => {
    const { req, res } = fixture({ year: "2025" }); await handler(req, res);
    expect(res.body.dryRun).toBe(true); expect(mocks.importIdentity).not.toHaveBeenCalled(); expect(req.supabase.rpc).not.toHaveBeenCalled();
  });
  it("keeps scheduled production writes disabled unless both gates are enabled", async () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    const { req, res } = fixture({ scheduled: "true" }); await handler(req, res);
    expect(res.body.skipped).toBe(true); expect(mocks.preview).not.toHaveBeenCalled();
  });
  it("resumes the claimed cursor and persists progress after the batch succeeds", async () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true"); vi.stubEnv("NHL_PROSPECT_REFRESH_ENABLED", "true");
    const { req, res, updates } = fixture({ scheduled: "true" }); await handler(req, res);
    expect(mocks.preview).toHaveBeenCalledWith({ year: 2025, after: 219, limit: 25 });
    expect(res.body.imports).toHaveLength(1);
    expect(updates[0]).toMatchObject({ status: "pending", attempts: 0, payload: { year: 2025, after: 220 } });
  });
  it("preserves the cursor and backs off when a write fails", async () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true"); vi.stubEnv("NHL_PROSPECT_REFRESH_ENABLED", "true");
    mocks.importIdentity.mockRejectedValue(new Error("Identity conflict"));
    const { req, res, updates } = fixture({ scheduled: "true" }); await handler(req, res);
    expect(res.statusCode).toBe(400); expect(updates[0]).toMatchObject({ status: "failed", failure_stage: "prospect_identity_refresh" });
    expect(updates[0].payload).toBeUndefined();
  });
  it("does no work when another refresh holds the lease", async () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true"); vi.stubEnv("NHL_PROSPECT_REFRESH_ENABLED", "true");
    const { req, res } = fixture({ scheduled: "true" }); req.supabase.rpc.mockResolvedValue({ data: false, error: null });
    await handler(req, res); expect(res.body.skipped).toBe(true); expect(mocks.preview).not.toHaveBeenCalled();
  });
  it("honors an explicit dry run even when scheduled writes are enabled", async () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true"); vi.stubEnv("NHL_PROSPECT_REFRESH_ENABLED", "true");
    const { req, res } = fixture({ scheduled: "true", dryRun: "true" }); await handler(req, res);
    expect(res.body.dryRun).toBe(true); expect(req.supabase.rpc).not.toHaveBeenCalled(); expect(mocks.importIdentity).not.toHaveBeenCalled();
  });

});
