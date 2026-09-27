import serviceRoleClient from "lib/supabase/server";
import type { Json } from "lib/supabase/database-generated.types";
import { refreshPatreonAccount } from "lib/integrations/patreon/sync";
import { isDraftProOwner } from "lib/draft-pro/ownerAccess";
import { IN_SEASON_CAPABILITIES, resolveInSeasonAccess, type InSeasonAccess, type InSeasonCapability, type InSeasonGrant } from "./access";

const metadataString = (metadata: Json, key: string) => metadata && typeof metadata === "object" && !Array.isArray(metadata) && typeof metadata[key] === "string" ? metadata[key] as string : null;
const metadataBoolean = (metadata: Json, key: string) => metadata && typeof metadata === "object" && !Array.isArray(metadata) && metadata[key] === true;

export async function loadInSeasonAccess(userId: string, options: { now?: Date; client?: typeof serviceRoleClient } = {}): Promise<InSeasonAccess> {
  const now = options.now ?? new Date();
  const client = options.client ?? serviceRoleClient;
  // Reuse Draft Pro's verified owner allowlist, independent of paid or seasonal grants.
  // Only the server's Auth record can authorize testing access; never client metadata.
  const { data: ownerData, error: ownerError } = await client.auth.admin.getUserById(userId);
  if (!ownerError && ownerData.user?.id === userId && isDraftProOwner(ownerData.user)) {
    return { eligible: true, capabilities: [...IN_SEASON_CAPABILITIES], grantingSources: ["owner_testing"], expiresAt: null, reason: "eligible" };
  }
  // The generated DB type is updated only after the local migration is applied.
  const grantsClient = client as any;
  const [grantResult, patreonResult] = await Promise.all([
    grantsClient.from("in_season_grants").select("source,source_reference,status,effective_from,effective_to").eq("user_id", userId),
    client.from("user_entitlements").select("source_provider,entitlement_key,entitlement_status,source_account_id,source_reference,effective_from,effective_to,metadata").eq("user_id", userId).eq("source_provider", "patreon").eq("entitlement_key", "patreon_supporter"),
  ]);
  if (grantResult.error) throw grantResult.error;
  if (patreonResult.error) throw patreonResult.error;
  let patreonRows = patreonResult.data ?? [];
  const stale = patreonRows.some((row) => {
    if (row.entitlement_status !== "active") return false;
    const verified = Date.parse(metadataString(row.metadata, "verified_at") ?? "");
    return !Number.isFinite(verified) || verified > now.getTime() || verified < now.getTime() - 60 * 60 * 1000;
  });
  if (stale) {
    try {
      await refreshPatreonAccount({ userId, client, triggerSource: "access_reverify" });
      const refreshed = await client.from("user_entitlements").select("source_provider,entitlement_key,entitlement_status,source_account_id,source_reference,effective_from,effective_to,metadata").eq("user_id", userId).eq("source_provider", "patreon").eq("entitlement_key", "patreon_supporter");
      if (refreshed.error) throw refreshed.error;
      patreonRows = refreshed.data ?? [];
    } catch {
      patreonRows = [];
    }
  }
  const grants: InSeasonGrant[] = (grantResult.data ?? []).map((row: any) => ({ source: row.source, reference: row.source_reference, status: row.status, effectiveFrom: row.effective_from, effectiveTo: row.effective_to }));
  for (const row of patreonRows) {
    if (!row.source_account_id || !row.source_reference || metadataString(row.metadata, "connected_account_id") !== row.source_account_id || !metadataBoolean(row.metadata, "draft_pro_eligible")) continue;
    grants.push({ source: "patreon", reference: row.source_reference, status: row.entitlement_status, effectiveFrom: row.effective_from, effectiveTo: row.effective_to, verifiedAt: metadataString(row.metadata, "verified_at") });
  }
  return resolveInSeasonAccess(grants, now);
}

export function requireInSeasonCapability(access: Awaited<ReturnType<typeof loadInSeasonAccess>>, capability: InSeasonCapability) {
  if (access.capabilities.includes(capability)) return;
  const error = new Error("In-season access is required for this action.");
  Object.assign(error, { statusCode: 403, code: access.reason });
  throw error;
}
