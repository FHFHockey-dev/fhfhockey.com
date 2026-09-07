import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireApiUserMock, loadAccessMock, requireCapabilityMock, consumeMock } = vi.hoisted(() => ({
  requireApiUserMock: vi.fn(), loadAccessMock: vi.fn(), requireCapabilityMock: vi.fn(), consumeMock: vi.fn(),
}));
vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: requireApiUserMock }));
vi.mock("lib/draft-pro/server", () => ({ loadDraftProAccess: loadAccessMock, requireDraftProServerCapability: requireCapabilityMock }));
vi.mock("lib/draft-pro/recommendationsRateLimit", () => ({ consumeRecommendationRequest: consumeMock }));

import handler from "../../../../../pages/api/v1/draft-pro/recommendations";

const response = () => ({ statusCode: 200, body: null as unknown, headers: {} as Record<string, string>, status(code: number) { this.statusCode = code; return this; }, setHeader(name: string, value: string) { this.headers[name] = value; }, json(body: unknown) { this.body = body; return this; } });
const body = { dataOrigin: "server", leagueType: "points", candidates: [{ id: "1", name: "Player", role: "skater", eligiblePositions: ["C"], globalVorp: 12, rankValue: 8 }] };

describe("POST /api/v1/draft-pro/recommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
    loadAccessMock.mockResolvedValue({});
    consumeMock.mockReturnValue(true);
    process.env.DRAFT_PRO_RECOMMENDATIONS_ENABLED = "true";
  });

  it("uses the session user and requires the recommendations capability", async () => {
    const res = response();
    await handler({ method: "POST", body, headers: {} } as any, res as any);
    expect(loadAccessMock).toHaveBeenCalledWith("user-1", expect.objectContaining({ flags: expect.objectContaining({ recommendations: true }) }));
    expect(requireCapabilityMock).toHaveBeenCalledWith({}, "recommendations");
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ data: [expect.objectContaining({ globalVorp: 12, rankScore: 8 })] });
  });

  it("rejects oversized and unauthorized work before calculating", async () => {
    const res = response();
    consumeMock.mockReturnValue(false);
    await handler({ method: "POST", body, headers: {} } as any, res as any);
    expect(res.statusCode).toBe(429);
    expect(loadAccessMock).not.toHaveBeenCalled();
  });

  it("does not accept local or private import rows for remote calculation", async () => {
    const res = response();
    await handler({ method: "POST", body: { ...body, dataOrigin: "local_csv" }, headers: {} } as any, res as any);
    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: expect.objectContaining({ code: "private_source_requires_saved_draft" }) });
  });
});
