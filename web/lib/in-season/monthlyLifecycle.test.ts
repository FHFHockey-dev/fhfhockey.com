import { describe, expect, it } from "vitest";
import { IN_SEASON_SANDBOX_CATALOG as catalog } from "./billingConfig";
import { acceptMonthlyCancellation, buildSettledMonthlyPlan, createMonthlyState, monthlyAccess, monthlyPurchaseGrants, monthlyRetryIntents, reduceMonthlyEvent, type MonthlyBinding, type MonthlyEvent, type MonthlyState } from "./monthlyLifecycle";
import { monthlyStopCommands } from "./monthlyStripe";
import type { InSeasonGrant } from "./access";

const minimum = { accountId: catalog.accountId, chargeCurrency: "usd", settlementCurrency: "usd", minimumChargeCents: 50, verificationReference: "fixture-verified-only" };
const now = new Date("2027-06-20T12:00:00Z");
function fixture(startsAt = "2027-05-01T04:00:00Z") {
  const identity = { userId: "u1", customerId: "cus_1", attemptId: "a1" };
  const plan = buildSettledMonthlyPlan({ ...identity, startsAt: new Date(startsAt), verifiedMinimum: minimum });
  const binding: MonthlyBinding = { ...identity, subscriptionId: "sub_1", periods: plan.periods, verifiedMinimum: minimum };
  return { plan, binding, state: createMonthlyState(binding) };
}
function paid(period = 0, paidAt = period ? "2027-06-01T04:00:00.000Z" : "2027-05-01T04:00:00.000Z"): MonthlyEvent {
  return { kind: "paid", eventId: `evt_paid_${period}`, userId: "u1", subscriptionId: "sub_1", invoiceId: `in_${period}`, period, paymentIntentId: `pi_${period}`, paidAt };
}
function failed(count = 1, first: string | null = "2027-06-01T04:00:00.000Z"): MonthlyEvent {
  return { kind: "failed", eventId: `evt_failed_${count}`, userId: "u1", subscriptionId: "sub_1", invoiceId: "in_1", period: 1, failedAttempts: count, firstFailureAt: first };
}
const apply = (state: MonthlyState, event: MonthlyEvent, observed = now) => reduceMonthlyEvent(state, event, observed);
const refund = (status: "pending" | "failed" | "succeeded", amount = 499, period = 0): Extract<MonthlyEvent, { kind: "refund" }> => ({ kind: "refund", eventId: `evt_refund_${status}_${amount}`, userId: "u1", subscriptionId: "sub_1", invoiceId: `in_${period}`, period, paymentIntentId: `pi_${period}`, refundId: "re_1", amountCents: amount, status, observedAt: `2027-06-0${status === "pending" ? 1 : status === "succeeded" ? 2 : 3}T12:00:00.000Z` });
const dispute = (status: "open" | "won" | "lost", period = 0): MonthlyEvent => ({ kind: "dispute", eventId: `evt_dispute_${status}`, userId: "u1", subscriptionId: "sub_1", invoiceId: `in_${period}`, period, paymentIntentId: `pi_${period}`, disputeId: "dp_1", openedAt: "2027-06-02T04:00:00.000Z", status });
const independent: InSeasonGrant[] = [{ source: "grandfather", reference: "existing", status: "active", effectiveFrom: "2026-09-01T04:00:00Z", effectiveTo: "2027-07-01T04:00:00Z" }];

describe("monthly plan and boundary", () => {
  it("pins cancellation before payment and excludes July renewal", () => {
    const { plan } = fixture("2026-10-21T12:00:00Z");
    expect(plan.periods[0]).toEqual({ from: "2026-10-21T12:00:00.000Z", to: "2026-11-01T04:00:00.000Z", amountCents: 177 });
    expect(plan.periods[1].to).toBe("2026-12-01T05:00:00.000Z");
    expect(plan.periods.find((period) => period.from === "2027-03-01T05:00:00.000Z")?.to).toBe("2027-04-01T04:00:00.000Z");
    expect(plan.periods.at(-1)).toEqual({ from: "2027-06-01T04:00:00.000Z", to: "2027-07-01T04:00:00.000Z", amountCents: 499 });
    expect(plan.requiredSubscriptionCreationFields.cancel_at).toBe(Date.parse("2027-07-01T04:00Z") / 1000);
    expect(plan.periods.every((period) => Date.parse(period.from) < Date.parse("2027-07-01T04:00Z"))).toBe(true);
  });
  it("blocks unknown minimum and too-small charges without rounding or carryover", () => {
    const input = { userId: "u", attemptId: "a", customerId: "cus", startsAt: new Date("2027-06-30T04:00Z") };
    expect(() => buildSettledMonthlyPlan({ ...input, verifiedMinimum: null })).toThrow(/minimum/);
    expect(() => buildSettledMonthlyPlan({ ...input, verifiedMinimum: minimum })).toThrow(/No amount will be rounded up or carried forward/);
  });
  it("refuses altered stored coverage", () => { const { binding } = fixture(); binding.periods[1].to = "2027-08-01T04:00:00Z"; expect(() => createMonthlyState(binding)).toThrow(); });
});

