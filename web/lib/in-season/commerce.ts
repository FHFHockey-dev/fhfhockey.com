export const IN_SEASON_COMMERCE = {
  season: "2026_27",
  currency: "usd",
  timeZone: "America/New_York",
  accessEndsAt: "2027-07-01T04:00:00.000Z",
  plans: {
    season_pass: { amountCents: 2499, cadence: "one_time" },
    monthly: { amountCents: 499, cadence: "monthly" },
  },
  monthlyBilling: {
    stopsAt: "2027-07-01T04:00:00.000Z",
    julyChargesAllowed: false,
    offseasonRenewalAllowed: false,
    anchorDayOfMonth: 1,
    finalPeriod: {
      startsAt: "2027-06-01T04:00:00.000Z",
      endsAt: "2027-07-01T04:00:00.000Z",
      amountCents: 499,
    },
    initialCharge: { fullChargeThroughDay: 14, proratedFromDay: 15 },
    cancellationAccess: "ends_immediately",
    failedPayment: { graceHours: 48, retryAfterHours: [24, 48], maxFailedAttempts: 3 },
    // null means undecided; adapters must obtain policy before implementing it.
    unresolvedPolicies: {
      prorationArithmetic: null,
      prorationRounding: null,
      refundTreatment: null,
      postCutoffCollection: null,
    },
  },
} as const;

const seasonEnd = Date.parse(IN_SEASON_COMMERCE.accessEndsAt);

/** Validates an instant only; does not choose billing dates or authorize payment. */
export function canStartInSeasonPurchase(activation: Date): boolean {
  const instant = activation.getTime();
  return Number.isFinite(instant) && instant < seasonEnd;
}

/**
 * Bounds supplied purchased coverage. The caller must establish its start/end
 * from verified payment and approved policy; this does not grant access.
 */
export function capInSeasonPurchasedCoverage(activation: Date, suppliedEnd: Date) {
  const start = activation.getTime();
  const end = suppliedEnd.getTime();
  if (!canStartInSeasonPurchase(activation)) throw new Error("Activation must precede the in-season cutoff.");
  if (!Number.isFinite(end) || end <= start) throw new Error("Purchased coverage must end after activation.");
  return {
    effectiveFrom: new Date(start).toISOString(),
    effectiveTo: new Date(Math.min(end, seasonEnd)).toISOString(),
  };
}

/** The approved season-pass window; monthly coverage must be supplied separately. */
export function seasonPassCoverage(activation: Date) {
  return capInSeasonPurchasedCoverage(activation, new Date(seasonEnd));
}

/** Elapsed-hour retry intent only; never schedules or collects a payment. */
export function monthlyFailureWindow(initialFailure: Date) {
  if (!canStartInSeasonPurchase(initialFailure)) throw new Error("Initial failure must precede the in-season cutoff.");
  const start = initialFailure.getTime();
  const policy = IN_SEASON_COMMERCE.monthlyBilling.failedPayment;
  return {
    graceEndsAt: new Date(Math.min(start + policy.graceHours * 60 * 60 * 1000, seasonEnd)).toISOString(),
    retryAt: policy.retryAfterHours
      .map((hours) => start + hours * 60 * 60 * 1000)
      .filter((instant) => instant < seasonEnd)
      .map((instant) => new Date(instant).toISOString()),
    maxFailedAttempts: policy.maxFailedAttempts,
  };
}

/** Evaluates only the failed-payment grace window, not independent access grants. */
export function isMonthlyFailureGraceActive(initialFailure: Date, now: Date, failedAttempts: number): boolean {
  const window = monthlyFailureWindow(initialFailure);
  return Number.isInteger(failedAttempts) && failedAttempts >= 1 && failedAttempts < window.maxFailedAttempts
    && now.getTime() >= initialFailure.getTime() && now.getTime() < Date.parse(window.graceEndsAt);
}

/** Bounds only the cancelled purchase; null means no remaining paid coverage. */
export function purchasedCoverageAfterCancellation(activation: Date, suppliedEnd: Date, cancelledAt: Date) {
  const coverage = capInSeasonPurchasedCoverage(activation, suppliedEnd);
  const cancellation = cancelledAt.getTime();
  if (!Number.isFinite(cancellation)) throw new Error("Cancellation must be a valid instant.");
  if (cancellation <= activation.getTime()) return null;
  return capInSeasonPurchasedCoverage(activation, new Date(Math.min(cancellation, Date.parse(coverage.effectiveTo))));
}

const easternDate = new Intl.DateTimeFormat("en-US", {
  timeZone: IN_SEASON_COMMERCE.timeZone, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", hourCycle: "h23",
});

/** Classifies the approved threshold; prorated amounts remain a proposal only. */
export function previewInitialMonthlyCharge(activation: Date) {
  if (!canStartInSeasonPurchase(activation)) throw new Error("Activation must precede the in-season cutoff.");
  const parts = easternDate.formatToParts(activation);
  const part = (name: string) => Number(parts.find((value) => value.type === name)!.value);
  const year = part("year");
  const month = part("month");
  const day = part("day");
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // At 05:00 UTC the first is 00:00 EST or 01:00 EDT. Neither is a DST transition hour.
  const nextFirst = new Date(Date.UTC(year, month, 1, 5));
  const easternHour = Number(easternDate.formatToParts(nextFirst).find((value) => value.type === "hour")!.value);
  nextFirst.setTime(nextFirst.getTime() - easternHour * 60 * 60 * 1000);
  const nextAnchorAt = new Date(Math.min(nextFirst.getTime(), seasonEnd)).toISOString();
  const treatment = day <= IN_SEASON_COMMERCE.monthlyBilling.initialCharge.fullChargeThroughDay ? "full" : "prorated";
  const remainingCalendarDays = daysInMonth - day + 1;
  return {
    treatment,
    nextAnchorAt,
    confirmedAmountCents: treatment === "full" ? IN_SEASON_COMMERCE.plans.monthly.amountCents : null,
    proposedProration: treatment === "prorated" ? {
      status: "proposed_only",
      basis: "inclusive_signup_calendar_day",
      remainingCalendarDays,
      daysInMonth,
      rounding: "nearest_cent_half_up",
      amountCents: Math.floor((IN_SEASON_COMMERCE.plans.monthly.amountCents * remainingCalendarDays * 2 + daysInMonth) / (2 * daysInMonth)),
    } : null,
  } as const;
}
