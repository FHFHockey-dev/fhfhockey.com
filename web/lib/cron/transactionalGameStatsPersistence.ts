import type { SupabaseClient } from "@supabase/supabase-js";

import { sanitizeCronDiagnostic } from "./statsUpdateSafety";

const EXPECTED_TEAM_ROWS = 2;
const MAX_PLAYER_ROWS = 100;
const MAX_QUARANTINE_GAME_IDS = 10;
const SKATER_PLAYER_FK = "skatersgamestats_playerid_fkey";
const GOALIE_PLAYER_FK = "goaliesGameStats_playerId_fkey";

type TeamIdentityRow = {
  gameId: number;
  teamId: number;
};

type PlayerIdentityRow = {
  gameId: number;
  playerId: number;
};

type DatabaseErrorSummary = {
  code: string | null;
  message: string;
};

export type TransactionalGameStatsFailurePhase =
  | "validation"
  | "parent_lookup"
  | "parent_repair"
  | "parent_recheck"
  | "persistence_rpc"
  | "persistence_rpc_retry"
  | "receipt_validation"
  | "quarantine_rpc"
  | "quarantine_receipt_validation"
  | "non_realized_rpc"
  | "non_realized_receipt_validation";

export type GameStatsQuarantineReason =
  | "game_not_finished"
  | "schedule_not_realized";

export interface TransactionalGameStatsFailureDetails {
  kind: "transactional_game_stats_persistence_failure";
  code: "TRANSACTIONAL_GAME_STATS_PERSISTENCE_FAILED";
  phase: TransactionalGameStatsFailurePhase;
  gameId: number;
  requestedRows: number;
  expectedTeamRows: number;
  expectedSkaterRows: number;
  expectedGoalieRows: number;
  playerIds: number[];
  missingPlayerIds: number[];
  failedRepairPlayerId: number | null;
  terminalError: DatabaseErrorSummary;
}

export interface CompleteGameStatsManifestReceipt {
  gameId: number;
  outcome: "complete";
  contractVersion: 1;
  expectedTeamRows: number;
  observedTeamRows: number;
  expectedSkaterRows: number;
  observedSkaterRows: number;
  expectedGoalieRows: number;
  observedGoalieRows: number;
  prunedTeamRows: number;
  prunedSkaterRows: number;
  prunedGoalieRows: number;
  completedAt: string;
}

export interface QuarantinedGameStatsManifestReceipt {
  gameId: number;
  outcome: "quarantined";
  reason: GameStatsQuarantineReason;
  contractVersion: 1;
  expectedTeamRows: 0;
  observedTeamRows: 0;
  expectedSkaterRows: 0;
  observedSkaterRows: 0;
  expectedGoalieRows: 0;
  observedGoalieRows: 0;
  completedAt: string;
}

export class TransactionalGameStatsPersistenceError extends Error {
  readonly details: TransactionalGameStatsFailureDetails;

  constructor(details: TransactionalGameStatsFailureDetails) {
    super(
      `Failed the transactional game-stat contract for game ${details.gameId} during ${details.phase}.`,
    );
    this.name = "TransactionalGameStatsPersistenceError";
    this.details = details;
  }
}

