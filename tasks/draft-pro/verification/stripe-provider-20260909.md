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
  the database's terminal full-refund precedence. The existing SQL probes
  remain the direct state assertion for late paid events not reopening a full
  refund.

## Replay and dispute limits

`stripe events resend` requires a registered `--webhook-endpoint`; it cannot
target the local Stripe CLI forwarding listener. The original missed
completion event therefore cannot be resent as a provider-signed event to
localhost.

The installed CLI exposes no generic test-helper dispute resource. A real
sandbox dispute check needs a new eligible sandbox payment plus a documented
Stripe dispute fixture/workflow; the refunded test payment must not be used.
