// pages/api/v1/db/update-game-goal-projections/index.ts

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import type { NextApiRequest, NextApiResponse } from "next";
import {
  fetchAllGamesInRangeIterative,
  fetchLeagueAverages,
  fetchTeamScores,
  Game
} from "./fetchData";
import {
  buildGameGoalProjections,
  CalculatedGameGoalProjectionData
} from "./calculations";
import supabase from "lib/supabase/server";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";

type ResponseData = {
  success: boolean;
  message: string;
  modelContract: typeof LEGACY_GAME_GOAL_MODEL_CONTRACT;
  data?: CalculatedGameGoalProjectionData[] | null;
};

export const LEGACY_GAME_GOAL_MODEL_CONTRACT = {
  classification: "legacy_team_strength_goal_projection",
  shotLevelExpectedGoals: false,
  outputTable: "expected_goals",
  canonicalShotLevelPipeline: "/api/v1/db/update-nhl-xg-shot-predictions",
} as const;

/**
 * API handler for updating legacy game-level goal projections.
 */
const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) => {
  // Ensure the request method is POST or GET
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["POST", "GET"]);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} Not Allowed`,
      modelContract: LEGACY_GAME_GOAL_MODEL_CONTRACT
    });
  }

  try {
    // Extract 'date' from query parameters
    const { date } = req.query;

    let startDate: string;
    let endDate: string;

    if (date === "all") {
      // Fetch current season's start and end dates
      const currentSeason = await fetchCurrentSeason();

      startDate = currentSeason.startDate; // startDate NOT regularSeasonStartDate
      endDate = currentSeason.endDate; // endDate NOT regularSeasonEndDate
    } else {
      // Default to today's date if 'date' is not 'all'
      const today = new Date();
      startDate = today.toISOString().split("T")[0]; // 'YYYY-MM-DD'
      endDate = startDate;
    }

    // Step 1: Fetch data
    const [games, teamScores, leagueAveragesData] = await Promise.all([
      fetchAllGamesInRangeIterative(startDate, endDate),
      fetchTeamScores(),
      fetchLeagueAverages()
    ]);

    if (!games || games.length === 0) {
      return res.status(200).json({
        success: true,
        modelContract: LEGACY_GAME_GOAL_MODEL_CONTRACT,
        message:
          date === "all"
            ? "No games found for the entire season."
            : "No games found for today."
      });
    }

    const leagueAverages = leagueAveragesData.gf;

    // Step 2: Build game-level goal projections and win odds.
    const calculatedData: CalculatedGameGoalProjectionData[] = await buildGameGoalProjections(
      games,
      teamScores,
      leagueAverages
    );

    if (calculatedData.length === 0) {
      return res.status(200).json({
        success: true,
        modelContract: LEGACY_GAME_GOAL_MODEL_CONTRACT,
        message:
          date === "all"
            ? "No valid games to process for the entire season."
            : "No valid games to process for today."
      });
    }

    // Step 3: Upsert into Supabase
    const { data, error } = await supabase
      .from("expected_goals")
      .upsert(calculatedData, { onConflict: "game_id" });

    if (error) {
      throw new Error(`Supabase upsert error: ${error.message}`);
    }

    return res.status(200).json({
      success: true,
      modelContract: LEGACY_GAME_GOAL_MODEL_CONTRACT,
      message:
        date === "all"
          ? "Game goal projections for the entire season updated successfully."
          : "Game goal projections for today updated successfully.",
      data: data ?? null
    });
  } catch (error: any) {
    console.error("Error updating game goal projections:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
      modelContract: LEGACY_GAME_GOAL_MODEL_CONTRACT
    });
  }
};

// Wrap the handler with adminOnly middleware for authentication
export default withCronJobAudit(handler);
