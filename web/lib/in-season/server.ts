import serviceRoleClient from "lib/supabase/server";
import type { Json } from "lib/supabase/database-generated.types";
import { refreshPatreonAccount } from "lib/integrations/patreon/sync";
import { isDraftProOwner } from "lib/draft-pro/ownerAccess";
import { IN_SEASON_CAPABILITIES, resolveInSeasonAccess, type InSeasonAccess, type InSeasonCapability, type InSeasonGrant } from "./access";

const metadataString = (metadata: Json, key: string) => metadata && typeof metadata === "object" && !Array.isArray(metadata) && typeof metadata[key] === "string" ? metadata[key] as string : null;
const metadataBoolean = (metadata: Json, key: string) => metadata && typeof metadata === "object" && !Array.isArray(metadata) && metadata[key] === true;

async function readAccessRows<T>(readPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await readPage(from, from + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

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
  const readGrants = () => readAccessRows<any>((from, to) => grantsClient.from("in_season_grants").select("source,source_reference,status,effective_from,effective_to").eq("user_id", userId).order("id").range(from, to));
  const readPatreon = () => readAccessRows((from, to) => client.from("user_entitlements").select("source_provider,entitlement_key,entitlement_status,source_account_id,source_reference,effective_from,effective_to,metadata").eq("user_id", userId).eq("source_provider", "patreon").eq("entitlement_key", "patreon_supporter").order("id").range(from, to));
  const [grantResult, patreonResult] = await Promise.allSettled([readGrants(), readPatreon()]);
  let patreonRows = patreonResult.status === "fulfilled" ? patreonResult.value : [];
  const stale = patreonRows.some((row) => {
    if (row.entitlement_status !== "active") return false;
    const verified = Date.parse(metadataString(row.metadata, "verified_at") ?? "");
    return !Number.isFinite(verified) || verified > now.getTime() || verified < now.getTime() - 60 * 60 * 1000;
  });
  let patreonVerificationFailed = false;
  if (stale) {
    try {
      await refreshPatreonAccount({ userId, client, triggerSource: "access_reverify" });
      patreonRows = await readPatreon();
    } catch {
      patreonVerificationFailed = true;
      patreonRows = [];
    }
  }
  const grants: InSeasonGrant[] = (grantResult.status === "fulfilled" ? grantResult.value : []).map((row: any) => ({ source: row.source, reference: row.source_reference, status: row.status, effectiveFrom: row.effective_from, effectiveTo: row.effective_to }));
  for (const row of patreonRows) {
    if (!row.source_account_id || !row.source_reference || metadataString(row.metadata, "connected_account_id") !== row.source_account_id || !metadataBoolean(row.metadata, "draft_pro_eligible")) continue;
    grants.push({ source: "patreon", reference: row.source_reference, status: row.entitlement_status, effectiveFrom: row.effective_from, effectiveTo: row.effective_to, verifiedAt: metadataString(row.metadata, "verified_at") });
  }
  const access = resolveInSeasonAccess(grants, now);
  // An unavailable source contributes no authority, but cannot revoke another verified grant.
  if (!access.eligible) {
    if (grantResult.status === "rejected") throw grantResult.reason;
    if (patreonResult.status === "rejected") throw patreonResult.reason;
    if (patreonVerificationFailed) return { ...access, reason: "verification_unavailable" };
  }
  return access;
}

export function requireInSeasonCapability(access: Awaited<ReturnType<typeof loadInSeasonAccess>>, capability: InSeasonCapability) {
  if (access.capabilities.includes(capability)) return;
  const error = new Error("In-season access is required for this action.");
  Object.assign(error, { statusCode: 403, code: access.reason });
  throw error;
}
