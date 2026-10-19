import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  status: null as Record<string, unknown> | null,
  raw: new Map<number, Record<string, unknown>>(),
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: (table: string) => ({
      select: () => ({
        eq: (_column: string, value: number) => ({
          maybeSingle: async () => ({
            data:
              table === "projection_game_materialization_status"
                ? db.status
                : (db.raw.get(value) ?? null),
            error: null,
          }),
        }),
      }),
    }),
  },
}));

import {
  buildProjectionPbpSourceHash,
  buildProjectionShiftSourceHash,
} from "./projectionInputPersistence";
import { hashProjectionRawJson } from "./rawSnapshotPersistence";
import {
  fetchAllNhleShiftChartsSnapshotForGame,
  readStoredProjectionPbp,
  readStoredProjectionShiftSnapshot,
} from "./shifts";

const GAME_ID = 2026020010;

const pbp = {
  id: GAME_ID,
  season: 20262027,
  gameType: 2,
  gameState: "OFF",
  gameDate: "2026-10-02",
  startTimeUTC: "2026-10-02T23:00:00Z",
  homeTeam: { id: 18, abbrev: "NSH", commonName: { default: "Predators" }, score: 2 },
  awayTeam: { id: 17, abbrev: "DET", commonName: { default: "Red Wings" }, score: 1 },
  plays: [
    { eventId: 1, typeDescKey: "faceoff", periodDescriptor: { number: 1, periodType: "REG" } },
    { eventId: 2, typeDescKey: "game-end", periodDescriptor: { number: 3, periodType: "REG" } },
  ],
};

const shiftRow = (playerId: number, teamId: number, shiftNumber: number) => ({
  id: playerId * 10 + shiftNumber,
  gameId: GAME_ID,
  playerId,
  teamId,
  teamAbbrev: teamId === 17 ? "DET" : "NSH",
  firstName: "Test",
  lastName: `Player ${playerId}`,
  shiftNumber,
  period: 1,
  startTime: "00:34",
  endTime: "01:50",
  duration: "01:16",
  typeCode: 517,
});

// JSONB does not preserve key order; reverse every object's keys to prove the
// stored path does not depend on it.
function jsonbRoundTrip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(jsonbRoundTrip);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).reverse().map(([key, item]) => [key, jsonbRoundTrip(item)]),
    );
  }
  return value;
}

describe("stored projection snapshots", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const jsonShifts = [shiftRow(202, 18, 1), shiftRow(101, 17, 2), shiftRow(101, 17, 1)];

  beforeEach(() => {
    // The live capture ingest made, used only to compute its fingerprints.
    fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ total: jsonShifts.length, data: jsonShifts }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function arrangeStoredInputs() {
    const ingestSnapshot = await fetchAllNhleShiftChartsSnapshotForGame(GAME_ID);
    const pbpHash = hashProjectionRawJson(pbp);
    const shiftHash = hashProjectionRawJson(ingestSnapshot.rawPayload);
    db.status = {
      game_id: GAME_ID,
      input_status: "complete",
      pbp_raw_payload_id: 11,
      pbp_raw_payload_hash: pbpHash,
      shift_raw_payload_id: 12,
      shift_raw_payload_hash: shiftHash,
    };
    db.raw = new Map([
      [11, { id: 11, game_id: GAME_ID, endpoint: "play-by-play", payload_hash: pbpHash, payload: jsonbRoundTrip(pbp) }],
      [12, { id: 12, game_id: GAME_ID, endpoint: "shiftcharts", payload_hash: shiftHash, payload: jsonbRoundTrip(ingestSnapshot.rawPayload) }],
    ]);
    fetchMock.mockClear();
    return ingestSnapshot;
  }

  it("rebuilds the exact ingest fingerprints from the pinned snapshots without NHL requests", async () => {
    const ingestSnapshot = await arrangeStoredInputs();

    const storedPbp = await readStoredProjectionPbp(GAME_ID);
    const storedShifts = await readStoredProjectionShiftSnapshot(GAME_ID);

    expect(buildProjectionShiftSourceHash(storedShifts.rows)).toBe(
      buildProjectionShiftSourceHash(ingestSnapshot.rows),
    );
    expect(buildProjectionPbpSourceHash(storedPbp)).toBe(
      buildProjectionPbpSourceHash(pbp as any),
    );
    expect(storedShifts.source).toBe("json-api");
    expect(storedShifts.rows.map((row) => [row.playerId, row.shiftNumber])).toEqual([
      [101, 1],
      [101, 2],
      [202, 1],
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["the raw row belongs to another endpoint", { endpoint: "boxscore" }],
    ["the raw hash differs from the pinned hash", { payload_hash: "f".repeat(64) }],
    ["the raw row belongs to another game", { game_id: GAME_ID + 1 }],
  ])("refuses when %s", async (_name, override) => {
    await arrangeStoredInputs();
    db.raw.set(12, { ...db.raw.get(12)!, ...override });

    await expect(readStoredProjectionShiftSnapshot(GAME_ID)).rejects.toThrow(
      `Stored shiftcharts snapshot does not match projection inputs for game ${GAME_ID}`,
    );
  });

  it("refuses games whose projection inputs are not complete", async () => {
    await arrangeStoredInputs();
    db.status = { ...db.status!, input_status: "pending" };

    await expect(readStoredProjectionPbp(GAME_ID)).rejects.toThrow(
      `Projection inputs are not complete for game ${GAME_ID}`,
    );
  });
});
