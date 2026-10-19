import type { NextApiResponse } from "next";

import { ContextualRankingsQueryError } from "./rankingTypes";

// Query errors describe the caller's own parameters, so they keep their
// message and details. Anything else is a dependency failure whose text
// (relation names, PostgREST details) stays in server logs.
export function sendContextualRankingsError(
  res: NextApiResponse,
  error: unknown,
  message: string,
) {
  if (error instanceof ContextualRankingsQueryError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      details: error.details,
    });
  }

  console.error(`${message}:`, error);
  return res.status(500).json({
    success: false,
    message: `${message}.`,
    error: "CONTEXTUAL_RANKINGS_UNAVAILABLE",
  });
}
