# PRD: Rolling Player Metrics Comprehensive Audit

## 1. Introduction / Overview

The rolling player metrics pipeline centered on [update-rolling-player-averages.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-player-averages.ts) and [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts) needs a dedicated audit. The current table, `rolling_player_game_metrics`, is now partially corrected for major ratio and `/60` bugs, but there are still open questions around metric semantics, window definitions, GP% logic, missing-source handling, and whether every persisted field truly represents the intended hockey meaning.

This PRD defines a comprehensive metric-by-metric audit of the full rolling-player-metrics suite, including the direct helper files it depends on and the upstream builders whose semantics affect the stored values. The goal is to produce a decision-ready audit artifact that explains, for every persisted metric family and column, whether the logic is correct, broken, close-but-needs-refining, or still suspicious and in need of verification.

The result of the audit will be a structured document that:
- lists all upstream tables feeding the pipeline
- explains every persisted metric in shorthand formula form
- groups each metric into `WORKING`, `BROKEN`, `ALMOST`, or `NEEDS REVIEW`
- proposes specific fixes where the logic is wrong or incomplete
- identifies candidate metric additions from already-available upstream data
- defines the changes needed so the table reflects the intended meaning of “last N team games,” “games played,” and “GP%”

## 2. Goals

- Produce a complete inventory of all persisted fields written into `rolling_player_game_metrics`, grouped by logical metric family and also listed column-by-column.
- Trace every metric back to its upstream source tables and the exact code path that computes it.
- Validate the logic of every metric family against live source data with multiple player examples, including injured / missed-game cases.
- Explicitly classify each metric or metric family as:
  - `✅ WORKING`
  - `❌ BROKEN`
  - `🔧 ALMOST`
  - `⚠️ NEEDS REVIEW`
- Audit and redesign the `gp_pct_*` model so it correctly represents player participation over team game windows, including cases where a player misses games.
- Determine whether current `last3/5/10/20` windows mean:
  - last N team games
  - last N player appearances
  - last N valid metric samples
  and define the intended canonical behavior for each family.
- Identify gaps in current coverage: metrics available from existing upstream tables that are not yet persisted but should be considered.
- Produce a final audit artifact that a developer can use to implement corrections without ambiguity.

## 3. User Stories

- As the maintainer of the rolling metrics pipeline, I want every persisted metric explained in plain language so I can trust what the table means.
- As a product builder, I want to know which metrics are safe to show in UI and which ones are not.
- As the owner of the trend and sustainability stack, I want a line-by-line audit of the table so I can stop guessing whether a value is correct.
- As an analyst, I want live player examples for each metric family so I can verify the math against real source data.
- As a developer, I want direct links between each persisted column, its source tables, and its calculation path so I can fix bugs without re-discovering the system.
- As the owner of the player trends product, I want `lastN` windows and GP% to match real team-game availability, including injuries and missed games.

## 4. Functional Requirements

1. The audit must cover these primary files:
   - [update-rolling-player-averages.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-player-averages.ts)
   - [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)

2. The audit must also cover all direct helper files used by the rolling pipeline:
   - [rollingHistoricalAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingHistoricalAverages.ts)
   - [rollingMetricAggregation.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricAggregation.ts)
   - [rollingPlayerMetricMath.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerMetricMath.ts)
   - [rollingPlayerPipelineDiagnostics.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts)

3. The audit must also include upstream builders whose semantics affect rolling values, especially:
   - [update-power-play-combinations/[gameId].ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-power-play-combinations/[gameId].ts)
   - any other direct upstream builder discovered during review that materially changes metric meaning

4. The audit must begin with a section titled `Upstream Tables`, listing every source table read by the suite, including at minimum:
   - `players`
   - `games`
   - `lineCombinations`
   - `powerPlayCombinations`
   - `wgo_skater_stats`
   - `nst_gamelog_as_counts`
   - `nst_gamelog_as_rates`
   - `nst_gamelog_as_counts_oi`
   - `nst_gamelog_es_counts`
   - `nst_gamelog_es_rates`
   - `nst_gamelog_es_counts_oi`
   - `nst_gamelog_pp_counts`
   - `nst_gamelog_pp_rates`
   - `nst_gamelog_pp_counts_oi`
   - `nst_gamelog_pk_counts`
   - `nst_gamelog_pk_rates`
   - `nst_gamelog_pk_counts_oi`
   - `rolling_player_game_metrics`

