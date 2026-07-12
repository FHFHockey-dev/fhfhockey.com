## Relevant Files

- `tasks/TASKS/contextual-hockey-rankings/prd-rankings-post-alignment-gap-audit.md` - Source PRD/gap audit for this implementation task list.
- `tasks/TASKS/contextual-hockey-rankings/tasks-prd-rankings-post-alignment-gap-audit.md` - Working task list to update as implementation progresses.
- `web/pages/rankings.tsx` - Main rankings workstation, entity tab routing, snapshot panels, methodology panel, opportunity surface placement, and row-selection behavior.
- `web/components/Rankings/RankingsFilters.tsx` - Entity, metric, team, source-quality, and display controls that must stay in sync with URL/API state.
- `web/components/Rankings/PlayerMatrixTable.tsx` - Skater matrix rendering for exact/proxy metric states, opportunity badges, row explanation entry points, and Results Luck null states.
- `web/components/Rankings/GoalieMatrixTable.tsx` - Goalie matrix rendering for Relative SV%, Under Pressure, source-pending states, and future split/trend surfaces.
- `web/components/Rankings/TeamMatrixTable.tsx` - Team matrix rendering for unit-usage coverage, raw/adjusted style separation, and team opportunity/style signals.
- `web/components/Rankings/PlayerSnapshotPanel.tsx` - Skater snapshot explanation cards for exact/proxy archetypes, MCM/BEAST provenance, Results Luck null states, and opportunity flags.
- `web/components/Rankings/SplitsPanel.tsx` - Existing split comparison UI that can be reused or extended for richer comparison workflows.
- `web/lib/rankings/rankingUrlState.ts` - Canonical URL parse/serialize/request-path logic for all published metric keys and selected-entity state.
- `web/lib/rankings/availableFilters.ts` - Published filter and metric availability metadata for skaters, goalies, teams, and source-pending contracts.
- `web/lib/rankings/metricDefinitions.ts` - Skater metric registry, denominator contracts, PP-points availability, relative metrics, and methodology metadata.
- `web/lib/rankings/matrixMetricRegistry.ts` - Skater matrix grouping, default columns, exact/proxy labels, planned/unavailable states, and caveat copy.
- `web/lib/rankings/skaterCompositeMethodology.ts` - Methodology contracts for offense/defense, MCM/BEAST, archetypes, Results Luck, and source-pending components.
- `web/lib/rankings/skaterCompositeWriter.ts` - Composite writer for MCM/BEAST, archetype scores, Results Luck, and future exact formula outputs.
- `web/lib/rankings/resultsLuckSources.ts` - Results Luck source reader and provenance inputs for live/null-state explanation.
- `web/lib/rankings/skaterWindowAggregation.ts` - Rolling skater aggregation formulas, including expected shooting denominator and candidate PP points rows.
- `web/lib/rankings/playerMatrix.ts` - Skater matrix API builder, composite overlays, source metadata, Results Luck cell values, and opportunity badges.
- `web/lib/rankings/goalieMatrix.ts` - Goalie matrix aggregation, role context, source-pending contracts, and future Relative SV% / Under Pressure implementation.
- `web/lib/rankings/goalieMethodology.ts` - Goalie role, start-share, quality start, bad-start, steal, and future pressure/relative-value helpers.
- `web/lib/rankings/teamMatrix.ts` - Team matrix aggregation, unit usage, game context, raw style, source warnings, and typed `team_unit_toi` reads.
- `web/lib/rankings/teamStyleMethodology.ts` - Team raw/adjusted style contracts, game context formulas, unit usage coverage, and future coaching-style helpers.
- `web/lib/rankings/teamUnitToiBuilder.ts` - Durable team unit-TOI aggregate builder and coverage metadata source.
- `web/lib/rankings/teamUnitToiWriter.ts` - Source fetcher/upsert path for `team_unit_toi` refreshes.
- `web/lib/rankings/entityCoverageContracts.ts` - Entity-level source contracts and user-facing source caveats for goalie/team coverage.
- `web/lib/rankings/trending.ts` - Existing skater trend surface and likely input for opportunity-change detection.
- `web/lib/rankings/splits.ts` - Existing skater split comparison surface and possible base for broader comparison workflows.
- `web/lib/rankings/comparison.ts` - Versioned comparison payload builder for selected entity comparisons.
- `web/lib/rankings/adjustedImpactPromotionContract.ts` - Existing adjusted-impact promotion gate that should stay distinct from contextual defense until source controls are complete.
- `web/lib/supabase/database-generated.types.ts` - Generated Supabase types that must include `team_unit_toi` before removing `supabase as any`.
- `web/pages/api/v1/contextual-rankings/teams.ts` - Team matrix API route that should accept and verify all live team metric keys.
- `web/pages/api/v1/contextual-rankings/goalies.ts` - Goalie matrix API route for future goalie metrics and source-pending behavior.
- `web/pages/api/v1/contextual-rankings/matrix.ts` - Skater matrix API route for composite, exact metric, and opportunity-signal metadata.
- `web/pages/api/v1/contextual-rankings/trending.ts` - Existing trend API route, likely input or sibling route for opportunity detection.
- `web/pages/api/v1/contextual-rankings/comparison.ts` - Existing comparison API route to expand or wire into a row-level drawer.
- `web/pages/api/v1/db/update-team-unit-toi.ts` - Admin rebuild endpoint for `team_unit_toi`; refresh scheduling and health checks should reference it or its shared writer.
- `web/scripts/check-rankings-source-health.ts` - Source-health checker that must cover new live metrics, URL-state edge paths, sparse-live Results Luck, and selected snapshots.
- `web/scripts/check-team-unit-toi-source-health.ts` - Source-health checker for the durable team unit-TOI aggregate.
- `web/lib/rankings/rankingUrlState.test.ts` - URL parse/serialize/request-path tests for every published metric key and selected entity.
- `web/lib/rankings/availableFilters.test.ts` - Add if needed to assert published filter options match parser/API support.
- `web/components/Rankings/RankingsFilters.test.tsx` - Filter UI tests for live/source-pending options and entity-specific controls.
- `web/components/Rankings/PlayerMatrixTable.test.tsx` - Skater matrix tests for exact/proxy states, Results Luck null states, and opportunity badges.
- `web/components/Rankings/GoalieTeamMatrixTable.test.tsx` - Goalie/team matrix tests for new goalie/team metric behavior, source states, and coverage markers.
- `web/components/Rankings/PlayerSnapshotPanel.test.tsx` - Snapshot card tests for method/provenance copy and opportunity explanations.
- `web/lib/rankings/metricDefinitions.test.ts` - Metric registry tests for PP points, relative metrics, denominator contracts, and availability states.
- `web/lib/rankings/skaterCompositeMethodology.test.ts` - Methodology tests for MCM/BEAST, archetype contracts, and Results Luck.
- `web/lib/rankings/skaterCompositeWriter.test.ts` - Composite writer tests for exact formulas, PP points, archetype outputs, and Results Luck gating.
- `web/lib/rankings/goalieMatrix.test.ts` - Goalie matrix tests for Relative SV%, Under Pressure, role context, and source-pending fallbacks.
- `web/lib/rankings/teamMatrix.test.ts` - Team matrix tests for URL-restored metrics, typed `team_unit_toi`, coverage markers, and adjusted/raw style metadata.
- `web/lib/rankings/teamStyleMethodology.test.ts` - Team style tests for coverage thresholds and future adjusted-style helpers.
- `web/lib/rankings/trending.test.ts` - Existing trend tests and likely place to add opportunity-change signal fixtures.
- `web/lib/rankings/comparison.test.ts` - Comparison payload tests for row-level drawer and multi-entity comparison behavior.
- `web/__tests__/pages/rankings.test.tsx` - Page-level tests for entity workflows, tabs, snapshot/drawer behavior, and source states.
- `web/e2e/rankings.spec.ts` - Browser smoke test for restored URLs, matrix interaction, opportunity tab/badges, and entity switching.

