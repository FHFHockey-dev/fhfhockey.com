import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  captureProjectionRawSourceSnapshots,
  hashProjectionRawJson,
} from "./rawSnapshotPersistence";
import {
  buildProjectionPbpSourceHash,
  buildProjectionShiftSourceHash,
} from "./projectionInputPersistence";

const GAME_ID = 2025020001;

const pbp = {
  id: GAME_ID,
  season: 20252026,
  gameType: 2,
  gameState: "OFF",
  gameDate: "2025-10-07",
  startTimeUTC: "2025-10-07T23:00:00Z",
  awayTeam: {
    id: 2,
    abbrev: "BBB",
    commonName: { default: "Away" },
    score: 1,
  },
  homeTeam: {
    id: 1,
    abbrev: "AAA",
    commonName: { default: "Home" },
    score: 2,
  },
  plays: [{ eventId: 1 }, { eventId: 2, typeDescKey: "game-end" }],
};

const shiftPayload = {
  total: 2,
  source: "json-api" as const,
  data: [
    {
      gameId: GAME_ID,
      playerId: 10,
      teamId: 1,
      teamAbbrev: "AAA",
      firstName: "Home",
      lastName: "Player",
      shiftNumber: 1,
      period: 1,
      startTime: "0:00",
      endTime: "0:30",
      duration: "0:30",
      typeCode: 517,
    },
    {
      gameId: GAME_ID,
      playerId: 20,
      teamId: 2,
      teamAbbrev: "BBB",
      firstName: "Away",
      lastName: "Player",
      shiftNumber: 1,
      period: 1,
      startTime: "0:00",
      endTime: "0:30",
      duration: "0:30",
      typeCode: 517,
    },
  ],
};

describe("projection raw snapshot persistence", () => {
  it("uses the existing immutable writer's exact JSON byte hash", () => {
    expect(hashProjectionRawJson(pbp)).toBe(
      createHash("sha256").update(JSON.stringify(pbp)).digest("hex"),
    );
    expect(hashProjectionRawJson({ b: 1, a: 2 })).not.toBe(
      hashProjectionRawJson({ a: 2, b: 1 }),
    );
    expect(hashProjectionRawJson(pbp)).not.toBe(
      buildProjectionPbpSourceHash(pbp),
    );
    expect(hashProjectionRawJson(shiftPayload)).not.toBe(
      buildProjectionShiftSourceHash(shiftPayload.data),
    );
  });

  it("captures both raw endpoints and validates exact current identities", async () => {
    const pbpHash = hashProjectionRawJson(pbp);
    const shiftHash = hashProjectionRawJson(shiftPayload);
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          game_id: GAME_ID,
          pbp_raw_payload_id: 101,
          pbp_raw_snapshot_version: 7,
          pbp_raw_payload_hash: pbpHash,
          shift_raw_payload_id: 102,
          shift_raw_snapshot_version: 9,
          shift_raw_payload_hash: shiftHash,
        },
      ],
      error: null,
    });

    await expect(
      captureProjectionRawSourceSnapshots({
        supabase: { rpc } as any,
        gameId: GAME_ID,
        pbp,
        shiftPayload,
      }),
    ).resolves.toEqual({
      gameId: GAME_ID,
      pbp: { rawPayloadId: 101, snapshotVersion: 7, payloadHash: pbpHash },
      shifts: {
        rawPayloadId: 102,
        snapshotVersion: 9,
        payloadHash: shiftHash,
      },
    });
    expect(rpc).toHaveBeenCalledWith(
      "capture_projection_raw_source_snapshots_v1",
      expect.objectContaining({
        p_game_id: GAME_ID,
        p_pbp_payload: pbp,
        p_pbp_payload_hash: pbpHash,
        p_shift_payload: shiftPayload,
        p_shift_payload_hash: shiftHash,
      }),
    );
  });

  it("fails closed on incomplete pagination or a stale/malformed receipt", async () => {
    await expect(
      captureProjectionRawSourceSnapshots({
        supabase: { rpc: vi.fn() } as any,
        gameId: GAME_ID,
        pbp,
        shiftPayload: { ...shiftPayload, total: 3 },
      }),
    ).rejects.toThrow("incomplete");

    await expect(
      captureProjectionRawSourceSnapshots({
        supabase: {
          rpc: vi.fn().mockResolvedValue({
            data: [
              {
                game_id: GAME_ID,
                pbp_raw_payload_id: 101,
                pbp_raw_snapshot_version: 7,
                pbp_raw_payload_hash: "0".repeat(64),
                shift_raw_payload_id: 102,
                shift_raw_snapshot_version: 9,
                shift_raw_payload_hash: "1".repeat(64),
              },
            ],
            error: null,
          }),
        } as any,
        gameId: GAME_ID,
        pbp,
        shiftPayload,
      }),
    ).rejects.toThrow("invalid PBP identity");
  });
});
