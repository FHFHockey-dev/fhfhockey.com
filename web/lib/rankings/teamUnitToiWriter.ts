import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "lib/supabase/database-generated.types";

import {
  buildTeamUnitToiRows,
  type TeamUnitToiInsert,
  type TeamUnitToiPlayerPositionRow,
  type TeamUnitToiPowerPlayRow,
  type TeamUnitToiShiftRow,
} from "./teamUnitToiBuilder";

type TeamUnitToiBuildRequest = {
  season: number;
  snapshotDate: string;
  gameIds: number[] | null;
  startDate: string | null;
  endDate: string | null;
};

type TeamUnitToiBuildResult = {
  request: TeamUnitToiBuildRequest;
  rows: TeamUnitToiInsert[];
  sourceCounts: {
    shifts: number;
    players: number;
    powerPlayRows: number;
  };
  coverage: {
    gameCount: number;
    teamGameCount: number;
    forwardRows: number;
    defenseRows: number;
    powerPlayRows: number;
  };
};

const QUERY_PAGE_SIZE = 1000;
const DEFAULT_UPSERT_CHUNK_SIZE = 500;
const TEAM_UNIT_TOI_CONFLICT_COLUMNS =
  "season_id,snapshot_date,game_id,team_id,unit_type,unit_number";
type TeamUnitToiTableInsert = Database["public"]["Tables"]["team_unit_toi"]["Insert"];

function uniqueNumbers(values: number[]) {
  return Array.from(new Set(values)).filter((value) => Number.isFinite(value));
}

function dateOnly(value: string | null) {
  return value == null ? null : value.slice(0, 10);
}

async function fetchPaged<T>(
  buildQuery: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
  errorLabel: string,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += QUERY_PAGE_SIZE) {
    const { data, error } = await buildQuery(from, from + QUERY_PAGE_SIZE - 1);
    if (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error && "message" in error
            ? String((error as { message?: unknown }).message)
            : String(error);
      throw new Error(`${errorLabel}: ${message}`);
    }
    const page = data ?? [];
    rows.push(...page);
    if (page.length < QUERY_PAGE_SIZE) break;
  }
  return rows;
}

async function fetchShiftRows(
  supabase: SupabaseClient<Database>,
  request: TeamUnitToiBuildRequest,
) {
  return fetchPaged<TeamUnitToiShiftRow>(
    async (from, to) => {
      let query = supabase
        .from("nhl_api_shift_rows")
        .select(
          "game_id,season_id,game_date,team_id,team_abbrev,player_id,period,start_seconds,end_seconds,duration_seconds",
        )
        .eq("season_id", request.season)
        .not("start_seconds", "is", null)
        .not("end_seconds", "is", null)
        .order("game_id", { ascending: true })
        .order("period", { ascending: true })
        .order("start_seconds", { ascending: true })
        .range(from, to);

      if (request.gameIds != null && request.gameIds.length > 0) {
        query = query.in("game_id", request.gameIds);
      }
      if (request.startDate != null) {
        query = query.gte("game_date", request.startDate);
      }
      if (request.endDate != null) {
        query = query.lte("game_date", request.endDate);
      }

      return query as unknown as Promise<{
        data: TeamUnitToiShiftRow[] | null;
        error: unknown;
      }>;
    },
    "Failed to fetch nhl_api_shift_rows",
  );
}

async function fetchPlayersForShifts(
  supabase: SupabaseClient<Database>,
  shifts: TeamUnitToiShiftRow[],
) {
  const playerIds = uniqueNumbers(shifts.map((row) => row.player_id));
  const rows: TeamUnitToiPlayerPositionRow[] = [];
  for (let index = 0; index < playerIds.length; index += 500) {
    const chunk = playerIds.slice(index, index + 500);
    const page = await fetchPaged<TeamUnitToiPlayerPositionRow>(
      async (from, to) =>
        (supabase
          .from("players")
          .select("id,position")
          .in("id", chunk)
          .range(from, to) as unknown as Promise<{
          data: TeamUnitToiPlayerPositionRow[] | null;
          error: unknown;
        }>),
      "Failed to fetch players for team unit TOI",
    );
    rows.push(...page);
  }
  return rows;
}

