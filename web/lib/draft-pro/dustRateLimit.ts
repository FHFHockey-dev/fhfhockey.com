import { RateLimiterMemory } from "rate-limiter-flexible";

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
    const rateLimitError = new Error("Too many DUST calculations. Try again shortly.");
    Object.assign(rateLimitError, { statusCode: 429, code: "rate_limited", retryAfterSeconds });
    throw rateLimitError;
  }
}
