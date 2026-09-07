import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  loadDraftProAccess: vi.fn(),
  requireDraftProServerCapability: vi.fn(),
  enforceDraftProDustRateLimit: vi.fn(),
  readRosterSchedule: vi.fn(),
}));

vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: mocks.requireApiUser }));
vi.mock("lib/draft-pro/server", () => ({
  loadDraftProAccess: mocks.loadDraftProAccess,
  requireDraftProServerCapability: mocks.requireDraftProServerCapability,
}));
vi.mock("lib/draft-pro/features", () => ({ getDraftProFeatureFlags: vi.fn(() => ({})) }));
vi.mock("lib/draft-pro/dustRateLimit", () => ({ enforceDraftProDustRateLimit: mocks.enforceDraftProDustRateLimit }));
vi.mock("lib/rosterScheduleData", async () => {
  const actual = await vi.importActual<typeof import("lib/rosterScheduleData")>("lib/rosterScheduleData");
  return { ...actual, readRosterSchedule: mocks.readRosterSchedule };
});
vi.mock("lib/supabase/server", () => ({ default: {} }));

import handler from "./dust";

function response() {
  const state = { status: 0, body: null as unknown, headers: new Map<string, string>() };
  const api = {
    status: vi.fn((status: number) => { state.status = status; return api; }),
    json: vi.fn((body: unknown) => { state.body = body; return api; }),
    setHeader: vi.fn((name: string, value: string | string[]) => state.headers.set(name, String(value))),
  };
  return {
    state,
    api,
  };
}

describe("Draft Pro DUST API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: "user-1" });
    mocks.loadDraftProAccess.mockResolvedValue({});
    mocks.enforceDraftProDustRateLimit.mockResolvedValue({ remainingPoints: 19 });
  });

  it("returns the shared 401 fixture before premium work", async () => {
    mocks.requireApiUser.mockImplementation(async (_req, res, options) => {
      options.onUnauthorized("Authentication required.");
      return null;
    });
    const res = response();
    await handler({ method: "POST" } as any, res.api as any);
    expect(res.state).toMatchObject({ status: 401, body: { success: false, error: { code: "authentication_required" } } });
    expect(mocks.loadDraftProAccess).not.toHaveBeenCalled();
  });

  it("returns a capability 403 before parsing or reading schedule data", async () => {
    const denied = new Error("Draft Pro access is required for this action.");
    Object.assign(denied, { statusCode: 403, code: "no_active_grant" });
    mocks.requireDraftProServerCapability.mockImplementation(() => { throw denied; });
    const res = response();
    await handler({ method: "POST", body: {} } as any, res.api as any);
    expect(res.state).toMatchObject({ status: 403, body: { success: false, error: { code: "no_active_grant" } } });
    expect(mocks.readRosterSchedule).not.toHaveBeenCalled();
  });

  it("returns the bounded invalid-input fixture without reading schedule data", async () => {
    const res = response();
    await handler({ method: "POST", body: {} } as any, res.api as any);
    expect(res.state).toMatchObject({ status: 400, body: { success: false, error: { code: "invalid_input" } } });
    expect(mocks.readRosterSchedule).not.toHaveBeenCalled();
  });
});
