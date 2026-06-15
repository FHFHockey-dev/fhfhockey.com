# PRD: Contextual Hockey Rankings V2 Pass

## New Chat Handoff Prompt

Read this PRD first, then inspect the referenced files before coding. The goal is to continue the contextual hockey rankings product from the current `/rankings` workstation state toward the original vision: a fast, trustworthy, analyst-grade ranking surface for skaters, goalies, and teams, backed by precomputed/contextual ranking data rather than expensive page-time aggregation.

Do not invent metric values. If a metric cannot be computed from verified sources, keep or add an explicit `Source Pending`, `Unavailable`, `Low Sample`, or `Stale Source` state with tests. Use additive/reversible migrations. Preserve current consumers unless a breaking change is explicitly approved.

## Overview

The current `web/pages/rankings.tsx` page has evolved from a long developer table into a dark analyst workstation with filters, tabs, dense matrix/table views, right-side snapshots, methodology metadata, and skater/goalie/team ranking modes.

This V2 pass should close the gap between that UI/workstation success and the original full product/database vision:

- More rankings should come from durable precomputed snapshots/materialized tables instead of request-time application ranking.
- Percentile/rank semantics should be mathematically consistent and user-friendly.
- Original concept metrics should either become exact implementations or be clearly labeled as v1 proxies.
- Goalies and teams need deeper contextual logic, not only first-pass matrices.
- The UI should expose enough methodology/component context that users can understand why a player/team/goalie ranks where they do.

## Current Alignment Summary

### Hits

- `web/pages/rankings.tsx` now has a strong one-screen analyst-workstation layout.
- Skater rankings support entity, position, deployment, timeframe/window, strength, display mode, search, min GP, min TOI, sample confidence, source quality, metric groups, and metric columns.
- Goalies and teams have live rankings matrices and snapshot panels.
- The page generally avoids fake data and shows unavailable/source-pending states.
- Skater deployment buckets exist for `L1`-`L4`, `P1`-`P3`, `PP1`-`PP3`, `PK1`, and `PK2`.
- MCM and BEAST exist as composite outputs from `skater_composite_ratings`.
- xS%, SAX%, goals above expected, unrealized xG, hits, blocks, SOG, iCF, xGA, oiGF%, and oiXGF% are represented in the skater matrix registry.
- WAR is contract-only/source-pending rather than faked.
- Tests exist across ranking URL state, filters, matrix tables, APIs, methodology, composites, goalie/team surfaces, and source-pending states.

### Misses / Gaps

- Ranking rows are still mostly computed server-side at request time from `rolling_player_game_metrics`, with short in-memory caching, rather than read from a durable ranking snapshot table.
- Percentile formula currently makes the best row less than exactly 100 unless rounded visually.
- `entity_metric_rankings` exists but is not the primary read path for the current matrix.
- `skater_composite_ratings` exists and is read, but the composite writer must be operationalized/backfilled reliably for every supported context.
- MCM methodology lists `pp_points_per_60`, but the composite writer's source metrics currently omit it.
- Offense and defense ratings are computed/persisted but are not first-class sortable matrix columns.
- Shoot First, Pass First, and Play Driver are v1 percentile proxies, not the exact original definitions.
- Luck Score is implemented as a 100-centered Results Luck Index, not the original EV+PP ratio formula centered around roughly 2.
- Relative 5v5 GF% and relative 5v5 xGF% remain planned because the team-without-player baseline is not implemented.
- Goalie role buckets do not yet implement injury/call-up adjusted top-two denominator logic.
- Goalie matrix lacks xGA/shot against, relative save percentage/MVP signal, high-danger save context, and Under Pressure quadrant logic.
- Team rankings cover useful style signals, but most coaching-style ideas are not implemented: line rolling/top-loading, PP unit share, shot location style, one-goal games, home/road, rest splits, period splits, discipline, shorthanded offense, mistake capitalization, ozone time, and physicality.
- Goalies and teams only have rankings plus WAR contract; skater-only secondary tabs are ahead of goalie/team secondary tabs.

## Primary User

The primary user is a hockey/fantasy analyst who wants to answer questions like:

