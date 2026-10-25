import { RateLimiterMemory } from "rate-limiter-flexible";
import { DraftProRequestError } from "./requestError";

const limiter = new RateLimiterMemory({
  keyPrefix: "draft-pro-dust",
  points: 20,
  duration: 60,
  blockDuration: 60,
});

export async function enforceDraftProDustRateLimit(userId: string) {
  try {
    return await limiter.consume(userId);
  } catch (error) {
    const retryAfterSeconds = Math.max(1, Math.ceil(Number((error as { msBeforeNext?: number }).msBeforeNext ?? 60_000) / 1_000));
    const rateLimitError = new DraftProRequestError(429, "Too many DUST calculations. Try again shortly.", "rate_limited");
    Object.assign(rateLimitError, { retryAfterSeconds });
    throw rateLimitError;
  }
}
