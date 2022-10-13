const cache = new Map<string, any>();
let num = 0;
export function memoizeAsync<T>(func: (...args: any) => T, ttl?: number) {
  return async (...args: any[]): Promise<T> => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      console.log("hit cache!");
      console.log(num++);

      return cache.get(key);
    }

    cache.set(key, await func(...args));
    // delete the cached data when it is expired
    if (ttl !== undefined) {
      setTimeout(() => {
        cache.delete(key);
      }, ttl);
    }
    return cache.get(key);
  };
}
