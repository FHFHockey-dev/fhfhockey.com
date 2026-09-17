import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextApiRequest, NextApiResponse } from "next";
const dependencies = vi.hoisted(() => ({
  rpc: vi.fn(),
  user: vi.fn(),
  access: vi.fn(),
  capability: vi.fn(),
}));
vi.mock("lib/supabase/server", () => ({ default: { rpc: dependencies.rpc } }));
vi.mock("lib/api/requireApiUser", () => ({
  requireApiUser: dependencies.user,
}));
vi.mock("lib/draft-pro/server", () => ({
  loadDraftProAccess: dependencies.access,
  requireDraftProServerCapability: dependencies.capability,
}));
import { mockHandler } from "./api";
import { stableJson, type MockLeague } from "./contracts";
const league: MockLeague = {
  season: "20262027",
  teamCount: 2,
  leagueType: "points",
  scoring: { GOALS: 1 },
  goalieScoring: {},
  roster: { C: 1 },
  grouping: "split",
};
async function request(
  action: Parameters<typeof mockHandler>[0],
  body: unknown = {},
  query = {},
  method = "POST",
) {
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
  };
  await mockHandler(action)(
    { method, body, query, headers: {} } as NextApiRequest,
    response as unknown as NextApiResponse,
  );
  return response;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("MOCK_DRAFT_ENABLED", "true");
  vi.stubEnv("MOCK_DRAFT_COLLECTION_ENABLED", "true");
  vi.stubEnv("MOCK_DRAFT_ADP_ENABLED", "true");
  dependencies.user.mockResolvedValue({ id: "user" });
  dependencies.rpc.mockResolvedValue({ data: { accepted: true }, error: null });
  dependencies.access.mockResolvedValue({
    expiresAt: null,
    nextVerificationAt: null,
  });
});
describe("mock API", () => {
  it("checks capability server-side before granting advanced access", async () => {
    const r = await request("access");
    expect(r.status).toHaveBeenCalledWith(200);
    expect(dependencies.capability).toHaveBeenCalledWith(
      expect.anything(),
      "mock_draft_advanced",
    );
  });
  it("does not write unauthenticated requests", async () => {
    dependencies.user.mockResolvedValue(null);
    await request("register");
    expect(dependencies.rpc).not.toHaveBeenCalled();
  });
  it("validates seats and does not accept arbitrary projection payloads", async () => {
    const r = await request("register", {
      id: "b7c03ee0-0000-4000-8000-000000000001",
      league,
      userSeat: 2,
      tier: "free",
      engineVersion: "mock-1",
      researchVersion: null,
    });
    expect(r.status).toHaveBeenCalledWith(400);
    expect(dependencies.rpc).not.toHaveBeenCalled();
  });
  it("canonicalizes cohorts and passes authenticated ownership", async () => {
    await request("register", {
      id: "b7c03ee0-0000-4000-8000-000000000001",
      league,
      userSeat: 0,
      tier: "free",
      engineVersion: "mock-1",
      researchVersion: null,
    });
    expect(dependencies.rpc).toHaveBeenCalledWith(
      "mock_draft_register",
      expect.objectContaining({ p_user: "user", p_cohort: stableJson(league) }),
    );
  });
  it("public ADP has no account context and only requests aggregates", async () => {
    const r = await request(
      "adp",
      {},
      { season: league.season, cohort: JSON.stringify(league) },
      "GET",
    );
    expect(dependencies.user).not.toHaveBeenCalled();
    expect(dependencies.rpc).toHaveBeenCalledWith(
      "mock_draft_adp",
      expect.objectContaining({
        p_cohort: stableJson(league),
        p_completed: false,
      }),
    );
    expect(r.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "public, max-age=60",
    );
  });
  it("keeps withdrawals available when collection is disabled", async () => {
    vi.stubEnv("MOCK_DRAFT_ENABLED", "false");
    const r = await request(
      "withdraw",
      {},
      { id: "b7c03ee0-0000-4000-8000-000000000001" },
      "DELETE",
    );
    expect(r.status).toHaveBeenCalledWith(200);
  });
  it("maps limits and conflicts without exposing database details", async () => {
    dependencies.rpc.mockResolvedValue({ error: { message: "daily_limit" } });
    const r = await request("register", {
      id: "b7c03ee0-0000-4000-8000-000000000001",
      league,
      userSeat: 0,
      tier: "free",
      engineVersion: "mock-1",
      researchVersion: null,
    });
    expect(r.status).toHaveBeenCalledWith(429);
  });
});
