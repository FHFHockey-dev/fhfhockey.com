import { describe, expect, it } from "vitest";
import { resolveInSeasonAccess, type InSeasonGrant } from "./access";
import { IN_SEASON_COMMERCE, canStartInSeasonPurchase, capInSeasonPurchasedCoverage, seasonPassCoverage, monthlyFailureWindow, isMonthlyFailureGraceActive, purchasedCoverageAfterCancellation, previewInitialMonthlyCharge, calendarDayProrationCents, monthlySignupQuote } from "./commerce";

const cutoff = new Date("2027-07-01T04:00:00.000Z");
const before = new Date(cutoff.getTime() - 1);
const after = new Date(cutoff.getTime() + 1);

const purchasedGrant = (activation: Date): InSeasonGrant => ({
  source: "purchase", reference: "verified-purchase", status: "active",
  ...seasonPassCoverage(activation),
});

describe("in-season commerce contract", () => {
  it("keeps the settled season and monthly prices separate", () => {
    expect(IN_SEASON_COMMERCE.plans).toEqual({
      season_pass: { amountCents: 2499, cadence: "one_time" },
      monthly: { amountCents: 499, cadence: "monthly" },
    });
    expect(IN_SEASON_COMMERCE.currency).toBe("usd");
  });

  it("uses midnight Eastern as the exclusive access and billing end", () => {
    expect(new Date("2027-07-01T00:00:00-04:00").toISOString()).toBe(IN_SEASON_COMMERCE.accessEndsAt);
    expect(IN_SEASON_COMMERCE.timeZone).toBe("America/New_York");
    expect(IN_SEASON_COMMERCE.monthlyBilling.stopsAt).toBe(cutoff.toISOString());
    expect(IN_SEASON_COMMERCE.monthlyBilling.julyChargesAllowed).toBe(false);
    expect(IN_SEASON_COMMERCE.monthlyBilling.offseasonRenewalAllowed).toBe(false);
  });

  it.each([
    [before, true], [cutoff, false], [after, false], [new Date(NaN), false],
  ])("allows a proposed purchase at %s only before the cutoff", (instant, allowed) => {
    expect(canStartInSeasonPurchase(instant)).toBe(allowed);
  });

  it("records the approved policies without inventing automatic refunds", () => {
    expect(IN_SEASON_COMMERCE.monthlyBilling.refunds).toMatchObject({ review: "manual", cancellationCreatesRefund: false });
    expect(IN_SEASON_COMMERCE.monthlyBilling.seasonEnd).toMatchObject({ collection: "stop", unpaidInvoices: "void", pendingCharges: "clear", accountingHistory: "retain", latePaymentAccess: "never_reopen" });
  });

  it("preserves supplied shorter coverage without selecting a monthly period", () => {
    const activation = new Date("2027-05-12T16:00:00Z");
    const end = new Date("2027-06-12T16:00:00Z");
    expect(capInSeasonPurchasedCoverage(activation, end)).toEqual({
      effectiveFrom: activation.toISOString(), effectiveTo: end.toISOString(),
    });
    expect(activation.toISOString()).toBe("2027-05-12T16:00:00.000Z");
    expect(end.toISOString()).toBe("2027-06-12T16:00:00.000Z");
  });

  it("caps overlong supplied coverage at the season end", () => {
    expect(capInSeasonPurchasedCoverage(before, new Date("2027-08-01T04:00:00Z"))).toEqual({
      effectiveFrom: before.toISOString(), effectiveTo: cutoff.toISOString(),
    });
  });

  it.each([cutoff, after, new Date(NaN)])("rejects activation at %s", (activation) => {
    expect(() => seasonPassCoverage(activation)).toThrow("Activation must precede");
  });

  it.each([before, new Date(before.getTime() - 1), new Date(NaN)])("rejects empty, reversed or invalid coverage ending at %s", (end) => {
    expect(() => capInSeasonPurchasedCoverage(before, end)).toThrow("Purchased coverage must end after activation");
  });

  it("expires paid coverage exactly at the cutoff through the existing resolver", () => {
    const grant = purchasedGrant(new Date("2026-10-11T12:00:00Z"));
    expect(resolveInSeasonAccess([grant], before).eligible).toBe(true);
    expect(resolveInSeasonAccess([grant], cutoff).eligible).toBe(false);
    expect(resolveInSeasonAccess([grant], after).eligible).toBe(false);
  });

  it("preserves an independently verified grant when purchased coverage expires", () => {
    const purchase = purchasedGrant(new Date("2026-10-11T12:00:00Z"));
    const patron: InSeasonGrant = {
      source: "patreon", reference: "verified-membership", status: "active",
      effectiveFrom: "2027-06-30T00:00:00Z", effectiveTo: null, verifiedAt: cutoff.toISOString(),
    };
    expect(resolveInSeasonAccess([purchase, patron], cutoff).grantingSources).toEqual(["patreon"]);
  });
});

