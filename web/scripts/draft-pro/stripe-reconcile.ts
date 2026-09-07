import { getStripeClient } from "lib/integrations/stripe/config";
import { verifyDraftProCheckoutSession, verifyStripeCheckoutSession } from "lib/integrations/stripe/fulfillment";
import serviceRoleClient from "lib/supabase/server";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const allowed = new Set(["--apply"]);
const limitArg = Number(args.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ?? 25);
const limit = Number.isInteger(limitArg) && limitArg > 0 && limitArg <= 100 ? limitArg : null;
if (!limit) throw new Error("--limit must be an integer between 1 and 100");
if (args.some((arg) => !arg.startsWith("--limit=") && !allowed.has(arg))) throw new Error("Unknown argument");
if (apply && process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") && process.env.DRAFT_PRO_STRIPE_LIVE_APPLY_ENABLED !== "true") throw new Error("Live apply requires explicit operator enablement.");

async function main() {
  const stripe = getStripeClient();
  const { data, error } = await serviceRoleClient.from("draft_pro_purchases").select("id,provider_checkout_session_id,status").eq("provider", "stripe").eq("status", "pending").not("provider_checkout_session_id", "is", null).limit(limit);
  if (error) throw error;
  let checked = 0;
  let eligible = 0;
  for (const row of data ?? []) {
    if (!row.provider_checkout_session_id) continue;
    const session = await stripe.checkout.sessions.retrieve(row.provider_checkout_session_id);
    if (session.metadata?.draft_pro_purchase_id !== row.id) continue;
    if (await verifyDraftProCheckoutSession(stripe, session)) {
      eligible += 1;
      if (apply) await verifyStripeCheckoutSession(stripe, session);
    }
    checked += 1;
  }
  console.log(JSON.stringify({ dryRun: !apply, checked, eligible }));
}

main().catch(() => { console.error("Reconciliation failed."); process.exitCode = 1; });
