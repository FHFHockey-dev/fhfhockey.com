import type { NextApiResponse } from "next";

import { FantraxIntegrationError } from "./server";

export function respondWithFantraxError(
  res: NextApiResponse,
  error: unknown,
  fallbackMessage = "Fantrax integration failed.",
) {
  if (error instanceof FantraxIntegrationError) {
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
    code: "FANTRAX_INTERNAL_ERROR",
  });
}
