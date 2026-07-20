import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "lib/supabase/database-generated.types";
import {
  sha256CanonicalJson,
  stableJsonStringify,
} from "lib/projections/materializationFingerprint";

import {
  buildPbpPersistenceRows,
  type PbpGamePersistenceRow,
  type PbpPlayPersistenceRow,
  type PbpResponse,
} from "./pbp";
import type { NhleShiftRow, ShiftStrengthUpsert } from "./shifts";
import type { ProjectionRawSourceSnapshotReceipt } from "./rawSnapshotPersistence";

export const PROJECTION_INPUT_PARSER_VERSION = "nhl-pbp-shifts-v1";
export const PROJECTION_INPUT_MATERIALIZER_VERSION =
  "projection-input-materializer-v1";

const MAX_PLAY_ROWS_PER_GAME = 1_000;
const MAX_SHIFT_SOURCE_ROWS_PER_GAME = 20_000;
const MAX_STRENGTH_ROWS_PER_GAME = 100;
const MAX_RPC_PAYLOAD_BYTES = 4_000_000;
const SHA256_HEX = /^[a-f0-9]{64}$/;

export type ProjectionShiftSourceRow = {
  game_id: number;
  player_id: number;
  team_id: number;
  team_abbreviation: string;
  player_first_name: string;
  player_last_name: string;
  shift_number: number;
  period: number;
  start_time: string;
  end_time: string;
  duration: string | null;
  type_code: number;
};

export type ProjectionStrengthPersistenceRow = Omit<
  ShiftStrengthUpsert,
  "updated_at"
>;

export type ProjectionInputRpcPayload = {
  gameId: number;
  expectedCurrentInputFingerprint: string | null;
  pbpSourceHash: string;
  shiftSourceHash: string;
  rawSnapshots: ProjectionRawSourceSnapshotReceipt;
  parserVersion: string;
  materializerVersion: string;
  inputFingerprint: string;
  gameRow: PbpGamePersistenceRow;
  playRows: PbpPlayPersistenceRow[];
  strengthRows: ProjectionStrengthPersistenceRow[];
};

export type ProjectionInputPersistenceReceipt = {
  gameId: number;
  inputStatus: "complete";
  inputFingerprint: string;
  inputVersion: number;
  rawSnapshots: ProjectionRawSourceSnapshotReceipt;
  playCount: number;
  strengthCount: number;
  prunedPlayRows: number;
  prunedStrengthRows: number;
  idempotent: boolean;
  completedAt: string;
};

type ManifestRow = {
  input_status: unknown;
  input_fingerprint: unknown;
  input_version: unknown;
};

type RpcResult = { data: unknown; error: unknown };

type ProjectionInputPersistenceClient = {
  from(table: "projection_game_materialization_status"): {
    select(columns: string): {
      eq(
        column: "game_id",
        value: number,
      ): {
        maybeSingle(): Promise<{ data: unknown; error: unknown }>;
      };
    };
  };
  rpc(
    functionName: "persist_projection_game_inputs_v1",
    args: Record<string, unknown>,
  ): PromiseLike<RpcResult>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  if (isRecord(error) && typeof error.message === "string") {
    return new Error(error.message);
  }
  return new Error(fallback);
}

function isValidCompletedAt(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !Number.isNaN(Date.parse(value))
  );
}

function normalizeShiftSourceRows(
  rows: readonly NhleShiftRow[],
): ProjectionShiftSourceRow[] {
  if (rows.length === 0 || rows.length > MAX_SHIFT_SOURCE_ROWS_PER_GAME) {
    throw new Error(
      `Projection shift source row count must be between 1 and ${MAX_SHIFT_SOURCE_ROWS_PER_GAME}`,
    );
  }
  const gameId = rows[0]?.gameId;
  if (!Number.isSafeInteger(gameId) || (gameId ?? 0) <= 0) {
    throw new Error("Projection shift source has an invalid game identity");
  }

  const normalized = rows.map((row): ProjectionShiftSourceRow => ({
    game_id: row.gameId,
    player_id: row.playerId,
    team_id: row.teamId,
    team_abbreviation: row.teamAbbrev,
    player_first_name: row.firstName,
    player_last_name: row.lastName,
    shift_number: row.shiftNumber,
    period: row.period,
    start_time: row.startTime,
    end_time: row.endTime,
    duration: row.duration ?? null,
    type_code: row.typeCode,
  }));
  if (
    normalized.some(
      (row) =>
        row.game_id !== gameId ||
        !Number.isSafeInteger(row.player_id) ||
        !Number.isSafeInteger(row.team_id) ||
        !Number.isSafeInteger(row.shift_number) ||
        row.shift_number < 0 ||
        !Number.isSafeInteger(row.period) ||
        !Number.isSafeInteger(row.type_code),
    )
  ) {
    throw new Error("Projection shift source contains an invalid identity");
  }

  return normalized
    .map((row) => ({ row, sortKey: stableJsonStringify(row) }))
    .sort((left, right) =>
      left.sortKey < right.sortKey ? -1 : left.sortKey > right.sortKey ? 1 : 0,
    )
    .map(({ row }) => row);
}

