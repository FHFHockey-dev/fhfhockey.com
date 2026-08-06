import { useCallback, useEffect, useState } from "react";

type QueryStateSetter = (value: string | null) => Promise<boolean>;

function readQueryValue(key: string, defaultValue: string | null) {
  if (typeof window === "undefined") return defaultValue;
  return new URLSearchParams(window.location.search).get(key) ?? defaultValue;
}

/**
 * A Pages Router-safe string query-state hook.
 *
 * next-usequerystate@1.x memoizes its server-side null values when a statically
 * rendered Next 15 page hydrates, so direct URL visits can display defaults even
 * while the requested query string remains in the address bar. This hook waits
 * for the browser before reading the URL and uses the History API for synchronous,
 * deterministic updates between the page's related controls.
 */
export function useUrlQueryState(
  key: string,
  defaultValue: string | null = null,
): [string | null, QueryStateSetter, boolean] {
  const [value, setValue] = useState<string | null>(defaultValue);
  const [hydrated, setHydrated] = useState(false);

  const syncFromUrl = useCallback(() => {
    setValue(readQueryValue(key, defaultValue));
    setHydrated(true);
  }, [defaultValue, key]);

  useEffect(() => {
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, [syncFromUrl]);

  const update = useCallback<QueryStateSetter>(
    async (nextValue) => {
      if (typeof window === "undefined") return false;

      const url = new URL(window.location.href);
      if (nextValue == null) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, nextValue);
      }

      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
      setValue(nextValue ?? defaultValue);
      return true;
    },
    [defaultValue, key],
  );

  return [value, update, hydrated];
}
