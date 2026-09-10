# Stripe sandbox provider evidence — 2026-09-09

Scope: isolated local test-mode services only. No live keys, real payment
details, email, production data, or public endpoint were used.

- Chef completed one route-created hosted Checkout using Stripe's published
  sandbox card flow. Stripe CLI delivered signed event
  `evt_1UDlihLaomqkve47Sugiso3e` (`checkout.session.completed`) to the local
  webhook; the route returned HTTP 200 and Chef observed a processed event,
  one active paid purchase, and one grant. Two authenticated return checks
  both reported `confirmed` without a duplicate grant.
- A local-signature simulated duplicate of that exact event was delivered to
  the local webhook. It returned HTTP 200 with `processed:false`. This is
  simulated delivery, not a second provider-signed event.
- The earlier completion event `evt_1UDXfELaomqkve47e7YFurMS` was delivered
  with a local signature after Chef had verified signed partial then full
  `charge.refunded` events for its charge. The webhook returned HTTP 200 with
  `processed:true`; this is a simulated out-of-order delivery that exercises
  the database's terminal full-refund precedence. Chef queried the isolated database after this delivery: the old purchase remained refunded/refunded and its grant inactive; the new purchase remained active/paid with its own active grant.
- A separate provider-backed dispute fixture used a standalone test
  PaymentIntent with Stripe's documented `pm_card_createDispute` payment
  method. Its association to the locally seeded, explicitly marked
  `stripe_dispute_20260909` purchase was synthetic; it is not Checkout
  evidence. Stripe emitted and the local webhook processed both
  `charge.dispute.created` and `charge.dispute.closed` events. The created
  event changed the fixture from active to `disputed` and its entitlement to
  inactive. Submitting `winning_evidence` closed the provider dispute as won
  and restored the fixture to active with an active entitlement. Stripe
  initially returned `under_review` from the evidence update; the later
  provider state and processed close event were `won`.

The fixture has no Stripe Customer or real payment details. Its synthetic
auth user, purchase, entitlement, and provider-event rows are retained and
marked as test-fixture audit evidence; this avoids touching the route-created
Checkout user or its exact-one-purchase assertion.

## Replay and dispute limits

`stripe events resend` requires a registered `--webhook-endpoint`; it cannot
target the local Stripe CLI forwarding listener. The original missed
completion event therefore cannot be resent as a provider-signed event to
localhost.

The installed CLI exposes no generic test-helper dispute resource, but Stripe
documents test PaymentMethods and evidence values for this API workflow. The
refunded Checkout test payment was not reused.

## Link and merchant readiness follow-through — September 9 evening

- A temporary **sandbox-only** Dashboard Payment Link (`plink_1UDthxLaomqkve474VoYcvKJ`) used the existing one-time $5.99 product and quantity one. This separately exercises hosted Link, not FHFH account association or fulfillment; the route-created evidence above covers those paths.
- Stripe displayed Sandbox and its documented instruction to use `000000` with no real OTP sent. Authentication succeeded; the saved test Visa ending 4242 was selected. The confirmation page showed “Thanks for your payment,” Link, and $5.99. The sandbox Dashboard independently showed `pi_3UDtjdLaomqkve471DGkhkbR` Succeeded, Link, USD 5.99; charge `ch_3UDtjdLaomqkve471NnAHwYJ`. No real money moved.
- The receipt preview rendered. Stripe explicitly states “Receipts are not sent for test charges”; its history showed no receipts sent. This is preview evidence, **not inbox delivery**. Sandbox receipt branding/support still uses sandbox settings and is not evidence of the live receipt footer.
- Fresh **live** account settings independently showed Payments, Payouts and Link Active, no active tasks, successful-payment/refund receipt switches enabled, and receipt replies directed to `tim@fhfhockey.com`. No live payment was created.
- Reference for the fixed sandbox OTP: [Stripe testing](https://docs.stripe.com/testing#link).

- Temporary Link cleanup verified by reopening its URL: “The link is no longer active.” Test payment retained as provider audit evidence; no live Payment Link created.

## Managed Payments — September 9 evening

- Owner approved Managed Payments fee/refund conditions. Live enrollment reports Ready to use; ordinary sessions remain unaffected until the new per-session flag is deployed.
- Set sandbox/live Draft Pro product tax code to `txcd_10103000` (SaaS, personal use). The initial sandbox request correctly rejected a missing product tax code.
- Standalone sandbox session `cs_test_a1Jy3lNoshm1qw9jRkQvoaqe9hEavfGu2Wb582Xl4EesnuQA9lMQZAda5p` showed Sold through Link, $5.99 subtotal, Pennsylvania tax $0.36, total $6.35. Provider retrieval confirmed paid, `managed_payments.enabled=true`, and balance transaction `txn_3UDuaXLaomqkve473wGZDNAh` explicitly withheld 36 cents of sales tax. No real money moved.
- An isolated FHFH authenticated checkout route then created `cs_test_a1jHkrYt9JFBVb2or4J2LziDfUrlt31SDOcrIQepn87moGVD4EetWLmXYl` for synthetic local purchase `c3dec1be-ca38-4779-a8ee-46ed7fd5ff1a`. Browser test-card payment completed. Stripe CLI delivered actual signed `checkout.session.completed` event `evt_1UDudwLaomqkve47mv2r9f9A`; webhook returned 200.
- Authenticated return verification and account-bound recovery-code verification both returned 200/confirmed. Existing isolated runner verified one active paid purchase, processed provider/return events, an active entitlement and account-readable access. Owned local services were cleaned up; temporary ignored sandbox credentials were removed.
- 51 targeted tests and TypeScript passed; release suite passed 4,477 tests, 3 skipped (766 files passed, 2 skipped). Receipt inbox delivery remains unverified. Sandbox fees are not used to predict live total fees.
