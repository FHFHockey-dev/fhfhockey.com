// /Users/tim/Desktop/FHFH/fhfhockey.com/web/pages/api/v1/db/update-PbP.ts

import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ message: string }>
) {
  try {
    // Dynamically import the fetchPbP module (adjust the path if necessary)
    const { main } = await import("lib/supabase/Upserts/fetchPbP");
    const gameId = req.query.gameId ? String(req.query.gameId) : undefined;
    const fullProcess = req.query.games === "all";
    const startDate = req.query.startDate
      ? String(req.query.startDate)
      : undefined;
    const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

    // Invoke the main function with the parameter
    await main(fullProcess, gameId, startDate, endDate);

    res.status(200).json({
      message: `Play-by-play data processed successfully. (Full process: ${fullProcess}, Start Date: ${startDate}, End Date: ${endDate})`
    });
  } catch (error: any) {
    console.error("Error processing play-by-play data:", error);
    res.status(500).json({ message: `Error: ${error.message}` });
  }
}