describe("monthly payment ledger", () => {
  it("counts distinct confirmed failures without extending grace on duplicate or late identities", () => {
    let state = apply(fixture().state, paid());
    const failure = (id: string, eventId: string, firstFailureAt: string | null): MonthlyEvent => ({ kind: "failed", eventId, userId: "u1", subscriptionId: "sub_1", invoiceId: "in_1", period: 1, failureId: id, firstFailureAt });
    state = apply(state, failure("invoice:in_1:initial", "initial", "2027-06-01T04:00:00.000Z"));
    state = apply(state, failure("in-season-monthly-retry:in_1:3", "slot-three", null));
    state = apply(state, failure("in-season-monthly-retry:in_1:3", "duplicate-delivery", null));
    state = apply(state, failure("invoice:in_1:initial", "late-initial", "2027-06-02T04:00:00.000Z"));
    expect(state.invoices.in_1).toMatchObject({ failedAttempts: 2, firstFailureAt: "2027-06-01T04:00:00.000Z" });
    expect(monthlyAccess(state, new Date("2027-06-03T03:59:59Z")).eligible).toBe(true);
    expect(monthlyAccess(state, new Date("2027-06-03T04:00:00Z")).eligible).toBe(false);
    state = apply(state, failure("in-season-monthly-retry:in_1:2", "late-slot-two-receipt", null));
    expect(state.invoices.in_1.failedAttempts).toBe(3);
    expect(monthlyRetryIntents(state, new Date("2027-06-02T04:00Z"))).toEqual([]);
    expect(monthlyAccess(state, new Date("2027-07-01T04:00:00Z")).eligible).toBe(false);
  });
  it("keeps refund snapshot sequence authoritative across stale timestamps and legacy snapshots", () => {
    let state = apply(fixture().state, paid());
    state = apply(state, { ...refund("pending"), observedVersion: state.version + 1 });
    const oldVersion = state.invoices.in_0.refunds.re_1.observedVersion!;
    state = apply(state, { ...refund("succeeded"), observedAt: "2027-06-01T11:00:00.000Z", observedVersion: state.version + 1 });
    state = apply(state, { ...refund("pending"), eventId: "stale-read", observedAt: "2027-06-04T12:00:00.000Z", observedVersion: oldVersion });
    expect(state.invoices.in_0.refunds.re_1.status).toBe("succeeded");
    expect(() => apply(state, { ...refund("failed"), eventId: "unordered-new-read" })).toThrow(/Ordered/);
    state = apply(state, { ...refund("failed"), observedAt: "2027-06-01T10:00:00.000Z", observedVersion: state.version + 1 });
    expect(state.invoices.in_0.refunds.re_1.status).toBe("failed");
  });
  it("is idempotent and rejects changed replay facts", () => {
    const first = apply(fixture().state, paid());
    expect(apply(first, paid())).toBe(first);
    expect(() => apply(first, { ...paid(), userId: "other" })).toThrow();
    expect(() => apply(first, { ...paid(), kind: "paid", invoiceId: "in_0", period: 0, paymentIntentId: "pi_other", paidAt: "2027-05-01T04:00:00Z" })).toThrow();
  });
  it("produces the same grants for paid/failure arrival permutations", () => {
    const events = [paid(), failed(), failed(2), paid(1, "2027-06-02T04:00:00.000Z")];
    const grants = (order: number[]) => monthlyPurchaseGrants(order.reduce((state, index) => apply(state, events[index]), fixture().state)).sort((a, b) => a.reference.localeCompare(b.reference));
    expect(grants([3, 2, 1, 0])).toEqual(grants([0, 1, 2, 3]));
    expect(grants([1, 0, 3, 2])).toEqual(grants([0, 1, 2, 3]));
  });
  it("ends access immediately on cancellation despite later/out-of-order payment events", () => {
    let state = acceptMonthlyCancellation(fixture().state, "u1", "request", new Date("2027-05-15T04:00Z"));
    state = apply(apply(state, paid(1)), paid());
    expect(monthlyAccess(state, new Date("2027-05-15T04:00Z")).eligible).toBe(false);
    expect(monthlyAccess(state, now, independent).grantingSources).toEqual(["grandfather"]);
    expect(() => acceptMonthlyCancellation(state, "other", "forged", now)).toThrow();
    expect(monthlyRetryIntents(state, now)).toEqual([]);
    expect(acceptMonthlyCancellation(state, "u1", "request", now)).toBe(state);
  });
  it("retains late payment history without reopening expired access", () => {
    const late = new Date("2027-07-01T05:00Z");
    const state = apply(fixture().state, paid(1, late.toISOString()), late);
    expect(state.invoices.in_1.paidAt).toBe(late.toISOString());
    expect(monthlyAccess(state, late).eligible).toBe(false);
  });
  it("rejects invoice/period/payment rebinding", () => {
    const state = apply(fixture().state, paid());
    expect(() => apply(state, { ...paid(1), kind: "paid", invoiceId: "in_0", period: 1, paymentIntentId: "pi_1", paidAt: "2027-06-01T04:00Z" })).toThrow();
    expect(() => apply(state, { ...paid(1), kind: "paid", invoiceId: "in_1", period: 1, paymentIntentId: "pi_0", paidAt: "2027-06-01T04:00Z" })).toThrow();
    expect(() => apply(state, { ...paid(), eventId: "other", kind: "paid", invoiceId: "another", period: 0, paymentIntentId: "pi_other", paidAt: "2027-05-02T04:00Z" })).toThrow();
  });
});