type RepairMissingPlayer = (playerId: number) => Promise<void>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readErrorField(error: unknown, key: string): string | null {
  if (!isRecord(error)) return null;
  const value = error[key];
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

function createFailure(args: {
  phase: TransactionalGameStatsFailurePhase;
  gameId: number;
  expectedTeamRows?: number;
  expectedSkaterRows?: number;
  expectedGoalieRows?: number;
  playerIds?: number[];
  missingPlayerIds?: number[];
  failedRepairPlayerId?: number | null;
  terminalError: unknown;
}): TransactionalGameStatsPersistenceError {
  const expectedTeamRows = args.expectedTeamRows ?? 0;
  const expectedSkaterRows = args.expectedSkaterRows ?? 0;
  const expectedGoalieRows = args.expectedGoalieRows ?? 0;

  return new TransactionalGameStatsPersistenceError({
    kind: "transactional_game_stats_persistence_failure",
    code: "TRANSACTIONAL_GAME_STATS_PERSISTENCE_FAILED",
    phase: args.phase,
    gameId: args.gameId,
    requestedRows:
      expectedTeamRows + expectedSkaterRows + expectedGoalieRows || 1,
    expectedTeamRows,
    expectedSkaterRows,
    expectedGoalieRows,
    playerIds: (args.playerIds ?? []).slice(0, MAX_PLAYER_ROWS),
    missingPlayerIds: (args.missingPlayerIds ?? []).slice(0, MAX_PLAYER_ROWS),
    failedRepairPlayerId: args.failedRepairPlayerId ?? null,
    terminalError: summarizeDatabaseError(args.terminalError),
  });
}

function isExactPlayerForeignKeyViolation(error: unknown): boolean {
  if (readErrorField(error, "code") !== "23503") return false;

  const diagnostic = ["message", "details", "hint"]
    .map((key) => readErrorField(error, key) ?? "")
    .join(" ")
    .toLowerCase();

  return [SKATER_PLAYER_FK, GOALIE_PLAYER_FK].some((constraint) =>
    diagnostic.includes(constraint.toLowerCase()),
  );
}

function normalizePositiveIds(ids: number[]): number[] {
  return Array.from(new Set(ids)).sort((left, right) => left - right);
}

function validatePersistenceInput(args: {
  gameId: number;
  teamRows: TeamIdentityRow[];
  skaterRows: PlayerIdentityRow[];
  goalieRows: PlayerIdentityRow[];
}): { playerIds: number[] } {
  const { gameId, teamRows, skaterRows, goalieRows } = args;
  const teamIds = teamRows.map((row) => row.teamId);
  const skaterIds = skaterRows.map((row) => row.playerId);
  const goalieIds = goalieRows.map((row) => row.playerId);
  const playerIds = normalizePositiveIds([...skaterIds, ...goalieIds]);
  const invalid =
    !Number.isSafeInteger(gameId) ||
    gameId <= 0 ||
    teamRows.length !== EXPECTED_TEAM_ROWS ||
    new Set(teamIds).size !== EXPECTED_TEAM_ROWS ||
    skaterRows.length < 1 ||
    goalieRows.length < 1 ||
    skaterRows.length > MAX_PLAYER_ROWS ||
    goalieRows.length > MAX_PLAYER_ROWS ||
    skaterRows.length + goalieRows.length > MAX_PLAYER_ROWS ||
    new Set(skaterIds).size !== skaterIds.length ||
    new Set(goalieIds).size !== goalieIds.length ||
    skaterIds.some((playerId) => goalieIds.includes(playerId)) ||
    teamRows.some(
      (row) =>
        row.gameId !== gameId ||
        !Number.isSafeInteger(row.teamId) ||
        row.teamId <= 0,
    ) ||
    [...skaterRows, ...goalieRows].some(
      (row) =>
        row.gameId !== gameId ||
        !Number.isSafeInteger(row.playerId) ||
        row.playerId <= 0,
    );

  if (invalid) {
    throw createFailure({
      phase: "validation",
      gameId,
      expectedTeamRows: teamRows.length,
      expectedSkaterRows: skaterRows.length,
      expectedGoalieRows: goalieRows.length,
      playerIds,
      terminalError: {
        code: "INVALID_TRANSACTIONAL_GAME_STATS_INPUT",
        message:
          "Expected one positive game ID, two distinct teams, unique non-overlapping player batches, and at most 100 player rows.",
      },
    });
  }

  return { playerIds };
}

async function readExistingPlayerIds(args: {
  supabase: SupabaseClient;
  playerIds: number[];
  phase: "parent_lookup" | "parent_recheck";
  gameId: number;
  expectedTeamRows: number;
  expectedSkaterRows: number;
  expectedGoalieRows: number;
  missingPlayerIds?: number[];
}): Promise<Set<number>> {
  let data: unknown = null;
  let error: unknown = null;
  try {
    const result = await args.supabase
      .from("players")
      .select("id")
      .in("id", args.playerIds)
      .limit(args.playerIds.length);
    data = result.data;
    error = result.error;
  } catch (lookupError) {
    error = lookupError;
  }

  if (error || !Array.isArray(data)) {
    throw createFailure({
      phase: args.phase,
      gameId: args.gameId,
      expectedTeamRows: args.expectedTeamRows,
      expectedSkaterRows: args.expectedSkaterRows,
      expectedGoalieRows: args.expectedGoalieRows,
      playerIds: args.playerIds,
      missingPlayerIds: args.missingPlayerIds,
      terminalError: error ?? {
        code: "INVALID_PLAYER_PARENT_LOOKUP",
        message: "Player-parent lookup returned a non-array result.",
      },
    });
  }

  const existing = new Set<number>();
  for (const row of data) {
    const playerId = isRecord(row) ? row.id : null;
    if (
      typeof playerId !== "number" ||
      !Number.isSafeInteger(playerId) ||
      !args.playerIds.includes(playerId)
    ) {
      throw createFailure({
        phase: args.phase,
        gameId: args.gameId,
        expectedTeamRows: args.expectedTeamRows,
        expectedSkaterRows: args.expectedSkaterRows,
        expectedGoalieRows: args.expectedGoalieRows,
        playerIds: args.playerIds,
        missingPlayerIds: args.missingPlayerIds,
        terminalError: {
          code: "INVALID_PLAYER_PARENT_LOOKUP_ROWS",
          message: "Player-parent lookup returned an invalid identity row.",
        },
      });
    }
    existing.add(playerId);
  }

  return existing;
}

async function ensurePlayerParents(args: {
  supabase: SupabaseClient;
  gameId: number;
  playerIds: number[];
  expectedTeamRows: number;
  expectedSkaterRows: number;
  expectedGoalieRows: number;
  repairMissingPlayer: RepairMissingPlayer;
}): Promise<void> {
  const existing = await readExistingPlayerIds({
    ...args,
    phase: "parent_lookup",
  });
  const missingPlayerIds = args.playerIds.filter(
    (playerId) => !existing.has(playerId),
  );

  for (const playerId of missingPlayerIds) {
    try {
      await args.repairMissingPlayer(playerId);
    } catch (error) {
      throw createFailure({
        phase: "parent_repair",
        gameId: args.gameId,
        expectedTeamRows: args.expectedTeamRows,
        expectedSkaterRows: args.expectedSkaterRows,
        expectedGoalieRows: args.expectedGoalieRows,
        playerIds: args.playerIds,
        missingPlayerIds,
        failedRepairPlayerId: playerId,
        terminalError: error,
      });
    }
  }

  if (missingPlayerIds.length === 0) return;

  const repaired = await readExistingPlayerIds({
    ...args,
    phase: "parent_recheck",
    missingPlayerIds,
  });
  const stillMissing = args.playerIds.filter(
    (playerId) => !repaired.has(playerId),
  );
  if (stillMissing.length > 0) {
    throw createFailure({
      phase: "parent_recheck",
      gameId: args.gameId,
      expectedTeamRows: args.expectedTeamRows,
      expectedSkaterRows: args.expectedSkaterRows,
      expectedGoalieRows: args.expectedGoalieRows,
      playerIds: args.playerIds,
      missingPlayerIds: stillMissing,
      terminalError: {
        code: "PLAYER_PARENT_REPAIR_NOT_VISIBLE",
        message: "Repaired player parents were not visible on exact recheck.",
      },
    });
  }
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isCompletionTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Number.isFinite(Date.parse(value))
  );
}

