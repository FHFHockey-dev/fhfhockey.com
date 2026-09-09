import Stripe from "stripe";

export const STRIPE_PROVIDER = "stripe";
export const DRAFT_PRO_STRIPE_PRICE = {
  unitAmount: 599,
  currency: "usd",
  productName: "FHFH Draft Pro 2026–27",
} as const;

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim() && process.env.STRIPE_WEBHOOK_SECRET?.trim() && process.env.STRIPE_DRAFT_PRO_PRICE_ID?.trim() && process.env.STRIPE_DRAFT_PRO_PRODUCT_ID?.trim());
}

export function isDraftProCheckoutEnabled() {
  return process.env.DRAFT_PRO_CHECKOUT_ENABLED === "true";
}

export function isDraftProStripeAutomaticTaxEnabled() {
  return process.env.DRAFT_PRO_STRIPE_AUTOMATIC_TAX_ENABLED === "true";
}

export function getDraftProStripeCatalog() {
  const priceId = process.env.STRIPE_DRAFT_PRO_PRICE_ID?.trim();
  const productId = process.env.STRIPE_DRAFT_PRO_PRODUCT_ID?.trim();
  if (!priceId || !productId) throw new Error("Draft Pro Stripe Price and Product IDs are not configured.");
  return { priceId, productId };
}

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured.");
  return new Stripe(secretKey);
}

export function getStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  return secret;
}