describe("bounded renewal grace", () => {
  it("requires prior payment and the original first failure; later events cannot restart grace", () => {
    const first = apply(fixture().state, failed());
    expect(monthlyAccess(first, new Date("2027-06-01T05:00Z")).eligible).toBe(false);
    const missingFirst = apply(apply(fixture().state, paid()), failed(2, null));
    expect(monthlyAccess(missingFirst, new Date("2027-06-02T05:00Z")).eligible).toBe(false);
    const state = apply(missingFirst, failed());
    expect(monthlyAccess(state, new Date("2027-06-03T03:59:59Z")).eligible).toBe(true);
    expect(monthlyAccess(state, new Date("2027-06-03T04:00Z")).eligible).toBe(false);
    expect(monthlyAccess(apply(state, failed(3)), new Date("2027-06-02T05:00Z")).eligible).toBe(false);
  });
  it("creates at most the +24/+48 retry intents and never catches up after cutoff", () => {
    const state = apply(apply(fixture().state, paid()), failed());
    expect(monthlyRetryIntents(state, new Date("2027-06-01T04:00Z")).map((retry) => [retry.at, retry.attempt])).toEqual([["2027-06-02T04:00:00.000Z", 2], ["2027-06-03T04:00:00.000Z", 3]]);
    expect(monthlyRetryIntents(state, new Date("2027-06-03T04:00:00.001Z"))).toEqual([]);
    expect(monthlyRetryIntents(state, new Date("2027-07-01T04:00Z"))).toEqual([]);
    expect(monthlyRetryIntents(apply(state, paid(1)), now)).toEqual([]);
  });
  it("caps June-end grace and suppresses a retry at July 1", () => {
    const state = apply(apply(fixture().state, paid()), failed(1, "2027-06-29T04:00:00.000Z"), new Date("2027-06-30T04:00Z"));
    expect(monthlyRetryIntents(state, new Date("2027-06-29T04:00Z")).map((retry) => retry.at)).toEqual(["2027-06-30T04:00:00.000Z"]);
    expect(monthlyAccess(state, new Date("2027-07-01T04:00Z")).eligible).toBe(false);
  });
});

