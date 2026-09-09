import crypto from "node:crypto";
import { getServiceRoleClient } from "../../lib/supabase/server";

const [command, targetUserId, reason, expiresAt, codeId, ...rest] = process.argv.slice(2);
const apply = rest.includes("--apply");
const adminUserId = process.env.DRAFT_PRO_ACCESS_CODE_ADMIN_USER_ID?.trim();
const usage = "Usage: access-codes.ts issue <target-user-id> <reason> <expires-at> [--apply] | revoke <code-id> [--apply]";

async function main() {
  if (!adminUserId || !apply) throw new Error(`${usage}\nDry run only: pass --apply with DRAFT_PRO_ACCESS_CODE_ADMIN_USER_ID.`);
  if (command === "issue" && targetUserId && reason && expiresAt) {
    const code = crypto.randomBytes(32).toString("base64url");
    const hash = crypto.createHash("sha256").update(code).digest("hex");
    const { error } = await getServiceRoleClient().rpc("issue_draft_pro_access_code", { p_issued_by_user_id: adminUserId, p_target_user_id: targetUserId, p_code_hash: hash, p_reason: reason, p_expires_at: expiresAt });
    if (error) throw error;
    process.stdout.write(`${code}\n`);
    return;
  }
  if (command === "revoke" && codeId) {
    const { data, error } = await getServiceRoleClient().rpc("revoke_draft_pro_access_code", { p_issued_by_user_id: adminUserId, p_code_id: codeId });
    if (error || !data) throw error ?? new Error("Code could not be revoked.");
    return;
  }
  throw new Error(usage);
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Access-code operation failed."); process.exitCode = 1; });