/**
 * Hash the complete, all-pages NHL shift source independently of source array
 * order. Relationship and strength writers use this same source boundary.
 */
export function buildProjectionShiftSourceHash(
  rows: readonly NhleShiftRow[],
): string {
  return sha256CanonicalJson({ rows: normalizeShiftSourceRows(rows) });
}

export function buildProjectionPbpSourceHash(pbp: PbpResponse): string {
  const { gameRow, playRows } = buildPbpPersistenceRows(pbp);
  return sha256CanonicalJson({ game: gameRow, plays: playRows });
}

function normalizeStrengthRows(
  gameId: number,
  rows: readonly ShiftStrengthUpsert[],
): ProjectionStrengthPersistenceRow[] {
  if (rows.length === 0 || rows.length > MAX_STRENGTH_ROWS_PER_GAME) {
    throw new Error(
      `Projection strength row count must be between 1 and ${MAX_STRENGTH_ROWS_PER_GAME}`,
    );
  }

  const playerIds = new Set<number>();
  const normalized = rows.map((row): ProjectionStrengthPersistenceRow => {
    const { updated_at: _updatedAt, ...persistenceRow } = row;
    if (
      row.game_id !== gameId ||
      !Number.isSafeInteger(row.player_id) ||
      (row.player_id ?? 0) <= 0 ||
      playerIds.has(row.player_id as number)
    ) {
      throw new Error(
        `Projection strength rows have an invalid scope for game ${gameId}`,
      );
    }
    playerIds.add(row.player_id as number);
    return persistenceRow;
  });

  return normalized.sort(
    (left, right) => (left.player_id as number) - (right.player_id as number),
  );
}

