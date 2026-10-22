import Stripe from "stripe";
import type { VerifiedStripeMinimum } from "./commerce";

// These are public catalog identifiers in the separately approved Stripe sandbox.
// Production billing is deliberately unavailable in this local implementation.
export const IN_SEASON_SANDBOX_CATALOG = {
  accountId: "acct_1UDRxGLaomqkve47",
  productId: "prod_VU0CGry3DRLdud",
  monthlyPriceId: "price_1UT2C4Laomqkve47zG3qQJq2",
  seasonPassPriceId: "price_1UT2FBLaomqkve47tXDflfKF",
} as const;

export const MONTHLY_CHECKOUT_BLOCKER = "Monthly checkout is not available yet. Billing setup and verification are still in progress.";

export function assertInSeasonSandboxConfiguration() {
  const dbUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://invalid.example");
  const origin = new URL(process.env.IN_SEASON_SANDBOX_ORIGIN ?? "https://invalid.example");
  const loopback = (url: URL) => ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  if (process.env.NODE_ENV === "production" || process.env.IN_SEASON_BILLING_SANDBOX_ENABLED !== "true"
    || !loopback(dbUrl) || !loopback(origin)
    || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    || !/^(?:sk|rk)_test_/.test(process.env.IN_SEASON_STRIPE_SECRET_KEY ?? "")
    || !process.env.IN_SEASON_STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")) {
    throw new Error("In-season sandbox checkout needs approved test credentials and isolated local storage.");
  }
  return { origin: origin.origin };
}

export function getInSeasonSandboxStripe() {
  assertInSeasonSandboxConfiguration();
  return new Stripe(process.env.IN_SEASON_STRIPE_SECRET_KEY!, { timeout: 10_000, maxNetworkRetries: 0 });
}

export async function verifyInSeasonSandboxAccount(stripe: Stripe) {
  const account = await stripe.accounts.retrieve();
  if (account.id !== IN_SEASON_SANDBOX_CATALOG.accountId) throw new Error("Unexpected Stripe sandbox account.");
}

/** Operator-verified settlement/charge-currency applicability; no USD default. */
export function getInSeasonSandboxMonthlyMinimum(): VerifiedStripeMinimum | null {
  const cents = process.env.IN_SEASON_STRIPE_MINIMUM_CHARGE_CENTS?.trim();
  const accountId = process.env.IN_SEASON_STRIPE_MINIMUM_ACCOUNT_ID?.trim();
  const settlementCurrency = process.env.IN_SEASON_STRIPE_SETTLEMENT_CURRENCY?.trim();
  const verificationReference = process.env.IN_SEASON_STRIPE_MINIMUM_VERIFICATION_REFERENCE?.trim();
  if (!cents || !/^\d+$/.test(cents) || !Number.isSafeInteger(Number(cents)) || Number(cents) <= 0
    || accountId !== IN_SEASON_SANDBOX_CATALOG.accountId || !settlementCurrency || !/^[a-z]{3}$/.test(settlementCurrency) || !verificationReference) return null;
  return { accountId, chargeCurrency: "usd", settlementCurrency, minimumChargeCents: Number(cents), verificationReference };
}