function parseCompleteReceipt(args: {
  data: unknown;
  gameId: number;
  expectedTeamRows: number;
  expectedSkaterRows: number;
  expectedGoalieRows: number;
  playerIds: number[];
}): CompleteGameStatsManifestReceipt {
  const row =
    Array.isArray(args.data) && args.data.length === 1 ? args.data[0] : null;
  const valid =
    isRecord(row) &&
    row.game_id === args.gameId &&
    row.outcome === "complete" &&
    row.contract_version === 1 &&
    row.expected_team_rows === args.expectedTeamRows &&
    row.observed_team_rows === args.expectedTeamRows &&
    row.expected_skater_rows === args.expectedSkaterRows &&
    row.observed_skater_rows === args.expectedSkaterRows &&
    row.expected_goalie_rows === args.expectedGoalieRows &&
    row.observed_goalie_rows === args.expectedGoalieRows &&
    isNonNegativeInteger(row.pruned_team_rows) &&
    isNonNegativeInteger(row.pruned_skater_rows) &&
    isNonNegativeInteger(row.pruned_goalie_rows) &&
    isCompletionTimestamp(row.completed_at);

  if (!valid || !isRecord(row)) {
    throw createFailure({
      phase: "receipt_validation",
      gameId: args.gameId,
      expectedTeamRows: args.expectedTeamRows,
      expectedSkaterRows: args.expectedSkaterRows,
      expectedGoalieRows: args.expectedGoalieRows,
      playerIds: args.playerIds,
      terminalError: {
        code: "INVALID_TRANSACTIONAL_GAME_STATS_RECEIPT",
        message:
          "Persistence RPC did not return exactly one matching complete manifest receipt.",
      },
    });
  }

  return {
    gameId: row.game_id as number,
    outcome: "complete",
    contractVersion: 1,
    expectedTeamRows: row.expected_team_rows as number,
    observedTeamRows: row.observed_team_rows as number,
    expectedSkaterRows: row.expected_skater_rows as number,
    observedSkaterRows: row.observed_skater_rows as number,
    expectedGoalieRows: row.expected_goalie_rows as number,
    observedGoalieRows: row.observed_goalie_rows as number,
    prunedTeamRows: row.pruned_team_rows as number,
    prunedSkaterRows: row.pruned_skater_rows as number,
    prunedGoalieRows: row.pruned_goalie_rows as number,
    completedAt: row.completed_at as string,
  };
}

