# FORGE Dashboard Component Audit Procedure

## Purpose

This artifact defines the step-by-step procedure for auditing each FORGE component consistently.

The main goal is to stop later review passes from mixing together:

- freshness failures
- correctness failures
- degraded-state failures
- observability gaps
- cron-surface gaps

Every component review should follow this procedure in the same order.

## Required Audit Order

Each component must be reviewed in the following sequence.

### Step 1: Define the Component Contract

Write down:

1. component name
2. route or page owner
3. one-sentence description of what the component is supposed to show
4. primary user meaning

If this cannot be stated clearly, stop and classify the component as at least `yellow`.

### Step 2: Identify the Full Data Chain

Document:

1. client-side helper or normalizer layer
2. serving API route or routes
3. source tables or authoritative upstream datasets
4. cron or scheduled refresh chain

This step answers:

- where the data comes from
- how it gets refreshed
- where drift can occur

### Step 3: Check Freshness Ownership

Ask:

1. Is there an explicit scheduled path that keeps the source current?
2. Is the chain documented in [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md)?
3. Is freshness inherited from another scheduled chain, or does it rely on undocumented manual work?
4. Does the component already have a freshness target in [freshness.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/freshness.ts)?

Outcomes:

- `freshness ok`
- `freshness weak`
- `freshness missing`

Interpretation:

- `freshness weak` means the chain exists but is mixed, indirect, or not fully proven
- `freshness missing` means the chain is undocumented, manual, or clearly incomplete

### Step 4: Check Runtime Expectations

Ask:

1. Does the serving endpoint have a budget in [perfBudget.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/perfBudget.ts)?
2. Does the upstream cron chain have a reasonable timeout or known runtime envelope?
3. Is there any known runtime hotspot that makes freshness fragile?

Outcomes:

- `runtime known and acceptable`
- `runtime known but risky`
- `runtime unknown`

This is not yet a correctness check. It is an operational risk check.

### Step 5: Run Source-To-API Reconciliation

Compare:

1. authoritative source data
2. serving API response

Questions:

1. Does the API return the intended rows?
2. Does the resolved date or snapshot date match the component context?
3. Is fallback behavior visible?
4. Are any required fields missing or silently coerced?

If source data and API output do not align, classify the issue as:

- `source failure`, or
- `API contract failure`

Do not blame the UI yet.

### Step 6: Run API-To-Helper Reconciliation

Compare:

1. raw API response
2. normalizer or helper output

Questions:

1. Are fields preserved?
2. Are nulls handled safely?
3. Are rankings, labels, or derived values computed correctly?
4. Is meaning preserved?

If this layer changes meaning incorrectly, classify the issue as:

- `normalizer/helper failure`

### Step 7: Run Helper-To-UI Reconciliation

Compare:

1. normalized or helper-derived values
2. rendered UI values and labels

Questions:

1. Is the visible row or card showing the intended value?
2. Is sort order correct?
3. Are warning, stale, or fallback labels visible when needed?
4. Are drill-in links preserving the intended semantics?

If the right data exists but the UI shows it wrong, classify the issue as:

- `UI rendering failure`

### Step 8: Review Degraded-State Behavior

Ask:

1. What happens when data is stale?
2. What happens when data is partial?
3. What happens when data is missing?
4. Does the user get warned?
5. Can the component still look healthy while being misleading?

Classify the outcome as:

- `degraded behavior safe`
- `degraded behavior weak`
- `degraded behavior misleading`

If the degraded state can mislead a user, that is at least a `yellow` and often a `red`.

### Step 9: Review Observability

Ask:

1. Are there tests covering the data contract?
2. Are there invariant guards?
3. Are there manual spot-check procedures?
4. Is there any reusable script or endpoint-level validation?

Classify the outcome as:

- `observability strong`
- `observability partial`
- `observability weak`

Weak observability alone does not always make a component `red`, but it blocks `green`.

### Step 10: Assign Failure Layer And Status

After the checks above, every issue found must be assigned to one primary layer:

1. `source`
2. `cron / refresh ownership`
3. `API contract`
4. `normalizer / helper`
5. `UI rendering`
6. `route semantics`
7. `observability`

Then assign:

- `green`
- `yellow`
- `red`

using the scoring model in [forge-dashboard-component-health-scoring-model.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-dashboard-component-health-scoring-model.md).

## Issue-Type Separation Rules

These distinctions must be kept strict.

### Freshness Failure

Use this when:

1. the source or API is older than the allowed freshness policy
2. the cron chain is not running correctly
3. the component is reading fallback data outside the acceptable freshness window

Do **not** call this a correctness bug unless the values themselves are wrong.

### Correctness Failure

Use this when:

1. the wrong source rows are selected
2. the wrong value is computed
3. the wrong label is shown
4. the UI meaning does not match the underlying data

This can happen even if freshness is fine.

### Degraded-State Failure

Use this when:

1. stale data is shown as if it were current
2. partial data is not disclosed
3. fallback behavior is silent
4. blocked states are missing or misleading

This is separate from both freshness and correctness, though it can coexist with them.

### Observability Gap

Use this when:

1. the component might be okay, but there is no credible way to prove it
2. tests cover only shape, not meaning
3. no reusable spot check exists

Observability gaps should generally drive `yellow`, not automatic `red`, unless they also hide correctness risk.

### Cron-Surface Gap

Use this when:

1. the source chain is known, but no explicit scheduled owner is visible
2. freshness depends on manual reruns
3. the scheduled chain is incomplete for the data the component claims to represent

Cron-surface gaps are operational gaps, even if the data currently looks fine.

## Standard Evidence Checklist

Each component audit should end with the same evidence checklist.

Required fields:

1. `component`
2. `route owner`
3. `api routes`
4. `source tables`
5. `cron chain`
6. `freshness result`
7. `runtime result`
8. `reconciliation result`
9. `degraded-state result`
10. `observability result`
11. `failure layer`
12. `status`
13. `reasons`
14. `follow-ups`

## What Must Be Added To The Rolling Backlog

If the audit discovers any of the following, it must be added to the rolling backlog rather than left as a note inside the status block:

1. missing cron ownership
2. runtime-budget uncertainty
3. missing reconciliation script or procedure
4. stale-source ambiguity
5. duplicated or drifting helper logic
6. misleading degraded-state behavior
7. route-level semantic mismatch
8. candidate optimization work

## Minimum Standard Before Starting Any Component-Specific Audit

Before a later `2.x`, `3.x`, or `4.x` component pass begins, the reviewer should have:

1. the inventory artifact
2. the scoring model
3. the reconciliation methods
4. this audit procedure

Without those four references, component reviews are too likely to drift in language and judgment.