### Notes

- Use the existing Vitest setup for unit/component tests and Playwright/Chrome for browser smoke checks where the environment supports it.
- Keep this list implementation-oriented. Source checks are included only when they unblock a build task or protect a shipped behavior.
- Do not remove source-pending states or relabel proxies as exact metrics until the required sources/formulas are implemented.
- Preserve unrelated dirty worktree changes. Check `git status --short` before editing and keep changes scoped to the rankings ecosystem.
- For Supabase schema/type work, verify the current generated type workflow before editing generated files by hand.
- Task 1.0 verification passed on 2026-06-24 with `npm test -- --run lib/rankings/rankingUrlState.test.ts lib/rankings/teamMatrix.test.ts __tests__/pages/rankings.test.tsx`, `npx tsc --noEmit --pretty false`, and `npm run check:rankings-source-health -- --baseUrl http://localhost:3103`. The expanded health check covered restored team unit metrics, Home Edge, PP Opp/G, Pen/60, sparse-live Results Luck, and dynamically selected skater/goalie/team snapshot paths.
- Task 2.0 verification passed on 2026-06-24 with `npm test -- --run lib/rankings/teamMatrix.test.ts components/Rankings/GoalieTeamMatrixTable.test.tsx __tests__/pages/rankings.test.tsx` and `npx tsc --noEmit --pretty false`. The production refresh path is `GET`/`POST /api/v1/db/update-team-unit-toi?season=20252026&snapshot_date=YYYY-MM-DD&dryRun=false` after source shift/player/PP rows land, followed by `npm run check:team-unit-toi-source-health -- --baseUrl <url> --season 20252026 --gameIds <game_id> --snapshotDate YYYY-MM-DD`; new Supabase projects may need explicit Data API exposure/grants for `team_unit_toi` per the 2026-04-28 Supabase changelog.
- Task 3.1-3.3 verification passed on 2026-06-24 with `npm test -- --run lib/rankings/skaterWindowAggregation.test.ts lib/rankings/metricDefinitions.test.ts lib/rankings/matrixMetricRegistry.test.ts lib/rankings/skaterCompositeMethodology.test.ts lib/rankings/skaterCompositeWriter.test.ts` and `npx tsc --noEmit --pretty false`. PP Points/60 is promoted from verified `rolling_player_game_metrics.pp_points_*` and `pp_toi_seconds_*` fields, exposed as a PP-only matrix option, and included in MCM/BEAST components.
- Task 3.4 verification passed on 2026-06-24 with `npm test -- --run lib/rankings/metricDefinitions.test.ts lib/rankings/skaterWindowAggregation.test.ts lib/rankings/xgDenominatorSemantics.test.ts` and `npx tsc --noEmit --pretty false`. xS% and SAX% now carry verified Fenwick/unblocked denominator metadata and reconstruction tests.
- Task 3.5 verification passed on 2026-06-24 with `npm test -- --run lib/rankings/metricDefinitions.test.ts lib/rankings/matrixMetricRegistry.test.ts` and `npx tsc --noEmit --pretty false`. Relative 5v5 GF% and xGF% remain non-live with hard source-pending required-fields contracts for matched team-without-player baselines.
- Task 3.6 verification passed on 2026-06-24 with `npm test -- --run lib/rankings/skaterCompositeMethodology.test.ts lib/rankings/skaterCompositeWriter.test.ts` and `npx tsc --noEmit --pretty false`. Shoot First, Pass First, and Play Driver remain visibly labeled as Proxy while exact formula source requirements are recorded.
- Task 3.7-3.8 verification passed on 2026-06-24 with `npm test -- --run lib/rankings/playerMatrix.test.ts components/Rankings/PlayerSnapshotPanel.test.tsx components/Rankings/PlayerMatrixTable.test.tsx` and `npx tsc --noEmit --pretty false`. Results Luck null states now explain season-window and blocked-baseline reasons in matrix/snapshot metadata, and the full skater parity regression set is covered.
- Task 4.0 verification passed on 2026-06-24 with `npm test -- --run lib/rankings/adjustedImpactPromotionContract.test.ts lib/rankings/metricDefinitions.test.ts lib/rankings/matrixMetricRegistry.test.ts components/Rankings/PlayerSnapshotPanel.test.tsx` and `npx tsc --noEmit --pretty false`. Offense/Defense remain contextual descriptive composites, adjusted-impact outputs stay diagnostic-only, and promotion gates remain blocked until missing controls are verified.
- Task 5.2-5.4 and 5.6 verification passed on 2026-06-24 with `npm test -- --run lib/rankings/goalieMatrix.test.ts __tests__/pages/api/v1/contextual-rankings-available-filters.test.ts components/Rankings/GoalieTeamMatrixTable.test.tsx __tests__/pages/rankings.test.tsx lib/rankings/rankingUrlState.test.ts` and `npx tsc --noEmit --pretty false`. Relative SV% and Under Pressure remain source-pending with exact missing fields, Value Signal copy is explicitly not Relative SV%, and Home Edge was restored to available team filters after the regression test exposed the drift.
- Task 5.1, 5.2, and 5.5 verification passed on 2026-06-24 with `npm test -- --run lib/rankings/goalieMatrix.test.ts lib/rankings/rankingUrlState.test.ts __tests__/pages/api/v1/contextual-rankings-available-filters.test.ts components/Rankings/GoalieTeamMatrixTable.test.tsx __tests__/pages/rankings.test.tsx` and `npx tsc --noEmit --pretty false`. Relative SV% is now live as a selected-window 5v5 goalie save percentage minus same-team other-goalie baseline with low baseline sample gating; Under Pressure remains source-pending because the schema has rush/rebound aggregates but not the required pressure bucket plus screen/traffic labels.
- Task 6.0 verification passed on 2026-06-24 with `npm test -- --run lib/rankings/trending.test.ts __tests__/pages/rankings.test.tsx` and `npx tsc --noEmit --pretty false`. The Trending response now returns typed opportunity signals and contracts; TOI Up, Usage Drop, and Shot Volume Spike are live from last-5 vs last-20 skater windows, while PP promotion, line/pair promotion, goalie starter-share, and team unit-concentration changes remain explicit source-pending contracts until history inputs exist.
- Task 7.0 verification passed on 2026-06-24 with `npm test -- --run lib/rankings/teamStyleMethodology.test.ts lib/rankings/teamMatrix.test.ts components/Rankings/GoalieTeamMatrixTable.test.tsx __tests__/pages/rankings.test.tsx` and `npx tsc --noEmit --pretty false`. Team style rows now carry raw/contextual display metadata, adjusted target/source-pending contracts, and coverage-qualified unit-usage labels; UI copy avoids coach/system claims until score, venue, rest, opponent, and roster controls are available.
- Recommended targeted verification after implementation:

```bash
npm test -- --run lib/rankings/rankingUrlState.test.ts components/Rankings/RankingsFilters.test.tsx __tests__/pages/rankings.test.tsx
npm test -- --run lib/rankings/metricDefinitions.test.ts lib/rankings/skaterCompositeMethodology.test.ts lib/rankings/skaterCompositeWriter.test.ts
npm test -- --run lib/rankings/goalieMatrix.test.ts lib/rankings/teamMatrix.test.ts components/Rankings/GoalieTeamMatrixTable.test.tsx
npm run check:rankings-source-health
npx tsc --noEmit --pretty false
```

## Tasks

- [x] 1.0 Fix live metric state integrity and source-health coverage
  - [x] 1.1 Update `parseTeamMetric` in `rankingUrlState.ts` so `forward_top_load_index`, `defense_pair_top_load_index`, and `pp1_pp2_usage_share` round-trip from URL query to request path without falling back to `off_rating`.
  - [x] 1.2 Add URL-state tests proving all published team metric options from `availableFilters.ts` are accepted by the parser and serialized into `buildTeamMatrixRequestPath`.
  - [x] 1.3 Add a direct API/request parser test proving `parseTeamMatrixRequest` still accepts every published team metric key.
  - [x] 1.4 Update page/filter tests so Quick Info, active sort state, and restored URL state show the requested team unit metric after refresh.
  - [x] 1.5 Expand `check-rankings-source-health.ts` to cover team unit metrics, Home Edge, PP Opp/G, Pen/60, sparse-live Results Luck, and selected snapshot paths.
  - [x] 1.6 Add a browser smoke path for `/rankings?entity=teams&team_metric=forward_top_load_index` that verifies the active metric is Forward Top Load, not Off Rating.

