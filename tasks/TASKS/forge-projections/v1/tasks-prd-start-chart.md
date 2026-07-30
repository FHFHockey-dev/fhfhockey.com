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

- [x] 1.0 Reconcile both PRDs with current Start Chart/FORGE ownership
  - [x] 1.1 Map every requested table, view, job, utility, endpoint, UI control, metric, and acceptance criterion to current equivalents.
  - [x] 1.2 Record requests satisfied by existing FORGE, team-power, rolling-metric, sustainability, goalie-start, or scoring-profile contracts and avoid duplicate schema.
  - [x] 1.3 Record Daily MVP precedence: one chosen-date slate, no off-night/bench factors, deterministic output by model version.
  - [x] 1.4 Add targeted tasks for genuine contract gaps with downstream-consumer evidence.
  - Evidence (1.1–1.4, 2026-07-22): the canonical Sustainability/Trends audit maps Start Chart as a one-date UI adapter over FORGE, classifies every current/retired table, route, writer, caller, and dependency, and preserves genuine rolling/provenance/result gaps under existing NEW 10–13 rather than duplicating schema or model ownership.

- [x] 2.0 Verify and complete data/schema foundations
  - [x] 2.1 Verify equivalents for projected/confirmed starts, scoring profiles, model parameters, player projections, predictions, outcomes, and metrics against migrations/types.
  - [x] 2.2 Add only missing columns, constraints, indexes, RLS/API exposure, and ownership through forward migrations; breaking replacements require approval.
  - [x] 2.3 Define stable grains/uniqueness for game-team starts, player-game-model predictions, outcomes, profiles, and parameter versions.
  - [x] 2.4 Verify schedule, team strength by state, PP usage, player rates/usage/lines, goalie form, discipline, sustainability, and identity joins.
  - [x] 2.5 Require pagination or server aggregates for historical player/team/goalie inputs and record coverage/freshness.
  - Evidence (2.1–2.5, 2026-07-27): schema/type/runtime traces identify `forge_runs`, player/team/goalie projections, goalie starts, games, CTPI, mappings, scoring config, results, and accuracy ownership. Current Start Chart needs no duplicate migration: `goalie_start_projections` is uniquely keyed by game/player, canonical projections are keyed by run/game/entity/horizon and reference `forge_runs`, and the read-time scoring profile is versioned independently. Prediction-result repair remains owned by 5.4/B-SUST-AUD NEW 13, while tau/elasticity/model-parameter promotion remains owned by 4.1; neither is misclassified as missing wrapper schema. Complete/bounded readers plus requested/resolved/source metadata remain recorded.

- [x] 3.0 Verify and finish recency, usage, opponent, goalie, and distribution utilities. Canonical FORGE owns the date-scoped schedule/team/player/goalie inputs, while shared finite-safe math now owns recency, shrinkage, clipping, count means, and evidence-gated distribution selection without creating a second Start Chart engine (verified 2026-07-27).
  - [x] 3.1 Centralize/test decay, effective sample size, weighted dispersion, slope, shrinkage, clipping, and goalie finishing multipliers.
  - Evidence (3.1, 2026-07-27): `web/lib/math/utils.ts` now owns finite-safe exponential decay/Kish effective-sample bookkeeping, decay-weighted population dispersion, index-preserving OLS slope, explicit effective-sample/prior shrinkage, clipping, and bounded goalie finishing primitives. The focused deterministic suite passes 7/7 and full TypeScript passes; no projection formula, model parameter, persistence, or second Start Chart engine changed.
  - [x] 3.2 Build/verify date-scoped schedule rows with opponent, venue, prior game, rest, and back-to-back flags.
  - [x] 3.3 Build/verify as-of-safe team strength by 5v5/PP/PK with nearest-prior and league/season fallback.
  - [x] 3.4 Build/verify player state rates, usage, PP1 probability, line role, recent TOI change, and position priors.
  - [x] 3.5 Build/verify goalie save/start-share projection and uncertainty, honoring confirmed starters and fallback/source state.
  - Evidence (3.2–3.5, 2026-07-22): the eight-stage FORGE dependency trace and exact player/team/goalie cohort verify schedule/rest, state-aware team context, rolling usage/role/PP inputs, goalie-start priors, fallback/source state, and uncertainty as canonical inputs consumed—not reimplemented—by Start Chart.
  - [x] 3.6 Implement/test Poisson means and negative-binomial selection for overdispersed stats.
  - Evidence (3.6, 2026-07-27): the shared math owner converts non-negative rate/TOI/context inputs into finite Poisson means, defaults to Poisson when recent mean/variance evidence is absent or unusable, requires Fano above the PRD threshold, and fits negative-binomial size as `mean² / (variance - mean)`. The focused suite passes 11/11, full TypeScript, targeted lint, and formatting. Canonical FORGE—not Start Chart—owns any future per-stat dispersion integration.

