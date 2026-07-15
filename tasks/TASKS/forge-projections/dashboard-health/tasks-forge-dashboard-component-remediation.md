## Relevant Files

- `tasks/prd-forge-dashboard-component-health.md` - Source PRD for the component-health program that produced this remediation tracker.
- `tasks/tasks-prd-forge-dashboard-component-health.md` - Completed audit tracker whose artifacts define the starting evidence set for this implementation phase.
- `tasks/artifacts/forge-dashboard-component-health-matrix.md` - Authoritative final status matrix for all in-scope FORGE components.
- `tasks/artifacts/forge-dashboard-component-health-remediation-backlog.md` - Rolling backlog for newly discovered bugs, optimizations, cron gaps, and verification follow-ups.
- `tasks/artifacts/forge-dashboard-observability-followups.md` - Extracted observability and verification follow-up set from the audit phase.
- `tasks/artifacts/forge-dashboard-slate-health-audit.md` - Slate baseline evidence for freshness, correctness, and degraded-state repair work.
- `tasks/artifacts/forge-dashboard-top-adds-health-audit.md` - Top Adds baseline evidence for ownership-merge, ranking-contract, and opportunity-board repair work.
- `tasks/artifacts/forge-dashboard-team-context-health-audit.md` - Team-context baseline evidence for CTPI, team-power, and mixed-date repair work.
- `tasks/artifacts/forge-dashboard-sustainability-health-audit.md` - Sustainability baseline evidence for stale snapshot, ownership overlay, and trust-label repair work.
- `tasks/artifacts/forge-dashboard-trend-movement-health-audit.md` - Trend-movement baseline evidence for freshness integrity and movement-contract repair work.
- `tasks/artifacts/forge-dashboard-goalie-health-audit.md` - Goalie baseline evidence for requested-date coverage and fallback repair work.
- `tasks/artifacts/forge-dashboard-route-family-health-audit.md` - Route-family baseline evidence for landing-preview, drill-in, and click-contract repair work.
- `tasks/artifacts/forge-dashboard-route-click-contract.md` - Routing and continuity baseline for preserving `date`, `mode`, and resolved fallback context.
- `tasks/TASKS/rules/fhfh-styles.md` - Root design-system blueprint the fourth-pass styling completion must follow.
- `web/pages/forge/dashboard.tsx` - Main dashboard route where mixed-date warnings, degraded-state treatment, and component-level truthfulness will be repaired.
- `web/pages/skoCharts.tsx` - Legacy inspiration surface whose useful concepts must be ported intentionally and whose stale math/runtime assumptions must be retired explicitly.
- `web/pages/FORGE.tsx` - Preview landing route whose preview consistency and CTA continuity need repair.
- `web/pages/forge/team/[teamId].tsx` - Team drill-in route requiring date continuity and stale CTPI safety fixes.
- `web/pages/forge/player/[playerId].tsx` - Player drill-in route requiring week-mode and route-context fixes.
- `web/components/forge-dashboard/SlateStripCard.tsx` - Slate hero component needing goalie freshness and degraded-state repairs.
- `web/components/forge-dashboard/TopAddsRail.tsx` - Top Adds component needing ownership integrity and contract fixes.
- `web/components/forge-dashboard/TeamPowerCard.tsx` - Team-context component needing CTPI freshness and mixed-date repairs.
- `web/components/forge-dashboard/SustainabilityCard.tsx` - Sustainability component needing trust-label and ownership-overlay repairs.
- `web/components/forge-dashboard/HotColdCard.tsx` - Trend-movement component needing true freshness semantics and overlay safety repairs.
- `web/components/forge-dashboard/GoalieRiskCard.tsx` - Goalie component needing coverage-loss, fallback, and requested-date truthfulness repairs.
- `web/components/forge-dashboard/ForgeRouteNav.tsx` - Shared route navigation contract that must preserve dashboard context correctly.
- `web/components/forge-dashboard/TopMoversCard.tsx` - Currently unused dashboard module that needs an explicit integrate-or-retire decision instead of remaining stale surface area.
- `web/lib/dashboard/forgeLinks.ts` - Shared FORGE route-state helper for preserving selected date, mode, and resolved fallback context across nav and drill-ins.
- `web/lib/dashboard/normalizers.ts` - Shared normalization layer where stale coercion and mixed-cadence masking currently occur.
- `web/lib/dashboard/playerOwnership.ts` - Shared Yahoo ownership helper that needs season-resolution and null-overlay repairs.
- `web/lib/dashboard/teamContext.ts` - Team-context scoring helpers whose displayed composite naming and weighting assumptions need re-validation.
- `web/lib/dashboard/topAddsRanking.ts` - Ranking helper that needs final contract cleanup once the ownership universe is fixed.
- `web/lib/dashboard/freshness.ts` - Shared dashboard freshness policy that must stop trusting request-time metadata and cover missing endpoints.
- `web/lib/dashboard/perfBudget.ts` - Shared endpoint-budget policy that still lacks explicit coverage for several ownership and FORGE endpoints.
- `web/lib/supabase/utils/statistics.ts` - Legacy sKO characteristic-scoring math that should inform explainability decisions but not silently bleed into FORGE without re-validation.
- `web/lib/supabase/utils/calculations.ts` - Legacy sKO game-score weighting surface reviewed for salvage versus retirement.
- `web/lib/supabase/utils/dataFetching.ts` - Legacy sKO page fetch path that uses direct client-side Supabase queries and must stay isolated from FORGE runtime assumptions.
- `web/pages/api/v1/start-chart.ts` - Slate-facing API whose goalie leg and date semantics need repair.
- `web/pages/api/v1/forge/players.ts` - Top Adds projection API that needs stronger freshness ownership and stable merge expectations.
- `web/pages/api/v1/forge/goalies.ts` - Goalie API whose requested-date coverage and fallback truthfulness need repair.
- `web/pages/api/team-ratings.ts` - Team-ratings API used by Team Trend Context and team drill-ins.
- `web/pages/api/v1/trends/team-ctpi.ts` - CTPI API requiring freshness, pagination, and metadata integrity fixes.
- `web/pages/api/v1/sustainability/trends.ts` - Sustainability API requiring continuity and degraded-state safety fixes.
- `web/pages/api/v1/trends/skater-power.ts` - Trend-movement API requiring true source-recency metadata and stronger stale handling.
- `web/pages/api/v1/trends/player-trends.ts` - Trend writer/readback surface that currently lacks acceptable scheduled ownership.
- `web/pages/api/v1/transactions/ownership-trends.ts` - Yahoo ownership trend API needing stable-ID, coverage, and truncation fixes.
- `web/pages/api/v1/transactions/ownership-snapshots.ts` - Yahoo ownership snapshot API needing season-alignment fixes.
- `web/styles/vars.scss` - Variable source of truth for the dashboard styling completion pass.
- `web/pages/api/v1/db/update-team-ctpi-daily.ts` - Upstream team-context writer whose schedule order currently conflicts with source freshness.
- `web/pages/api/v1/db/update-team-power-ratings.ts` - Team-power writer requiring schedule-order and source-freshness repair.
- `web/pages/api/v1/db/update-team-power-ratings-new.ts` - Alternate team-power writer that must stay aligned with the main ratings chain.
- `web/pages/api/v1/db/update-player-trend-metrics.ts` - Audited current-season player-trend writer that emits only a bounded seven-day repair window.
- `web/pages/api/v1/db/cron-report.ts` - Cron reconciliation surface that maps the new player-trend owner to its destination table.
- `web/pages/api/v1/db/update-goalie-projections-v2.ts` - Goalie-start projection writer whose schedule order is currently misaligned with the goalie pipeline.
- `web/pages/api/v1/db/update-start-chart-projections.ts` - Start Chart writer whose date semantics need to stay aligned with goalie freshness.
- `web/pages/api/v1/db/run-projection-v2.ts` - FORGE projection writer whose outputs feed Top Adds and the goalie band.
- `web/pages/api/internal/cron-auth-check.ts` - Non-mutating bearer-auth probe used to verify cron-secret rotations without invoking a production workload.
- `tasks/TASKS/cron-operations/cron-schedule.md` - Runbook and cron ownership surface that needs ordering and missing-owner fixes.
- `web/__tests__/pages/forge/dashboard.test.tsx` - Main page regression coverage that should absorb mixed-date, degraded-state, and ownership-overlay checks.
- `web/__tests__/pages/FORGE.test.tsx` - Landing-route coverage that should absorb preview consistency and CTA continuity checks.
- `web/__tests__/pages/forge/team/[teamId].test.tsx` - Team-route coverage that should absorb dashboard date continuity and stale CTPI checks.
- `web/__tests__/pages/forge/player/[playerId].test.tsx` - Player-route coverage that should absorb week-mode score and route-context checks.
- `web/lib/dashboard/freshness.test.ts` - Shared mixed-effective-date policy and daily-cadence tolerance coverage.
- `web/__tests__/pages/api/v1/trends/team-ctpi.test.ts` - CTPI pagination and source-recency contract regression coverage.
- `web/__tests__/pages/api/v1/trends/skater-power.test.ts` - Skater trend serving, source-recency, and capped-page pagination regression coverage.
- `web/__tests__/pages/api/v1/transactions/ownership-trends.test.ts` - Ownership pagination, Yahoo forward semantics, and source-recency contract coverage.
- `web/lib/power-ratings.ts` - Shared cap-safe team-rating source reads and WGO/NST normalization.
- `web/lib/power-ratings.test.ts` - Regression proving deterministic continuation after a full 1,000-row source page.
- `web/lib/trends/playerTrendCalculator.test.ts` - Regression proving incremental writes retain full-history accumulator state.
- `web/__tests__/pages/api/v1/db/update-player-trend-metrics.test.ts` - Scheduled player-trend owner and bounded repair-window coverage.
- `web/__tests__/pages/api/internal/cron-auth-check.test.ts` - Fail-closed coverage for current, stale, missing, and unconfigured cron-secret states.
- `web/supabase/migrations/20260712020553_add_player_trend_metrics_game_date_index.sql` - Narrow production-applied index for bounded latest-source-date probes.
- `tasks/artifacts/forge-dashboard-component-remediation-closeout.md` - Operational-trust closeout recording promotions, retained quarantines, verification, and the remaining weekly-horizon decision.
- `web/__tests__/components/Layout/Header.test.tsx` - Header accessibility regression corrected during the full-suite completion gate.
- `web/vitest.config.mts` - Test ownership boundary keeping Playwright `e2e/**` specs out of Vitest discovery.
- `tasks/TASKS/forge-projections/v1/prd/prd-projection-model.md` - FORGE source PRD containing a cron example that must not retain a live credential.
- `tasks/TASKS/forge-projections/v1/tasks-goalie-forge.md` - FORGE source task evidence containing a cron example that must not retain a live credential.
- `tasks/artifacts/cron-supabase-export-latest.json` - Historical cron export that must be sanitized when it contains a live credential.
- `tasks/artifacts/cron-supabase-export-2026-05-27T20-31-24Z.json` - Historical cron export requiring the same credential sanitation.
- `tasks/artifacts/cron-supabase-export-2026-06-11T13-51-45Z.json` - Historical cron export requiring the same credential sanitation.

