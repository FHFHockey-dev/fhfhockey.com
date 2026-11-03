// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ insert: vi.fn(async (_row: any) => ({ error: null })),
  flags: vi.fn(() => ({ scheduler: false, compute: false, capture: false })),
  dispatch: vi.fn(), capture: vi.fn() }));
vi.mock("lib/supabase/server", () => ({ default: { from: () => ({ insert: mocks.insert }) } }));
vi.mock("lib/projections/starterBoardFlags", () => ({ starterBoardFlags: mocks.flags }));
vi.mock("lib/projections/starterBoardQueue", () => ({ dispatchStarterBoardJobs: mocks.dispatch }));
vi.mock("lib/sources/lineSourceIftttReceiver", () => ({ retryPendingLineSourceEvents: mocks.capture }));
import handler from "pages/api/internal/starter-board";
const response = () => { const res: any = { statusCode: 200, body: null, headersSent: false,
  setHeader: vi.fn(), status: (code: number) => { res.statusCode = code; return res; },
  json: (body: unknown) => { res.body = body; return res; }, end: () => res }; return res; };
beforeEach(() => { vi.clearAllMocks(); mocks.flags.mockReturnValue({ scheduler: false, compute: false, capture: false }); vi.stubEnv("CRON_SECRET", "fixture"); });
afterEach(() => vi.unstubAllEnvs());
describe("Starter Board cron audit admission", () => {
  it("rejects unauthorized callers before work or audit writes", async () => {
    const res = response(); await handler({ method: "GET", headers: {} } as any, res);
    expect(res.statusCode).toBe(401); expect(mocks.insert).not.toHaveBeenCalled(); expect(mocks.flags).not.toHaveBeenCalled();
  });
  it("records disabled exits explicitly without inferring durable output", async () => {
    const res = response(); await handler({ method: "GET", headers: { authorization: "Bearer fixture" }, url: "/api/internal/starter-board" } as any, res);
    expect(res.body).toEqual({ disabled: true });
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ status: "success", rows_affected: null,
      details: expect.objectContaining({ response: '{"disabled":true}' }) }));
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
  it("audits missing worker configuration as a failure", async () => {
    mocks.flags.mockReturnValue({ scheduler: true, compute: false, capture: false }); vi.stubEnv("STARTER_BOARD_WORKER_ORIGIN", "");
    const res = response(); await handler({ method: "GET", headers: { authorization: "Bearer fixture" } } as any, res);
    expect(res.statusCode).toBe(503); expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ status: "failure" }));
  });
});
