import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type Stripe from "stripe";
vi.mock("lib/supabase/server", () => ({ default: {} }));
import { IN_SEASON_SANDBOX_CATALOG as catalog } from "./billingConfig";
import { buildSettledMonthlyPlan, createMonthlyState, monthlyAccess, monthlyMetadata, reduceMonthlyEvent, type MonthlyBinding, type MonthlyState } from "./monthlyLifecycle";
import { monthlyScheduleParameters, verifyMonthlySchedule } from "./monthlySchedule";
import { createMonthlyBilling } from "./monthlyBilling";
import { cancelMonthlyBilling, fulfillMonthlyEvent } from "./monthlyWebhook";
import { runMonthlyBillingJobs, type VerifiedRetryConfiguration } from "./monthlyExecutor";
import { monthlyBillingStore, type MonthlyJob, type MonthlyStore } from "./monthlyStore";

const start = new Date("2026-10-21T12:00:00Z");
const minimum = { accountId: catalog.accountId, chargeCurrency: "usd", settlementCurrency: "usd", minimumChargeCents: 50, verificationReference: "fixture-only" };
function fixture(at = start) {
  const identity = { userId: "user-a", attemptId: "attempt-a", customerId: "cus_a", verifiedMinimum: minimum };
  const plan = buildSettledMonthlyPlan({ ...identity, startsAt: at });
  const binding: MonthlyBinding = { ...identity, subscriptionId: "sub_a", scheduleId: "sub_sched_a", periods: plan.periods };
  const params = monthlyScheduleParameters(binding);
  const price = { id: catalog.monthlyPriceId, livemode: false, active: true, currency: "usd", unit_amount: 499, type: "recurring", product: catalog.productId, recurring: { interval: "month", interval_count: 1 } } as Stripe.Price;
  const initialPrice = { id: "price_initial", livemode: false, active: true, currency: "usd", unit_amount: plan.periods[0].amountCents, type: "one_time", product: catalog.productId } as Stripe.Price;
  const metadata = monthlyMetadata(binding);
  const subscription = { id: "sub_a", livemode: false, customer: "cus_a", schedule: "sub_sched_a", metadata, items: { has_more: false, data: [{ quantity: 1, price }] }, status: "active", cancel_at: null, latest_invoice: "in_a" } as unknown as Stripe.Subscription;
  let phaseStart = params.start_date as number;
  const schedule = { id: "sub_sched_a", livemode: false, customer: "cus_a", subscription, metadata, end_behavior: "cancel", status: "active", phases: params.phases!.map((phase, index) => {
    const row = { ...phase, start_date: phaseStart, trial_end: index === 0 ? phase.end_date : phase.trial_end ?? null, discounts: [], add_invoice_items: index === 0 ? [{ price: "price_initial", quantity: 1 }] : [] };
    phaseStart = phase.end_date!; return row;
  }) } as unknown as Stripe.SubscriptionSchedule;
  const amount = plan.periods[0].amountCents;
  const line = { amount, quantity: 1, currency: "usd", metadata, subscription: null, period: { start: at.getTime() / 1000, end: Date.parse(plan.periods[0].to) / 1000 }, pricing: { price_details: { price: "price_initial", product: catalog.productId } } } as unknown as Stripe.InvoiceLineItem;
  const invoice = { id: "in_a", livemode: false, customer: "cus_a", parent: { subscription_details: { subscription: "sub_a", metadata } }, lines: { has_more: false, data: [line] }, currency: "usd", total: amount, amount_paid: amount, amount_remaining: 0, status: "paid", attempt_count: 1, status_transitions: { paid_at: at.getTime() / 1000 }, hosted_invoice_url: "https://invoice.stripe.com/i/fixture" } as unknown as Stripe.Invoice;
  const charge = { id: "ch_a", livemode: false, payment_intent: "pi_a", customer: "cus_a", amount, currency: "usd", paid: true, captured: true, amount_refunded: 0, disputed: false } as Stripe.Charge;
  const intent = { id: "pi_a", livemode: false, customer: "cus_a", amount, amount_received: amount, currency: "usd", status: "succeeded", latest_charge: charge } as Stripe.PaymentIntent;
  const payment = { id: "inpay_a", livemode: false, invoice: "in_a", status: "paid", amount_paid: amount, currency: "usd", payment: { type: "payment_intent", payment_intent: "pi_a" } } as Stripe.InvoicePayment;
  const refunds = { has_more: false, data: [] as Stripe.Refund[] }; const disputes = { has_more: false, data: [] as Stripe.Dispute[] };
  const stripe = {
    accounts: { retrieve: vi.fn().mockResolvedValue({ id: catalog.accountId }) },
    customers: { create: vi.fn().mockResolvedValue({ id: "cus_a", livemode: false, metadata: { in_season_user_id: "user-a", in_season_attempt_id: "attempt-a" } }) },
    prices: { retrieve: vi.fn(async (id: string) => id === "price_initial" ? initialPrice : price) },
    subscriptions: { retrieve: vi.fn().mockResolvedValue(subscription), update: vi.fn().mockResolvedValue(subscription), cancel: vi.fn().mockResolvedValue(subscription) },
    subscriptionSchedules: { create: vi.fn().mockResolvedValue(schedule), retrieve: vi.fn().mockResolvedValue(schedule), cancel: vi.fn().mockResolvedValue(schedule) },
    invoices: { retrieve: vi.fn().mockResolvedValue(invoice), finalizeInvoice: vi.fn().mockResolvedValue(invoice), pay: vi.fn().mockResolvedValue(invoice), list: vi.fn().mockResolvedValue({ has_more: false, data: [] }), del: vi.fn(), voidInvoice: vi.fn() },
    invoiceItems: { list: vi.fn().mockResolvedValue({ has_more: false, data: [] }), del: vi.fn() },
    invoicePayments: { list: vi.fn().mockResolvedValue({ has_more: false, data: [payment] }) }, paymentIntents: { retrieve: vi.fn().mockResolvedValue(intent) },
    refunds: { list: vi.fn().mockResolvedValue(refunds) }, disputes: { list: vi.fn().mockResolvedValue(disputes) },
  };
  let state = createMonthlyState(binding); const receipts = new Set<string>();
  const store = {
    begin: vi.fn().mockResolvedValue({ id: "attempt-a", user_id: "user-a", created_at: at.toISOString(), minimum, customer_id: null, schedule_id: null, state: null }),
    customer: vi.fn(), attach: vi.fn(), load: vi.fn(async () => state),
    claim: vi.fn(async (_sub: string, event: string) => receipts.has(event) ? { duplicate: true } : { token: "lease", state: structuredClone(state) }),
    commit: vi.fn(async (_sub: string, event: string, _token: string, next: MonthlyState) => { state = structuredClone(next); receipts.add(event); }),
    jobs: vi.fn().mockResolvedValue([]), claimJob: vi.fn(), snapshotJob: vi.fn(), finishJob: vi.fn(),
  };
  const event = { id: "evt_a", livemode: false, type: "invoice.paid", created: at.getTime() / 1000, data: { object: invoice } } as Stripe.Event;
  const process = (time = at) => fulfillMonthlyEvent({ stripe: stripe as unknown as Stripe, store: store as MonthlyStore, event, now: time });
  return { at, binding, params, price, initialPrice, subscription, schedule, line, invoice, charge, intent, payment, refunds, disputes, stripe, store, event, process, state: () => state, setState: (next: MonthlyState) => { state = next; } };
}

