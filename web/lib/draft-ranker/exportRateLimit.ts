import { RateLimiterMemory } from "rate-limiter-flexible";

import { DraftRankerApiError } from "./api";

const limiter = new RateLimiterMemory({
  keyPrefix: "draft-ranker-export",
  points: 10,
  duration: 60,
  blockDuration: 60,
});

export async function enforceDraftRankingExportRateLimit(userId: string) {
  try {
    return await limiter.consume(userId);
  } catch (error) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(
        Number((error as { msBeforeNext?: number }).msBeforeNext ?? 60_000) /
          1_000,
      ),
    );
    throw new DraftRankerApiError(
      429,
      "rate_limited",
      "Too many ranking exports. Try again shortly.",
      { retryAfterSeconds },
    );
  }
}
