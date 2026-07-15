import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeCronDiagnostic } from "./statsUpdateSafety";

const EXPECTED_TEAM_ROWS = 2;

const REQUIRED_TEAM_STAT_CATEGORIES = [
  "sog",
  "faceoffWinningPctg",
  "powerPlay",
  "powerPlayPctg",
  "pim",
  "hits",
  "blockedShots",
  "giveaways",
  "takeaways",
] as const;

type RequiredTeamStatCategory = (typeof REQUIRED_TEAM_STAT_CATEGORIES)[number];

type DatabaseErrorSummary = {
  code: string | null;
  message: string;
};

export type TeamGameStatsFailurePhase =
  | "source_validation"
  | "row_validation"
  | "upsert";

export interface TeamGameStatsFailureDetails {
  kind: "team_game_stats_failure";
  code: "TEAM_GAME_STATS_FAILED";
  phase: TeamGameStatsFailurePhase;
  gameId: number;
  requestedRows: number;
  sourceStatCount: number;
  teamIds: number[];
  missingCategories: RequiredTeamStatCategory[];
  invalidCategories: RequiredTeamStatCategory[];
  terminalError: DatabaseErrorSummary;
}

export type PlayerGameStatsSourceFailurePhase =
  | "source_validation"
  | "batch_validation";

export interface PlayerGameStatsSourceFailureDetails {
  kind: "player_game_stats_source_failure";
  code: "PLAYER_GAME_STATS_SOURCE_INCOMPLETE";
  phase: PlayerGameStatsSourceFailurePhase;
  gameId: number;
  requestedRows: number;
  skaterRows: number;
  goalieRows: number;
  invalidSections: string[];
  missingBatches: Array<"skaters" | "goalies">;
  terminalError: DatabaseErrorSummary;
}

export interface GameIdentityMismatchFailureDetails {
  kind: "game_identity_mismatch";
  code: "GAME_IDENTITY_MISMATCH";
  phase: "source_validation";
  gameId: number;
  requestedRows: 1;
  requestedGameId: number;
  landingGameId: number | null;
  terminalError: DatabaseErrorSummary;
}

export type GameStatsCompletenessFailureDetails =
  | TeamGameStatsFailureDetails
  | PlayerGameStatsSourceFailureDetails
  | GameIdentityMismatchFailureDetails;

export interface TeamGameStatsRow {
  gameId: number;
  teamId: number;
  score: number;
  sog: number;
  faceoffPctg: number;
  pim: number;
  hits: number;
  blockedShots: number;
  giveaways: number;
  takeaways: number;
  powerPlay: string;
  powerPlayConversion: string;
  powerPlayToi: string;
}

export class TeamGameStatsError extends Error {
  readonly details: TeamGameStatsFailureDetails;

  constructor(details: TeamGameStatsFailureDetails) {
    super(
      `Failed to persist the two-team game-stat batch for game ${details.gameId} during ${details.phase}.`,
    );
    this.name = "TeamGameStatsError";
    this.details = details;
  }
}

export class PlayerGameStatsSourceError extends Error {
  readonly details: PlayerGameStatsSourceFailureDetails;

  constructor(details: PlayerGameStatsSourceFailureDetails) {
    super(
      `Player game-stat source is incomplete for game ${details.gameId} during ${details.phase}.`,
    );
    this.name = "PlayerGameStatsSourceError";
    this.details = details;
  }
}

export class GameIdentityMismatchError extends Error {
  readonly details: GameIdentityMismatchFailureDetails;

  constructor(details: GameIdentityMismatchFailureDetails) {
    super(
      `NHL landing game ID did not match requested game ${details.requestedGameId}.`,
    );
    this.name = "GameIdentityMismatchError";
    this.details = details;
  }
}

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

