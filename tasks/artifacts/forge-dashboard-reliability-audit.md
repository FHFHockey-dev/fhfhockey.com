# Forge Dashboard Reliability Audit

## Objective
Validate reliability behavior across dashboard modules with focus on:
- fallback correctness when requested date data is unavailable
- partial-failure/degraded-mode behavior
- stale-data visibility and user awareness

## Reliability Rules

### 1) Fallback Integrity
- If `requestedDate !== resolvedDate`, fallback context must be explicit.
- For endpoints that expose fallback metadata (`/api/v1/forge/goalies`), `fallbackApplied` should align with date drift.
- Missing requested/resolved dates are warning-level and must be logged for follow-up.

### 2) Runtime State Coherence
- Invalid state (error-level): `loading=true` while `error` exists.
- Degraded-mode warning: module has `error` but still renders existing/stale data.
- Empty-state warning: no error/loading but no data rows.
- Stale+error warning: both conditions present; UI must show stale warning and preserve clear error messaging.

### 3) UI Reliability Expectations
- Every module must expose at least one of: loading, empty, error, stale indicators.
- Date-bound modules should report resolved date context to route-level drift banner.
- Route-level drift banner should aggregate mismatches across modules.

## Implementation References
- Reliability evaluators:
  - `web/lib/dashboard/reliability.ts`
- Automated reliability tests:
  - `web/tests/audit/dashboard-reliability-audit.spec.ts`

## Current Dashboard Coverage
- Date-drift banner implemented at route level (`/forge/dashboard`)
- Module stale indicators implemented for all date-sensitive cards
- Canonical goalie fallback source established (`/api/v1/forge/goalies`)

## Follow-up Recommendations
1. Add retry action to modules in hard error state.
2. Add structured logging for fallback events and stale durations.
3. Add synthetic monitor that validates key dashboard endpoints at scheduled intervals.
