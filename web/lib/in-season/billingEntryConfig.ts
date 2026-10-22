import { IN_SEASON_COMMERCE, monthlySignupQuote } from "./commerce";
import { getInSeasonSandboxMonthlyMinimum, IN_SEASON_SANDBOX_CATALOG } from "./billingConfig";

// These gates supplement (never replace) the existing isolated-sandbox guard.
export function monthlySignupAvailability(now = new Date()) {
  const minimum = getInSeasonSandboxMonthlyMinimum();
  const quote = monthlySignupQuote(now, IN_SEASON_SANDBOX_CATALOG.accountId, minimum);
  const enabled = process.env.IN_SEASON_SANDBOX_MONTHLY_SIGNUP_ENABLED === "true";
  const tooLate = now.getTime() + 31 * 60_000 >= Date.parse(IN_SEASON_COMMERCE.accessEndsAt);
  const reason = !enabled ? "disabled" : tooLate ? "season_ended" : quote.reason;
  return { available: enabled && !tooLate && quote.available, reason, minimum,
    initialAmountCents: quote.charge?.confirmedAmountCents ?? null };
}

export function monthlyManagementEnabled() {
  return process.env.IN_SEASON_SANDBOX_MANAGEMENT_ENABLED === "true";
}