async function callPersistenceRpc(args: {
  supabase: SupabaseClient;
  gameId: number;
  teamRows: TeamIdentityRow[];
  skaterRows: PlayerIdentityRow[];
  goalieRows: PlayerIdentityRow[];
}): Promise<{ data: unknown; error: unknown }> {
  try {
    const result = await args.supabase.rpc("persist_complete_game_stats_v1", {
      p_game_id: args.gameId,
      p_team_rows: args.teamRows,
      p_skater_rows: args.skaterRows,
      p_goalie_rows: args.goalieRows,
      p_expected_team_rows: args.teamRows.length,
      p_expected_skater_rows: args.skaterRows.length,
      p_expected_goalie_rows: args.goalieRows.length,
    });
    return { data: result.data, error: result.error };
  } catch (error) {
    return { data: null, error };
  }
}

function normalizeGoalieRows<TGoalie extends PlayerIdentityRow>(
  rows: TGoalie[],
): Array<TGoalie & Record<string, unknown>> {
  return rows.map((row) => {
    const source = row as TGoalie & Record<string, unknown>;
    return {
      ...source,
      position: "G",
      evenStrengthShotsAgainst: source.evenStrengthShotsAgainst ?? "0/0",
      powerPlayShotsAgainst: source.powerPlayShotsAgainst ?? "0/0",
      shorthandedShotsAgainst: source.shorthandedShotsAgainst ?? "0/0",
      saveShotsAgainst: source.saveShotsAgainst ?? "0/0",
      evenStrengthGoalsAgainst: source.evenStrengthGoalsAgainst ?? 0,
      powerPlayGoalsAgainst: source.powerPlayGoalsAgainst ?? 0,
      shorthandedGoalsAgainst: source.shorthandedGoalsAgainst ?? 0,
      pim: source.pim ?? 0,
      goalsAgainst: source.goalsAgainst ?? 0,
      toi: source.toi ?? "00:00",
      savePctg: source.savePctg ?? 0,
    };
  });
}

export async function persistCompleteGameStatsTransaction<
  TTeam extends TeamIdentityRow,
  TSkater extends PlayerIdentityRow,
  TGoalie extends PlayerIdentityRow,