- [x] 2.0 Harden the `team_unit_toi` data contract
  - [x] 2.1 Regenerate or update Supabase generated types so `team_unit_toi` is present in `database-generated.types.ts` with Row/Insert/Update shapes.
  - [x] 2.2 Remove `(supabase as any)` reads for `team_unit_toi` from `teamMatrix.ts` and `teamUnitToiWriter.ts` where typed table access is available.
  - [x] 2.3 Add compile-time and unit coverage for typed `team_unit_toi` reads, latest snapshot resolution, and null/no-source behavior.
  - [x] 2.4 Add per-team/per-metric coverage fields to team unit usage aggregation, including resolved games, latest date, and coverage status for forward, defense, and PP metrics.
  - [x] 2.5 Surface unit-usage coverage in team matrix cells and snapshot notes so N/A distinguishes missing coverage from low/no top-load signal.
  - [x] 2.6 Document or implement the production refresh path for `team_unit_toi`, including how the rebuild endpoint/checker should be triggered after new source data lands.
  - [x] 2.7 Update methodology dates/source metadata for team unit usage so they match the live migration/upsert date and source version.

- [x] 3.0 Close skater original-formula parity gaps
  - [x] 3.1 Verify the best source path for contextual `pp_points_per_60` rows, including whether sustainability/projection PP points sources can be safely mapped into rankings windows and peer groups.
  - [x] 3.2 Implement or explicitly block `pp_points_per_60` in `metricDefinitions.ts`, `skaterWindowAggregation.ts`, and durable ranking writer/reader paths with tests for all supported windows/strengths.
  - [x] 3.3 If `pp_points_per_60` is verified, add it back into MCM/BEAST component inputs and update methodology, writer, matrix, snapshot, and tests; otherwise rename/label MCM/BEAST consistently as current-contract variants.
  - [x] 3.4 Resolve the `expected_shooting_percentage` denominator contract by confirming the shot universe, updating denominator metadata, and adding reconstruction tests for xS%/SAX%.
  - [x] 3.5 Implement team-without-player baselines for `relative_5v5_gf_percentage` and `relative_5v5_xgf_percentage`, or add a hard source-pending gate with exact missing fields and no selectable live state.
  - [x] 3.6 Convert Shoot First, Pass First, and Play Driver from threshold proxies to original-formula scores once their share/relative inputs exist; keep the visible `Proxy` label until the exact implementation ships.
  - [x] 3.7 Improve Results Luck null-state metadata so season or blocked rows explain why the index is unavailable at the cell/snapshot level.
  - [x] 3.8 Add regression tests for PP points, exact/proxy archetype status, relative metrics, denominator metadata, and Results Luck null-state explanations.