### Notes

- This tracker is for repair and verification, not new feature expansion.
- New issues discovered while executing this tracker must be appended to `tasks/artifacts/forge-dashboard-component-health-remediation-backlog.md`.
- Quarantine removals should only happen after source evidence, route behavior, and rendered UI all reconcile.

## Tasks

- [x] 1.0 Repair freshness integrity and mixed-cadence truthfulness across the dashboard route family. Evidence: source-derived CTPI/skater dates, cap-safe pagination, page-level mixed-date warnings, truthful blocked/fallback rendering, and the owner-approved historical freshness exception below (2026-07-11).
  - [x] 1.1 Fix source-recency reporting for `/api/v1/trends/team-ctpi` and `/api/v1/trends/skater-power` so dashboard freshness does not rely on request-time timestamps. Evidence: both routes now stamp `generatedAt` from the latest included source date; CTPI also exposes requested/resolved/source/computation metadata and dashboard callers pass the selected date (2026-07-11).
  - [x] 1.2 Add page-level mixed-date detection and warnings for `web/pages/forge/dashboard.tsx` and `web/pages/FORGE.tsx` when modules resolve to materially different source dates. Evidence: shared policy tolerates one cadence day, both routes aggregate their panel dates and render a page-level warning beyond that threshold, and focused route/helper tests pass (2026-07-11).
  - [x] 1.3 Repair `l10` sustainability continuity and confirm `/api/v1/sustainability/trends` stops falling back across large mid-season gaps for current-date requests. **Owner-approved historical exception (2026-07-11):** preserve the verified 13-day 2026-03-07→2026-03-20 hole rather than recreate it with present season priors and future leakage. Historical dates remain quarantined; prospective same-day evidence is required before promotion.
  - [x] 1.4 Restore current requested-date goalie coverage for both Start Chart and FORGE goalie paths, then verify the slate and goalie bands stop relying on partial fallback dates. **Owner-approved historical exception (2026-07-11):** preserve missing 2026-03-29 FORGE-goalie rows rather than rerun with later lineup/model inputs. Start Chart is same-day; the goalie reader truthfully blocks its 2026-03-26 fallback and remains quarantined for this historical scope.
  - [x] 1.5 Re-run source-to-UI reconciliation for slate, sustainability, trend movement, and goalie surfaces after freshness repairs land. Evidence: focused route tests plus live/paginated reads verify source dates, mixed-date warnings, same-day Start Chart, and blocked historical fallback behavior; exceptioned scopes remain quarantined pending prospective evidence (2026-07-11).