describe("settled monthly policy", () => {
  it("anchors on the first and charges the full June period", () => {
    expect(IN_SEASON_COMMERCE.monthlyBilling.anchorDayOfMonth).toBe(1);
    expect(IN_SEASON_COMMERCE.monthlyBilling.finalPeriod).toEqual({
      startsAt: new Date("2027-06-01T00:00:00-04:00").toISOString(),
      endsAt: new Date("2027-07-01T00:00:00-04:00").toISOString(), amountCents: 499,
    });
  });

  it.each([
    ["2027-03-13T12:00:00-05:00", "2027-03-14T13:00:00-04:00", "2027-03-15T13:00:00-04:00"],
    ["2026-10-31T12:00:00-04:00", "2026-11-01T11:00:00-05:00", "2026-11-02T11:00:00-05:00"],
  ])("uses elapsed 24/48 hours across DST from %s", (initial, retry24, retry48) => {
    const start = new Date(initial);
    const window = monthlyFailureWindow(start);
    expect(window.retryAt).toEqual([new Date(retry24).toISOString(), new Date(retry48).toISOString()]);
    expect(window.graceEndsAt).toBe(new Date(retry48).toISOString());
    expect(window.maxFailedAttempts).toBe(3);
    expect(isMonthlyFailureGraceActive(start, new Date(Date.parse(window.graceEndsAt) - 1), 2)).toBe(true);
    expect(isMonthlyFailureGraceActive(start, new Date(window.graceEndsAt), 2)).toBe(false);
    expect(isMonthlyFailureGraceActive(start, new Date(retry24), 3)).toBe(false);
  });

  it.each([0, -1, 1.5, NaN, 4])("rejects invalid or exhausted failure counts %s", (count) => {
    expect(isMonthlyFailureGraceActive(new Date("2027-06-01T04:00:00Z"), new Date("2027-06-02T04:00:00Z"), count)).toBe(false);
  });

  it("does not begin grace before the initial failure or at invalid observation times", () => {
    const initial = new Date("2027-06-01T04:00:00Z");
    expect(isMonthlyFailureGraceActive(initial, new Date(initial.getTime() - 1), 1)).toBe(false);
    expect(isMonthlyFailureGraceActive(initial, new Date(NaN), 1)).toBe(false);
  });

  it("withholds a retry exactly at cutoff and caps grace", () => {
    const initial = new Date("2027-06-29T00:00:00-04:00");
    expect(monthlyFailureWindow(initial)).toMatchObject({
      retryAt: ["2027-06-30T04:00:00.000Z"], graceEndsAt: cutoff.toISOString(),
    });
    expect(isMonthlyFailureGraceActive(initial, before, 2)).toBe(true);
    expect(isMonthlyFailureGraceActive(initial, cutoff, 2)).toBe(false);
    expect(isMonthlyFailureGraceActive(initial, after, 2)).toBe(false);
    expect(monthlyFailureWindow(new Date("2027-06-30T16:00:00Z")).retryAt).toEqual([]);
  });

  it.each([cutoff, after, new Date(NaN)])("rejects a failure starting at %s", (initial) => {
    expect(() => monthlyFailureWindow(initial)).toThrow("Initial failure must precede");
  });

  it("ends cancelled paid access immediately while preserving independent grants", () => {
    const activation = new Date("2027-06-01T04:00:00Z");
    const cancelledAt = new Date("2027-06-15T16:00:00Z");
    const coverage = purchasedCoverageAfterCancellation(activation, cutoff, cancelledAt)!;
    const purchase: InSeasonGrant = { source: "purchase", reference: "paid", status: "active", ...coverage };
    expect(resolveInSeasonAccess([purchase], new Date(cancelledAt.getTime() - 1)).eligible).toBe(true);
    expect(resolveInSeasonAccess([purchase], cancelledAt).eligible).toBe(false);
    const patron: InSeasonGrant = {
      source: "patreon", reference: "patron", status: "active",
      effectiveFrom: activation.toISOString(), effectiveTo: null, verifiedAt: cancelledAt.toISOString(),
    };
    expect(resolveInSeasonAccess([purchase, patron], cancelledAt).grantingSources).toEqual(["patreon"]);
    expect(purchasedCoverageAfterCancellation(activation, cutoff, activation)).toBeNull();
    expect(purchasedCoverageAfterCancellation(activation, cutoff, new Date(activation.getTime() - 1))).toBeNull();
    expect(purchasedCoverageAfterCancellation(activation, cutoff, after)?.effectiveTo).toBe(cutoff.toISOString());
    expect(() => purchasedCoverageAfterCancellation(activation, cutoff, new Date(NaN))).toThrow("Cancellation must be a valid instant");
  });
});

