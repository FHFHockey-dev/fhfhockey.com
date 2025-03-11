// /Users/tim/Desktop/FHFH/fhfhockey.com/web/pages/api/v1/db/update-PbP.ts

import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ message: string }>
) {
  try {
    // Dynamically import the fetchPbP module (adjust the path if necessary)
    const { main } = await import("lib/supabase/Upserts/fetchPbP");

    // Check query parameter
    const fullProcess = req.query.games === "all";

    // Invoke the main function with the parameter
    await main(fullProcess);

    res
      .status(200)
      .json({
        message: `Play-by-play data processed successfully. (Full process: ${fullProcess})`
      });
  } catch (error: any) {
    console.error("Error processing play-by-play data:", error);
    res.status(500).json({ message: `Error: ${error.message}` });
  }
}
