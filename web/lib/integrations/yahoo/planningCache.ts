import type { SupabaseClient } from "@supabase/supabase-js";
import type { YahooProviderJsonResult } from "./providerClient";

/**
 * Process-local Yahoo read caches for the RSO Yahoo diet (flag `RSO_YAHOO_DIET`). Every key starts with the
 * principal, so nothing is shared across accounts; a cold instance simply reads Yahoo again. Entries keep the
 * time they were read, and callers judge provider freshness against that read time, never against now.
 */
export const YAHOO_SETTINGS_TTL_MS = 6 * 60 * 60_000;
export const YAHOO_LEAGUE_FACTS_TTL_MS = 30 * 60_000;
export const YAHOO_DISCOVERY_TTL_MS = 15 * 60_000;
/** Matches the confirmation read's existing two-minute freshness ceiling. */
export const YAHOO_ROSTER_FRESH_MS = 120_000;
const LIMIT = 500;

type Entry<T> = { value: T; readAt: number };
const stores = new Set<Map<string, Entry<unknown>>>();

export function yahooReadCache<T>() {
  const store = new Map<string, Entry<T>>();
  stores.add(store as Map<string, Entry<unknown>>);
  return {
    get(key: string, maxAgeMs: number, now = Date.now()): Entry<T> | null {
      const entry = store.get(key);
      if (!entry || now < entry.readAt || now - entry.readAt >= maxAgeMs) return null;
      return entry;
    },
    set(key: string, value: T, readAt = Date.now()) {
      store.delete(key);
      if (store.size >= LIMIT) store.delete(store.keys().next().value!);
      store.set(key, { value, readAt });
    },
    delete(key: string) { store.delete(key); },
  };
}

/** Forget every cached Yahoo read for one principal (all accounts, leagues and teams). */
export function forgetYahooReadsFor(userId: string) {
  for (const store of stores) for (const key of [...store.keys()]) if (key.startsWith(`${userId}|`)) store.delete(key);
}

/**
 * The connected Yahoo account generation every cache key carries: account row, Yahoo user and last sync. A reconnect
 * (callback → discovery) or resync rewrites `last_synced_at`, and a reconnect to another Yahoo user changes the GUID
 * on the same row, so either one re-keys the caches. Null when the account is missing, disconnected, re-auth or
 * mid-sync, or the lookup fails: then nothing may be served from or written to a cache.
 */
export async function yahooCacheAccount(db: SupabaseClient<any>, userId: string, connectedAccountId: string): Promise<string | null> {
  try {
    const { data, error } = await db.from("connected_accounts").select("id,user_id,provider,status,provider_user_id,last_synced_at")
      .eq("id", connectedAccountId).eq("user_id", userId).eq("provider", "yahoo").maybeSingle();
    if (error || !data || data.id !== connectedAccountId || data.user_id !== userId || data.status !== "connected") return null;
    return `${data.id}:${data.provider_user_id ?? ""}:${data.last_synced_at ?? ""}`;
  } catch { return null; }
}

/** Yahoo access failures that must never be answered from cache. */
export const yahooAccessFailure = (code: string | undefined) => code === "yahoo_reauth_required" || code === "yahoo_access_denied";

/** Test seam: forget every cached Yahoo read. */
export function clearYahooReadCaches() { for (const store of stores) store.clear(); }

export const cacheKey = (...parts: string[]) => parts.join("|");

/** When a roster read stops being current: its server Date plus two minutes, less any provider cache age. */
export function yahooRosterExpiresAt(result: YahooProviderJsonResult): number | null {
  const observed = Date.parse(result.transport.responseDate ?? ""), age = result.transport.ageSeconds;
  if (!Number.isFinite(observed) || (age !== null && (!Number.isFinite(age) || age < 0 || age > 60))) return null;
  return observed + YAHOO_ROSTER_FRESH_MS - (age ?? 0) * 1000;
}

/** Parsed-league settings reads, per (principal, league), for up to six hours (TJ D3). */
export const yahooSettingsCache = yahooReadCache<YahooProviderJsonResult>();

/** Today's owned roster read, shared by the snapshot and the goalie confirmation read while it is still current. */
export const todayRosterCache = yahooReadCache<YahooProviderJsonResult>();
export function currentTodayRoster(key: string, now = Date.now()) {
  const entry = todayRosterCache.get(key, YAHOO_ROSTER_FRESH_MS, now);
  if (!entry) return null;
  const expires = yahooRosterExpiresAt(entry.value);
  return expires !== null && expires > now ? entry.value : null;
}

/** Order-independent signature of who owns whom, from a league_rosters read. */
export function yahooOwnershipSignature(teams: Array<{ teamKey: string; playerKeys: string[] }>) {
  return teams.map(team => `${team.teamKey}:${[...team.playerKeys].sort().join(",")}`).sort().join(";");
}
