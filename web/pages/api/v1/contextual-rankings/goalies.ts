import {
  buildGoalieMatrixSurface,
  parseGoalieMatrixRequest,
} from "lib/rankings/goalieMatrix";
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
    const request = parseGoalieMatrixRequest(req.query);
    const payload = await buildGoalieMatrixSurface(request);
    return res.status(200).json(payload);
  } catch (error) {
    return sendContextualRankingsError(
      res,
      error,
      "Failed to build goalie rankings matrix",
    );
  }
}
