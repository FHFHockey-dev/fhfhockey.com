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
  const start = Date.now();
  const dates = [];
  let currentDate = new Date(startDate);
  const finalDate = new Date(endDate);

  // Collect all dates
  while (currentDate <= finalDate) {
    dates.push(currentDate.toISOString().split("T")[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Fetch in batches to avoid rate limits
  const BATCH_SIZE = 3;
  const DELAY_MS = 1000;
  const gamesResponses: GamesResponse[] = [];

  for (let i = 0; i < dates.length; i += BATCH_SIZE) {
    const batch = dates.slice(i, i + BATCH_SIZE);
    const promises = batch.map((date) => fetchGamesByDate(date));

    try {
      const results = await Promise.all(promises);
      gamesResponses.push(...results);
    } catch (error) {
      console.error(`Error fetching batch starting ${dates[i]}:`, error);
      throw error;
    }

    if (i + BATCH_SIZE < dates.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  const allGames = gamesResponses.flatMap((response) =>
    response.games.filter((game) => game.gameType === 2)
  );

  const end = Date.now();
  const duration = end - start;
  console.log(
    "fetchAllGamesInRangeIterative duration:",
    startDate,
    endDate,
    "Duration:",
    duration
  );

  return allGames;
}
