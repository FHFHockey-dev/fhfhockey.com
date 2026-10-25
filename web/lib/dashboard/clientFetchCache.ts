type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const responseCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
// Bound completed public responses independently of requests still in flight.
const MAX_RESPONSES = 64;
function pruneResponses(now: number) {
  for (const [key, entry] of responseCache) if (entry.expiresAt <= now) responseCache.delete(key);
  while (responseCache.size > MAX_RESPONSES) responseCache.delete(responseCache.keys().next().value!);
}

export type CachedJsonOptions = {
  ttlMs?: number;
  cacheKey?: string;
  init?: RequestInit;
};

export async function fetchCachedJson<T>(
  url: string,
  options: CachedJsonOptions = {}
): Promise<T> {
  const ttlMs = options.ttlMs ?? 30_000;
  const key = options.cacheKey ?? url;
  const now = Date.now();
  pruneResponses(now);

  const cached = responseCache.get(key) as CacheEntry<T> | undefined;
  if (cached && cached.expiresAt > now) {
    responseCache.delete(key);
    responseCache.set(key, cached);
    return cached.value;
  }

  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) {
    return pending;
  }

  const request = fetch(url, options.init)
    .then(async (response) => {
      if (!response.ok) {
        // Keep the route and status out of the error message, which callers
        // may render; they stay in the development console only.
        if (process.env.NODE_ENV !== "production") {
          console.warn("Dashboard request failed", {
            status: response.status,
            url
          });
        }
        throw new Error("Request failed.");
      }
      const value = (await response.json()) as T;
      const completedAt = Date.now();
      if (now + ttlMs > completedAt) responseCache.set(key, { value, expiresAt: now + ttlMs });
      pruneResponses(completedAt);
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request;
}

export function clearClientFetchCache(): void {
  responseCache.clear();
  inFlight.clear();
}
