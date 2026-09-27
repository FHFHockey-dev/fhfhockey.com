export const IN_SEASON_CAPABILITIES = ["rso_sync", "rso_account_save", "rso_auto_upkeep"] as const;
export type InSeasonCapability = typeof IN_SEASON_CAPABILITIES[number];
export type InSeasonGrantSource = "purchase" | "grandfather" | "common_preview" | "patreon";
export type InSeasonGrant = {
  source: InSeasonGrantSource;
  reference: string;
  status: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  verifiedAt?: string | null;
};
export type InSeasonAccess = {
  eligible: boolean;
  capabilities: InSeasonCapability[];
  grantingSources: InSeasonGrantSource[];
  expiresAt: string | null;
  reason: "eligible" | "no_active_grant" | "expired" | "verification_unavailable";
};

const timestamp = (value: string | null | undefined) => {
  const parts = value?.match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/);
  if (!parts) return null;
  const [year, month, day, hour, minute, second] = parts.slice(1).map(Number);
  if (new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !== `${parts[1]}-${parts[2]}-${parts[3]}` || hour > 23 || minute > 59 || second > 59) return null;
  const parsed = Date.parse(value!);
  return Number.isFinite(parsed) ? parsed : null;
};

export function resolveInSeasonAccess(grants: InSeasonGrant[], now: Date): InSeasonAccess {
  const current = now.getTime();
  const valid = grants.filter((grant) => {
    const from = timestamp(grant.effectiveFrom);
    const to = grant.effectiveTo === null ? null : timestamp(grant.effectiveTo);
    if (grant.status !== "active" || !grant.reference.trim() || from === null || from > current || (grant.source !== "patreon" && to === null) || (grant.effectiveTo !== null && (to === null || to <= current))) return false;
    if (grant.source === "patreon") {
      const verified = timestamp(grant.verifiedAt);
      return verified !== null && verified <= current && verified >= current - 60 * 60 * 1000;
    }
    return true;
  });
  const expiries = valid.map((grant) => grant.effectiveTo === null ? null : timestamp(grant.effectiveTo));
  const stalePatreon = grants.some((grant) => grant.source === "patreon" && grant.status === "active" && timestamp(grant.effectiveFrom) !== null && timestamp(grant.effectiveFrom)! <= current && (!timestamp(grant.verifiedAt) || timestamp(grant.verifiedAt)! < current - 60 * 60 * 1000));
  return {
    eligible: valid.length > 0,
    capabilities: valid.length ? [...IN_SEASON_CAPABILITIES] : [],
    grantingSources: [...new Set(valid.map((grant) => grant.source))],
    expiresAt: valid.length && expiries.every((expiry) => expiry !== null) ? new Date(Math.max(...expiries as number[])).toISOString() : null,
    reason: valid.length ? "eligible" : stalePatreon ? "verification_unavailable" : grants.some((grant) => grant.status !== "active" || (timestamp(grant.effectiveTo) ?? Infinity) <= current) ? "expired" : "no_active_grant",
  };
}