describe("approved initial monthly charge arithmetic", () => {
  it.each([[28, 15, 250], [29, 15, 258], [30, 15, 266], [31, 15, 274], [29, 29, 17]])("rounds %s-day month day %s exactly once", (days, day, cents) => {
    expect(calendarDayProrationCents(day, days)).toBe(cents);
  });
  it("handles leap-year February without changing the 2027 cutoff", () => {
    expect(previewInitialMonthlyCharge(new Date("2024-02-15T00:00:00-05:00"))).toMatchObject({ confirmedAmountCents: 258, proration: { daysInMonth: 29 } });
  });
  it("uses the approved October 21 amount", () => {
    expect(previewInitialMonthlyCharge(new Date("2026-10-21T22:00:00-04:00"))).toMatchObject({ confirmedAmountCents: 177, nextAnchorAt: "2026-11-01T04:00:00.000Z" });
  });
  it("requires verified account and settlement applicability, with no minimum default", () => {
    const minimum = { accountId: "sandbox", chargeCurrency: "usd", settlementCurrency: "cad", minimumChargeCents: 60, verificationReference: "approved-fixture-conversion" };
    const at = new Date("2026-10-28T04:00:00Z");
    expect(monthlySignupQuote(at, "sandbox", null).reason).toBe("minimum_not_verified");
    expect(monthlySignupQuote(at, "other", minimum).reason).toBe("minimum_not_verified");
    expect(monthlySignupQuote(at, "sandbox", { ...minimum, settlementCurrency: "" }).reason).toBe("minimum_not_verified");
    expect(monthlySignupQuote(at, "sandbox", { ...minimum, verificationReference: "" }).reason).toBe("minimum_not_verified");
    expect(monthlySignupQuote(at, "sandbox", minimum)).toMatchObject({ available: true, charge: { confirmedAmountCents: 64 } });
    expect(monthlySignupQuote(at, "sandbox", { ...minimum, minimumChargeCents: 65 })).toMatchObject({ available: false, reason: "below_verified_minimum", charge: { confirmedAmountCents: 64 } });
    expect(monthlySignupQuote(new Date("2027-06-30T04:00:00Z"), "sandbox", minimum)).toMatchObject({ available: false, reason: "below_verified_minimum", charge: { confirmedAmountCents: 17 } });
  });
  it("switches at Eastern midnight from the fourteenth to the fifteenth", () => {
    expect(previewInitialMonthlyCharge(new Date("2027-03-14T23:59:59.999-04:00"))).toMatchObject({
      treatment: "full", confirmedAmountCents: 499, proration: null,
    });
    expect(previewInitialMonthlyCharge(new Date("2027-03-15T00:00:00-04:00"))).toMatchObject({
      treatment: "prorated", confirmedAmountCents: 274,
      proration: { status: "approved", remainingCalendarDays: 17, daysInMonth: 31, amountCents: 274 },
    });
  });

  it.each([
    ["2027-02-15T00:00:00-05:00", "2027-03-01T05:00:00.000Z", 28, 14, 250],
    ["2027-04-15T00:00:00-04:00", "2027-05-01T04:00:00.000Z", 30, 16, 266],
    ["2027-03-15T00:00:00-04:00", "2027-04-01T04:00:00.000Z", 31, 17, 274],
    ["2026-10-31T23:59:59-04:00", "2026-11-01T04:00:00.000Z", 31, 1, 16],
    ["2026-11-15T00:00:00-05:00", "2026-12-01T05:00:00.000Z", 30, 16, 266],
    ["2027-06-30T23:59:59.999-04:00", "2027-07-01T04:00:00.000Z", 30, 1, 17],
  ])("calculates approved calendar-day proration for %s", (signup, anchor, days, remaining, cents) => {
    expect(previewInitialMonthlyCharge(new Date(signup))).toEqual({
      treatment: "prorated", nextAnchorAt: anchor, confirmedAmountCents: cents,
      proration: { status: "approved", basis: "inclusive_signup_calendar_day",
        remainingCalendarDays: remaining, daysInMonth: days, rounding: "nearest_cent_half_up", amountCents: cents },
    });
  });

  it.each([
    ["2027-03-01T00:00:00-05:00", "2027-04-01T04:00:00.000Z"],
    ["2026-11-01T00:00:00-04:00", "2026-12-01T05:00:00.000Z"],
    ["2027-06-01T00:00:00-04:00", "2027-07-01T04:00:00.000Z"],
  ])("keeps the first full charge and next Eastern calendar anchor for %s", (signup, anchor) => {
    expect(previewInitialMonthlyCharge(new Date(signup))).toMatchObject({ treatment: "full", confirmedAmountCents: 499, nextAnchorAt: anchor });
  });

  it.each([cutoff, after, new Date(NaN)])("rejects signup at %s", (signup) => {
    expect(() => previewInitialMonthlyCharge(signup)).toThrow("Activation must precede");
  });
});

