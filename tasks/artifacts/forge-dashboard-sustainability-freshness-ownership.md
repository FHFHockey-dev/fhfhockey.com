# FORGE Dashboard Sustainability Freshness Ownership

## Status

- `red`

## Scope Audited

- [trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/sustainability/trends.ts)
- [rebuild-baselines.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/sustainability/rebuild-baselines.ts)
- [rebuild-priors.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/sustainability/rebuild-priors.ts)
- [rebuild-score.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/sustainability/rebuild-score.ts)
- [freshness.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/freshness.ts)
- [perfBudget.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/perfBudget.ts)
- [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md)

## Ownership Question

This audit asks whether sustainability freshness is:

- owned by explicit jobs
- sequenced clearly enough to trust
- covered by freshness and runtime expectations
- actually producing current snapshots for the dashboard dates it claims to support

## Current Scheduled Ownership

The sustainability chain is explicitly represented in the runbook.

Current scheduled jobs in [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md):

- `10:42 UTC` `rebuild-sustainability-baselines`
- `10:43 UTC` `rebuild-sustainability-priors`
- `10:44 UTC` `rebuild-sustainability-window-z-batch-000`
- `10:45 UTC` `rebuild-sustainability-window-z-batch-250`
- `10:46 UTC` `rebuild-sustainability-window-z-batch-500`
- `10:47 UTC` `rebuild-sustainability-window-z-batch-750`
- `10:48 UTC` `rebuild-sustainability-score-batch-000`
- `10:49 UTC` `rebuild-sustainability-score-batch-250`
- `10:50 UTC` `rebuild-sustainability-score-batch-500`
- `10:51 UTC` `rebuild-sustainability-score-batch-750`
- `10:52 UTC` `rebuild-sustainability-trend-bands-batch-000`
- `10:53 UTC` `rebuild-sustainability-trend-bands-batch-250`
- `10:54 UTC` `rebuild-sustainability-trend-bands-batch-500`
- `10:55 UTC` `rebuild-sustainability-trend-bands-batch-750`

So sustainability is not suffering from a missing cron surface. The failure is that the scheduled chain is not yielding continuous dashboard-ready `l10` snapshots.

## Policy Coverage

Dashboard freshness policy exists in [freshness.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/freshness.ts):

- `sustainability`
  - `maxAgeHours = 72`
  - severity `warn`

Runtime budget coverage also exists in [perfBudget.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/perfBudget.ts):

- `/api/v1/sustainability/trends`
  - `maxPayloadBytes = 140000`
  - `targetP95Ms = 850`

This means sustainability is better documented than some other dashboard surfaces.

## Route Freshness Behavior

[trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/sustainability/trends.ts):

- accepts `snapshot_date`
- resolves the nearest available snapshot at or before that date
- falls back to the latest available snapshot only if no earlier snapshot exists

This is a coherent fallback contract.

But on the audited request date `2026-03-15`, it resolved to:

- requested snapshot: `2026-03-15`
- returned snapshot: `2026-03-07`

That means the fallback logic is working as designed while the source freshness contract is failing materially.

## Live Source Evidence

Live source evidence from the audit window:

- latest `sustainability_scores.snapshot_date`: `2026-03-27`
- latest `player_baselines.snapshot_date`: `2026-03-27`

But `l10` continuity is broken:

- `2026-03-07`: `634` rows
- `2026-03-08` through `2026-03-17`: `0` rows
- `2026-03-26`: `648` rows
- `2026-03-27`: `649` rows

Position splits for the same gap:

- `2026-03-07`
  - `F`: `306`
  - `D`: `328`
- `2026-03-08` through `2026-03-17`
  - `F`: `0`
  - `D`: `0`
- `2026-03-26`
  - `F`: `312`
  - `D`: `336`
- `2026-03-27`
  - `F`: `313`
  - `D`: `336`

This is enough to show that the chain resumed later, but failed to maintain continuity for the dashboard’s audited mid-March period.

## Dependency Coverage

[rebuild-baselines.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/sustainability/rebuild-baselines.ts):

- defaults `snapshot_date` to today
- asserts baseline prerequisites before writing
- writes baseline rows in batches

[rebuild-priors.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/sustainability/rebuild-priors.ts):

- resolves season automatically
- asserts priors prerequisites
- rebuilds league priors and player posteriors

[rebuild-score.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/sustainability/rebuild-score.ts):

- defaults `snapshot_date` to today
- asserts score prerequisites
- can run one batch or all batches

The implementation surface is therefore present and structured. The audit problem is not “there is no writer.” It is “the writers and scheduled batches did not leave a continuous `l10` snapshot trail for the period the dashboard later requested.”

## Ownership Verdict

Why the ownership chain is `red` instead of `yellow`:

- the cron/runbook surface exists, but the actual output continuity failed for a full mid-March window
- the route fallback masks the gap by serving `2026-03-07` to a `2026-03-15` request
- the dashboard freshness policy only downgrades sustainability as a `warn`, even when the effective snapshot is more than a week behind the requested dashboard date
- the ownership/discovery overlay is also currently compromised by the Yahoo season mismatch already documented in the sustainability health audit

## What Is Working

- sustainability has explicit scheduled ownership
- sustainability has explicit freshness-policy coverage
- sustainability has explicit endpoint-budget coverage
- the serving route has deterministic fallback behavior instead of failing randomly
- the source chain appears to have resumed by `2026-03-26` and `2026-03-27`

## What Is Failing

### 1. Scheduled ownership did not prevent a real `l10` production gap

The chain is scheduled, but it still left no `l10` rows from `2026-03-08` through `2026-03-17`.

### 2. Fallback behavior hides the operational severity

The route is honest about `snapshot_date`, but the product can still show a materially stale panel under a current dashboard date.

### 3. Freshness policy is too weak for this failure mode

`72h warn` is not enough when a dashboard request falls back more than a week.

### 4. Ownership overlay creates a second freshness/confidence problem

Even when sustainability rows exist, the dashboard discovery overlay is still subject to the Yahoo season mismatch already established in the health audit.

## Required Follow-Ups

- determine why the scheduled sustainability chain produced no `l10` rows from `2026-03-08` through `2026-03-17`
- decide whether large fallback gaps should escalate sustainability from `warn` to `error` in [freshness.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/freshness.ts)
- add explicit observability for missing `window_code` continuity, not just latest snapshot existence
- keep `/api/v1/sustainability/trends` quarantined until the mid-March continuity gap is explained and the Yahoo ownership overlay is reconciled
