import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn()
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock
}));

import ownershipSnapshotsHandler from "../../../../../pages/api/v1/transactions/ownership-snapshots";
import { fetchOwnershipContextMap } from "lib/dashboard/playerOwnership";
import { clearClientFetchCache } from "lib/dashboard/clientFetchCache";
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

describe("ownership snapshot provenance", () => {
  const request = (playerIds: string) => ({ method: "GET", query: { playerIds, season: "2026" } }) as any;
  function database(tables: Record<string, Array<Record<string, unknown>>>) {
    const reads: string[] = [];
    createClientMock.mockReturnValue({ from(table: string) {
      reads.push(table);
      let rows = tables[table] ?? [];
      const query = {
        select: () => query, order: () => query, range: () => query,
        in: (key: string, ids: unknown[]) => { rows = rows.filter(row => ids.map(String).includes(String(row[key]))); return query; },
        eq: (key: string, value: unknown) => { rows = rows.filter(row => row[key] === value); return query; },
        then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: rows.slice(0, 1000), count: rows.length, error: null }).then(resolve)
      };
      return query;
    } });
    return reads;
  }
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://unit-tests.supabase.invalid";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-service-role-key";
  });

  it.each([
    [0, 0], [44, 44], ["0", 0], ["44.5", 44.5], [null, null], [undefined, null],
    ["", null], ["   ", null], [false, null], [true, null], ["invalid", null],
    ["1e1", null], ["0x10", null], [[], null], [{}, null], [-1, null], [101, null], [Infinity, null]
  ])("keeps malformed ownership unknown and actual zero known (%j)", async (value, expected) => {
    database({ yahoo_nhl_player_map_read: [{ nhl_player_id: 12, yahoo_player_id: 112 }],
      yahoo_players_with_normalized_history: [{ player_id: "112", season: 2026, percent_ownership: value }] });
    const response = createMockRes();
    await ownershipSnapshotsHandler(request("12"), response);
    expect(response.statusCode).toBe(200);
    expect(response.body.players[0].ownership).toBe(expected);
  });

  it("keeps each last valid observation's own date rather than another player's or an invalid newer point", async () => {
    database({ yahoo_nhl_player_map_read: [{ nhl_player_id: 12, yahoo_player_id: 112 }, { nhl_player_id: 13, yahoo_player_id: 113 }],
      yahoo_players_with_normalized_history: [
        { player_id: "112", season: 2026, percent_ownership: 75, ownership_timeline: [{ date: "2026-10-18", value: 0 }, { date: "2026-10-22", value: "" }] },
        { player_id: "113", season: 2026, ownership_timeline: [{ date: "2026-10-21", value: "45" }] }
      ] });
    const response = createMockRes();
    await ownershipSnapshotsHandler(request("12,13"), response);
    expect(response.body.players).toEqual([
      { playerId: 12, ownership: 0, observedOn: "2026-10-18" },
      { playerId: 13, ownership: 45, observedOn: "2026-10-21" }
    ]);
    expect(response.body.sourceDate).toBe("2026-10-21");
  });

  it("does not equate an unresolved NHL id to a Yahoo id", async () => {
    const reads = database({ yahoo_players_with_normalized_history: [{ player_id: "12", season: 2026, percent_ownership: 99 }] });
    const response = createMockRes();
    await ownershipSnapshotsHandler(request("12"), response);
    expect(response.body.players).toEqual([{ playerId: 12, ownership: null, observedOn: null }]);
    expect(reads).not.toContain("yahoo_players_with_normalized_history");
  });

  it.each(["mapping", "name"])("does not choose one of conflicting %s identities", async mode => {
    database({ yahoo_nhl_player_map_read: mode === "mapping" ? [{ nhl_player_id: 12, yahoo_player_id: 112 }, { nhl_player_id: 12, yahoo_player_id: 113 }] : [],
      players: [{ id: 12, fullName: "Same Name" }],
      yahoo_players_with_normalized_history: [
        { player_id: "112", full_name: "Same Name", season: 2026, ownership_timeline: [{ date: "2026-10-20", value: 15 }] },
        { player_id: "113", full_name: "Same Name", season: 2026, ownership_timeline: [{ date: "2026-10-21", value: 85 }] }
      ] });
    const response = createMockRes();
    await ownershipSnapshotsHandler(request("12"), response);
    expect(response.body.players).toEqual([{ playerId: 12, ownership: null, observedOn: null, unavailableReason: "ambiguous_identity" }]);
  });

  it("fails closed on a truncated ownership response", async () => {
    database({ yahoo_nhl_player_map_read: [{ nhl_player_id: 12, yahoo_player_id: 112 }],
      yahoo_players_with_normalized_history: Array.from({ length: 1001 }, () => ({ player_id: "112", season: 2026, percent_ownership: 50 })) });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const response = createMockRes();
      await ownershipSnapshotsHandler(request("12"), response);
      expect(response.statusCode).toBe(500);
      expect(response.body).toEqual({ success: false, error: "OWNERSHIP_SNAPSHOTS_UNAVAILABLE" });
    } finally { log.mockRestore(); }
  });

  it("bounds the whole request before any database reads", async () => {
    const reads = database({});
    const response = createMockRes();
    await ownershipSnapshotsHandler(request(Array.from({ length: 501 }, (_, index) => index + 1).join(",")), response);
    expect(response.statusCode).toBe(400);
    expect(reads).toEqual([]);
  });

  it("deduplicates requests and retains an unambiguous name fallback without treating request time as source time", async () => {
    const reads = database({ players: [{ id: 12, fullName: "Only Match" }],
      yahoo_players_with_normalized_history: [{ player_id: "112", full_name: "Only Match", season: 2026,
        ownership_timeline: [{ date: "2026-10-18", value: 0 }] }] });
    const response = createMockRes();
    await ownershipSnapshotsHandler(request("12,12"), response);
    expect(response.statusCode).toBe(200);
    expect(response.body.players).toEqual([{ playerId: 12, ownership: 0, observedOn: "2026-10-18" }]);
    expect(reads).toHaveLength(4);
  });

  it("accepts the 500-player bound with one mapping and one ownership query", async () => {
    const ids = Array.from({ length: 500 }, (_, index) => index + 1);
    const reads = database({ yahoo_nhl_player_map_read: ids.map(id => ({ nhl_player_id: id, yahoo_player_id: id + 1000 })),
      yahoo_players_with_normalized_history: ids.map(id => ({ player_id: String(id + 1000), season: 2026,
        ownership_timeline: [{ date: "2026-10-21", value: 0 }] })) });
    const response = createMockRes();
    await ownershipSnapshotsHandler(request(ids.join(",")), response);
    expect(response.statusCode).toBe(200);
    expect(response.body.players).toHaveLength(500);
    expect(reads).toHaveLength(2);
    expect(response.body.players.every((row: any) => row.ownership === 0 && row.observedOn === "2026-10-21")).toBe(true);
  });

  it.each([true, false])("keeps identity authority through both real handlers and the client (ambiguous=%s)", async ambiguous => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
    clearClientFetchCache();
    database({ yahoo_nhl_player_map_read: [{ nhl_player_id: 12, yahoo_player_id: 112 },
      ...(ambiguous ? [{ nhl_player_id: 12, yahoo_player_id: 113 }] : [])],
      yahoo_players_with_normalized_history: [
        { player_key: "477.p.112", player_id: "112", season: 2026, ownership_timeline: [{ date: "2026-10-17", value: 50 }, { date: "2026-10-22", value: 60 }] },
        { player_key: "477.p.113", player_id: "113", season: 2026, ownership_timeline: [{ date: "2026-10-22", value: 20 }] }
      ] });
    const responses: Record<string, any> = {};
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "https://fixture.invalid");
      const response = createMockRes();
      const handler = url.pathname.endsWith("ownership-snapshots") ? ownershipSnapshotsHandler : ownershipTrendsHandler;
      await handler({ method: "GET", query: Object.fromEntries(url.searchParams) } as any, response);
      responses[url.pathname] = response.body;
      return { ok: response.statusCode === 200, status: response.statusCode, json: async () => response.body } as Response;
    }));
    try {
      const context = await fetchOwnershipContextMap([12], "2026-10-22");
      expect(responses["/api/v1/transactions/ownership-trends"].selectedPlayers).toHaveLength(1);
      expect(responses["/api/v1/transactions/ownership-trends"].selectedPlayers[0]).toMatchObject({ playerId: 12, latest: 60, delta: 10 });
      expect(responses["/api/v1/transactions/ownership-snapshots"].players[0].ownership).toBe(ambiguous ? null : 60);
      expect(context[12].ownership).toBe(ambiguous ? null : 60);
      expect(context[12].delta).toBe(ambiguous ? null : 10);
      if (ambiguous) expect(context[12]).toMatchObject({ ownershipEvidence: null, unavailableReason: "ambiguous_identity", sparkline: [] });
    } finally {
      vi.useRealTimers(); vi.unstubAllGlobals(); clearClientFetchCache();
    }
  });
});