- [x] 4.0 Preserve the adjusted-impact boundary while preparing future promotion
  - [x] 4.1 Keep current Offense Rating and Defense Rating labeled as contextual/descriptive composites rather than adjusted impact metrics.
  - [x] 4.2 Audit existing adjusted-impact source controls against `adjustedImpactPromotionContract.ts` and encode any newly available rest, zone-start, opponent, or teammate controls into the promotion gate.
  - [x] 4.3 Add methodology metadata that distinguishes descriptive form, contextual composite, diagnostic adjusted impact, and promotion-ready adjusted impact.
  - [x] 4.4 Add UI copy or methodology-panel grouping that explains why current Defense Rating is not isolated defensive talent.
  - [x] 4.5 Add tests proving adjusted-impact metrics remain hidden or diagnostic-only until all promotion gates pass.

- [x] 5.0 Implement goalie context-relative gaps
  - [x] 5.1 Design and implement a team-without-goalie save percentage baseline for matched season/window/team/strength contexts.
  - [x] 5.2 Promote `relative_save_percentage` from source-pending to live only after baseline source rows, sample requirements, and no-leakage tests pass.
  - [x] 5.3 Update `goalie_value_signal` copy so it does not imply the original Relative SV% MVP signal until Relative SV% is live.
  - [x] 5.4 Verify whether pressure bucket source rows exist for rush, rebound, screen/traffic, or pressure labels; keep Under Pressure disabled if required fields are absent.
  - [x] 5.5 If pressure fields are verified, implement `under_pressure_profile` metric cells, role/snapshot explanations, and source metadata.
  - [x] 5.6 Add goalie tests for Relative SV%, Under Pressure, source-pending disabled options, low-sample behavior, and selected-goalie snapshot paths.

