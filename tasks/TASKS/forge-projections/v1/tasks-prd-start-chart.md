# Start Chart Daily MVP and Predictive Model — Reconciled Tasks

## Relevant Files

- `tasks/TASKS/forge-projections/v1/prd/prd-start-chart.md` - Authoritative Daily MVP contract.
- `tasks/TASKS/forge-projections/v1/prd/prd-start-chart-model.md` - Earlier architecture retained where compatible; roster bench/off-night ideas are deferred.
- `web/pages/start-chart.tsx` - Current Daily Start Chart surface.
- `web/lib/dashboard/dataFetchers.ts` - Shared Start Chart/dashboard response loading and normalization.
- `web/lib/dashboard/invariants.ts` - Runtime Start Chart response invariants.
- `web/lib/dashboard/freshness.ts` - Freshness and stale-state evaluation.
- `web/components/forge-dashboard/TeamPowerCard.tsx` - Dashboard consumer of Start Chart context.
- `web/lib/projections/` - Current FORGE player/goalie projection, roster, matchup, and metadata foundations.
- `web/pages/api/v1/db/run-rolling-forge-pipeline.ts` - Pipeline evidence for projection ownership.
- `web/lib/supabase/database-generated.types.ts` - Type evidence for starts, profiles, parameters, goalie starts, and projections.

### Notes

- This list repairs the missing pair for both Start Chart PRDs.
- `prd-start-chart.md` takes precedence where sources conflict: rankings cover one chosen date and do not apply off-night, bench-capacity, or roster sit/start adjustments.
- Reuse current FORGE projection, goalie-start, team-power, sustainability, and scoring-profile contracts before adding duplicate tables/views.
- All generated tasks remain unchecked until current code and data/runtime evidence verify them.
- Complete-table Supabase reads must paginate or use verified bounded/server-side aggregates.

## Tasks

- [ ] 1.0 Reconcile both PRDs with current Start Chart/FORGE ownership
  - [ ] 1.1 Map every requested table, view, job, utility, endpoint, UI control, metric, and acceptance criterion to current equivalents.
  - [ ] 1.2 Record requests satisfied by existing FORGE, team-power, rolling-metric, sustainability, goalie-start, or scoring-profile contracts and avoid duplicate schema.
  - [ ] 1.3 Record Daily MVP precedence: one chosen-date slate, no off-night/bench factors, deterministic output by model version.
  - [ ] 1.4 Add targeted tasks for genuine contract gaps with downstream-consumer evidence.

- [ ] 2.0 Verify and complete data/schema foundations
  - [ ] 2.1 Verify equivalents for projected/confirmed starts, scoring profiles, model parameters, player projections, predictions, outcomes, and metrics against migrations/types.
  - [ ] 2.2 Add only missing columns, constraints, indexes, RLS/API exposure, and ownership through forward migrations; breaking replacements require approval.
  - [ ] 2.3 Define stable grains/uniqueness for game-team starts, player-game-model predictions, outcomes, profiles, and parameter versions.
  - [ ] 2.4 Verify schedule, team strength by state, PP usage, player rates/usage/lines, goalie form, discipline, sustainability, and identity joins.
  - [ ] 2.5 Require pagination or server aggregates for historical player/team/goalie inputs and record coverage/freshness.

- [ ] 3.0 Verify and finish recency, usage, opponent, goalie, and distribution utilities
  - [ ] 3.1 Centralize/test decay, effective sample size, weighted dispersion, slope, shrinkage, clipping, and goalie finishing multipliers.
  - [ ] 3.2 Build/verify date-scoped schedule rows with opponent, venue, prior game, rest, and back-to-back flags.
  - [ ] 3.3 Build/verify as-of-safe team strength by 5v5/PP/PK with nearest-prior and league/season fallback.
  - [ ] 3.4 Build/verify player state rates, usage, PP1 probability, line role, recent TOI change, and position priors.
  - [ ] 3.5 Build/verify goalie save/start-share projection and uncertainty, honoring confirmed starters and fallback/source state.
  - [ ] 3.6 Implement/test Poisson means and negative-binomial selection for overdispersed stats.

