# W13 Yahoo Work Order

Status: **PARKED**

This note is a preparation-only handoff for the Yahoo draft-pro work order. No API calls, provider configuration edits, runtime code changes, credential checks, or activation work are included here.

## Prerequisites

- Actual Yahoo API access must be available before any entitlement integration work starts.
- The rehearsal worker must be ready to run the approved validation flow.
- The Chef heartbeat on September 11, 2026 at 09:00 America/New_York is already scheduled; do not create another automation.
- This work remains separate from production activation and should stay parked until the access gate opens.

## Current Implementation Pointers

- The approved contract and rollout rules live in `tasks/draft-pro/PLAN.md`.
- The current readiness tracker lives in `tasks/TASKS/draft-dashboard-yahoo/live-draft-production-readiness.md`.
- The live-draft runbook and rollout gates are documented in `tasks/TASKS/draft-dashboard-yahoo/docs/live-draft-runbook.md`.
- The release status indicates local provider plumbing, polling, OAuth hardening, and rehearsal harness work already exist, but provider validation is still blocked.

## Readiness Validation

- Confirm the Yahoo live-draft path still respects the current fail-closed rollout gate.
- Confirm the existing server-side Yahoo checks require current Draft Pro access separately from provider readiness.
- Confirm the rehearsal path can run against a consenting private test league without touching production settings.
- Confirm the worker can observe closed-browser ingestion behavior and recover/reconnect cleanly.
- Confirm the runbook thresholds are still the only accepted gate for moving from PARKED to active validation.

## Acceptance Checklist

The implementation release, using Terra at medium reasoning effort, must provide evidence for each approved requirement:

- OAuth authorization, callback, token refresh, and account-linking behavior.
- League, scoring, and roster mapping into the approved draft model.
- Draft-state polling, including cadence, terminal-state handling, and fail-closed behavior.
- Reconnect behavior after browser closure, transient provider failure, or expired authorization.
- Unresolved-player handling that is visible, bounded, and does not silently create an incorrect pick.
- A documented manual fallback path when automated ingestion cannot continue.
- Automatic updates stop when access is lost, while local picks remain intact and available for manual continuation.

Acceptance requires current provider evidence, Chef acceptance of the validation results, and explicit owner authorization before any production change.

## Entitlement Integration After Access

- Re-check the approved entitlement flow only after API access is available.
- Validate current Draft Pro access in the existing server-side Yahoo checks separately from Yahoo provider readiness and account-linking.
- Reconcile the entitlement state with the current access resolver and provider readiness reporting.
- Keep the integration work limited to the approved validation scope; do not widen it to unrelated draft-pro features.

The gates permit a proposed activation after validation passes; they do not authorize production changes. Any provider configuration or entitlement change remains subject to explicit owner approval and is not, by itself, a permanent blocker once the approved evidence is available.

## Blocked Activation Criteria

- Parked until actual Yahoo API access is available.
- Parked until the rehearsal worker is ready.
- Parked until the approved validation checkpoint is explicitly reached.
- Parked if the entitlement/reconnect path cannot be validated without changing production settings.
- Parked if provider evidence, Chef acceptance, or owner production authorization is missing.
- At the September 11 availability check, if Yahoo access is unavailable, record the blocker, keep this work parked, and do not start polling.
- Do not create additional automation; the existing September 11 Chef heartbeat is the only scheduled check in scope.

## Notes

- September 11, 2026 is not itself the activation trigger.
- The correct state is PARKED pending actual API access plus rehearsal/worker readiness, with no polling while access is unavailable.
