# PRD: Rankings Ecosystem Alignment Audit

## Introduction / Overview

This PRD documents the next remediation pass for the `/rankings` ecosystem after auditing `web/pages/rankings.tsx`, the surrounding rankings modules, the data pipeline, tests, and the running UI in Chrome.

The original product goal was a contextual hockey rankings page that helps users compare skaters, goalies, and teams within meaningful peer groups such as position, deployment, timeframe, strength state, team, and role. The current implementation is much closer to that vision than a basic leaderboard: it has a workstation layout, skater/goalie/team modes, metric matrices, snapshots, methodology metadata, source-state labels, and durable ranking snapshot infrastructure.

The next pass should focus on tightening product correctness, speed, and usability rather than rebuilding the page. The main outcome should be a trustworthy analyst-grade rankings surface where common views are fast, source states are clear, filter contracts match user-facing labels, and original prompt concepts are either fully implemented or explicitly marked as pending/proxy.

## Audit Evidence

### Local Code Inspection

- `web/pages/rankings.tsx` renders the workstation shell, entity-specific matrices, tabs, methodology panel, and snapshot panels.
- `web/lib/rankings/rankingUrlState.ts` owns URL state, default filters, and request path builders.
- `web/lib/rankings/metricDefinitions.ts` contains a central metric registry with availability, source, denominator, sample, methodology, and caveat metadata.
- `web/lib/rankings/matrixMetricRegistry.ts` groups visible skater metric columns and exposes planned/unavailable states.
- `web/lib/rankings/rankingCalculator.ts` handles raw value calculation, lower-is-better inversion, dense rank semantics, percentiles, sample gates, and warnings.
- `web/lib/rankings/playerMatrix.ts` builds skater matrix rows, reads `entity_metric_rankings` when requested, enriches with composite ratings, and constructs overall/deployment rank scopes.
- `web/lib/rankings/entityMetricRankingWriter.ts` and `web/pages/api/v1/db/update-entity-metric-rankings.ts` provide the durable snapshot writer path.
- `web/lib/rankings/goalieMatrix.ts` and `web/lib/rankings/teamMatrix.ts` provide live goalie/team ranking matrices with methodology/source metadata.
- `web/components/Rankings/*` contains the filter, matrix, snapshot, explanation, and secondary panel UI.

### Chrome Verification

Chrome was used against `http://localhost:3001/rankings`.

- Skater matrix loaded with 10 visible rows and 776 ranked skaters.
- Skater default matrix API returned `sourceTable: entity_metric_rankings`, `rankingSource: entity_metric_rankings`, and `snapshotDate: 2026-04-16`.
- Default skater matrix API still took about 9-17 seconds in observed local requests.
- Metric Explorer rendered 100 rows for `sog_per_60`, but the API took about 20 seconds.
- Goalie mode rendered 10 rows after a short wait and no console errors.
- Team mode rendered 10 of 32 teams after a short wait and no console errors.
- No Chrome console errors were observed in skater, goalie, team, or Metric Explorer checks.
- The dev server emitted repeated `EMFILE: too many open files, watch` warnings when started on port 3001.
- The page title and H1 still say `Player Rankings` even when the active entity is goalies or teams.
- Entering `BOS` in the skater Team filter produced `Invalid query param: team`, because the UI says code/name but the skater API expects a numeric team id.

### Targeted Tests

The following targeted tests passed:

```bash
npm test -- --run lib/rankings/rankingCalculator.test.ts lib/rankings/playerMatrix.test.ts __tests__/pages/rankings.test.tsx
```

Result: 3 files passed, 19 tests passed.

## Goals

1. Make the rankings page accurately communicate that it supports skaters, goalies, and teams, not only players.
2. Make common rankings views load quickly from durable snapshots or optimized queries.
3. Eliminate filter contract mismatches between UI labels, URL state, and API parsers.
4. Preserve the existing no-fake-data posture: unavailable metrics must stay `Source Pending`, `Unavailable`, `Low Sample`, or `Stale Source`.
5. Promote original prompt concepts from partial/proxy status to explicit implemented contracts where feasible.
6. Improve the table and snapshot UX so users can understand why a row ranks highly without relying only on dense hover text.
7. Keep the current route, component boundaries, and database architecture unless a targeted change is clearly justified.

## User Stories

- As a fantasy hockey analyst, I want to compare skaters by percentile within position or deployment bucket so I can identify context-adjusted targets.
- As a user scanning second-line forwards, I want raw rank and percentile to reflect only the selected peer group so the ranking sentence is defensible.
- As a goalie evaluator, I want role buckets to distinguish true starters, tandem goalies, backups, and temporary call-ups so workload context is not misleading.
- As a team-style analyst, I want team matrix signals to explain coaching tendencies and source caveats so I can understand whether the signal is raw, adjusted, stale, or pending.
- As a user sharing analysis, I want URL state to reproduce filters exactly without causing invalid query errors.
- As a developer, I want metric formulas and availability states to live in central contracts rather than React table code.