- [x] 2.0 Repair ownership integrity and Top Adds contract correctness. Evidence: stable-ID-only Top Adds joins, start-year season resolution, cap-safe ownership readers, Yahoo forward semantics, explicit missing-overlay degradation, shared weekly score context, 39 focused regressions, and TypeScript/diff checks (2026-07-11).
  - [x] 2.1 Fix the projection-to-Yahoo merge contract so Top Adds and other player-discovery surfaces use stable IDs first and no longer rely on normalized-name fallback as the primary path. Evidence: dashboard and landing joins now accept only mapped NHL IDs; same-name/different-ID regression stays hidden and degraded (2026-07-11).
  - [x] 2.2 Remove ownership-source truncation and season-resolution mismatches in `/api/v1/transactions/ownership-trends.ts`, `/api/v1/transactions/ownership-snapshots.ts`, and `web/lib/dashboard/playerOwnership.ts`. Evidence: Yahoo seasons now use their starting year, 1,000-row short-page scans cover trends, and chunked bounded reads cover snapshots/mappings; production audit found 2,827 rows where the old 2,500 limit truncated 327 (2026-07-11).
  - [x] 2.3 Align dashboard ownership filters with Yahoo position semantics and ensure null ownership is treated as a degraded overlay state instead of silently filtering rows. Evidence: `F` accepts C/LW/RW/F, unmapped rows no longer impersonate NHL IDs, and Top Adds reports the hidden missing-ownership count (2026-07-11).
  - [x] 2.4 Correct the Top Adds displayed scoring/labeling contract, including point-vs-percent labeling and week-mode consistency with the player-detail route. Evidence: ownership movement renders as percentage points and player detail now uses the same shared remaining-games/off-night context as the weekly rail (2026-07-11).
  - [x] 2.5 Re-run reconciliation for Top Adds, sustainability, and trend-movement ownership overlays after the fixes land. Evidence: production baseline 2,827 Yahoo rows/1,506 IDs/70.9% stable-map coverage is now represented honestly; focused API/helper/dashboard/landing/player group passes 39/39 and TypeScript passes (2026-07-11).