describe("payment-specific refunds and disputes", () => {
  it.each(["pending", "failed"] as const)("does not revoke on a %s refund", (status) => { const state = apply(apply(fixture().state, paid(1)), refund(status, 499, 1)); expect(monthlyAccess(state, now).eligible).toBe(true); });
  it("retains partial-refund coverage and revokes only the fully refunded payment", () => {
    let state = apply(apply(fixture().state, paid()), paid(1));
    state = apply(state, refund("succeeded", 100, 1));
    expect(monthlyAccess(state, now).eligible).toBe(true);
    state = apply(state, { ...refund("succeeded", 399, 1), kind: "refund", refundId: "re_2", invoiceId: "in_1", period: 1, paymentIntentId: "pi_1", amountCents: 399, status: "succeeded" });
    expect(monthlyAccess(state, now).eligible).toBe(false);
    expect(monthlyAccess(state, now, independent).eligible).toBe(true);
  });
  it("an old period refund cannot revoke a later paid period, even delivered before payment", () => {
    const state = [refund("succeeded"), paid(1), paid(), refund("pending")].reduce((current, event) => apply(current, event), fixture().state);
    expect(monthlyAccess(state, now).eligible).toBe(true);
    expect(monthlyPurchaseGrants(state).map((grant) => grant.reference)).toEqual(["stripe:sandbox:monthly:in_1"]);
  });
  it("restores only original coverage if a successful refund later fails, ignoring older snapshots", () => {
    const paidState = apply(fixture().state, paid(1));
    const refunded = apply(paidState, refund("succeeded", 499, 1));
    expect(monthlyAccess(refunded, now).eligible).toBe(false);
    const failedRefund = apply(refunded, refund("failed", 499, 1));
    expect(monthlyAccess(failedRefund, now).eligible).toBe(true);
    const outOfOrder = apply(apply(paidState, refund("failed", 499, 1)), refund("succeeded", 499, 1));
    expect(monthlyPurchaseGrants(outOfOrder)).toEqual(monthlyPurchaseGrants(failedRefund));
    expect(monthlyAccess(failedRefund, new Date("2027-07-01T04:00Z")).eligible).toBe(false);
  });
  it("suspends only the disputed payment, restores a win, and never restarts future billing", () => {
    const open = apply(apply(fixture().state, paid(1)), dispute("open", 1));
    expect(monthlyAccess(open, now).eligible).toBe(false);
    const won = apply(open, dispute("won", 1));
    expect(monthlyAccess(won, now).eligible).toBe(true);
    expect(monthlyAccess(won, new Date("2027-07-01T04:00Z")).eligible).toBe(false);
    expect(monthlyRetryIntents(won, now)).toEqual([]);
    expect(monthlyStopCommands(won, now, { invoices: [], pendingItems: [] })).toHaveLength(1);
    expect(monthlyAccess(apply(won, { ...dispute("open", 1), eventId: "late_open" }), now).eligible).toBe(true);
  });
  it("does not restore a lost dispute or fully refunded payment on a dispute win", () => {
    const paidState = apply(fixture().state, paid(1));
    expect(monthlyAccess(apply(paidState, dispute("lost", 1)), now).eligible).toBe(false);
    expect(monthlyAccess(apply(apply(paidState, refund("succeeded", 499, 1)), dispute("won", 1)), now).eligible).toBe(false);
  });
  it("a win on an expired payment cannot restart a later unpaid grace period", () => {
    let state = apply(apply(fixture().state, paid()), failed());
    state = apply(state, dispute("open"));
    state = apply(state, dispute("won"));
    expect(monthlyAccess(state, new Date("2027-06-02T05:00Z")).eligible).toBe(false);
  });
});

describe("cutoff outbox", () => {
  const item = (id: string, status: string) => ({ id, status, customerId: "cus_1", subscriptionId: "sub_1" });
  it("stops billing and clears only owned unpaid/pending objects, preserving history", () => {
    const state = fixture().state;
    const inventory = { invoices: [item("in_open", "open"), item("in_paid", "paid"), item("in_draft", "draft")], pendingItems: [item("ii_pending", "pending")] };
    expect(monthlyStopCommands(state, now, inventory)).toEqual([]);
    const commands = monthlyStopCommands(state, new Date("2027-07-01T04:00Z"), inventory);
    expect(commands.map((command) => command.kind)).toEqual(["cancel_subscription", "void_invoice", "delete_draft_invoice", "delete_pending_invoice_item"]);
    expect(commands.every((command) => command.retainAccountingSnapshot)).toBe(true);
    expect(commands[0].cancellationParams).toEqual({ invoice_now: false, prorate: false });
    expect(commands).toEqual(monthlyStopCommands(state, new Date("2027-07-02T04:00Z"), inventory));
  });
  it("rejects cross-account cleanup and does not void old invoices on early cancellation", () => {
    const state = fixture().state;
    expect(() => monthlyStopCommands(state, new Date("2027-07-01T04:00Z"), { invoices: [{ ...item("in_foreign", "open"), customerId: "victim" }], pendingItems: [] })).toThrow();
    const cancelled = acceptMonthlyCancellation(state, "u1", "r1", now);
    expect(monthlyStopCommands(cancelled, now, { invoices: [item("in_open", "open")], pendingItems: [] }).map((command) => command.kind)).toEqual(["cancel_subscription"]);
  });
  it("requests cancellation after the third failed payment without refunding or voiding early", () => {
    const exhausted = apply(fixture().state, failed(3));
    expect(monthlyStopCommands(exhausted, now, { invoices: [item("in_1", "open")], pendingItems: [] }).map((command) => command.kind)).toEqual(["cancel_subscription"]);
  });
});
