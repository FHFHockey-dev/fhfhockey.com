// Isolated presentation harness. Unit tests cover the real Next router's call contract.
import { useSyncExternalStore } from "react";
const listeners = new Set<() => void>();
const read = () => ({ query: Object.fromEntries(new URLSearchParams(location.search)), isReady: true,
  pathname: "/", replace: async ({ query }: { query: Record<string, string> }) => {
    history.replaceState(null, "", `/?${new URLSearchParams(query)}`); update(); return true;
  } });
let state = read();
function update() { state = read(); listeners.forEach(listener => listener()); }
addEventListener("popstate", update);
export function useRouter() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => state);
}
