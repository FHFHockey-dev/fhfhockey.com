/** One visible RSO tab per principal and league runs timed provider upkeep (TJ D2). Other tabs keep their data and
 * their manual refresh; they take over when the holder hides, closes, or lets the lease lapse. Storage failures
 * fail open, so a private window still refreshes. */
export const RSO_UPKEEP_LEASE_MS = 6 * 60_000;

export const rsoUpkeepLeaseKey = (userId: string, leagueId: string) => `fhfh:rso:upkeep:v1:${userId}:${leagueId}`;

type Lease = { tabId: string; until: number };
const read = (storage: Storage, key: string): Lease | null => {
  try {
    const value = JSON.parse(storage.getItem(key) ?? "null");
    return value && typeof value.tabId === "string" && Number.isFinite(value.until) ? value : null;
  } catch { return null; }
};

export function claimRsoUpkeepLease(storage: Storage | null | undefined, key: string, tabId: string, now = Date.now(), ttl = RSO_UPKEEP_LEASE_MS): boolean {
  if (!storage) return true;
  try {
    const held = read(storage, key);
    if (held && held.tabId !== tabId && held.until > now) return false;
    storage.setItem(key, JSON.stringify({ tabId, until: now + ttl }));
    // Another tab may have claimed between the read and the write; the last writer holds it.
    return read(storage, key)?.tabId === tabId;
  } catch { return true; }
}

export function releaseRsoUpkeepLease(storage: Storage | null | undefined, key: string, tabId: string) {
  if (!storage) return;
  try { if (read(storage, key)?.tabId === tabId) storage.removeItem(key); } catch { /* storage unavailable */ }
}
