const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;
const requests = new Map<string, number[]>();

/** Process-local backstop; deployment-level limits can be added without changing the API contract. */
export function consumeRecommendationRequest(userId: string, now = Date.now()) {
  const recent = (requests.get(userId) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    requests.set(userId, recent);
    return false;
  }
  recent.push(now);
  requests.set(userId, recent);
  return true;
}
