import type { NextApiResponse } from "next";

import { EspnIntegrationError } from "./server";

export function respondWithEspnError(
  res: NextApiResponse,
  error: unknown,
  fallbackMessage = "ESPN Fantasy integration failed.",
) {
  if (error instanceof EspnIntegrationError) {
    if (error.retryAfterSeconds != null) {
      res.setHeader("Retry-After", String(error.retryAfterSeconds));
    }
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      retryAfterSeconds: error.retryAfterSeconds,
    });
  }
  return res.status(500).json({
    error: fallbackMessage,
    code: "ESPN_INTERNAL_ERROR",
  });
}
