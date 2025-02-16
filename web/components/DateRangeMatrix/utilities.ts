//////////////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\DateRangeMatrix\utilities.ts

import { teamsInfo } from "lib/NHL/teamsInfo";
import supabase from "lib/supabase";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";

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
  timeSpentWith: Record<number, string>;
  timeSpentWithMixed: Record<number, string>;
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
      accentColor: team.accent
    };
  }
  return {
    primary: "#000000", // default to black if not found
    secondary: "#FFFFFF", // default to white if not found
    jersey: "#000000", // default to black if not found
    accentColor: "#000000" // default to black if not found
  };
};

// Create a utility function to get the franchiseId by team abbreviation
export const getFranchiseIdByTeamAbbreviation = (teamAbbreviation: string) => {
  return (
    teamsInfo[teamAbbreviation as keyof typeof teamsInfo]?.franchiseId || null
  );
};

// Get the date range for the last n games within a specific season
export async function getDateRangeForGames(teamId: number, gamesBack: number) {
  // Fetch the current season to get the season ID
  const currentSeason = await fetchCurrentSeason();
  const seasonId = currentSeason.id;

  console.log(
    `Fetching date range for ${gamesBack} games for team ID ${teamId}...`
  );

  // Fetch the game dates for the team within the current season, ordered by date descending
  const { data, error } = await supabase
    .from("wgo_team_stats")
    .select("date")
    .eq("team_id", teamId)
    .eq("season_id", seasonId) // Filter by season ID
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching team stats:", error);
    return null;
  }

  if (!data || data.length === 0) {
    console.warn(
      `No data found for team with ID ${teamId} in season ${seasonId}.`
    );
    return null;
  }

  // Log each row and its date in descending order
  console.log(`Fetched ${data.length} rows for team ID ${teamId}`);
  data.forEach((row, index) => {
    console.log(`Row ${index + 1}: Date = ${row.date} // teamId = ${teamId}`);
  });

  // Slice the first `gamesBack` number of rows
  const selectedGames = data.slice(0, gamesBack);

  if (selectedGames.length < gamesBack) {
    console.warn(`Team has played fewer than ${gamesBack} games.`);
    return null;
  }

  // Determine the start and end dates
  const startDate = selectedGames[selectedGames.length - 1].date;
  const endDate = selectedGames[0].date;

  console.log(`Start date: ${startDate}, End date: ${endDate}`);

  return { startDate, endDate };
}