## Functional Requirements

1. The page shell must use entity-aware naming:
   - `Skater Rankings` for skater mode.
   - `Goalie Rankings` for goalie mode.
   - `Team Rankings` for team mode.
   - Generic metadata may use `Contextual Hockey Rankings`.

2. The skater Team filter must match the API contract:
   - Either accept team abbreviation/name and resolve it server-side, or relabel the control as numeric team id.
   - Recommended default: accept team abbreviation/name because the current UI already promises that behavior.
   - Invalid team input must produce a clear user-facing validation state, not a raw API error row.

3. Common skater matrix requests must read from `entity_metric_rankings` when populated.
   - The API response must continue exposing `sourceTable`, `rankingSource`, `rankingSourcePreference`, and fallback reason.
   - Fallback to rolling request-time ranking may remain for missing snapshots, but it must be visible in methodology metadata.

4. Common skater matrix load time should be improved.
   - Target p95 local/API response for default skater matrix: under 2 seconds after warmup.
   - Target p95 for Metric Explorer common metrics: under 3 seconds after warmup.
   - Query fan-out for matrix cells, overall scopes, deployment scopes, composites, and all-strength TOI should be profiled and reduced.

5. Metric Explorer must avoid page-time full-league recomputation where an equivalent durable snapshot exists.
   - It should prefer `entity_metric_rankings` for single-metric leaderboard views.
   - It may fall back to `rolling_player_game_metrics` only with explicit source metadata.

6. Percentile semantics must be documented and tested.
   - The UI currently describes percentile as “percentile among qualified peers.”
   - The original prompt describes “better than X% of peers.”
   - The next pass must choose one wording and formula.
   - Recommended default: use a percentile score where the best qualified entity displays 100 and the worst displays 0 or the nearest expected endpoint for the chosen formula.

7. Raw rank semantics must remain dense-rank style unless a change is explicitly approved.
   - Ties may share rank.
   - The next rank after a tie should follow the current tested dense-rank behavior.

8. Lower-is-better metrics must continue ranking and coloring as better-is-greener.
   - Examples: `xga_per_60`, `penalties_taken_per_60`, goalie really bad start rate, team xGA/60.
   - Tooltips/methodology must clearly state that raw lower values map to stronger percentiles.

9. Source-state labels must be summarized better in dense tables.
   - The goalie and team rows currently repeat many `Source caveat`, `Raw context`, and `Stale source` labels.
   - Keep transparency, but consider grouped row-level badges plus detailed tooltip/snapshot notes.

10. Snapshot panels must explain why the selected row stands out using the selected rank mode.
    - If the user toggles Overall vs Deployment rank mode, snapshot strengths should reflect the same scope or clearly label which scope they use.
    - Composite, MCM, and BEAST values should include methodology/source state where available.

11. `Display` labels must be accurate.
    - Current `Novel Score` display mode can show ordinary raw metric values.
    - Rename to a clearer label such as `Metric Value` or `Raw Value`.

12. More Filters must remain powerful but less visually overwhelming.
    - Keep metric group and column toggles.
    - Add clearer grouping, search/filter within columns, or compact “selected count” affordances if needed.

13. The WAR tab must remain contract-only/source-pending until a validated replacement-level model exists.
    - Do not fabricate WAR values.
    - The planned label and methodology should be consistent across entities.

14. Skater deployment must continue using verified line combination / rolling line context with fallback confidence.
    - Deployment labels must include confidence when sample or source coverage is weak.
    - Forwards and defensemen must not be mixed for deployment-specific comparisons.

15. The next pass must close the `pp_points_per_60` inconsistency.
    - MCM methodology includes PP points.
    - `pp_points_per_60` is currently unavailable/source-pending in metric definitions.
    - Composite writer behavior must either exclude PP points with explicit provenance or populate PP points from verified data.

16. Relative 5v5 GF% and xGF% must remain planned until team-without-player baselines are implemented.
    - Do not display them as available metrics without verified denominator/source contracts.

17. Results Luck Index must be explicitly positioned as the current implementation of the original luck-score concept.
    - If the product wants the original EV+PP ratio centered near 2, create a separate metric contract.
    - Otherwise keep the 100-centered index and update copy/methodology to avoid ambiguity.

18. Goalie role logic must add adjusted/core netshare support.
    - Identify likely injury/call-up stints.
    - Store/display raw start share and adjusted core start share separately.
    - Do not present inferred call-up adjustments as certain; include confidence/source notes.

19. Goalie matrix must evaluate missing original metrics:
    - xGA per shot against.
    - Relative SV% versus team without goalie.
    - MVP/goalie value signal.
    - High-danger save context.
    - Under Pressure quadrant/profile.

