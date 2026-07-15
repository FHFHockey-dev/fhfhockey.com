import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeCronDiagnostic } from "./statsUpdateSafety";

const MAX_PLAYER_IDS_PER_GAME = 100;
const SKATER_PLAYER_FK = "skatersgamestats_playerid_fkey";
const GOALIE_PLAYER_FK = "goaliesGameStats_playerId_fkey";

export interface PlayerGameStatRecord {
  playerId: number;
  gameId: number;
}

type DatabaseErrorSummary = {
  code: string | null;
  message: string;
};

export type PlayerGameStatsFailurePhase =
  | "validation"
  | "initial_upsert"
  | "parent_lookup"
  | "parent_repair"
  | "retry_upsert";

export type SkaterGameStatsFailurePhase = PlayerGameStatsFailurePhase;
export type GoalieGameStatsFailurePhase = PlayerGameStatsFailurePhase;

interface PlayerGameStatsBatchFailureBase {
  phase: PlayerGameStatsFailurePhase;
  gameId: number;
  requestedRows: number;
  playerIds: number[];
  missingPlayerIds: number[];
  failedRepairPlayerId: number | null;
  initialError: DatabaseErrorSummary | null;
  terminalError: DatabaseErrorSummary;
}

export interface SkaterGameStatsBatchFailureDetails extends PlayerGameStatsBatchFailureBase {
  kind: "skater_game_stats_batch_failure";
  code: "SKATER_GAME_STATS_BATCH_FAILED";
}

export interface GoalieGameStatsBatchFailureDetails extends PlayerGameStatsBatchFailureBase {
  kind: "goalie_game_stats_batch_failure";
  code: "GOALIE_GAME_STATS_BATCH_FAILED";
}

export type PlayerGameStatsBatchFailureDetails =
  | SkaterGameStatsBatchFailureDetails
  | GoalieGameStatsBatchFailureDetails;

export class SkaterGameStatsBatchError extends Error {
  readonly details: SkaterGameStatsBatchFailureDetails;

  constructor(details: SkaterGameStatsBatchFailureDetails) {
    super(
      `Failed to persist the ${details.requestedRows}-row skater game-stat batch for game ${details.gameId} during ${details.phase}.`,
    );
    this.name = "SkaterGameStatsBatchError";
    this.details = details;
  }
}

export class GoalieGameStatsBatchError extends Error {
  readonly details: GoalieGameStatsBatchFailureDetails;

  constructor(details: GoalieGameStatsBatchFailureDetails) {
    super(
      `Failed to persist the ${details.requestedRows}-row goalie game-stat batch for game ${details.gameId} during ${details.phase}.`,
    );
    this.name = "GoalieGameStatsBatchError";
    this.details = details;
  }
}

type RepairMissingPlayer = (playerId: number) => Promise<void>;
type PlayerGameStatsTable = "skatersGameStats" | "goaliesGameStats";

type PersistenceConfig = {
  tableName: PlayerGameStatsTable;
  playerForeignKeyName: string;
  invalidBatchCode: string;
  createError: (
    details: PlayerGameStatsBatchFailureBase,
  ) => SkaterGameStatsBatchError | GoalieGameStatsBatchError;
};

