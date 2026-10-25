type Pending<T> = { controller: AbortController; promise: Promise<T>; subscribers: number };
const abortError = () => new DOMException("Read cancelled", "AbortError");

/** Public reads only. Completed payloads are bounded; pending reads belong to their subscribers. */
export function createSharedReadCache<T>(ttlMs = 30_000, maxEntries = 64) {
  const completed = new Map<string, { value: T; expiresAt: number }>();
  const pending = new Map<string, Pending<T>>();
  const prune = () => {
    const now = Date.now();
    for (const [key, entry] of completed) if (entry.expiresAt <= now) completed.delete(key);
    while (completed.size > maxEntries) completed.delete(completed.keys().next().value!);
  };
  return {
    has(key: string) {
      prune();
      return completed.has(key) || pending.has(key);
    },
    read(key: string, load: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
      if (signal?.aborted) return Promise.reject(abortError());
      prune();
      const cached = completed.get(key);
      if (cached) {
        completed.delete(key);
        completed.set(key, cached);
        return Promise.resolve(cached.value);
      }
      let entry = pending.get(key);
      if (!entry) {
        const controller = new AbortController();
        const expiresAt = Date.now() + ttlMs;
        const next: Pending<T> = { controller, subscribers: 0, promise: undefined! };
        // Register before starting I/O so same-turn subscribers can share the read.
        next.promise = Promise.resolve().then(() => {
          if (controller.signal.aborted) throw abortError();
          return load(controller.signal);
        }).then(value => {
          if (!controller.signal.aborted && expiresAt > Date.now()) {
            completed.set(key, { value, expiresAt });
            prune();
          }
          return value;
        }).finally(() => { if (pending.get(key) === next) pending.delete(key); });
        pending.set(key, next);
        entry = next;
      }
      const shared = entry;
      shared.subscribers++;
      return new Promise<T>((resolve, reject) => {
        let settled = false;
        const release = () => {
          if (settled) return false;
          settled = true;
          signal?.removeEventListener("abort", cancel);
          shared.subscribers--;
          if (shared.subscribers === 0 && pending.get(key) === shared) {
            pending.delete(key);
            shared.controller.abort();
          }
          return true;
        };
        const cancel = () => { if (release()) reject(abortError()); };
        signal?.addEventListener("abort", cancel, { once: true });
        shared.promise.then(value => { if (release()) resolve(value); }, error => { if (release()) reject(error); });
      });
    },
  };
}
