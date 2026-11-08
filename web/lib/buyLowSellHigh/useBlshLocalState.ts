import { useCallback, useEffect, useRef, useState } from "react";
import { BLSH_STORAGE_KEY, LEGACY_BLSH_STORAGE_KEY, emptyBlshState, loadBlshState, updateBlshState,
  type BlshLocalState, type BlshStorageKey, type LoadResult, type MutationResult } from "./storage";

const LOCAL_EVENT = "fhfh:blsh-local-change";
const storage = () => { try { return window.localStorage; } catch { return null; } };
const sameDraft = (a: BlshLocalState["draft"], b: BlshLocalState["draft"]) => JSON.stringify(a) === JSON.stringify(b);
export { sameDraft };

/** No write-on-mount effect: server rendering and hydration cannot overwrite saved selections. */
export function useBlshLocalState(key: BlshStorageKey = BLSH_STORAGE_KEY) {
  const [loaded, setLoaded] = useState<LoadResult>({ state: emptyBlshState(), status: "ready", present: false });
  const [hydratedKey, setHydratedKey] = useState<BlshStorageKey | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<MutationResult["failure"]>();
  const busy = useRef(false);
  const hydrated = hydratedKey === key;
  useEffect(() => {
    const read = () => { setLoaded(loadBlshState(storage(), key)); setHydratedKey(key); };
    const changed = (event: StorageEvent) => {
      if (event.key === null || event.key === key || (key === BLSH_STORAGE_KEY && event.key === LEGACY_BLSH_STORAGE_KEY)) read();
    };
    read();
    setFailure(undefined);
    window.addEventListener("storage", changed);
    window.addEventListener(LOCAL_EVENT, read);
    return () => { window.removeEventListener("storage", changed); window.removeEventListener(LOCAL_EVENT, read); };
  }, [key]);

  const mutate = useCallback(async (change: (current: BlshLocalState) => BlshLocalState | null): Promise<boolean> => {
    if (!hydrated || busy.current) return false;
    busy.current = true;
    setPending(true);
    try {
      const write = () => updateBlshState(storage(), change, key);
      const result = typeof navigator !== "undefined" && navigator.locks?.request
        ? await navigator.locks.request(key, write) : write();
      setLoaded(result);
      setFailure(result.failure);
      if (result.saved) window.dispatchEvent(new Event(LOCAL_EVENT));
      return result.saved;
    } catch {
      setFailure("write_failed");
      return false;
    } finally { busy.current = false; setPending(false); }
  }, [key, hydrated]);

  const message = !hydrated ? "Loading device-local BLSH data…"
    : loaded.status === "invalid" ? "Saved BLSH data is unreadable or from a newer version. It has been left untouched; saving is unavailable."
      : loaded.status === "blocked" ? "This browser blocked local storage. Changes cannot be saved on this device."
        : failure === "conflict" ? "The saved draft changed in another tab. Load the saved draft before replacing it."
          : failure ? "Could not save locally. Existing saved data was left untouched."
            : null;
  return { ...loaded, hydrated, pending, message, clearMessage: () => setFailure(undefined), canSave: hydrated && loaded.status === "ready" && !pending, mutate };
}
