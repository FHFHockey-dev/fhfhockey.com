import {
  buildPlayerMatrixSurface,
  parsePlayerMatrixRequestWithResolvedTeam,
} from "lib/rankings/playerMatrix";
import { sendContextualRankingsError } from "lib/rankings/apiErrorResponse";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const request = await parsePlayerMatrixRequestWithResolvedTeam(req.query);
    const payload = await buildPlayerMatrixSurface(request);
    return res.status(200).json(payload);
  } catch (error) {
    return sendContextualRankingsError(
      res,
      error,
      "Failed to build player rankings matrix",
    );
  }
}
