# W13 Yahoo Work Order

Status: **IN PROGRESS**

Yahoo Fantasy API approval was reported on September 12, 2026. This work remains bounded to implementation and validation; production activation, provider configuration changes, and deployment remain separately owner-authorized.

## Prerequisites

- Connected-account provider access must remain available before controlled live-draft validation starts.
- The rehearsal worker must be ready to run the approved validation flow.
- The September 11, 2026 one-time readiness check is complete and removed; do not recreate it or add polling automation.
- This work remains separate from production activation.

## Current Implementation Pointers

- The approved contract and rollout rules live in `tasks/draft-pro/PLAN.md`.
- The current readiness tracker lives in `tasks/TASKS/draft-dashboard-yahoo/live-draft-production-readiness.md`.
- The live-draft runbook and rollout gates are documented in `tasks/TASKS/draft-dashboard-yahoo/docs/live-draft-runbook.md`.
- The release status indicates local provider plumbing, polling, OAuth hardening, and rehearsal harness work already exist; controlled live-draft validation remains outstanding.

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

## Production Activation Criteria

- Require the rehearsal worker and approved validation checkpoint.
- Require provider evidence, Chef acceptance, and owner production authorization.
- Do not enable live activation, provider configuration, or additional automation from this work order.

## Notes

- The September 11 readiness check was historical evidence, not an activation trigger.
- A stale local token does not override current connected-account evidence.

## Historical September 11 Checkpoint

- Direct Fantasy API requests returned HTTP 401 and the shared-token refresh returned `invalid_grant`; neither result established that Yahoo had denied the approved API permission.
- The one-time readiness automation completed and was removed. No production settings changed and no live-draft rehearsal ran.

## September 12 Provider Evidence

- The current signed-in `fhfhockey.com` connected-account page reported a completed Yahoo refresh: 4 leagues and 16 teams, with account status `connected`.
- A local environment access token still returns HTTP 401 and is treated as stale. It is not used as readiness evidence and no token values are recorded here.
- Connected-account access is verified. Real active-draft polling, closed-browser ingestion, and private-league rehearsal remain external validation checks.

## Chef Review Follow-up

- Yahoo access now uses current Draft Pro eligibility, independent Yahoo enablement/rollout, and the existing controlled staff/allowlist rehearsal path. It does not depend on the recommendations feature flag.
- Only confirmed expired or absent Draft Pro entitlement stops a live session. Readiness, rollout, database, and Patreon-verification failures defer the next poll without deleting picks or changing a completed session.
- An authenticated owner may always stop an owned session; this does not grant premium access or start provider work.
- Release readiness remains externally unverified for durable worker deployment/substrate, functional cross-user behavior, and controlled provider rehearsal. The target migration/types/RLS preflight is verified read-only; no production action occurred.

## Final Correction Evidence

- Chef corrections are represented by commits `19e3354cf` (runtime guards and retry-safe transitions), `f21a9d91e` (coordinator recovery tests), and `eb20dd787` (stateful ownership/retained-state tests), with final permission-matrix coverage in the current follow-up commit.
- The final targeted suites passed: access/server 17/17, coordinator 5/5, live-draft API 6/6, OAuth/connect/callback/refresh 6/6, parser/mapping 12/12, and hook coverage 7/7. `npx tsc --noEmit` completed successfully.
- The model downgrade to Luna/medium was limited to targeted test corrections after Chef review; no architecture redesign or scope expansion was needed.
- Read-only infrastructure inspection confirmed migration `20260824152127_yahoo_live_draft_production_hardening` is installed, all five live-draft tables have enabled and forced RLS, authenticated access is limited to owner-scoped reads on sessions/picks, state-changing RPCs are service-role-only, and Realtime publishes only sessions/picks.
- No draft sessions or polling observations were present in the inspected target, so functional cross-user rehearsal, worker operation/observations, closed-browser ingestion, and active-draft provider validation remain unverified prerequisites.