- [x] 3.0 Repair team-context and trend-source cron ownership. Evidence: isolated production release `9d5cbb4`/deployment `dpl_8n73AQz5yDZAfqQWuArXUgopbVBw`, bounded writers, active dependency-ordered jobs, non-flat offseason team trends, explicit player-trend ownership, and truthful latest-eligible degradation all verified (2026-07-11).
  - [x] 3.1 Reorder team-context cron/runbook entries so NST and WGO team sources update before CTPI and team-power writers execute. Live chain verified by source-table ownership and job IDs: WGO 44 at 09:35 → incremental NST team 275 at 09:55 → CTPI 279 at 10:10 → power 283 at 10:15 UTC; full NST job 329 remains independently at 10:55 (2026-07-11).
  - [x] 3.2 Fix `/api/v1/trends/team-ctpi` pagination and freshness semantics so current rows are actually served for current dashboard dates. Evidence: ordered 1,000-row short-page scans cover the daily and four fallback source tables, bounded by the requested date; focused >1,000-row regression and TypeScript pass (2026-07-11).
  - [x] 3.3 Repair team-power trend freshness so `/api/team-ratings` stops serving flat `trend10` values for all teams on current dates. Production smoke writer upserted 32 rows for 2026-07-12 in 3.59s; the API returned 32/32 non-zero and 32 distinct `trend10` values from the shared 150-day lookback (2026-07-11).
  - [x] 3.4 Give `player_trend_metrics` an explicit scheduled owner and verify `/api/v1/trends/player-trends` and `/api/v1/trends/skater-power` are backed by current data. Production job 392 owns the audited POST at 12:00 UTC. A bounded probe processed 52,153 source games in 17.33s and emitted zero rows because the offseason seven-day window contains no games; readers resolve latest eligible 2026-05-09 and truthfully block the 64-day fallback rather than claiming current-game data (2026-07-11).
  - [x] 3.5 Re-run team-context and trend-movement reconciliation after the source and cron repairs land. CTPI returned 32 teams through 2026-06-15, team ratings returned 32 distinct current offseason trends, and skater movement returned rankings while explicitly blocking its latest-eligible 2026-05-09 fallback (2026-07-11).

