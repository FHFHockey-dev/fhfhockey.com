import { getStripeClient } from "lib/integrations/stripe/config";
import { verifyDraftProCheckoutSession, verifyStripeCheckoutSession } from "lib/integrations/stripe/fulfillment";
import serviceRoleClient from "lib/supabase/server";

export type ReconcileOptions = { apply: boolean; limit: number };
export function parseReconcileOptions(args: string[], env: Readonly<Record<string, string | undefined>> = process.env): ReconcileOptions {
  if (args.filter((a) => a === "--apply").length > 1 || args.filter((a) => a.startsWith("--limit=")).length > 1) throw new Error("Repeated argument");
  if (args.some((a) => a !== "--apply" && !a.startsWith("--limit="))) throw new Error("Unknown argument");
  const limit = Number(args.find((a) => a.startsWith("--limit="))?.slice(8) ?? 25);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("--limit must be an integer between 1 and 100");
  const apply = args.includes("--apply"), key = env.STRIPE_SECRET_KEY ?? "";
  if (apply && !/^([sr]k_test_)/.test(key) && env.DRAFT_PRO_STRIPE_LIVE_APPLY_ENABLED !== "true") throw new Error("Apply requires a test key or explicit operator enablement.");
  return { apply, limit };
}
export async function runStripeReconciliation(options: ReconcileOptions, deps = { stripe: getStripeClient(), client: serviceRoleClient }) {
  const { data, error } = await deps.client.from("draft_pro_purchases").select("id,user_id,provider_checkout_session_id,status").eq("provider", "stripe").eq("status", "pending").not("provider_checkout_session_id", "is", null).limit(options.limit);
  if (error) throw error;
  let checked = 0, eligible = 0;
  for (const row of data ?? []) { if (!row.provider_checkout_session_id) continue; const session = await deps.stripe.checkout.sessions.retrieve(row.provider_checkout_session_id); if (session.metadata?.draft_pro_purchase_id !== row.id || session.metadata?.draft_pro_user_id !== row.user_id) continue; if (await verifyDraftProCheckoutSession(deps.stripe, session)) { eligible++; if (options.apply) await verifyStripeCheckoutSession(deps.stripe, session); } checked++; }
  return { dryRun: !options.apply, checked, eligible };
}
if (require.main === module) runStripeReconciliation(parseReconcileOptions(process.argv.slice(2))).then((r) => console.log(JSON.stringify(r))).catch(() => { console.error("Reconciliation failed."); process.exitCode = 1; });
