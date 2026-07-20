import supabase from "lib/supabase/server";

import { sha256CanonicalJson } from "./materializationFingerprint";
import type { ShiftChartRelationshipUpsert } from "./shiftChartRelationshipPayload";

export const SHIFT_RELATIONSHIP_ALGORITHM_VERSION =
  "shift_relationship_materializer_v2_pbp_bound";

type MaterializationStatus = {
  input_fingerprint: string;
  input_status: string;
  input_version: number;
  pbp_source_hash: string;
  shift_source_hash: string;
};

type RelationshipReceiptRow = {
  game_id: number;
  input_fingerprint: string;
  input_version: number;
  relationship_status: string;
  relationship_fingerprint: string;
  relationship_version: number;
  algorithm_version: string;
  expected_rows: number;
  observed_rows: number;
  pruned_rows: number;
  idempotent: boolean;
  completed_at: string;
};

export type ShiftRelationshipReceipt = {
  gameId: number;
  inputFingerprint: string;
  inputVersion: number;
  relationshipFingerprint: string;
  relationshipVersion: number;
  relationshipRows: number;
  prunedRows: number;
  idempotent: boolean;
  completedAt: string;
};

export type RelationshipQueueGame = {
  id: number;
  date: string;
};

export type RelationshipQueueStatus = {
  game_id: number;
  input_status: string;
  input_fingerprint: string | null;
  relationship_status: string;
  relationship_input_fingerprint: string | null;
  relationship_algorithm_version: string | null;
};

function requireHash(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

function requirePositiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new Error(`Invalid ${field}`);
  }
  return Number(value);
}

export function selectPendingRelationshipGameIds(args: {
  games: readonly RelationshipQueueGame[];
  statuses: readonly RelationshipQueueStatus[];
  maxGames: number;
}): number[] {
  if (!Number.isSafeInteger(args.maxGames) || args.maxGames <= 0) {
    throw new Error("Invalid relationship queue bound");
  }

  const statusByGame = new Map<number, RelationshipQueueStatus>();
  for (const status of args.statuses) {
    const gameId = requirePositiveInteger(status.game_id, "queue game ID");
    if (
      status.input_status !== "complete" ||
      statusByGame.has(gameId) ||
      status.input_fingerprint == null
    ) {
      throw new Error(`Invalid relationship queue status for game ${gameId}`);
    }
    requireHash(status.input_fingerprint, "queue input fingerprint");
    if (status.relationship_input_fingerprint != null) {
      requireHash(
        status.relationship_input_fingerprint,
        "queue relationship input fingerprint",
      );
    }
    if (
      status.relationship_algorithm_version != null &&
      (typeof status.relationship_algorithm_version !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,127}$/.test(
          status.relationship_algorithm_version,
        ))
    ) {
      throw new Error(
        `Invalid relationship queue algorithm for game ${gameId}`,
      );
    }
    statusByGame.set(gameId, status);
  }

  const seenGames = new Set<number>();
  const games = args.games.map((game) => {
    const gameId = requirePositiveInteger(game.id, "queue game ID");
    if (
      seenGames.has(gameId) ||
      typeof game.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(game.date)
    ) {
      throw new Error(`Invalid relationship queue game ${gameId}`);
    }
    seenGames.add(gameId);
    return { id: gameId, date: game.date };
  });

  return games
    .filter((game) => {
      const status = statusByGame.get(game.id);
      return (
        status != null &&
        (status.relationship_status !== "complete" ||
          status.relationship_input_fingerprint !== status.input_fingerprint ||
          status.relationship_algorithm_version !==
            SHIFT_RELATIONSHIP_ALGORITHM_VERSION)
      );
    })
    .sort((left, right) =>
      left.date === right.date
        ? left.id - right.id
        : left.date.localeCompare(right.date),
    )
    .slice(0, args.maxGames)
    .map((game) => game.id);
}

export function buildShiftRelationshipFingerprint(args: {
  inputFingerprint: string;
  algorithmVersion?: string;
  rows: readonly ShiftChartRelationshipUpsert[];
}): string {
  const inputFingerprint = requireHash(
    args.inputFingerprint,
    "input fingerprint",
  );
  const algorithmVersion =
    args.algorithmVersion ?? SHIFT_RELATIONSHIP_ALGORITHM_VERSION;
  if (!algorithmVersion.trim()) {
    throw new Error("Invalid relationship algorithm version");
  }

  const rows = [...args.rows].sort(
    (left, right) =>
      Number(left.game_id) - Number(right.game_id) ||
      Number(left.player_id) - Number(right.player_id),
  );

  return sha256CanonicalJson({
    algorithmVersion,
    inputFingerprint,
    rows,
  });
}

