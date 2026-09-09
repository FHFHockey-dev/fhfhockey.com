import crypto from "node:crypto";
import { getServiceRoleClient } from "../../lib/supabase/server";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const positional = args.filter((arg) => arg !== "--apply");
const [command, first, second, third] = positional;
const adminUserId = process.env.DRAFT_PRO_ACCESS_CODE_ADMIN_USER_ID?.trim();
const usage = "Usage: access-codes.ts issue <target-user-id> <reason> <expires-at> [--apply] | revoke <code-id> [--apply]";

async function main() {
  if (command === "issue" && first && second && third) {
    if (!apply) { process.stdout.write(JSON.stringify({ dryRun: true, action: "issue", targetUserId: first, reason: second, expiresAt: third }) + "\n"); return; }
    if (!adminUserId) throw new Error("DRAFT_PRO_ACCESS_CODE_ADMIN_USER_ID is required with --apply.");
    const code = crypto.randomBytes(32).toString("base64url");
    const hash = crypto.createHash("sha256").update(code).digest("hex");
    const { data, error } = await getServiceRoleClient().rpc("issue_draft_pro_access_code", { p_issued_by_user_id: adminUserId, p_target_user_id: first, p_code_hash: hash, p_reason: second, p_expires_at: third });
    if (error) throw error;
    process.stdout.write(JSON.stringify({ codeId: data, code }) + "\n");
    return;
  }
  if (command === "revoke" && first && second) {
    if (!apply) { process.stdout.write(JSON.stringify({ dryRun: true, action: "revoke", codeId: first, reason: second }) + "\n"); return; }
    if (!adminUserId) throw new Error("DRAFT_PRO_ACCESS_CODE_ADMIN_USER_ID is required with --apply.");
    const { data, error } = await getServiceRoleClient().rpc("revoke_draft_pro_access_code", { p_issued_by_user_id: adminUserId, p_code_id: first });
    if (error || !data) throw error ?? new Error("Code could not be revoked.");
    return;
  }
  throw new Error(usage);
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Access-code operation failed."); process.exitCode = 1; });