20. Team matrix must evaluate missing original coaching-style metrics:
    - Forward line rolling/top-load index.
    - Defense pair rolling/top-load index.
    - PP1/PP2 usage share.
    - Shot location/quality style.
    - One-goal game frequency.
    - Home/road splits.
    - Rest splits.
    - Period scoring tendencies.
    - Discipline and penalty differential.
    - Shorthanded offense.
    - Mistake capitalization.
    - Physicality.

21. API metadata must continue exposing source tables, warnings, snapshot dates, and methodology versions.

22. The dev-server `EMFILE` watch warning must be investigated or documented.
    - Prefer using the stable polling dev command when needed.
    - Add developer notes if macOS file watcher limits are expected in this repo.

## Non-Goals

1. Do not rebuild `/rankings` from scratch.
2. Do not implement every original goalie/team/team-style idea in one pass.
3. Do not query raw play-by-play or shot-event data directly from the frontend page.
4. Do not hardcode formulas in React table components.
5. Do not remove source-pending states to make the page look more complete.
6. Do not change unrelated game-prediction files or other dirty worktree changes.
7. Do not require a new route unless the current route cannot support the requirement.

## Design Considerations

1. Keep the analyst workstation layout: filters/control shell, matrix/table, and right-side snapshot.
2. Use entity-aware headings so goalies and teams do not appear under a player-only title.
3. Reduce repeated source labels inside dense matrix cells.
4. Keep the score color scale but ensure it works for lower-is-better metrics.
5. Make the selected scope visible: Overall vs Deployment.
6. Prefer visible explanation in snapshot panels over tooltip-only explanations.
7. Preserve shareable URL state for all filters and selected entities.
8. Mobile/tablet behavior still needs a focused visual pass; Chrome audit in this pass was desktop-width.

## Technical Considerations

1. `entity_metric_rankings` is present and populated for the tested skater default path, but response time is still high.
2. The skater matrix currently fetches multiple metric surfaces plus overall/deployment rank scopes and composite rows; profile this fan-out.
3. Metric Explorer still uses `/api/v1/contextual-rankings`, which can perform expensive request-time ranking.
4. Team filter parsing is inconsistent:
   - Skater matrix parser expects `team` as integer.
   - UI placeholder says `Team code or name`.
   - Goalie/team flows are more abbreviation/name-oriented.
5. Keep `metricDefinitions.ts` and database `metric_definitions` conceptually aligned.
6. Ensure `skater_composite_ratings` is backfilled for supported windows, strengths, positions, and deployment contexts before relying on composite sort/display.
7. Add or update tests around any formula/percentile semantics change before changing UI copy.
8. Existing dirty worktree changes must be preserved; implementers should inspect status before editing.

## Success Metrics

1. Default skater matrix loads in under 2 seconds after warmup in local/dev and production-like environments.
2. Metric Explorer common metrics load in under 3 seconds after warmup.
3. Entering a team abbreviation such as `BOS` no longer causes `Invalid query param: team`.
4. Entity mode headings match the selected entity.
5. No unavailable/planned metric is displayed as live.
6. Lower-is-better metrics sort and color correctly.
7. Skater, goalie, and team matrices render without console errors.
8. Targeted rankings tests remain green.
9. New tests cover team-filter parsing and entity-aware heading behavior.
10. Source/fallback metadata remains visible in API responses and methodology UI.

## Open Questions / Clarifying Questions

1. Percentile semantics:
   - A. Use “better than X% of peers” with best near/exact 100 and worst near/exact 0. Recommended.
   - B. Keep current inclusive percentile math and adjust wording to “percentile among qualified peers.”

2. Skater Team filter:
   - A. Accept abbreviations/names and resolve to ids server-side. Recommended.
   - B. Relabel as numeric team id and keep current parser.

3. Results Luck:
   - A. Keep the current 100-centered Results Luck Index as the canonical product metric. Recommended for continuity.
   - B. Add a separate original-formula Luck Score centered around roughly 2.

4. MCM / BEAST PP points:
   - A. Exclude PP points until a verified `pp_points_per_60` source exists and mark provenance clearly. Recommended.
   - B. Block MCM/BEAST publication until PP points are fully populated.
   - C. Add verified PP points now and include them in all supported composite contexts.

5. Team style roadmap:
   - A. Keep team style inside the Team Rankings matrix/snapshot. Recommended.
   - B. Create a dedicated Team Style secondary tab once enough source contracts exist.

## Recommended Next Implementation Order

1. Fix entity-aware page title/H1 and display-mode naming.
2. Fix skater team filter parsing or label mismatch.
3. Profile default matrix and Metric Explorer API fan-out.
4. Promote Metric Explorer to `entity_metric_rankings` where snapshots exist.
5. Add tests for team filter, heading labels, and source fallback metadata.
6. Resolve percentile wording/formula decision.
7. Clean up source-caveat visual density in goalie/team matrices.
8. Address PP-points/MCM provenance.
9. Plan the adjusted goalie netshare and missing goalie metrics.
10. Plan the next team-style metric tranche.
