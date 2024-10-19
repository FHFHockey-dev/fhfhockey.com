// components/GameGrid/utils/projection.ts

import { TeamScores } from "../PDHC/types";
import { fetchLeagueAvgPPTOI, fetchLeagueAvgPKTOI } from "./poissonHelpers";

export const calculateFinalScores = async (
  team: TeamScores,
  opponent: TeamScores
): Promise<{ finalAttScore: number; finalDefScore: number }> => {
  // Fetch accurate league average PP and PK TOI per game (in seconds)
  const leagueAvgPPTOI = await fetchLeagueAvgPPTOI();
  const leagueAvgPKTOI = await fetchLeagueAvgPKTOI();
  const totalGameTOI = 3600; // seconds

  // Team's PP and PK TOI per game
  const teamPPTOIPerGame = leagueAvgPPTOI + team.pp_toi_diff;
  const teamPKTOIPerGame = leagueAvgPKTOI + team.pk_toi_diff;

  // Opponent's PP and PK TOI per game
  const opponentPPTOIPerGame = leagueAvgPPTOI + opponent.pp_toi_diff;
  const opponentPKTOIPerGame = leagueAvgPKTOI + opponent.pk_toi_diff;

  // Calculate PP and PK TOI adjustments
  const homePPTOIAdjustment = (teamPPTOIPerGame + opponentPKTOIPerGame) / 2;
  const homePKTOIAdjustment = (teamPKTOIPerGame + opponentPPTOIPerGame) / 2;

  // Calculate percentages
  const ppPercentage = (homePPTOIAdjustment / totalGameTOI) * 100;
  const pkPercentage = (homePKTOIAdjustment / totalGameTOI) * 100;
  const fivfPercentage = 100 - ppPercentage - pkPercentage;

  // Ensure percentages are valid
  if (fivfPercentage < 0) {
    throw new Error("Invalid TOI percentages: Negative 5v5 percentage.");
  }

  // Compute game-specific attack and defense scores
  const gameAttScore =
    (ppPercentage * team.att_score_pp +
      pkPercentage * team.att_score_pk +
      fivfPercentage * team.att_score_5v5) /
    100;

  const gameDefScore =
    (ppPercentage * team.def_score_pp +
      pkPercentage * team.def_score_pk +
      fivfPercentage * team.def_score_5v5) /
    100;

  // Average with overall scores
  const finalAttScore = (gameAttScore + team.att_score_all) / 2;
  const finalDefScore = (gameDefScore + team.def_score_all) / 2;

  // Add console logs to output the scores
  console.log("=== calculateFinalScores ===");
  console.log("Team:", team.team_abbreviation);
  console.log("Opponent:", opponent.team_abbreviation);
  console.log("League Avg PP TOI:", leagueAvgPPTOI);
  console.log("League Avg PK TOI:", leagueAvgPKTOI);
  console.log("Team PP TOI per Game:", teamPPTOIPerGame);
  console.log("Team PK TOI per Game:", teamPKTOIPerGame);
  console.log("Opponent PP TOI per Game:", opponentPPTOIPerGame);
  console.log("Opponent PK TOI per Game:", opponentPKTOIPerGame);
  console.log("PP Percentage:", ppPercentage);
  console.log("PK Percentage:", pkPercentage);
  console.log("5v5 Percentage:", fivfPercentage);
  console.log("Game Attack Score:", gameAttScore);
  console.log("Game Defense Score:", gameDefScore);
  console.log("Final Attack Score:", finalAttScore);
  console.log("Final Defense Score:", finalDefScore);
  console.log("============================");

  return {
    finalAttScore,
    finalDefScore,
  };
};

/**
 * Calculates the net adjustment based on team's PP TOI diff and opponent's PK TOI diff.
 * @param team - The team whose attack scores are being calculated.
 * @param opponent - The opposing team.
 * @returns Net adjustment percentage.
 */
export const calculateNetAdjustment = (
  team: TeamScores,
  opponent: TeamScores
): number => {
  return (team.pp_toi_diff + opponent.pk_toi_diff) / 2;
};

/**
 * Calculates the adjusted TOI percentages based on net adjustment.
 * @param netAdjustment - The net adjustment percentage.
 * @param leagueAvgPPTOI - League average PP TOI in seconds.
 * @param leagueAvgPKTOI - League average PK TOI in seconds.
 * @param totalGameTOI - Total game TOI in seconds.
 * @returns Object containing adjusted TOI in seconds and percentages.
 */
export const calculateAdjustedTOI = (
  netAdjustment: number,
  leagueAvgPPTOI: number,
  leagueAvgPKTOI: number,
  totalGameTOI: number
): {
  adjustedPPTOI: number;
  adjustedPKTOI: number;
  adjusted5v5TOI: number;
  ppPercentage: number;
  pkPercentage: number;
  fivfPercentage: number;
} => {
  const adjustedPPTOI = leagueAvgPPTOI * (1 + netAdjustment / 100);
  const adjustedPKTOI = leagueAvgPKTOI * (1 + netAdjustment / 100);
  const adjusted5v5TOI = totalGameTOI - (adjustedPPTOI + adjustedPKTOI);

  const ppPercentage = (adjustedPPTOI / totalGameTOI) * 100;
  const pkPercentage = (adjustedPKTOI / totalGameTOI) * 100;
  const fivfPercentage = (adjusted5v5TOI / totalGameTOI) * 100;

  return {
    adjustedPPTOI,
    adjustedPKTOI,
    adjusted5v5TOI,
    ppPercentage,
    pkPercentage,
    fivfPercentage,
  };
};