5. The audit must document, for each upstream table:
   - what data it contributes
   - which metric families depend on it
   - whether it is authoritative, fallback-only, or derived
   - any known scale / unit quirks

6. The audit must group metrics by logical family first, including at minimum:
   - availability / participation
   - TOI
   - surface counting stats
   - `/60` rates
   - finishing / shooting
   - chance / expected metrics
   - on-ice context
   - territorial / possession
   - power-play usage
   - line / role context
   - historical baseline columns

7. The audit must also include a column-by-column checklist for every persisted field in `rolling_player_game_metrics`, not just family-level summaries.

8. For every metric family, the audit must include a shorthand formula section. Example style:
   - `✅ sog_per_60_total_last3 = (sum(shots over qualifying games) / sum(toi_seconds over qualifying games)) * 3600`

9. The audit must explicitly state the intended semantic meaning for each family’s `total_all`, `avg_all`, `total_last3/5/10/20`, `avg_last3/5/10/20`, and historical baseline fields.

10. The audit must determine whether each family should use:
   - last N team games
   - last N player appearances
   - last N valid metric observations
   and must recommend the canonical rule per family.

11. The audit must include a dedicated `GP% and Availability Model` section.

12. The `GP% and Availability Model` section must:
   - explain current `games_played`, `team_games_played`, `gp_pct_total_*`, and `gp_pct_avg_*` logic
   - identify why current values can become nonsensical
   - define the intended meaning for career / season / rolling GP%
   - recommend schema changes if current columns cannot express the intended model cleanly
   - explicitly address players who missed team games due to injury, healthy scratch, trade, or late-season acquisition

13. The audit must include live validation examples for every major metric family.

14. Live validation must use multiple player examples per family, including:
   - a regular full-season skater
   - a player with missed games / injury
   - a player with team change or partial-team season if available
   - a player with heavy PP role where PP share semantics matter

15. For every live validation example, the audit must show:
   - the source rows pulled from upstream tables
   - the intended calculation
   - the stored value in `rolling_player_game_metrics`
   - whether the stored value matches
   - whether the mismatch is due to stale data, bad logic, bad window definition, missing source coverage, or scale / unit mismatch

16. The audit must produce a final grouped output section using these exact headings:
   - `WORKING`
   - `BROKEN`
   - `ALMOST`
   - `NEEDS REVIEW`

17. Metrics in the final grouped output must use these labels:
   - `✅` for correct logic and calculation
   - `❌` for incorrect logic and/or calculation
   - `🔧` for close but in need of refinement, plus suggested fixes
   - `⚠️` for suspicious or not yet fully verified, plus the missing verification needed

18. The audit must include a separate section titled `Suggested Metric Additions` with no emoji-based status classification.

19. `Suggested Metric Additions` must only include:
   - metrics already present in existing upstream tables but not persisted
   - metrics derivable from existing upstream columns without ingesting new external sources

20. For each suggested addition, the audit must document:
   - source table(s)
   - suggested formula
   - why it would improve the rolling table
   - whether it belongs in all-strength only or also in EV / PP / PK splits

21. The audit must include explicit review of these known sensitive or previously problematic families:
   - `shooting_pct`
   - `expected_sh_pct`
   - `primary_points_pct`
   - `ipp`
   - `oz_start_pct`
   - `pp_share_pct`
   - `on_ice_sh_pct`
   - `pdo`
   - `cf_pct`
   - `ff_pct`
   - all `/60` stats
   - all `gp_pct_*` fields

22. The audit must include explicit review of current code assumptions for:
   - date alignment between WGO and NST
   - fallback order between WGO, NST counts, NST rates, and NST on-ice rows
   - meaning of `all`, `ev`, `pp`, and `pk` splits
   - interpretation of WGO `toi_per_game`
   - interpretation of PP-related source fields such as `pp_toi`, `pp_toi_pct_per_game`, `percentageOfPP`, `pp_share_of_team`, and unit-relative fields

23. The audit must document the write path into `rolling_player_game_metrics`, including:
   - batching
   - retries
   - progress logging
   - stale-data replacement behavior
   - partial-gap warnings and suspicious-output warnings

