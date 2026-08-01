import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayByPlayPayload } from "lib/supabase/Upserts/nhlRawGamecenter.mjs";

import {
  buildNormalizedGameScope,
  fetchJsonWithRetry,
  fetchNhlApiRawGamePayloads,
  ingestNhlApiRawGame,
  insertPayloadSnapshot,
  NORMALIZATION_PARSER_FINGERPRINT,
  persistNormalizedGameScope,
  readNormalizedGameManifest,
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

function createEmptyNormalizedScope(gameId = 1) {
  return {
    gameId,
    seasonId: 20252026,
    gameDate: "2026-03-21",
    pbpPayloadHash: "a".repeat(64),
    shiftPayloadHash: "b".repeat(64),
    parserFingerprint: NORMALIZATION_PARSER_FINGERPRINT,
    parserVersion: 1,
    strengthVersion: 1,
    materializerVersion: "nhl-gamecenter-normalizer-v1",
    rosterRows: [],
    eventRows: [],
    shiftRows: [],
  };
}

function createNormalizationReceiptRow(args: {
  scope: ReturnType<typeof createEmptyNormalizedScope>;
  normalizationVersion: number;
  normalizationFingerprint: string;
  idempotent: boolean;
}) {
  return {
    game_id: args.scope.gameId,
    normalization_status: "complete",
    normalization_version: args.normalizationVersion,
    normalization_fingerprint: args.normalizationFingerprint,
    source_fingerprint: "e".repeat(64),
    parser_fingerprint: args.scope.parserFingerprint,
    pbp_raw_payload_id: 1,
    pbp_raw_snapshot_version: 1,
    pbp_raw_payload_hash: args.scope.pbpPayloadHash,
    shift_raw_payload_id: 2,
    shift_raw_snapshot_version: 1,
    shift_raw_payload_hash: args.scope.shiftPayloadHash,
    expected_roster_rows: 0,
    observed_roster_rows: 0,
    expected_event_rows: 0,
    observed_event_rows: 0,
    expected_shift_rows: 0,
    observed_shift_rows: 0,
    pruned_roster_rows: 0,
    pruned_event_rows: 0,
    pruned_shift_rows: 0,
    idempotent: args.idempotent,
    completed_at: "2026-07-21T20:00:00.000Z",
  };
}

describe("nhlRawGamecenter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps known nested play-by-play payload fields type-safe", () => {
    const payload: PlayByPlayPayload = {
      id: 2025020001,
      season: 20252026,
      gameDate: "2026-01-01",
      homeTeam: { id: 1, abbrev: "HOM" },
      awayTeam: { id: 2, abbrev: "AWY" },
      rosterSpots: [
        {
          teamId: 1,
          playerId: 10,
          firstName: { default: "Home" },
          lastName: { default: "Player" },
        },
      ],
      plays: [
        {
          eventId: 100,
          periodDescriptor: { number: 1, periodType: "REG" },
          details: { eventOwnerTeamId: 1, shootingPlayerId: 10 },
        },
      ],
    };

    expect(payload.homeTeam.abbrev).toBe("HOM");
    expect(payload.rosterSpots[0]?.firstName?.default).toBe("Home");
    expect(payload.plays[0]?.details?.shootingPlayerId).toBe(10);
  });

  it("retries transient fetch failures and succeeds on a later attempt", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(
        new Error(
          "TypeError: fetch failed\nCaused by: SocketError: other side closed (UND_ERR_SOCKET)",
        ),
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
    const shiftcharts = {
      total: 1,
      data: [{ id: 1, playerId: 99, duration: "0:30" }],
    };

    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/play-by-play"))
        return Promise.resolve(createJsonResponse(pbp));
      if (url.includes("/boxscore"))
        return Promise.resolve(createJsonResponse(boxscore));
      if (url.includes("/landing"))
        return Promise.resolve(createJsonResponse(landing));
      if (url.includes("shiftcharts"))
        return Promise.resolve(createJsonResponse(shiftcharts));
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
      if (url.includes("/play-by-play"))
        return Promise.resolve(createJsonResponse(pbp));
      if (url.includes("/boxscore"))
        return Promise.resolve(createJsonResponse(boxscore));
      if (url.includes("/landing"))
        return Promise.resolve(createJsonResponse(landing));
      if (url.includes("shiftcharts"))
        return Promise.resolve(createJsonResponse(shiftcharts));
      if (url.includes("/TV020955.HTM"))
        return Promise.resolve(createTextResponse(visitorHtml));
      if (url.includes("/TH020955.HTM"))
        return Promise.resolve(createTextResponse(homeHtml));
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

    const row = {
      game_id: 1,
      endpoint: "play-by-play",
      payload_hash: "abc",
      payload: {},
      source_url: "https://example.com/play-by-play",
    };

    await insertPayloadSnapshot(supabase as any, row);

    expect(supabase.from).toHaveBeenCalledWith("nhl_api_game_payloads_raw");
    expect(upsertMock).toHaveBeenCalledWith(row, {
      onConflict: "game_id,endpoint,payload_hash",
      ignoreDuplicates: true,
    });
  });

  it("batches row upserts while preserving the conflict target", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn(() => ({
        upsert: upsertMock,
      })),
    };

    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];

    const count = await upsertInBatches(
      supabase as any,
      "nhl_api_pbp_events",
      rows,
      "game_id,event_id",
      2,
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

  it("builds deterministic timestamp-free normalized scopes", () => {
    const pbpPayloadHash = "a".repeat(64);
    const shiftPayloadHash = "b".repeat(64);
    const scope = buildNormalizedGameScope({
      gameId: 2025021103,
      seasonId: 20252026,
      gameDate: "2026-03-21",
      pbpPayloadHash,
      shiftPayloadHash,
      rosterRows: [
        {
          game_id: 2025021103,
          season_id: 20252026,
          game_date: "2026-03-21",
          player_id: 2,
          team_id: 28,
          source_play_by_play_hash: pbpPayloadHash,
          parser_version: 1,
          created_at: "volatile",
        },
        {
          game_id: 2025021103,
          season_id: 20252026,
          game_date: "2026-03-21",
          player_id: 1,
          team_id: 4,
          source_play_by_play_hash: pbpPayloadHash,
          parser_version: 1,
          updated_at: "volatile",
        },
      ],
      eventRows: [
        {
          game_id: 2025021103,
          season_id: 20252026,
          game_date: "2026-03-21",
          event_id: 11,
          source_play_by_play_hash: pbpPayloadHash,
          parser_version: 1,
          strength_version: 1,
        },
        {
          game_id: 2025021103,
          season_id: 20252026,
          game_date: "2026-03-21",
          event_id: 9,
          source_play_by_play_hash: pbpPayloadHash,
          parser_version: 1,
          strength_version: 1,
        },
      ],
      shiftRows: [
        {
          game_id: 2025021103,
          season_id: 20252026,
          game_date: "2026-03-21",
          shift_id: 10,
          player_id: 2,
          team_id: 28,
          source_shiftcharts_hash: shiftPayloadHash,
          parser_version: 1,
        },
        {
          game_id: 2025021103,
          season_id: 20252026,
          game_date: "2026-03-21",
          shift_id: 7,
          player_id: 1,
          team_id: 4,
          source_shiftcharts_hash: shiftPayloadHash,
          parser_version: 1,
        },
      ],
    });

    expect(scope.parserFingerprint).toBe(NORMALIZATION_PARSER_FINGERPRINT);
    expect(scope.rosterRows.map((row: any) => row.player_id)).toEqual([1, 2]);
    expect(scope.eventRows.map((row: any) => row.event_id)).toEqual([9, 11]);
    expect(scope.shiftRows.map((row: any) => row.shift_id)).toEqual([7, 10]);
    for (const row of scope.rosterRows) {
      expect(row).not.toHaveProperty("created_at");
      expect(row).not.toHaveProperty("updated_at");
    }
  });

  it("rejects duplicate identities and rows outside the requested scope", () => {
    const base = {
      gameId: 2025021103,
      seasonId: 20252026,
      gameDate: "2026-03-21",
      pbpPayloadHash: "a".repeat(64),
      shiftPayloadHash: "b".repeat(64),
      eventRows: [],
      shiftRows: [],
    };
    const rosterRow = {
      game_id: base.gameId,
      season_id: base.seasonId,
      game_date: base.gameDate,
      player_id: 1,
      team_id: 4,
      source_play_by_play_hash: base.pbpPayloadHash,
      parser_version: 1,
    };

    expect(() =>
      buildNormalizedGameScope({
        ...base,
        rosterRows: [rosterRow, { ...rosterRow }],
      }),
    ).toThrow("invalid or duplicate identity");
    expect(() =>
      buildNormalizedGameScope({
        ...base,
        rosterRows: [{ ...rosterRow, game_id: base.gameId + 1 }],
      }),
    ).toThrow("roster scope is inconsistent");
  });

  it("reads the exact current normalization CAS identity", async () => {
    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        normalization_fingerprint: "c".repeat(64),
        normalization_version: 4,
      },
      error: null,
    });
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      maybeSingle: maybeSingleMock,
    };
    const supabase = { from: vi.fn(() => chain) };

    await expect(
      readNormalizedGameManifest(supabase as any, 2025021103),
    ).resolves.toEqual({
      normalizationFingerprint: "c".repeat(64),
      normalizationVersion: 4,
    });
    expect(supabase.from).toHaveBeenCalledWith(
      "nhl_api_game_normalization_status",
    );
    expect(chain.eq).toHaveBeenCalledWith("game_id", 2025021103);
  });

  it("returns null only for an absent manifest and rejects query or shape failures", async () => {
    const createClient = (result: unknown) => {
      const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        maybeSingle: vi.fn().mockResolvedValue(result),
      };
      return { from: vi.fn(() => chain) };
    };

    await expect(
      readNormalizedGameManifest(
        createClient({ data: null, error: null }) as any,
        2025021103,
      ),
    ).resolves.toBeNull();
    await expect(
      readNormalizedGameManifest(
        createClient({ data: null, error: { message: "query failed" } }) as any,
        2025021103,
      ),
    ).rejects.toThrow("query failed");
    await expect(
      readNormalizedGameManifest(
        createClient({
          data: {
            normalization_fingerprint: "invalid",
            normalization_version: 0,
          },
          error: null,
        }) as any,
        2025021103,
      ),
    ).rejects.toThrow("manifest is invalid");
  });

  it("validates physically idempotent normalization receipts", async () => {
    const scope = {
      gameId: 2025021103,
      seasonId: 20252026,
      gameDate: "2026-03-21",
      pbpPayloadHash: "a".repeat(64),
      shiftPayloadHash: "b".repeat(64),
      parserFingerprint: NORMALIZATION_PARSER_FINGERPRINT,
      parserVersion: 1,
      strengthVersion: 1,
      materializerVersion: "nhl-gamecenter-normalizer-v1",
      rosterRows: [{ player_id: 1 }],
      eventRows: [{ event_id: 2 }],
      shiftRows: [{ shift_id: 3 }],
    };
    const expectedCurrentManifest = {
      normalizationFingerprint: "d".repeat(64),
      normalizationVersion: 7,
    };
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          game_id: scope.gameId,
          normalization_status: "complete",
          normalization_version: 7,
          normalization_fingerprint:
            expectedCurrentManifest.normalizationFingerprint,
          source_fingerprint: "e".repeat(64),
          parser_fingerprint: scope.parserFingerprint,
          pbp_raw_payload_id: 11,
          pbp_raw_snapshot_version: 3,
          pbp_raw_payload_hash: scope.pbpPayloadHash,
          shift_raw_payload_id: 12,
          shift_raw_snapshot_version: 4,
          shift_raw_payload_hash: scope.shiftPayloadHash,
          expected_roster_rows: 1,
          observed_roster_rows: 1,
          expected_event_rows: 1,
          observed_event_rows: 1,
          expected_shift_rows: 1,
          observed_shift_rows: 1,
          pruned_roster_rows: 0,
          pruned_event_rows: 0,
          pruned_shift_rows: 0,
          idempotent: true,
          completed_at: "2026-07-21T20:00:00.000Z",
        },
      ],
      error: null,
    });

    await expect(
      persistNormalizedGameScope(
        { rpc } as any,
        scope,
        expectedCurrentManifest,
      ),
    ).resolves.toMatchObject({
      normalizationVersion: 7,
      normalizationFingerprint:
        expectedCurrentManifest.normalizationFingerprint,
      idempotent: true,
    });
    expect(rpc).toHaveBeenCalledWith(
      "persist_nhl_api_gamecenter_normalized_v1",
      expect.objectContaining({
        p_expected_current_fingerprint:
          expectedCurrentManifest.normalizationFingerprint,
        p_expected_current_version: 7,
        p_expected_roster_rows: 1,
        p_expected_event_rows: 1,
        p_expected_shift_rows: 1,
      }),
    );
  });

  it("rejects a receipt that falsely advances an idempotent replay", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          game_id: 1,
          normalization_status: "complete",
          normalization_version: 3,
          normalization_fingerprint: "d".repeat(64),
          source_fingerprint: "e".repeat(64),
          parser_fingerprint: NORMALIZATION_PARSER_FINGERPRINT,
          pbp_raw_payload_id: 1,
          pbp_raw_snapshot_version: 1,
          pbp_raw_payload_hash: "a".repeat(64),
          shift_raw_payload_id: 2,
          shift_raw_snapshot_version: 1,
          shift_raw_payload_hash: "b".repeat(64),
          expected_roster_rows: 0,
          observed_roster_rows: 0,
          expected_event_rows: 0,
          observed_event_rows: 0,
          expected_shift_rows: 0,
          observed_shift_rows: 0,
          pruned_roster_rows: 0,
          pruned_event_rows: 0,
          pruned_shift_rows: 0,
          idempotent: true,
          completed_at: "2026-07-21T20:00:00.000Z",
        },
      ],
      error: null,
    });

    await expect(
      persistNormalizedGameScope(
        { rpc } as any,
        {
          gameId: 1,
          seasonId: 20252026,
          gameDate: "2026-03-21",
          pbpPayloadHash: "a".repeat(64),
          shiftPayloadHash: "b".repeat(64),
          parserFingerprint: NORMALIZATION_PARSER_FINGERPRINT,
          parserVersion: 1,
          strengthVersion: 1,
          materializerVersion: "nhl-gamecenter-normalizer-v1",
          rosterRows: [],
          eventRows: [],
          shiftRows: [],
        },
        {
          normalizationFingerprint: "d".repeat(64),
          normalizationVersion: 2,
        },
      ),
    ).rejects.toThrow("invalid receipt");
  });

  it("accepts only an exact one-version advance for a changed existing manifest", async () => {
    const scope = createEmptyNormalizedScope();
    const expectedCurrentManifest = {
      normalizationFingerprint: "d".repeat(64),
      normalizationVersion: 5,
    };
    const rpc = vi.fn().mockResolvedValue({
      data: [
        createNormalizationReceiptRow({
          scope,
          normalizationVersion: 6,
          normalizationFingerprint: "c".repeat(64),
          idempotent: false,
        }),
      ],
      error: null,
    });

    await expect(
      persistNormalizedGameScope(
        { rpc } as any,
        scope,
        expectedCurrentManifest,
      ),
    ).resolves.toMatchObject({ normalizationVersion: 6, idempotent: false });

    rpc.mockResolvedValue({
      data: [
        createNormalizationReceiptRow({
          scope,
          normalizationVersion: 7,
          normalizationFingerprint: "b".repeat(64),
          idempotent: false,
        }),
      ],
      error: null,
    });
    await expect(
      persistNormalizedGameScope(
        { rpc } as any,
        scope,
        expectedCurrentManifest,
      ),
    ).rejects.toThrow("invalid receipt");
  });

  it("rejects a malformed RPC result before reading receipt fields", async () => {
    await expect(
      persistNormalizedGameScope(
        { rpc: vi.fn().mockResolvedValue(null) } as any,
        {
          gameId: 1,
          seasonId: 20252026,
          gameDate: "2026-03-21",
          pbpPayloadHash: "a".repeat(64),
          shiftPayloadHash: "b".repeat(64),
          parserFingerprint: NORMALIZATION_PARSER_FINGERPRINT,
          parserVersion: 1,
          strengthVersion: 1,
          materializerVersion: "nhl-gamecenter-normalizer-v1",
          rosterRows: [],
          eventRows: [],
          shiftRows: [],
        },
        null,
      ),
    ).rejects.toThrow("invalid result");
  });

  it("normalizes RPC throws/errors and rejects zero or multiple receipts", async () => {
    const scope = createEmptyNormalizedScope();
    const expected = null;

    await expect(
      persistNormalizedGameScope(
        {
          rpc: vi.fn().mockRejectedValue(new Error("transport failed")),
        } as any,
        scope,
        expected,
      ),
    ).rejects.toThrow("transport failed");
    await expect(
      persistNormalizedGameScope(
        {
          rpc: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "RPC denied" },
          }),
        } as any,
        scope,
        expected,
      ),
    ).rejects.toThrow("RPC denied");
    for (const data of [[], [{}, {}]]) {
      await expect(
        persistNormalizedGameScope(
          { rpc: vi.fn().mockResolvedValue({ data, error: null }) } as any,
          scope,
          expected,
        ),
      ).rejects.toThrow("exactly one receipt");
    }
  });

  it("ingests raw snapshots and publishes normalized rows through one RPC", async () => {
    const gameId = 2025021103;
    const pbp = {
      id: gameId,
      season: 20252026,
      gameDate: "2026-03-21",
      homeTeam: { id: 28 },
      awayTeam: { id: 4 },
      rosterSpots: [
        {
          teamId: 28,
          playerId: 99,
          firstName: { default: "Test" },
          lastName: { default: "Player" },
        },
      ],
      plays: [
        {
          eventId: 7,
          sortOrder: 1,
          typeDescKey: "game-start",
          details: {},
        },
      ],
    };
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/play-by-play")) {
        return Promise.resolve(createJsonResponse(pbp));
      }
      if (url.includes("/boxscore")) {
        return Promise.resolve(createJsonResponse({ id: gameId }));
      }
      if (url.includes("/landing")) {
        return Promise.resolve(
          createJsonResponse({ id: gameId, gameState: "OFF" }),
        );
      }
      if (url.includes("shiftcharts")) {
        return Promise.resolve(
          createJsonResponse({
            total: 1,
            data: [
              {
                id: 8,
                playerId: 99,
                teamId: 28,
                period: 1,
                startTime: "0:00",
                endTime: "0:30",
                duration: "0:30",
              },
            ],
          }),
        );
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const rawUpsert = vi.fn().mockResolvedValue({ error: null });
    const statusChain: any = {
      select: vi.fn(() => statusChain),
      eq: vi.fn(() => statusChain),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const from = vi.fn((table: string) => {
      if (table === "nhl_api_game_payloads_raw") {
        return { upsert: rawUpsert };
      }
      if (table === "nhl_api_game_normalization_status") {
        return statusChain;
      }
      throw new Error(`Unexpected direct normalized table write: ${table}`);
    });
    const rpc = vi.fn(async (_name: string, args: any) => ({
      data: [
        {
          game_id: gameId,
          normalization_status: "complete",
          normalization_version: 1,
          normalization_fingerprint: "c".repeat(64),
          source_fingerprint: "d".repeat(64),
          parser_fingerprint: args.p_parser_fingerprint,
          pbp_raw_payload_id: 10,
          pbp_raw_snapshot_version: 1,
          pbp_raw_payload_hash: args.p_expected_pbp_payload_hash,
          shift_raw_payload_id: 11,
          shift_raw_snapshot_version: 1,
          shift_raw_payload_hash: args.p_expected_shift_payload_hash,
          expected_roster_rows: 1,
          observed_roster_rows: 1,
          expected_event_rows: 1,
          observed_event_rows: 1,
          expected_shift_rows: 1,
          observed_shift_rows: 1,
          pruned_roster_rows: 0,
          pruned_event_rows: 0,
          pruned_shift_rows: 0,
          idempotent: false,
          completed_at: "2026-07-21T20:00:00.000Z",
        },
      ],
      error: null,
    }));

    await expect(
      ingestNhlApiRawGame({ from, rpc } as any, gameId),
    ).resolves.toMatchObject({
      gameId,
      rosterCount: 1,
      eventCount: 1,
      shiftCount: 1,
      rawEndpointsStored: 4,
      normalizationVersion: 1,
      idempotent: false,
    });
    expect(rawUpsert).toHaveBeenCalledTimes(4);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rawUpsert.mock.invocationCallOrder[3]).toBeLessThan(
      statusChain.maybeSingle.mock.invocationCallOrder[0],
    );
    expect(rawUpsert.mock.invocationCallOrder[3]).toBeLessThan(
      rpc.mock.invocationCallOrder[0],
    );
    expect(statusChain.maybeSingle.mock.invocationCallOrder[0]).toBeLessThan(
      rpc.mock.invocationCallOrder[0],
    );
    expect(rpc).toHaveBeenCalledWith(
      "persist_nhl_api_gamecenter_normalized_v1",
      expect.objectContaining({
        p_expected_current_fingerprint: null,
        p_expected_current_version: null,
        p_expected_roster_rows: 1,
        p_expected_event_rows: 1,
        p_expected_shift_rows: 1,
      }),
    );
    expect(from).not.toHaveBeenCalledWith("nhl_api_game_roster_spots");
    expect(from).not.toHaveBeenCalledWith("nhl_api_pbp_events");
    expect(from).not.toHaveBeenCalledWith("nhl_api_shift_rows");
  });
});
