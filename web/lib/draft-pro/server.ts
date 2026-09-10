import serviceRoleClient from "lib/supabase/server";
import type { Json } from "lib/supabase/database-generated.types";
import { refreshPatreonAccount } from "lib/integrations/patreon/sync";

import { requireDraftProCapability, resolveDraftProAccess, type DraftProAccessInput, type DraftProEntitlement } from "./access";
import { DRAFT_PRO_ENTITLEMENT_KEY, type DraftProCapability } from "./contracts";

import { ensureDraftProOwnerAccess } from "./ownerAccess";

const PATREON_SUPPORTER_ENTITLEMENT_KEY = "patreon_supporter";

export type DraftProFeatureFlags = Record<"checkout" | DraftProCapability, boolean>;

type EntitlementsClient = Pick<typeof serviceRoleClient, "from"> & Partial<Pick<typeof serviceRoleClient, "auth">>;
const metadataString = (metadata: Json, key: string) =>
  metadata && typeof metadata === "object" && !Array.isArray(metadata) && typeof metadata[key] === "string"
    ? metadata[key] as string
    : null;
const metadataBoolean = (metadata: Json, key: string) =>
  metadata && typeof metadata === "object" && !Array.isArray(metadata) && metadata[key] === true;

function isDraftProPatreonGrant(row: {
  source_provider: string;
  entitlement_key: string;
  source_account_id: string | null;
  metadata: Json;
}) {
  return row.source_provider === "patreon" &&
    row.entitlement_key === PATREON_SUPPORTER_ENTITLEMENT_KEY &&
    typeof row.source_account_id === "string" &&
    metadataString(row.metadata, "connected_account_id") === row.source_account_id &&
    metadataBoolean(row.metadata, "draft_pro_eligible");
}

function isPatreonMembershipToReverify(row: {
  source_provider: string;
  entitlement_key: string;
  source_account_id: string | null;
}) {
  return row.source_provider === "patreon" &&
    row.entitlement_key === PATREON_SUPPORTER_ENTITLEMENT_KEY &&
    typeof row.source_account_id === "string";
}

export async function loadDraftProAccess(
  userId: string,
  options: Omit<DraftProAccessInput, "userId" | "entitlements"> & { client?: EntitlementsClient },
) {
  const client = options.client ?? serviceRoleClient;
  const owner = client.auth ? await ensureDraftProOwnerAccess(userId, options.now, { from: client.from.bind(client), auth: client.auth }) : false;
  const { data, error } = await client
    .from("user_entitlements")
    .select("source_provider,entitlement_key,source_account_id,entitlement_status,effective_from,effective_to,metadata")
    .eq("user_id", userId)
    .in("entitlement_key", [DRAFT_PRO_ENTITLEMENT_KEY, PATREON_SUPPORTER_ENTITLEMENT_KEY]);
  if (error) throw error;
  let rows = data ?? [];
  // Patreon claims are short-lived. Reverify a stale Patreon-only claim before
  // handing premium work to a caller; a provider failure is deliberately
  // fail-closed for that source while leaving a separate purchase untouched.
  const now = options.now;
  const stalePatreon = rows.some((row) => {
    if (!isPatreonMembershipToReverify(row)) return false;
    const verifiedAt = metadataString(row.metadata, "verified_at");
    const verifiedTime = verifiedAt ? new Date(verifiedAt).getTime() : NaN;
    return !Number.isFinite(verifiedTime) || verifiedTime > now.getTime() || verifiedTime < now.getTime() - 60 * 60 * 1000;
  });
  let patreonVerificationAvailable = options.patreonVerificationAvailable;
  if (stalePatreon) {
    try {
      await refreshPatreonAccount({ userId, client: client as typeof serviceRoleClient, triggerSource: "access_reverify" });
      const { data: refreshedRows, error: refreshedError } = await client
        .from("user_entitlements")
        .select("source_provider,entitlement_key,source_account_id,entitlement_status,effective_from,effective_to,metadata")
        .eq("user_id", userId)
        .in("entitlement_key", [DRAFT_PRO_ENTITLEMENT_KEY, PATREON_SUPPORTER_ENTITLEMENT_KEY]);
      if (refreshedError) throw refreshedError;
      rows = refreshedRows ?? [];
      patreonVerificationAvailable = true;
    } catch {
      patreonVerificationAvailable = false;
    }
  }
  const entitlements: DraftProEntitlement[] = rows.flatMap((row) => {
    const source = row.source_provider === "stripe" && row.entitlement_key === DRAFT_PRO_ENTITLEMENT_KEY
      ? "purchase"
      : row.source_provider === "complimentary" && row.entitlement_key === DRAFT_PRO_ENTITLEMENT_KEY
        ? "complimentary"
      : isDraftProPatreonGrant(row)
        ? "patreon"
        : null;
    if (!source) return [];
    return [{ source, status: row.entitlement_status === "active" ? "active" : "inactive", effectiveFrom: row.effective_from, effectiveTo: row.effective_to, verifiedAt: metadataString(row.metadata, "verified_at") }];
  });
  return resolveDraftProAccess({ ...options, flags: owner ? Object.fromEntries(Object.entries(options.flags).map(([key, value]) => [key, key === "checkout" ? value : true])) as DraftProFeatureFlags : options.flags, patreonVerificationAvailable, userId, entitlements });
}

export function requireDraftProServerCapability(access: Awaited<ReturnType<typeof loadDraftProAccess>>, capability: DraftProCapability) {
  const denial = requireDraftProCapability(access, capability);
  if (denial) {
    const error = new Error("Draft Pro access is required for this action.");
    Object.assign(error, { statusCode: denial.status, code: denial.reason });
    throw error;
  }
}
