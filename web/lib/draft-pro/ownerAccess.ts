import type { User } from "@supabase/supabase-js";
import type serviceRoleClient from "lib/supabase/server";
import { DRAFT_PRO_EXPIRATION, DRAFT_PRO_ENTITLEMENT_KEY } from "./contracts";

const OWNER_EMAILS = new Set(["timbranson515@gmail.com", "fiveholefantasyhockey@gmail.com"]);
// GitHub's immutable provider ID for TjsUsername, not an editable profile name.
const OWNER_GITHUB_ID = "52942235";

export function isDraftProOwner(user: Pick<User, "email" | "email_confirmed_at" | "identities">) {
  return Boolean(user.email_confirmed_at && OWNER_EMAILS.has(user.email?.trim().toLowerCase() ?? "")) ||
    Boolean(user.identities?.some(identity => identity.provider === "github" && identity.id === OWNER_GITHUB_ID));
}

/** Persist the same complimentary grant used by RLS; never authorize from client metadata. */
export async function ensureDraftProOwnerAccess(userId: string, now: Date, client: Pick<typeof serviceRoleClient, "auth" | "from">) {
  const { data, error } = await client.auth.admin.getUserById(userId);
  if (error || !data.user || !isDraftProOwner(data.user) || now.getTime() >= Date.parse(DRAFT_PRO_EXPIRATION)) return false;
  const reference = `draft_pro_owner:${userId}:${DRAFT_PRO_EXPIRATION}`;
  const { data: existing, error: readError } = await client.from("user_entitlements")
    .select("id,entitlement_status,effective_to,metadata").eq("user_id", userId)
    .eq("source_provider", "complimentary").eq("source_reference", reference).maybeSingle();
  if (readError) throw readError;
  if (existing?.entitlement_status === "active" && existing.effective_to && Date.parse(existing.effective_to) === Date.parse(DRAFT_PRO_EXPIRATION)) return true;
  const grant = { user_id: userId, source_provider: "complimentary", entitlement_key: DRAFT_PRO_ENTITLEMENT_KEY,
    source_reference: reference, entitlement_status: "active", effective_to: DRAFT_PRO_EXPIRATION,
    metadata: { ...(existing?.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata) ? existing.metadata : {}), reason: "Verified owner account" } };
  const result = existing
    ? await client.from("user_entitlements").update(grant).eq("id", existing.id).eq("user_id", userId)
    : await client.from("user_entitlements").insert({ ...grant, effective_from: now.toISOString() });
  // Concurrent initial requests can insert the same unique provider/reference.
  // The caller re-reads grants before resolving any access.
  if (result.error && result.error.code !== "23505") throw result.error;
  return true;
}
