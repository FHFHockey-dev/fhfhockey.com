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