async function fetchPowerPlayRows(
  supabase: SupabaseClient<Database>,
  request: TeamUnitToiBuildRequest,
  shiftGameIds: number[],
) {
  const gameIds =
    request.gameIds != null && request.gameIds.length > 0
      ? request.gameIds
      : shiftGameIds;
  if (gameIds.length === 0) return [];

  const rows: TeamUnitToiPowerPlayRow[] = [];
  for (let index = 0; index < gameIds.length; index += 500) {
    const chunk = gameIds.slice(index, index + 500);
    const page = await fetchPaged<TeamUnitToiPowerPlayRow>(
      async (from, to) =>
        (supabase
          .from("powerPlayCombinations")
          .select("gameId,playerId,unit,PPTOI")
          .in("gameId", chunk)
          .range(from, to) as unknown as Promise<{
          data: TeamUnitToiPowerPlayRow[] | null;
          error: unknown;
        }>),
      "Failed to fetch powerPlayCombinations",
    );
    rows.push(...page);
  }
  return rows;
}

export async function buildTeamUnitToiSnapshotRows(
  supabase: SupabaseClient<Database>,
  request: TeamUnitToiBuildRequest,
): Promise<TeamUnitToiBuildResult> {
  const shifts = await fetchShiftRows(supabase, request);
  const [players, ppRows] = await Promise.all([
    fetchPlayersForShifts(supabase, shifts),
    fetchPowerPlayRows(
      supabase,
      request,
      uniqueNumbers(shifts.map((row) => row.game_id)),
    ),
  ]);
  const rows = buildTeamUnitToiRows({
    shifts,
    players,
    ppRows,
    season: request.season,
    snapshotDate: request.snapshotDate,
  });
  const teamGames = new Set(
    rows.map((row) => [row.game_id, row.team_id].join(":")),
  );

  return {
    request,
    rows,
    sourceCounts: {
      shifts: shifts.length,
      players: players.length,
      powerPlayRows: ppRows.length,
    },
    coverage: {
      gameCount: new Set(shifts.map((row) => row.game_id)).size,
      teamGameCount: teamGames.size,
      forwardRows: rows.filter((row) => row.unit_type === "forward_line").length,
      defenseRows: rows.filter((row) => row.unit_type === "defense_pair").length,
      powerPlayRows: rows.filter((row) => row.unit_type === "power_play").length,
    },
  };
}

export async function upsertTeamUnitToiRows(
  supabase: SupabaseClient<Database>,
  rows: TeamUnitToiInsert[],
  options: { chunkSize?: number } = {},
) {
  const chunkSize = options.chunkSize ?? DEFAULT_UPSERT_CHUNK_SIZE;
  let upserted = 0;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk: TeamUnitToiTableInsert[] = rows
      .slice(index, index + chunkSize)
      .map((row) => ({
        ...row,
        coverage_warnings:
          row.coverage_warnings as TeamUnitToiTableInsert["coverage_warnings"],
        metadata: row.metadata as TeamUnitToiTableInsert["metadata"],
      }));
    const { error } = await supabase
      .from("team_unit_toi")
      .upsert(chunk, { onConflict: TEAM_UNIT_TOI_CONFLICT_COLUMNS });
    if (error) throw error;
    upserted += chunk.length;
  }
  return upserted;
}

export function createTeamUnitToiBuildRequest(args: {
  season: number;
  snapshotDate?: string | null;
  gameIds?: number[] | null;
  startDate?: string | null;
  endDate?: string | null;
}): TeamUnitToiBuildRequest {
  return {
    season: args.season,
    snapshotDate: dateOnly(args.snapshotDate ?? null) ?? new Date().toISOString().slice(0, 10),
    gameIds:
      args.gameIds == null || args.gameIds.length === 0
        ? null
        : uniqueNumbers(args.gameIds),
    startDate: dateOnly(args.startDate ?? null),
    endDate: dateOnly(args.endDate ?? null),
  };
}