- [x] 4.0 Verify and finish deterministic daily projection math
  - [x] 4.1 Freeze versioned baselines, clip bounds, tau defaults, position elasticities, assist shares, risk parameters, and scoring defaults.
  - [x] 4.2 Calculate state-aware goals, assists, shots, PP production, hits, blocks, PIM, and faceoffs from baseline/trend, usage, opponent, and goalie context.
  - [x] 4.3 Apply small-sample career/archetype shrinkage and sustainability adjustments with component/fallback metadata.
  - [x] 4.4 Compute points-mode values from the selected profile and preserve stat means/variance for explanation and later category mode.
  - Evidence (4.3/4.4, 2026-07-22): FORGE owns low-sample shrinkage, sustainability/context drivers, raw stat means, and uncertainty; the versioned `fhfh-default-skater-v1` read-time adapter computes visible G/A/PPP/SOG/HIT/BLK points without rewriting canonical projections.
  - [x] 4.5 Produce deterministic rank/ties and deliberate unavailable states for deferred categories/risk-P75 behavior.
  - [x] 4.6 Add synthetic/seeded tests for math, fallbacks, position priors, clips, and determinism.
  - Evidence (4.5/4.6, 2026-07-23): the API assigns deterministic competition ranks per eligible position from canonical points/start-probability values, returns a versioned ranking contract with category/P75 unavailable states, and the UI consumes server ranks. Focused API/UI coverage passes 13/13; the canonical synthetic FORGE math/fallback/position-prior/clip/determinism cohort passes 88/88; full TypeScript passes.
  - Architecture disposition (4.0–4.2, 2026-07-30): the owner-approved wrapper boundary closes these rows through canonical FORGE rather than a duplicate Start Chart model. `forge_player_projections` supplies versioned state-aware stat means and source/fallback context; `goalie_start_projections` supplies the shared start prior; `fhfh-default-skater-v1` supplies read-time scoring. Unsupported tau/risk/alternate-model controls remain explicit `422` unavailable states, so closure does not invent or settle a second parameter contract.

- [x] 5.0 Verify and finish APIs and logging
  - [x] 5.1 Reconcile current routes with requested projections, rankings, rates, and metrics contracts; consolidate ownership rather than overlap endpoints.
  - [x] 5.2 Validate date, profile, mode, position, tau, risk, pagination, and model version with structured 4xx errors.
  - [x] 5.3 Return identity, projected stats/value, PP/line role, multipliers, sources, freshness, fallbacks, and drivers in one response.
  - [x] 5.4 Persist prediction/outcome rows idempotently and calculate MAE/MAPE with explicit samples/unavailable states.
  - [x] 5.5 Test schema, pagination, determinism, invalid inputs, empty slate, stale/partial sources, and logging reconciliation.
  - Evidence (5.1/5.3/5.5, 2026-07-22): `/api/v1/start-chart` is the sole slate reader over canonical FORGE outputs; focused route/normalizer/scoring tests cover canonical-source metadata, requested/resolved fallback, empty data, response invariants, versioned scoring, and retired-materializer exclusion.
  - [x] 5.6 Verify P95 under four seconds for at least 100 players or remediate the measured blocker.
  - Evidence (5.2/5.6, 2026-07-23): the canonical reader validates real dates, points/default-profile/latest-run ownership, positions, optional bounded pagination, and explicitly unavailable tau/risk/alternate-model controls before data access. Focused structured-error/filter/pagination coverage passes; ten value-free Production reads of the 351-player 2026-03-14 slate measured 257 ms P95 against the four-second requirement.
  - Architecture disposition (5.0/5.4, 2026-07-30): Start Chart owns no prediction/outcome writer. Canonical FORGE owns run-keyed projection persistence and the accuracy route owns exact result replacement plus explicit ineligible/unavailable states; Start Chart reads the latest succeeded run and exposes its identity without duplicating history. Remaining FORGE historical reconstruction/application gates stay open in their owning initiatives and are not re-counted here.

