export type ProviderSyncAccess = {
  eligible: boolean;
  expiresAt: string | null;
  nextVerificationAt: string | null;
  reason: "eligible" | "rollout_free" | "authentication_required" | "no_active_grant" | "expired" | "verification_unavailable";
};

export const PROVIDER_SYNC_ACCESS_HREF = "/account?section=in-season";
export const PROVIDER_SYNC_UPSELL = "Yahoo and Fantrax sync require premium access: $4.99 monthly or a $24.99 season pass ending July 1, 2027.";

export function providerSyncAccessMessage(status: string, access: ProviderSyncAccess | null) {
  if (status === "error" || access?.reason === "verification_unavailable") return "Premium access could not be verified. Please try again; your saved work is preserved.";
  if (status === "idle" || access?.reason === "authentication_required") return "Sign in to check your Yahoo and Fantrax sync access.";
  if (status === "loading") return "Checking premium sync access…";
  return PROVIDER_SYNC_UPSELL;
}