describe("finite monthly schedule adapter", () => {
  it("charges 177 cents initially and schedules no July phase", () => {
    const f = fixture(); expect(f.params.end_behavior).toBe("cancel");
    expect(f.params.phases![0]).toMatchObject({ trial: true, add_invoice_items: [{ price_data: { unit_amount: 177, currency: "usd", product: catalog.productId } }] });
    expect(f.params.phases!.at(-1)!.end_date).toBe(Date.parse("2027-07-01T04:00Z") / 1000);
    expect(f.params.phases).toHaveLength(9);
  });
  it("accepts a JSONB round trip that reorders object keys", () => {
    const f = fixture(); const binding = { ...f.binding, periods: f.binding.periods.map((period) => ({ amountCents: period.amountCents, to: period.to, from: period.from })) };
    expect(monthlyScheduleParameters(binding)).toEqual(f.params);
    expect(createMonthlyState(binding).binding.periods).toEqual(f.binding.periods);
  });
  it("avoids the extra fall anniversary and restores the spring midnight anchor", () => {
    const phases = fixture().params.phases!;
    expect(phases[1].end_date).toBe(Date.parse("2026-12-01T04:00Z") / 1000);
    expect(phases[2]).toMatchObject({ trial_end: Date.parse("2026-12-01T05:00Z") / 1000, billing_cycle_anchor: "automatic", end_date: Date.parse("2027-01-01T05:00Z") / 1000 });
    expect(phases[5].end_date).toBe(Date.parse("2027-04-01T04:00Z") / 1000);
    expect(phases[6].billing_cycle_anchor).toBe("phase_start");
  });
  it.each(["release", "phase", "tax", "owner"])("rejects a changed %s schedule", (kind) => {
    const f = fixture();
    if (kind === "release") f.schedule.end_behavior = "release";
    if (kind === "phase") f.schedule.phases[1].end_date += 3600;
    if (kind === "tax") f.schedule.phases[1].automatic_tax!.enabled = true;
    if (kind === "owner") f.schedule.customer = "cus_other";
    expect(() => verifyMonthlySchedule(f.binding, f.schedule)).toThrow();
  });
  it("creates a finite schedule, persists its binding, and returns a verified hosted invoice", async () => {
    const f = fixture(); f.invoice.status = "open";
    const result = await createMonthlyBilling({ stripe: f.stripe as unknown as Stripe, store: f.store as MonthlyStore, userId: "user-a", minimum, now: start });
    expect(result).toEqual({ state: "checkout", url: "https://invoice.stripe.com/i/fixture" });
    expect(f.stripe.subscriptionSchedules.create).toHaveBeenCalledWith(expect.objectContaining({ end_behavior: "cancel", customer: "cus_a", phases: f.params.phases }), { idempotencyKey: "in-season-monthly-schedule:attempt-a" });
    expect(f.store.attach).toHaveBeenCalledWith("attempt-a", expect.objectContaining({ binding: f.binding }));
    expect(f.store.attach.mock.invocationCallOrder[0]).toBeLessThan(f.stripe.subscriptions.update.mock.invocationCallOrder[0]);
  });
  it("retries uncertain attachment with identical schedule parameters and key", async () => {
    const f = fixture(); f.store.attach.mockRejectedValueOnce(new Error("connection lost"));
    const call = () => createMonthlyBilling({ stripe: f.stripe as unknown as Stripe, store: f.store as MonthlyStore, userId: "user-a", minimum, now: start });
    await expect(call()).rejects.toThrow(); await call();
    expect(f.stripe.subscriptionSchedules.create.mock.calls[1]).toEqual(f.stripe.subscriptionSchedules.create.mock.calls[0]);
  });
  it("blocks an unverified minimum before creating a customer or schedule", async () => {
    const f = fixture(); await expect(createMonthlyBilling({ stripe: f.stripe as unknown as Stripe, store: f.store as MonthlyStore, userId: "user-a", minimum: { ...minimum, accountId: "wrong" }, now: start })).rejects.toThrow();
    expect(f.stripe.customers.create).not.toHaveBeenCalled();
  });
  it.each([100, 5_001])("bounds database creation clock skew at %s milliseconds", async (skew) => {
    const f = fixture(); f.invoice.status = "open";
    const call = createMonthlyBilling({ stripe: f.stripe as unknown as Stripe, store: f.store as MonthlyStore, userId: "user-a", minimum, now: new Date(start.getTime() - skew) });
    if (skew <= 5_000) await expect(call).resolves.toMatchObject({ state: "checkout" });
    else { await expect(call).rejects.toThrow(/review/); expect(f.stripe.subscriptionSchedules.create).not.toHaveBeenCalled(); }
  });
});

