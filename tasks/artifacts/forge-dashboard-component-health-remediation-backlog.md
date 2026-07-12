# FORGE Dashboard Component Health Remediation Backlog

## Purpose

This is the running remediation backlog extracted from the component-health audit. It is intentionally grouped by repair track rather than by artifact name so implementation can proceed in coherent batches.

This file is also the required rolling backlog for newly discovered issues and optimizations during the next execution phase. New issues should be appended to the most relevant track instead of spawning one-off notes.

## Track 1: Freshness And Source Integrity

### `P0`

- Repair same-day goalie coverage for the slate and goalie bands by restoring current requested-date `goalie_start_projections` and `forge_goalie_projections` coverage.
- [Resolved in code 2026-07-11; live quarantine reconciliation remains] Repair CTPI source recency so `/api/v1/trends/team-ctpi` stops serving early-November rows as a current momentum pulse. The reader now paginates every owning table, honors the requested date, and reports the actual source date separately from computation time.
- Restore continuity for `l10` sustainability snapshots so `/api/v1/sustainability/trends` does not fall back from mid-March requests to `2026-03-07`.
- [Verified still open 2026-07-11] A paginated production read found 7,363 March `l10` rows across only 12 dates, with a 13-day 2026-03-07→2026-03-20 hole. Do not recreate historical snapshots with present-day priors without an explicit leakage-safe decision.
- [Owner-approved historical exception 2026-07-11] Preserve this gap rather than backfill it with future-leaking present-season priors. Keep historical scopes quarantined and require prospective same-day continuity evidence before promotion.
- [Production activated and verified 2026-07-11] Restore true current recency ownership for `player_trend_metrics`. Audited POST job 392 runs at 12:00 UTC; a bounded offseason probe processed 52,153 games in 17.33s and truthfully emitted no rows for the empty seven-day window.
- Repair the current NST ingest path so `/api/v1/db/update-nst-gamelog` can survive or explicitly classify Cloudflare/403 responses from `naturalstattrick.com` instead of silently leaving same-day rolling FORGE refreshes stale.

### `P1`

- [Production activated and verified 2026-07-11] Restore non-flat `trend10` behavior in team power. The production smoke writer returned 32/32 non-zero and 32 distinct values using the shared 150-day trend window.
- Reconcile current projection dates between FORGE skaters, FORGE goalies, and Start Chart so the dashboard is not mixing prior-day projections with same-day ownership.
- [Verified still open 2026-07-11] For 2026-03-29, live Start Chart serves six same-day games, but `/api/v1/forge/goalies` has zero requested-date rows and truthfully blocks a four-row fallback from 2026-03-26.
- [Owner-approved historical exception 2026-07-11] Preserve the missing historical goalie rows rather than rebuild them with later lineup/model inputs. The truthful blocked fallback remains required and the historical scope stays quarantined.

## Track 2: Correctness And Contract Repair

### `P0`

- [Operational owner activated 2026-07-12; promotion evidence pending] Distinct Vault-backed job 393 owns Top Adds weekly (`horizon=5`) projections at 10:12 UTC after daily job 308. The exposed credential was rotated across Vercel, Vault, and all 60 affected commands; same-date multi-run and blocked-missing-horizon regressions pass. Keep Top Adds red until the first prospective non-zero in-season run; never relabel scaled daily rows.
- [Resolved 2026-07-11] Repair Top Adds stable-ID projection-to-Yahoo matching so the dashboard no longer depends on normalized-name fallback as its primary ownership merge path.
- [Resolved 2026-07-11] Remove ownership-universe truncation in `/api/v1/transactions/ownership-trends`; ordered pagination now covers all 2,827 audited rows rather than the former 2,500-row slice.
- [Resolved 2026-07-11] Fix Yahoo season resolution in dashboard ownership helpers and APIs; Yahoo rows use the NHL season's starting year (March 2026 → 2025).

### `P1`