- [x] 4.0 Repair degraded-state behavior and route continuity. Evidence: existing living-audit implementation already satisfies the duplicated parent requirements; the four-route focused group passes 31/31 (2026-07-11).
  - [x] 4.1 Add first-class degraded messaging for ownership-overlay failure, goalie coverage loss, and fallback-driven partial surfaces so “empty” and “stale” do not masquerade as each other. Evidence: dashboard regressions distinguish missing ownership, recent slate fallback, blocked goalie fallback, stale sustainability, and blocked skater movement from healthy empty states (2026-07-11).
  - [x] 4.2 Preserve selected dashboard `date`, `mode`, and resolved fallback context across landing previews, panel CTAs, row-level links, team drill-ins, and player drill-ins. Evidence: shared FORGE links and route tests preserve date/mode/team/position plus encoded Trends return paths across dashboard, landing, team, and player surfaces (2026-07-11).
  - [x] 4.3 Fix team drill-in date continuity and stale-CTPI presentation so current ratings chips do not mask stale momentum data. Evidence: team-detail tests cover selected-date navigation and contextual source presentation without resetting to generic routes (2026-07-11).
  - [x] 4.4 Fix player drill-in week-mode score continuity so the destination matches the Top Adds contract that sent the user there. Evidence: player-detail regression uses the shared weekly schedule context and preserves FORGE date/mode links (2026-07-11).
  - [x] 4.5 Re-run route-family reconciliation after continuity and degraded-state fixes land. Evidence: dashboard 22, landing 4, team 2, and player 3 tests pass together (31/31, 2026-07-11).

- [x] 5.0 Expand observability, reconciliation automation, and runtime-budget coverage. Evidence: all dashboard-critical endpoints now have policy/budget entries and the combined freshness/performance/ownership/route verification group passes 46/46 plus TypeScript (2026-07-11).
  - [x] 5.1 Add freshness-policy coverage in `web/lib/dashboard/freshness.ts` for FORGE players and Yahoo ownership endpoints. Evidence: projection and ownership snapshot sources fail stale at 30h; ownership trends warn at 72h; builder and audit regressions cover healthy/stale/missing states (2026-07-11).
  - [x] 5.2 Add missing endpoint budgets in `web/lib/dashboard/perfBudget.ts` for `/api/v1/forge/players`, `/api/v1/transactions/ownership-trends`, and `/api/v1/transactions/ownership-snapshots`. Evidence: explicit payload/P95 contracts and required-endpoint audit assertions pass (2026-07-11).
  - [x] 5.3 Add automated checks for mixed effective dates versus rendered date labels across dashboard and landing routes. Evidence: helper plus dashboard/landing regressions cover materially divergent source dates and rendered warning copy; focused group 30/30 and TypeScript pass (2026-07-11).
  - [x] 5.4 Add automated ownership-overlay verification that distinguishes healthy empties from null suppression, truncation, or merge failure. Evidence: combined API/helper/dashboard regressions cover >1,000-row continuation, start-year seasons, healthy empty maps, explicit null ownership, and stable-ID mismatch without name fallback (2026-07-11).
  - [x] 5.5 Add regression coverage for route continuity, resolved fallback context propagation, and goalie coverage-loss warnings. Evidence: dashboard/team/player tests preserve selected context and assert recent slate versus blocked goalie/skater fallback contracts (2026-07-11).

