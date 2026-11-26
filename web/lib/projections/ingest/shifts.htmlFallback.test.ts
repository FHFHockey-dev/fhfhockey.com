import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("lib/supabase/server", () => ({ default: { from: vi.fn() } }));

import { buildHtmlShiftReportPayload, fetchNhlApiRawGamePayloads } from "lib/supabase/Upserts/nhlRawGamecenter.mjs";

import {
  buildProjectionInputRpcPayload,
  buildProjectionShiftSourceHash,
} from "./projectionInputPersistence";
import {
  captureProjectionRawSourceSnapshots,
  hashProjectionRawJson,
} from "./rawSnapshotPersistence";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildCorroboratedShiftPayload } from "lib/supabase/Upserts/nhlShiftCorroboration.mjs";

import {
  buildShiftSnapshotFromRawPayload,
  buildShiftStrengthUpserts,
  fetchAllNhleShiftChartsSnapshotForGame,
  type NhleShiftRow,
} from "./shifts";

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

  it.each([
    { label: "OT", period: 4, gameType: 2, nominal: "05:00", played: "03:23", remaining: "01:37" },
    { label: "2OT", period: 5, gameType: 3, nominal: "20:00", played: "02:43", remaining: "17:17" },
  ])("retains $label physical intervals from the official HTML period labels", ({ label, period, gameType, nominal, played, remaining }) => {
    const gameId = gameType === 3 ? 2026030010 : GAME_ID;
    const shifts = [
      ["1", "1", "0:00 / 20:00", "0:30 / 19:30", "00:30", ""],
      ["2", label, `0:00 / ${nominal}`, `${played} / ${remaining}`, played, ""],
    ];
    const payload = buildHtmlShiftReportPayload({
      gameId,
      seasonId: 20262027,
      game: finalPbp({ id: gameId, gameType }),
      jsonPayload: { total: 0, data: [] },
      visitorHtml: report("DETROIT RED WINGS", "8 CHIAROT, BEN", shifts),
      homeHtml: report("NASHVILLE PREDATORS", "9 FORSBERG, FILIP", shifts),
      strict: true,
    });
    expect(payload?.total).toBe(4);
    expect(payload?.data.filter((row) => row.playerId === 101).map((row) => row.period)).toEqual([1, period]);
    expect(payload?.data.filter((row) => row.period === period).map((row) => [row.startTime, row.endTime, row.duration])).toEqual([["00:00", played, played], ["00:00", played, played]]);
  });

  it("refuses an unknown period on a numbered physical shift instead of silently dropping it", () => {
    expect(() => buildHtmlShiftReportPayload({
      gameId: GAME_ID,
      seasonId: 20262027,
      game: finalPbp(),
      jsonPayload: { total: 0, data: [] },
      visitorHtml: report("DETROIT RED WINGS", "8 CHIAROT, BEN", [
        ["1", "1", "0:00 / 20:00", "0:30 / 19:30", "00:30", ""],
        ["2", "UNKNOWN", "0:00 / 5:00", "0:30 / 4:30", "00:30", ""],
      ]),
      homeHtml: HOME_HTML,
      strict: true,
    })).toThrow("unrecognized period");
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

// Game 2026020399 (CHI at SEA, 2026-11-25), as NHL published it on 2026-11-26.
// shiftcharts row 16944566 puts Daccord (8478916) in P1 00:00-17:06 for 15:59,
// with shiftNumber 2 (his real P2 shift); the TOI report shows one P1 shift,
// 0:00-20:00, and the boxscore TOI is 56:47.
const FIXTURE_DIR = join(__dirname, "__fixtures__", "2026020399");
const fixture = (name: string) => readFileSync(join(FIXTURE_DIR, name), "utf8");
const G0399 = 2026020399;
const PHANTOM_ID = 16944566;
const DACCORD = 8478916;
const UPDATED_AT = "2026-11-26T12:00:00.000Z";
const SHIFTCHARTS_0399 = `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${G0399}&start=0&limit=1000`;
const BOXSCORE_0399 = `https://api-web.nhle.com/v1/gamecenter/${G0399}/boxscore`;
const TV_0399 = "https://www.nhl.com/scores/htmlreports/20262027/TV020399.HTM";
const TH_0399 = "https://www.nhl.com/scores/htmlreports/20262027/TH020399.HTM";

type FixtureRow = NhleShiftRow & { id: number };

function load0399() {
  return {
    pbp: JSON.parse(fixture("pbp.json")),
    box: JSON.parse(fixture("box.json")),
    shifts: JSON.parse(fixture("shifts.json")) as { total: number; data: FixtureRow[] },
    visitorHtml: fixture("TV.htm"),
    homeHtml: fixture("TH.htm"),
  };
}

function stub0399(args: {
  data: unknown[];
  box?: unknown;
  visitorHtml?: string | null;
  homeHtml?: string | null;
}) {
  const source = load0399();
  const fetchMock = vi.fn(async (url: string) => {
    const json = (body: unknown) => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => body,
      text: async () => JSON.stringify(body),
    });
    if (url.includes("shiftcharts")) return json({ total: args.data.length, data: args.data });
    if (url === BOXSCORE_0399) return json(args.box ?? source.box);
    if (url.endsWith(`/gamecenter/${G0399}/play-by-play`)) return json(source.pbp);
    if (url.endsWith(`/gamecenter/${G0399}/landing`)) return json({ gameState: source.pbp.gameState });
    const html = url === TV_0399
      ? args.visitorHtml === undefined ? source.visitorHtml : args.visitorHtml
      : url === TH_0399
        ? args.homeHtml === undefined ? source.homeHtml : args.homeHtml
        : undefined;
    if (html === undefined) throw new Error(`Unexpected URL: ${url}`);
    if (html === null) return { ok: false, status: 404, statusText: "Not Found" };
    return { ok: true, status: 200, statusText: "OK", text: async () => html };
  });
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  return { fetchMock, pbp: source.pbp };
}

