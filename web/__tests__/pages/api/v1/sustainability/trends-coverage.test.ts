import { beforeEach, describe, expect, it, vi } from "vitest";

// BC W1-9 A2 at the served trends feed (dashboard SustainabilityCard and the
// FORGE page read it): real guardrails, mocked score rows.

const { fromMock, historyMock, identityMock, scoresMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  historyMock: vi.fn(),
  identityMock: vi.fn(),
  scoresMock: vi.fn(),
}));

vi.mock("lib/supabase/public-client", () => ({
  default: { from: fromMock },
}));

vi.mock("lib/sustainability/trendsIdentity", () => ({
  fetchSustainabilityTrendIdentity: identityMock,
  fetchSustainabilityTrendHistory: historyMock,
  fetchSustainabilityTrendScores: scoresMock,
}));

import handler from "../../../../../pages/api/v1/sustainability/trends";

const WEIGHTS = {
  luck: { shp: -1.2, oishp: -1.0, ipp: -0.8, ppshp: -0.4 },
  skill: { ixg60: 0.9, icf60: 0.7, hdcf60: 0.6 },
};
const ALL_MISSING = [
  "missing_window_z_shp",
  "missing_window_z_oishp",
  "missing_window_z_ipp",
  "missing_window_z_ppshp",
  "missing_skill_window_ixg60",
  "missing_skill_window_icf60",
  "missing_skill_window_hdcf60",
];

function scoreRow(playerId: number, warnings: string[], extra = {}) {
  return {
    player_id: playerId,
    season_id: 20262027,
    snapshot_date: "2026-11-10",
    position_group: "F",
    window_code: "l10",
    s_raw: 0,
    s_100: 50,
    components: {
      weights: WEIGHTS,
      z_shp: 0, z_oishp: 0, z_ipp: 0, z_ppshp: 0,
      z_ixg60: null, z_icf60: null, z_hdcf60: null,
      warnings,
      fallbackFlags: {},
      ...extra,
    },
  };
}

function createRes() {
  return {
    statusCode: 200,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.body = body;
      return this;
    },
  } as any;
}

function snapshotQuery() {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    lte: () => builder,
    order: () => builder,
    limit: () =>
      Promise.resolve({ data: [{ snapshot_date: "2026-11-10" }], error: null }),
  };
  return builder;
}

describe("trends feed: score input coverage (A2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockImplementation(() => snapshotQuery());
    historyMock.mockResolvedValue(new Map());
    identityMock.mockResolvedValue(new Map());
  });

  it("drops an all-missing score instead of serving 50 as ready; partial is provisional", async () => {
    scoresMock.mockResolvedValue([
      scoreRow(1, ALL_MISSING),
      scoreRow(2, ["missing_window_z_ppshp"], {
        z_shp: 0.5, z_ixg60: 0.4, z_icf60: 0.2, z_hdcf60: 0.1,
      }),
      scoreRow(3, [], {
        z_shp: 0.5, z_oishp: 0.1, z_ipp: 0.2, z_ppshp: 0.3,
        z_ixg60: 0.4, z_icf60: 0.2, z_hdcf60: 0.1,
      }),
    ]);
    const res = createRes();
    await handler(
      {
        method: "GET",
        query: { snapshot_date: "2026-11-10", window_code: "l10", pos: "all", direction: "hot", limit: "25" },
      } as any,
      res,
    );

    expect(res.statusCode).toBe(200);
    const byId = new Map(res.body.rows.map((row: any) => [row.player_id, row]));
    expect(byId.has(1)).toBe(false);
    expect(byId.get(2)).toMatchObject({
      status: "provisional",
      guardrail_state: "degraded",
    });
    expect((byId.get(2) as any).guardrail_warnings).toContain("guardrail_partial_inputs");
    expect(byId.get(3)).toMatchObject({ status: "ready", guardrail_state: "ok" });
  });

  it("a score with luck inputs but no skill inputs is unavailable too", async () => {
    scoresMock.mockResolvedValue([
      scoreRow(4, [
        "missing_skill_window_ixg60",
        "missing_skill_window_icf60",
        "missing_skill_window_hdcf60",
      ], { z_shp: 1.2, z_oishp: 0.4, z_ipp: 0.3, z_ppshp: 0.1 }),
    ]);
    const res = createRes();
    await handler(
      {
        method: "GET",
        query: { snapshot_date: "2026-11-10", window_code: "l10", pos: "all", direction: "hot", limit: "25" },
      } as any,
      res,
    );
    expect(res.body.rows).toEqual([]);
  });
});
