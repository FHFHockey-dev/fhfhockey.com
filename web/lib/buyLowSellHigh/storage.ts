/**
 * Versioned device-local Buy Low/Sell High state (FR-15). Own key; never RSO workspace keys.
 * Holds only identities, entered references and draft selections: no tokens or account payloads.
 */
import type { MarketReference } from "./market";

export const BLSH_STORAGE_KEY = "fhfh.buyLowSellHigh.local.v1";

export type WatchEntry = { playerId: string; target: string; horizon: number; addedAt: string; gapAtAdd: number | null };
export type BlshLocalState = {
  version: 1;
  watchlist: WatchEntry[];
  draft: { give: string[]; receive: string[] };
  marketReferences: Record<string, MarketReference>;
};

export const emptyBlshState = (): BlshLocalState => ({ version: 1, watchlist: [], draft: { give: [], receive: [] }, marketReferences: {} });

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === "string");

function valid(value: unknown): value is BlshLocalState {
  if (!value || typeof value !== "object") return false;
  const state = value as BlshLocalState;
  return state.version === 1 && Array.isArray(state.watchlist)
    && state.watchlist.every(entry => entry && typeof entry.playerId === "string" && typeof entry.target === "string"
      && typeof entry.horizon === "number" && typeof entry.addedAt === "string" && (entry.gapAtAdd === null || typeof entry.gapAtAdd === "number"))
    && !!state.draft && isStringArray(state.draft.give) && isStringArray(state.draft.receive)
    && !!state.marketReferences && typeof state.marketReferences === "object" && !Array.isArray(state.marketReferences);
}

/** Never throws. Unreadable or unrecognized data yields an empty state with `recovered: true`. */
export function loadBlshState(storage: Pick<Storage, "getItem"> | null | undefined): { state: BlshLocalState; recovered: boolean } {
  try {
    const raw = storage?.getItem(BLSH_STORAGE_KEY);
    if (!raw) return { state: emptyBlshState(), recovered: false };
    const parsed: unknown = JSON.parse(raw);
    return valid(parsed) ? { state: parsed, recovered: false } : { state: emptyBlshState(), recovered: true };
  } catch {
    return { state: emptyBlshState(), recovered: true };
  }
}

export function saveBlshState(storage: Pick<Storage, "setItem"> | null | undefined, state: BlshLocalState): boolean {
  try { storage?.setItem(BLSH_STORAGE_KEY, JSON.stringify(state)); return !!storage; } catch { return false; }
}

export function resetBlshState(storage: Pick<Storage, "removeItem"> | null | undefined): boolean {
  try { storage?.removeItem(BLSH_STORAGE_KEY); return !!storage; } catch { return false; }
}
