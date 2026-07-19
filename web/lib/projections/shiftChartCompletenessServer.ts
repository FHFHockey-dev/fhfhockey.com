import supabase from "lib/supabase/server";
import type { Database } from "lib/supabase/database-generated.types";
import {
  fetchAllSupabaseFilterChunks,
  fetchAllSupabasePages,
} from "lib/supabase/pagination";

import {
  classifyShiftChartStrengthGame,
  SHIFT_CHART_STRENGTH_SELECT,
  type ShiftChartStrengthGameClassification,
  type ShiftChartStrengthRow,
} from "./shiftChartCompleteness";

type NhlApiShiftRow = Pick<
  Database["public"]["Tables"]["nhl_api_shift_rows"]["Row"],
  "shift_id" | "game_id" | "player_id" | "team_id"
>;

export const NHL_API_SHIFT_PLAYER_MANIFEST_SELECT =
  "shift_id,game_id,player_id,team_id";

const MIN_COMPLETED_GAME_PLAYERS_PER_TEAM = 5;

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function buildNhlApiShiftPlayerManifest(
  gameIds: Iterable<number>,
  rows: readonly NhlApiShiftRow[],
): Map<number, number[]> {
  const requestedGameIds = Array.from(new Set(gameIds));
  if (requestedGameIds.some((gameId) => !isPositiveSafeInteger(gameId))) {
    throw new Error("Invalid NHL API shift manifest game identity");
  }
  const requested = new Set(requestedGameIds);
  const playerTeamsByGame = new Map<number, Map<number, number>>(
    requestedGameIds.map((gameId) => [gameId, new Map()]),
  );

  for (const row of rows) {
    if (
      !requested.has(row.game_id) ||
      !isPositiveSafeInteger(row.shift_id) ||
      !isPositiveSafeInteger(row.player_id) ||
      !isPositiveSafeInteger(row.team_id)
    ) {
      throw new Error("Invalid NHL API shift manifest row");
    }
    const playerTeams = playerTeamsByGame.get(row.game_id)!;
    const existingTeam = playerTeams.get(row.player_id);
    if (existingTeam != null && existingTeam !== row.team_id) {
      throw new Error("Contradictory NHL API shift player team");
    }
    playerTeams.set(row.player_id, row.team_id);
  }

  const manifest = new Map<number, number[]>();
  for (const gameId of requestedGameIds) {
    const playerTeams = playerTeamsByGame.get(gameId)!;
    const playersByTeam = new Map<number, number>();
    for (const teamId of playerTeams.values()) {
      playersByTeam.set(teamId, (playersByTeam.get(teamId) ?? 0) + 1);
    }
    if (
      playersByTeam.size !== 2 ||
      Array.from(playersByTeam.values()).some(
        (count) => count < MIN_COMPLETED_GAME_PLAYERS_PER_TEAM,
      )
    ) {
      throw new Error(
        `Incomplete NHL API shift player manifest for game ${gameId}`,
      );
    }
    manifest.set(
      gameId,
      Array.from(playerTeams.keys()).sort((a, b) => a - b),
    );
  }
  return manifest;
}

export async function fetchNhlApiShiftPlayerManifest(
  gameIds: Iterable<number>,
): Promise<Map<number, number[]>> {
  const uniqueGameIds = Array.from(new Set(gameIds));
  const rows = await fetchAllSupabaseFilterChunks<NhlApiShiftRow, number>(
    uniqueGameIds,
    (chunk, { from, to }) =>
      supabase
        .from("nhl_api_shift_rows")
        .select(NHL_API_SHIFT_PLAYER_MANIFEST_SELECT)
        .in("game_id", chunk)
        .order("game_id", { ascending: true })
        .order("shift_id", { ascending: true })
        .range(from, to),
  );
  return buildNhlApiShiftPlayerManifest(uniqueGameIds, rows);
}

export async function fetchShiftChartStrengthRowsForGame(
  gameId: number,
): Promise<ShiftChartStrengthRow[]> {
  return fetchAllSupabasePages<ShiftChartStrengthRow>(({ from, to }) =>
    supabase
      .from("shift_charts")
      .select(SHIFT_CHART_STRENGTH_SELECT)
      .eq("game_id", gameId)
      .order("id", { ascending: true })
      .range(from, to),
  );
}

export async function classifyStoredShiftChartStrengthGame(args: {
  gameId: number;
  expectedPlayerIds?: Iterable<number>;
}): Promise<ShiftChartStrengthGameClassification> {
  const rows = await fetchShiftChartStrengthRowsForGame(args.gameId);
  return classifyShiftChartStrengthGame({
    gameId: args.gameId,
    rows,
    expectedPlayerIds: args.expectedPlayerIds,
  });
}

export async function classifyStoredShiftChartStrengthGames(
  gameIds: Iterable<number>,
  expectedPlayerIdsByGame?: ReadonlyMap<number, Iterable<number>>,
): Promise<Map<number, ShiftChartStrengthGameClassification>> {
  const uniqueGameIds = Array.from(new Set(gameIds));
  const rows = await fetchAllSupabaseFilterChunks<
    ShiftChartStrengthRow,
    number
  >(uniqueGameIds, (chunk, { from, to }) =>
    supabase
      .from("shift_charts")
      .select(SHIFT_CHART_STRENGTH_SELECT)
      .in("game_id", chunk)
      .order("id", { ascending: true })
      .range(from, to),
  );
  const rowsByGameId = new Map<number, ShiftChartStrengthRow[]>();
  for (const row of rows) {
    const gameRows = rowsByGameId.get(row.game_id) ?? [];
    gameRows.push(row);
    rowsByGameId.set(row.game_id, gameRows);
  }

  return new Map(
    uniqueGameIds.map((gameId) => [
      gameId,
      classifyShiftChartStrengthGame({
        gameId,
        rows: rowsByGameId.get(gameId) ?? [],
        expectedPlayerIds: expectedPlayerIdsByGame?.get(gameId) ?? undefined,
      }),
    ]),
  );
}

export async function classifyStoredShiftChartStrengthGamesAgainstRawSource(
  gameIds: Iterable<number>,
): Promise<Map<number, ShiftChartStrengthGameClassification>> {
  const uniqueGameIds = Array.from(new Set(gameIds));
  const expectedPlayerIdsByGame =
    await fetchNhlApiShiftPlayerManifest(uniqueGameIds);
  return classifyStoredShiftChartStrengthGames(
    uniqueGameIds,
    expectedPlayerIdsByGame,
  );
}
