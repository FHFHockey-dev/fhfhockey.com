//////////////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\DateRangeMatrix\utilities.ts

import { teamsInfo } from "lib/teamsInfo";
import supabase from "lib/supabase";
import type { Database } from "lib/supabase/database-generated.types";
import { fetchAllSupabasePages } from "lib/supabase/pagination";

// TYPES
export type Shift = {
  id: number;
  gameId: number;
  playerId: number;
  period: number;
  firstName: string;
  lastName: string;
  teamId: number;
  teamName: string;
  duration: string | null;
  startTime: string;
  endTime: string;
};

export type PlayerData = {
  id: number;
  teamId: number;
  franchiseId: number;
  position: string;
  name: string;
  playerAbbrevName: string;
  lastName: string;
  totalTOI: number; // Ensure totalTOI is always a number
  timesOnLine: Record<string, number>;
  timesOnPair: Record<string, number>;
  percentToiWith: Record<number, number>;
  percentToiWithMixed: Record<number, number>;
  timeSpentWith: Record<number, number>;
  timeSpentWithMixed: Record<number, number>;
  GP: number;
  timesPlayedWith: Record<number, number>;
  ATOI: string;
  percentOfSeason: Record<number, number>;
  displayPosition: string;
  comboPoints: number;
  mutualSharedToi?: Record<number, number>;
  playerType?: string;
};

// Helper Functions

// Check if a player is a forward
export function isForward(position: string): boolean {
  const FORWARDS_POSITIONS = ["LW", "RW", "C"];
  return FORWARDS_POSITIONS.includes(position);
}

// Check if a player is a defenseman
export function isDefense(position: string): boolean {
  const DEFENSE_POSITIONS = ["D"];
  return DEFENSE_POSITIONS.includes(position);
}

// Get the color based on the position of two players
export function getColor(p1Pos: string, p2Pos: string): string {
  const RED = "#D65108";
  const BLUE = "#0267C1";
  const YELLOW = "#EFA00B";

  if (isForward(p1Pos) && isForward(p2Pos)) return RED;
  if (isDefense(p1Pos) && isDefense(p2Pos)) return BLUE;
  if (
    (isForward(p1Pos) && isDefense(p2Pos)) ||
    (isForward(p2Pos) && isDefense(p1Pos))
  )
    return YELLOW;

  //console.warn("Unexpected position combination:", p1Pos, p2Pos);
  return "#101010"; // Default color for unexpected cases
}

// Parse time string to seconds
export function parseTime(time: string): number {
  if (!time) return 0;
  const [minutes, seconds] = time.split(":").map(Number);
  return minutes * 60 + seconds;
}

// Calculate ATOI
export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
}

// Get Team Colors from teamsInfo.js
export const getTeamColors = (teamId: number) => {
  const team = Object.values(teamsInfo).find((team) => team.id === teamId);
  if (team) {
    return {
      primary: team.primaryColor,
      secondary: team.secondaryColor,
      jersey: team.jersey,
      accentColor: team.accent,
    };
  }
  return {
    primary: "#000000", // default to black if not found
    secondary: "#FFFFFF", // default to white if not found
    jersey: "#000000", // default to black if not found
    accentColor: "#000000", // default to black if not found
  };
};

// Create a utility function to get the franchiseId by team abbreviation
export const getFranchiseIdByTeamAbbreviation = (teamAbbreviation: string) => {
  return (
    teamsInfo[teamAbbreviation as keyof typeof teamsInfo]?.franchiseId || null
  );
};

type WgoTeamGameRow = Pick<
  Database["public"]["Tables"]["wgo_team_stats"]["Row"],
  "id" | "game_id" | "date"
>;

export type DateRangeForGamesRequest = {
  teamId: number;
  seasonId: number;
  seasonType: "regularSeason" | "playoffs";
  gamesBack: 7 | 14 | 30;
  scopeStartDate: string;
  scopeEndDate: string;
};

export type DateRangeForGamesResult = {
  startDate: string;
  endDate: string;
  gameIds: number[];
  requestedGameCount: number;
  resolvedGameCount: number;
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

// Resolve the selected team's fixed last-N completed-game window. Home/away and
// opponent filters intentionally remain outside this resolver (Option A).
export async function getDateRangeForGames(
  request: DateRangeForGamesRequest,
): Promise<DateRangeForGamesResult | null> {
  const {
    teamId,
    seasonId,
    seasonType,
    gamesBack,
    scopeStartDate,
    scopeEndDate,
  } = request;

  if (!Number.isInteger(teamId) || teamId <= 0) {
    throw new Error("A valid team ID is required to resolve a game window.");
  }
  if (!Number.isInteger(seasonId) || seasonId <= 0) {
    throw new Error("A valid season ID is required to resolve a game window.");
  }
  if (!([7, 14, 30] as const).includes(gamesBack)) {
    throw new Error("The game window must be L7, L14, or L30.");
  }
  if (seasonType !== "regularSeason" && seasonType !== "playoffs") {
    throw new Error(
      "A valid season type is required to resolve a game window.",
    );
  }
  if (
    !isValidIsoDate(scopeStartDate) ||
    !isValidIsoDate(scopeEndDate) ||
    scopeStartDate > scopeEndDate
  ) {
    throw new Error("A valid season-type date scope is required.");
  }

  const rows = await fetchAllSupabasePages<WgoTeamGameRow>(
    ({ from, to }) =>
      supabase
        .from("wgo_team_stats")
        .select("id,game_id,date")
        .eq("team_id", teamId)
        .eq("season_id", seasonId)
        .gte("date", scopeStartDate)
        .lte("date", scopeEndDate)
        .order("date", { ascending: false })
        .order("game_id", { ascending: false, nullsFirst: false })
        .order("id", { ascending: false })
        .range(from, to),
    { pageSize: gamesBack, limit: gamesBack },
  );

  if (rows.length < gamesBack) {
    return null;
  }

  const seenGameIds = new Set<number>();
  const games = rows.map((row) => {
    const rowId = Number(row.id);
    const gameId = Number(row.game_id);
    if (!Number.isInteger(rowId) || rowId <= 0) {
      throw new Error("The completed-game ledger contains an invalid row ID.");
    }
    if (row.game_id == null || !Number.isInteger(gameId) || gameId <= 0) {
      throw new Error("The completed-game ledger contains an invalid game ID.");
    }
    if (!isValidIsoDate(row.date)) {
      throw new Error("The completed-game ledger contains an invalid date.");
    }
    if (seenGameIds.has(gameId)) {
      throw new Error(
        "The completed-game ledger contains a duplicate game ID.",
      );
    }
    seenGameIds.add(gameId);
    return { gameId, date: row.date };
  });

  return {
    startDate: games[games.length - 1].date,
    endDate: games[0].date,
    gameIds: games.map((game) => game.gameId),
    requestedGameCount: gamesBack,
    resolvedGameCount: games.length,
  };
}
