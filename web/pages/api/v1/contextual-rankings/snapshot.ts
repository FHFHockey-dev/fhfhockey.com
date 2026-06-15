import { buildContextualRankingSnapshotSurface } from "lib/rankings/snapshot";
import { ContextualRankingsQueryError } from "lib/rankings/rankingTypes";
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
      await buildContextualRankingSnapshotSurface(req.query),
    );
  } catch (error) {
    const statusCode =
      error instanceof ContextualRankingsQueryError
        ? error.statusCode
        : (error as any)?.statusCode ?? 500;
    return res.status(statusCode).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to build contextual ranking snapshot",
      details: (error as any)?.details,
    });
  }
}