- [x] 6.0 Verify and finish the Daily Start Chart UI
  - [x] 6.1 Default date to today and support one-date slates with position tabs and server ranks.
  - [x] 6.2 Render Rank, Name, Team, Opponent, goalie, one-game slate, value, PP probability/unit, line role, and honest context tags.
  - [x] 6.3 Support date, tau, points mode, profile, and available risk controls; render unavailable states for deferred modes.
  - [x] 6.4 Explain usage, PP1, opponent PK/defense, goalie, sustainability, freshness, and fallback priors.
  - [x] 6.5 Handle loading, empty date, stale/partial inputs, missing goalie, failed API, and fallback-derived rows honestly.
  - Evidence (6.1/6.2/6.4/6.5, 2026-07-22): the current page and production trace verify today/one-date selection, positions/ranks, game/team/opponent/goalie/value/role context, returned scoring/source/fallback metadata, and explicit loading/error/no-games/no-players/fallback presentation.
  - [x] 6.6 Verify keyboard/table semantics, tooltips, color-independent tags, responsive/mobile layout, URL state, and FORGE navigation.
  - Evidence (6.3/6.6, 2026-07-25): the page exposes the canonical points/profile contract, synchronizes the selected date into the URL, and explicitly identifies tau, category, and P75 risk controls as FORGE-owned/unavailable rather than inventing a second projection engine. A populated 351-player browser pass proves native labeled controls and game buttons, keyboard metric disclosure, text-bearing context/stat tags, direct FORGE navigation, 1440×900 desktop and 390-class mobile reflow, one-column mobile rankings, horizontally scrollable game cards, and zero body overflow. The duplicate player/card and chart-dot key defects discovered during the pass are repaired under NEW 9.2/9.3; the final desktop/mobile runtime log set is empty.

- [x] 7.0 Verify starter refresh, scheduling, and operator behavior
  - [x] 7.1 Reconcile nightly/hourly requirements with cron and establish source-refresh → projection → Start Chart ordering.
  - [x] 7.2 Verify projected goalie probability uses recent share, back-to-back, home, form, and clipping only when no stronger source exists.
  - Evidence (7.1/7.2, 2026-07-22): the canonical eight-stage pipeline/caller map records source→rolling/team/goalie→FORGE→accuracy ordering, and the goalie trace distinguishes shared start prior from FORGE scenario probability with recent/season share, schedule context, fallback, and clipping ownership.
  - [x] 7.3 Remove the obsolete manual-override requirement. Start Chart is a read-only presentation wrapper over canonical FORGE and must not own a second write or projection-control path (owner-approved 2026-07-30).
  - [x] 7.4 Add idempotent retry, partial-success classification, audit rows, counts, freshness, and actionable failures.
  - Evidence (7.4, 2026-07-27): the secured canonical coordinator accepts bounded reruns, and its implicit schedule resumes durable failed/running projection work through operation-key, cursor, lease, revision-CAS, and fixed failure-code state. Blocking-stage failures fail closed; explicit bounded runs return stage/step `200` or intentional `207` receipts with skipped-dependency reasons. `withCronJobAudit` owns the run audit, while `scanSummary` reports row counts, source dates, freshness/preflight blockers, and actionable stage notes. The exact coordinator/state/audit cohort passes 3 files/19 tests; independently owned child-route authorization remains under B-CRON-NST rather than being overclaimed here.
  - [x] 7.5 Document environment names, schedules, backfill/smoke commands, expected rows, failures, and rollback without secrets.
  - Evidence (7.5, 2026-07-23): `web/README.md` now records the public read contract, server-only environment names, active 10:05 UTC schedule, daily/overnight/targeted modes, value-free smoke, bounded authorized repair, 200/207 interpretation, audit/count/freshness checks, and non-destructive rollback boundary without embedding credentials.