- Which second-line forwards are elite in SOG/60 compared with actual peers?
- Which defensemen are underrated because their deployment bucket is difficult?
- Which skaters are true multi-category fantasy targets, not just point producers?
- Which goalies are starters, backups, tandem pieces, or temporary injury fill-ins?
- Which teams have identifiable coaching styles that affect player opportunity?
- Which current runs are sustainable versus luck-driven?

## Goals

1. Make ranking semantics trustworthy and consistent across skaters, goalies, and teams.
2. Move high-traffic ranking reads toward precomputed snapshot tables or materialized views.
3. Promote original concept metrics from proxy/partial implementations toward explicit, tested contracts.
4. Preserve source-pending behavior for unavailable data.
5. Keep the workstation compact and fast on desktop while retaining responsive tablet/mobile behavior.
6. Add methodology/component visibility where it helps users understand novel metrics.

## Non-Goals

- Do not build a full WAR model unless replacement baselines, league adjustments, and win conversion are validated.
- Do not fake paid/private data or unavailable public data.
- Do not replace the existing `/rankings` page with a new route unless unavoidable.
- Do not perform expensive raw-event aggregation in page requests.
- Do not change existing public API response shapes without compatibility handling.
- Do not make destructive database changes.

## Important File Context

### Page and UI

- `web/pages/rankings.tsx`
  - Main workstation page.
  - Renders header, filters, tabs/action bar, skater/goalie/team matrix sections, snapshots, secondary tabs, and WAR panel.
  - Methodology panel lives in this file as `WorkstationMethodologyPanel`.

- `web/components/Rankings/RankingsFilters.tsx`
  - Entity toggle, season/window/search/display/deployment/strength/min GP filters, more filters, and methodology slot.
  - Skater team filter currently expects numeric `Team ID`; goalie team filter accepts code/name.

- `web/components/Rankings/PlayerMatrixTable.tsx`
- `web/components/Rankings/GoalieMatrixTable.tsx`
- `web/components/Rankings/TeamMatrixTable.tsx`
- `web/components/Rankings/PlayerSnapshotPanel.tsx`
- `web/components/Rankings/TrendingPanel.tsx`
- `web/components/Rankings/SplitsPanel.tsx`
- `web/components/Rankings/WarPanel.tsx`

### URL State and Request Builders

- `web/lib/rankings/rankingUrlState.ts`
  - Canonical filter state and API path builders.
  - `deriveRankingsPeerGroupType` selects team/deployment/position/all skaters.
  - `buildClientRankingsRequest` converts skater team filter to `Number(filters.team)`.

### Ranking Core

- `web/lib/rankings/rankingCalculator.ts`
  - Shared skater ranking math.
  - Uses dense-rank-like raw ranks.
  - Current percentile formula is `lowerPeerCount / qualifiedPeerCount * 100`.

- `web/lib/rankings/rankingQueries.ts`
  - Reads `rolling_player_game_metrics`.
  - Resolves latest calculable snapshot.
  - Builds contextual ranking surfaces.
  - Uses a short in-memory cache.

- `web/lib/rankings/playerMatrix.ts`
  - Builds skater matrix response.
  - Calls `buildContextualRankingsSurfaces`.
  - Reads `skater_composite_ratings` for MCM/BEAST/Luck/composite snapshot values.
  - Builds overall and deployment rank scopes.

- `web/lib/rankings/matrixMetricRegistry.ts`
  - Matrix groups and visible skater metric columns.
  - Relative 5v5 metrics are planned/default hidden.
  - Luck is available but default hidden.

- `web/lib/rankings/metricDefinitions.ts`
  - Metric contracts, metadata, source tables, strength applicability, denominator descriptions, sample rules, and availability.

### Skater Composites

- `web/lib/rankings/skaterCompositeWriter.ts`
  - Computes offense, defense, MCM, BEAST, Shoot First, Pass First, Play Driver, and Results Luck fields.
  - Upserts to `skater_composite_ratings`.
  - Current `SOURCE_METRICS` omits `pp_points_per_60`, although methodology includes it.

- `web/lib/rankings/skaterCompositeMethodology.ts`
  - Contract definitions for offense/defense, MCM, BEAST gates, archetype tags, and Results Luck Index.