>(args: {
  supabase: SupabaseClient;
  gameId: number;
  teamRows: TTeam[];
  skaterRows: TSkater[];
  goalieRows: TGoalie[];
  repairMissingPlayer: RepairMissingPlayer;
}): Promise<CompleteGameStatsManifestReceipt> {
  const normalizedGoalieRows = normalizeGoalieRows(args.goalieRows);
  const counts = {
    expectedTeamRows: args.teamRows.length,
    expectedSkaterRows: args.skaterRows.length,
    expectedGoalieRows: normalizedGoalieRows.length,
  };
  const { playerIds } = validatePersistenceInput({
    gameId: args.gameId,
    teamRows: args.teamRows,
    skaterRows: args.skaterRows,
    goalieRows: normalizedGoalieRows,
  });

  await ensurePlayerParents({
    supabase: args.supabase,
    gameId: args.gameId,
    playerIds,
    ...counts,
    repairMissingPlayer: args.repairMissingPlayer,
  });

  let result = await callPersistenceRpc({
    supabase: args.supabase,
    gameId: args.gameId,
    teamRows: args.teamRows,
    skaterRows: args.skaterRows,
    goalieRows: normalizedGoalieRows,
  });

  if (result.error && isExactPlayerForeignKeyViolation(result.error)) {
    await ensurePlayerParents({
      supabase: args.supabase,
      gameId: args.gameId,
      playerIds,
      ...counts,
      repairMissingPlayer: args.repairMissingPlayer,
    });
    result = await callPersistenceRpc({
      supabase: args.supabase,
      gameId: args.gameId,
      teamRows: args.teamRows,
      skaterRows: args.skaterRows,
      goalieRows: normalizedGoalieRows,
    });
    if (result.error) {
      throw createFailure({
        phase: "persistence_rpc_retry",
        gameId: args.gameId,
        ...counts,
        playerIds,
        terminalError: result.error,
      });
    }
  } else if (result.error) {
    throw createFailure({
      phase: "persistence_rpc",
      gameId: args.gameId,
      ...counts,
      playerIds,
      terminalError: result.error,
    });
  }

  return parseCompleteReceipt({
    data: result.data,
    gameId: args.gameId,
    ...counts,
    playerIds,
  });
}

export async function quarantineGameStatsBatch(args: {
  supabase: SupabaseClient;
  gameIds: number[];
  reason: "game_not_finished";
}): Promise<QuarantinedGameStatsManifestReceipt[]> {
  const gameIds = normalizePositiveIds(args.gameIds);
  if (
    gameIds.length !== args.gameIds.length ||
    gameIds.length < 1 ||
    gameIds.length > MAX_QUARANTINE_GAME_IDS ||
    gameIds.some((gameId) => !Number.isSafeInteger(gameId) || gameId <= 0) ||
    args.reason !== "game_not_finished"
  ) {
    throw createFailure({
      phase: "validation",
      gameId: gameIds[0] ?? 0,
      terminalError: {
        code: "INVALID_GAME_STATS_QUARANTINE_INPUT",
        message:
          "Expected one through ten distinct positive game IDs and an allowlisted reason.",
      },
    });
  }

  let data: unknown = null;
  let error: unknown = null;
  try {
    const result = await args.supabase.rpc("quarantine_game_stats_v1", {
      p_game_ids: gameIds,
      p_reason: args.reason,
    });
    data = result.data;
    error = result.error;
  } catch (rpcError) {
    error = rpcError;
  }

  if (error) {
    throw createFailure({
      phase: "quarantine_rpc",
      gameId: gameIds[0],
      terminalError: error,
    });
  }

  const rows = Array.isArray(data) ? data : [];
  const returnedIds: number[] = [];
  const receipts: QuarantinedGameStatsManifestReceipt[] = [];
  for (const row of rows) {
    const valid =
      isRecord(row) &&
      typeof row.game_id === "number" &&
      Number.isSafeInteger(row.game_id) &&
      row.outcome === "quarantined" &&
      row.reason === "game_not_finished" &&
      row.contract_version === 1 &&
      row.expected_team_rows === 0 &&
      row.observed_team_rows === 0 &&
      row.expected_skater_rows === 0 &&
      row.observed_skater_rows === 0 &&
      row.expected_goalie_rows === 0 &&
      row.observed_goalie_rows === 0 &&
      isCompletionTimestamp(row.completed_at);
    if (!valid || !isRecord(row)) break;

    returnedIds.push(row.game_id as number);
    receipts.push({
      gameId: row.game_id as number,
      outcome: "quarantined",
      reason: "game_not_finished",
      contractVersion: 1,
      expectedTeamRows: 0,
      observedTeamRows: 0,
      expectedSkaterRows: 0,
      observedSkaterRows: 0,
      expectedGoalieRows: 0,
      observedGoalieRows: 0,
      completedAt: row.completed_at as string,
    });
  }

  returnedIds.sort((left, right) => left - right);
  const exactSet =
    receipts.length === gameIds.length &&
    returnedIds.every((gameId, index) => gameId === gameIds[index]);
  if (!exactSet) {
    throw createFailure({
      phase: "quarantine_receipt_validation",
      gameId: gameIds[0],
      terminalError: {
        code: "INVALID_GAME_STATS_QUARANTINE_RECEIPT",
        message:
          "Quarantine RPC did not return the exact expected terminal manifest set.",
      },
    });
  }

  return receipts.sort((left, right) => left.gameId - right.gameId);
}