function withSeconds(clock: string, delta: number) {
  const [minutes, seconds] = clock.split(":").map(Number);
  const total = minutes * 60 + seconds + delta;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const toiSeconds = (rows: ReturnType<typeof buildShiftStrengthUpserts>) =>
  rows.map((row) => [row.player_id, row.total_es_toi, row.total_pp_toi, row.total_pk_toi]);

describe("projection shift corroboration of game 2026020399 (real NHL fixture)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("rejects the published feed as before when nothing corroborates the extra row", () => {
    const { pbp, shifts } = load0399();
    const snapshot = buildShiftSnapshotFromRawPayload(G0399, { ...shifts, source: "json-api" });
    expect(() => buildShiftStrengthUpserts(G0399, pbp, snapshot.rows)).toThrow(
      expect.objectContaining({
        code: "SHIFT_CLOCK_DURATION_MISMATCH",
        witness: expect.objectContaining({ playerId: DACCORD, period: 1, startSeconds: 0, endSeconds: 1026, durationSeconds: 959 }),
      }),
    );
  });

  it("stores the corroborated HTML report for 0399, keeping the verbatim JSON and recording what it excluded and why", async () => {
    const { shifts } = load0399();
    const { fetchMock, pbp } = stub0399({ data: shifts.data });

    const snapshot = await fetchAllNhleShiftChartsSnapshotForGame(G0399, { pbp });

    expect(snapshot.corroborationError).toBeUndefined();
    expect(snapshot.source).toBe("htmlreports");
    const raw = snapshot.rawPayload as Extract<typeof snapshot.rawPayload, { source: "htmlreports" }>;
    expect(Object.keys(raw)).toEqual(["total", "data", "source", "upstream", "htmlReports", "corroboration"]);
    expect(raw.total).toBe(756);
    expect(raw.upstream.json).toEqual({ total: 761, data: shifts.data });
    expect(raw.htmlReports).toEqual({ visitorUrl: TV_0399, homeUrl: TH_0399 });
    expect(raw.corroboration!.excluded).toEqual([
      {
        id: PHANTOM_ID,
        playerId: DACCORD,
        teamId: 55,
        period: 1,
        shiftNumber: 2,
        startTime: "00:00",
        endTime: "17:06",
        duration: "15:59",
        reason: "CLOCK_DURATION_MISMATCH_COVERED_UNDER_EVERY_READING_AND_ABSENT_FROM_OFFICIAL_RECORD",
        coveredByIds: [16944565],
      },
    ]);
    expect(raw.corroboration!.duplicates).toEqual([]);
    expect(raw.corroboration!.boxscore.url).toBe(BOXSCORE_0399);
    expect(raw.corroboration!.boxscore.players).toHaveLength(40);
    expect(raw.corroboration!.boxscore.players).toContainEqual({ playerId: DACCORD, teamId: 55, toi: "56:47" });
    expect(snapshot.rows.filter((row) => row.playerId === DACCORD).map((row) =>
      [row.shiftNumber, row.period, row.startTime, row.endTime])).toEqual([
      [1, 1, "00:00", "20:00"],
      [2, 2, "00:00", "20:00"],
      [3, 3, "00:00", "15:39"],
      [4, 3, "16:59", "17:47"],
      [5, 3, "19:40", "20:00"],
    ]);
    expect(requestedUrls(fetchMock)).toEqual(expect.arrayContaining([BOXSCORE_0399, TV_0399, TH_0399]));

    // Daccord's strength split now adds up to his boxscore TOI, 56:47.
    const upserts = buildShiftStrengthUpserts(G0399, pbp, snapshot.rows, UPDATED_AT);
    const daccord = upserts.find((row) => row.player_id === DACCORD)!;
    const seconds = (clock: string | null | undefined) =>
      clock ? Number(clock.split(":")[0]) * 60 + Number(clock.split(":")[1]) : 0;
    expect(seconds(daccord.total_es_toi) + seconds(daccord.total_pp_toi) + seconds(daccord.total_pk_toi)).toBe(3407);

    // Stored readers (update-shift-charts) re-check the evidence offline.
    const stored = buildShiftSnapshotFromRawPayload(G0399, JSON.parse(JSON.stringify(snapshot.rawPayload)));
    expect(stored.rows).toEqual(snapshot.rows);
    expect(buildProjectionShiftSourceHash(stored.rows)).toBe(buildProjectionShiftSourceHash(snapshot.rows));
  });

  it("stores a corroborated envelope byte-identical to the Gamecenter writer's, and the same one on a re-run", async () => {
    const { shifts } = load0399();
    const { pbp } = stub0399({ data: shifts.data });
    const first = await fetchAllNhleShiftChartsSnapshotForGame(G0399, { pbp });
    const second = await fetchAllNhleShiftChartsSnapshotForGame(G0399, { pbp });
    const gamecenter = await fetchNhlApiRawGamePayloads(G0399, { retries: 1, retryDelayMs: 0, timeoutMs: 50 });

    expect(gamecenter.payloads.shiftcharts.source).toBe("htmlreports");
    expect(JSON.stringify(first.rawPayload)).toBe(JSON.stringify(gamecenter.payloads.shiftcharts));
    expect(hashProjectionRawJson(first.rawPayload)).toBe(gamecenter.hashes.shiftcharts);
    expect(hashProjectionRawJson(second.rawPayload)).toBe(hashProjectionRawJson(first.rawPayload));
  });

  it("gives the same TOI rows whichever clock of the excluded row is the true one", async () => {
    const { shifts } = load0399();
    const { pbp } = stub0399({ data: shifts.data });
    const snapshot = await fetchAllNhleShiftChartsSnapshotForGame(G0399, { pbp });
    const accepted = toiSeconds(buildShiftStrengthUpserts(G0399, pbp, snapshot.rows, UPDATED_AT));
    const phantom = shifts.data.find((row) => row.id === PHANTOM_ID)!;
    const others = shifts.data.filter((row) => row.id !== PHANTOM_ID);
    const readings = [
      { startTime: "00:00", endTime: "17:06", duration: "17:06" }, // duration wrong
      { startTime: "00:00", endTime: "15:59", duration: "15:59" }, // end wrong
      { startTime: "01:07", endTime: "17:06", duration: "15:59" }, // start wrong
    ];
    for (const reading of readings) {
      const rows = buildShiftSnapshotFromRawPayload(G0399, {
        total: shifts.total,
        data: [...others, { ...phantom, ...reading }],
        source: "json-api",
      }).rows;
      expect(toiSeconds(buildShiftStrengthUpserts(G0399, pbp, rows, UPDATED_AT))).toEqual(accepted);
    }
  });

  async function expectUncorroborated(args: Parameters<typeof stub0399>[0], reason: string) {
    const { pbp } = stub0399(args);
    const snapshot = await fetchAllNhleShiftChartsSnapshotForGame(G0399, { pbp });
    expect(snapshot.corroborationError).toBe(reason);
    expect(snapshot.rawPayload).toEqual({ total: args.data.length, data: args.data, source: "json-api" });
    expect(() => buildShiftStrengthUpserts(G0399, pbp, snapshot.rows)).toThrow(
      expect.objectContaining({ code: "SHIFT_CLOCK_DURATION_MISMATCH" }),
    );
    // The Gamecenter writer keeps the plain JSON feed too.
    const gamecenter = await fetchNhlApiRawGamePayloads(G0399, { retries: 1, retryDelayMs: 0, timeoutMs: 50 });
    expect(gamecenter.payloads.shiftcharts).toEqual(snapshot.rawPayload);
    return snapshot;
  }

  it("(a) rejects the inconsistent row when the HTML reports cannot be fetched", async () => {
    const { shifts } = load0399();
    await expectUncorroborated({ data: shifts.data, homeHtml: null }, "SOURCES_UNAVAILABLE");
  });

  it("(a) rejects the inconsistent row, fetching nothing more, when the rule is switched off", async () => {
    vi.stubEnv("PROJECTION_SHIFT_CORROBORATION_ENABLED", "false");
    const { shifts } = load0399();
    const { fetchMock, pbp } = stub0399({ data: shifts.data });
    const snapshot = await fetchAllNhleShiftChartsSnapshotForGame(G0399, { pbp });
    expect(snapshot.corroborationError).toBe("DISABLED");
    expect(snapshot.rawPayload).toEqual({ total: 761, data: shifts.data, source: "json-api" });
    expect(requestedUrls(fetchMock)).toEqual([SHIFTCHARTS_0399]);
    await expectUncorroborated({ data: shifts.data }, "DISABLED");
  });

  it("(b) rejects a row covered under only one clock reading, though HTML and boxscore agree", async () => {
    const { shifts } = load0399();
    // Skater 8474013's first P2 shift is 01:39-02:11 with nothing before it or
    // within 30 s after: [start,end] is covered, [start,start+duration] and
    // [end-duration,end] are not.
    const skater = shifts.data.find((row) => row.id === 16945973)!;
    expect([skater.playerId, skater.period, skater.startTime, skater.endTime]).toEqual([8474013, 2, "01:39", "02:11"]);
    const data = [
      ...shifts.data.filter((row) => row.id !== PHANTOM_ID),
      { ...skater, id: 99_000_001, duration: withSeconds(skater.duration!, 30) },
    ];
    await expectUncorroborated({ data }, "MISMATCH_NOT_COVERED_UNDER_EVERY_READING");
  });

  it("(c) rejects a skater row whose duration is 7 s longer than its clocks", async () => {
    const { shifts } = load0399();
    const data = shifts.data
      .filter((row) => row.id !== PHANTOM_ID)
      .map((row) => row.id === 16945973 ? { ...row, duration: withSeconds(row.duration!, 7) } : row);
    await expectUncorroborated({ data }, "MISMATCH_NOT_COVERED_UNDER_EVERY_READING");
  });

  it("(d) rejects 0399 when the HTML report disagrees with the boxscore", async () => {
    const { shifts, box } = load0399();
    const goalie = box.playerByGameStats.homeTeam.goalies.find((row: any) => row.playerId === DACCORD);
    goalie.toi = "56:48";
    await expectUncorroborated({ data: shifts.data, box }, "BOXSCORE_TOI_DISAGREES_WITH_HTML");
  });

  it("excludes a mismatch row for a dressed player who did not play (0310 shape), with its own reason", async () => {
    const { shifts } = load0399();
    // Grubauer (8475831) dressed as SEA's backup: boxscore 00:00, no report rows.
    const phantom = shifts.data.find((row) => row.id === PHANTOM_ID)!;
    const backup = { ...phantom, id: 99_000_002, playerId: 8475831, firstName: "Philipp", lastName: "Grubauer",
      shiftNumber: 1, endTime: "08:01", duration: "07:50" };
    const data = [...shifts.data.filter((row) => row.id !== PHANTOM_ID), backup];
    const { pbp } = stub0399({ data });
    const snapshot = await fetchAllNhleShiftChartsSnapshotForGame(G0399, { pbp });
    const raw = snapshot.rawPayload as any;
    expect(snapshot.corroborationError).toBeUndefined();
    expect(raw.source).toBe("htmlreports");
    expect(raw.corroboration.excluded).toEqual([expect.objectContaining({
      id: 99_000_002,
      playerId: 8475831,
      reason: "CLOCK_DURATION_MISMATCH_FOR_PLAYER_WITH_ZERO_BOXSCORE_TOI_AND_NO_OFFICIAL_SHIFTS",
      coveredByIds: [],
    })]);
    expect(snapshot.rows.some((row) => row.playerId === 8475831)).toBe(false);
    expect(buildShiftSnapshotFromRawPayload(G0399, JSON.parse(JSON.stringify(raw))).rows).toEqual(snapshot.rows);
    const gamecenter = await fetchNhlApiRawGamePayloads(G0399, { retries: 1, retryDelayMs: 0, timeoutMs: 50 });
    expect(gamecenter.hashes.shiftcharts).toBe(hashProjectionRawJson(raw));
  });

  it("rejects an uncovered fake row for a player who did play", async () => {
    const { shifts } = load0399();
    // Daccord played 56:47; P3 15:39-16:59 is his real gap. A fake row inside it
    // is not covered, and the zero-TOI exception cannot apply to him.
    const phantom = shifts.data.find((row) => row.id === PHANTOM_ID)!;
    const fake = { ...phantom, id: 99_000_003, period: 3, shiftNumber: 6, startTime: "15:40", endTime: "16:50", duration: "01:00" };
    const data = [...shifts.data.filter((row) => row.id !== PHANTOM_ID), fake];
    await expectUncorroborated({ data }, "MISMATCH_NOT_COVERED_UNDER_EVERY_READING");
  });

  it("rejects the zero-TOI exception when the player has another JSON row", async () => {
    const { shifts } = load0399();
    const phantom = shifts.data.find((row) => row.id === PHANTOM_ID)!;
    const grub = { ...phantom, playerId: 8475831, firstName: "Philipp", lastName: "Grubauer" };
    const data = [
      ...shifts.data.filter((row) => row.id !== PHANTOM_ID),
      { ...grub, id: 99_000_004, shiftNumber: 1, endTime: "08:01", duration: "07:50" },
      { ...grub, id: 99_000_005, shiftNumber: 2, period: 2, startTime: "10:00", endTime: "10:30", duration: "00:30" },
    ];
    await expectUncorroborated({ data }, "MISMATCH_NOT_COVERED_UNDER_EVERY_READING");
  });

  it("rejects corroboration when the HTML report also lists the excluded row or numbers a shift differently", () => {
    const { shifts, box, pbp, visitorHtml, homeHtml } = load0399();
    const html = buildHtmlShiftReportPayload({
      gameId: G0399, seasonId: 20262027, game: pbp, jsonPayload: shifts, visitorHtml, homeHtml, strict: true,
    })!;
    const phantom = shifts.data.find((row) => row.id === PHANTOM_ID)!;
    const withPhantom = { ...html, total: html.total + 1, data: [...html.data, { ...html.data[0], ...phantom, id: 9999, endTime: "15:59" }] };
    expect(() => buildCorroboratedShiftPayload({ gameId: G0399, htmlPayload: withPhantom, boxscore: box }))
      .toThrow(expect.objectContaining({ reason: "BOXSCORE_TOI_DISAGREES_WITH_HTML" }));
    const renumbered = { ...html, data: html.data.map((row) =>
      row.playerId === DACCORD && row.period === 1 ? { ...row, shiftNumber: 9 } : row) };
    expect(() => buildCorroboratedShiftPayload({ gameId: G0399, htmlPayload: renumbered, boxscore: box }))
      .toThrow(expect.objectContaining({ reason: "HTML_ROWS_DISAGREE_WITH_JSON" }));
  });

  it("refuses a stored corroborated envelope that its own evidence does not support", async () => {
    const { shifts } = load0399();
    const { pbp } = stub0399({ data: shifts.data });
    const { rawPayload } = await fetchAllNhleShiftChartsSnapshotForGame(G0399, { pbp });
    const raw = rawPayload as any;
    const tampered = [
      // Excludes a consistent row instead of the mismatch.
      { ...raw, corroboration: { ...raw.corroboration, excluded: [{ ...raw.corroboration.excluded[0], id: 16944565 }] } },
      // A boxscore TOI the report rows do not add up to.
      { ...raw, corroboration: { ...raw.corroboration, boxscore: { ...raw.corroboration.boxscore,
        players: raw.corroboration.boxscore.players.map((p: any) => p.playerId === DACCORD ? { ...p, toi: "72:46" } : p) } } },
      // A report row dropped from the stored data.
      { ...raw, total: raw.total - 1, data: raw.data.slice(1) },
      // The verbatim JSON edited so the mismatch disappears.
      { ...raw, upstream: { json: { total: 760, data: shifts.data.filter((row) => row.id !== PHANTOM_ID) } } },
      // Corroboration only ever travels on an HTML report envelope.
      { total: 761, data: shifts.data, source: "json-api", corroboration: raw.corroboration },
    ];
    for (const payload of tampered) {
      expect(() => buildShiftSnapshotFromRawPayload(G0399, payload)).toThrow(
        /Shift corroboration refused|Invalid NHL shift corroboration/,
      );
    }
  });
});

