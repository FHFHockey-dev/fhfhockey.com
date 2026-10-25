import type Stripe from "stripe";
import { IN_SEASON_SANDBOX_CATALOG as catalog } from "./billingConfig";
import { buildSettledMonthlyPlan, monthlyMetadata, type MonthlyBinding } from "./monthlyLifecycle";

const seconds = (iso: string) => Date.parse(iso) / 1000;
const id = (value: string | { id: string } | null) => typeof value === "string" ? value : value?.id;

/** Fixed finite calendar phases. Execution remains blocked at the HTTP boundary.
 * A fall-back month ends its phase at the earlier UTC anniversary, then the next
 * phase defers its charge one hour to Eastern midnight. This prevents an extra
 * recurring invoice before the next phase. Stripe test-clock proof is required.
 */
export function monthlyScheduleParameters(binding: Omit<MonthlyBinding, "subscriptionId">): Stripe.SubscriptionScheduleCreateParams {
  const { periods } = buildSettledMonthlyPlan({ ...binding, startsAt: new Date(binding.periods[0].from) });
  if (periods.length > 10 || periods.length !== binding.periods.length || periods.some((period, index) => period.from !== binding.periods[index].from || period.to !== binding.periods[index].to || period.amountCents !== binding.periods[index].amountCents)) throw new Error("Unsupported monthly schedule.");
  let phaseStart = seconds(periods[0].from);
  const phases = periods.map((period, index): Stripe.SubscriptionScheduleCreateParams.Phase => {
    const chargeAt = seconds(period.from);
    const anniversary = new Date(period.from); anniversary.setUTCMonth(anniversary.getUTCMonth() + 1);
    const end = index === 0 ? seconds(period.to) : Math.min(seconds(period.to), anniversary.getTime() / 1000);
    const phase: Stripe.SubscriptionScheduleCreateParams.Phase = {
      end_date: end, items: [{ price: catalog.monthlyPriceId, quantity: 1 }],
      metadata: { ...monthlyMetadata(binding), in_season_period: String(index) },
      currency: "usd", collection_method: "charge_automatically", automatic_tax: { enabled: false },
      default_tax_rates: [], discounts: "", proration_behavior: "none",
      ...(index === 0 ? { trial: true, billing_cycle_anchor: "automatic" as const,
        add_invoice_items: [{ price_data: { product: catalog.productId, currency: "usd", unit_amount: period.amountCents }, quantity: 1,
          metadata: { ...monthlyMetadata(binding), in_season_initial: "true" },
          period: { start: { type: "timestamp", timestamp: chargeAt }, end: { type: "timestamp", timestamp: seconds(period.to) } }, tax_rates: [] }] }
        : phaseStart < chargeAt ? { trial_end: chargeAt, billing_cycle_anchor: "automatic" as const }
          : { billing_cycle_anchor: "phase_start" as const }),
    };
    phaseStart = end;
    return phase;
  });
  return { customer: binding.customerId, start_date: seconds(periods[0].from), end_behavior: "cancel", billing_mode: { type: "classic" },
    metadata: monthlyMetadata(binding), default_settings: { collection_method: "charge_automatically", automatic_tax: { enabled: false } }, phases };
}

export function verifyMonthlySchedule(binding: MonthlyBinding, schedule: Stripe.SubscriptionSchedule, allowConsumedInitialItem = false) {
  const expected = monthlyScheduleParameters(binding);
  if (!binding.scheduleId || schedule.id !== binding.scheduleId || schedule.livemode !== false || id(schedule.customer) !== binding.customerId
    || schedule.end_behavior !== "cancel" || schedule.status === "released" || schedule.phases.length !== expected.phases!.length
    || Object.entries(monthlyMetadata(binding)).some(([key, value]) => schedule.metadata?.[key] !== value)) throw new Error("Monthly schedule binding or end behavior mismatch.");
  let from = expected.start_date as number;
  for (let index = 0; index < schedule.phases.length; index++) {
    const actual = schedule.phases[index]; const phase = expected.phases![index];
    const trialEnd = index === 0 ? phase.end_date : phase.trial_end ?? null;
    if (actual.start_date !== from || actual.end_date !== phase.end_date || actual.trial_end !== trialEnd
      || actual.proration_behavior !== "none" || actual.items.length !== 1 || id(actual.items[0].price) !== catalog.monthlyPriceId || actual.items[0].quantity !== 1
      || actual.billing_cycle_anchor !== phase.billing_cycle_anchor || actual.automatic_tax?.enabled !== false
      || (actual.add_invoice_items.length !== (index === 0 ? 1 : 0)
        && !(allowConsumedInitialItem && index === 0 && actual.add_invoice_items.length === 0))
      || Object.entries(phase.metadata ?? {}).some(([key, value]) => actual.metadata?.[key] !== value)
      || actual.discounts?.length || actual.default_tax_rates?.length) throw new Error("Monthly schedule phases changed.");
    from = actual.end_date;
  }
  if (id(schedule.subscription) !== binding.subscriptionId) throw new Error("Schedule subscription mismatch.");
}

export function monthlyInvoicePeriod(binding: MonthlyBinding, index: number) {
  const period = binding.periods[index];
  if (!period) throw new Error("Unknown monthly billing period.");
  monthlyScheduleParameters(binding); // Retain the exact finite-plan validation.
  const anniversary = new Date(period.from); anniversary.setUTCMonth(anniversary.getUTCMonth() + 1);
  // With proration disabled Stripe retains the UTC price interval on the
  // invoice, even when the spring phase ends an hour earlier. Access still uses
  // the Eastern coverage period and the verified schedule ends that phase.
  return { from: seconds(period.from), to: index === 0 ? seconds(period.to) : anniversary.getTime() / 1000 };
}