- [Resolved 2026-07-11] Align forward-position filtering between the Top Adds rail and Yahoo ownership APIs so `F` matches C/LW/RW/F tokens.
- [Resolved 2026-07-11] Correct Top Adds trend labeling so ownership movement is consistently presented as percentage points.
- Calibrate sustainability trust and heat thresholds against the live `luck_pressure` scale instead of the current collapsed badge bands.
- Align dashboard-specific player-detail add scoring with the week-mode schedule context used by the main Top Adds rail.
- Reconcile the displayed `Team Power` composite with its actual inputs so the UI does not present a broad all-in score when `computeTeamPowerScore` currently ignores trend and the extra sub-rating fields already shown beside it.
- Remove or intentionally unify the duplicated ownership-band controls between the dashboard shell and `TopAddsRail` so the page stops presenting two different discovery scopes with similar language.

## Track 3: Cron / Runbook Ownership

### `P0`

- [Production activated and verified 2026-07-11] Reordered the team-context chain to WGO job 44 at 09:35 → incremental NST team job 275 at 09:55 → CTPI job 279 at 10:10 → team power job 283 at 10:15 UTC; the separate full NST job 329 remains at 10:55.
- Reorder the goalie / projection cron chain so goalie priors are not executed ahead of the ingest and derived stages they depend on.
- [Production activated and verified 2026-07-11] `player_trend_metrics` has explicit audited POST owner job 392 at 12:00 UTC. Its bounded offseason probe processed 52,153 source games in 17.33s and emitted zero rows because no games fell in the seven-day write window; compatibility reads remain latest-eligible and truthfully blocked when stale.
- Make same-day `daily_incremental` `/api/v1/db/run-rolling-forge-pipeline` runs skip or downgrade FUT-only `update-power-play-combinations-batch` failures so `contextual_builders` does not block rolling recompute and FORGE projection execution before games start.

### `P1`

- Align the documented `rollingForgePipeline` dependency graph with the actual Start Chart and FORGE serving dependencies.
- Collapse duplicated team-power ownership where possible so serving and writer surfaces do not rely on different table-selection assumptions.
- Fix `update-wgo-averages` team-season GP lookup gaps and multi-team abbreviation parsing (`BOS, N.J`, `CHI, DET`, etc.) so warning spam does not mask whether career/three-year team-context weighting is actually degraded.

## Track 4: Degraded-State And Mixed-Cadence Safety

### `P0`

- [Resolved 2026-07-11] Add page-level mixed-date warnings for dashboard and landing surfaces when modules resolve to materially different source dates. Both routes now aggregate known panel source dates through one tested policy and warn when the spread exceeds one cadence day.
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

- [Resolved 2026-07-11] Replace request-time freshness stand-ins in CTPI and skater-power routes with true source-recency metadata.
- [Resolved 2026-07-11] Keep skater-power page requests at or below the 1,000-row PostgREST default cap; the prior 2,000-row request could silently stop after one server-capped page.
- [Production deployed and verified 2026-07-11] Page every large NST/WGO team-power read and all four CTPI writer sources in deterministic 1,000-row windows instead of accepting hidden PostgREST truncation.
- [Production applied and verified 2026-07-11] `player_trend_metrics_game_date_idx` removes the estimated 2M+-row scan/sort; `EXPLAIN ANALYZE` uses an index-only scan and completes in 2.842 ms.
- [Resolved 2026-07-11] Add explicit freshness policy entries for `/api/v1/forge/players`, `/api/v1/transactions/ownership-trends`, and `/api/v1/transactions/ownership-snapshots`.
- [Resolved 2026-07-11] Add automated verification for mixed effective dates versus rendered date labels across dashboard and landing surfaces.
- [Resolved 2026-07-11] Stop `ownership-trends` from reporting request-time `generatedAt`; the route now derives recency from the latest included timeline date and exposes map/season coverage metadata.

### `P1`

- [Resolved 2026-07-11] Add ownership-overlay reconciliation checks that distinguish:
  - healthy empty results
  - null ownership suppression
  - source truncation
  - merge failure
- [Resolved 2026-07-11] Add route continuity tests for preserving `date`, `mode`, and resolved fallback context across CTA and row-level drill-ins.
- [Resolved 2026-07-11] Add coverage-delta checks for goalie fallback behavior and projection coverage loss.
- [Resolved 2026-07-11] Fix the FORGE page-route Vitest module-resolution blocker so the route-family suites collect and pass.

## Track 6: Runtime And Optimization

### `P1`

- [Resolved 2026-07-11] Add endpoint budgets to `perfBudget.ts` for:
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
