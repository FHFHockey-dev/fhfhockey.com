import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-14T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("derives the Yahoo season from the fantasy-calendar year boundary", () => {
    expect(deriveYahooSeason("2026-03-14")).toBe(2025);
    expect(deriveYahooSeason("2025-08-27")).toBe(2025);
    expect(deriveYahooSeason("2025-07-01")).toBe(2024);
  });

  it("fetches current ownership snapshots keyed by player id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          success: true,
          players: [
            { playerId: 12, ownership: 44, observedOn: "2026-03-14" },
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
            players: [{ playerId: 12, ownership: 41, observedOn: "2026-03-14" }]
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

  it("preserves per-player source dates through caching, serialization and aging instead of refreshing them to fetch time", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => jsonResponse(String(input).includes("ownership-snapshots") ? {
      success: true, sourceDate: "2026-03-14", generatedAt: "2026-03-14T23:59:59.999Z",
      players: [{ playerId: 12, ownership: 0, observedOn: "2026-03-14" }, { playerId: 99, ownership: 70, observedOn: "2026-03-09" }]
    } : { success: true, selectedPlayers: [] }));
    vi.stubGlobal("fetch", fetch);
    const fresh = await fetchOwnershipContextMap([12, 99], "2026-03-14");
    expect(fresh[12]).toMatchObject({ ownership: 0, ownershipEvidence: { value: 0, observedOn: "2026-03-14", status: "fresh", provider: "yahoo" } });
    expect(fresh[99]).toMatchObject({ ownership: null, ownershipEvidence: { value: 70, observedOn: "2026-03-09", status: "stale" } });
    expect(JSON.parse(JSON.stringify(fresh))[99].ownershipEvidence.observedOn).toBe("2026-03-09");
    await fetchOwnershipContextMap([12, 99], "2026-03-14");
    expect(fetch).toHaveBeenCalledTimes(2);
    vi.setSystemTime(new Date("2026-03-18T12:00:00Z"));
    const aged = await fetchOwnershipContextMap([12, 99], "2026-03-14");
    expect(aged[12]).toMatchObject({ ownership: null, ownershipEvidence: { value: 0, observedOn: "2026-03-14", status: "stale" } });
    expect(await fetchOwnershipSnapshotMap([12, 99], "2026-03-14")).toEqual({ 12: null, 99: null });
  });

  it("does not let an older trend replace a fresher snapshot or attach its delta to the new value", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => jsonResponse(String(input).includes("ownership-snapshots") ? {
      success: true, players: [{ playerId: 12, ownership: 0, observedOn: "2026-03-14" }]
    } : { success: true, selectedPlayers: [{ playerId: 12, latest: 50, delta: 5, sparkline: [{ date: "2026-03-12", value: 50 }] }] })));
    expect((await fetchOwnershipContextMap([12], "2026-03-14"))[12]).toMatchObject({
      ownership: 0, delta: null, ownershipEvidence: { value: 0, observedOn: "2026-03-14", status: "fresh" }
    });
  });

  it("keeps undated, future and malformed ownership unknown without borrowing response-level freshness", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => jsonResponse(String(input).includes("ownership-snapshots") ? {
      success: true, sourceDate: "2026-03-14", players: [
        { playerId: 12, ownership: 40 }, { playerId: 13, ownership: 20, observedOn: "2026-03-15" },
        { playerId: 14, ownership: 101, observedOn: "2026-03-14" }, { playerId: 99, ownership: 0, observedOn: "2026-03-14" }
      ]
    } : { success: true, selectedPlayers: [] })));
    const map = await fetchOwnershipContextMap([12, 13, 14, 15], "2026-03-14");
    expect(Object.values(map).map(row => row.ownership)).toEqual([null, null, null, null]);
    expect(map).not.toHaveProperty("99");
  });

  it("keeps a missing trend value unknown even when its sparkline is empty", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ success: true, selectedPlayers: [{ playerId: 12, delta: 4, sparkline: [] }] })));
    expect((await fetchOwnershipTrendMap([12], "2026-03-14"))[12]).toEqual({ ownership: null, ownershipEvidence: null, delta: null, sparkline: [] });
  });

  it("rejects failed envelopes and conflicting duplicate observations instead of turning them into current ownership", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ success: false, players: [{ playerId: 12, ownership: 0, observedOn: "2026-03-14" }] }))
      .mockResolvedValueOnce(jsonResponse({ success: true, players: [{ playerId: 12, ownership: 0, observedOn: "2026-03-14" }, { playerId: 12, ownership: 80, observedOn: "2026-03-14" }] }));
    vi.stubGlobal("fetch", fetch);
    await expect(fetchOwnershipSnapshotMap([12], "2026-03-14")).rejects.toThrow("Ownership is unavailable.");
    clearClientFetchCache();
    expect(await fetchOwnershipSnapshotMap([12], "2026-03-14")).toEqual({ 12: null });
  });
});
