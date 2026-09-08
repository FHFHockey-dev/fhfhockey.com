import assert from "node:assert/strict";

const nextUrl = process.env.NEXT_URL!;
const gateway = process.env.SUPABASE_GATEWAY!;
const userToken = process.env.USER_STRIPE!;
const serviceKey = process.env.SERVICE_KEY!;
const userId = process.env.STRIPE_SANDBOX_USER_ID!;

async function serviceRows(path: string) {
  const response = await fetch(`${gateway}/rest/v1/${path}`, {
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
  });
  assert.equal(response.status, 200, `Isolated PostgREST read failed for ${path}: ${response.status}`);
  return await response.json() as Array<Record<string, unknown>>;
}

async function main() {
  const purchases = await serviceRows(`draft_pro_purchases?select=id,provider_checkout_session_id,status,payment_state&user_id=eq.${userId}&provider=eq.stripe`);
  assert.equal(purchases.length, 1, "Expected one isolated Stripe purchase for the free sandbox user.");
  const purchase = purchases[0];
  const purchaseId = String(purchase.id ?? "");
  const checkoutSessionId = String(purchase.provider_checkout_session_id ?? "");
  assert.match(checkoutSessionId, /^cs_test_/, "The checkout route did not attach a Stripe test Checkout session.");
  assert.equal(purchase.status, "active", "The isolated Stripe purchase is not active after webhook/replay.");
  assert.equal(purchase.payment_state, "paid", "The isolated Stripe purchase is not paid after webhook/replay.");

  const events = await serviceRows(`draft_pro_provider_events?select=provider_event_id,purchase_id,processed_at&provider=eq.stripe&purchase_id=eq.${purchaseId}`);
  assert(events.some((event) => /^evt_/.test(String(event.provider_event_id)) && event.processed_at), "No processed Stripe CLI-forwarded event was recorded.");
  assert(events.some((event) => event.provider_event_id === `return:${checkoutSessionId}` && event.processed_at), "No processed Checkout return verification replay was recorded.");

  const entitlements = await serviceRows(`user_entitlements?select=entitlement_status,source_reference&user_id=eq.${userId}&source_provider=eq.stripe`);
  assert(entitlements.some((entitlement) => entitlement.entitlement_status === "active" && entitlement.source_reference === `draft_pro_purchase:${purchaseId}`), "The Stripe fulfillment grant was not active in the isolated database.");

  const account = await fetch(`${nextUrl}/api/v1/account/draft-pro`, { headers: { Authorization: `Bearer ${userToken}` } });
  assert.equal(account.status, 200, `The isolated account read failed: ${account.status}`);
  const body = await account.json() as { data?: { access?: { eligible?: boolean }; purchases?: Array<{ id?: string; status?: string }> } };
  assert.equal(body.data?.access?.eligible, true, "The account read did not expose the fulfilled Draft Pro grant.");
  assert(body.data?.purchases?.some((item) => item.id === purchaseId && item.status === "active"), "The account read did not expose the active Stripe purchase.");
  console.log("stripe_sandbox=passed; checkout=route-created; webhook=cli-forwarded; replay=verified; grant=account-readable");
}

main().catch((error) => { console.error(error); process.exit(1); });
