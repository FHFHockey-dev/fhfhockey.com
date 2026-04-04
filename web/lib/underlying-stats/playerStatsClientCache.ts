export const PLAYER_STATS_CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;

const PLAYER_STATS_VIEW_QUERY_KEYS = new Set([
  "sortKey",
  "sortDirection",
  "page",
  "pageSize",
]);

type PlayerStatsClientCacheEntry<TPayload> = {
  cachedAt: number;
  payload: TPayload;
};

export type PlayerStatsClientCacheLookup<TPayload> = {
  payload: TPayload;
  isFresh: boolean;
};

function toAbsoluteRequestUrl(requestPath: string): URL {
  return new URL(requestPath, "http://localhost");
}

function buildPlayerStatsClientCacheStorageKey(
  storagePrefix: string,
  requestPath: string
): string {
  return `${storagePrefix}:${requestPath}`;
}

function readCachedEntryFromSessionStorage<TPayload>(
  storageKey: string
): PlayerStatsClientCacheEntry<TPayload> | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(storageKey);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as Partial<
      PlayerStatsClientCacheEntry<TPayload>
    >;
    if (typeof parsed.cachedAt !== "number" || !("payload" in parsed)) {
      window.sessionStorage.removeItem(storageKey);
      return null;
    }

    return parsed as PlayerStatsClientCacheEntry<TPayload>;
  } catch {
    return null;
  }
}

function writeCachedEntryToSessionStorage<TPayload>(
  storageKey: string,
  entry: PlayerStatsClientCacheEntry<TPayload>
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(entry));
  } catch {}
}

export function getPlayerStatsClientCachedResponse<TPayload>(args: {
  requestPath: string;
  storagePrefix: string;
  memoryCache: Map<string, PlayerStatsClientCacheEntry<TPayload>>;
  ttlMs?: number;
  now?: number;
}): PlayerStatsClientCacheLookup<TPayload> | null {
  const ttlMs = args.ttlMs ?? PLAYER_STATS_CLIENT_CACHE_TTL_MS;
  const now = args.now ?? Date.now();
  const storageKey = buildPlayerStatsClientCacheStorageKey(
    args.storagePrefix,
    args.requestPath
  );
  const memoryEntry = args.memoryCache.get(args.requestPath);
  const sessionEntry =
    memoryEntry ?? readCachedEntryFromSessionStorage<TPayload>(storageKey);
  if (!sessionEntry) {
    return null;
  }

  const isFresh = now - sessionEntry.cachedAt <= ttlMs;
  args.memoryCache.set(args.requestPath, sessionEntry);

  return {
    payload: sessionEntry.payload,
    isFresh,
  };
}

export function setPlayerStatsClientCachedResponse<TPayload>(args: {
  requestPath: string;
  storagePrefix: string;
  memoryCache: Map<string, PlayerStatsClientCacheEntry<TPayload>>;
  payload: TPayload;
  now?: number;
}) {
  const entry: PlayerStatsClientCacheEntry<TPayload> = {
    cachedAt: args.now ?? Date.now(),
    payload: args.payload,
  };
  const storageKey = buildPlayerStatsClientCacheStorageKey(
    args.storagePrefix,
    args.requestPath
  );

  args.memoryCache.set(args.requestPath, entry);
  writeCachedEntryToSessionStorage(storageKey, entry);
}

export function stripPlayerStatsViewParams(requestPath: string): string {
  const requestUrl = toAbsoluteRequestUrl(requestPath);

  for (const key of PLAYER_STATS_VIEW_QUERY_KEYS) {
    requestUrl.searchParams.delete(key);
  }

  requestUrl.searchParams.sort();

  const normalizedQuery = requestUrl.searchParams.toString();
  return normalizedQuery
    ? `${requestUrl.pathname}?${normalizedQuery}`
    : requestUrl.pathname;
}

export function isViewOnlyPlayerStatsRequestChange(
  previousRequestPath: string | null,
  nextRequestPath: string
): boolean {
  if (!previousRequestPath) {
    return false;
  }

  return (
    stripPlayerStatsViewParams(previousRequestPath) ===
    stripPlayerStatsViewParams(nextRequestPath)
  );
}
