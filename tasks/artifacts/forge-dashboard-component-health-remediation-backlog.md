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
- Repair the current NST ingest path so `/api/v1/db/update-nst-gamelog` can survive or explicitly classify Cloudflare/403 responses from `naturalstattrick.com` instead of silently leaving same-day rolling FORGE refreshes stale.

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
- Reconcile the displayed `Team Power` composite with its actual inputs so the UI does not present a broad all-in score when `computeTeamPowerScore` currently ignores trend and the extra sub-rating fields already shown beside it.
- Remove or intentionally unify the duplicated ownership-band controls between the dashboard shell and `TopAddsRail` so the page stops presenting two different discovery scopes with similar language.

## Track 3: Cron / Runbook Ownership

### `P0`

- Reorder the team-context cron chain so NST and WGO team sources refresh before CTPI and team-power writers run.
- Reorder the goalie / projection cron chain so goalie priors are not executed ahead of the ingest and derived stages they depend on.
- Give `player_trend_metrics` an explicit scheduled owner instead of leaving `/api/v1/trends/player-trends` as an unscheduled rebuild surface.
- Make same-day `daily_incremental` `/api/v1/db/run-rolling-forge-pipeline` runs skip or downgrade FUT-only `update-power-play-combinations-batch` failures so `contextual_builders` does not block rolling recompute and FORGE projection execution before games start.

### `P1`

- Align the documented `rollingForgePipeline` dependency graph with the actual Start Chart and FORGE serving dependencies.
- Collapse duplicated team-power ownership where possible so serving and writer surfaces do not rely on different table-selection assumptions.
- Fix `update-wgo-averages` team-season GP lookup gaps and multi-team abbreviation parsing (`BOS, N.J`, `CHI, DET`, etc.) so warning spam does not mask whether career/three-year team-context weighting is actually degraded.

## Track 4: Degraded-State And Mixed-Cadence Safety

### `P0`

- Add page-level mixed-date warnings for dashboard and landing surfaces when modules resolve to materially different source dates.
- Add first-class degraded states for ownership-overlay failure so “no signals” is not used when rows were actually filtered out by null ownership.
- Quantify goalie coverage-loss in the UI when a resolved fallback date returns only partial slate coverage.
- Current all-position insight-band vetting on `2026-03-29` showed both `SustainabilityCard` and `HotColdCard` resolving to fully empty states because every returned player ID mapped to `ownership: null`; replace the clean empty-state copy with ownership-coverage-aware degraded messaging and preserve some operator-visible raw-signal evidence.

### `P1`

- Preserve resolved `asOfDate` and fallback context through landing-page CTAs and dashboard drill-ins.
- Ensure team and player drill-ins preserve selected dashboard `date` and `mode` consistently.
- Replace hidden stale sub-feed behavior with explicit per-band or per-page stale messaging where a surface is partially current and partially fallback-driven.
- Fix `ForgeRouteNav`, team-detail back-links, and player-detail back-links so the FORGE route family preserves dashboard context instead of silently dropping filters on navigation.
- Decide whether `HotColdCard` should drill into FORGE detail context or an explicitly styled Trends handoff, then make the route choice truthful and consistent.
- Teach the Trends player detail route to consume forwarded FORGE context so the new explicit handoff can preserve date/origin metadata instead of remaining a one-way route jump.
- Rebalance the desktop top-band composition so the left slate hero column does not leave a large dead zone under the focused matchup when the Top Adds rail is taller than the slate panel.

## Track 5: Observability And Reconciliation

### `P0`

- Replace request-time freshness stand-ins in CTPI and skater-power routes with true source-recency metadata.
- Add explicit freshness policy entries for `/api/v1/forge/players`, `/api/v1/transactions/ownership-trends`, and `/api/v1/transactions/ownership-snapshots`.
- Add automated verification for mixed effective dates versus rendered date labels across dashboard and landing surfaces.
- Stop `ownership-trends` from reporting request-time `generatedAt` as if it were source freshness when the payload is derived from historical Yahoo rows and may mask stale ownership data.

### `P1`

- Add ownership-overlay reconciliation checks that distinguish:
  - healthy empty results
  - null ownership suppression
  - source truncation
  - merge failure
- Add route continuity tests for preserving `date`, `mode`, and resolved fallback context across CTA and row-level drill-ins.
- Add coverage-delta checks for goalie fallback behavior and projection coverage loss.
- Fix the FORGE page-route Vitest module-resolution blocker so `web/__tests__/pages/FORGE.test.tsx`, `web/__tests__/pages/forge/dashboard.test.tsx`, and the player/team detail suites can collect again instead of failing on `lib/dashboard/clientFetchCache` imports before execution.

## Track 6: Runtime And Optimization

### `P1`

- Add endpoint budgets to `perfBudget.ts` for:
  - `/api/v1/forge/players`
  - `/api/v1/transactions/ownership-trends`
  - `/api/v1/transactions/ownership-snapshots`
- Benchmark the Top Adds ownership merge path after stable-ID repair so the rail stays within the project’s daily operational budget.
- Reduce duplicated audit logic by extracting reusable reconciliation helpers instead of repeating manual comparisons across future passes.

## Track 7: Legacy Reuse / Retirement

### `P1`

- Port the useful `skoCharts` explainability concepts, if any, into FORGE deliberately:
  - characteristic/confidence explanation language
  - game-log debug affordances
  - adjusted-vs-raw score comparison patterns
- Mark the direct `skoCharts` math path as legacy-only unless revalidated:
  - weighted squared-z characteristic score thresholds
  - capped `pa_to_sa_ratio` heuristic
  - hard-coded `calculateGameScore` weights
  - direct client-side Supabase fetch path against `sko_*` tables
- [Resolved 2026-03-29] Retire the unused `web/components/forge-dashboard/TopMoversCard.tsx` surface from the active dashboard composition; do not reintegrate it until a future owner rebuilds its freshness and ownership semantics intentionally.

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
