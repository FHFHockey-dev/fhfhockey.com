type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const responseCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

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

  const cached = responseCache.get(key) as CacheEntry<T> | undefined;
  if (cached && cached.expiresAt > now) {
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
      responseCache.set(key, {
        value,
        expiresAt: now + ttlMs
      });
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
