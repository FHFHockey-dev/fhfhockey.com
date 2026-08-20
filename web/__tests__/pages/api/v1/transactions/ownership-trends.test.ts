import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn()
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock
}));

import ownershipSnapshotsHandler from "../../../../../pages/api/v1/transactions/ownership-snapshots";
import ownershipTrendsHandler, {
  buildAdpTimelines,
  calculateTrendMovement,
  fetchYahooPlayerRows,
  latestOwnershipTimelineDate,
  matchesPositionFilter
} from "../../../../../pages/api/v1/transactions/ownership-trends";
import {
  formatTrendPlayerMetadata,
  normalizeTrendPositions,
  normalizeTrendTeamAbbreviation
} from "../../../../../lib/transactions/ownershipTrendMetadata";

function createMockRes() {
  return {
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, string | string[]>,
    setHeader(key: string, value: string | string[]) {
      this.headers[key] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    }
  } as any;
}

describe("ownership-trends data contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  });

  it("paginates beyond the 1000-row PostgREST cap with deterministic ranges", async () => {
    const rows = Array.from({ length: 1001 }, (_, index) => ({
      player_id: String(index + 1),
      season: 2025
    }));
    const ranges: Array<[number, number]> = [];
    const seasons: number[] = [];
    const supabase = {
      from(table: string) {
        expect(table).toBe("yahoo_players_with_normalized_history");
        return {
          from: 0,
          to: 0,
          select() {
            return this;
          },
          order() {
            return this;
          },
          range(from: number, to: number) {
            this.from = from;
            this.to = to;
            ranges.push([from, to]);
            return this;
          },
          eq(column: string, value: number) {
            expect(column).toBe("season");
            seasons.push(value);
            return this;
          },
          then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
            return Promise.resolve(
              resolve({ data: rows.slice(this.from, this.to + 1), error: null })
            );
          }
        };
      }
    };

    const result = await fetchYahooPlayerRows({
      supabase,
      select: "player_id,season",
      season: 2025
    });

    expect(result).toHaveLength(1001);
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999]
    ]);
    expect(seasons).toEqual([2025, 2025]);
  });

  it("treats Yahoo forward eligibility as C/LW/RW/F rather than exact F only", () => {
    expect(matchesPositionFilter("F", ["C", "LW"], [])).toBe(true);
    expect(matchesPositionFilter("F", null, ["RW"])).toBe(true);
    expect(matchesPositionFilter("F", ["D"], ["D"])).toBe(false);
    expect(matchesPositionFilter("D", ["D"], [])).toBe(true);
  });

  it("normalizes Yahoo object metadata without implicit object coercion", () => {
    const positions = normalizeTrendPositions([
      { position: "C" },
      { position: { code: "LW" } },
      { position: "C" },
      "RW"
    ]);

    expect(positions).toEqual(["C", "LW", "RW"]);
    expect(
      normalizeTrendTeamAbbreviation({ abbreviation: "tor" })
    ).toBe("TOR");
    expect(
      formatTrendPlayerMetadata({
        teamAbbrev: { code: "NJD" },
        eligiblePositions: [{ position: "G" }]
      }).label
    ).toBe("NJD · G");
    expect(positions.join(", ")).not.toContain("[object Object]");
  });

  it("derives freshness from the latest source timeline date rather than request time", () => {
    expect(
      latestOwnershipTimelineDate([
        { ownership_timeline: [{ date: "2026-03-12" }, { date: "2026-03-10" }] },
        { ownership_timeline: [{ date: "2026-03-14" }] }
      ])
    ).toBe("2026-03-14");
  });

  it("builds daily ADP timelines and treats earlier average picks as risers", () => {
    const timelines = buildAdpTimelines([
      {
        player_key: "477.p.1",
        captured_at: "2026-08-16T00:00:00Z",
        average_draft_pick: "100"
      },
      {
        player_key: "477.p.1",
        captured_at: "2026-08-19T00:00:00Z",
        average_draft_pick: "80"
      },
      {
        player_key: "477.p.1",
        captured_at: "2026-08-19T12:00:00Z",
        average_draft_pick: "79"
      },
      {
        player_key: "477.p.2",
        captured_at: "2026-08-19T00:00:00Z",
        average_draft_pick: 0
      }
    ]);

    expect(timelines.get("477.p.1")).toEqual([
      { date: "2026-08-16", value: 100 },
      { date: "2026-08-19", value: 79 }
    ]);
    expect(timelines.has("477.p.2")).toBe(false);
    expect(calculateTrendMovement("adp", 80, 100)).toEqual({
      delta: 20,
      deltaPct: 20
    });
    expect(calculateTrendMovement("adp", 120, 100)).toEqual({
      delta: -20,
      deltaPct: -20
    });
    expect(calculateTrendMovement("ownership", 52, 50)).toEqual({
      delta: 2,
      deltaPct: 2
    });
  });

  it.each([
    [
      "ownership trends",
      ownershipTrendsHandler,
      {},
      { success: false, error: "OWNERSHIP_TRENDS_UNAVAILABLE" }
    ],
    [
      "ownership snapshots",
      ownershipSnapshotsHandler,
      { playerIds: "8478402" },
      { success: false, error: "OWNERSHIP_SNAPSHOTS_UNAVAILABLE" }
    ]
  ])(
    "returns a stable public error when %s dependencies fail",
    async (_name, handler, query, expectedBody) => {
      const internalDetail =
        "private_relation failed with Bearer internal-service-token";
      createClientMock.mockReturnValue({
        from() {
          throw new Error(internalDetail);
        }
      });
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const res = createMockRes();

      await handler({ method: "GET", query } as any, res);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual(expectedBody);
      expect(JSON.stringify(res.body)).not.toContain(internalDetail);
      consoleError.mockRestore();
    }
  );
});
