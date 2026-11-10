/** Small, process-local cache for public trend data. Failures are never retained. */
export function createTrendRequestCache<T>(ttlMs: number, maxEntries: number) {
  const values = new Map<string, { value: T; expiresAt: number }>();
  const pending = new Map<string, Promise<T>>();
  return {
    async get(key: string, load: () => Promise<T>): Promise<T> {
      const now = Date.now();
      for (const [entryKey, entry] of values) {
        if (entry.expiresAt <= now) values.delete(entryKey);
      }
      const cached = values.get(key);
      if (cached) return cached.value;
      const existing = pending.get(key);
      if (existing) return existing;
      // Keep the cache bounded even for many distinct user-selected filters.
      if (pending.size >= maxEntries) return load();
      const request = Promise.resolve().then(load).then((value) => {
        if (pending.get(key) === request && now + ttlMs > Date.now()) {
          while (values.size >= maxEntries) values.delete(values.keys().next().value!);
          values.set(key, { value, expiresAt: now + ttlMs });
        }
        return value;
      }).finally(() => {
        if (pending.get(key) === request) pending.delete(key);
      });
      pending.set(key, request);
      return request;
    },
    clear() {
      values.clear();
      pending.clear();
    },
  };
}