function normalizeTeamIds(teamIds: unknown[]): number[] {
  return Array.from(
    new Set(
      teamIds.filter(
        (teamId): teamId is number =>
          typeof teamId === "number" && Number.isInteger(teamId) && teamId > 0,
      ),
    ),
  ).slice(0, EXPECTED_TEAM_ROWS);
}

function createTeamFailure(args: {
  phase: TeamGameStatsFailurePhase;
  gameId: number;
  sourceStatCount?: number;
  teamIds?: unknown[];
  missingCategories?: RequiredTeamStatCategory[];
  invalidCategories?: RequiredTeamStatCategory[];
  terminalError: unknown;
}): TeamGameStatsError {
  return new TeamGameStatsError({
    kind: "team_game_stats_failure",
    code: "TEAM_GAME_STATS_FAILED",
    phase: args.phase,
    gameId: args.gameId,
    requestedRows: EXPECTED_TEAM_ROWS,
    sourceStatCount: args.sourceStatCount ?? 0,
    teamIds: normalizeTeamIds(args.teamIds ?? []),
    missingCategories: args.missingCategories ?? [],
    invalidCategories: args.invalidCategories ?? [],
    terminalError: summarizeDatabaseError(args.terminalError),
  });
}

function isFiniteNumberish(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string" || !value.trim()) return false;
  return Number.isFinite(Number(value));
}

function isValidCategoryValue(
  category: RequiredTeamStatCategory,
  value: unknown,
): boolean {
  if (category === "powerPlay") {
    return typeof value === "string" && /^\d+\s*\/\s*\d+$/.test(value.trim());
  }

  return isFiniteNumberish(value);
}

export function assertCompleteTeamGameStatsSource(args: {
  gameId: number;
  teamGameStats: unknown;
  teamIds?: unknown[];
}): void {
  const { gameId, teamGameStats, teamIds = [] } = args;
  if (!Array.isArray(teamGameStats)) {
    throw createTeamFailure({
      phase: "source_validation",
      gameId,
      teamIds,
      missingCategories: [...REQUIRED_TEAM_STAT_CATEGORIES],
      terminalError: {
        code: "INVALID_TEAM_GAME_STATS_SOURCE",
        message: "Expected right-rail teamGameStats to be an array.",
      },
    });
  }

  const missingCategories: RequiredTeamStatCategory[] = [];
  const invalidCategories: RequiredTeamStatCategory[] = [];

  for (const category of REQUIRED_TEAM_STAT_CATEGORIES) {
    const matches = teamGameStats.filter(
      (candidate) => isRecord(candidate) && candidate.category === category,
    );

    if (matches.length === 0) {
      missingCategories.push(category);
      continue;
    }

    const candidate = matches[0];
    if (
      matches.length !== 1 ||
      !isValidCategoryValue(category, candidate.awayValue) ||
      !isValidCategoryValue(category, candidate.homeValue)
    ) {
      invalidCategories.push(category);
    }
  }

  if (missingCategories.length > 0 || invalidCategories.length > 0) {
    throw createTeamFailure({
      phase: "source_validation",
      gameId,
      sourceStatCount: teamGameStats.length,
      teamIds,
      missingCategories,
      invalidCategories,
      terminalError: {
        code: "INCOMPLETE_TEAM_GAME_STATS_SOURCE",
        message:
          "Required right-rail team statistics were missing, duplicated, or invalid for one or both teams.",
      },
    });
  }
}

function isValidTeamGameStatsRow(
  row: TeamGameStatsRow,
  gameId: number,
): boolean {
  const numericFields = [
    row.score,
    row.sog,
    row.faceoffPctg,
    row.pim,
    row.hits,
    row.blockedShots,
    row.giveaways,
    row.takeaways,
  ];

  return (
    Number.isInteger(row.gameId) &&
    row.gameId === gameId &&
    Number.isInteger(row.teamId) &&
    row.teamId > 0 &&
    numericFields.every((value) => Number.isFinite(value)) &&
    typeof row.powerPlay === "string" &&
    row.powerPlay.trim().length > 0 &&
    typeof row.powerPlayConversion === "string" &&
    row.powerPlayConversion.trim().length > 0 &&
    typeof row.powerPlayToi === "string" &&
    row.powerPlayToi.trim().length > 0
  );
}

