/** Device-local BLSH identities/selections only. Never account payloads or RSO workspace keys. */
import type { MarketReference } from "./market";

export const LEGACY_BLSH_STORAGE_KEY = "fhfh.buyLowSellHigh.local.v1";
export const BLSH_STORAGE_KEY = "fhfh.buyLowSellHigh.local.v2";
export const BLSH_FIXTURE_STORAGE_KEY = "fhfh.buyLowSellHigh.fixture.local.v2";
export type BlshStorageKey = typeof BLSH_STORAGE_KEY | typeof BLSH_FIXTURE_STORAGE_KEY;

/** Preserved verbatim on v1 migration. Never interpret the old target/horizon as research context. */
export type LegacyWatchEntry = { playerId: string; target: string; horizon: number; addedAt: string; gapAtAdd: number | null };
/** Identity bookmark, deliberately without a saved gap, score, forecast target or horizon. */
export type ResearchWatchEntry = { kind: "research_identity"; playerId: string; addedAt: string };
export type WatchEntry = LegacyWatchEntry | ResearchWatchEntry;
export type BlshLocalState = {
  version: 2;
  watchlist: WatchEntry[];
  draft: { give: string[]; receive: string[] };
  marketReferences: Record<string, MarketReference>;
};
export type LocalStatus = "ready" | "invalid" | "blocked";
export type LoadResult = { state: BlshLocalState; status: LocalStatus; present: boolean };
type Reader = Pick<Storage, "getItem">;
type StorageAccess = Pick<Storage, "getItem" | "setItem">;
export type MutationResult = LoadResult & { saved: boolean; failure?: "invalid" | "blocked" | "conflict" | "write_failed" };

export const emptyBlshState = (): BlshLocalState => ({ version: 2, watchlist: [], draft: { give: [], receive: [] }, marketReferences: {} });
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && !!value.trim();
const timestamp = (value: unknown) => text(value) && Number.isFinite(Date.parse(value));
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const positiveInteger = (value: unknown) => finite(value) && Number.isSafeInteger(value) && value > 0;
const ids = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);
const legacyWatch = (entry: Record<string, unknown>) => entry.kind === undefined && text(entry.target) && positiveInteger(entry.horizon)
  && (entry.gapAtAdd === null || finite(entry.gapAtAdd));
function valid(value: unknown, version: 1 | 2): boolean {
  return object(value) && value.version === version && Array.isArray(value.watchlist)
    && value.watchlist.every(entry => object(entry) && text(entry.playerId) && timestamp(entry.addedAt)
      && ((version === 2 && entry.kind === "research_identity" && entry.target === undefined && entry.horizon === undefined && entry.gapAtAdd === undefined) || legacyWatch(entry)))
    && object(value.draft) && ids(value.draft.give) && ids(value.draft.receive)
    && object(value.marketReferences) && Object.values(value.marketReferences).every(reference => object(reference)
      && text(reference.source) && ["manager_entered", "external"].includes(reference.kind as string) && timestamp(reference.capturedAt)
      && positiveInteger(reference.horizonGames) && text(reference.scoringBasis) && ["fantasy_points", "count"].includes(reference.unit as string)
      && finite(reference.value) && (reference.note === undefined || typeof reference.note === "string"));
}

/** Reads only. Corrupt/future data is not deleted, repaired, or overwritten automatically. */
export function loadBlshState(storage: Reader | null | undefined, key: BlshStorageKey = BLSH_STORAGE_KEY): LoadResult {
  const fallback = (status: LocalStatus, present = false): LoadResult => ({ state: emptyBlshState(), status, present });
  if (!storage) return fallback("blocked");
  try {
    const raw = storage.getItem(key);
    // The fixture namespace must never import real selections (or legacy synthetic examples).
    const legacy = raw === null && key === BLSH_STORAGE_KEY ? storage.getItem(LEGACY_BLSH_STORAGE_KEY) : null;
    const source = raw ?? legacy;
    if (source === null) return fallback("ready");
    let parsed: unknown;
    try { parsed = JSON.parse(source); } catch { return fallback("invalid", true); }
    if (!valid(parsed, raw === null ? 1 : 2)) return fallback("invalid", true);
    return { state: { ...(parsed as BlshLocalState), version: 2 }, status: "ready", present: true };
  } catch { return fallback("blocked"); }
}

/**
 * Read latest at action time and mutate one section. Returning null rejects a stale draft edit.
 * The UI serializes cooperating tabs with Web Locks where available. Without Web Locks this
 * still merges sequential edits, but localStorage cannot guarantee atomic concurrent writes.
 */
export function updateBlshState(storage: StorageAccess | null | undefined,
  change: (current: BlshLocalState) => BlshLocalState | null, key: BlshStorageKey = BLSH_STORAGE_KEY): MutationResult {
  const loaded = loadBlshState(storage, key);
  if (loaded.status !== "ready") return { ...loaded, saved: false, failure: loaded.status };
  const next = change(loaded.state);
  if (!next) return { ...loaded, saved: false, failure: "conflict" };
  if (!valid(next, 2)) return { ...loaded, saved: false, failure: "invalid" };
  try {
    storage!.setItem(key, JSON.stringify(next));
    return { state: next, status: "ready", present: true, saved: true };
  } catch { return { ...loaded, saved: false, failure: "write_failed" }; }
}

/** Explicit whole-state operations. UI controls use section-specific mutations instead. */
export function saveBlshState(storage: StorageAccess | null | undefined, state: BlshLocalState): boolean {
  return updateBlshState(storage, () => state).saved;
}
export function resetBlshState(storage: StorageAccess | null | undefined): boolean {
  // A v2 empty record prevents an intentionally cleared draft resurrecting from preserved v1.
  return saveBlshState(storage, emptyBlshState());
}
