/**
 * Update Rolling Player Averages Endpoint
 *
 * This endpoint calculates and updates rolling averages for player statistics.
 * It supports various query parameters to control the scope and behavior of the update.
 *
 * Query Parameters:
 * - playerId (number, optional): Specific player ID to process. If omitted, processes all players (subject to other filters).
 * - season (number, optional): Filter games by season ID (e.g., 20232024).
 * - startDate (string, optional): Filter games starting from this date (YYYY-MM-DD).
 * - endDate (string, optional): Filter games up to this date (YYYY-MM-DD).
 * - resumeFrom (number, optional): Resume processing from a specific player ID (exclusive). Useful for continuing interrupted batch jobs.
 * - fullRefresh (boolean, optional): If true, clears existing data for the target scope and reprocesses everything. Defaults to false.
 * - deleteChunkSize (number, optional): Batch size for deleting rows during a full refresh. Defaults to 50000.
 *
 * Example URLs:
 * - Process a single player: /api/v1/db/update-rolling-player-averages?playerId=8478402
 * - Process a specific season: /api/v1/db/update-rolling-player-averages?season=20232024
 * - Full refresh for all players: /api/v1/db/update-rolling-player-averages?fullRefresh=true
 * - Resume from a player ID: /api/v1/db/update-rolling-player-averages?resumeFrom=8477000
 * - Date range: /api/v1/db/update-rolling-player-averages?startDate=2023-10-01&endDate=2023-11-01
 */
// /api/v1/db/update-rolling-player-averages

// 8473548

import type { NextApiRequest, NextApiResponse } from "next";

type ResponseBody = {
  message: string;
};

function parseNumberParam(
  param: string | string[] | undefined
): number | undefined {
  if (!param) return undefined;
  const value = Array.isArray(param) ? param[0] : param;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseStringParam(
  param: string | string[] | undefined
): string | undefined {
  if (!param) return undefined;
  return Array.isArray(param) ? param[0] : param;
}

function parseBooleanParam(
  param: string | string[] | undefined
): boolean | undefined {
  const value = parseStringParam(param);
  if (value === undefined) return undefined;
  return ["1", "true", "yes", "y"].includes(value.toLowerCase());
}

function parsePositiveInt(
  param: string | string[] | undefined
): number | undefined {
  const parsed = parseNumberParam(param);
  if (parsed === undefined) return undefined;
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseBody>
) {
  if (req.method === "HEAD") {
    res.setHeader("Allow", "GET, POST, HEAD");
    res.status(200).json({ message: "Rolling player averages endpoint OK." });
    return;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, HEAD");
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const playerId = parseNumberParam(req.query.playerId);
    const season = parseNumberParam(req.query.season);
    const startDate = parseStringParam(req.query.startDate);
    const endDate = parseStringParam(req.query.endDate);
    const resumeFrom = parseNumberParam(req.query.resumeFrom);
    const fullRefresh = parseBooleanParam(req.query.fullRefresh);
    const deleteChunkSize = parsePositiveInt(req.query.deleteChunkSize);

    const { main } = await import(
      "lib/supabase/Upserts/fetchRollingPlayerAverages"
    );

    console.info(
      "[update-rolling-player-averages] Triggered",
      JSON.stringify({ playerId, season, startDate, endDate, fullRefresh })
    );
    const timerLabel = `[update-rolling-player-averages] total ${Date.now()}`;
    console.time(timerLabel);

    try {
      await main({
        playerId,
        season,
        startDate,
        endDate,
        resumePlayerId: resumeFrom,
        forceFullRefresh: fullRefresh,
        fullRefreshDeleteChunkSize: deleteChunkSize
      });
    } finally {
      console.timeEnd(timerLabel);
    }

    res.status(200).json({
      message: "Rolling player averages processed successfully."
    });
  } catch (error: any) {
    console.error("Error updating rolling player averages:", error);
    res.status(500).json({
      message:
        error?.message ?? "Unknown error updating rolling player averages."
    });
  }
}