- [x] 6.0 Close the quarantine list and verify operational trust. Evidence: the health matrix now records 4 green/3 yellow/3 red components, retained quarantines are explicit, the full verification gate passes, and the closeout artifact identifies NEW 13 as the sole unresolved strategy fork (2026-07-11).
  - [x] 6.1 Re-audit each quarantined endpoint after its owning fixes land and remove only the endpoints that have current source evidence, correct route behavior, and truthful UI rendering. Evidence: team-context and route-contract surfaces were promoted; historical sustainability/goalie scopes, offseason trend fallback, and weekly Top Adds remain explicitly degraded or quarantined (2026-07-11).
  - [x] 6.2 Rebuild the authoritative health matrix and confirm which components can finally move to `yellow` or `green`. Evidence: `forge-dashboard-component-health-matrix.md` now reports 4 green, 3 yellow, and 3 red with per-component reasons and current operational evidence (2026-07-11).
  - [x] 6.3 Run the full verification suite, including `npm test -- --run`, `npx tsc --noEmit --pretty false`, and `npm run build`, and capture any new failures or warnings into the rolling remediation backlog. Evidence: after NEW 14 repairs, Vitest passed 399 files/1,852 tests, TypeScript passed, and the full production build completed successfully (2026-07-11).
  - [x] 6.4 Update the runbook and cron schedule documentation to reflect the repaired ownership chains and runtime-budget expectations. Evidence: `cron-schedule.md` records active jobs 44/275/279/283/329/392, their dependency order, production writer ownership, and the retained historical activation gates (2026-07-11).
  - [x] 6.5 Produce a closeout artifact summarizing what moved out of quarantine, what remains blocked, and what new optimization work should follow the trust-repair phase. Evidence: `forge-dashboard-component-remediation-closeout.md` records release/runtime evidence, promotions, retained quarantine, and the exact NEW 13 decision boundary (2026-07-11).

- [x] 7.0 Execute the fourth-pass living audit, remediation expansion, output vetting, and styling completion workflow
  - [x] 7.1 Complete the required early `web/pages/skoCharts.tsx` lineage review, recording which legacy concepts should be adopted for FORGE explainability and which legacy formulas/runtime assumptions should be explicitly retired.
  - [x] 7.2 Repair dashboard route continuity end-to-end so `ForgeRouteNav`, dashboard back-links, and player/team drill-ins preserve selected `date`, `mode`, and resolved fallback context instead of resetting users onto generic routes.
  - [x] 7.3 Resolve dashboard drill-in contract drift by deciding whether movement cards should stay inside the FORGE route family, and either route `HotColdCard` into FORGE detail context or explicitly document and style the cross-route handoff.
  - [x] 7.4 Re-audit displayed dashboard scoring contracts, including `computeTeamPowerScore` naming/weights and the duplicated ownership-band controls between the dashboard shell and `TopAddsRail`, then fix or rename any composite that overstates what its inputs actually contain.
  - [x] 7.5 Finish the page-level and component-level styling pass for `web/pages/forge/dashboard.tsx` and the individual dashboard modules using `tasks/TASKS/rules/fhfh-styles.md` plus `web/styles/vars.scss`, with special attention to rail density, spacing, hierarchy, overflow, and degraded/loading state polish.
  - [x] 7.6 Smoke-test the live FORGE/dashboard endpoint family under the stated runtime and rate-limit rules, capture any stale-table blockers that require manual catch-up, and append optimization work for any scenario that misses the `4m30s` target.
  - [x] 7.7 Perform output vetting and Chromium visual inspection for each dashboard band, append any newly discovered component/output issues, and make an explicit integrate-or-retire decision for stale dashboard surfaces such as `web/components/forge-dashboard/TopMoversCard.tsx`.
  - [x] 7.8 Repair the FORGE page-test module-resolution blocker so the route-family Vitest suites can execute again instead of failing before collection on `lib/dashboard/*` imports.
  - [x] 7.9 Teach the Trends player detail route to understand forwarded FORGE context (`date`, origin, and return path) so cross-route handoffs preserve operator context instead of becoming one-way jumps.