describe("monthly webhook to durable-store contract", () => {
  it.each([["pending", "succeeded", false], ["succeeded", "failed", true]] as const)("orders a late fresh %s to %s refund read by its acquired lease", async (before, after, eligible) => {
    const f = fixture(); await f.process();
    const refund = { id: "re_a", charge: "ch_a", payment_intent: "pi_a", amount: 177, currency: "usd", status: before } as Stripe.Refund;
    f.refunds.data = [refund];
    let resume!: () => void, stalled!: () => void;
    const wait = new Promise<void>(resolve => { resume = resolve; }), reached = new Promise<void>(resolve => { stalled = resolve; });
    f.stripe.invoices.retrieve.mockImplementationOnce(async () => { stalled(); await wait; return f.invoice; });
    const eventA = { ...f.event, id: "evt_early_request" };
    const a = fulfillMonthlyEvent({ stripe: f.stripe as unknown as Stripe, store: f.store as MonthlyStore, event: eventA, now: new Date("2026-10-22T12:00Z") });
    await reached;
    await fulfillMonthlyEvent({ stripe: f.stripe as unknown as Stripe, store: f.store as MonthlyStore, event: { ...f.event, id: "evt_later_request" }, now: new Date("2026-10-22T12:01Z") });
    refund.status = after; resume(); await a;
    expect(f.state().invoices.in_a.refunds.re_a.status).toBe(after);
    expect(monthlyAccess(f.state(), new Date("2026-10-22T12:02Z")).eligible).toBe(eligible);
  });
  it("rejects an in-flight old refund snapshot after its lease expires and a newer reconciliation commits", async () => {
    const f = fixture(); await f.process();
    f.refunds.data = [{ id: "re_a", charge: "ch_a", payment_intent: "pi_a", amount: 177, currency: "usd", status: "pending" } as Stripe.Refund];
    let active: string | null = null, expired = false, sequence = 0;
    const commit = f.store.commit.getMockImplementation()!;
    f.store.claim.mockImplementation(async () => {
      if (active && !expired) throw new Error("Lease busy");
      expired = false; active = `lease-${++sequence}`;
      return { token: active, state: structuredClone(f.state()) };
    });
    f.store.commit.mockImplementation(async (sub, event, token, next) => {
      // Model the existing SQL lease-token/expiry commit guard; no DB execution.
      if (token !== active || expired) throw new Error("Stale lease");
      await commit(sub, event, token, next); active = null;
    });
    let resume!: () => void, reached!: () => void;
    const wait = new Promise<void>(r => { resume = r; }), reading = new Promise<void>(r => { reached = r; });
    f.stripe.refunds.list.mockImplementationOnce(async () => { const old = structuredClone(f.refunds); reached(); await wait; return old; });
    const old = fulfillMonthlyEvent({ stripe: f.stripe as unknown as Stripe, store: f.store as MonthlyStore, event: { ...f.event, id: "evt_old_lease" }, now: new Date("2026-10-22T12:00Z") });
    const rejected = expect(old).rejects.toThrow(/Stale lease/);
    await reading; expired = true; f.refunds.data[0].status = "succeeded";
    await fulfillMonthlyEvent({ stripe: f.stripe as unknown as Stripe, store: f.store as MonthlyStore, event: { ...f.event, id: "evt_new_lease" }, now: new Date("2026-10-22T12:01Z") });
    resume(); await rejected;
    expect(f.state().invoices.in_a.refunds.re_a.status).toBe("succeeded");
    expect(monthlyAccess(f.state(), new Date("2026-10-22T12:02Z")).eligible).toBe(false);
  });
  it("accepts Stripe's March UTC interval while ending access at Eastern midnight", async () => {
    const f = fixture(); const paid = Date.parse("2027-03-01T06:00Z") / 1000;
    Object.assign(f.line, { amount: 499, subscription: "sub_a", period: { start: Date.parse("2027-03-01T05:00Z") / 1000, end: Date.parse("2027-04-01T05:00Z") / 1000 }, pricing: { price_details: { price: catalog.monthlyPriceId, product: catalog.productId } } });
    Object.assign(f.invoice, { total: 499, amount_paid: 499, status_transitions: { paid_at: paid } });
    f.payment.amount_paid = 499; f.intent.amount = 499; f.intent.amount_received = 499; f.charge.amount = 499;
    f.event.created = paid;
    await f.process(new Date(paid * 1000));
    expect(monthlyAccess(f.state(), new Date(paid * 1000)).expiresAt).toBe("2027-04-01T04:00:00.000Z");
    expect(monthlyAccess(f.state(), new Date("2027-04-01T04:00Z")).eligible).toBe(false);
  });
  it("accepts consumed initial schedule items and current Stripe line parents", async () => {
    const f = fixture(); f.schedule.phases[0].add_invoice_items = [];
    f.line.parent = { type: "invoice_item_details", invoice_item_details: { subscription: "sub_a" } } as Stripe.InvoiceLineItem.Parent;
    f.invoice.lines.data.push({ ...f.line, amount: 0, parent: { type: "subscription_item_details", subscription_item_details: { subscription: "sub_a" } }, pricing: { price_details: { price: catalog.monthlyPriceId, product: catalog.productId } } } as Stripe.InvoiceLineItem);
    await f.process(); expect(monthlyAccess(f.state(), start).eligible).toBe(true);
    expect(() => verifyMonthlySchedule(f.binding, f.schedule)).toThrow(); // Creation remains strict.
  });
  it("rejects a conflicting current invoice parent without granting access", async () => {
    const f = fixture(); f.line.parent = { type: "invoice_item_details", invoice_item_details: { subscription: "sub_other" } } as Stripe.InvoiceLineItem.Parent;
    await expect(f.process()).rejects.toThrow(); expect(f.store.commit).not.toHaveBeenCalled();
  });
  it("verifies the provider chain, commits a payment grant, and deduplicates before fresh reads", async () => {
    const f = fixture(); await f.process(); expect(monthlyAccess(f.state(), start).eligible).toBe(true);
    const previousReads = f.stripe.invoicePayments.list.mock.calls.length;
    await expect(f.process()).resolves.toMatchObject({ duplicate: true });
    expect(f.stripe.invoicePayments.list).toHaveBeenCalledTimes(previousReads); expect(f.store.commit).toHaveBeenCalledTimes(1);
  });
  it("suspends and restores a disputed payment, preserving original expiry and stopping billing", async () => {
    const f = fixture(); await f.process();
    const opened = new Date("2026-10-22T12:00Z");
    f.event = Object.assign(f.event, { id: "evt_dispute", type: "charge.dispute.created", created: opened.getTime() / 1000, data: { object: { payment_intent: "pi_a" } } });
    f.disputes.data = [{ id: "dp_a", livemode: false, charge: "ch_a", payment_intent: "pi_a", currency: "usd", created: opened.getTime() / 1000, status: "needs_response" } as Stripe.Dispute];
    await f.process(opened); expect(monthlyAccess(f.state(), opened).eligible).toBe(false);
    f.disputes.data[0].status = "won"; f.event.id = "evt_won"; f.event.type = "charge.dispute.closed";
    await f.process(new Date("2026-10-23T12:00Z")); expect(monthlyAccess(f.state(), new Date("2026-10-23T12:00Z")).eligible).toBe(true);
    expect(f.state().billingStoppedAt).toBe(opened.toISOString()); expect(monthlyAccess(f.state(), new Date("2026-11-01T04:00Z")).eligible).toBe(false);
  });
  it("does not persist a partial grant when adjustment retrieval fails", async () => {
    const f = fixture(); f.stripe.refunds.list.mockRejectedValue(new Error("provider unavailable")); await expect(f.process()).rejects.toThrow();
    expect(f.store.commit).not.toHaveBeenCalled(); expect(monthlyAccess(f.state(), start).eligible).toBe(false);
  });
  it.each(["phase", "original trial"])("acknowledges the scheduled zero-value DST deferral with %s start without granting access", async (kind) => {
    const f = fixture(); const at = new Date("2026-12-01T04:00Z");
    Object.assign(f.invoice, { id: "in_zero", created: at.getTime() / 1000, total: 0, amount_paid: 0, amount_remaining: 0 });
    Object.assign(f.invoice.parent!.subscription_details!.metadata!, { in_season_period: "2" });
    Object.assign(f.line, { amount: 0, subscription: "sub_a", period: { start: kind === "phase" ? at.getTime() / 1000 : start.getTime() / 1000, end: Date.parse("2026-12-01T05:00Z") / 1000 }, pricing: { price_details: { price: catalog.monthlyPriceId, product: catalog.productId } } });
    f.event.created = at.getTime() / 1000;
    await f.process(at); expect(f.store.commit).toHaveBeenCalledTimes(1); expect(monthlyAccess(f.state(), at).eligible).toBe(false);
    expect(f.stripe.invoicePayments.list).not.toHaveBeenCalled();
  });
  it("propagates storage failures and rejects cross-account provider facts", async () => {
    const f = fixture(); f.subscription.customer = "cus_other"; await expect(f.process()).rejects.toThrow(); expect(f.store.commit).not.toHaveBeenCalled();
    f.subscription.customer = "cus_a"; f.store.commit.mockRejectedValueOnce(new Error("storage unavailable")); await expect(f.process()).rejects.toThrow(/storage/);
  });
  it("persists owner cancellation before any provider work and rejects another account", async () => {
    const f = fixture(); await f.process(); const at = new Date("2026-10-22T12:00Z");
    await expect(cancelMonthlyBilling(f.store as MonthlyStore, "other", "sub_a", "r1", at)).rejects.toThrow();
    await cancelMonthlyBilling(f.store as MonthlyStore, "user-a", "sub_a", "r1", at);
    expect(monthlyAccess(f.state(), at).eligible).toBe(false); expect(f.stripe.subscriptionSchedules.cancel).not.toHaveBeenCalled();
  });
  it("uses the actual subscription end instead of the earlier scheduled-cancellation request", async () => {
    const f = fixture(); await f.process(); const ended = new Date("2026-11-01T04:00Z");
    Object.assign(f.subscription, { status: "canceled", canceled_at: start.getTime() / 1000, ended_at: ended.getTime() / 1000 });
    Object.assign(f.event, { id: "evt_natural_end", type: "customer.subscription.deleted", created: ended.getTime() / 1000, data: { object: f.subscription } });
    await f.process(ended);
    expect(f.state().cancelledAt).toBe(ended.toISOString());
    expect(monthlyAccess(f.state(), new Date("2026-10-22T12:00Z")).eligible).toBe(true);
    expect(monthlyAccess(f.state(), ended).eligible).toBe(false);
  });
});

