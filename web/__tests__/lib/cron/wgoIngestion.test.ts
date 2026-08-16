import { afterEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("lib/cors-fetch", () => ({ default: fetchMock }));

import {
  fetchAllWgoStatsPages,
  fetchCompletedWgoSeasonGameDates,
  mapWgoRowsByPlayerId,
  parseWgoSeasonId,
  resolveWgoGameIdentity,
} from "lib/cron/wgoIngestion";

describe("WGO ingestion integrity", () => {
  afterEach(() => vi.clearAllMocks());

  it("derives and validates season and game type from the NHL game ID", () => {
    expect(
      resolveWgoGameIdentity({
        row: { gameDate: "2026-01-01", gameId: 2025020001 },
        expectedDate: "2026-01-01",
        expectedSeasonId: 20252026,
        allowedGameTypes: [2],
        source: "summary",
      }),
    ).toEqual({
      gameDate: "2026-01-01",
      gameId: 2025020001,
      gameType: 2,
      seasonId: 20252026,
    });
  });

  it("rejects a season mismatch instead of persisting a mis-keyed row", () => {
    expect(() =>
      resolveWgoGameIdentity({
        row: { gameId: 2024020001 },
        expectedDate: "2026-01-01",
        expectedSeasonId: 20252026,
        allowedGameTypes: [2],
        source: "summary",
      }),
    ).toThrow("resolves to season 20242025, not 20252026");
  });

  it("fetches exactly the pages declared by the NHL response", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const start = Number(new URL(url).searchParams.get("start"));
      const rows = Array.from(
        { length: start === 0 ? 2 : 1 },
        (_, index) => start + index,
      );
      return {
        headers: { get: () => "application/json" },
        json: async () => ({ data: rows, total: 3 }),
        ok: true,
        status: 200,
        statusText: "OK",
      };
    });

    await expect(
      fetchAllWgoStatsPages<number>({
        buildUrl: (start) => `https://example.test/stats?start=${start}`,
        label: "test totals",
        pageSize: 2,
      }),
    ).resolves.toEqual([0, 1, 2]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("accepts only canonical consecutive-year season IDs", () => {
    expect(parseWgoSeasonId("20252026")).toBe(20252026);
    expect(parseWgoSeasonId("20252027")).toBeNull();
    expect(parseWgoSeasonId("20252026junk")).toBeNull();
  });

  it("rejects duplicate aggregate rows for one player", () => {
    expect(() =>
      mapWgoRowsByPlayerId(
        [{ playerId: 8477492 }, { playerId: 8477492 }],
        "totals",
      ),
    ).toThrow("duplicate player row 8477492");
  });

  it("returns only completed regular-season and playoff game dates", async () => {
    fetchMock.mockResolvedValue({
      headers: { get: () => "application/json" },
      json: async () => ({
        data: [
          {
            gameDate: "2026-01-01",
            gameStateId: 7,
            gameType: 2,
            id: 2025020001,
            season: 20252026,
          },
          {
            gameDate: "2026-05-01",
            gameStateId: 7,
            gameType: 3,
            id: 2025030001,
            season: 20252026,
          },
          {
            gameDate: "2026-05-02",
            gameStateId: 1,
            gameType: 3,
            id: 2025030002,
            season: 20252026,
          },
        ],
        total: 3,
      }),
      ok: true,
      status: 200,
      statusText: "OK",
    });

    await expect(
      fetchCompletedWgoSeasonGameDates({
        endDate: "2026-06-30",
        seasonId: 20252026,
        startDate: "2025-10-01",
      }),
    ).resolves.toEqual(["2026-01-01", "2026-05-01"]);
  });
});
