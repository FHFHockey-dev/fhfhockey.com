import { sanitizeCronDiagnostic } from "./statsUpdateSafety";

const MAX_DIAGNOSTIC_GAME_IDS = 20;

export type StatsStatusAdvancementPhase =
  | "normal_completion"
  | "stale_quarantine";

type DatabaseErrorSummary = {
  code: string | null;
  message: string;
};

export interface StatsStatusAdvancementFailureDetails {
  kind: "stats_status_advancement_failure";
  code: "STATS_STATUS_ADVANCEMENT_FAILED";
  phase: StatsStatusAdvancementPhase;
  gameId: number;
  requestedRows: number;
  expectedGameIds: number[];
  returnedGameIds: number[];
  terminalError: DatabaseErrorSummary;
}

export class StatsStatusAdvancementError extends Error {
  readonly details: StatsStatusAdvancementFailureDetails;

  constructor(details: StatsStatusAdvancementFailureDetails) {
    super(
      `Failed to prove ${details.phase} status advancement for ${details.requestedRows} game(s).`,
    );
    this.name = "StatsStatusAdvancementError";
    this.details = details;
  }
}

function readErrorField(error: unknown, key: string): string | null {
  if (!error || typeof error !== "object") return null;
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function summarizeDatabaseError(
  error: unknown,
  fallbackMessage: string,
): DatabaseErrorSummary {
  const message =
    readErrorField(error, "message") ??
    (error instanceof Error ? error.message : fallbackMessage);

  return {
    code: readErrorField(error, "code"),
    message: sanitizeCronDiagnostic(message),
  };
}

function normalizeExpectedGameIds(gameIds: number[]): number[] {
  return Array.from(new Set(gameIds)).sort((left, right) => left - right);
}

function readReturnedGameIds(data: unknown): {
  gameIds: number[];
  valid: boolean;
} {
  if (!Array.isArray(data)) return { gameIds: [], valid: false };

  const gameIds: number[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") {
      return {
        gameIds: gameIds.slice(0, MAX_DIAGNOSTIC_GAME_IDS),
        valid: false,
      };
    }
    const gameId = (row as { gameId?: unknown }).gameId;
    if (
      typeof gameId !== "number" ||
      !Number.isSafeInteger(gameId) ||
      gameId <= 0
    ) {
      return {
        gameIds: gameIds.slice(0, MAX_DIAGNOSTIC_GAME_IDS),
        valid: false,
      };
    }
    gameIds.push(Number(gameId));
  }

  return {
    gameIds: Array.from(new Set(gameIds))
      .sort((left, right) => left - right)
      .slice(0, MAX_DIAGNOSTIC_GAME_IDS),
    valid: new Set(gameIds).size === gameIds.length,
  };
}

export function assertExactStatsStatusAdvancement(args: {
  phase: StatsStatusAdvancementPhase;
  expectedGameIds: number[];
  data: unknown;
  error?: unknown;
}): number[] {
  const expectedGameIds = normalizeExpectedGameIds(args.expectedGameIds);
  const returned = readReturnedGameIds(args.data);
  const expectedIsValid =
    expectedGameIds.length === args.expectedGameIds.length &&
    expectedGameIds.length > 0 &&
    expectedGameIds.every(
      (gameId) => Number.isSafeInteger(gameId) && gameId > 0,
    );
  const exactSet =
    expectedIsValid &&
    returned.valid &&
    returned.gameIds.length === expectedGameIds.length &&
    returned.gameIds.every(
      (gameId, index) => gameId === expectedGameIds[index],
    );

  if (!args.error && exactSet) return returned.gameIds;

  const fallbackMessage = args.error
    ? "The status update returned a database error."
    : "The status update did not return the exact expected game ID set.";
  const terminalError = args.error
    ? summarizeDatabaseError(args.error, fallbackMessage)
    : {
        code: "STATUS_UPDATE_SET_MISMATCH",
        message: fallbackMessage,
      };

  throw new StatsStatusAdvancementError({
    kind: "stats_status_advancement_failure",
    code: "STATS_STATUS_ADVANCEMENT_FAILED",
    phase: args.phase,
    gameId: expectedGameIds[0] ?? 0,
    requestedRows: expectedGameIds.length,
    expectedGameIds: expectedGameIds.slice(0, MAX_DIAGNOSTIC_GAME_IDS),
    returnedGameIds: returned.gameIds,
    terminalError,
  });
}

export function getStatsStatusAdvancementFailureDetails(
  error: unknown,
): StatsStatusAdvancementFailureDetails | null {
  return error instanceof StatsStatusAdvancementError ? error.details : null;
}
