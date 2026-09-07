import serviceRoleClient from "lib/supabase/server";
import type { Json } from "lib/supabase/database-generated.types";

import { requireDraftProCapability, resolveDraftProAccess, type DraftProAccessInput, type DraftProEntitlement } from "./access";
import { DRAFT_PRO_ENTITLEMENT_KEY, type DraftProCapability } from "./contracts";

export type DraftProFeatureFlags = Record<"checkout" | DraftProCapability, boolean>;

type EntitlementsClient = Pick<typeof serviceRoleClient, "from">;
const metadataString = (metadata: Json, key: string) =>
  metadata && typeof metadata === "object" && !Array.isArray(metadata) && typeof metadata[key] === "string"
    ? metadata[key] as string
    : null;

export async function loadDraftProAccess(
  userId: string,
  options: Omit<DraftProAccessInput, "userId" | "entitlements"> & { client?: EntitlementsClient },
) {
  const client = options.client ?? serviceRoleClient;
  const { data, error } = await client
    .from("user_entitlements")
    .select("source_provider,entitlement_status,effective_from,effective_to,metadata")
    .eq("user_id", userId)
    .eq("entitlement_key", DRAFT_PRO_ENTITLEMENT_KEY);
  if (error) throw error;
  const entitlements: DraftProEntitlement[] = (data ?? []).flatMap((row) => {
    const source = row.source_provider === "stripe" ? "purchase" : row.source_provider === "patreon" ? "patreon" : null;
    if (!source) return [];
    return [{ source, status: row.entitlement_status === "active" ? "active" : "inactive", effectiveFrom: row.effective_from, effectiveTo: row.effective_to, verifiedAt: metadataString(row.metadata, "verified_at") }];
  });
  return resolveDraftProAccess({ ...options, userId, entitlements });
}

export function requireDraftProServerCapability(access: Awaited<ReturnType<typeof loadDraftProAccess>>, capability: DraftProCapability) {
  const denial = requireDraftProCapability(access, capability);
  if (denial) {
    const error = new Error("Draft Pro access is required for this action.");
    Object.assign(error, { statusCode: denial.status, code: denial.reason });
    throw error;
  }
}
