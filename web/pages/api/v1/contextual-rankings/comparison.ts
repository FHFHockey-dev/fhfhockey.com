import { buildContextualRankingComparisonSurface } from "lib/rankings/comparison";
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
    return res.status(200).json(
      await buildContextualRankingComparisonSurface(req.query),
    );
  } catch (error) {
    return sendContextualRankingsError(
      res,
      error,
      "Failed to build contextual ranking comparison",
    );
  }
}
