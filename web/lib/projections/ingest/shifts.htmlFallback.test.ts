import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("lib/supabase/server", () => ({ default: { from: vi.fn() } }));

import { fetchNhlApiRawGamePayloads } from "lib/supabase/Upserts/nhlRawGamecenter.mjs";

import {
  buildProjectionInputRpcPayload,
  buildProjectionShiftSourceHash,
} from "./projectionInputPersistence";
import {
  captureProjectionRawSourceSnapshots,
  hashProjectionRawJson,
} from "./rawSnapshotPersistence";
import { fetchAllNhleShiftChartsSnapshotForGame } from "./shifts";

const GAME_ID = 2026020010;

function finalPbp(overrides: Record<string, unknown> = {}) {
  return {
    id: GAME_ID,
    season: 20262027,
    gameType: 2,
    gameState: "OFF",
    gameDate: "2026-10-02",
    startTimeUTC: "2026-10-02T23:00:00Z",
    homeTeam: { id: 18, abbrev: "NSH", commonName: { default: "Predators" }, score: 2 },
    awayTeam: { id: 17, abbrev: "DET", commonName: { default: "Red Wings" }, score: 1 },
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
    plays: [
      { eventId: 1, typeDescKey: "faceoff" },
      { eventId: 2, typeDescKey: "game-end" },
    ],
    ...overrides,
  };
}

function report(team: string, heading: string, shifts: string[][]) {
  return `<html><body><table>
    <tr><td class="teamHeading + border">${team}</td></tr>
    <tr><td class="playerHeading + border" colspan="8">${heading}</td></tr>
    <tr><td>Shift #</td><td>Per</td><td>Start of Shift</td><td>End of Shift</td><td>Duration</td><td>Event</td></tr>
    ${shifts.map((cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("\n")}
    <tr><td>TOT</td><td>2</td><td>01:51</td><td>00:56</td><td>00:56</td><td></td></tr>
  </table></body></html>`;
}

const VISITOR_HTML = report("DETROIT RED WINGS", "8 CHIAROT, BEN", [
  ["1", "1", "0:34 / 19:26", "1:50 / 18:10", "01:16", "P"],
  ["2", "1", "5:02 / 14:58", "5:37 / 14:23", "00:35", ""],
]);
const HOME_HTML = report("NASHVILLE PREDATORS", "9 FORSBERG, FILIP", [
  ["1", "1", "0:35 / 19:25", "1:10 / 18:50", "00:35", "G"],
]);

function stubNhl(args: {
  pbp?: Record<string, unknown>;
  jsonShifts?: unknown[];
  visitorHtml?: string | null;
  homeHtml?: string | null;
}) {
  const pbp = args.pbp ?? finalPbp();
  const jsonShifts = args.jsonShifts ?? [];
  const fetchMock = vi.fn(async (url: string) => {
    const json = (body: unknown) => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => body,
      text: async () => JSON.stringify(body),
    });
    const text = (body: string) => ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => body,
    });
    if (url.includes("/play-by-play")) return json(pbp);
    if (url.includes("/boxscore")) return json({ id: GAME_ID });
    if (url.includes("/landing")) return json({ gameState: pbp.gameState });
    if (url.includes("shiftcharts")) {
      return json({ total: jsonShifts.length, data: jsonShifts });
    }
    const html = url.endsWith("/TV020010.HTM")
      ? args.visitorHtml
      : url.endsWith("/TH020010.HTM")
        ? args.homeHtml
        : undefined;
    if (html === undefined) throw new Error(`Unexpected URL: ${url}`);
    if (html === null) {
      return { ok: false, status: 404, statusText: "Not Found" };
    }
    return text(html);
  });
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  return fetchMock;
}

const requestedUrls = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.map(([url]) => String(url));