- [ ] 4.0 Verify and finish deterministic daily projection math
  - [ ] 4.1 Freeze versioned baselines, clip bounds, tau defaults, position elasticities, assist shares, risk parameters, and scoring defaults.
  - [ ] 4.2 Calculate state-aware goals, assists, shots, PP production, hits, blocks, PIM, and faceoffs from baseline/trend, usage, opponent, and goalie context.
  - [ ] 4.3 Apply small-sample career/archetype shrinkage and sustainability adjustments with component/fallback metadata.
  - [ ] 4.4 Compute points-mode values from the selected profile and preserve stat means/variance for explanation and later category mode.
  - [ ] 4.5 Produce deterministic rank/ties and deliberate unavailable states for deferred categories/risk-P75 behavior.
  - [ ] 4.6 Add synthetic/seeded tests for math, fallbacks, position priors, clips, and determinism.

- [ ] 5.0 Verify and finish APIs and logging
  - [ ] 5.1 Reconcile current routes with requested projections, rankings, rates, and metrics contracts; consolidate ownership rather than overlap endpoints.
  - [ ] 5.2 Validate date, profile, mode, position, tau, risk, pagination, and model version with structured 4xx errors.
  - [ ] 5.3 Return identity, projected stats/value, PP/line role, multipliers, sources, freshness, fallbacks, and drivers in one response.
  - [ ] 5.4 Persist prediction/outcome rows idempotently and calculate MAE/MAPE with explicit samples/unavailable states.
  - [ ] 5.5 Test schema, pagination, determinism, invalid inputs, empty slate, stale/partial sources, and logging reconciliation.
  - [ ] 5.6 Verify P95 under four seconds for at least 100 players or remediate the measured blocker.

- [ ] 6.0 Verify and finish the Daily Start Chart UI
  - [ ] 6.1 Default date to today and support one-date slates with position tabs and server ranks.
  - [ ] 6.2 Render Rank, Name, Team, Opponent, goalie, one-game slate, value, PP probability/unit, line role, and honest context tags.
  - [ ] 6.3 Support date, tau, points mode, profile, and available risk controls; render unavailable states for deferred modes.
  - [ ] 6.4 Explain usage, PP1, opponent PK/defense, goalie, sustainability, freshness, and fallback priors.
  - [ ] 6.5 Handle loading, empty date, stale/partial inputs, missing goalie, failed API, and fallback-derived rows honestly.
  - [ ] 6.6 Verify keyboard/table semantics, tooltips, color-independent tags, responsive/mobile layout, URL state, and FORGE navigation.

- [ ] 7.0 Verify starter refresh, scheduling, and operator behavior
  - [ ] 7.1 Reconcile nightly/hourly requirements with cron and establish source-refresh → projection → Start Chart ordering.
  - [ ] 7.2 Verify projected goalie probability uses recent share, back-to-back, home, form, and clipping only when no stronger source exists.
  - [ ] 7.3 Provide a secured manual override with actor/time/source provenance, validation, and rollback.
  - [ ] 7.4 Add idempotent retry, partial-success classification, audit rows, counts, freshness, and actionable failures.
  - [ ] 7.5 Document environment names, schedules, backfill/smoke commands, expected rows, failures, and rollback without secrets.

- [ ] 8.0 Run end-to-end verification and synchronize ownership
  - [ ] 8.1 Run targeted unit/contract tests, TypeScript checks, and seeded-date API/UI smoke verification.
  - [ ] 8.2 Reconcile prediction sums/values and rows against inputs for representative forwards, defensemen, and goalies.
  - [ ] 8.3 Verify Dashboard/Trends/FORGE drill-ins use the same date/model/source metadata and do not mix stale recencies.
  - [ ] 8.4 Record older proposed views/tables as merged, superseded, or deferred and update both PRDs plus master records.

## NEW Tasks

- [ ] NEW 9.0 Append every verified defect, data gap, manual dependency, open model question, and optimization discovered during execution here before closure.
