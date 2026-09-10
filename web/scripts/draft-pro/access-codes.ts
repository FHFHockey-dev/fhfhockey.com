import crypto from "node:crypto";
import { getServiceRoleClient } from "../../lib/supabase/server";

export type AccessCodeCommand =
  | { action: "issue"; targetUserId: string; reason: string; expiresAt: string; apply: boolean }
  | { action: "revoke"; codeId: string; reason: string; apply: boolean };

export const usage = "Usage: access-codes.ts issue <target-user-id> <reason> <expires-at> [--apply] | revoke <code-id> <reason> [--apply]";

export function parseAccessCodeCommand(argv: string[]): AccessCodeCommand {
  const applyCount = argv.filter((value) => value === "--apply").length;
  const positional = argv.filter((value) => value !== "--apply");
  if (applyCount > 1 || argv.some((value) => value.startsWith("--") && value !== "--apply")) throw new Error(usage);
  if (positional[0] === "issue" && positional.length === 4) return { action: "issue", targetUserId: positional[1]!, reason: positional[2]!, expiresAt: positional[3]!, apply: applyCount === 1 };
  if (positional[0] === "revoke" && positional.length === 3) return { action: "revoke", codeId: positional[1]!, reason: positional[2]!, apply: applyCount === 1 };
  throw new Error(usage);
}

export async function runAccessCodeCommand(command: AccessCodeCommand, adminUserId = process.env.DRAFT_PRO_ACCESS_CODE_ADMIN_USER_ID?.trim()) {
  if (!command.apply) return { dryRun: true, ...command };
  if (!adminUserId) throw new Error("DRAFT_PRO_ACCESS_CODE_ADMIN_USER_ID is required with --apply.");
  if (command.action === "issue") {
    const code = crypto.randomBytes(32).toString("base64url");
    const hash = crypto.createHash("sha256").update(code).digest("hex");
    const { data, error } = await getServiceRoleClient().rpc("issue_draft_pro_access_code", { p_issued_by_user_id: adminUserId, p_target_user_id: command.targetUserId, p_code_hash: hash, p_reason: command.reason, p_expires_at: command.expiresAt });
    if (error) throw error;
    return { dryRun: false, action: "issue" as const, codeId: data, code };
  }
  const { data, error } = await getServiceRoleClient().rpc("revoke_draft_pro_access_code", { p_issued_by_user_id: adminUserId, p_code_id: command.codeId, p_reason: command.reason });
  if (error || !data) throw error ?? new Error("Code could not be revoked.");
  return { dryRun: false, action: "revoke" as const, codeId: command.codeId };
}

async function main() { process.stdout.write(`${JSON.stringify(await runAccessCodeCommand(parseAccessCodeCommand(process.argv.slice(2))))}\n`); }
if (require.main === module) main().catch((error) => { console.error(error instanceof Error ? error.message : "Access-code operation failed."); process.exitCode = 1; });
