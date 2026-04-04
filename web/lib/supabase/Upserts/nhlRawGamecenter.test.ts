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

function createTextResponse(payload: string) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => payload,
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

  it("falls back to NHL HTML TOI reports when finished-game JSON shiftcharts are empty", async () => {
    const pbp = {
      id: 2025020955,
      season: 20252026,
      gameDate: "2026-03-02",
      homeTeam: { id: 18, abbrev: "NSH" },
      awayTeam: { id: 17, abbrev: "DET" },
      rosterSpots: [
        {
          teamId: 17,
          playerId: 101,
          sweaterNumber: 8,
          firstName: { default: "Ben" },
          lastName: { default: "Chiarot" },
        },
        {
          teamId: 18,
          playerId: 202,
          sweaterNumber: 9,
          firstName: { default: "Filip" },
          lastName: { default: "Forsberg" },
        },
      ],
      plays: [],
    };
    const boxscore = { id: 2025020955, gameState: "OFF" };
    const landing = { gameState: "OFF" };
    const shiftcharts = { total: 0, data: [] };
    const visitorHtml = `
      <html><body>
        <table>
          <tr><td class="teamHeading + border">DETROIT RED WINGS</td></tr>
          <tr><td class="playerHeading + border" colspan="8">8 CHIAROT, BEN</td></tr>
          <tr>
            <td>Shift #</td><td>Per</td><td>Start of Shift</td><td>End of Shift</td><td>Duration</td><td>Event</td>
          </tr>
          <tr>
            <td>1</td><td>1</td><td>0:34 / 19:26</td><td>1:50 / 18:10</td><td>01:16</td><td>P</td>
          </tr>
          <tr>
            <td>Per</td><td>SHF</td><td>AVG</td><td>TOI</td><td>EV TOT</td><td>SH TOT</td>
          </tr>
        </table>
      </body></html>
    `;
    const homeHtml = `
      <html><body>
        <table>
          <tr><td class="teamHeading + border">NASHVILLE PREDATORS</td></tr>
          <tr><td class="playerHeading + border" colspan="8">9 FORSBERG, FILIP</td></tr>
          <tr>
            <td>Shift #</td><td>Per</td><td>Start of Shift</td><td>End of Shift</td><td>Duration</td><td>Event</td>
          </tr>
          <tr>
            <td>1</td><td>1</td><td>0:35 / 19:25</td><td>1:10 / 18:50</td><td>00:35</td><td>G</td>
          </tr>
          <tr>
            <td>TOT</td><td>1</td><td>00:35</td><td>00:35</td><td>00:35</td><td></td>
          </tr>
        </table>
      </body></html>
    `;

    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/play-by-play")) return Promise.resolve(createJsonResponse(pbp));
      if (url.includes("/boxscore")) return Promise.resolve(createJsonResponse(boxscore));
      if (url.includes("/landing")) return Promise.resolve(createJsonResponse(landing));
      if (url.includes("shiftcharts")) return Promise.resolve(createJsonResponse(shiftcharts));
      if (url.includes("/TV020955.HTM")) return Promise.resolve(createTextResponse(visitorHtml));
      if (url.includes("/TH020955.HTM")) return Promise.resolve(createTextResponse(homeHtml));
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const payload = await fetchNhlApiRawGamePayloads(2025020955, {
      retries: 1,
      retryDelayMs: 0,
      timeoutMs: 50,
    });

    expect(payload.payloads.shiftcharts.source).toBe("htmlreports");
    expect(payload.payloads.shiftcharts.total).toBe(2);
    expect(payload.payloads.shiftcharts.data).toEqual([
      expect.objectContaining({
        id: 1,
        playerId: 101,
        teamId: 17,
        teamAbbrev: "DET",
        teamName: "DETROIT RED WINGS",
        period: 1,
        shiftNumber: 1,
        startTime: "0:34",
        endTime: "1:50",
        duration: "01:16",
        eventDescription: "Penalty",
        eventDetails: "P",
      }),
      expect.objectContaining({
        id: 2,
        playerId: 202,
        teamId: 18,
        teamAbbrev: "NSH",
        teamName: "NASHVILLE PREDATORS",
        period: 1,
        shiftNumber: 1,
        startTime: "0:35",
        endTime: "1:10",
        duration: "00:35",
        eventDescription: "Goal",
        eventDetails: "G",
      }),
    ]);
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