- [x] 8.0 **NEW — Repair skater-trend pagination against the Supabase/PostgREST page cap**
  - [x] 8.1 Use a deterministic page size at or below the documented 1,000-row default cap so a server-capped response cannot be mistaken for the final short page.
- [x] 8.2 Add a >1,000-row regression proving `/api/v1/trends/skater-power` requests the second page and retains the latest source date.

- [x] 9.0 **NEW — Replace ownership request-time freshness with source-recency metadata**
  - [x] 9.1 Derive ownership `generatedAt` from the latest included timeline date and expose requested-season, fallback, mapped, and unmapped coverage metadata.
  - [x] 9.2 Add regression coverage proving unsorted ownership timelines resolve to the latest real source date.

- [x] 10.0 **NEW — Remove hidden PostgREST truncation from team-context writers**
  - [x] 10.1 Page NST/WGO inputs in deterministic 1,000-row windows for shared team-power reads and all four CTPI writer sources.
  - [x] 10.2 Add a >1,000-row helper regression and verify the team-power/CTPI writer group with targeted tests and TypeScript.

- [x] 11.0 **NEW — Diagnose and bound unfiltered `player_trend_metrics` latest-date lookup cost**
  - [x] 11.1 Inspect live indexes and an execution plan for the unfiltered `game_date DESC LIMIT 1` shape after one service-role read hit the statement timeout while the deployed API eventually returned a row. Evidence: live plan estimates a 2,056,656-row scan plus `game_date DESC` sort; existing indexes lead with `metric_key` or `player_id` (2026-07-11).
  - [x] 11.2 Add the smallest query/index repair only if the plan proves it is needed, then record bounded read evidence without weakening trend-reader filters. Applied `player_trend_metrics_game_date_idx`; `EXPLAIN ANALYZE` now uses an index-only scan and returns one latest row in 2.842 ms with no sort. Performance advisors were captured; existing unrelated advisory backlog remains (2026-07-11).

- [x] 12.0 **NEW — Reconcile the live NST team-writer schedule discovered during production activation.** Source-table inspection proved job 275 at 09:55 is the incremental owner of CTPI's `nst_team_gamelogs_*` inputs; job 329 is a separate full refresh and was restored to 10:55 after a transient exploratory move. Final active chain and runbook are correct (2026-07-11).

- [x] 13.0 **NEW — Establish an honest production owner for Top Adds weekly (`horizon=5`) projections.** Option A is deployed; Vault-backed job 393 is active at 10:12 UTC and the first bounded offseason invocation completed as an honest zero-game no-op (2026-07-12).
  - [x] 13.1 Prove the failure shape against a succeeded production run and trace reader/writer ownership. Evidence: same run `a40bd44b-98d4-4506-a3c4-90b2efa3985f` returns 255 rows at horizon 1 and zero at horizon 5; reader requires exact `horizon_games`, and job 308 posts no horizon parameter so the writer defaults to 1 (2026-07-11).
  - [x] 13.2 Choose and document one truthful contract: produce horizons 1 and 5 under compatible run ownership, schedule a distinct verified weekly writer/read path, or explicitly disable week mode until real five-game output exists. **Owner selected option A (2026-07-11):** retain daily job 308 at 10:05 UTC for horizon 1; add a distinct Vault-backed horizon-5 job at 10:12 after the daily writer; allow same-date runs to own different horizons; never scale/relabel daily rows; keep Top Adds red until prospective non-zero in-season evidence exists.
  - [x] 13.3 Implement the selected contract, add production-like regressions, run bounded runtime verification, and re-audit Top Adds before promotion. Production commit `258cbcb` / deployment `dpl_D8gth3djEPB1JLZ6B2fAL44oETVE` is READY; 32 focused tests and TypeScript pass; job 393 returned HTTP 200 in 430 ms with `horizonGames=5`, zero games/rows, all gates PASS, and no warnings. Top Adds remains red pending the selected prospective non-zero in-season evidence gate (2026-07-12).