- [x] 6.0 Make opportunity-change detection a first-class rankings surface
  - [x] 6.1 Define typed opportunity signals for TOI Up, PP1 Promotion, PP2-to-PP1 threat, Line Promotion, Pair Promotion, Shot Volume Spike, Usage Drop, goalie starter-share rising/falling, team top-load change, and PP unit concentration change.
  - [x] 6.2 Build a reusable opportunity signal calculator using existing trending, deployment, goalie role, and team unit-usage inputs.
  - [x] 6.3 Add an API surface or extend the existing Trending response to return opportunity signals with severity, baseline window, current window, evidence values, and source state.
  - [x] 6.4 Add UI affordances for opportunity signals in the matrix rows, snapshot panels, or a dedicated Opportunity tab without overcrowding the main matrix.
  - [x] 6.5 Add source-pending/null-state behavior for opportunity signals when required deployment, PP, goalie, or unit-usage inputs are missing.
  - [x] 6.6 Add tests covering each opportunity signal type, severity threshold, missing-source state, and UI rendering.

- [x] 7.0 Mature team coaching-style interpretation
  - [x] 7.1 Split team style metadata into raw/contextual and adjusted targets so the UI can display both without conflating them.
  - [x] 7.2 Add coverage-qualified top-load/roll-line labels that require minimum resolved forward/defense games before ranking or naming a coaching style.
  - [x] 7.3 Add score-adjusted and venue-adjusted 5v5 style inputs if existing source tables provide the required score-state and home/away context.
  - [x] 7.4 Add rest/fatigue, period split, PP dependency, PK aggression, shot-location, defense activation, and opponent-adjusted contracts as live metrics only where source fields are verified.
  - [x] 7.5 Update team matrix and snapshot copy to distinguish environment descriptors from coach/system claims.
  - [x] 7.6 Add tests for raw-vs-adjusted style labels, coverage thresholds, lower-is-better team metrics, and source-pending team style contracts.

- [x] 8.0 Expand comparison and entity secondary workflows
  - [x] 8.1 Decide whether the richer explanation/comparison experience should be a row drawer, side panel mode, or expanded snapshot panel.
  - [x] 8.2 Wire existing `comparison.ts` payloads into the chosen UI for skater matrix rows, including raw value, percentile, peer group, deployment, sample, source quality, and opportunity signal evidence.
  - [x] 8.3 Add row-level explanation affordances for goalie and team matrix rows using their entity-specific metrics and source caveats.
  - [x] 8.4 Evaluate whether goalie/team Trending, Splits, or Deployment Tiers should become live in this pass; keep unsupported tabs explicit if not implemented.
  - [x] 8.5 Add tests for comparison payload rendering, selected-entity persistence, row drawer/snapshot interaction, and unsupported secondary-tab states.
  - Verification: implemented the comparison experience as an expanded right-side context rail beside the existing snapshots; skater rows now render selected-player comparison metrics plus live Trending opportunity evidence when present, while goalie/team rows render entity-specific comparison samples, metric values, source quality, and caveats. Goalie/team secondary tabs remain explicit Source Pending states. Passed `npm test -- --run __tests__/pages/rankings.test.tsx lib/rankings/comparison.test.ts && npx tsc --noEmit --pretty false`.

