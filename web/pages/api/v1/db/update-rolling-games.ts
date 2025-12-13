// /pages/api/v1/db/update-rolling-games.ts

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import type { NextApiRequest, NextApiResponse } from "next";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ message: string }>
) {
  try {
    // Parse query parameter:
    // /api/v1/db/update-rolling-games?date=all         (default), full season process or:
    // /api/v1/db/update-rolling-games?date=recent      for just the most recent games
    const mode = req.query.date === "recent" ? "recent" : "all";
    const { main } = await import("lib/supabase/Upserts/fetchRollingGames");
    await main(mode);
    res.status(200).json({
      message: `Rolling games data processed successfully in ${mode} mode.`
    });
  } catch (error: any) {
    console.error("Error processing rolling games data:", error);
    res.status(500).json({ message: `Error: ${error.message}` });
  }
}

export default withCronJobAudit(handler);
