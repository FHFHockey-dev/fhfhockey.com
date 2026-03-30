import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchJsonWithRetry,
  fetchNhlApiRawGamePayloads,
  insertPayloadSnapshot,
  upsertInBatches,
} from "./nhlRawGamecenter.mjs";

function createJsonResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => payload,
  };
}

describe("nhlRawGamecenter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries transient fetch failures and succeeds on a later attempt", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(
        new Error(
          "TypeError: fetch failed\nCaused by: SocketError: other side closed (UND_ERR_SOCKET)"
        )
      )
      .mockResolvedValueOnce(createJsonResponse({ ok: true }));

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const payload = await fetchJsonWithRetry("https://example.com/test", {
      retries: 2,
      retryDelayMs: 0,
      timeoutMs: 50,
    });

    expect(payload).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns deterministic payload hashes for identical upstream payloads", async () => {
    const pbp = {
      id: 2025021103,
      season: 20252026,
      gameDate: "2026-03-21",
      homeTeam: { id: 28 },
      awayTeam: { id: 4 },
      rosterSpots: [],
      plays: [],
    };
    const boxscore = { id: 2025021103, gameState: "FINAL" };
    const landing = { summary: "done" };
    const shiftcharts = { total: 1, data: [{ id: 1, playerId: 99, duration: "0:30" }] };

    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/play-by-play")) return Promise.resolve(createJsonResponse(pbp));
      if (url.includes("/boxscore")) return Promise.resolve(createJsonResponse(boxscore));
      if (url.includes("/landing")) return Promise.resolve(createJsonResponse(landing));
      if (url.includes("shiftcharts")) return Promise.resolve(createJsonResponse(shiftcharts));
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const first = await fetchNhlApiRawGamePayloads(2025021103, {
      retries: 1,
      retryDelayMs: 0,
      timeoutMs: 50,
    });
    const second = await fetchNhlApiRawGamePayloads(2025021103, {
      retries: 1,
      retryDelayMs: 0,
      timeoutMs: 50,
    });

    expect(first.hashes).toEqual(second.hashes);
    expect(first.hashes.playByPlay).toHaveLength(64);
    expect(first.hashes.shiftcharts).toHaveLength(64);
    expect(first.urls.playByPlay).toContain("/play-by-play");
    expect(first.urls.shiftcharts).toContain("shiftcharts");
  });

  it("upserts payload snapshots with an idempotent conflict target", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn(() => ({
        upsert: upsertMock,
      })),
    };

    await insertPayloadSnapshot(supabase as any, {
      game_id: 1,
      endpoint: "play-by-play",
      payload_hash: "abc",
    });

    expect(supabase.from).toHaveBeenCalledWith("nhl_api_game_payloads_raw");
    expect(upsertMock).toHaveBeenCalledWith(
      { game_id: 1, endpoint: "play-by-play", payload_hash: "abc" },
      {
        onConflict: "game_id,endpoint,payload_hash",
        ignoreDuplicates: true,
      }
    );
  });

  it("batches row upserts while preserving the conflict target", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn(() => ({
        upsert: upsertMock,
      })),
    };

    const rows = [
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
      { id: 5 },
    ];

    const count = await upsertInBatches(
      supabase as any,
      "nhl_api_pbp_events",
      rows,
      "game_id,event_id",
      2
    );

    expect(count).toBe(5);
    expect(upsertMock).toHaveBeenCalledTimes(3);
    expect(upsertMock).toHaveBeenNthCalledWith(1, [{ id: 1 }, { id: 2 }], {
      onConflict: "game_id,event_id",
    });
    expect(upsertMock).toHaveBeenNthCalledWith(2, [{ id: 3 }, { id: 4 }], {
      onConflict: "game_id,event_id",
    });
    expect(upsertMock).toHaveBeenNthCalledWith(3, [{ id: 5 }], {
      onConflict: "game_id,event_id",
    });
  });
});