- `web/lib/rankings/resultsLuckIndex.ts`
- `web/lib/rankings/resultsLuckSources.ts`
  - Component-aware, 100-centered Results Luck implementation and baseline sourcing.

- `web/pages/api/v1/db/update-skater-composite-ratings.ts`
  - Admin route for recomputing/upserting composites.
  - Default dry-run behavior should be checked before relying on production population.

### Goalies

- `web/lib/rankings/goalieMatrix.ts`
  - Goalie ranking matrix.
  - Current metric keys: `save_percentage`, `gsax`, `gsaa_per_60`, `quality_start_pct`, `really_bad_start_rate`, `steal_rate`, `start_share`.
  - Role context uses `goalie_start_projections.season_start_pct` or selected-window team start share.

- `web/lib/rankings/goalieMethodology.ts`
  - Quality starts, really bad starts, steal rate, and role methodology helpers.
  - Contains warnings around adjusted/top-two context.

### Teams

- `web/lib/rankings/teamMatrix.ts`
  - Team ranking matrix.
  - Current metric keys: `off_rating`, `def_rating`, `xgf60`, `xga60`, `xgf_percentage`, `shot_quality`, `event_rate`, `finishing_luck`, `save_luck`, `net_luck`, `pace_rating`, `special_rating`.
  - Explicitly warns that team style is raw/contextual, not score- or venue-adjusted.

- `web/lib/rankings/teamStyleMethodology.ts`
  - Team luck, shot quality, run-and-gun/event profile style helpers.

### Secondary Tabs and Contracts

- `web/lib/rankings/availableFilters.ts`
  - Skaters support rankings, metric explorer, deployment tiers, trending, splits, and WAR contract.
  - Goalies and teams currently support rankings and WAR contract only.

- `web/lib/rankings/deploymentTiers.ts`
- `web/lib/rankings/trending.ts`
- `web/lib/rankings/splits.ts`
- `web/lib/rankings/war.ts`
- `web/lib/rankings/snapshot.ts`
- `web/lib/rankings/comparison.ts`

### Tests to Inspect/Extend

- `web/__tests__/pages/rankings.test.tsx`
- `web/lib/rankings/rankingCalculator.test.ts`
- `web/lib/rankings/rankingUrlState.test.ts`
- `web/lib/rankings/playerMatrix.test.ts`
- `web/lib/rankings/skaterCompositeWriter.test.ts`
- `web/lib/rankings/skaterCompositeMethodology.test.ts`
- `web/lib/rankings/resultsLuckIndex.test.ts`
- `web/lib/rankings/resultsLuckSources.test.ts`
- `web/lib/rankings/goalieMatrix.test.ts`
- `web/lib/rankings/teamMatrix.test.ts`
- `web/components/Rankings/RankingsFilters.test.tsx`
- `web/components/Rankings/PlayerMatrixTable.test.tsx`
- `web/components/Rankings/PlayerSnapshotPanel.test.tsx`

## Database and Source Context

Verify live schema before implementing. Supabase changes should follow the project’s migration patterns and Supabase security guidance.

### Existing / Relevant Tables

- `metric_definitions`
  - Metric metadata, methodology version, availability, source fields, denominator metadata, sample requirements.

- `entity_metric_rankings`
  - Intended durable contextual ranking snapshot table.
  - Exists from `migrations/20260605_create_contextual_rankings.sql`.
  - Not currently the primary read path for the skater matrix.

- `skater_composite_ratings`
  - Stores offense/defense, MCM, BEAST, archetype scores, Results Luck, components/provenance.
  - Context key expansion exists in `migrations/20260608072046_add_skater_composite_context_key.sql`.

- `rolling_player_game_metrics`
  - Current primary skater source for ranking values and windows.
  - Includes season/last-N rolling fields, strength state, line combo context, PP unit, selected-window components, and snapshot dates.

- `lineCombinations`
  - Existing line/pair/goalie array source.
  - Used upstream and by projection/game-prediction contexts.

- `powerPlayCombinations`
  - PP unit source used for PP deployment context.

- `goalie_start_projections`
  - Current goalie role/share prior source.

- `goalie_stats_unified`
- `vw_goalie_stats_unified`
- `wgo_goalie_stats`
- `wgo_goalie_stats_totals`
- `nst_gamelog_goalie_*`
- `nhl_xg_goalie_game_aggregates`
  - Relevant goalie source family.

