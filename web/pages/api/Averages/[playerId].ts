// /Users/tim/Desktop/FHFH/fhfhockey.com/web/pages/api/Averages/[playerId].ts

import type { NextApiRequest, NextApiResponse } from "next";
import { Response } from "./types";
import {
  getAggregatedCountsData,
  getAggregatedRatesData
} from "./statsService";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Response>
) {
  const { playerId } = req.query;
  if (!playerId) {
    return res.json({
      message: "Player Id is required",
      success: false
    });
  }

  try {
    // Fetch three-year counting stats
    const { yearlyData: yearlyCounts, averages: threeYearCountsAverages } =
      await getAggregatedCountsData(playerId as string, true);

    // Fetch three-year rate stats
    const { yearlyData: yearlyRates, averages: threeYearRatesAverages } =
      await getAggregatedRatesData(playerId as string, true);

    // Fetch career counting stats
    const { averages: careerAverageCounts } = await getAggregatedCountsData(
      playerId as string,
      false
    );

    // Fetch career rate stats
    const { averages: careerAverageRates } = await getAggregatedRatesData(
      playerId as string,
      false
    );

    res.json({
      success: true,
      message: `Successfully fetched the career and three-year averages stats for player: ${playerId}`,
      yearlyCounts,
      threeYearCountsAverages,
      yearlyRates,
      threeYearRatesAverages,
      careerAverageCounts,
      careerAverageRates
    });
  } catch (e: any) {
    res.json({
      success: false,
      message: "Unable to fetch the data. " + e.message
    });
  }
}