- [x] 14.0 **NEW — Restore the full Vitest completion gate exposed by parent 6.3.** Evidence: the stale accessible-name assertion and test-runner ownership leak were repaired; the complete suite now passes 399 files/1,852 tests (2026-07-11).
  - [x] 14.1 Align the Header assertion with the rendered accessible name `Sign In / Sign Up` without weakening the role-based interaction check. Evidence: the role-based test passes 5/5 with the rendered accessible name (2026-07-11).
  - [x] 14.2 Exclude `e2e/**` from Vitest discovery so browser specs remain owned by Playwright, then rerun the complete suite. Evidence: `web/vitest.config.mts` excludes `**/e2e/**`; Vitest passes 399 files/1,852 tests (2026-07-11).

- [x] 15.0 **NEW — Rotate the exposed cron credential and migrate FORGE projection cron ownership to Vault-backed commands.** The coordinated Vercel/Vault/cron rotation, safe auth verification, job-308 conversion, and weekly activation completed without exposing either value (2026-07-12).
  - [x] 15.1 Sanitize every tracked plaintext occurrence, verify no matching credential remains in the working tree, and record that Git history still requires rotation rather than claiming deletion repairs exposure. Evidence: six tracked runbook/PRD/task/export files were mechanically replaced with `<CRON_SECRET>`, all three JSON exports parse, targeted literal scans return zero, and Git history/60 live jobs still require rotation (2026-07-11).
  - [x] 15.2 Rotate `CRON_SECRET` across the deployed application and Supabase Vault, then prove the old value is rejected and the new value authorizes a bounded request without printing either value. Vercel updated successfully; production deployments `dpl_Fiz4diKtvLZfWQhMJECfdrj9DYfQ`, `dpl_2ujzPuxjX819xxzhLLt49ksbLoCd`, and final `dpl_D8gth3djEPB1JLZ6B2fAL44oETVE` reached READY; Vault matches the replacement; non-mutating probes returned old=401/new=200; ephemeral secret/SQL files were removed (2026-07-12).
  - [x] 15.3 Replace active job 308 with an equivalent Vault-backed command, create the option-A `horizonGames=5` job from the Vault-backed pattern, and verify both job definitions/run evidence without exposing credentials. All 60 affected commands migrated (59 remain as rotated literals after job 308 moved to Vault: 57 active/2 inactive); old occurrences are zero; jobs 308 and 393 are active, Vault-backed, 300-second POST owners at 10:05/10:12 UTC (2026-07-12).

- [x] 16.0 **NEW — Add a non-mutating cron-auth verification surface so credential rotation can be proved without refreshing the Yahoo Player Data Google Sheet.** `/api/internal/cron-auth-check` is deployed and provides the bounded fail-closed rotation contract (2026-07-12).
  - [x] 16.1 Add fail-closed current/stale/missing/unconfigured-token coverage, deploy the probe, and use it for old-secret rejection/new-secret authorization evidence without printing either value. Commit `a1b744e`, three focused tests, TypeScript, production build, and live 401/200 probes pass (2026-07-12).

- [x] 17.0 **NEW — Stop zero-game offseason projection cron runs from failing a freshness gate that has no applicable slate.** Zero-game projection runs now no-op successfully while scheduled slates retain fail-closed derived freshness (2026-07-12).
  - [x] 17.1 Skip only the projection-derived freshness query/gate on a zero-game slate, retain the blocker for scheduled slates, add both regressions, deploy, and re-run the weekly owner as a truthful no-op. Commit `258cbcb`, 32 focused tests, TypeScript, READY production build, and live HTTP 200/430 ms zero-game evidence pass (2026-07-12).

- [x] 18.0 **NEW — Prevent the retained legacy dashboard rollback from mounting data modules before URL filter hydration.** The initial-only router hydration gate preserves ordinary filter changes while eliminating duplicate today/historical reads; 24/24 dashboard tests, 40/40 combined FORGE route tests, TypeScript, and browser/server-log verification pass (2026-07-12).
