/**
 * API Endpoint: /api/v1/db/update-PbP
 *
 * Description:
 * This endpoint is responsible for fetching, processing, and storing play-by-play (PbP) data from the NHL's public APIs
 * into the Supabase `pbp_plays` table. It can be used to backfill data for a specific date range, update a single game,
 * run a full historical import, or process the previous day's games.
 *
 * ---
 *
 * URL Query Parameters:
 *
 * 1. `startDate` & `endDate` (optional)
 *    - Description: Defines a date range for which to fetch PbP data. The system will find all games between these
 *      two dates (inclusive) and ingest their data. Both parameters must be provided together.
 *    - Format: `YYYY-MM-DD`
 *    - Example URL:
 *      `http://localhost:3000/api/v1/db/update-PbP?startDate=2025-10-05&endDate=2025-10-12`
 *      This will process all games from October 5th, 2025, to October 12th, 2025.
 *
 * 2. `gameId` (optional)
 *    - Description: Specifies a single, specific NHL game ID to process, or triggers processing for the previous day.
 *    - Format: A 10-digit NHL game ID, or the literal string `recent`.
 *    - Example (Single Game):
 *      `http://localhost:3000/api/v1/db/update-PbP?gameId=2023020418`
 *      This will process only the game with the ID `2023020418`.
 *    - Example (Previous Day):
 *      `http://localhost:3000/api/v1/db/update-PbP?gameId=recent`
 *      This will process all games from yesterday (relative to the server's current date). This is ideal for cron jobs.
 *
 * 3. `games=all` (optional)
 *    - Description: A flag that triggers a full historical data import. This will fetch PbP data for all games
 *      in the entire season and should be used with caution as it can be a very long-running process.
 *    - Format: The literal string `all`.
 *    - Example URL:
 *      `http://localhost:3000/api/v1/db/update-PbP?games=all`
 *
 * ---
 *
 * Notes:
 *
 * - If no parameters are provided, the function defaults to processing games for the current day.
 * - The endpoint supports both `GET` and `POST` methods.
 * - This is a data ingestion endpoint and is a prerequisite for building derived projection data.
 */
// /Users/tim/Desktop/FHFH/fhfhockey.com/web/pages/api/v1/db/update-PbP.ts

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import type { NextApiRequest, NextApiResponse } from "next";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ message: string }>
) {
  try {
    // Dynamically import the fetchPbP module (adjust the path if necessary)
    const { main } = await import("lib/supabase/Upserts/fetchPbP");

    if (req.query.gameId === "recent") {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      await main(false, undefined, yesterdayStr, yesterdayStr);

      return res.status(200).json({
        message: `Play-by-play data processed successfully for previous day: ${yesterdayStr}`
      });
    }

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

export default withCronJobAudit(handler);
