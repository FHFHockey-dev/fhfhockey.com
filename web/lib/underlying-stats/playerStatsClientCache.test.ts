import { describe, expect, it } from "vitest";

import {
  getPlayerStatsClientCachedResponse,
  isViewOnlyPlayerStatsRequestChange,
  setPlayerStatsClientCachedResponse,
  stripPlayerStatsViewParams,
} from "./playerStatsClientCache";

describe("playerStatsClientCache", () => {
  it("normalizes request paths by removing sort and pagination params only", () => {
    expect(
      stripPlayerStatsViewParams(
        "/api/v1/underlying-stats/players?strength=fiveOnFive&sortKey=xgfPct&sortDirection=desc&page=2&pageSize=50"
      )
    ).toBe("/api/v1/underlying-stats/players?strength=fiveOnFive");
  });

  it("treats sort and page changes as view-only request changes", () => {
    expect(
      isViewOnlyPlayerStatsRequestChange(
        "/api/v1/underlying-stats/players?strength=fiveOnFive&sortKey=xgfPct&sortDirection=desc&page=1&pageSize=50",
        "/api/v1/underlying-stats/players?strength=fiveOnFive&sortKey=cfPct&sortDirection=asc&page=3&pageSize=50"
      )
    ).toBe(true);

    expect(
      isViewOnlyPlayerStatsRequestChange(
        "/api/v1/underlying-stats/players?strength=fiveOnFive",
        "/api/v1/underlying-stats/players?strength=powerPlay"
      )
    ).toBe(false);
  });

  it("reads fresh cached responses from memory or session storage", () => {
    const memoryCache = new Map();
    const requestPath =
      "/api/v1/underlying-stats/players?strength=fiveOnFive&sortKey=xgfPct";
    const payload = {
      family: "onIceCounts",
      rows: [{ rowKey: "row:1" }],
    };

    setPlayerStatsClientCachedResponse({
      requestPath,
      storagePrefix: "landing",
      memoryCache,
      payload,
      now: 10_000,
    });

    expect(
      getPlayerStatsClientCachedResponse({
        requestPath,
        storagePrefix: "landing",
        memoryCache,
        ttlMs: 1_000,
        now: 10_500,
      })
    ).toEqual({
      payload,
      isFresh: true,
    });

    memoryCache.clear();

    expect(
      getPlayerStatsClientCachedResponse({
        requestPath,
        storagePrefix: "landing",
        memoryCache,
        ttlMs: 1_000,
        now: 12_500,
      })
    ).toEqual({
      payload,
      isFresh: false,
    });
  });
});
