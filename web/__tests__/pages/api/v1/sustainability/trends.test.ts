import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, identityMock, scoresMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  identityMock: vi.fn(),
  scoresMock: vi.fn(),
}));

vi.mock("lib/supabase/public-client", () => ({
  default: { from: fromMock },
}));

vi.mock("lib/sustainability/trendsIdentity", () => ({
  fetchSustainabilityTrendIdentity: identityMock,
  fetchSustainabilityTrendScores: scoresMock,
}));

vi.mock("lib/sustainability/guardrails", () => ({
  guardSustainabilityDashboardRow: ({
    s100,
    luckPressure,
    components,
  }: any) => ({
    state: "ok",
    s100: s100 ?? 50,
    luckPressure,
    components: components ?? {},
    warnings: [],
  }),
}));

import handler from "../../../../../pages/api/v1/sustainability/trends";

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

function createSnapshotQuery() {
  const builder: any = {
    select() {
      return builder;
    },
    eq() {
      return builder;
    },
    lte() {
      return builder;
    },
    order() {
      return builder;
    },
    limit() {
      return Promise.resolve({
        data: [{ snapshot_date: "2026-03-07" }],
        error: null,
      });
    },
  };
  return builder;
}

describe("GET /api/v1/sustainability/trends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockImplementation(() => createSnapshotQuery());
    scoresMock.mockResolvedValue([
      {
        player_id: 1,
        season_id: 20252026,
        snapshot_date: "2026-03-07",
        position_group: "F",
        window_code: "l10",
        s_raw: 0,
        s_100: 50,
        components: { weights: { luck: {} } },
      },
    ]);
    identityMock.mockResolvedValue(
      new Map([
        [
          1,
          {
            playerId: 1,
            playerName: "Canonical Player",
            positionCode: "C",
          },
        ],
      ]),
    );
  });

  it("serves the canonical identity returned by the bounded trends lookup", async () => {
    const res = createRes();
    await handler(
      {
        method: "GET",
        query: {
          snapshot_date: "2026-03-14",
          window_code: "l10",
          pos: "all",
          direction: "hot",
          limit: "25",
        },
      } as any,
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(scoresMock).toHaveBeenCalledWith(expect.anything(), {
      snapshotDate: "2026-03-07",
      windowCode: "l10",
      positionGroup: undefined,
    });
    expect(identityMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([expect.objectContaining({ player_id: 1 })]),
      "2026-03-07",
    );
    expect(res.body.rows).toEqual([
      expect.objectContaining({
        player_id: 1,
        player_name: "Canonical Player",
        position_code: "C",
      }),
    ]);
  });
});