- [x] 8.0 Run end-to-end verification and synchronize ownership
  - [x] 8.1 Run targeted unit/contract tests, TypeScript checks, and seeded-date API/UI smoke verification.
  - [x] 8.2 Reconcile prediction sums/values and rows against inputs for representative forwards, defensemen, and goalies.
  - [x] 8.3 Verify Dashboard/Trends/FORGE drill-ins use the same date/model/source metadata and do not mix stale recencies.
  - [x] 8.4 Record older proposed views/tables as merged, superseded, or deferred and update both PRDs plus master records.
  - Evidence (8.2–8.4, 2026-07-22): exact May-10 player/team/goalie arithmetic, Start Chart UI scoring, canonical run/date/source metadata, and cross-surface links reconcile; the audit marks the former writer/`player_projections` path retired and all older requested views as reused, merged, deferred, or absent without creating duplicates.
  - Evidence (8.1, 2026-07-23): the focused API/UI group passes 2 files/12 tests, full TypeScript passes, targeted lint has zero errors, Prettier and bundled-Node-24 Sass pass, and value-free seeded Production reads return 182, 351, and 91 players across three dates. The separate full browser accessibility/responsive gate remains open under 6.6.

## NEW Tasks

- [x] NEW 9.0 Append every verified defect, data gap, manual dependency, open model question, and optimization discovered during execution here before closure. Evidence: NEW 9.1–9.4 record and close every server-rank, populated-key, chart-key, and deployment-drift finding; the final canonical-wrapper audit finds no additional Start Chart-owned gap (closed 2026-07-30).
- [x] NEW 9.1 **P2 missing runtime server-rank contract:** source controls claimed server ranks while the API returned no ranks and the UI independently sorted floating-point values. One versioned API contract now owns eligible-position competition ranks, deterministic player-ID tie order, multi-position membership, null-score exclusion, and explicit category/P75 deferral; focused regressions pass (closed 2026-07-23).
- [x] NEW 9.2 **P1 duplicate populated-slate React keys broke matchup filtering:** a real 351-player slate contains same-player projections for multiple team/game contexts. Player-only keys emitted duplicate-key errors and left stale off-game cards after selecting a matchup. Keys now include player, team, and opponent identity; the focused duplicate fixture and populated mobile/desktop filter prove off-game rows disappear with empty final runtime logs (closed 2026-07-25).
- [x] NEW 9.3 **P2 Recharts dot props spread the reserved React key:** the populated CTPI chart emitted a development runtime error because the renderer spread a props object containing `key`. The renderer now passes `key` directly and spreads only remaining props; the final populated browser log set is empty (closed 2026-07-25).
- [x] NEW 9.4 **P1 Production Start Chart deployment drift:** guarded recovery commit `96ccea804b90b5a6f482de45f6b7931253725311` is READY/Production as `dpl_HCFwiK4yAPeXUG3QzC3R28NtYvsc`. The value-free `2026-03-14` API returned 200 with 351 players, 32 CTPI points, and 14 games; populated 1440×900 and 390×844 browser repeats rendered all 14 matchups with no application error or body overflow. The bounded deployment-scoped runtime-error/5xx queries are empty (closed 2026-07-30).