24. The audit must end with an implementation-ready remediation plan ordered by priority:
   - correctness blockers
   - schema / semantic redesign items
   - logging / observability improvements
   - optional metric additions

25. The audit output must keep the following deliverables in separate sections, not mixed together:
   - the emoji-based metric status lists under `WORKING`, `BROKEN`, `ALMOST`, and `NEEDS REVIEW`
   - the detailed explanation / rationale list for each metric family
   - the live validation example list
   - the schema change recommendation list
   - the suggested metric additions list

26. The `WORKING`, `BROKEN`, `ALMOST`, and `NEEDS REVIEW` sections must be clean checklist-style metric inventories only:
   - metric name or metric family
   - emoji status
   - shorthand formula
   - short status note
   They must not contain long-form validation walkthroughs or schema redesign discussion.

27. The schema redesign recommendations, especially recommendations triggered by cases where the current columns cannot represent the intended meaning cleanly, must be collected in a separate section from the emoji-based metric lists.

28. The audit PRD must explicitly state that once this audit is complete, the next implementation phase may resume the main task list at `4.2.2`.

## 5. Non-Goals (Out of Scope)

- This PRD does not implement the audit.
- This PRD does not itself rewrite `fetchRollingPlayerAverages.ts`.
- This PRD does not redesign frontend visualizations.
- This PRD does not replace the entire rolling table with a different storage model yet.
- This PRD does not introduce new external data providers.
- This PRD does not audit unrelated projection or sustainability APIs outside the rolling-player-metrics suite, except where they directly depend on `rolling_player_game_metrics`.

## 6. Design Considerations

The final audit artifact should be optimized for inspection, not prose. It should read like an engineer’s reference sheet:
- short metric formulas
- explicit source-table mapping
- visible status grouping
- live validation examples
- direct identification of what to fix next

The final grouped metric review should be easy to scan. The preferred structure is:
- metric family header
- shorthand formula
- status classification
- issue summary
- fix recommendation, if needed

The final audit document should be sectioned in this order:
- `Upstream Tables`
- `Metric Families`
- `Column-by-Column Inventory`
- `WORKING`
- `BROKEN`
- `ALMOST`
- `NEEDS REVIEW`
- `Explanation / Rationale`
- `Live Validation Examples`
- `Schema Change Recommendations`
- `Suggested Metric Additions`
- `Remediation Plan`

## 7. Technical Considerations

- The current pipeline blends WGO, NST counts, NST rates, NST on-ice counts, lineup context, and PP context.
- Some metrics are additive counts, some are bounded ratios, and some are weighted rates. The audit must not treat them uniformly.
- Some current windows may be based on “valid metric rows” rather than literal chronological team games. This must be explicitly validated and either accepted or redesigned.
- `gp_pct_*` likely needs schema and semantic redesign, not just a formula tweak.
- Historical fields such as `*_avg_season`, `*_avg_3ya`, and `*_avg_career` should be audited separately from rolling windows.
- The audit must distinguish between:
  - stale rows produced before a fix
  - current code logic
  - source-data availability gaps
  - intentional fallbacks
- The audit should use targeted live recomputes where necessary to ensure that stale rows are not mistaken for current-code bugs.

## 8. Success Metrics

This PRD will be considered successful when the resulting audit can produce:
- a complete upstream table inventory
- a complete metric-family inventory
- a complete column-level inventory for `rolling_player_game_metrics`
- a grouped final status list under `WORKING`, `BROKEN`, `ALMOST`, and `NEEDS REVIEW`
- live validation evidence for each major metric family
- a clear answer for how `lastN` windows should behave
- a clear redesign recommendation for `gp_pct_*`
- a prioritized remediation list that is implementation-ready

## 9. Open Questions

- Should every rolling family use last N team games, or should some families intentionally use last N appearances or last N valid observations?
- Should the current schema keep both availability-style windows and performance-style windows if they need different semantics?
- Are there historical fields whose names imply averages but whose semantics are actually weighted snapshots?
- Should `games_played` become season-specific, cumulative-career, or both, instead of continuing as a single overloaded field?
- Should separate columns be added for:
  - `player_games_in_last20_team_games`
  - `team_games_in_window`
  - `window_type`
  if that is required to make `gp_pct_*` unambiguous?
- Which suggested additions from current upstream tables are worth persisting versus deriving on demand later?