- `team_power_ratings_daily`
  - Current team power ratings source.

- `team_underlying_stats_summary`
  - Team style/underlying source.

- `nst_gamelog_*`
- `nst_gamelog_*_oi`
- `wgo_skater_stats`
- `wgo_skater_stats_totals`
- `player_stats_unified`
- `nhl_xg_*`
  - Relevant skater and on-ice source family for exact denominator work.

### Important Existing Migrations

- `migrations/20260605_create_contextual_rankings.sql`
  - Creates `metric_definitions`, `entity_metric_rankings`, `skater_composite_ratings`, indexes, and contextual lookup index on `rolling_player_game_metrics`.

- `migrations/20260606_add_metric_methodology_metadata.sql`
  - Adds/updates methodology metadata fields.

- `migrations/20260606_add_contextual_snapshot_methodology_version.sql`
  - Adds methodology versioning and updated-at triggers.

- `migrations/20260606_enable_verified_xg_finishing_metrics.sql`
- `migrations/20260606_enable_shot_attempts_per_60_metric.sql`
- `migrations/20260606_enable_ev_on_ice_gf_percentage.sql`
- `migrations/20260607_add_true_5v5_rolling_on_ice_xg_metrics.sql`
- `migrations/20260608072046_add_skater_composite_context_key.sql`

## Hit / Miss Target Scoping

### Target A: Ranking Semantics

Hit when:

- Raw ranks use true dense-rank semantics everywhere.
- Percentiles are consistent across skaters, goalies, and teams.
- Better raw performance maps to higher displayed percentile, including lower-is-better metrics.
- Top qualified peer group displays as 100th percentile or an explicitly documented equivalent.
- Ties are handled predictably.

Miss when:

- Percentiles differ by entity implementation.
- Top rows are mathematically below 100 without a clear product reason.
- Lower-is-better metrics invert incorrectly.
- Low sample rows are ranked as though fully qualified.

### Target B: Durable Snapshot Read Path

Hit when:

- Main matrix APIs can read from `entity_metric_rankings` or a materialized snapshot/view for most common metric/entity contexts.
- Request-time work is limited to filtering, joining display metadata, paging, and light formatting.
- Snapshot freshness, source warnings, and methodology versions are returned in API metadata.
- Fallback to `rolling_player_game_metrics` is explicit, logged, tested, and bounded.

Miss when:

- Every page request recomputes all ranking surfaces from source rows.
- Composite and ranking snapshots can drift with no freshness/version visibility.
- Heavy source-table scans are required to render common views.

### Target C: Skater Concept Metric Exactness

Hit when:

- MCM/BEAST include the verified scoring components in the published methodology.
- Offense and defense ratings can be sorted as normal matrix metrics.
- Shoot First uses individual shot attempt share of on-ice attempts where available.
- Pass First uses primary assists and assist share of total points.
- Play Driver uses goals plus primary assists share and/or relative team impact, not only a proxy blend.
- Relative 5v5 GF%/xGF% use team-without-player baselines.
- Luck Score naming and scale clearly match the actual formula.

Miss when:

- Published methodology mentions components the writer does not use.
- Snapshot panels show scores that cannot be sorted or audited.
- Proxy formulas are presented as exact versions of the original concept.

### Target D: Goalie Deployment and Value

Hit when:

- Goalie role buckets implement workhorse/starter/tandem/backup tiers.
- Injury/call-up adjusted top-two denominator logic exists and is tested.
- Third/fourth goalies do not distort G1/G2 role assignment.
- Matrix includes or source-pends xGA/shot against, relative save percentage/MVP signal, HDSV%, steal rate, QS%, RBS%, GSAA/GSAx.
- Under Pressure quadrant can be shown when high-danger data is verified.

Miss when:

- Role share is only total team starts with no call-up adjustment.
- Source-pending goalie metrics are visually indistinguishable from unsupported metrics.
- `/trueGoalieValue` insights remain isolated from rankings.

### Target E: Team Coaching Style

Hit when:

- Team matrix distinguishes power, pace, shot quality, event rate, special teams, luck, and style caveats.
- A second pass adds line rolling/top-loading, PP unit usage, pair usage, shot location tendencies, score-margin/one-goal/OT, home-road, rest, period splits, discipline, shorthanded offense, mistake capitalization, ozone/control, and physicality where data exists.
- Missing team-style sources are explicit source-pending states.

Miss when:

- Raw xG style metrics are presented as complete coaching style.
- No distinction exists between score-adjusted and unadjusted metrics.
- Shiftchart/PP unit data is ignored for team style.

## Functional Requirements

1. Normalize percentile semantics in shared ranking helpers for skaters, goalies, and teams.
2. Add tests proving best qualified entity gets the expected top percentile, ties share ranks, and lower-is-better metrics invert correctly.
3. Audit all call sites that interpret percentile bands and update snapshots/tooltips if semantics change.
4. Add or wire a durable ranking snapshot writer for `entity_metric_rankings`.
5. Prefer reading common matrix cells from `entity_metric_rankings` when populated.
6. Keep fallback behavior to current source-row ranking path while snapshot writers are being operationalized.
7. Add API metadata indicating whether a response came from precomputed rankings or fallback computation.
8. Promote skater `offense_rating` and `defense_rating` into normal matrix metric definitions/columns.
9. Fix MCM/BEAST source component mismatch for `pp_points_per_60`.
10. Decide and encode whether Results Luck should remain a 100-centered v1 index or revert to the original around-2 EV+PP Luck Score formula.
11. Add exact denominator contracts for Shoot First, Pass First, Play Driver, and Relative 5v5 GF%/xGF%.
12. Implement exact concept metrics only where verified numerator/denominator sources exist.
13. Add `Source Pending` states for exact concept metrics when required denominators are missing.
14. Improve goalie role assignment with injury/call-up adjusted denominator logic.
15. Add goalie tests for two-goalie teams, tandem teams, third-goalie injury fill-ins, and no-countable-start edge cases.
16. Add source contracts for goalie xGA/shot against, relative save percentage, HDSV%, and Under Pressure quadrant.
17. Expand team style contracts around line usage, PP unit usage, shot location, game context, discipline, and physicality.
18. Keep team style metrics raw/contextual until score/venue adjustments are available.
19. Improve methodology/component display for composite metrics without bloating the main workstation.
20. Update documentation/task notes with every source-pending decision and verified table mapping.

## Recommended Next Tasks

### Task 1: Fix Percentile Semantics First

Why:

This is foundational and relatively contained. It affects user trust across every ranking table.

Gut instinct:

- Start in `web/lib/rankings/rankingCalculator.ts`.
- Create a small shared helper if goalie/team rankers duplicate the same math.
- Consider percentile as `100 * betterOrEqualPeerCount / qualifiedPeerCount` after normalizing lower-is-better direction.
- For ties, all tied rows should receive the same percentile.
- Verify whether existing UI copy says “better than percentile” versus “percentile among peers”; update wording if needed.

Likely files:

- `web/lib/rankings/rankingCalculator.ts`
- `web/lib/rankings/goalieMatrix.ts`
- `web/lib/rankings/teamMatrix.ts`
- `web/lib/rankings/rankingMetadata.ts`
- relevant tests.

### Task 2: Fix MCM/BEAST PP Points Contract

Why:

Current methodology says PP points count, but writer source inputs omit `pp_points_per_60`.

Gut instinct:

- Verify `pp_points_per_60` exists as a contextual metric definition and is populated in the relevant strength/window contexts.
- Add it to `SOURCE_METRICS` only if the source can produce valid rows.
- If unavailable for 5v5 contexts, explicitly gate it by strength or record source-pending in components.
- Update tests so methodology and writer inputs cannot drift again.

Likely files:

- `web/lib/rankings/skaterCompositeWriter.ts`
- `web/lib/rankings/skaterCompositeMethodology.ts`
- `web/lib/rankings/metricDefinitions.ts`
- `web/lib/rankings/skaterCompositeWriter.test.ts`
- `web/lib/rankings/skaterCompositeMethodology.test.ts`

### Task 3: Promote Offense/Defense Ratings Into Matrix

Why:

Original vision centered offense/defense ratings, but currently they are mostly snapshot-level composites.

Gut instinct:

