# Stripe configuration for Draft Pro

Draft Pro uses server-side Stripe Checkout in `payment` mode for one US$5.99
pass (`draft_pro_2026_27`) that expires on 2027-07-01 at 04:00 UTC. It does
not create a subscription or renewal.

Set these server-only values in the deployment environment (never expose them
to the browser or commit their values):

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_DRAFT_PRO_PRICE_ID` (active one-time US$5.99 USD Price)
- `STRIPE_DRAFT_PRO_PRODUCT_ID` (the Product owned by that Price)
- `NEXT_PUBLIC_SITE_URL` (the canonical application origin)

Configure Stripe to deliver signed events to `/api/v1/webhooks/stripe`. Before
activation, the owner must complete a test-mode Checkout and signed webhook
replay using Stripe CLI or Dashboard, then separately authorize live-mode
keys, a bank payout account, receipt settings, Link availability, and the
required product/tax/terms review. No live charge is created by this code.
