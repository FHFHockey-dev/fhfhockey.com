// pages/api/v1/db/update-expected-goals/fetchData.ts

import supabase from "lib/supabase";
import { teamsInfo } from "lib/teamsInfo";
import Fetch from "lib/cors-fetch";

// Define TypeScript types for clarity
export type LeagueAverages = {
  gf: number;
};

export type TeamScores = {
  team_abbreviation: string;
  team_name: string;
  att_score_pp: number;
  att_score_pk: number;
  att_score_all: number;
  att_score_5v5: number;
  def_score_pp: number;
  def_score_pk: number;
  def_score_all: number;
  def_score_5v5: number;
  pp_toi_diff: number;
  pk_toi_diff: number;
  all_toi_diff: number;
  "5v5_toi_diff": number;
  att_advantage_pp: number;
  att_advantage_pk: number;
  att_advantage_all: number;
  att_advantage_5v5: number;
  def_advantage_pp: number;
  def_advantage_pk: number;
  def_advantage_all: number;
  def_advantage_5v5: number;
};

export type GameOdds = {
  providerId: number;
  value: string;
};

export type Game = {
  id: number;
  gameDate: string; // 'YYYY-MM-DD'
  gameType: number; // Added gameType
  homeTeam: {
    id: number;
    abbrev: string;
    odds?: GameOdds[]; // Made optional
  };
  awayTeam: {
    id: number;
    abbrev: string;
    odds?: GameOdds[]; // Made optional
  };
};

export type GameWeek = {
  date: string;
  dayAbbrev: string;
  numberOfGames: number;
};

export type GamesResponse = {
  prevDate: string;
  currentDate: string;
  nextDate: string;
  gameWeek: GameWeek[];
  games: Game[];
};

/**
 * Fetches league averages from Supabase.
 */
export async function fetchLeagueAverages(): Promise<LeagueAverages> {
  const { data, error } = await supabase
    .from("nst_league_averages")
    .select("gf")
    .eq("strength", "all_per_game")
    .single();

  if (error) {
    throw new Error(`Error fetching league averages: ${error.message}`);
  }

  return { gf: Number(data.gf) };
}

/**
 * Fetches team scores from Supabase.
 */
export async function fetchTeamScores(): Promise<TeamScores[]> {
  const { data, error } = await supabase.from("nst_att_def_scores").select("*");

  if (error) {
    throw new Error(`Error fetching team scores: ${error.message}`);
  }

  return data as TeamScores[];
}

/**
 * Maps a team abbreviation to its corresponding team ID using teamsInfo.ts.
 * @param abbrev - The team abbreviation.
 */
export function mapAbbreviationToId(abbrev: string): number | undefined {
  const team = teamsInfo[abbrev];
  return team?.id;
}

/**
 * Fetches games for a specific date from the NHL API.
 * @param gameDate - The date for which to fetch games (format: 'YYYY-MM-DD').
 */
export async function fetchGamesByDate(
  gameDate: string
): Promise<GamesResponse> {
  const url = `https://api-web.nhle.com/v1/score/${gameDate}`;

  const response = await Fetch(url);

  if (!response.ok) {
    throw new Error(
      `Error fetching games from NHL API: ${response.statusText}`
    );
  }

  const data = await response.json();

  return data as GamesResponse;
}

/**
 * Fetches all games within a specified date range by iteratively calling the API.
 * @param startDate - The start date (inclusive) for fetching games (format: 'YYYY-MM-DD').
 * @param endDate - The end date (inclusive) for fetching games (format: 'YYYY-MM-DD').
 */
export async function fetchAllGamesInRangeIterative(
  startDate: string,
  endDate: string
): Promise<Game[]> {
  const allGames: Game[] = [];
  let currentDate = new Date(startDate);
  const finalDate = new Date(endDate);

  while (currentDate <= finalDate) {
    const dateStr = currentDate.toISOString().split("T")[0];
    try {
      const gamesResponse = await fetchGamesByDate(dateStr);

      // Filter out preseason games (gameType != 2)
      const regularSeasonGames = gamesResponse.games.filter(
        (game) => game.gameType === 2
      );

      if (regularSeasonGames.length > 0) {
        allGames.push(...regularSeasonGames);
        console.log(
          `Fetched games for ${dateStr}: ${regularSeasonGames.length} regular-season games.`
        );
      } else {
        console.log(`No regular-season games found for ${dateStr}. Skipping.`);
      }

      // Use nextDate from response to determine the next date
      const nextDateStr = gamesResponse.nextDate;
      if (nextDateStr) {
        currentDate = new Date(nextDateStr);
      } else {
        // If nextDate is not provided, increment by one day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } catch (error: any) {
      console.error(`Failed to fetch games for ${dateStr}: ${error.message}`);
      // Move to the next day regardless of error
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  return allGames;
}