export async function persistShiftChartRelationships(args: {
  gameId: number;
  sourcePbpHash: string;
  sourceShiftHash: string;
  rows: readonly ShiftChartRelationshipUpsert[];
  algorithmVersion?: string;
}): Promise<ShiftRelationshipReceipt> {
  const gameId = requirePositiveInteger(args.gameId, "game ID");
  const sourcePbpHash = requireHash(args.sourcePbpHash, "PBP source hash");
  const sourceShiftHash = requireHash(
    args.sourceShiftHash,
    "shift source hash",
  );
  const algorithmVersion =
    args.algorithmVersion ?? SHIFT_RELATIONSHIP_ALGORITHM_VERSION;
  const rows = [...args.rows].sort(
    (left, right) => Number(left.player_id) - Number(right.player_id),
  );

  if (
    rows.length === 0 ||
    rows.some(
      (row) =>
        Number(row.game_id) !== gameId ||
        !Number.isSafeInteger(Number(row.player_id)) ||
        Number(row.player_id) <= 0,
    ) ||
    new Set(rows.map((row) => Number(row.player_id))).size !== rows.length
  ) {
    throw new Error(
      `Invalid relationship replacement scope for game ${gameId}`,
    );
  }

  const db = supabase as any;
  if (!db) throw new Error("Supabase server client not available");

  const { data: statusData, error: statusError } = await db
    .from("projection_game_materialization_status")
    .select(
      "input_fingerprint,input_status,input_version,pbp_source_hash,shift_source_hash",
    )
    .eq("game_id", gameId)
    .maybeSingle();
  if (statusError) throw statusError;

  const status = statusData as MaterializationStatus | null;
  if (
    !status ||
    status.input_status !== "complete" ||
    !Number.isSafeInteger(status.input_version) ||
    status.input_version <= 0
  ) {
    throw new Error(`Projection inputs are not complete for game ${gameId}`);
  }
  const inputFingerprint = requireHash(
    status.input_fingerprint,
    "stored input fingerprint",
  );
  if (
    requireHash(status.pbp_source_hash, "stored PBP source hash") !==
    sourcePbpHash
  ) {
    throw new Error(
      `PBP source fingerprint does not match projection inputs for game ${gameId}`,
    );
  }
  if (
    requireHash(status.shift_source_hash, "stored shift source hash") !==
    sourceShiftHash
  ) {
    throw new Error(
      `Shift source fingerprint does not match projection inputs for game ${gameId}`,
    );
  }

  const relationshipFingerprint = buildShiftRelationshipFingerprint({
    inputFingerprint,
    algorithmVersion,
    rows,
  });
  const { data: receiptData, error: receiptError } = await db.rpc(
    "persist_shift_chart_relationships_v1",
    {
      p_algorithm_version: algorithmVersion,
      p_expected_input_fingerprint: inputFingerprint,
      p_expected_input_version: status.input_version,
      p_expected_rows: rows.length,
      p_game_id: gameId,
      p_relationship_fingerprint: relationshipFingerprint,
      p_rows: rows,
    },
  );
  if (receiptError) throw receiptError;

  const receipts = Array.isArray(receiptData)
    ? receiptData
    : receiptData
      ? [receiptData]
      : [];
  if (receipts.length !== 1) {
    throw new Error(`Missing relationship receipt for game ${gameId}`);
  }
  const receipt = receipts[0] as RelationshipReceiptRow;
  if (
    receipt.game_id !== gameId ||
    receipt.input_fingerprint !== inputFingerprint ||
    receipt.input_version !== status.input_version ||
    receipt.relationship_status !== "complete" ||
    receipt.relationship_fingerprint !== relationshipFingerprint ||
    receipt.algorithm_version !== algorithmVersion ||
    receipt.expected_rows !== rows.length ||
    receipt.observed_rows !== rows.length ||
    !Number.isSafeInteger(receipt.pruned_rows) ||
    receipt.pruned_rows < 0 ||
    !Number.isSafeInteger(receipt.relationship_version) ||
    receipt.relationship_version <= 0 ||
    typeof receipt.idempotent !== "boolean" ||
    typeof receipt.completed_at !== "string"
  ) {
    throw new Error(`Invalid relationship receipt for game ${gameId}`);
  }

  return {
    gameId: receipt.game_id,
    inputFingerprint: receipt.input_fingerprint,
    inputVersion: receipt.input_version,
    relationshipFingerprint: receipt.relationship_fingerprint,
    relationshipVersion: receipt.relationship_version,
    relationshipRows: receipt.observed_rows,
    prunedRows: receipt.pruned_rows,
    idempotent: receipt.idempotent,
    completedAt: receipt.completed_at,
  };
}
