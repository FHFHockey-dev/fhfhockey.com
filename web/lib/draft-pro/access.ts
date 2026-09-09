import type { DraftProAccess, DraftProCapability, DraftProEligibilityReason } from "./contracts";

export type DraftProEntitlement = {
  source: "purchase" | "patreon" | "complimentary";
  status: "active" | "inactive" | "refunded" | "disputed";
  effectiveFrom: string | null;
  effectiveTo: string | null;
  verifiedAt?: string | null;
};

export type DraftProAccessInput = {
  now: Date;
  userId: string | null;
  entitlements: DraftProEntitlement[];
  patreonVerificationAvailable: boolean;
  flags: Record<"checkout" | DraftProCapability, boolean>;
  providerReadiness?: Partial<Record<"stripe" | "patreon" | "yahoo", boolean>>;
};

const allCapabilities: DraftProCapability[] = ["recommendations", "dust", "blended_csv", "saved_drafts", "private_imports", "scenarios", "reports"];
const dateValue = (value: string) => {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

const isCurrentGrant = (grant: DraftProEntitlement, now: number, requireEnd = false) => {
  if (grant.status !== "active" || !grant.effectiveFrom) return false;
  const from = dateValue(grant.effectiveFrom);
  if (from === null || from > now) return false;
  if (grant.effectiveTo === null) return !requireEnd;
  const to = dateValue(grant.effectiveTo);
  return to !== null && to > now;
};

const grantExpiry = (grant: DraftProEntitlement) => grant.effectiveTo === null ? null : dateValue(grant.effectiveTo);
const hasEndedOrBeenRevoked = (grant: DraftProEntitlement, now: number) => {
  if (grant.status !== "active") return true;
  if (grant.effectiveTo === null) return grant.source === "purchase";
  const expiry = dateValue(grant.effectiveTo);
  return expiry === null || expiry <= now;
};

export function resolveDraftProAccess(input: DraftProAccessInput): DraftProAccess {
  const readiness = { stripe: false, patreon: false, yahoo: false, ...input.providerReadiness };
  if (!input.userId) return { eligible: false, grantingSources: [], expiresAt: null, verifiedAt: null, nextVerificationAt: null, reason: "authentication_required", capabilities: [], providerReadiness: readiness };
  const now = input.now.getTime();
  const seasonEnd = Date.parse("2027-07-01T04:00:00Z");
  const purchase = input.entitlements.find((grant) => {
    const expiry = grantExpiry(grant);
    return grant.source === "purchase" && isCurrentGrant(grant, now, true) && expiry !== null && expiry <= seasonEnd && now < seasonEnd;
  });
  const activePatreon = input.entitlements.find((grant) => grant.source === "patreon" && isCurrentGrant(grant, now));
  const complimentary = input.entitlements.find((grant) => grant.source === "complimentary" && isCurrentGrant(grant, now, true));
  const verifiedAt = activePatreon?.verifiedAt ? dateValue(activePatreon.verifiedAt) : null;
  const stalePatreon = activePatreon && (!input.patreonVerificationAvailable || verifiedAt === null || verifiedAt > now || verifiedAt < now - 60 * 60 * 1000);
  const grants = [purchase, stalePatreon ? undefined : activePatreon, complimentary].filter(Boolean) as DraftProEntitlement[];
  const hasExpiredOrRevokedGrant = input.entitlements.some((grant) => hasEndedOrBeenRevoked(grant, now));
  const reason: DraftProEligibilityReason = grants.length ? "eligible" : stalePatreon ? "verification_unavailable" : hasExpiredOrRevokedGrant ? "expired" : "no_active_grant";
  const activeExpiries = grants.map(grantExpiry);
  const expiresAt = activeExpiries.length === 0 || activeExpiries.some((value) => value === null)
    ? null
    : new Date(Math.max(...(activeExpiries as number[]))).toISOString();
  const capabilities = grants.length ? allCapabilities.filter((capability) => input.flags[capability]) : [];
  const accessReason: DraftProEligibilityReason = grants.length && capabilities.length === 0 ? "feature_disabled" : reason;
  return { eligible: grants.length > 0, grantingSources: grants.map((grant) => grant.source), expiresAt, verifiedAt: verifiedAt === null ? null : new Date(verifiedAt).toISOString(), nextVerificationAt: verifiedAt === null ? null : new Date(verifiedAt + 60 * 60 * 1000).toISOString(), reason: accessReason, capabilities, providerReadiness: readiness };
}

export function requireDraftProCapability(access: DraftProAccess, capability: DraftProCapability) {
  if (!access.eligible || !access.capabilities.includes(capability)) {
    return { status: 403 as const, reason: access.eligible ? "feature_disabled" : access.reason, message: "Draft Pro access is required for this action." };
  }
  return null;
}