export async function finalizeScheduleNotRealizedGameStats(args: {
  supabase: SupabaseClient;
  gameId: number;
}): Promise<QuarantinedGameStatsManifestReceipt> {
  if (!Number.isSafeInteger(args.gameId) || args.gameId <= 0) {
    throw createFailure({
      phase: "validation",
      gameId: args.gameId,
      terminalError: {
        code: "INVALID_NON_REALIZED_GAME_STATS_ID",
        message: "Expected one positive game ID.",
      },
    });
  }

  let data: unknown = null;
  let error: unknown = null;
  try {
    const result = await args.supabase.rpc(
      "finalize_non_realized_game_stats_v1",
      { p_game_id: args.gameId },
    );
    data = result.data;
    error = result.error;
  } catch (rpcError) {
    error = rpcError;
  }

  if (error) {
    throw createFailure({
      phase: "non_realized_rpc",
      gameId: args.gameId,
      terminalError: error,
    });
  }

  const row = Array.isArray(data) && data.length === 1 ? data[0] : null;
  const valid =
    isRecord(row) &&
    row.game_id === args.gameId &&
    row.outcome === "quarantined" &&
    row.reason === "schedule_not_realized" &&
    row.contract_version === 1 &&
    row.expected_team_rows === 0 &&
    row.observed_team_rows === 0 &&
    row.expected_skater_rows === 0 &&
    row.observed_skater_rows === 0 &&
    row.expected_goalie_rows === 0 &&
    row.observed_goalie_rows === 0 &&
    isCompletionTimestamp(row.completed_at);

  if (!valid || !isRecord(row)) {
    throw createFailure({
      phase: "non_realized_receipt_validation",
      gameId: args.gameId,
      terminalError: {
        code: "INVALID_NON_REALIZED_GAME_STATS_RECEIPT",
        message:
          "Terminalization RPC did not return exactly one matching schedule-not-realized manifest receipt.",
      },
    });
  }

  return {
    gameId: args.gameId,
    outcome: "quarantined",
    reason: "schedule_not_realized",
    contractVersion: 1,
    expectedTeamRows: 0,
    observedTeamRows: 0,
    expectedSkaterRows: 0,
    observedSkaterRows: 0,
    expectedGoalieRows: 0,
    observedGoalieRows: 0,
    completedAt: row.completed_at as string,
  };
}

export function getTransactionalGameStatsFailureDetails(
  error: unknown,
): TransactionalGameStatsFailureDetails | null {
  return error instanceof TransactionalGameStatsPersistenceError
    ? error.details
    : null;
}