export function buildProjectionInputRpcPayload(args: {
  gameId: number;
  pbp: PbpResponse;
  shiftSourceRows: readonly NhleShiftRow[];
  strengthRows: readonly ShiftStrengthUpsert[];
  rawSnapshots: ProjectionRawSourceSnapshotReceipt;
  expectedCurrentInputFingerprint: string | null;
}): ProjectionInputRpcPayload {
  if (!Number.isSafeInteger(args.gameId) || args.gameId <= 0) {
    throw new Error("Projection input payload has an invalid game identity");
  }
  if (
    args.expectedCurrentInputFingerprint !== null &&
    !SHA256_HEX.test(args.expectedCurrentInputFingerprint)
  ) {
    throw new Error("Projection input manifest has an invalid fingerprint");
  }
  if (
    args.rawSnapshots.gameId !== args.gameId ||
    !Number.isSafeInteger(args.rawSnapshots.pbp.rawPayloadId) ||
    args.rawSnapshots.pbp.rawPayloadId <= 0 ||
    !Number.isSafeInteger(args.rawSnapshots.pbp.snapshotVersion) ||
    args.rawSnapshots.pbp.snapshotVersion <= 0 ||
    !SHA256_HEX.test(args.rawSnapshots.pbp.payloadHash) ||
    !Number.isSafeInteger(args.rawSnapshots.shifts.rawPayloadId) ||
    args.rawSnapshots.shifts.rawPayloadId <= 0 ||
    !Number.isSafeInteger(args.rawSnapshots.shifts.snapshotVersion) ||
    args.rawSnapshots.shifts.snapshotVersion <= 0 ||
    !SHA256_HEX.test(args.rawSnapshots.shifts.payloadHash)
  ) {
    throw new Error("Projection input raw snapshot receipt is invalid");
  }

  const { gameRow, playRows } = buildPbpPersistenceRows(args.pbp);
  if (gameRow.id !== args.gameId) {
    throw new Error("Projection input PBP game identity mismatch");
  }
  if (args.shiftSourceRows.some((row) => row.gameId !== args.gameId)) {
    throw new Error("Projection input shift source game identity mismatch");
  }
  if (playRows.length === 0 || playRows.length > MAX_PLAY_ROWS_PER_GAME) {
    throw new Error(
      `Projection PBP play count must be between 1 and ${MAX_PLAY_ROWS_PER_GAME}`,
    );
  }
  const strengthRows = normalizeStrengthRows(args.gameId, args.strengthRows);
  const pbpSourceHash = sha256CanonicalJson({
    game: gameRow,
    plays: playRows,
  });
  const shiftSourceHash = buildProjectionShiftSourceHash(args.shiftSourceRows);
  const fingerprintDocument = {
    contract_version: 2,
    game_id: args.gameId,
    parser_version: PROJECTION_INPUT_PARSER_VERSION,
    materializer_version: PROJECTION_INPUT_MATERIALIZER_VERSION,
    pbp_source_hash: pbpSourceHash,
    shift_source_hash: shiftSourceHash,
    raw_source_snapshots: {
      pbp: {
        raw_payload_id: args.rawSnapshots.pbp.rawPayloadId,
        snapshot_version: args.rawSnapshots.pbp.snapshotVersion,
        payload_hash: args.rawSnapshots.pbp.payloadHash,
      },
      shifts: {
        raw_payload_id: args.rawSnapshots.shifts.rawPayloadId,
        snapshot_version: args.rawSnapshots.shifts.snapshotVersion,
        payload_hash: args.rawSnapshots.shifts.payloadHash,
      },
    },
    game_row: gameRow,
    play_rows: playRows,
    strength_rows: strengthRows,
  };
  if (
    Buffer.byteLength(stableJsonStringify(fingerprintDocument), "utf8") >
    MAX_RPC_PAYLOAD_BYTES
  ) {
    throw new Error(
      `Projection input RPC payload exceeds ${MAX_RPC_PAYLOAD_BYTES} bytes`,
    );
  }

  return {
    gameId: args.gameId,
    expectedCurrentInputFingerprint: args.expectedCurrentInputFingerprint,
    pbpSourceHash,
    shiftSourceHash,
    rawSnapshots: args.rawSnapshots,
    parserVersion: PROJECTION_INPUT_PARSER_VERSION,
    materializerVersion: PROJECTION_INPUT_MATERIALIZER_VERSION,
    inputFingerprint: sha256CanonicalJson(fingerprintDocument),
    gameRow,
    playRows,
    strengthRows,
  };
}

export async function readProjectionInputManifest(args: {
  supabase: SupabaseClient<Database>;
  gameId: number;
}): Promise<{ inputFingerprint: string; inputVersion: number } | null> {
  if (!Number.isSafeInteger(args.gameId) || args.gameId <= 0) {
    throw new Error(
      "Projection input manifest read has an invalid game identity",
    );
  }
  const client = args.supabase as unknown as ProjectionInputPersistenceClient;
  const { data, error } = await client
    .from("projection_game_materialization_status")
    .select("input_status,input_fingerprint,input_version")
    .eq("game_id", args.gameId)
    .maybeSingle();
  if (error) {
    throw toError(error, "Projection input manifest read failed");
  }
  if (data == null) return null;
  if (
    !isRecord(data) ||
    data.input_status !== "complete" ||
    typeof data.input_fingerprint !== "string" ||
    !SHA256_HEX.test(data.input_fingerprint) ||
    !Number.isSafeInteger(data.input_version) ||
    (data.input_version as number) <= 0
  ) {
    throw new Error("Projection input manifest is present but incomplete");
  }
  const row = data as ManifestRow;
  return {
    inputFingerprint: row.input_fingerprint as string,
    inputVersion: row.input_version as number,
  };
}

