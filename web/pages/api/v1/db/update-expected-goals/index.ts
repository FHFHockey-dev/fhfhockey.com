// pages/api/v1/db/update-expected-goals/index.ts

import type { NextApiRequest, NextApiResponse } from "next";
import {
  fetchAllGamesInRangeIterative,
  fetchLeagueAverages,
  fetchTeamScores,
  Game,
} from "./fetchData";
import { performCalculations, CalculatedGameData } from "./calculations";
import supabase from "lib/supabase";
import adminOnly from "utils/adminOnlyMiddleware";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason"; // Ensure this path is correct

type ResponseData = {
  success: boolean;
  message: string;
  data?: CalculatedGameData[] | null;
};

/**
 * API Handler for updating expected goals.
 */
const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) => {
  // Ensure the request method is POST
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} Not Allowed`,
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
      fetchLeagueAverages(),
    ]);

    if (!games || games.length === 0) {
      return res.status(200).json({
        success: true,
        message:
          date === "all"
            ? "No games found for the entire season."
            : "No games found for today.",
      });
    }

    const leagueAverages = leagueAveragesData.gf;

    // Step 2: Perform calculations
    const calculatedData: CalculatedGameData[] = await performCalculations(
      games,
      teamScores,
      leagueAverages
    );

    if (calculatedData.length === 0) {
      return res.status(200).json({
        success: true,
        message:
          date === "all"
            ? "No valid games to process for the entire season."
            : "No valid games to process for today.",
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
      message:
        date === "all"
          ? "Expected goals for the entire season updated successfully."
          : "Expected goals for today updated successfully.",
      data: data ?? null,
    });
  } catch (error: any) {
    console.error("Error updating expected goals:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Wrap the handler with adminOnly middleware for authentication
export default adminOnly(handler);