describe("grant event order, duplicates and reactivation", () => {
  const purchase = (reference: string, from: string, to: string, status = "active"): InSeasonGrant => ({
    source: "purchase", reference, status, effectiveFrom: from, effectiveTo: to,
  });
  const marchStart = new Date("2027-03-01T00:00:00-05:00");
  const aprilStart = new Date("2027-04-01T00:00:00-04:00");
  const march = purchase("pi_march", ...Object.values(capInSeasonPurchasedCoverage(marchStart, aprilStart)) as [string, string]);
  const may = purchase("pi_may", "2027-05-01T04:00:00.000Z", "2027-06-01T04:00:00.000Z");

  it("resolves the same access whatever order the grants arrive in", () => {
    const grants = [
      march,
      purchase("pi_revoked", "2027-03-01T05:00:00.000Z", "2027-07-01T04:00:00.000Z", "revoked"),
      purchase("pi_future", "2027-03-20T04:00:00.000Z", "2027-04-20T04:00:00.000Z"),
      { source: "grandfather", reference: "first-100:7", status: "active", effectiveFrom: "2026-09-01T04:00:00.000Z", effectiveTo: cutoff.toISOString() } as InSeasonGrant,
    ];
    const now = new Date("2027-03-15T16:00:00Z");
    // grantingSources lists sources in input order; the reader orders rows by id.
    const normalized = (access: ReturnType<typeof resolveInSeasonAccess>) => ({ ...access, grantingSources: [...access.grantingSources].sort() });
    const expected = normalized(resolveInSeasonAccess(grants, now));
    for (const order of [[3, 2, 1, 0], [1, 3, 0, 2], [2, 0, 3, 1]]) {
      expect(normalized(resolveInSeasonAccess(order.map((index) => grants[index]), now))).toEqual(expected);
    }
    expect(expected).toMatchObject({ eligible: true, grantingSources: ["grandfather", "purchase"], expiresAt: cutoff.toISOString() });
  });

  it("counts a replayed duplicate grant once", () => {
    const now = new Date("2027-03-15T16:00:00Z");
    expect(resolveInSeasonAccess([march, { ...march }], now)).toEqual(resolveInSeasonAccess([march], now));
  });

  it("ends monthly coverage exactly at the Eastern first across the March DST change", () => {
    expect(march.effectiveTo).toBe("2027-04-01T04:00:00.000Z");
    expect(resolveInSeasonAccess([march], new Date(aprilStart.getTime() - 1)).eligible).toBe(true);
    expect(resolveInSeasonAccess([march], aprilStart)).toMatchObject({ eligible: false, reason: "expired" });
  });

  it("reports a lapse between periods and reactivates on the next verified grant", () => {
    const gap = new Date("2027-04-15T16:00:00Z");
    expect(resolveInSeasonAccess([march, may], gap)).toMatchObject({ eligible: false, reason: "expired", capabilities: [] });
    expect(resolveInSeasonAccess([march, may], new Date(may.effectiveFrom!))).toMatchObject({
      eligible: true, grantingSources: ["purchase"], expiresAt: may.effectiveTo,
    });
  });

  it("grants nothing for missing, pending, past-due or blank-reference entitlements", () => {
    const now = new Date("2027-03-15T16:00:00Z");
    expect(resolveInSeasonAccess([], now)).toEqual({
      eligible: false, capabilities: [], grantingSources: [], expiresAt: null, reason: "no_active_grant",
    });
    for (const grant of [{ ...march, status: "pending" }, { ...march, status: "past_due" }, { ...march, reference: "  " }]) {
      expect(resolveInSeasonAccess([grant], now).eligible, JSON.stringify(grant)).toBe(false);
    }
  });
});
