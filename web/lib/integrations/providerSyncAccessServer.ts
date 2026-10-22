import { getDraftProFeatureFlags } from "lib/draft-pro/features";
import { loadDraftProAccess } from "lib/draft-pro/server";
import type { InSeasonAccess } from "lib/in-season/access";
import { loadInSeasonAccess } from "lib/in-season/server";
import { PROVIDER_SYNC_UPSELL, type ProviderSyncAccess } from "./providerSyncAccess";

export class ProviderSyncAccessError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string) {
    super(message);
    this.name = "ProviderSyncAccessError";
  }
}

/** Both existing grant systems remain authoritative; this never creates a grant. */
export async function loadProviderSyncAccess(userId: string | null, options: { inSeason?: InSeasonAccess } = {}): Promise<ProviderSyncAccess> {
  const denied = (reason: ProviderSyncAccess["reason"]): ProviderSyncAccess => ({ eligible: false, expiresAt: null, nextVerificationAt: null, reason });
  if (!userId) return denied("authentication_required");
  let unavailable = false;
  let expired = false;
  try {
    const access = options.inSeason ?? await loadInSeasonAccess(userId);
    if (access.eligible === true && access.capabilities.includes("rso_sync")) {
      return { eligible: true, expiresAt: access.expiresAt, reason: "eligible",
        nextVerificationAt: access.nextVerificationAt ?? null };
    }
    unavailable = access.reason === "verification_unavailable";
    expired = access.reason === "expired";
  } catch { unavailable = true; }
  try {
    const access = await loadDraftProAccess(userId, { now: new Date(), flags: getDraftProFeatureFlags(), patreonVerificationAvailable: true });
    if (access.eligible === true) return { eligible: true, expiresAt: access.expiresAt, nextVerificationAt: access.nextVerificationAt, reason: "eligible" };
    unavailable ||= access.reason === "verification_unavailable";
    expired ||= access.reason === "expired";
  } catch { unavailable = true; }
  return denied(unavailable ? "verification_unavailable" : expired ? "expired" : "no_active_grant");
}

export async function requireProviderSyncAccess(userId: string | null) {
  const access = await loadProviderSyncAccess(userId);
  if (access.eligible === true) return access;
  if (access.reason === "authentication_required") throw new ProviderSyncAccessError(401, access.reason, "Sign in to sync your provider account.");
  if (access.reason === "verification_unavailable") throw new ProviderSyncAccessError(503, access.reason, "Premium access could not be verified. Please try again; your saved work is preserved.");
  throw new ProviderSyncAccessError(403, access.reason, PROVIDER_SYNC_UPSELL);
}