export async function persistTeamGameStatsBatch(args: {
  supabase: SupabaseClient;
  rows: TeamGameStatsRow[];
  gameId: number;
  sourceStatCount: number;
}): Promise<number> {
  const { supabase, rows, gameId, sourceStatCount } = args;
  const teamIds = rows.map((row) => row.teamId);
  const validRows =
    Number.isInteger(gameId) &&
    gameId > 0 &&
    rows.length === EXPECTED_TEAM_ROWS &&
    new Set(teamIds).size === EXPECTED_TEAM_ROWS &&
    rows.every((row) => isValidTeamGameStatsRow(row, gameId));

  if (!validRows) {
    throw createTeamFailure({
      phase: "row_validation",
      gameId,
      sourceStatCount,
      teamIds,
      terminalError: {
        code: "INVALID_TEAM_GAME_STATS_ROWS",
        message:
          "Expected exactly two complete rows with distinct positive team IDs for one positive game ID.",
      },
    });
  }

  let upsertError: unknown | null = null;
  try {
    const result = await supabase.from("teamGameStats").upsert(rows);
    upsertError = result.error;
  } catch (error) {
    upsertError = error;
  }

  if (upsertError) {
    throw createTeamFailure({
      phase: "upsert",
      gameId,
      sourceStatCount,
      teamIds,
      terminalError: upsertError,
    });
  }

  return rows.length;
}

function getNestedValue(
  value: unknown,
  firstKey: string,
  secondKey: string,
): unknown {
  if (!isRecord(value)) return undefined;
  const first = value[firstKey];
  return isRecord(first) ? first[secondKey] : undefined;
}

function createPlayerSourceFailure(args: {
  phase: PlayerGameStatsSourceFailurePhase;
  gameId: number;
  skaterRows: number;
  goalieRows: number;
  invalidSections?: string[];
  missingBatches?: Array<"skaters" | "goalies">;
  terminalError: unknown;
}): PlayerGameStatsSourceError {
  return new PlayerGameStatsSourceError({
    kind: "player_game_stats_source_failure",
    code: "PLAYER_GAME_STATS_SOURCE_INCOMPLETE",
    phase: args.phase,
    gameId: args.gameId,
    requestedRows: Math.max(1, args.skaterRows + args.goalieRows),
    skaterRows: args.skaterRows,
    goalieRows: args.goalieRows,
    invalidSections: (args.invalidSections ?? []).slice(0, 6),
    missingBatches: args.missingBatches ?? [],
    terminalError: summarizeDatabaseError(args.terminalError),
  });
}

export function assertMatchingGameIdentity(args: {
  requestedGameId: number;
  landingGameId: unknown;
}): void {
  const landingGameId =
    typeof args.landingGameId === "number" &&
    Number.isSafeInteger(args.landingGameId) &&
    args.landingGameId > 0
      ? args.landingGameId
      : null;

  if (
    Number.isSafeInteger(args.requestedGameId) &&
    args.requestedGameId > 0 &&
    landingGameId === args.requestedGameId
  ) {
    return;
  }

  throw new GameIdentityMismatchError({
    kind: "game_identity_mismatch",
    code: "GAME_IDENTITY_MISMATCH",
    phase: "source_validation",
    gameId: args.requestedGameId,
    requestedRows: 1,
    requestedGameId: args.requestedGameId,
    landingGameId,
    terminalError: {
      code: "GAME_IDENTITY_MISMATCH",
      message:
        "The requested game ID and NHL landing payload game ID were not identical positive integers.",
    },
  });
}

