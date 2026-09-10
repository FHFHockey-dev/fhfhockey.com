import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  loadDraftProAccess: vi.fn(),
  requireDraftProServerCapability: vi.fn(),
}));

vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: mocks.requireApiUser }));
vi.mock("lib/draft-pro/server", () => ({ loadDraftProAccess: mocks.loadDraftProAccess, requireDraftProServerCapability: mocks.requireDraftProServerCapability }));
vi.mock("lib/draft-pro/features", () => ({ getDraftProFeatureFlags: vi.fn(() => ({})) }));

import handler from "../../../pages/api/v1/draft-pro/export";

function response() {
  const state = { status: 0, body: null as unknown, headers: new Map<string, string>() };
  const api = {
    status: vi.fn((status: number) => { state.status = status; return api; }),
    json: vi.fn((body: unknown) => { state.body = body; return api; }),
    send: vi.fn((body: unknown) => { state.body = body; return api; }),
    setHeader: vi.fn((name: string, value: string | string[]) => state.headers.set(name, String(value))),
  };
  return { state, api };
}

const body = { season: "20262027", leagueType: "categories", sourceWeights: { projections: 1 }, scoring: { G: 3 }, goalieScoring: { W: 4 }, adjustments: { prorate84: true }, rows: [{ playerId: 1, fullName: "  =Alex" }] };

describe("Draft Pro export API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: "user-1" });
    mocks.loadDraftProAccess.mockResolvedValue({});
  });

  it("returns 401 before premium work", async () => {
    mocks.requireApiUser.mockImplementation(async (_req, res, options) => { options.onUnauthorized("Authentication required."); return null; });
    const res = response();
    await handler({ method: "POST", body } as any, res.api as any);
    expect(res.state.status).toBe(401);
    expect(mocks.loadDraftProAccess).not.toHaveBeenCalled();
  });

  it("returns 403 when the blended_csv capability is denied", async () => {
    const denied = Object.assign(new Error("denied"), { statusCode: 403 });
    mocks.requireDraftProServerCapability.mockImplementation(() => { throw denied; });
    const res = response();
    await handler({ method: "POST", body } as any, res.api as any);
    expect(res.state.status).toBe(403);
  });

  it("rejects bounded invalid input", async () => {
    const res = response();
    await handler({ method: "POST", body: { ...body, sourceWeights: { ["x".repeat(65)]: 1 } } } as any, res.api as any);
    expect(res.state.status).toBe(400);
  });

  it.each(["lineupexperts_skaters", "lineupexperts_goalies", "Lineup Experts"])("rejects declared %s sources server-side", async (source) => {
    const res = response();
    await handler({ method: "POST", body: { ...body, sourceWeights: { projections: 1, [source]: 0.5 } } } as any, res.api as any);
    expect(res.state.status).toBe(403);
    expect(res.state.body).toMatchObject({ error: { code: "source_export_restricted" } });
    expect(res.api.send).not.toHaveBeenCalled();
    expect(res.state.headers.has("Content-Disposition")).toBe(false);
  });

  it("returns a fixed-download CSV with provenance", async () => {
    const res = response();
    await handler({ method: "POST", body } as any, res.api as any);
    expect(res.state.status).toBe(200);
    expect(res.state.headers.get("Content-Disposition")).toContain("fhfhockey-blended-projections.csv");
    expect(String(res.state.body)).toContain("projectionSeason");
    expect(String(res.state.body)).toContain("categories");
    expect(String(res.state.body)).toContain("'  =Alex");
    expect(String(res.state.body)).toContain("20262027");
  });
});