function readErrorField(error: unknown, key: string): string | null {
  if (!error || typeof error !== "object") return null;
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function summarizeDatabaseError(error: unknown): DatabaseErrorSummary {
  const message =
    readErrorField(error, "message") ??
    (error instanceof Error ? error.message : String(error));

  return {
    code: readErrorField(error, "code"),
    message: sanitizeCronDiagnostic(message),
  };
}

function isExactNamedPlayerForeignKeyViolation(
  error: unknown,
  constraintName: string,
): boolean {
  if (readErrorField(error, "code") !== "23503") return false;

  const diagnostic = ["message", "details", "hint"]
    .map((key) => readErrorField(error, key) ?? "")
    .join(" ")
    .toLowerCase();

  return diagnostic.includes(constraintName.toLowerCase());
}

function buildFailureBase(args: {
  phase: PlayerGameStatsFailurePhase;
  gameId: number;
  requestedRows: number;
  playerIds: number[];
  missingPlayerIds?: number[];
  failedRepairPlayerId?: number | null;
  initialError?: unknown;
  terminalError: unknown;
}): PlayerGameStatsBatchFailureBase {
  return {
    phase: args.phase,
    gameId: args.gameId,
    requestedRows: args.requestedRows,
    playerIds: args.playerIds,
    missingPlayerIds: args.missingPlayerIds ?? [],
    failedRepairPlayerId: args.failedRepairPlayerId ?? null,
    initialError:
      args.initialError == null
        ? null
        : summarizeDatabaseError(args.initialError),
    terminalError: summarizeDatabaseError(args.terminalError),
  };
}

async function upsertFullBatch(
  supabase: SupabaseClient,
  tableName: PlayerGameStatsTable,
  rows: PlayerGameStatRecord[],
): Promise<unknown | null> {
  try {
    const { error } = await supabase.from(tableName).upsert(rows);
    return error;
  } catch (error) {
    return error;
  }
}

async function persistPlayerGameStatsBatch(args: {
  supabase: SupabaseClient;
  rows: PlayerGameStatRecord[];
  gameId: number;
  repairMissingPlayer: RepairMissingPlayer;
  config: PersistenceConfig;
}): Promise<number> {
  const { supabase, rows, gameId, repairMissingPlayer, config } = args;

  if (rows.length === 0) return 0;

  const playerIds = Array.from(new Set(rows.map((row) => row.playerId)));
  const invalidBatch =
    !Number.isInteger(gameId) ||
    gameId <= 0 ||
    playerIds.length === 0 ||
    playerIds.length > MAX_PLAYER_IDS_PER_GAME ||
    rows.some(
      (row) =>
        !Number.isInteger(row.playerId) ||
        row.playerId <= 0 ||
        !Number.isInteger(row.gameId) ||
        row.gameId !== gameId,
    );

  if (invalidBatch) {
    throw config.createError(
      buildFailureBase({
        phase: "validation",
        gameId,
        requestedRows: rows.length,
        playerIds,
        terminalError: {
          code: config.invalidBatchCode,
          message: `Expected one positive game ID and no more than ${MAX_PLAYER_IDS_PER_GAME} positive player IDs.`,
        },
      }),
    );
  }

  const initialError = await upsertFullBatch(supabase, config.tableName, rows);
  if (!initialError) return rows.length;

  if (
    !isExactNamedPlayerForeignKeyViolation(
      initialError,
      config.playerForeignKeyName,
    )
  ) {
    throw config.createError(
      buildFailureBase({
        phase: "initial_upsert",
        gameId,
        requestedRows: rows.length,
        playerIds,
        initialError,
        terminalError: initialError,
      }),
    );
  }

  let parentLookup: {
    data: Array<{ id: number }> | null;
    error: unknown | null;
  };
  try {
    parentLookup = await supabase
      .from("players")
      .select("id")
      .in("id", playerIds)
      .limit(playerIds.length);
  } catch (error) {
    throw config.createError(
      buildFailureBase({
        phase: "parent_lookup",
        gameId,
        requestedRows: rows.length,
        playerIds,
        initialError,
        terminalError: error,
      }),
    );
  }

  if (parentLookup.error) {
    throw config.createError(
      buildFailureBase({
        phase: "parent_lookup",
        gameId,
        requestedRows: rows.length,
        playerIds,
        initialError,
        terminalError: parentLookup.error,
      }),
    );
  }

  const existingPlayerIds = new Set(
    (parentLookup.data ?? [])
      .map((row) => row.id)
      .filter((id) => Number.isInteger(id) && id > 0),
  );
  const missingPlayerIds = playerIds.filter(
    (playerId) => !existingPlayerIds.has(playerId),
  );

  for (const playerId of missingPlayerIds) {
    try {
      await repairMissingPlayer(playerId);
    } catch (error) {
      throw config.createError(
        buildFailureBase({
          phase: "parent_repair",
          gameId,
          requestedRows: rows.length,
          playerIds,
          missingPlayerIds,
          failedRepairPlayerId: playerId,
          initialError,
          terminalError: error,
        }),
      );
    }
  }

  const retryError = await upsertFullBatch(supabase, config.tableName, rows);
  if (retryError) {
    throw config.createError(
      buildFailureBase({
        phase: "retry_upsert",
        gameId,
        requestedRows: rows.length,
        playerIds,
        missingPlayerIds,
        initialError,
        terminalError: retryError,
      }),
    );
  }

  return rows.length;
}

export async function persistSkaterGameStatsBatch(args: {
  supabase: SupabaseClient;
  rows: PlayerGameStatRecord[];
  gameId: number;
  repairMissingPlayer: RepairMissingPlayer;
}): Promise<number> {
  return persistPlayerGameStatsBatch({
    ...args,
    config: {
      tableName: "skatersGameStats",
      playerForeignKeyName: SKATER_PLAYER_FK,
      invalidBatchCode: "INVALID_SKATER_GAME_STATS_BATCH",
      createError: (details) =>
        new SkaterGameStatsBatchError({
          ...details,
          kind: "skater_game_stats_batch_failure",
          code: "SKATER_GAME_STATS_BATCH_FAILED",
        }),
    },
  });
}

export async function persistGoalieGameStatsBatch(args: {
  supabase: SupabaseClient;
  rows: PlayerGameStatRecord[];
  gameId: number;
  repairMissingPlayer: RepairMissingPlayer;
}): Promise<number> {
  return persistPlayerGameStatsBatch({
    ...args,
    config: {
      tableName: "goaliesGameStats",
      playerForeignKeyName: GOALIE_PLAYER_FK,
      invalidBatchCode: "INVALID_GOALIE_GAME_STATS_BATCH",
      createError: (details) =>
        new GoalieGameStatsBatchError({
          ...details,
          kind: "goalie_game_stats_batch_failure",
          code: "GOALIE_GAME_STATS_BATCH_FAILED",
        }),
    },
  });
}

export function getSkaterGameStatsBatchFailureDetails(
  error: unknown,
): SkaterGameStatsBatchFailureDetails | null {
  return error instanceof SkaterGameStatsBatchError ? error.details : null;
}

export function getGoalieGameStatsBatchFailureDetails(
  error: unknown,
): GoalieGameStatsBatchFailureDetails | null {
  return error instanceof GoalieGameStatsBatchError ? error.details : null;
}

export function getPlayerGameStatsBatchFailureDetails(
  error: unknown,
): PlayerGameStatsBatchFailureDetails | null {
  return (
    getSkaterGameStatsBatchFailureDetails(error) ??
    getGoalieGameStatsBatchFailureDetails(error)
  );
}