describe("bounded monthly execution", () => {
  function jobFixture(kind: MonthlyJob["kind"], startsAt = new Date("2027-06-01T04:00Z")) {
    const f = fixture(startsAt);
    const job: MonthlyJob = { id: kind === "retry" ? "in-season-monthly-retry:in_a:2" : "monthly-cutoff:sub_a", subscription_id: "sub_a", user_id: "user-a", kind,
      due_at: kind === "retry" ? "2027-06-02T04:00:00.000Z" : "2027-07-01T04:00:00.000Z", invoice_id: kind === "retry" ? "in_a" : null, attempt: kind === "retry" ? 2 : null, created_at: f.at.toISOString(), accounting_snapshots: [] };
    f.store.jobs.mockResolvedValue([job]); f.store.claimJob.mockResolvedValue({ token: "job-lease", job });
    f.store.snapshotJob.mockImplementation(async (_id, _token, snapshot) => { job.accounting_snapshots.push(structuredClone(snapshot)); });
    f.setState(reduceMonthlyEvent(f.state(), { kind: "failed", eventId: "evt_fail", userId: "user-a", subscriptionId: "sub_a", invoiceId: "in_a", period: 0, failedAttempts: 1, firstFailureAt: f.at.toISOString() }, f.at));
    f.invoice.status = "open"; f.invoice.amount_paid = 0; f.invoice.amount_remaining = 499; f.invoice.auto_advance = false;
    f.payment.status = "open"; f.payment.amount_paid = 0; f.intent.status = "requires_payment_method"; f.intent.amount_received = 0;
    const settle = (paidAt = Date.parse(job.due_at) / 1000) => {
      Object.assign(f.invoice, { status: "paid", amount_paid: 499, amount_remaining: 0, status_transitions: { paid_at: paidAt } });
      f.payment.status = "paid"; f.payment.amount_paid = 499; f.intent.status = "succeeded"; f.intent.amount_received = 499;
      return f.invoice;
    };
    f.stripe.invoices.pay.mockImplementation(async () => settle());
    const run = async (now = new Date(job.due_at), retries: VerifiedRetryConfiguration = { accountId: catalog.accountId, automaticRetriesDisabled: true, verificationReference: "fixture" }) => {
      const result = await runMonthlyBillingJobs({ stripe: f.stripe as unknown as Stripe, store: f.store as MonthlyStore, limit: 2, now, retries });
      // Single-job tests inspect the surfaced error; batch tests call the worker directly.
      if (result.failed.length) throw new Error(result.failed[0].error);
      return result;
    };
    return { ...f, job, run, settle };
  }
  it("uses a durable retry key only at its bounded due time", async () => {
    const f = jobFixture("retry"); await f.run();
    expect(f.stripe.invoices.pay).toHaveBeenCalledWith("in_a", { off_session: true }, { idempotencyKey: f.job.id });
    expect(f.store.snapshotJob.mock.invocationCallOrder[0]).toBeLessThan(f.stripe.invoices.pay.mock.invocationCallOrder[0]);
    expect(f.store.finishJob).toHaveBeenCalledWith(f.job.id, "job-lease");
  });
  it("never collects after cutoff or catches up an old retry", async () => {
    const f = jobFixture("retry"); await f.run(new Date("2027-07-01T04:00Z")); expect(f.stripe.invoices.pay).not.toHaveBeenCalled();
  });
  it("requires independently verified automatic-retry settings", async () => {
    const f = jobFixture("retry"); await expect(f.run(undefined, { accountId: "wrong", automaticRetriesDisabled: true, verificationReference: "fixture" })).rejects.toThrow(/configuration/);
    expect(f.stripe.invoices.pay).not.toHaveBeenCalled();
  });
  it("refuses to race Stripe's automatic collection even with an operator configuration", async () => {
    const f = jobFixture("retry"); f.invoice.auto_advance = true;
    await expect(f.run()).rejects.toThrow(/Automatic invoice collection/);
    expect(f.stripe.invoices.pay).not.toHaveBeenCalled();
  });
  it("leaves an uncertain payment unfinished instead of issuing a different-key retry", async () => {
    const f = jobFixture("retry"); f.stripe.invoices.pay.mockRejectedValue(new Error("network timeout")); await expect(f.run()).rejects.toThrow(); expect(f.store.finishJob).not.toHaveBeenCalled();
  });
  it("reconciles timeout-after-success six minutes later without another charge", async () => {
    const f = jobFixture("retry"); const paidAt = Date.parse(f.job.due_at) / 1000;
    f.stripe.invoices.pay.mockImplementationOnce(async () => {
      f.settle(paidAt);
      throw new Error("response lost after success");
    });
    await expect(f.run()).rejects.toThrow(/response lost/);
    await f.run(new Date(paidAt * 1000 + 6 * 60_000));
    expect(f.stripe.invoices.pay).toHaveBeenCalledTimes(1);
    expect(f.state().invoices.in_a.paidAt).toBe(new Date(paidAt * 1000).toISOString());
    expect(monthlyAccess(f.state(), new Date(paidAt * 1000 + 6 * 60_000)).eligible).toBe(true);
    expect(f.store.finishJob).toHaveBeenCalledTimes(1);
  });
  it.each([1, 3])("keeps a lost-response manual retry unresolved at provider count %s until a delayed payment settles", async count => {
    const f = jobFixture("retry"); f.invoice.attempt_count = count;
    f.stripe.invoices.pay.mockRejectedValueOnce(new Error("lost manual retry response"));
    await expect(f.run()).rejects.toThrow(/lost manual/);
    const original = structuredClone(f.state());
    for (const now of ["2027-06-02T04:02Z", "2027-06-02T04:06Z"]) {
      await expect(f.run(new Date(now))).rejects.toThrow(/Manual retry outcome unresolved/);
      expect(f.state()).toEqual(original); expect(f.store.finishJob).not.toHaveBeenCalled();
    }
    expect(f.stripe.invoices.pay).toHaveBeenCalledTimes(1);
    expect(f.job.accounting_snapshots[0]).toMatchObject({ operation: "retry", invoiceId: "in_a", attempt: 2, idempotencyKey: f.job.id });
    f.settle(Date.parse("2027-06-02T04:07Z") / 1000); await f.run(new Date("2027-06-02T04:08Z"));
    expect(f.state().invoices.in_a).toMatchObject({ paidAt: "2027-06-02T04:07:00.000Z", firstFailureAt: "2027-06-01T04:00:00.000Z", failedAttempts: 1 });
    expect(f.stripe.invoices.pay).toHaveBeenCalledTimes(1); expect(f.store.finishJob).toHaveBeenCalledTimes(1);
  });
  it.each(["cutoff", "local cancellation", "provider cancellation"])("records a recovered payment without reopening access after %s", async boundary => {
    const f = jobFixture("retry"); f.settle();
    let now = new Date("2027-06-02T04:06Z");
    if (boundary === "cutoff") now = new Date("2027-07-01T04:00Z");
    else if (boundary === "local cancellation") await cancelMonthlyBilling(f.store as MonthlyStore, "user-a", "sub_a", "stop", new Date("2027-06-02T04:01Z"));
    else Object.assign(f.subscription, { status: "canceled", canceled_at: Date.parse("2027-06-02T04:01Z") / 1000, ended_at: Date.parse("2027-06-02T04:01Z") / 1000 });
    await f.run(now);
    expect(f.state().invoices.in_a.paidAt).toBe("2027-06-02T04:00:00.000Z");
    expect(monthlyAccess(f.state(), now).eligible).toBe(false);
    expect(f.stripe.invoices.pay).not.toHaveBeenCalled(); expect(f.store.finishJob).toHaveBeenCalledTimes(1);
  });
  it("keeps a late in-flight payment unresolved and never tries another charge", async () => {
    const f = jobFixture("retry"); f.intent.status = "processing";
    await expect(f.run(new Date("2027-06-02T04:06Z"))).rejects.toThrow(/uncertain/);
    expect(f.stripe.invoices.pay).not.toHaveBeenCalled(); expect(f.store.finishJob).not.toHaveBeenCalled();
  });
  it("reconciles a recovered full refund before granting a late successful payment", async () => {
    const f = jobFixture("retry"); f.settle();
    f.refunds.data = [{ id: "re_a", charge: "ch_a", payment_intent: "pi_a", amount: 499, currency: "usd", status: "succeeded" } as Stripe.Refund];
    await f.run(new Date("2027-06-02T04:06Z"));
    expect(monthlyAccess(f.state(), new Date("2027-06-02T04:06Z")).eligible).toBe(false);
    expect(f.state().invoices.in_a.refunds.re_a.status).toBe("succeeded"); expect(f.stripe.invoices.pay).not.toHaveBeenCalled();
  });
  it("records a definitive third decline so persistence requests cancellation", async () => {
    const f = jobFixture("retry");
    f.stripe.invoices.pay.mockRejectedValue(Object.assign(new Error("declined"), { statusCode: 402 }));
    await f.run(); expect(f.state().invoices.in_a.failedAttempts).toBe(2);
    f.job.attempt = 3; f.job.id = "in-season-monthly-retry:in_a:3"; f.job.due_at = "2027-06-03T04:00:00.000Z"; f.job.accounting_snapshots = [];
    await f.run(new Date(f.job.due_at)); expect(f.state().invoices.in_a.failedAttempts).toBe(3);
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    await monthlyBillingStore({ rpc }).commit("sub_a", "job:third", "lease", f.state(), new Date(f.job.due_at));
    expect(rpc).toHaveBeenCalledWith("commit_in_season_sandbox_monthly", expect.objectContaining({ p_stop: true, p_retries: [] }));
  });
  it("counts two confirmed failures when slot two was skipped and slot three declines", async () => {
    const f = jobFixture("retry"); f.job.attempt = 3; f.job.id = "in-season-monthly-retry:in_a:3"; f.job.due_at = "2027-06-03T04:00:00.000Z";
    f.stripe.invoices.pay.mockRejectedValueOnce(Object.assign(new Error("declined"), { statusCode: 402 }));
    await f.run(new Date(f.job.due_at));
    expect(f.state().invoices.in_a).toMatchObject({ failedAttempts: 2, firstFailureAt: "2027-06-01T04:00:00.000Z" });
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    await monthlyBillingStore({ rpc }).commit("sub_a", `job:${f.job.id}`, "lease", f.state(), new Date(f.job.due_at));
    expect(rpc).toHaveBeenCalledWith("commit_in_season_sandbox_monthly", expect.objectContaining({ p_stop: false, p_retries: [] }));
    await f.run(new Date("2027-06-03T04:06Z")); expect(f.state().invoices.in_a.failedAttempts).toBe(2); expect(f.stripe.invoices.pay).toHaveBeenCalledTimes(1);
  });
  it("continues to July cleanup after an older unresolved retry", async () => {
    const f = jobFixture("retry", new Date("2027-05-01T04:00Z"));
    f.job.accounting_snapshots.push({ operation: "retry", invoiceId: "in_a", attempt: 2 });
    const cleanup: MonthlyJob = { ...f.job, id: "monthly-cutoff:sub_a", kind: "cutoff", due_at: "2027-07-01T04:00:00.000Z", invoice_id: null, attempt: null, accounting_snapshots: [] };
    Object.assign(f.subscription, { status: "canceled", canceled_at: Date.parse("2027-06-01T04:00Z") / 1000, ended_at: Date.parse(cleanup.due_at) / 1000 }); f.schedule.status = "completed";
    f.store.jobs.mockResolvedValue([f.job, cleanup]); f.store.claimJob.mockImplementation(async id => ({ token: "job-lease", job: id === cleanup.id ? cleanup : f.job }));
    const result = await runMonthlyBillingJobs({ stripe: f.stripe as unknown as Stripe, store: f.store as MonthlyStore, now: new Date(cleanup.due_at), limit: 2 });
    expect(result).toMatchObject({ completed: [cleanup.id], failed: [expect.objectContaining({ id: f.job.id })] });
    expect(f.stripe.invoices.list).toHaveBeenCalledWith({ subscription: "sub_a", limit: 100 });
    expect(f.store.finishJob).toHaveBeenCalledTimes(1); expect(f.store.finishJob).toHaveBeenCalledWith(cleanup.id, "job-lease");
  });
  it("continues to requested cancellation after an unresolved retry", async () => {
    const f = jobFixture("retry", new Date("2027-05-01T04:00Z")); const now = new Date("2027-06-02T04:06Z");
    await cancelMonthlyBilling(f.store as MonthlyStore, "user-a", "sub_a", "owner-stop", now);
    f.job.accounting_snapshots.push({ operation: "retry", invoiceId: "in_a", attempt: 2 });
    const stop: MonthlyJob = { ...f.job, id: "monthly-stop:sub_a", kind: "stop", due_at: now.toISOString(), invoice_id: null, attempt: null, accounting_snapshots: [] };
    f.store.jobs.mockResolvedValue([f.job, stop]); f.store.claimJob.mockImplementation(async id => ({ token: "job-lease", job: id === stop.id ? stop : f.job }));
    const result = await runMonthlyBillingJobs({ stripe: f.stripe as unknown as Stripe, store: f.store as MonthlyStore, now, limit: 2 });
    expect(result).toMatchObject({ completed: [stop.id], failed: [expect.objectContaining({ id: f.job.id })] });
    expect(f.stripe.subscriptionSchedules.cancel).toHaveBeenCalledTimes(1); expect(f.store.finishJob).toHaveBeenCalledWith(stop.id, "job-lease");
    expect(f.stripe.invoices.pay).not.toHaveBeenCalled();
  });
  it("keeps urgent cleanup reachable beyond one batch of failed stop jobs and an older retry backlog", async () => {
    const sql = readFileSync("../supabase/migrations/20261021210000_in_season_sandbox_billing.sql", "utf8")
      .split("create function public.list_in_season_sandbox_monthly_jobs")[1].split("end $$;")[0].replace(/\s+/g, " ");
    expect(sql).toContain("order by case when kind in ('stop','cutoff') then 0 else 1 end,lease_until asc nulls first,due_at,id limit p_limit");
    // Model this SQL selection/claim contract with advancing time; no SQL is applied.
    const f = jobFixture("cutoff"); let clock = Date.parse(f.job.due_at);
    type Queued = MonthlyJob & { status: string; lease_until: number | null };
    const queue: Queued[] = [
      ...Array.from({ length: 25 }, (_, i) => ({ ...f.job, id: `old-retry-${i}`, subscription_id: `unknown-${i}`, kind: "retry" as const, due_at: "2027-05-01T04:00:00.000Z", status: "pending", lease_until: null })),
      ...Array.from({ length: 6 }, (_, i) => ({ ...f.job, id: `failed-stop-${i}`, subscription_id: `blocked-${i}`, kind: "stop" as const, due_at: "2027-06-01T04:00:00.000Z", status: "pending", lease_until: null })),
      { ...f.job, status: "pending", lease_until: null },
    ];
    const selected: string[][] = [];
    f.store.jobs.mockImplementation(async limit => {
      const rows = queue.filter(row => row.status !== "done" && (row.lease_until ?? 0) <= clock && Date.parse(row.due_at) <= clock)
        .sort((a, b) => Number(a.kind === "retry") - Number(b.kind === "retry") || (a.lease_until ?? -Infinity) - (b.lease_until ?? -Infinity)
          || Date.parse(a.due_at) - Date.parse(b.due_at) || a.id.localeCompare(b.id)).slice(0, limit);
      selected.push(rows.map(row => row.id)); return rows;
    });
    f.store.claimJob.mockImplementation(async id => { const job = queue.find(row => row.id === id)!; job.status = "running"; job.lease_until = clock + 60_000; return { job, token: "job-lease" }; });
    const claim = f.store.claim.getMockImplementation()!;
    f.store.claim.mockImplementation(async (sub, event) => { if (sub !== "sub_a") throw new Error("Stop state temporarily unavailable"); return claim(sub, event); });
    f.store.finishJob.mockImplementation(async id => { queue.find(row => row.id === id)!.status = "done"; });
    Object.assign(f.subscription, { status: "canceled", canceled_at: clock / 1000, ended_at: clock / 1000 }); f.schedule.status = "completed";
    const results = [];
    for (let run = 0; run < 4; run++) {
      results.push(await runMonthlyBillingJobs({ stripe: f.stripe as unknown as Stripe, store: f.store as MonthlyStore, now: new Date(clock), limit: 2 }));
      clock += 120_000;
    }
    expect(selected.slice(0, 3)).toEqual([["failed-stop-0", "failed-stop-1"], ["failed-stop-2", "failed-stop-3"], ["failed-stop-4", "failed-stop-5"]]);
    expect(selected[3]).toEqual([f.job.id, "failed-stop-0"]); expect(selected.every(batch => batch.length <= 2)).toBe(true);
    expect(results[3].completed).toEqual([f.job.id]); expect(results.every(result => result.failed.length > 0)).toBe(true);
    expect(f.stripe.invoices.list).toHaveBeenCalledTimes(1); expect(f.store.finishJob).toHaveBeenCalledTimes(1);
  });
  it.each(["before", "after"])("recovers a durable third-decline receipt when the state write fails %s commit", async when => {
    const f = jobFixture("retry", new Date("2027-05-01T04:00Z"));
    f.job.attempt = 3; f.job.id = "in-season-monthly-retry:in_a:3"; f.job.due_at = "2027-05-03T04:00:00.000Z";
    f.setState(reduceMonthlyEvent(f.state(), { kind: "failed", eventId: "second-decline", userId: "user-a", subscriptionId: "sub_a", invoiceId: "in_a", period: 0, failedAttempts: 2, firstFailureAt: null }, new Date("2027-05-02T04:00Z")));
    f.invoice.attempt_count = 1;
    f.stripe.invoices.pay.mockRejectedValueOnce(Object.assign(new Error("declined"), { statusCode: 402 }));
    const commit = f.store.commit.getMockImplementation()!;
    f.store.commit.mockImplementationOnce(async (...args) => { if (when === "after") await commit(...args); throw new Error("state write response lost"); });
    await expect(f.run(new Date(f.job.due_at))).rejects.toThrow(/state write/);
    expect(f.store.finishJob).not.toHaveBeenCalled();
    expect(f.job.accounting_snapshots[1]).toMatchObject({ operation: "retry_declined", invoiceId: "in_a", attempt: 3, idempotencyKey: f.job.id, statusCode: 402 });
    const recoveredAt = new Date("2027-05-03T04:06Z"); await f.run(recoveredAt);
    expect(f.state().invoices.in_a).toMatchObject({ failedAttempts: 3, firstFailureAt: "2027-05-01T04:00:00.000Z", paidAt: null });
    expect(f.binding.periods).toContainEqual(expect.objectContaining({ from: "2027-06-01T04:00:00.000Z", amountCents: 499 }));
    expect(f.stripe.invoices.pay).toHaveBeenCalledTimes(1); expect(f.store.finishJob).toHaveBeenCalledTimes(1);
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    await monthlyBillingStore({ rpc }).commit("sub_a", `job:${f.job.id}`, "lease", f.state(), recoveredAt);
    expect(rpc).toHaveBeenCalledWith("commit_in_season_sandbox_monthly", expect.objectContaining({ p_stop: true, p_retries: [] }));
    const saved = structuredClone(f.state()); await f.run(new Date("2027-05-03T05:00Z"));
    expect(f.state()).toEqual(saved); expect(f.store.commit).toHaveBeenCalledTimes(when === "after" ? 1 : 2); expect(f.stripe.invoices.pay).toHaveBeenCalledTimes(1);
  });
  it.each([0, 1, 2, 99])("does not infer manual failures or move the grace anchor from invoice count %s", async count => {
    const f = jobFixture("retry");
    f.setState(reduceMonthlyEvent(f.state(), { kind: "failed", eventId: "second-decline", userId: "user-a", subscriptionId: "sub_a", invoiceId: "in_a", period: 0, failedAttempts: 2, firstFailureAt: null }, new Date("2027-06-02T04:00Z")));
    f.invoice.attempt_count = count;
    const recoveredAt = new Date("2027-06-02T04:06Z"); await f.run(recoveredAt);
    expect(f.state().invoices.in_a).toMatchObject({ failedAttempts: 2, firstFailureAt: "2027-06-01T04:00:00.000Z" });
    expect(f.stripe.invoices.pay).not.toHaveBeenCalled();
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    await monthlyBillingStore({ rpc }).commit("sub_a", `job:${f.job.id}`, "lease", f.state(), recoveredAt);
    expect(rpc).toHaveBeenCalledWith("commit_in_season_sandbox_monthly", expect.objectContaining({ p_stop: false, p_retries: [expect.objectContaining({ at: "2027-06-03T04:00:00.000Z", attempt: 3 })] }));
    const saved = structuredClone(f.state()); await f.run(new Date("2027-06-02T05:00Z"));
    expect(f.state()).toEqual(saved); expect(f.store.commit).toHaveBeenCalledTimes(1); expect(f.stripe.invoices.pay).not.toHaveBeenCalled();
  });
  it.each([undefined, null, [null]])("rejects missing or malformed durable attempt history %s", async snapshots => {
    const f = jobFixture("retry"); f.job.accounting_snapshots = snapshots as unknown as Record<string, unknown>[];
    await expect(f.run()).rejects.toThrow(/attempt history/);
    expect(f.store.commit).not.toHaveBeenCalled(); expect(f.store.finishJob).not.toHaveBeenCalled(); expect(f.stripe.invoices.pay).not.toHaveBeenCalled();
  });
  it.each(["invoice", "attempt", "key", "status"])("rejects a decline receipt with mismatched %s", async field => {
    const f = jobFixture("retry");
    const receipt = { operation: "retry_declined", invoiceId: "in_a", attempt: 2, idempotencyKey: f.job.id, statusCode: 402 };
    if (field === "invoice") receipt.invoiceId = "in_other";
    if (field === "attempt") receipt.attempt = 3;
    if (field === "key") receipt.idempotencyKey = "other-job";
    if (field === "status") receipt.statusCode = 500;
    f.job.accounting_snapshots.push({ operation: "retry", invoiceId: "in_a", attempt: 2, idempotencyKey: f.job.id }, receipt);
    await expect(f.run(new Date("2027-06-02T04:06Z"))).rejects.toThrow(/receipt binding/);
    expect(f.store.commit).not.toHaveBeenCalled(); expect(f.store.finishJob).not.toHaveBeenCalled(); expect(f.stripe.invoices.pay).not.toHaveBeenCalled();
  });
  it("retains an unknown attempt when saving its definitive decline receipt fails", async () => {
    const f = jobFixture("retry"); const snapshot = f.store.snapshotJob.getMockImplementation()!;
    f.store.snapshotJob.mockImplementation(async (...args) => { if (args[2].operation === "retry_declined") throw new Error("receipt write failed"); await snapshot(...args); });
    f.stripe.invoices.pay.mockRejectedValueOnce(Object.assign(new Error("declined"), { statusCode: 402 }));
    await expect(f.run()).rejects.toThrow(/receipt write/);
    await expect(f.run(new Date("2027-06-02T04:06Z"))).rejects.toThrow(/Manual retry outcome unresolved/);
    expect(f.state().invoices.in_a.failedAttempts).toBe(1); expect(f.store.commit).not.toHaveBeenCalled(); expect(f.store.finishJob).not.toHaveBeenCalled();
    expect(f.job.accounting_snapshots).toHaveLength(1); expect(f.stripe.invoices.pay).toHaveBeenCalledTimes(1);
  });
  it("recovers a decline receipt whose write succeeded but acknowledgement was lost", async () => {
    const f = jobFixture("retry"); const snapshot = f.store.snapshotJob.getMockImplementation()!;
    f.store.snapshotJob.mockImplementation(async (...args) => { await snapshot(...args); if (args[2].operation === "retry_declined") throw new Error("receipt acknowledgement lost"); });
    f.stripe.invoices.pay.mockRejectedValueOnce(Object.assign(new Error("declined"), { statusCode: 402 }));
    await expect(f.run()).rejects.toThrow(/acknowledgement/);
    await f.run(new Date("2027-06-02T04:06Z"));
    expect(f.state().invoices.in_a).toMatchObject({ failedAttempts: 2, firstFailureAt: "2027-06-01T04:00:00.000Z" });
    expect(f.job.accounting_snapshots).toHaveLength(2); expect(f.stripe.invoices.pay).toHaveBeenCalledTimes(1); expect(f.store.finishJob).toHaveBeenCalledTimes(1);
  });
  it("treats a legacy pre-call snapshot without an idempotency field as unresolved", async () => {
    const f = jobFixture("retry"); f.job.accounting_snapshots.push({ operation: "retry", invoiceId: "in_a", attempt: 2 });
    await expect(f.run(new Date("2027-06-02T04:06Z"))).rejects.toThrow(/Manual retry outcome unresolved/);
    expect(f.store.finishJob).not.toHaveBeenCalled(); expect(f.stripe.invoices.pay).not.toHaveBeenCalled();
  });
  it("archives accounting before voiding unpaid invoices and deleting pending items", async () => {
    const f = jobFixture("cutoff");
    f.stripe.invoices.list.mockResolvedValue({ has_more: false, data: [f.invoice] } as never);
    f.stripe.invoiceItems.list.mockResolvedValue({ has_more: false, data: [{ id: "ii_a", livemode: false, customer: "cus_a", invoice: null, amount: 499, currency: "usd", period: { start: 1, end: 2 }, parent: { subscription_details: { subscription: "sub_a" } } }] } as never);
    await f.run(); expect(f.stripe.subscriptionSchedules.cancel).toHaveBeenCalledWith("sub_sched_a", { invoice_now: false, prorate: false }, expect.any(Object));
    expect(f.stripe.invoices.voidInvoice).toHaveBeenCalled(); expect(f.stripe.invoiceItems.del).toHaveBeenCalled();
    expect(f.store.snapshotJob.mock.invocationCallOrder[1]).toBeLessThan(f.stripe.invoices.voidInvoice.mock.invocationCallOrder[0]);
  });
  it("refuses foreign cleanup inventory and does not delete paid invoices", async () => {
    const f = jobFixture("cutoff"); f.invoice.customer = "victim";
    f.stripe.invoices.list.mockResolvedValue({ has_more: false, data: [f.invoice] } as never); await expect(f.run()).rejects.toThrow(/Foreign/); expect(f.stripe.invoices.voidInvoice).not.toHaveBeenCalled();
  });
});

describe("monthly RPC adapter", () => {
  it("passes only derived purchase grants/retries and propagates atomic-write errors", async () => {
    const f = fixture(); const rpc = vi.fn().mockResolvedValue({ data: null, error: null }); const store = monthlyBillingStore({ rpc });
    await store.commit("sub_a", "evt_a", "lease", f.state(), start);
    expect(rpc).toHaveBeenCalledWith("commit_in_season_sandbox_monthly", expect.objectContaining({ p_subscription_id: "sub_a", p_token: "lease", p_grants: [], p_retries: [] }));
    rpc.mockResolvedValueOnce({ data: null, error: new Error("conflict") }); await expect(store.commit("sub_a", "evt_a", "lease", f.state(), start)).rejects.toThrow(/conflict/);
  });
});
