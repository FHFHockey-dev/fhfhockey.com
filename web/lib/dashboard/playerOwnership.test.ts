import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearClientFetchCache } from "./clientFetchCache";
import {
  deriveYahooSeason,
  fetchOwnershipContextMap,
  fetchOwnershipSnapshotMap,
  fetchOwnershipTrendMap
} from "./playerOwnership";

function jsonResponse(data: unknown, ok = true, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    json: async () => data
  } as Response;
}

describe("playerOwnership", () => {
  beforeEach(() => {
    clearClientFetchCache();
    vi.restoreAllMocks();
  });

  it("derives the Yahoo season from the fantasy-calendar year boundary", () => {
    expect(deriveYahooSeason("2026-03-14")).toBe(2026);
    expect(deriveYahooSeason("2025-08-27")).toBe(2026);
    expect(deriveYahooSeason("2025-07-01")).toBe(2025);
  });

  it("fetches current ownership snapshots keyed by player id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          success: true,
          players: [
            { playerId: 12, ownership: 44 },
            { playerId: 99, ownership: null }
          ]
        })
      )
    );

    const snapshotMap = await fetchOwnershipSnapshotMap([12, 99], "2026-03-14");

    expect(snapshotMap).toEqual({
      12: 44,
      99: null
    });
  });

  it("fetches ownership trend context keyed by player id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/transactions/ownership-snapshots")) {
          return jsonResponse({
            success: true,
            players: [{ playerId: 12, ownership: 41 }]
          });
        }
        return jsonResponse({
          success: true,
          selectedPlayers: [
            {
              playerId: 12,
              latest: 41,
              delta: 6,
              sparkline: [
                { date: "2026-03-10", value: 35 },
                { date: "2026-03-14", value: 41 }
              ]
            }
          ]
        });
      })
    );

    const trendMap = await fetchOwnershipTrendMap([12], "2026-03-14", 5);
    const contextMap = await fetchOwnershipContextMap([12], "2026-03-14", 5);

    expect(trendMap[12]).toMatchObject({
      ownership: 41,
      delta: 6
    });
    expect(contextMap[12]).toMatchObject({
      ownership: 41,
      delta: 6
    });
    expect(contextMap[12].sparkline).toHaveLength(2);
  });
});
