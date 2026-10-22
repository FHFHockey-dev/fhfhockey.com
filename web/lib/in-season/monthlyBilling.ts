import type Stripe from "stripe";
import { IN_SEASON_SANDBOX_CATALOG as catalog, verifyInSeasonSandboxAccount } from "./billingConfig";
import { IN_SEASON_COMMERCE, type VerifiedStripeMinimum } from "./commerce";
import { buildSettledMonthlyPlan, createMonthlyState, monthlyMetadata, type MonthlyBinding } from "./monthlyLifecycle";
import { monthlyScheduleParameters, verifyMonthlySchedule } from "./monthlySchedule";
import type { MonthlyStore } from "./monthlyStore";

/** Internal sandbox adapter only. The public monthly checkout remains disabled. */
export async function createMonthlyBilling(input: { stripe: Stripe; store: MonthlyStore; userId: string; minimum: VerifiedStripeMinimum; now?: Date }) {
  const { stripe, store, userId, minimum } = input; const now = input.now ?? new Date();
  if (now.getTime() + 31 * 60_000 >= Date.parse(IN_SEASON_COMMERCE.accessEndsAt)) throw new Error("Monthly signup has closed for the season.");
  // Quote/minimum validation happens before creating any provider object.
  buildSettledMonthlyPlan({ userId, attemptId: "validation", customerId: "validation", startsAt: now, verifiedMinimum: minimum });
  await verifyInSeasonSandboxAccount(stripe);
  const price = await stripe.prices.retrieve(catalog.monthlyPriceId);
  if (price.livemode !== false || !price.active || price.currency !== "usd" || price.unit_amount !== 499 || price.recurring?.interval !== "month" || price.recurring.interval_count !== 1 || price.product !== catalog.productId) throw new Error("Monthly catalog mismatch.");
  const attempt = await store.begin(userId, minimum);
  if (attempt.user_id !== userId) throw new Error("Monthly attempt ownership mismatch.");
  if ((Object.keys(minimum) as Array<keyof VerifiedStripeMinimum>).some((key) => minimum[key] !== attempt.minimum[key])) throw new Error("The payment minimum changed; this attempt requires review.");
  const startsAt = new Date(attempt.created_at);
  const checkedAt = input.now ?? new Date();
  if (!Number.isFinite(startsAt.getTime()) || startsAt.getTime() > checkedAt.getTime() + 5_000 || checkedAt.getTime() - startsAt.getTime() >= 23 * 3600_000) throw new Error("Old or uncertain monthly attempt requires review.");
  let customerId = attempt.customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({ metadata: { in_season_user_id: userId, in_season_attempt_id: attempt.id } }, { idempotencyKey: `in-season-monthly-customer:${attempt.id}` });
    if (customer.livemode !== false || customer.metadata.in_season_user_id !== userId || customer.metadata.in_season_attempt_id !== attempt.id) throw new Error("Monthly customer mismatch.");
    customerId = customer.id; await store.customer(attempt.id, customerId);
  } else {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted || customer.livemode !== false || customer.metadata.in_season_user_id !== userId || customer.metadata.in_season_attempt_id !== attempt.id) throw new Error("Stored monthly customer ownership mismatch.");
  }
  const identity = { userId, attemptId: attempt.id, customerId, verifiedMinimum: attempt.minimum };
  const plan = buildSettledMonthlyPlan({ ...identity, startsAt });
  if (now.getTime() >= Date.parse(plan.periods[0].to)) throw new Error("The original signup period ended; this attempt requires review.");
  const base = { ...identity, periods: plan.periods };
  const schedule = attempt.schedule_id ? await stripe.subscriptionSchedules.retrieve(attempt.schedule_id, { expand: ["subscription"] })
    : await stripe.subscriptionSchedules.create({ ...monthlyScheduleParameters(base), expand: ["subscription"] }, { idempotencyKey: `in-season-monthly-schedule:${attempt.id}` });
  const subscription = schedule.subscription;
  if (!subscription || typeof subscription === "string") throw new Error("Monthly subscription not expanded.");
  const binding: MonthlyBinding = { ...base, subscriptionId: subscription.id, scheduleId: schedule.id };
  verifyMonthlySchedule(binding, schedule);
  if (subscription.livemode !== false || subscription.customer !== customerId || Object.entries(monthlyMetadata(binding)).some(([key, value]) => subscription.metadata[key] !== value)) throw new Error("Monthly subscription mismatch.");
  // A durable binding exists before invoice finalization; failure here is retried
  // with identical provider idempotency keys, never with a second subscription.
  if (!attempt.state) await store.attach(attempt.id, createMonthlyState(binding));
  await stripe.subscriptions.update(subscription.id, { payment_settings: { payment_method_types: ["card"], save_default_payment_method: "on_subscription" } }, { idempotencyKey: `in-season-monthly-payment-settings:${attempt.id}` });
  const invoiceId = typeof subscription.latest_invoice === "string" ? subscription.latest_invoice : subscription.latest_invoice?.id;
  if (!invoiceId) throw new Error("Initial invoice unavailable.");
  let invoice = await stripe.invoices.retrieve(invoiceId);
  if (invoice.livemode !== false || invoice.customer !== customerId || invoice.parent?.subscription_details?.subscription !== subscription.id || invoice.total !== plan.periods[0].amountCents) throw new Error("Initial invoice mismatch.");
  if (invoice.status === "draft") invoice = await stripe.invoices.finalizeInvoice(invoiceId, { auto_advance: false }, { idempotencyKey: `in-season-monthly-finalize:${attempt.id}` });
  if (invoice.status === "paid") return { state: "confirming" as const, url: null };
  if (invoice.status !== "open" || !invoice.hosted_invoice_url?.startsWith("https://invoice.stripe.com/")) throw new Error("Initial payment link unavailable.");
  return { state: "checkout" as const, url: invoice.hosted_invoice_url };
}
