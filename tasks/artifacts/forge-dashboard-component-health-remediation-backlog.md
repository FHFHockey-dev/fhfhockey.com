# FORGE Dashboard Component Health Remediation Backlog

## Purpose

This is the running remediation backlog extracted from the component-health audit. It is intentionally grouped by repair track rather than by artifact name so implementation can proceed in coherent batches.

This file is also the required rolling backlog for newly discovered issues and optimizations during the next execution phase. New issues should be appended to the most relevant track instead of spawning one-off notes.

## Track 1: Freshness And Source Integrity

### `P0`

- Repair same-day goalie coverage for the slate and goalie bands by restoring current requested-date `goalie_start_projections` and `forge_goalie_projections` coverage.
- Repair CTPI source recency so `/api/v1/trends/team-ctpi` stops serving early-November rows as a current momentum pulse.
- Restore continuity for `l10` sustainability snapshots so `/api/v1/sustainability/trends` does not fall back from mid-March requests to `2026-03-07`.
- Restore true current recency for `player_trend_metrics` and stop serving materially stale October data to movement surfaces.

### `P1`

- Restore non-flat `trend10` behavior in team power so current team ratings reflect actual daily movement instead of repeated values.
- Reconcile current projection dates between FORGE skaters, FORGE goalies, and Start Chart so the dashboard is not mixing prior-day projections with same-day ownership.

## Track 2: Correctness And Contract Repair

### `P0`

- Repair Top Adds stable-ID projection-to-Yahoo matching so the dashboard no longer depends on normalized-name fallback as its primary ownership merge path.
- Remove ownership-universe truncation in `/api/v1/transactions/ownership-trends` so the rail is not silently ranking against an incomplete Yahoo pool.
- Fix Yahoo season resolution in dashboard ownership helpers and APIs so valid players do not resolve to null ownership when live rows exist.

### `P1`

- Align forward-position filtering between the Top Adds rail and Yahoo ownership APIs so `F` does not mismatch against `C/LW/RW` tokens.
- Correct Top Adds trend labeling so point-change values are not presented as percentages.
- Calibrate sustainability trust and heat thresholds against the live `luck_pressure` scale instead of the current collapsed badge bands.
- Align dashboard-specific player-detail add scoring with the week-mode schedule context used by the main Top Adds rail.

## Track 3: Cron / Runbook Ownership

### `P0`

- Reorder the team-context cron chain so NST and WGO team sources refresh before CTPI and team-power writers run.
- Reorder the goalie / projection cron chain so goalie priors are not executed ahead of the ingest and derived stages they depend on.
- Give `player_trend_metrics` an explicit scheduled owner instead of leaving `/api/v1/trends/player-trends` as an unscheduled rebuild surface.

### `P1`

- Align the documented `rollingForgePipeline` dependency graph with the actual Start Chart and FORGE serving dependencies.
- Collapse duplicated team-power ownership where possible so serving and writer surfaces do not rely on different table-selection assumptions.

## Track 4: Degraded-State And Mixed-Cadence Safety

### `P0`

- Add page-level mixed-date warnings for dashboard and landing surfaces when modules resolve to materially different source dates.
- Add first-class degraded states for ownership-overlay failure so “no signals” is not used when rows were actually filtered out by null ownership.
- Quantify goalie coverage-loss in the UI when a resolved fallback date returns only partial slate coverage.

### `P1`

- Preserve resolved `asOfDate` and fallback context through landing-page CTAs and dashboard drill-ins.
- Ensure team and player drill-ins preserve selected dashboard `date` and `mode` consistently.
- Replace hidden stale sub-feed behavior with explicit per-band or per-page stale messaging where a surface is partially current and partially fallback-driven.

## Track 5: Observability And Reconciliation

### `P0`

- Replace request-time freshness stand-ins in CTPI and skater-power routes with true source-recency metadata.
- Add explicit freshness policy entries for `/api/v1/forge/players`, `/api/v1/transactions/ownership-trends`, and `/api/v1/transactions/ownership-snapshots`.
- Add automated verification for mixed effective dates versus rendered date labels across dashboard and landing surfaces.

### `P1`

- Add ownership-overlay reconciliation checks that distinguish:
  - healthy empty results
  - null ownership suppression
  - source truncation
  - merge failure
- Add route continuity tests for preserving `date`, `mode`, and resolved fallback context across CTA and row-level drill-ins.
- Add coverage-delta checks for goalie fallback behavior and projection coverage loss.

## Track 6: Runtime And Optimization

### `P1`

- Add endpoint budgets to `perfBudget.ts` for:
  - `/api/v1/forge/players`
  - `/api/v1/transactions/ownership-trends`
  - `/api/v1/transactions/ownership-snapshots`
- Benchmark the Top Adds ownership merge path after stable-ID repair so the rail stays within the project’s daily operational budget.
- Reduce duplicated audit logic by extracting reusable reconciliation helpers instead of repeating manual comparisons across future passes.

## Quarantine Alignment

The following endpoints remain in quarantine until their owning tasks move them out explicitly:

- `/api/v1/start-chart`
- `/api/v1/forge/goalies`
- `/api/v1/forge/players`
- `/api/v1/transactions/ownership-trends`
- `/api/v1/transactions/ownership-snapshots`
- `/api/team-ratings`
- `/api/v1/trends/team-ctpi`
- `/api/v1/sustainability/trends`
- `/api/v1/trends/skater-power`
- `/api/v1/trends/player-trends`

## Maintenance Rule

While executing the next implementation task list:

1. newly discovered issues must be appended here
2. newly discovered optimizations must be appended here
3. resolved items should be marked in place, not deleted
4. quarantine removals should cite the evidence that justified the removal
