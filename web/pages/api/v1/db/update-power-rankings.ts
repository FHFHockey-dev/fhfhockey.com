// /Users/tim/Desktop/FHFH/fhfhockey.com/web/pages/api/v1/db/update-power-rankings.ts

// /api/v1/db/update-power-rankings

import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ message: string }>
) {
  try {
    // Dynamically import the fetchPowerRankings module
    const { main } = await import("lib/supabase/Upserts/fetchPowerRankings");
    // Call the main function (pass fullProcess if necessary)
    await main();

    res.status(200).json({
      message: `Power rankings data processed successfully.`
    });
  } catch (error: any) {
    console.error("Error processing power rankings data:", error);
    res.status(500).json({ message: `Error: ${error.message}` });
  }
}