- Add `offense_rating` and `defense_rating` as composite metric keys in the matrix registry.
- Source from `skater_composite_ratings`.
- Decide labels: `Offense Rating`, `Defensive Impact`.
- Include rank scopes and sortable behavior like MCM.
- Ensure source-pending cells render if composite rows are missing.

Likely files:

- `web/lib/rankings/matrixMetricRegistry.ts`
- `web/lib/rankings/metricDefinitions.ts`
- `web/lib/rankings/playerMatrix.ts`
- `web/components/Rankings/PlayerMatrixTable.tsx`
- tests around matrix registry and player matrix.

### Task 4: Design Snapshot Writer Path for `entity_metric_rankings`

Why:

The page should eventually read rankings from snapshots, not compute every metric surface on demand.

Gut instinct:

- Do not rip out the current request-time path yet.
- Build a writer that consumes the same verified ranking candidates and writes `entity_metric_rankings`.
- Use upsert keys already defined by the migration.
- Add a feature flag or API metadata to indicate snapshot source vs fallback.
- Start with skater default matrix metrics for season/last5/last10/last20 and `5v5`.
- Expand to goalies/teams after the skater path is proven.

Likely files:

- `web/lib/rankings/rankingQueries.ts`
- new `web/lib/rankings/entityMetricRankingWriter.ts`
- `web/pages/api/v1/db/update-entity-metric-rankings.ts`
- `web/pages/api/v1/contextual-rankings/matrix.ts`
- `migrations/*` only if existing table is missing required fields.

### Task 5: Clarify Luck Score Product Decision

Why:

Current Results Luck Index is useful but not the same as the original Luck Score.

Gut instinct:

- Keep current implementation if the priority is stable, leakage-resistant regression context.
- Rename UI/methodology to “Results Luck Index” everywhere and document it as v1.
- If original formula is required, implement it as a separate metric key, e.g. `original_luck_score`, with scale centered around 2.
- Do not silently change the meaning of existing `results_luck_index`.

Likely files:

- `web/lib/rankings/skaterCompositeMethodology.ts`
- `web/lib/rankings/resultsLuckIndex.ts`
- `web/lib/rankings/resultsLuckSources.ts`
- `web/lib/rankings/metricDefinitions.ts`
- tests.

### Task 6: Exact Skater Archetype Denominators

Why:

Shoot First, Pass First, and Play Driver are high-value user-facing concepts, but proxies should not be mistaken for exact definitions.

Gut instinct:

- Add separate exact metric keys rather than overwriting existing proxy scores until sources are verified.
- Shoot First needs individual shot attempts while on ice divided by team/on-ice shot attempts while player is on ice.
- Pass First needs assists/points share and primary assist volume.
- Play Driver needs goals + primary assists share and/or relative 5v5 GF/xGF impact.
- If denominators are missing from current rolling rows, add source-pending contracts first.

Likely sources:

- `rolling_player_game_metrics`
- `nst_gamelog_*`
- `nst_gamelog_*_oi`
- `player_stats_unified`
- `wgo_skater_stats`

### Task 7: Goalie Call-Up Adjusted Role Buckets

Why:

The original goalie deployment logic depends on identifying temporary third/fourth goalie stints.

Gut instinct:

- Build a pure function first, independent of Supabase.
- Input: goalie starts by team/date/player, active top two candidates, injury/call-up windows if inferable.
- Output: adjusted denominator, role share, bucket, warnings.
- Use conservative inference: if the model cannot confidently identify a call-up stint, do not adjust and add a warning.
- Tests should cover the Boston examples from the original idea.

Likely files:

- `web/lib/rankings/goalieMethodology.ts`
- `web/lib/rankings/goalieMatrix.ts`
- `web/lib/rankings/goalieMatrix.test.ts`

### Task 8: Team Coaching Style Phase 2

Why:

The team matrix is currently a useful style snapshot, not the full coaching-style system.

Gut instinct:

- Create a team-style source inventory before schema work.
- Group metrics by source maturity:
  - Ready now: PP/PK tiers, xGF/xGA, event rate, shot quality, luck.
  - Needs aggregation: line rolling/top-loading, pair usage, PP unit share.
  - Needs game-context tables: one-goal/OT, home-road, rest, period splits.
  - Needs event/coordinate logic: shot zones, mistake capitalization, ozone time.
  - Needs penalty/RTSS caveats: discipline, physicality.