function parseReceipt(
  data: unknown,
  payload: ProjectionInputRpcPayload,
): ProjectionInputPersistenceReceipt {
  if (!Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) {
    throw new Error(
      "Projection input RPC did not return exactly one manifest receipt",
    );
  }
  const row = data[0];
  if (
    row.game_id !== payload.gameId ||
    row.input_status !== "complete" ||
    row.input_fingerprint !== payload.inputFingerprint ||
    !Number.isSafeInteger(row.input_version) ||
    (row.input_version as number) <= 0 ||
    row.pbp_raw_payload_id !== payload.rawSnapshots.pbp.rawPayloadId ||
    row.pbp_raw_snapshot_version !== payload.rawSnapshots.pbp.snapshotVersion ||
    row.pbp_raw_payload_hash !== payload.rawSnapshots.pbp.payloadHash ||
    row.shift_raw_payload_id !== payload.rawSnapshots.shifts.rawPayloadId ||
    row.shift_raw_snapshot_version !==
      payload.rawSnapshots.shifts.snapshotVersion ||
    row.shift_raw_payload_hash !== payload.rawSnapshots.shifts.payloadHash ||
    row.expected_play_rows !== payload.playRows.length ||
    row.observed_play_rows !== payload.playRows.length ||
    row.expected_strength_rows !== payload.strengthRows.length ||
    row.observed_strength_rows !== payload.strengthRows.length ||
    !Number.isSafeInteger(row.pruned_play_rows) ||
    (row.pruned_play_rows as number) < 0 ||
    !Number.isSafeInteger(row.pruned_strength_rows) ||
    (row.pruned_strength_rows as number) < 0 ||
    typeof row.idempotent !== "boolean" ||
    !isValidCompletedAt(row.completed_at)
  ) {
    throw new Error(
      "Projection input RPC returned an invalid manifest receipt",
    );
  }
  return {
    gameId: row.game_id as number,
    inputStatus: "complete",
    inputFingerprint: row.input_fingerprint as string,
    inputVersion: row.input_version as number,
    rawSnapshots: payload.rawSnapshots,
    playCount: row.observed_play_rows as number,
    strengthCount: row.observed_strength_rows as number,
    prunedPlayRows: row.pruned_play_rows as number,
    prunedStrengthRows: row.pruned_strength_rows as number,
    idempotent: row.idempotent,
    completedAt: row.completed_at,
  };
}

export async function persistProjectionGameInputs(args: {
  supabase: SupabaseClient<Database>;
  payload: ProjectionInputRpcPayload;
}): Promise<ProjectionInputPersistenceReceipt> {
  const client = args.supabase as unknown as ProjectionInputPersistenceClient;
  let result: RpcResult;
  try {
    result = await client.rpc("persist_projection_game_inputs_v1", {
      p_game_id: args.payload.gameId,
      p_expected_current_input_fingerprint:
        args.payload.expectedCurrentInputFingerprint,
      p_input_fingerprint: args.payload.inputFingerprint,
      p_pbp_source_hash: args.payload.pbpSourceHash,
      p_shift_source_hash: args.payload.shiftSourceHash,
      p_pbp_raw_payload_id: args.payload.rawSnapshots.pbp.rawPayloadId,
      p_pbp_raw_snapshot_version: args.payload.rawSnapshots.pbp.snapshotVersion,
      p_pbp_raw_payload_hash: args.payload.rawSnapshots.pbp.payloadHash,
      p_shift_raw_payload_id: args.payload.rawSnapshots.shifts.rawPayloadId,
      p_shift_raw_snapshot_version:
        args.payload.rawSnapshots.shifts.snapshotVersion,
      p_shift_raw_payload_hash: args.payload.rawSnapshots.shifts.payloadHash,
      p_parser_version: args.payload.parserVersion,
      p_materializer_version: args.payload.materializerVersion,
      p_game_row: args.payload.gameRow,
      p_play_rows: args.payload.playRows,
      p_strength_rows: args.payload.strengthRows,
      p_expected_play_rows: args.payload.playRows.length,
      p_expected_strength_rows: args.payload.strengthRows.length,
    });
  } catch (error) {
    throw toError(error, "Projection input RPC failed");
  }
  if (result.error) {
    throw toError(result.error, "Projection input RPC failed");
  }
  return parseReceipt(result.data, args.payload);
}
