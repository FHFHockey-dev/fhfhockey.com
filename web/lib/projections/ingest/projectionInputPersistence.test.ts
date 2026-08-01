import { describe, expect, it, vi } from "vitest";

import {
  buildProjectionInputRpcPayload,
  buildProjectionShiftSourceHash,
  persistProjectionGameInputs,
  readProjectionInputManifest,
} from "./projectionInputPersistence";
import type { PbpResponse } from "./pbp";
import type { NhleShiftRow, ShiftStrengthUpsert } from "./shifts";

const GAME_ID = 2025020001;
const RAW_SNAPSHOTS = {
  gameId: GAME_ID,
  pbp: {
    rawPayloadId: 41,
    snapshotVersion: 7,
    payloadHash: "c".repeat(64),
  },
  shifts: {
    rawPayloadId: 42,
    snapshotVersion: 9,
    payloadHash: "d".repeat(64),
  },
};

function pbp(overrides: Partial<PbpResponse> = {}): PbpResponse {
  return {
    id: GAME_ID,
    season: 20252026,
    gameType: 2,
    gameState: "OFF",
    gameDate: "2025-10-07",
    startTimeUTC: "2025-10-07T23:00:00Z",
    venue: { default: "Test Arena" },
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
    plays: [
      {
        eventId: 1,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:01",
        timeRemaining: "19:59",
        situationCode: "1551",
        typeDescKey: "shot-on-goal",
        typeCode: 506,
        sortOrder: 1,
        details: { shootingPlayerId: 10, homeSOG: 1, awaySOG: 0 },
      },
      {
        eventId: 2,
        periodDescriptor: { number: 3, periodType: "REG" },
        timeInPeriod: "20:00",
        timeRemaining: "00:00",
        situationCode: "1551",
        typeDescKey: "game-end",
        typeCode: 521,
        sortOrder: 2,
      },
    ],
    ...overrides,
  };
}

function shiftSourceRows(): NhleShiftRow[] {
  return [
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
  ];
}

function strengthRows(): ShiftStrengthUpsert[] {
  return [
    {
      game_id: GAME_ID,
      game_type: "2",
      player_id: 10,
      team_id: 1,
      opponent_team_id: 2,
      team_abbreviation: "AAA",
      opponent_team_abbreviation: "BBB",
      game_date: "2025-10-07",
      season_id: 20252026,
      player_first_name: "Home",
      player_last_name: "Player",
      total_es_toi: "0:30",
      total_pp_toi: "0:00",
      total_pk_toi: "0:00",
      home_or_away: "home",
      updated_at: "2026-07-20T10:00:00.000Z",
    },
    {
      game_id: GAME_ID,
      game_type: "2",
      player_id: 20,
      team_id: 2,
      opponent_team_id: 1,
      team_abbreviation: "BBB",
      opponent_team_abbreviation: "AAA",
      game_date: "2025-10-07",
      season_id: 20252026,
      player_first_name: "Away",
      player_last_name: "Player",
      total_es_toi: "0:30",
      total_pp_toi: "0:00",
      total_pk_toi: "0:00",
      home_or_away: "away",
      updated_at: "2026-07-20T10:00:00.000Z",
    },
  ];
}

function buildPayload(
  args: {
    pbp?: PbpResponse;
    shifts?: NhleShiftRow[];
    strengths?: ShiftStrengthUpsert[];
    rawSnapshots?: typeof RAW_SNAPSHOTS;
    expected?: string | null;
  } = {},
) {
  return buildProjectionInputRpcPayload({
    gameId: GAME_ID,
    pbp: args.pbp ?? pbp(),
    shiftSourceRows: args.shifts ?? shiftSourceRows(),
    strengthRows: args.strengths ?? strengthRows(),
    rawSnapshots: args.rawSnapshots ?? RAW_SNAPSHOTS,
    expectedCurrentInputFingerprint: args.expected ?? null,
  });
}

