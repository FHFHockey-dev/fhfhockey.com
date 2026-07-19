import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DraftRankerApiError } from "lib/draft-ranker/api";

const { authMock, loadMock, rateMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  loadMock: vi.fn(),
  rateMock: vi.fn(),
}));

vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: authMock }));
vi.mock("lib/draft-ranker/exportServer", () => ({
  loadDraftRankingExport: loadMock,
}));
vi.mock("lib/draft-ranker/exportRateLimit", () => ({
  enforceDraftRankingExportRateLimit: rateMock,
}));

import handler from "../../../../../pages/api/v1/draft-ranker/export";

function response() {
  return {
    statusCode: 200,
    body: null as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

function exportDocument() {
  return {
    schemaVersion: "fhfh-draft-ranking-v1",
    exportedAt: "2026-07-15T12:00:00.000Z",
    ranking: {
      id: "11111111-1111-4111-8111-111111111111",
      name: "My Rankings",
      status: "active",
      version: 2,
      targetSeason: 20262027,
      scoringProfile: {},
      schemaVersion: 1,
      seedRevision: null,
      seedProvenance: null,
    },
    options: {
      includeCandidates: false,
      includeWatchlist: false,
      includeEventSummary: false,
      privateComparisonEvidenceIncluded: false,
    },
    top250: [],
    candidates: [],
    watchlist: [],
    eventSummary: null,
  };
}

describe("GET /api/v1/draft-ranker/export", () => {
  const previousFlag = process.env.DRAFT_RANKER_ENABLED;
  const rankingId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DRAFT_RANKER_ENABLED = "true";
    process.env.DRAFT_RANKER_ROLLOUT_STAGE = "authenticated";
    authMock.mockResolvedValue({ id: "owner-1" });
    rateMock.mockResolvedValue({ remainingPoints: 9 });
    loadMock.mockResolvedValue(exportDocument());
  });

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.DRAFT_RANKER_ENABLED;
    else process.env.DRAFT_RANKER_ENABLED = previousFlag;
    delete process.env.DRAFT_RANKER_ROLLOUT_STAGE;
  });

  it("owner-scopes and returns a private no-store JSON attachment", async () => {
    const res = response();
    await handler(
      {
        method: "GET",
        headers: { "x-request-id": "export-1" },
        query: {
          rankingId,
          format: "json",
          includeCandidates: "true",
          includeWatchlist: "true",
          includeEventSummary: "false",
          userId: "forged-owner",
        },
      } as any,
      res as any,
    );
    expect(loadMock).toHaveBeenCalledWith("owner-1", {
      rankingId,
      format: "json",
      includeCandidates: true,
      includeWatchlist: true,
      includeEventSummary: false,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["Cache-Control"]).toBe("private, no-store");
    expect(res.headers["Content-Type"]).toContain("application/json");
    expect(String(res.body)).not.toContain("comparisonId");
  });

  it("returns the approved CSV schema by default", async () => {
    const res = response();
    await handler(
      { method: "GET", headers: {}, query: { rankingId } } as any,
      res as any,
    );
    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toContain("text/csv");
    expect(String(res.body)).toMatch(/^schema_version,exported_at,ranking_id/u);
  });

  it("rejects malformed options before loading owner data", async () => {
    const res = response();
    await handler(
      {
        method: "GET",
        headers: {},
        query: { rankingId, includeCandidates: "sometimes" },
      } as any,
      res as any,
    );
    expect(res.statusCode).toBe(400);
    expect(loadMock).not.toHaveBeenCalled();
  });

  it("emits Retry-After when the authenticated export quota is exhausted", async () => {
    rateMock.mockRejectedValue(
      new DraftRankerApiError(429, "rate_limited", "Slow down.", {
        retryAfterSeconds: 60,
      }),
    );
    const res = response();
    await handler(
      { method: "GET", headers: {}, query: { rankingId } } as any,
      res as any,
    );
    expect(res.statusCode).toBe(429);
    expect(res.headers["Retry-After"]).toBe("60");
    expect(loadMock).not.toHaveBeenCalled();
  });
});