export function assertCompletePlayerGameStatsSource(args: {
  gameId: number;
  boxscore: unknown;
}): void {
  const { gameId, boxscore } = args;
  const playerByGameStats = isRecord(boxscore)
    ? boxscore.playerByGameStats
    : undefined;
  const sections = [
    ["homeTeam", "forwards"],
    ["homeTeam", "defense"],
    ["homeTeam", "goalies"],
    ["awayTeam", "forwards"],
    ["awayTeam", "defense"],
    ["awayTeam", "goalies"],
  ] as const;
  const sectionValues = sections.map(([team, group]) => ({
    label: `${team}.${group}`,
    group,
    value: getNestedValue(playerByGameStats, team, group),
  }));
  const invalidSections = sectionValues
    .filter(({ value }) => !Array.isArray(value))
    .map(({ label }) => label);
  const skaterRows = sectionValues
    .filter(({ group }) => group !== "goalies")
    .reduce(
      (total, { value }) => total + (Array.isArray(value) ? value.length : 0),
      0,
    );
  const goalieRows = sectionValues
    .filter(({ group }) => group === "goalies")
    .reduce(
      (total, { value }) => total + (Array.isArray(value) ? value.length : 0),
      0,
    );
  const missingBatches: Array<"skaters" | "goalies"> = [];
  if (skaterRows === 0) missingBatches.push("skaters");
  if (goalieRows === 0) missingBatches.push("goalies");

  if (invalidSections.length > 0 || missingBatches.length > 0) {
    throw createPlayerSourceFailure({
      phase: "source_validation",
      gameId,
      skaterRows,
      goalieRows,
      invalidSections,
      missingBatches,
      terminalError: {
        code: "INCOMPLETE_PLAYER_GAME_STATS_SOURCE",
        message:
          "Expected home and away playerByGameStats arrays with non-empty aggregate skater and goalie batches.",
      },
    });
  }
}

export function assertCompletePlayerGameStatsBatches(args: {
  gameId: number;
  skaters: unknown;
  goalies: unknown;
}): void {
  const { gameId, skaters, goalies } = args;
  const skaterRows = Array.isArray(skaters) ? skaters.length : 0;
  const goalieRows = Array.isArray(goalies) ? goalies.length : 0;
  const invalidSections: string[] = [];
  if (!Array.isArray(skaters)) invalidSections.push("processed.skaters");
  if (!Array.isArray(goalies)) invalidSections.push("processed.goalies");
  const missingBatches: Array<"skaters" | "goalies"> = [];
  if (skaterRows === 0) missingBatches.push("skaters");
  if (goalieRows === 0) missingBatches.push("goalies");

  if (invalidSections.length > 0 || missingBatches.length > 0) {
    throw createPlayerSourceFailure({
      phase: "batch_validation",
      gameId,
      skaterRows,
      goalieRows,
      invalidSections,
      missingBatches,
      terminalError: {
        code: "INCOMPLETE_PLAYER_GAME_STATS_BATCHES",
        message:
          "Expected non-empty processed skater and goalie batches for a finished game.",
      },
    });
  }
}

export function getTeamGameStatsFailureDetails(
  error: unknown,
): TeamGameStatsFailureDetails | null {
  return error instanceof TeamGameStatsError ? error.details : null;
}

export function getPlayerGameStatsSourceFailureDetails(
  error: unknown,
): PlayerGameStatsSourceFailureDetails | null {
  return error instanceof PlayerGameStatsSourceError ? error.details : null;
}

export function getGameIdentityMismatchFailureDetails(
  error: unknown,
): GameIdentityMismatchFailureDetails | null {
  return error instanceof GameIdentityMismatchError ? error.details : null;
}

export function getGameStatsCompletenessFailureDetails(
  error: unknown,
): GameStatsCompletenessFailureDetails | null {
  return (
    getTeamGameStatsFailureDetails(error) ??
    getPlayerGameStatsSourceFailureDetails(error) ??
    getGameIdentityMismatchFailureDetails(error)
  );
}