describe("projection input persistence payload", () => {
  it("is invariant to source, play, and materialized row ordering", () => {
    const first = buildPayload();
    const second = buildPayload({
      pbp: pbp({ plays: [...pbp().plays].reverse() }),
      shifts: [...shiftSourceRows()].reverse(),
      strengths: [...strengthRows()]
        .reverse()
        .map((row) => ({ ...row, updated_at: "2099-01-01T00:00:00.000Z" })),
    });

    expect(second.pbpSourceHash).toBe(first.pbpSourceHash);
    expect(second.shiftSourceHash).toBe(first.shiftSourceHash);
    expect(second.inputFingerprint).toBe(first.inputFingerprint);
    expect(second.playRows.map((row) => row.id)).toEqual([1, 2]);
    expect(second.strengthRows.map((row) => row.player_id)).toEqual([10, 20]);
    expect(second.strengthRows[0]).not.toHaveProperty("updated_at");
  });

  it("changes the source and input hashes for corrected source content", () => {
    const first = buildPayload();
    const correctedShifts = shiftSourceRows().map((row, index) =>
      index === 0 ? { ...row, endTime: "0:31", duration: "0:31" } : row,
    );
    const corrected = buildPayload({ shifts: correctedShifts });

    expect(corrected.pbpSourceHash).toBe(first.pbpSourceHash);
    expect(corrected.shiftSourceHash).not.toBe(first.shiftSourceHash);
    expect(corrected.inputFingerprint).not.toBe(first.inputFingerprint);
    expect(buildProjectionShiftSourceHash(correctedShifts)).toBe(
      corrected.shiftSourceHash,
    );

    const renumberedShifts = shiftSourceRows().map((row, index) =>
      index === 0 ? { ...row, shiftNumber: row.shiftNumber + 1 } : row,
    );
    expect(buildProjectionShiftSourceHash(renumberedShifts)).not.toBe(
      first.shiftSourceHash,
    );
  });

  it("binds the input generation to raw identity/version independently of normalized hashes", () => {
    const first = buildPayload();
    const advanced = buildPayload({
      rawSnapshots: {
        ...RAW_SNAPSHOTS,
        pbp: { ...RAW_SNAPSHOTS.pbp, snapshotVersion: 8 },
      },
    });

    expect(advanced.pbpSourceHash).toBe(first.pbpSourceHash);
    expect(advanced.shiftSourceHash).toBe(first.shiftSourceHash);
    expect(advanced.rawSnapshots.pbp.payloadHash).toBe(
      first.rawSnapshots.pbp.payloadHash,
    );
    expect(advanced.inputFingerprint).not.toBe(first.inputFingerprint);
  });

  it("reads one complete manifest and fails closed on a present partial row", async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          input_status: "complete",
          input_fingerprint: "a".repeat(64),
          input_version: 3,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          input_status: "pending",
          input_fingerprint: null,
          input_version: 0,
        },
        error: null,
      });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const client = { from: vi.fn(() => ({ select })) } as any;

    await expect(
      readProjectionInputManifest({ supabase: client, gameId: GAME_ID }),
    ).resolves.toEqual({ inputFingerprint: "a".repeat(64), inputVersion: 3 });
    await expect(
      readProjectionInputManifest({ supabase: client, gameId: GAME_ID }),
    ).rejects.toThrow("present but incomplete");
  });

  it("sends one CAS RPC, validates its exact receipt, and surfaces failure", async () => {
    const payload = buildPayload({ expected: "b".repeat(64) });
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            game_id: GAME_ID,
            input_status: "complete",
            input_fingerprint: payload.inputFingerprint,
            input_version: 4,
            pbp_raw_payload_id: RAW_SNAPSHOTS.pbp.rawPayloadId,
            pbp_raw_snapshot_version: RAW_SNAPSHOTS.pbp.snapshotVersion,
            pbp_raw_payload_hash: RAW_SNAPSHOTS.pbp.payloadHash,
            shift_raw_payload_id: RAW_SNAPSHOTS.shifts.rawPayloadId,
            shift_raw_snapshot_version: RAW_SNAPSHOTS.shifts.snapshotVersion,
            shift_raw_payload_hash: RAW_SNAPSHOTS.shifts.payloadHash,
            expected_play_rows: 2,
            observed_play_rows: 2,
            expected_strength_rows: 2,
            observed_strength_rows: 2,
            pruned_play_rows: 1,
            pruned_strength_rows: 0,
            idempotent: false,
            completed_at: "2026-07-20T10:00:00.000Z",
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "stale input fingerprint" },
      });
    const client = { rpc } as any;

    await expect(
      persistProjectionGameInputs({ supabase: client, payload }),
    ).resolves.toMatchObject({
      gameId: GAME_ID,
      inputStatus: "complete",
      inputFingerprint: payload.inputFingerprint,
      inputVersion: 4,
      playCount: 2,
      strengthCount: 2,
      prunedPlayRows: 1,
      prunedStrengthRows: 0,
    });
    expect(rpc).toHaveBeenCalledWith(
      "persist_projection_game_inputs_v1",
      expect.objectContaining({
        p_game_id: GAME_ID,
        p_expected_current_input_fingerprint: "b".repeat(64),
        p_input_fingerprint: payload.inputFingerprint,
        p_pbp_source_hash: payload.pbpSourceHash,
        p_shift_source_hash: payload.shiftSourceHash,
        p_pbp_raw_payload_id: RAW_SNAPSHOTS.pbp.rawPayloadId,
        p_pbp_raw_snapshot_version: RAW_SNAPSHOTS.pbp.snapshotVersion,
        p_pbp_raw_payload_hash: RAW_SNAPSHOTS.pbp.payloadHash,
        p_shift_raw_payload_id: RAW_SNAPSHOTS.shifts.rawPayloadId,
        p_shift_raw_snapshot_version: RAW_SNAPSHOTS.shifts.snapshotVersion,
        p_shift_raw_payload_hash: RAW_SNAPSHOTS.shifts.payloadHash,
        p_expected_play_rows: 2,
        p_expected_strength_rows: 2,
      }),
    );
    await expect(
      persistProjectionGameInputs({ supabase: client, payload }),
    ).rejects.toThrow("stale input fingerprint");
  });
});
