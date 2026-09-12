import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireApiUserMock, loadAccessMock, requireCapabilityMock, consumeMock } = vi.hoisted(() => ({
  requireApiUserMock: vi.fn(), loadAccessMock: vi.fn(), requireCapabilityMock: vi.fn(), consumeMock: vi.fn(),
}));
vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: requireApiUserMock }));
vi.mock("lib/draft-pro/server", () => ({ loadDraftProAccess: loadAccessMock, requireDraftProServerCapability: requireCapabilityMock }));
vi.mock("lib/draft-pro/recommendationsRateLimit", () => ({ consumeRecommendationRequest: consumeMock }));

import handler, { config } from "../../../../../pages/api/v1/draft-pro/recommendations";
import { draftProRecommendationsInputSchema } from "../../../../../lib/draft-pro/recommendationsContract";

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

  it("shares explicit horizon estimates and accepts legacy requests without estimates", async () => {
    const candidates = [{ ...body.candidates[0], adp: 50 }];
    const res = response();
    await handler({ method: "POST", body: { ...body, candidates, selectionHorizon: { currentPick: 20, targetPick: 21, opposingPicks: 0 }, availabilitySpread: 12 } } as any, res as any);
    expect(res.body).toEqual({ data: [expect.objectContaining({ availabilityEstimate: 1 })] });
    const legacy = response();
    await handler({ method: "POST", body: { ...body, candidates, currentPick: 20, teamCount: 12 } } as any, legacy as any);
    expect(legacy.body).toEqual({ data: [expect.objectContaining({ availabilityEstimate: null })] });
    expect(draftProRecommendationsInputSchema.safeParse({ ...body, selectionHorizon: { currentPick: 20, targetPick: 21, opposingPicks: 3 } }).success).toBe(false);
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

  it("sanitizes unexpected provider failures and marks responses private", async () => {
    loadAccessMock.mockRejectedValue(new Error("secret database detail"));
    const res = response();
    await handler({ method: "POST", body, headers: {} } as any, res as any);
    expect(res.statusCode).toBe(500);
    expect(res.headers["Cache-Control"]).toBe("private, no-store");
    expect(res.body).toEqual({ error: { code: "recommendations_unavailable", message: "Unable to calculate recommendations." } });
  });

  it("rejects oversized need records", async () => {
    const res = response();
    const positionNeeds = Object.fromEntries(Array.from({ length: 81 }, (_, index) => [`P${index}`, 1]));
    await handler({ method: "POST", body: { ...body, positionNeeds }, headers: {} } as any, res as any);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: expect.objectContaining({ code: "validation_error" }) });
  });

  it("accepts the full 2,000-player contract with a 4 MiB body limit", () => {
    const candidates = Array.from({ length: 2_000 }, (_, index) => ({ ...body.candidates[0], id: String(index) }));
    expect(draftProRecommendationsInputSchema.parse({ ...body, candidates })).toHaveProperty("candidates");
    expect(() => draftProRecommendationsInputSchema.parse({ ...body, candidates: [...candidates, { ...body.candidates[0], id: "2000" }] })).toThrow();
    expect(config.api.bodyParser.sizeLimit).toBe("4mb");
  });
});

it("authorizes local calculations through the existing capability guard", async () => {
  requireApiUserMock.mockResolvedValue({ id: "user-1" });
  consumeMock.mockReturnValue(true);
  loadAccessMock.mockResolvedValue({});
  requireCapabilityMock.mockReset();
  const res = response();
  const request = { method: "POST", body: { dataOrigin: "local_csv", authorizeOnly: true } };
  await handler(request as any, res as any);
  expect(res.body).toEqual({ data: { authorized: true } });
  expect(requireCapabilityMock).toHaveBeenCalledWith({}, "recommendations");
  requireCapabilityMock.mockImplementationOnce(() => { throw Object.assign(new Error("Expired"), { statusCode: 403 }); });
  const denied = response();
  await handler(request as any, denied as any);
  expect(denied.statusCode).toBe(403);
});