// Replays of the two earlier phantom games from their stored raw snapshots
// (exported read-only 2026-11-26) and the public boxscores. The htmlreports
// snapshots were captured after NHL emptied the JSON feed, so the original
// JSON comes from each game's earlier json-api snapshot.
function readStoredGame(gameId: number) {
  const dir = join(__dirname, "__fixtures__", String(gameId));
  const read = (name: string) => JSON.parse(readFileSync(join(dir, name), "utf8"));
  return { json: read("stored-json-api.json"), html: read("stored-htmlreports.json"), box: read("box.json") };
}

function replayStoredGame(gameId: number, edit: (rows: any[]) => any[] = (rows) => rows) {
  const { json: stored, html, box } = readStoredGame(gameId);
  const data = edit(stored.data);
  const json = { total: data.length, data };
  const htmlPayload = {
    total: html.total,
    data: html.data,
    source: "htmlreports" as const,
    upstream: { json: { total: json.total, data: json.data } },
    htmlReports: html.htmlReports,
  };
  return () => buildCorroboratedShiftPayload({ gameId, htmlPayload, boxscore: box });
}

describe("replays of the stored phantom games", () => {
  it("2026020310: accepts the feed, excluding Lankinen's zero-TOI row and recording three renumbered duplicates", () => {
    const payload = replayStoredGame(2026020310)();
    expect(payload.upstream.json.total).toBe(742);
    expect(payload.total).toBe(732);
    expect(payload.corroboration.excluded).toEqual([expect.objectContaining({
      id: 16879875,
      playerId: 8480947,
      period: 1,
      startTime: "00:00",
      endTime: "08:01",
      duration: "07:50",
      reason: "CLOCK_DURATION_MISMATCH_FOR_PLAYER_WITH_ZERO_BOXSCORE_TOI_AND_NO_OFFICIAL_SHIFTS",
      coveredByIds: [],
    })]);
    expect(payload.corroboration.duplicates.map((row) =>
      [row.id, row.playerId, row.period, row.shiftNumber, row.startTime, row.endTime, row.reason, row.duplicateOfId])).toEqual([
      [16880098, 8480078, 2, 5, "00:00", "01:05", "EXACT_INTERVAL_DUPLICATE_OF_A_ROW_THE_OFFICIAL_REPORT_LISTS", 16880176],
      [16880174, 8480078, 2, 6, "00:00", "01:05", "EXACT_INTERVAL_DUPLICATE_OF_A_ROW_THE_OFFICIAL_REPORT_LISTS", 16880176],
      [16880175, 8480078, 2, 7, "04:49", "06:01", "EXACT_INTERVAL_DUPLICATE_OF_A_ROW_THE_OFFICIAL_REPORT_LISTS", 16880367],
    ]);
    // The boxscore check counts each duplicated interval once: the raw JSON
    // durations would overstate 8480078 by 65 + 65 + 72 s.
    const { json, box } = readStoredGame(2026020310);
    const boxToi = [...box.playerByGameStats.awayTeam.forwards, ...box.playerByGameStats.awayTeam.defense,
      ...box.playerByGameStats.homeTeam.forwards, ...box.playerByGameStats.homeTeam.defense]
      .find((row: any) => row.playerId === 8480078).toi;
    const rawSeconds = json.data.filter((row: any) => row.playerId === 8480078 && row.typeCode === 517)
      .reduce((total: number, row: any) => total + Number(row.duration.split(":")[0]) * 60 + Number(row.duration.split(":")[1]), 0);
    expect(rawSeconds - (Number(boxToi.split(":")[0]) * 60 + Number(boxToi.split(":")[1]))).toBe(202);
    expect(buildShiftSnapshotFromRawPayload(2026020310, JSON.parse(JSON.stringify(payload))).rows).toHaveLength(732);
  });

  it("2026020310: refuses a near-duplicate that differs by one second", () => {
    expect(replayStoredGame(2026020310, (rows) => rows.map((row) =>
      row.id === 16880098 ? { ...row, endTime: "01:06", duration: "01:06" } : row))).toThrow(
      expect.objectContaining({ reason: "HTML_ROWS_DISAGREE_WITH_JSON" }),
    );
  });

  it("2026020310: refuses a duplicate of a row the report does not list", () => {
    expect(replayStoredGame(2026020310, (rows) => {
      const base = rows.find((row) => row.id === 16880176);
      return [...rows,
        { ...base, id: 99_000_010, shiftNumber: 30, startTime: "02:00", endTime: "02:30", duration: "00:30" },
        { ...base, id: 99_000_011, shiftNumber: 31, startTime: "02:00", endTime: "02:30", duration: "00:30" }];
    })).toThrow(expect.objectContaining({ reason: "HTML_ROWS_DISAGREE_WITH_JSON" }));
  });

  it("2026020310: refuses a stored envelope whose recorded duplicates were edited", () => {
    const payload = replayStoredGame(2026020310)();
    const edited = { ...payload, corroboration: { ...payload.corroboration,
      duplicates: payload.corroboration.duplicates.slice(1) } };
    expect(() => buildShiftSnapshotFromRawPayload(2026020310, edited as any)).toThrow(/Shift corroboration refused/);
  });

  it("2026020318: refuses Lindgren's P3 00:00-08:30 row, which crosses his real 0:14-0:22 gap", () => {
    expect(replayStoredGame(2026020318)).toThrow(
      expect.objectContaining({ reason: "MISMATCH_NOT_COVERED_UNDER_EVERY_READING" }),
    );
  });
});
