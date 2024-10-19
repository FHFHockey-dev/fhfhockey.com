// components/GameGrid/utils/poissonHelpers.ts

import { useEffect, useState } from "react";
import { poissonProbability } from "./poisson";
import supabase from "lib/supabase";
import { TeamScores } from "../PDHC/types";

/**
 * Generates a joint probability matrix for both teams scoring goals from 0 to maxGoals.
 * @param homeLambda - Expected goals for home team.
 * @param awayLambda - Expected goals for away team.
 * @param maxGoals - Maximum number of goals to consider.
 * @returns A 2D array representing the joint probabilities.
 */
export const generateJointProbabilityMatrix = (
  homeLambda: number,
  awayLambda: number,
  maxGoals: number = 10
): number[][] => {
  const matrix: number[][] = [];

  for (let h = 0; h <= maxGoals; h++) {
    matrix[h] = [];
    for (let a = 0; a <= maxGoals; a++) {
      const prob =
        poissonProbability(h, homeLambda) * poissonProbability(a, awayLambda);
      matrix[h][a] = prob;
    }
  }

  return matrix;
};

/**
 * Calculates the probability of each team winning, losing, or drawing.
 * @param matrix - Joint probability matrix.
 * @returns An object containing win, loss, and draw probabilities.
 */
export const calculateWinProbabilities = (
  matrix: number[][],
  maxGoals: number = 10
) => {
  let homeWin = 0;
  let awayWin = 0;
  let draw = 0;

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      if (h > a) homeWin += matrix[h][a];
      else if (h < a) awayWin += matrix[h][a];
      else draw += matrix[h][a];
    }
  }

  // Normalize to ensure probabilities sum to 1
  const total = homeWin + awayWin + draw;
  return {
    homeWin: homeWin / total,
    awayWin: awayWin / total,
    draw: draw / total,
  };
};

/**
 * Calculates the win probabilities for a game with a tie-breaker rule.
 *
 * This function takes a matrix of probabilities for each possible scoreline
 * and redistributes the draw probabilities to the home and away win probabilities.
 *
 * @param matrix - A 2D array where matrix[h][a] represents the probability of the home team scoring `h` goals and the away team scoring `a` goals.
 * @param maxGoals - The maximum number of goals to consider for each team. Defaults to 10.
 * @returns An object containing the probabilities of the home team winning (`homeWin`), the away team winning (`awayWin`), and a draw (`draw`), where the draw probability is always 0.
 */
export const calculateWinProbabilitiesWithTieBreaker = (
  matrix: number[][],
  maxGoals: number = 10
) => {
  let homeWin = 0;
  let awayWin = 0;
  let draw = 0;

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      if (h > a) homeWin += matrix[h][a];
      else if (h < a) awayWin += matrix[h][a];
      else draw += matrix[h][a];
    }
  }

  // Redistribute draw probabilities
  const totalNonDraw = homeWin + awayWin;
  homeWin += (homeWin / totalNonDraw) * draw;
  awayWin += (awayWin / totalNonDraw) * draw;

  const total = homeWin + awayWin; // Now total should be 1

  return {
    homeWin: homeWin / total,
    awayWin: awayWin / total,
    draw: 0, // No draws
  };
};

/**
 * Fetches the league average goals for from `nst_league_averages` table where strength is 'all_per_game'.
 * @returns The league average goals for as a number.
 */
export const fetchLeagueAvgGoalsFor = async (): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from("nst_league_averages")
      .select("gf")
      .eq("strength", "all_per_game")
      .single(); // Assuming only one row for 'all_per_game'

    if (error) {
      throw error;
    }

    if (data && typeof data.gf === "number") {
      return data.gf;
    } else {
      throw new Error("League average goals for not found.");
    }
  } catch (error: any) {
    console.error("Error fetching league average goals for:", error);
    throw error;
  }
};

/**
 * Fetches team scores from `nst_att_def_scores` table for a given team ID.
 * @param teamId - The ID of the team.
 * @returns TeamScores object.
 */
export const fetchTeamScores = async (
  teamAbbreviation: string
): Promise<TeamScores> => {
  try {
    const { data, error } = await supabase
      .from("nst_att_def_scores")
      .select("*")
      .eq("team_abbreviation", teamAbbreviation)
      .single();

    if (error) {
      throw error;
    }

    return data as TeamScores;
  } catch (error: any) {
    console.error(
      `Error fetching team scores for team abbreviation ${teamAbbreviation}:`,
      error
    );
    throw error;
  }
};

export const useLeagueAvgGoalsFor = (): {
  leagueAvgGoalsFor: number | null;
  loading: boolean;
  error: string | null;
} => {
  const [leagueAvgGoalsFor, setLeagueAvgGoalsFor] = useState<number | null>(
    null
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from("nst_league_averages")
          .select("gf")
          .eq("strength", "all_per_game")
          .single();

        if (error) throw error;
        if (data && typeof data.gf === "number") {
          setLeagueAvgGoalsFor(data.gf);
        } else {
          throw new Error("League average goals for not found.");
        }
      } catch (err: any) {
        console.error("Error fetching league average goals for:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { leagueAvgGoalsFor, loading, error };
};

/**
 * Fetches the league average PP TOI per game from the database.
 * @returns The league average PP TOI per game in seconds.
 */
export const fetchLeagueAvgPPTOI = async (): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from("nst_league_averages")
      .select("toi")
      .eq("strength", "pp_per_game")
      .single();

    if (error) throw error;
    if (data && typeof data.toi === "number") {
      return data.toi;
    } else {
      throw new Error("League average PP TOI per game not found.");
    }
  } catch (error: any) {
    console.error("Error fetching league average PP TOI per game:", error);
    throw error;
  }
};

/**
 * Fetches the league average PK TOI per game from the database.
 * @returns The league average PK TOI per game in seconds.
 */
export const fetchLeagueAvgPKTOI = async (): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from("nst_league_averages")
      .select("toi")
      .eq("strength", "pk_per_game")
      .single();

    if (error) throw error;
    if (data && typeof data.toi === "number") {
      return data.toi;
    } else {
      throw new Error("League average PK TOI per game not found.");
    }
  } catch (error: any) {
    console.error("Error fetching league average PK TOI per game:", error);
    throw error;
  }
};