- [x] 9.0 Final verification and documentation
  - [x] 9.1 Run targeted unit/component tests for URL state, filters, skater formulas, goalie matrix, team matrix, opportunity signals, and comparison UI.
  - [x] 9.2 Run `npx tsc --noEmit --pretty false` from `web` and resolve all rankings-related type errors.
  - [x] 9.3 Run expanded rankings source-health checks against a local server and confirm every visible live metric has source/methodology metadata.
  - [x] 9.4 Run browser smoke verification for restored team metric URLs, skater formula/proxy labels, goalie source-pending/live metrics, team coverage caveats, opportunity signals, and comparison UI.
  - [x] 9.5 Update this task list with completed verification notes, remaining source-pending decisions, and any intentionally deferred items.
  - Verification: final targeted test batches passed: `npm test -- --run lib/rankings/rankingUrlState.test.ts components/Rankings/RankingsFilters.test.tsx __tests__/pages/rankings.test.tsx`; `npm test -- --run lib/rankings/metricDefinitions.test.ts lib/rankings/skaterCompositeMethodology.test.ts lib/rankings/skaterCompositeWriter.test.ts lib/rankings/skaterWindowAggregation.test.ts lib/rankings/matrixMetricRegistry.test.ts lib/rankings/playerMatrix.test.ts components/Rankings/PlayerMatrixTable.test.tsx components/Rankings/PlayerSnapshotPanel.test.tsx`; `npm test -- --run lib/rankings/goalieMatrix.test.ts lib/rankings/teamMatrix.test.ts lib/rankings/teamStyleMethodology.test.ts lib/rankings/teamUnitToiBuilder.test.ts components/Rankings/GoalieTeamMatrixTable.test.tsx lib/rankings/trending.test.ts lib/rankings/comparison.test.ts __tests__/pages/api/v1/contextual-rankings-available-filters.test.ts`; and a final focused regression pass `npm test -- --run __tests__/pages/rankings.test.tsx lib/rankings/comparison.test.ts lib/rankings/trending.test.ts components/Rankings/GoalieTeamMatrixTable.test.tsx`.
  - Verification: `npx tsc --noEmit --pretty false` passed from `web`.
  - Verification: `npm run check:rankings-source-health -- --baseUrl http://localhost:3103` passed. Expected warnings remain for sparse Results Luck and PP goals fallback ranking rows, partial goalie NST 5v5 coverage, raw/contextual team style, style-vs-power snapshot date differences, and partial forward/defense `team_unit_toi` coverage. Live metric metadata includes skater `contextual_rankings_v1`, goalie `goalie_rankings_v1_relative_sv_v1`, and team `team_rankings_v1_team_unit_toi_v1`.
  - Verification: Chrome smoke passed against `http://127.0.0.1:3103`. Confirmed skater rankings comparison rail with Opportunity Evidence, skater Trending live opportunity signals including `SHOT VOLUME SPIKE`, goalie Relative SV% live matrix and comparison context, goalie Trending explicit Source Pending state, restored team `forward_top_load_index` URL with Forward Top Load active, team comparison context, and raw/contextual team style caveats. Headless Playwright could not be used in this macOS sandbox because Chromium failed to launch with a Mach permission error, so the final browser pass used the approved Chrome extension path.
  - Deferred source-pending decisions: goalie Under Pressure remains source-pending until pressure bucket plus screen/traffic labels exist; skater relative 5v5 GF% and xGF% remain source-pending until team-without-player baselines exist; Shoot First, Pass First, and Play Driver remain `Proxy` until exact original-formula inputs exist; adjusted impact remains diagnostic-only until promotion gates pass; team score/venue/rest/opponent/coach-style adjusted metrics remain source-pending; goalie/team secondary tabs remain explicit Source Pending except current Rankings; WAR remains planned/source-pending; opportunity signals are live for TOI Up, Usage Drop, and Shot Volume Spike, while PP promotion, line/pair promotion, goalie starter-share, team top-load change, and PP unit concentration change remain source-pending until historical deployment/unit inputs are available.
