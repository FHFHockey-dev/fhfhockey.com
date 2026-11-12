import { withNstJobLifecycle } from "lib/nst/jobLifecycle.server";
import type { NextApiRequest, NextApiResponse } from "next";
import type { Response } from "lib/api/averages/types";
import {
  getAggregatedCountsData,
  getAggregatedRatesData
} from "lib/api/averages/statsService";

export type { Data, RatesData } from "lib/api/averages/types";

// W3-3 D3/A2 (L19): this route used to carry its own copy of the averages
// maths (60x low SOG/60, summed TOT rates, unweighted seasons, mixed share
// scales). It now serves the shared service, so /api/ThreeYearAverages and
// /api/Averages return the same pooled, versioned contract
// (AVERAGES_SCALE_CONTRACT). The handler and the four Get* names stay as they
// were (lib/nst/callerLifecycle.test.ts executes the handler in isolation).

async function GetThreeYearStats(playerId: string) {
  const { yearlyData, averages, scaleContract } =
    await getAggregatedCountsData(playerId, true);
  return {
    yearlyCounts: yearlyData,
    threeYearCountsAverages: averages,
    scaleContract
  };
}

async function GetThreeYearRates(playerId: string) {
  const { yearlyData, averages } = await getAggregatedRatesData(playerId, true);
  return { yearlyRates: yearlyData, threeYearRatesAverages: averages };
}

async function GetCareerStats(playerId: string) {
  const { yearlyData, averages } = await getAggregatedCountsData(
    playerId,
    false
  );
  return { yearlyCounts: yearlyData, careerAverageCounts: averages };
}

async function GetCareerRates(playerId: string) {
  const { yearlyData, averages } = await getAggregatedRatesData(
    playerId,
    false
  );
  return { yearlyRates: yearlyData, careerAverageRates: averages };
}

async function handler(
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
    const { yearlyCounts, threeYearCountsAverages, scaleContract } =
      await GetThreeYearStats(playerId as string);

    // Fetch three-year rate stats
    const { yearlyRates, threeYearRatesAverages } = await GetThreeYearRates(
      playerId as string
    );

    // Fetch career counting stats
    const { yearlyCounts: careerYearlyCounts, careerAverageCounts } =
      await GetCareerStats(playerId as string);

    // Fetch career rate stats
    const { yearlyRates: careerYearlyRates, careerAverageRates } =
      await GetCareerRates(playerId as string);

    res.json({
      success: true,
      message:
        "Successfully fetched the career and three-year averages stats for player: " +
        playerId,
      scaleContract,
      yearlyCounts,
      threeYearCountsAverages,
      yearlyRates,
      threeYearRatesAverages,

      // **Include the Career Averages**
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

export default withNstJobLifecycle(handler, "ThreeYearAverages/[playerId]", undefined, { lazy: true });
