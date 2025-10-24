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

    const { main } = await import(
      "lib/supabase/Upserts/fetchRollingPlayerAverages"
    );

    console.info(
      "[update-rolling-player-averages] Triggered",
      JSON.stringify({ playerId, season, startDate, endDate })
    );
    const timerLabel = `[update-rolling-player-averages] total ${Date.now()}`;
    console.time(timerLabel);

    try {
      await main({
        playerId,
        season,
        startDate,
        endDate,
        resumePlayerId: resumeFrom
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