- Add source-pending contracts before UI columns.

Likely files:

- `web/lib/rankings/teamMatrix.ts`
- `web/lib/rankings/teamStyleMethodology.ts`
- new team style writer/aggregate module.
- `web/pages/shiftcharts` ecosystem.
- `web/lib/underlying-stats/*`

## Design Considerations

- Keep the current compact workstation direction.
- Do not reintroduce a large results header above the matrix.
- Tabs should stay immediately above the matrix and share space with matrix tools.
- Methodology should remain compact, but metric-specific detail should be accessible from hover/details/popover or snapshot drilldown.
- Composite metrics need component breakdowns somewhere discoverable.
- Team and goalie source-pending secondary tabs should be visibly intentional, not broken.
- Avoid dense UI elements resizing when metric labels, warnings, or sample states change.

## Technical Considerations

- Prefer shared ranking math helpers to avoid skater/goalie/team drift.
- Keep all database changes additive and reversible.
- Use existing Supabase migration patterns.
- For Supabase implementation work, verify current docs/changelog before schema/RLS/function changes.
- If new views are exposed through Supabase Data API, review RLS/security-invoker behavior.
- Do not put privileged `security definer` functions in an exposed schema.
- Keep `methodology_version`, `snapshot_date`, `snapshot_updated_at`, source warnings, and source table metadata in API responses.
- Keep current fallback paths until snapshot tables are populated and tested.

## Acceptance Criteria

1. Percentile tests pass for skater, goalie, and team rankers with top row at the agreed top percentile.
2. Lower-is-better metrics color and rank correctly after percentile changes.
3. MCM/BEAST writer and methodology use the same component list or explicitly document source-pending components.
4. Offense/Defense ratings are available as sortable skater matrix columns, with unavailable states when composite rows are missing.
5. API metadata identifies whether ranking data came from snapshot tables or fallback computation.
6. Existing rankings page still renders skater, goalie, and team rankings without fake values.
7. New source-pending metrics have tests proving unavailable states render correctly.
8. No expensive raw-event aggregation is introduced into page requests.
9. `npm run lint`, targeted rankings tests, and relevant API/component tests pass or unrelated failures are documented.

## Suggested Validation Commands

Run the narrowest relevant tests first, then broaden:

```bash
npm test -- --run web/lib/rankings/rankingCalculator.test.ts
npm test -- --run web/lib/rankings/playerMatrix.test.ts
npm test -- --run web/lib/rankings/skaterCompositeWriter.test.ts
npm test -- --run web/lib/rankings/goalieMatrix.test.ts
npm test -- --run web/lib/rankings/teamMatrix.test.ts
npm test -- --run web/__tests__/pages/rankings.test.tsx
npm run lint
npm run build
```

If feasible after larger changes:

```bash
npm run test:full
```

Known historical caveat from prior runs: `npm run test:full` may collect unrelated Playwright e2e specs under Vitest and may include unrelated API expectation failures. Treat unrelated existing failures separately from regressions introduced by this work.

## Open Questions

1. Should the original Luck Score formula be restored as the canonical public metric, or should the current 100-centered Results Luck Index remain canonical?
2. Should offense and defense ratings be deployment-specific by default, overall by default, or shown with the current rank-display toggle?
3. Should MCM/BEAST include PP points only in all-situations/PP contexts, or should PP points influence 5v5 rankings as a fantasy-category signal?
4. What confidence threshold is acceptable before adjusting goalie role denominator for inferred injury/call-up windows?
5. Should team coaching style become its own secondary tab, or remain integrated into the team rankings matrix/snapshot?
6. Should the next pass prioritize skater exactness, goalie deployment, or durable snapshot infrastructure first?

## Recommended First Move

Start with percentile semantics and MCM/BEAST component consistency. Those are small enough to finish safely, directly affect trust, and reduce the risk that later snapshot work persists subtly wrong values.

After that, build the durable `entity_metric_rankings` writer/read path behind fallback behavior. Once ranking semantics are correct, snapshotting them becomes much safer.