describe("projection shift snapshot with the HTML fallback flag off (default)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps an empty final JSON feed empty without requesting PBP or HTML", async () => {
    const fetchMock = stubNhl({ visitorHtml: VISITOR_HTML, homeHtml: HOME_HTML });

    const snapshot = await fetchAllNhleShiftChartsSnapshotForGame(GAME_ID);

    expect(snapshot).toEqual({
      rows: [],
      rawPayload: { total: 0, data: [], source: "json-api" },
      source: "json-api",
      htmlFallbackError: null,
    });
    expect(requestedUrls(fetchMock)).toEqual([
      `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${GAME_ID}&start=0&limit=1000`,
    ]);
  });

  it("returns the JSON feed exactly as before when it has rows", async () => {
    const jsonRow = {
      gameId: GAME_ID,
      playerId: 101,
      teamId: 17,
      teamAbbrev: "DET",
      firstName: "Ben",
      lastName: "Chiarot",
      shiftNumber: 1,
      period: 1,
      startTime: "00:34",
      endTime: "01:50",
      duration: "01:16",
      typeCode: 517,
    };
    const fetchMock = stubNhl({ jsonShifts: [jsonRow, { ...jsonRow }] });

    const snapshot = await fetchAllNhleShiftChartsSnapshotForGame(GAME_ID);

    expect(snapshot.rows).toEqual([jsonRow]);
    expect(snapshot.rawPayload).toEqual({
      total: 2,
      data: [jsonRow, jsonRow],
      source: "json-api",
    });
    expect(requestedUrls(fetchMock)).toHaveLength(1);
  });
});

