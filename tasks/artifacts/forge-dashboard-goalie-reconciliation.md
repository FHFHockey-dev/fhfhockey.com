# FORGE Dashboard Goalie Reconciliation

## Status

- `red`

## Scope Reconciled

- [GoalieRiskCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/GoalieRiskCard.tsx)
- [goalies.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/forge/goalies.ts)
- [normalizers.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/normalizers.ts)

## Reconciliation Question

This audit asks whether the goalie band is faithfully representing:

- goalie API rows
- model recommendation fields
- uncertainty-driver context
- starter-risk and confidence labels

without hiding important gaps in coverage or meaning.

## What Reconciles Correctly

### 1. The card preserves the key API fields cleanly

[normalizeGoalieResponse(...)](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/normalizers.ts) preserves:

- `goalie_id`
- `goalie_name`
- `starter_probability`
- `proj_win_prob`
- `proj_shutout_prob`
- `modeled_save_pct`
- `volatility_index`
- `blowup_risk`
- `confidence_tier`
- `quality_tier`
- `reliability_tier`
- `recommendation`
- starter-selection context

So the UI is not dropping the core projection fields before rendering.

### 2. Spotlight-card language is consistent with the API

[GoalieRiskCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/GoalieRiskCard.tsx) renders:

- `Confidence {tier}`
- `Vol {label}`
- `Call {recommendation}`
- Starter / Win / Shutout / Sv% values

These are direct or lightly formatted representations of the route payload.

### 3. Driver chips are traceable to uncertainty payload fields

The card builds its driver list from:

- `days_since_last_played`
- `l10_starts`
- `is_back_to_back`
- `opponent_is_weak`
- `opponent_context_adjustment_pct`

That is a coherent UI reduction of the uncertainty payload rather than invented explanation text.

### 4. Existing tests already protect the basic goalie rendering contract

[dashboard.test.tsx](/Users/tim/Code/fhfhockey.com/web/__tests__/pages/forge/dashboard.test.tsx) already verifies:

- `Starter trust`
- `Confidence HIGH`
- `Call Start`
- goalie empty-state behavior

So the basic display semantics are not untested.

## Where Reconciliation Breaks

### 1. The UI only surfaces fallback date, not fallback coverage loss

The route can return:

- requested date
- resolved fallback date
- requested scheduled game count
- resolved row count

But the card only surfaces:

- `Showing nearest available projection date ({asOfDate}).`

It does not tell the user whether the fallback result is:

- near-complete
- partial
- or severely incomplete for the requested slate

That means the UI can accurately state the fallback date while still overstating the completeness of the decision surface.

### 2. The table and spotlight cards imply a usable board even when coverage is partial

Live route evidence showed:

- `requested.scheduledGamesOnDate = 15`
- `requested.rowCount = 0`
- `resolved.rowCount = 4`

The UI still renders spotlight cards and a compact table from those four rows.

Those rows are accurate as rows, but the band does not communicate that the goalie slate is incomplete relative to the requested date.

### 3. Risk labels are simplified and intentionally lossy

The card maps `blowup_risk` into:

- `Low risk`
- `Watch risk`
- `High risk`

via local thresholds:

- `< 0.28`
- `< 0.44`
- otherwise high

That is not wrong, but it is a dashboard-owned interpretation layer rather than a source-native risk label.

### 4. Volatility labels are also a local interpretation layer

The card maps `volatility_index` into:

- `Stable`
- `Moderate`
- `Volatile`

with local thresholds.

Again, that is coherent, but it is not a direct API label. The UI is applying a policy layer that is not formally encoded in the route contract.

## Live Verdict By Layer

### Route payload

- `yellow`
- rich and well-instrumented, but currently incomplete for requested-date coverage

### Normalizer

- `green`
- preserves the meaningful goalie fields cleanly

### Risk/confidence presentation

- `yellow`
- coherent, but based partly on local thresholding rather than fully source-native labels

### Coverage/completeness communication

- `red`
- the band does not tell the user that a fallback board may only cover a small subset of the requested slate

### Final rendered card

- `red`
- because the rows themselves are accurate, but the board does not accurately represent how incomplete the overall goalie slate currently is

## Status Rationale

Why this is not `green`:

- the UI applies local risk/volatility interpretation layers
- fallback completeness is not surfaced clearly enough

Why this is not `yellow`:

- the component can present a partial fallback board as if it were a broadly usable goalie slate
- the missing coverage context is large enough to distort the user’s interpretation of the band

## Required Follow-Ups

- surface requested-vs-resolved coverage context from [goalies.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/forge/goalies.ts) in the card, not just the fallback date
- decide whether low row-count fallback results should:
  - warn
  - degrade
  - or block the goalie band
- document or centralize the local risk/volatility threshold policy so it is auditable instead of implicit UI behavior
- keep the goalie band tied to the quarantine status of `/api/v1/forge/goalies` until requested-date completeness is reliable