describe("projection shift snapshot HTML fallback", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("PROJECTION_SHIFT_HTML_FALLBACK_ENABLED", "true");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("maps HTML report rows to projection shift rows for an empty final JSON feed", async () => {
    const fetchMock = stubNhl({ visitorHtml: VISITOR_HTML, homeHtml: HOME_HTML });

    const snapshot = await fetchAllNhleShiftChartsSnapshotForGame(GAME_ID, {
      pbp: finalPbp() as any,
    });

    expect(snapshot.source).toBe("htmlreports");
    expect(snapshot.htmlFallbackError).toBeNull();
    expect(snapshot.rawPayload).toEqual(
      expect.objectContaining({
        source: "htmlreports",
        total: 3,
        upstream: { json: { total: 0, data: [] } },
        htmlReports: {
          visitorUrl: "https://www.nhl.com/scores/htmlreports/20262027/TV020010.HTM",
          homeUrl: "https://www.nhl.com/scores/htmlreports/20262027/TH020010.HTM",
        },
      }),
    );
    expect(
      snapshot.rows.map((row) => [
        row.gameId,
        row.playerId,
        row.teamId,
        row.teamAbbrev,
        row.shiftNumber,
        row.period,
        row.startTime,
        row.endTime,
        row.duration,
        row.typeCode,
      ]),
    ).toEqual([
      [GAME_ID, 101, 17, "DET", 1, 1, "00:34", "01:50", "01:16", 517],
      [GAME_ID, 101, 17, "DET", 2, 1, "05:02", "05:37", "00:35", 517],
      [GAME_ID, 202, 18, "NSH", 1, 1, "00:35", "01:10", "00:35", 517],
    ]);
    // The caller's PBP is reused; only the JSON feed and two reports are read.
    expect(requestedUrls(fetchMock).filter((url) => url.includes("/play-by-play"))).toEqual([]);
    expect(requestedUrls(fetchMock).filter((url) => url.endsWith(".HTM"))).toHaveLength(2);
  });

  it("requests no HTML report while the JSON feed has rows", async () => {
    const jsonRow = {
      gameId: GAME_ID,
      playerId: 101,
      teamId: 17,
      teamAbbrev: "DET",
      firstName: "Ben",
      lastName: "Chiarot",
      shiftNumber: 1,
      period: 1,
      startTime: "00:34",
      endTime: "01:50",
      duration: "01:16",
      typeCode: 517,
    };
    const fetchMock = stubNhl({ jsonShifts: [jsonRow] });

    const snapshot = await fetchAllNhleShiftChartsSnapshotForGame(GAME_ID);

    expect(snapshot.source).toBe("json-api");
    expect(snapshot.rawPayload).toEqual({ total: 1, data: [jsonRow], source: "json-api" });
    expect(requestedUrls(fetchMock).some((url) => url.endsWith(".HTM"))).toBe(false);
    expect(requestedUrls(fetchMock).some((url) => url.includes("/play-by-play"))).toBe(false);
  });

  it("does not fall back before the game is final", async () => {
    const live = finalPbp({ gameState: "LIVE" });
    const fetchMock = stubNhl({ pbp: live, visitorHtml: VISITOR_HTML, homeHtml: HOME_HTML });

    const snapshot = await fetchAllNhleShiftChartsSnapshotForGame(GAME_ID);

    expect(snapshot.rows).toEqual([]);
    expect(snapshot.rawPayload).toEqual({ total: 0, data: [], source: "json-api" });
    expect(snapshot.htmlFallbackError).toBe(
      `PBP is not final and complete for game ${GAME_ID}`,
    );
    expect(requestedUrls(fetchMock).some((url) => url.endsWith(".HTM"))).toBe(false);
  });

  it("keeps the shift source and raw hashes stable across fetches", async () => {
    stubNhl({ visitorHtml: VISITOR_HTML, homeHtml: HOME_HTML });
    const first = await fetchAllNhleShiftChartsSnapshotForGame(GAME_ID);
    const second = await fetchAllNhleShiftChartsSnapshotForGame(GAME_ID);

    expect(buildProjectionShiftSourceHash(second.rows)).toBe(
      buildProjectionShiftSourceHash(first.rows),
    );
    expect(hashProjectionRawJson(second.rawPayload)).toBe(
      hashProjectionRawJson(first.rawPayload),
    );
  });

  it("stores a raw payload byte-identical to the Gamecenter writer's", async () => {
    stubNhl({ visitorHtml: VISITOR_HTML, homeHtml: HOME_HTML });
    const snapshot = await fetchAllNhleShiftChartsSnapshotForGame(GAME_ID);
    const gamecenter = await fetchNhlApiRawGamePayloads(GAME_ID, {
      retries: 1,
      retryDelayMs: 0,
      timeoutMs: 50,
    });

    expect(JSON.stringify(snapshot.rawPayload)).toBe(
      JSON.stringify(gamecenter.payloads.shiftcharts),
    );
    expect(hashProjectionRawJson(snapshot.rawPayload)).toBe(
      gamecenter.hashes.shiftcharts,
    );
  });

  it.each([
    {
      name: "an ambiguous name match",
      rosterSpots: [
        { teamId: 17, playerId: 101, sweaterNumber: 4, firstName: { default: "Ben" }, lastName: { default: "Chiarot" } },
        { teamId: 17, playerId: 102, sweaterNumber: 5, firstName: { default: "Ben" }, lastName: { default: "Chiarot" } },
        { teamId: 18, playerId: 202, sweaterNumber: 9, firstName: { default: "Filip" }, lastName: { default: "Forsberg" } },
      ],
      reason: "matches several players",
    },
    {
      name: "a heading with no roster match",
      rosterSpots: [
        { teamId: 17, playerId: 103, sweaterNumber: 4, firstName: { default: "Alex" }, lastName: { default: "Other" } },
        { teamId: 18, playerId: 202, sweaterNumber: 9, firstName: { default: "Filip" }, lastName: { default: "Forsberg" } },
      ],
      reason: "matches no roster player",
    },
  ])("refuses $name strictly while the lenient Gamecenter writer guesses", async ({ rosterSpots, reason }) => {
    stubNhl({ pbp: finalPbp({ rosterSpots }), visitorHtml: VISITOR_HTML, homeHtml: HOME_HTML });

    const snapshot = await fetchAllNhleShiftChartsSnapshotForGame(GAME_ID);
    const gamecenter = await fetchNhlApiRawGamePayloads(GAME_ID, {
      retries: 1,
      retryDelayMs: 0,
      timeoutMs: 50,
    });

    expect(snapshot.rows).toEqual([]);
    expect(snapshot.source).toBe("json-api");
    expect(snapshot.htmlFallbackError).toContain(reason);
    expect(gamecenter.payloads.shiftcharts.source).toBe("htmlreports");
  });

  it("refuses when either team report is missing", async () => {
    stubNhl({ visitorHtml: VISITOR_HTML, homeHtml: null });

    const snapshot = await fetchAllNhleShiftChartsSnapshotForGame(GAME_ID);

    expect(snapshot.rows).toEqual([]);
    expect(snapshot.htmlFallbackError).toBe(
      `HTML shift reports are unavailable for game ${GAME_ID}`,
    );
  });

  it("gives ingest and shift-charts the same shift source hash", async () => {
    stubNhl({ visitorHtml: VISITOR_HTML, homeHtml: HOME_HTML });
    const pbp = finalPbp() as any;
    // Ingest reads the snapshot without a PBP; shift-charts passes its PBP.
    const ingestSnapshot = await fetchAllNhleShiftChartsSnapshotForGame(GAME_ID);
    const routeSnapshot = await fetchAllNhleShiftChartsSnapshotForGame(GAME_ID, { pbp });

    const ingestPayload = buildProjectionInputRpcPayload({
      gameId: GAME_ID,
      pbp,
      shiftSourceRows: ingestSnapshot.rows,
      strengthRows: [
        { game_id: GAME_ID, player_id: 101, total_es_toi: "01:51" } as any,
        { game_id: GAME_ID, player_id: 202, total_es_toi: "00:35" } as any,
      ],
      rawSnapshots: {
        gameId: GAME_ID,
        pbp: { rawPayloadId: 1, snapshotVersion: 1, payloadHash: "a".repeat(64) },
        shifts: {
          rawPayloadId: 2,
          snapshotVersion: 1,
          payloadHash: hashProjectionRawJson(ingestSnapshot.rawPayload),
        },
      },
      expectedCurrentInputFingerprint: null,
    });

    expect(ingestPayload.shiftSourceHash).toBe(
      buildProjectionShiftSourceHash(routeSnapshot.rows),
    );
  });

  it("lets the raw capture send an HTML envelope to the RPC", async () => {
    stubNhl({ visitorHtml: VISITOR_HTML, homeHtml: HOME_HTML });
    const snapshot = await fetchAllNhleShiftChartsSnapshotForGame(GAME_ID);
    const pbp = finalPbp();
    const shiftHash = hashProjectionRawJson(snapshot.rawPayload);
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          game_id: GAME_ID,
          pbp_raw_payload_id: 1,
          pbp_raw_snapshot_version: 1,
          pbp_raw_payload_hash: hashProjectionRawJson(pbp),
          shift_raw_payload_id: 2,
          shift_raw_snapshot_version: 1,
          shift_raw_payload_hash: shiftHash,
        },
      ],
      error: null,
    });

    await captureProjectionRawSourceSnapshots({
      supabase: { rpc } as any,
      gameId: GAME_ID,
      pbp: pbp as any,
      shiftPayload: snapshot.rawPayload,
    });

    expect(rpc).toHaveBeenCalledWith(
      "capture_projection_raw_source_snapshots_v1",
      expect.objectContaining({
        p_shift_payload: snapshot.rawPayload,
        p_shift_payload_hash: shiftHash,
      }),
    );
    await expect(
      captureProjectionRawSourceSnapshots({
        supabase: { rpc } as any,
        gameId: GAME_ID,
        pbp: pbp as any,
        shiftPayload: { ...snapshot.rawPayload, source: "json-api-empty" } as any,
      }),
    ).rejects.toThrow("Projection raw shift snapshot is incomplete");
  });
});
