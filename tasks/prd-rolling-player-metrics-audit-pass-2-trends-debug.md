# PRD: Rolling Player Metrics Audit Pass 2 and `trendsDebug.tsx` Validation Console

## Document Status

- Status: Drafted for pass-2 implementation planning only
- Scope mode: PRD only
- Baseline assumption: the first-pass remediation task list is complete, including rolling window contract work, GP% remediation, helper extraction, diagnostics expansion, schema additions, and optional support-field additions
- This document does not extend the old PRD in place; it defines a new second-pass audit and debug-console phase against the current architecture
- Historical inputs:
  - [rolling-player-metrics-audit-notes.md](/Users/tim/Code/fhfhockey.com/tasks/rolling-player-metrics-audit-notes.md)
  - [prd-rolling-player-metrics-remediation-blueprint.md](/Users/tim/Code/fhfhockey.com/tasks/prd-rolling-player-metrics-remediation-blueprint.md)
  - [tasks-prd-rolling-player-metrics-remediation-blueprint.md](/Users/tim/Code/fhfhockey.com/tasks/tasks-prd-rolling-player-metrics-remediation-blueprint.md)
- Primary implementation targets:
  - [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)
  - [update-rolling-player-averages.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-player-averages.ts)
  - [trendsDebug.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.tsx)

## 1. Upstream Tables

- `players`: contributes the player processing universe and player search data; metric families depending on it are all rolling families indirectly and all debug selectors directly; classification is authoritative for player identity and scope; quirks are none beyond goalie exclusion rules in batch processing; freshness dependency is normal roster freshness; known refresh path is not in the inspected rolling file surface and must be recorded in the runbook from the current operational player ingest workflow.
- `games`: contributes chronological game ordering, team schedule ledger, known `game_id` validation, and current-team rolling availability denominators; metric families depending on it are availability / participation and all row identity scopes; classification is authoritative; quirks are team-game chronology and team-stint alignment; freshness dependency is critical because stale `games` corrupts availability windows and unknown-game diagnostics; refresh path is not in the inspected rolling file surface and must be captured from the current game ingest workflow before audit execution.
- `lineCombinations`: contributes `line_combo_slot` and `line_combo_group`; metric families depending on it are line / role context only; classification is derived contextual; quirks are null means missing or untrusted assignment, not necessarily fourth-line / no-role; freshness dependency is high for line-context validation; known refresh endpoints are [update-line-combinations/[id].ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-line-combinations/[id].ts) and [update-line-combinations/index.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-line-combinations/index.ts).
- `powerPlayCombinations`: contributes `PPTOI`, `unit`, `pp_share_of_team`, `pp_unit_usage_index`, `pp_unit_relative_toi`, and `pp_vs_unit_avg`; metric families depending on it are PP team share, PP role / PP unit context, and PP debug support; classification is derived contextual plus authoritative builder source for PP team-share reconstruction; quirks are `percentageOfPP` and `pp_unit_usage_index` are unit-relative, not team-share; freshness dependency is high for PP context validation; known refresh endpoint is [update-power-play-combinations/[gameId].ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-power-play-combinations/[gameId].ts).
- `wgo_skater_stats`: contributes the row spine, appearance dates, original `game_id`, team abbreviation, WGO fallback counts, WGO PP share fallback inputs, and WGO TOI fallback inputs; metric families depending on it are all families through row existence plus additive fallback, PP share fallback, and TOI fallback; classification is authoritative for row spine and fallback for a narrow stat subset; quirks are `toi_per_game` may be minutes or seconds and `pp_toi_pct_per_game` is share-like but fallback-only; freshness dependency is critical because every rolling row is WGO-anchored; no writer was found in the inspected surface, so the runbook must document the exact current WGO refresh job or endpoint from operations.
- `nst_gamelog_as_counts`: contributes all-strength player raw counts such as goals, assists, points, shots, ixG, iSCF, iHDCF, hits, blocks, and penalties drawn; metric families depending on it are surface counting stats, weighted `/60`, finishing, expected / chance, and some ratio numerators; classification is authoritative; quirks are raw counts should outrank WGO fallback values; freshness dependency is critical for all-strength validation; no writer was found in the inspected surface, so the runbook must document the current NST counts refresh path.
- `nst_gamelog_as_rates`: contributes all-strength supplementary rates such as `shots_per_60`, `ixg_per_60`, and `toi_per_gp`; metric families depending on it are weighted `/60` fallback and TOI fallback; classification is fallback / supplementary; quirks are rates must never override direct raw totals and can reconstruct numerators only when raw counts are absent; freshness dependency matters for fallback-heavy players; no writer was found in the inspected surface, so the runbook must document the current NST rates refresh path.
- `nst_gamelog_as_counts_oi`: contributes all-strength on-ice counts and territorial context including GF, GA, SF, SA, zone starts, CF, CA, FF, and FA; metric families depending on it are on-ice context, possession / territorial, PDO, zone starts, and TOI secondary authority; classification is authoritative; quirks are on-ice TOI can also act as TOI authority when player counts TOI is absent; freshness dependency is critical for on-ice and territorial validation; no writer was found in the inspected surface, so the runbook must document the current NST on-ice counts refresh path.
- `nst_gamelog_es_counts`: contributes EV player raw counts; metric families depending on it are EV surface stats, EV weighted `/60`, EV finishing, EV expected / chance; classification is authoritative; quirks mirror all-strength counts; freshness dependency is critical for EV audit; refresh path must be captured from the current NST ingest workflow.
- `nst_gamelog_es_rates`: contributes EV supplementary rates and TOI fallback; metric families depending on it are EV weighted `/60` fallback and EV TOI fallback; classification is fallback / supplementary; quirks mirror all-strength rates; freshness dependency matters when EV raw counts or EV TOI are missing; refresh path must be captured from the current NST ingest workflow.
- `nst_gamelog_es_counts_oi`: contributes EV on-ice counts and territorial context; metric families depending on it are EV on-ice context, EV possession / territorial, EV PDO, EV zone starts, and EV TOI secondary authority; classification is authoritative; quirks mirror all-strength on-ice counts; freshness dependency is critical for EV on-ice validation; refresh path must be captured from the current NST ingest workflow.
- `nst_gamelog_pp_counts`: contributes PP player raw counts; metric families depending on it are PP surface stats, PP weighted `/60`, PP finishing, PP expected / chance, and PP points; classification is authoritative; quirks are PP share does not come from this table and must stay separate from PP role context; freshness dependency is critical for PP scoring validation; refresh path must be captured from the current NST ingest workflow.
- `nst_gamelog_pp_rates`: contributes PP supplementary rates and TOI fallback; metric families depending on it are PP weighted `/60` fallback and PP TOI fallback; classification is fallback / supplementary; quirks mirror other NST rates tables; freshness dependency matters for fallback-heavy PP rows; refresh path must be captured from the current NST ingest workflow.
- `nst_gamelog_pp_counts_oi`: contributes PP on-ice counts; metric families depending on it are PP on-ice context, PP territorial metrics, PP PDO, and PP TOI secondary authority; classification is authoritative; quirks mirror other on-ice tables; freshness dependency is critical for PP on-ice validation; refresh path must be captured from the current NST ingest workflow.
- `nst_gamelog_pk_counts`: contributes PK player raw counts; metric families depending on it are PK surface stats, PK weighted `/60`, PK finishing, and PK expected / chance; classification is authoritative; quirks mirror other counts tables; freshness dependency is critical for PK audit; refresh path must be captured from the current NST ingest workflow.
- `nst_gamelog_pk_rates`: contributes PK supplementary rates and TOI fallback; metric families depending on it are PK weighted `/60` fallback and PK TOI fallback; classification is fallback / supplementary; quirks mirror other rates tables; freshness dependency matters when PK raw counts or PK TOI are sparse; refresh path must be captured from the current NST ingest workflow.
- `nst_gamelog_pk_counts_oi`: contributes PK on-ice counts; metric families depending on it are PK on-ice context, PK territorial metrics, PK PDO, and PK TOI secondary authority; classification is authoritative; quirks mirror other on-ice tables; freshness dependency is critical for PK on-ice validation; refresh path must be captured from the current NST ingest workflow.
- `rolling_player_game_metrics`: contributes the stored target surface, resume behavior, overwrite behavior, downstream compatibility reads, and the stored-vs-reconstructed comparison target; metric families depending on it are all persisted families plus all validation outputs; classification is derived target storage and stale-state artifact, never upstream truth; quirks are it contains both canonical and legacy aliases plus support columns; freshness dependency is absolute because stale target rows invalidate comparisons; known refresh path is [update-rolling-player-averages.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-player-averages.ts).

## 2. Introduction / Overview

The first pass fixed the rolling pipeline contract, added helper modules, expanded diagnostics, and broadened the `rolling_player_game_metrics` schema. The second pass is not another broad remediation sweep. It is a strict field-level audit and debug-surface optimization pass that must prove, metric by metric, that the persisted rolling table still means what the code says it means.

The current architecture is materially different from the original audit baseline:

- [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts) now uses explicit helper contracts for PP share, PP unit context, line context, TOI trust, source selection, availability semantics, rolling window semantics, and diagnostics
- the table schema now contains canonical availability / participation fields, canonical ratio / weighted-rate aliases, optional PP context fields, and explicit support columns for numerator / denominator inspection
- [trendsDebug.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.tsx) is still a sustainability-model workbench that reads only a narrow slice of the rolling table and does not function as a rolling-metrics validation console

This PRD defines a new implementation-oriented pass that:

- audits every persisted metric and support field in `rolling_player_game_metrics`
- produces a strict formula-only notes artifact for pass 2
- produces a separate running actionable backlog for improvements discovered during the audit
- formalizes the freshness and recompute workflow required for trustworthy validation
- redesigns `trendsDebug.tsx` into the primary inspection surface for manual audit execution

## 3. Goals

- Loop through every persisted metric in `rolling_player_game_metrics` and verify the logic, code path, stored behavior, and reconstructability of each metric individually.
- Classify every audited metric or field as `✅ WORKING`, `❌ BROKEN`, `🔧 ALMOST`, or `⚠️ NEEDS REVIEW`.
- Produce a strict pass-2 audit-notes artifact at [rpm-audit-notes-pass-2.md](/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-notes-pass-2.md) that contains only status, metric name, and formula.
- Produce a separate pass-2 action-items backlog at [rpm-audit-action-items-pass-2.md](/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-action-items-pass-2.md) that captures concrete fixes, optimizations, cleanup, observability work, runbook work, performance improvements, and optional high-value follow-ups discovered during the audit.
- Produce a full freshness and recompute runbook covering source tables, refresh dependencies, endpoints, refresh order, stale-tail risks, and validation blockers.
- Redesign [trendsDebug.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.tsx) into the best manual inspection and validation page for the rolling audit.
- Preserve completed first-pass work unless pass-2 validation proves a regression, stale contract, or unresolved mismatch.
- Keep downstream consumers such as [trends/player/[playerId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/player/[playerId].tsx), [skater-queries.ts](/Users/tim/Code/fhfhockey.com/web/lib/projections/queries/skater-queries.ts), [run-forge-projections.ts](/Users/tim/Code/fhfhockey.com/web/lib/projections/run-forge-projections.ts), and [update-start-chart-projections.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-start-chart-projections.ts) compatible with the validated contract.

## 4. User Stories

- As the maintainer of the rolling pipeline, I need every persisted field traced to source tables, source fields, and a concrete formula so I can verify correctness without re-discovering the architecture.
- As a validator, I need to compare stored values to reconstructed values for any player, game date, strength, and metric in one place.
- As an operator, I need a freshness runbook that tells me what must be refreshed before I trust a comparison.
- As a reviewer, I need status inventories that stay separate from rationale, schema recommendations, and validation walkthroughs.
- As a downstream consumer owner, I need canonical-versus-legacy compatibility decisions called out explicitly so projections and trend pages do not drift.
- As a future task generator, I need this PRD to be concrete enough that the next implementation task list can be generated without ambiguity.

## 5. Functional Requirements

1. The pass-2 audit must cover the current rolling write path, helper contracts, schema surface, debug surface, downstream readers, and adjacent Vitest coverage.
2. The reviewed file surface must include, at minimum:
   - [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)
   - [update-rolling-player-averages.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-player-averages.ts)
   - [rollingHistoricalAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingHistoricalAverages.ts)
   - [rollingMetricAggregation.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricAggregation.ts)
   - [rollingPlayerMetricMath.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerMetricMath.ts)
   - [rollingWindowContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingWindowContract.ts)
   - [rollingPlayerPpShareContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPpShareContract.ts)
   - [rollingPlayerPpUnitContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPpUnitContract.ts)
   - [rollingPlayerLineContextContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerLineContextContract.ts)
   - [rollingPlayerToiContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerToiContract.ts)
   - [rollingPlayerSourceSelection.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerSourceSelection.ts)
   - [rollingPlayerAvailabilityContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerAvailabilityContract.ts)
   - [rollingPlayerPipelineDiagnostics.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts)
   - [trendsDebug.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.tsx)
   - [trends/player/[playerId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/player/[playerId].tsx)
   - [skater-queries.ts](/Users/tim/Code/fhfhockey.com/web/lib/projections/queries/skater-queries.ts)
   - [run-forge-projections.ts](/Users/tim/Code/fhfhockey.com/web/lib/projections/run-forge-projections.ts)
   - [update-start-chart-projections.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-start-chart-projections.ts)
   - [update-power-play-combinations/[gameId].ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-power-play-combinations/[gameId].ts)
   - [update-line-combinations/[id].ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-line-combinations/[id].ts)
   - [update-line-combinations/index.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-line-combinations/index.ts)
   - [powerPlayCombinationMetrics.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts)
   - [database-generated.types.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/database-generated.types.ts)
   - [20260310_remediate_rolling_player_metrics_gp_pct.sql](/Users/tim/Code/fhfhockey.com/migrations/20260310_remediate_rolling_player_metrics_gp_pct.sql)
   - [20260311_add_canonical_rolling_player_metric_contract_fields.sql](/Users/tim/Code/fhfhockey.com/migrations/20260311_add_canonical_rolling_player_metric_contract_fields.sql)
   - [20260311_add_optional_rolling_player_pp_context_fields.sql](/Users/tim/Code/fhfhockey.com/migrations/20260311_add_optional_rolling_player_pp_context_fields.sql)
   - [20260311_add_optional_rolling_player_support_metrics.sql](/Users/tim/Code/fhfhockey.com/migrations/20260311_add_optional_rolling_player_support_metrics.sql)
   - [20260311_add_optional_rolling_player_weighted_rate_metrics.sql](/Users/tim/Code/fhfhockey.com/migrations/20260311_add_optional_rolling_player_weighted_rate_metrics.sql)
3. The audit must cover every logical metric family and every individual persisted field in `rolling_player_game_metrics`, including identity columns, context labels, canonical fields, legacy aliases, support columns, optional context columns, availability / participation columns, and any compatibility-only duplicates still present in the generated types.
4. The primary audit output for each metric must include:
   - metric name
   - logical family
   - persisted field or field set
   - source tables
   - source fields
   - code path
   - canonical formula
   - intended hockey meaning
   - current stored-field behavior
   - reconstruction method
   - validation status
   - mismatch cause bucket when applicable
5. The allowed mismatch cause buckets are:
   - stale source
   - stale target
   - logic defect
   - schema-contract issue
   - source-gap issue
   - fallback-side effect
   - unit/scale mismatch
   - unresolved verification blocker
6. The pass-2 audit must validate both family-level semantics and field-level persistence semantics; a metric family cannot be marked healthy if a support field, alias, or canonical companion field is inconsistent with the same family contract.
7. The audit must explicitly verify that current stored outputs can be reconstructed from refreshed upstream data for all major families and all individual persisted metric surfaces selected for validation.
8. The audit must create or update [rpm-audit-notes-pass-2.md](/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-notes-pass-2.md) as a strict formula-only list of metric entries.
9. The audit-notes file must contain only repeated metric entries in this exact shape:

   ```md
   - ✅ `pp_share_pct_avg_season`
     - formula: `sum(player_pp_toi) / sum(team_pp_toi_inferred_from_share)`
   ```

10. The audit-notes file must not contain explanatory paragraphs, rationale, freshness notes, dependency notes, validation notes, headings between entries, or prose outside the metric list itself.
11. The audit must create or update [rpm-audit-action-items-pass-2.md](/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-action-items-pass-2.md) as a running implementation-oriented backlog generated during audit execution.
12. Each entry in `rpm-audit-action-items-pass-2.md` must include:
   - title
   - category
   - priority
   - affected metric(s) or field(s)
   - affected file(s)
   - problem summary
   - recommended action
   - expected benefit
   - blocker status
   - source of discovery
   - status
13. Suggested action-item categories are:
   - correctness
   - schema / naming
   - source selection
   - rolling window semantics
   - availability / participation semantics
   - TOI trust / fallback
   - PP context
   - line context
   - diagnostics / observability
   - freshness / recompute workflow
   - `trendsDebug.tsx`
   - downstream compatibility
   - performance / efficiency
   - test coverage
   - optional enhancement
14. Suggested priority labels are `P0`, `P1`, `P2`, and `P3`.
15. Suggested status labels are `open`, `planned`, `deferred`, `blocked`, `done`.
16. Every audited metric may generate up to three parallel outputs:
   - a status / formula entry in `rpm-audit-notes-pass-2.md`
   - a detailed rationale and validation entry in the main audit artifact
   - an actionable backlog entry in `rpm-audit-action-items-pass-2.md` when the audit reveals a concrete improvement opportunity
17. An actionable backlog item must be created whenever the audit finds:
   - incorrect logic
   - semantically misleading naming
   - stale or fragile fallback behavior
   - insufficient debug visibility
   - missing support fields or validation payload data
   - excessive recompute friction
   - avoidable performance inefficiency
   - unnecessary downstream compatibility complexity
   - weak freshness observability
   - missing or inadequate test coverage
   - optional but high-value metric additions
   - opportunities to simplify the pipeline without changing output meaning
18. The pass-2 work must define a dedicated freshness and recompute runbook that documents every relevant source table, refresh dependency, endpoint, refresh order, stale-tail blocker, and metric-family-specific refresh prerequisite.
19. The pass-2 work must define a dedicated optimization plan for [trendsDebug.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.tsx) and position it as a validation console rather than a simple trends or model-sandbox page.
20. The audit must validate with multiple player archetypes:
   - healthy full-season skater
   - injured or missed-games skater
   - traded or multi-team skater
   - heavy-PP skater
   - line-context validation skater
   - TOI / fallback validation skater
21. The pass-2 validation set may reuse first-pass players where still useful, but it must add any new archetype coverage missing from first-pass validation, especially current-season traded / multi-team behavior and fallback-heavy TOI cases.
22. The audit must review adjacent tests, identify missing test coverage for any still-uncertain contract, and use those test files as contract evidence when deciding whether a behavior is intentional versus accidental.
23. The PRD must preserve a clear separation between status inventories, rationale, validation examples, schema recommendations, suggested additions, action backlog content, runbook content, and debug-console requirements.
24. The PRD must remain implementation-oriented: the resulting task list should be able to assign discrete work items for audit execution, page redesign, runbook authoring, backlog follow-up, and remediation sequencing.

## 6. Non-Goals

- This PRD does not replace the entire rolling storage model unless pass-2 validation proves the current model cannot express the intended contract.
- This PRD does not redesign unrelated projections or UI surfaces outside affected rolling consumers and the required `trendsDebug.tsx` work.
- This PRD does not add new external data providers.
- This PRD does not redo completed first-pass work unless pass-2 validation proves that the implementation or stored outputs are still wrong.
- This PRD does not treat stale target rows as correctness evidence.
- This PRD does not convert contextual labels such as `pp_unit`, `line_combo_slot`, or `line_combo_group` into arithmetic metrics.

## 7. Design Considerations

- The final pass-2 audit artifact must be optimized for inspection and task generation, not prose volume.
- The final artifact order must be:
  - `Upstream Tables`
  - `Metric Families`
  - `Column-by-Column Inventory`
  - `WORKING`
  - `BROKEN`
  - `ALMOST`
  - `NEEDS REVIEW`
  - `Explanation / Rationale`
  - `Live Validation Examples`
  - `Actionable Findings Backlog`
  - `Freshness and Recompute Runbook`
  - `trendsDebug.tsx Optimization Plan`
  - `Schema Change Recommendations`
  - `Suggested Metric Additions`
  - `Remediation Plan`
- The `WORKING`, `BROKEN`, `ALMOST`, and `NEEDS REVIEW` sections must remain clean checklist-style inventories only.
- The formula-only audit notes file must remain even stricter than the main audit artifact and must not absorb rationale or validation prose.
- The actionable backlog must remain separate from the formula ledger; no action items, remediation notes, or optimization suggestions may be written into `rpm-audit-notes-pass-2.md`.
- The debug console should prefer clear reconciliation panels, deterministic selectors, and copyable audit helpers over polished product-style storytelling.

## 8. Technical Considerations

- The rolling writer is WGO-row-spined. Every per-game row begins from a WGO appearance date and then merges NST counts, NST rates, NST on-ice rows, PP builder rows, and line-combination context.
- The rolling suite now owns four distinct contract classes through [rollingWindowContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingWindowContract.ts): availability, additive performance, ratio performance, and weighted-rate performance.
- The current schema contains both legacy fields such as `*_avg_last5` / `*_total_last5` and canonical fields such as `*_last5` / `*_season`; pass 2 must treat both surfaces as persisted contract that requires validation or deprecation guidance.
- Ratio and weighted-rate families now have explicit support-field surfaces for formula reconstruction; pass 2 must use those support fields as first-class audit targets, not as optional extras.
- Availability and split-strength participation are now separate semantic contracts through [rollingPlayerAvailabilityContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerAvailabilityContract.ts); pass 2 must verify both the canonical replacements and the legacy alias surfaces.
- Diagnostics are currently emitted through logs and run summaries, not persisted row columns. Pass 2 must decide whether the debug console can derive its required trust state from recompute payloads or whether additional persisted or API-level debug surfaces are needed.
- Downstream readers still rely on compatibility helpers such as [rollingPlayerMetricCompatibility.ts](/Users/tim/Code/fhfhockey.com/web/lib/rollingPlayerMetricCompatibility.ts); pass 2 must preserve or intentionally retire those compat paths with explicit downstream impact called out.

## 9. Required Helper and Contract Review

- [rollingWindowContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingWindowContract.ts): owns family-level `lastN` semantics; dependent metrics are all additive, ratio, weighted-rate, and availability families; stored semantics are reflected through canonical `*_lastN` and legacy `*_avg_lastN` / `*_total_lastN` fields; `trendsDebug.tsx` must expose the contract summary and show selected window membership; validation hook is per-metric window-member inspection.
- [rollingPlayerPpShareContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPpShareContract.ts): owns `pp_share_pct` team-share semantics and builder-versus-WGO fallback rules; dependent metrics are `pp_share_pct_*`, `pp_share_pct_player_pp_toi_*`, and `pp_share_pct_team_pp_toi_*`; stored semantics are reflected directly in PP share fields; `trendsDebug.tsx` must show builder numerator, builder share, fallback WGO inputs, and excluded unit-relative fields; validation hook is stored-versus-reconstructed PP share by window.
- [rollingPlayerPpUnitContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPpUnitContract.ts): owns trusted `pp_unit` labeling; dependent fields are `pp_unit`, `pp_unit_usage_index`, `pp_unit_relative_toi`, `pp_vs_unit_avg`, and contextual PP panels; stored semantics are reflected only as contextual labels and optional fields, not as rolling math; `trendsDebug.tsx` must show trust state and freshness blockers; validation hook is refreshed `powerPlayCombinations` comparison.
- [rollingPlayerLineContextContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerLineContextContract.ts): owns trusted `line_combo_slot` and `line_combo_group`; dependent fields are those two line-context columns only; stored semantics are reflected as contextual labels; `trendsDebug.tsx` must show source row presence and trusted-assignment status; validation hook is refreshed `lineCombinations` comparison.
- [rollingPlayerToiContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerToiContract.ts): owns TOI source precedence, trust tier, WGO normalization, fallback seed, and suspicious-reason handling; dependent metrics are every `/60` family, `toi_seconds`, split-strength participation, and any ratio needing TOI-based appearance qualification; stored semantics are only partially reflected in row outputs today; `trendsDebug.tsx` must expose chosen TOI source, rejected candidates, trust tier, normalization mode, and suspicious reasons; validation hook is per-row TOI-resolution trace.
- [rollingPlayerSourceSelection.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerSourceSelection.ts): owns NST-over-WGO additive stat precedence; dependent metrics are goals, assists, shots, hits, blocks, points, PP points, and ixG additive sources; stored semantics are reflected indirectly through additive totals and support fields; `trendsDebug.tsx` must show when WGO fallback was used; validation hook is source-row side-by-side comparison.
- [rollingPlayerAvailabilityContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerAvailabilityContract.ts): owns current versus intended availability and participation semantics; dependent fields are `games_played`, `team_games_played`, canonical availability / participation fields, and legacy `gp_pct_*`; stored semantics are reflected directly; `trendsDebug.tsx` must show numerator, denominator, semantic type, and team-game window membership; validation hook is team-ledger reconstruction.
- [rollingPlayerPipelineDiagnostics.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts): owns coverage warnings, stale-tail warnings, derived-window diagnostics, scale-bound suspicious-output warnings, and freshness blockers; dependent outputs are run summaries and debug-console warnings; stored semantics are not persisted row columns today; `trendsDebug.tsx` must surface these diagnostics from recompute payloads or a dedicated validation API; validation hook is rerun diagnostics on demand.

## 10. Metric Families

- Availability / participation: `games_played`, `team_games_played`, `season_games_played`, `season_team_games_available`, `three_year_games_played`, `three_year_team_games_available`, `career_games_played`, `career_team_games_available`, `games_played_lastN_team_games`, `team_games_available_lastN`, `season_availability_pct`, `three_year_availability_pct`, `career_availability_pct`, `availability_pct_lastN_team_games`, `season_participation_games`, `three_year_participation_games`, `career_participation_games`, `participation_games_lastN_team_games`, `season_participation_pct`, `three_year_participation_pct`, `career_participation_pct`, `participation_pct_lastN_team_games`, `gp_semantic_type`, and legacy `gp_pct_*`.
- TOI: `toi_seconds_total_*`, `toi_seconds_avg_*`, `toi_seconds_*`, plus any TOI-backed support fields used by weighted-rate metrics.
- Surface counting stats: goals, assists, shots, hits, blocks, points, PP points, ixG, iSCF, iHDCF, CF, CA, FF, FA, zone-start counts, and on-ice shot / goal counts across `total_*`, `avg_*`, and canonical scope aliases.
- Weighted `/60` rates: `sog_per_60`, `ixg_per_60`, `goals_per_60`, `assists_per_60`, `primary_assists_per_60`, `secondary_assists_per_60`, `hits_per_60`, and `blocks_per_60` across legacy and canonical surfaces plus support columns.
- Finishing / shooting: `shooting_pct`, `expected_sh_pct`, `primary_points_pct`, `ipp`, `on_ice_sh_pct`, `on_ice_sv_pct`, and `pdo`.
- Expected / chance metrics: ixG, iSCF, iHDCF, `expected_sh_pct`, and any support columns feeding those metrics.
- On-ice context: `on_ice_sh_pct`, `on_ice_sv_pct`, `pdo`, `oi_gf`, `oi_ga`, `oi_sf`, `oi_sa`.
- Territorial / possession: `cf`, `ca`, `cf_pct`, `ff`, `fa`, `ff_pct`, `oz_starts`, `dz_starts`, `nz_starts`, `oz_start_pct`.
- Power-play usage: `pp_share_pct`, `pp_share_pct_player_pp_toi_*`, `pp_share_pct_team_pp_toi_*`, and any direct PP TOI / share additions approved in pass 2.
- PP role / PP unit context: `pp_unit`, `pp_share_of_team`, `pp_unit_usage_index`, `pp_unit_relative_toi`, `pp_vs_unit_avg`.
- Line / role context: `line_combo_slot`, `line_combo_group`.
- Historical baseline columns: every `*_avg_season`, `*_avg_3ya`, `*_avg_career`, canonical `*_season`, `*_3ya`, `*_career`, and raw support companions for season / 3YA / career.
- Diagnostic support / numerator-denominator support columns: every persisted support column added in the March 11 migrations, including ratio numerators / denominators, weighted-rate raw numerators / TOI denominators, and zone-start / PDO / PP share support surfaces.
- Freshness / trust / fallback support fields if persisted and freshness / trust diagnostics if only available via recompute payload: these must still be audited and exposed in the debug console even if they are not stored as row columns today.

## 11. Column-by-Column Inventory

The pass-2 audit must enumerate every field in `Database["public"]["Tables"]["rolling_player_game_metrics"]["Row"]` individually. The inventory source of truth is [database-generated.types.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/database-generated.types.ts), not memory and not only the `METRICS` array.

The inventory must be grouped for readability but remain field-complete across these blocks:

- Row identity and contextual columns: `player_id`, `game_id`, `game_date`, `season`, `team_id`, `strength_state`, `line_combo_slot`, `line_combo_group`, `pp_unit`, `pp_share_of_team`, `pp_unit_usage_index`, `pp_unit_relative_toi`, `pp_vs_unit_avg`, `gp_semantic_type`, `updated_at`.
- Legacy additive surfaces: all `*_total_all`, `*_avg_all`, `*_total_last3/5/10/20`, `*_avg_last3/5/10/20`, `*_avg_season`, `*_avg_3ya`, `*_avg_career` additive fields.
- Canonical ratio and weighted-rate aliases: all `*_all`, `*_last3/5/10/20`, `*_season`, `*_3ya`, `*_career` fields introduced by the March 11 canonical migration.
- Availability and participation replacement fields.
- Legacy GP compatibility fields.
- Ratio support columns for every ratio family.
- Weighted-rate support columns for every weighted-rate family.
- Optional support metric surfaces added on March 11 such as `on_ice_sv_pct`, `oz_starts`, `dz_starts`, `nz_starts`, `oi_gf`, `oi_ga`, `oi_sf`, and `oi_sa`.

For every field, the inventory must capture:

- field name
- family
- strength applicability
- canonical versus legacy role
- formula or derivation
- whether the field is direct metric output, contextual label, support column, or compatibility alias
- whether the field should appear in `trendsDebug.tsx`

## 12. Audit Deliverables

### 12.1 Metric-by-Metric Audit Output

The main audit artifact must contain a field-level and family-level audit covering every persisted metric in `rolling_player_game_metrics`. Each audited metric entry must include:

- metric name
- family
- source tables
- source fields
- code path
- canonical formula
- intended semantic meaning
- current stored-field behavior
- reconstruction method
- validation status
- cause bucket for mismatches

### 12.2 Formula-Only Pass-2 Audit Notes File

The separate artifact [rpm-audit-notes-pass-2.md](/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-notes-pass-2.md) must contain metric entries only. Each entry must be exactly:

```md
- ✅ `metric_name`
  - formula: `...`
```

Allowed status emojis are `✅`, `❌`, `🔧`, and `⚠️`. No explanatory paragraphs are allowed inside that file.

### 12.3 Freshness / Recompute Runbook

The main audit artifact must contain a dedicated section titled `Freshness and Recompute Runbook` that documents:

- every relevant source table
- every relevant refresh endpoint or upstream job
- required refresh order
- dependency chains
- stale-tail and freshness-blocker risks
- what must be refreshed before validating specific metric families
- how `trendsDebug.tsx` exposes freshness status and blockers

### 12.4 Actionable Findings Backlog

The main audit artifact must contain a dedicated section titled `Actionable Findings Backlog` and the audit process must create and maintain the separate running file [rpm-audit-action-items-pass-2.md](/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-action-items-pass-2.md).

The purpose of this backlog is to capture any concrete implementation-oriented opportunity discovered during the audit, including fixes, optimizations, cleanup, debug-surface improvements, schema follow-ups, freshness/runbook improvements, performance improvements, downstream compatibility simplification, and optional high-value enhancements.

The separate backlog file must use a running-item format similar to:

```md
### `P1` Correctness: `pp_share_pct_total_last20` fallback mismatch on partial-builder coverage
- category: `correctness`
- affected metrics: `pp_share_pct_total_last20`, `pp_share_pct_team_pp_toi_last20`
- affected files:
  - `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - `web/lib/supabase/Upserts/rollingPlayerPpShareContract.ts`
- problem: builder coverage gaps can shift the denominator source mix inside the selected window, creating stored-vs-reconstructed ambiguity
- recommended action: require explicit per-game denominator-source trace in validation payload and add a debug-console indicator when mixed-source windows occur
- expected benefit: faster PP-share validation and fewer false-positive mismatch investigations
- blocker status: not a blocker for all metrics, blocker for PP-share confidence
- source of discovery: pass-2 audit validation
- status: `open`
```

### 12.5 `trendsDebug.tsx` Optimization Plan

The main audit artifact must contain a dedicated section titled `trendsDebug.tsx Optimization Plan` that defines the full validation-console redesign, including selectors, panels, diff views, diagnostics, and copy helpers.

## WORKING

- Final audit section contract: entries only; each entry must include `✅`, metric or field name, shorthand formula, and a short status note.
- Use this section only when refreshed stored values and reconstructed values match the intended contract.

## BROKEN

- Final audit section contract: entries only; each entry must include `❌`, metric or field name, shorthand formula, and a short status note.
- Use this section when logic, stored behavior, or reconstruction definitively disagrees with the intended contract.

## ALMOST

- Final audit section contract: entries only; each entry must include `🔧`, metric or field name, shorthand formula, and a short status note.
- Use this section when the contract is mostly right but still blocked by alias drift, fallback side effects, stale-context coupling, or small implementation gaps.

## NEEDS REVIEW

- Final audit section contract: entries only; each entry must include `⚠️`, metric or field name, shorthand formula, and a short status note.
- Use this section when validation is still blocked by freshness, source gaps, unresolved scale issues, or missing confidence in the reconstruction path.

## 17. Explanation / Rationale

This section in the final audit must contain the narrative that is forbidden from the status sections. For each family or disputed metric cluster, it must explain:

- why the current formula is correct or incorrect
- where the code path lives
- whether current stored behavior matches canonical intent
- whether the issue is arithmetic, source selection, window semantics, availability semantics, builder freshness, alias drift, or downstream compatibility
- what the minimal remediation should be

## 18. Live Validation Examples

This section in the final audit must include multiple player examples and show the full proof chain for each selected metric family.

Required example coverage:

- healthy full-season skater
- injured or missed-games skater
- traded or multi-team skater
- heavy-PP skater
- line-context validation skater
- TOI / fallback validation skater

Each validation example must show:

- player and strength state
- target game date or validation slice
- source rows used from upstream tables
- intended formula
- actual code path
- stored value
- reconstructed value
- whether they match
- mismatch cause bucket if they do not match

## 19. Actionable Findings Backlog

This section in the main audit artifact must summarize the highest-value action items discovered during the audit and must remain separate from:

- `WORKING`
- `BROKEN`
- `ALMOST`
- `NEEDS REVIEW`
- `Schema Change Recommendations`
- `Suggested Metric Additions`

The section must summarize action items grouped by:

- correctness blockers
- accuracy / semantic improvements
- debug / observability improvements
- freshness / runbook improvements
- performance / efficiency improvements
- schema / compatibility follow-ups
- optional enhancements

This section is a summary view only. The full running implementation backlog must live in [rpm-audit-action-items-pass-2.md](/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-action-items-pass-2.md).

## 20. Freshness and Recompute Runbook

This section must be explicit and operational. It must document both the dependency graph and the recommended refresh order required for trustworthy validation.

### 19.1 Core Refresh Surfaces

- Raw-source freshness: `games`, `players`, `wgo_skater_stats`, and the relevant NST split tables must be current before any rolling validation run. The exact operational writer or job for WGO and NST raw tables was not present in the inspected code surface, so the runbook must capture the exact current command or endpoint from local operations before validation begins.
- PP context freshness: [update-power-play-combinations/[gameId].ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-power-play-combinations/[gameId].ts) refreshes `powerPlayCombinations` for target games.
- Line context freshness: [update-line-combinations/[id].ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-line-combinations/[id].ts) refreshes single-game line rows; [update-line-combinations/index.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-line-combinations/index.ts) refreshes a batch.
- Rolling target freshness: [update-rolling-player-averages.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-player-averages.ts) refreshes `rolling_player_game_metrics`.
- Downstream consumer freshness: [update-start-chart-projections.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-start-chart-projections.ts) and the FORGE projection readers should only be refreshed after rolling validation is complete for any affected contract.

### 19.2 Recommended Refresh Order

1. Refresh `games` and `players` if their tails are stale.
2. Refresh WGO raw rows for the validation slice.
3. Refresh the relevant NST raw tables for the same slice:
   - counts
   - rates
   - on-ice counts
   - all required strength splits
4. Refresh PP builder rows for validation games when auditing PP share or PP unit context.
5. Refresh line-combination rows for validation games when auditing line context.
6. Recompute rolling rows through [update-rolling-player-averages.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-player-averages.ts) or local [recomputePlayerRowsForValidation(...)](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts) usage for comparison payload generation.
7. Validate stored rows against reconstructed values.
8. Refresh downstream projection surfaces only after rolling rows pass validation or after explicit compatibility decisions are made.

### 19.3 Metric-Family-Specific Refresh Requirements

- Availability / participation validation: requires fresh `games`, WGO row spine, and rolling recompute.
- TOI and weighted-rate validation: requires fresh NST counts, NST rates, NST on-ice counts, WGO fallback inputs, and rolling recompute.
- Surface counting stats: requires fresh NST counts, WGO fallback visibility, and rolling recompute.
- Finishing / expected / chance metrics: requires fresh NST counts plus on-ice counts when the denominator is on-ice based.
- Territorial / possession metrics: requires fresh NST on-ice counts and rolling recompute.
- PP share validation: requires fresh `powerPlayCombinations`, WGO PP fallback fields, and rolling recompute.
- PP unit validation: requires fresh `powerPlayCombinations`; rolling recompute is needed only to compare the stored contextual label to the refreshed builder row.
- Line context validation: requires fresh `lineCombinations`; rolling recompute is needed only to compare the stored contextual label to the refreshed builder row.

### 19.4 Stale-Tail and Dependency-Chain Risks

- `countsTailLag > 0` means count-driven families are not validation-ready.
- `ratesTailLag > 0` means rate-reconstruction and TOI fallback paths are not validation-ready.
- `countsOiTailLag > 0` means on-ice, territorial, zone-start, PDO, and IPP families are not validation-ready.
- `ppTailLag > 0` means PP share and PP unit context are not validation-ready.
- `lineTailLag > 0` means line-context validation is blocked.
- `unknownGameIds > 0` means row identity and game mapping are compromised and stored-vs-source comparisons may be invalid.
- stale `rolling_player_game_metrics` rows are blockers, not evidence.

### 19.5 Diagnostics That Confirm Freshness

- `summarizeCoverage(...)` output shows missing-date and missing-game gaps by source.
- `summarizeSourceTailFreshness(...)` output shows latest source tails and blocker counts.
- `summarizeDerivedWindowDiagnostics(...)` output shows component completeness for GP windows and ratio-support windows.
- `summarizeSuspiciousOutputs(...)` output shows scale-bound or impossible values.
- source-tracking summaries show WGO fallback usage, rate reconstructions, TOI source mix, TOI trust tier, TOI fallback seed, and ixG reconstruction source.

### 19.6 `trendsDebug.tsx` Freshness Exposure Requirements

- The page must show latest source dates and latest stored-row dates for the selected player and strength.
- The page must show counts, rates, counts-on-ice, PP, and line tail lag counts.
- The page must visibly block or warn when the selected comparison is not validation-ready.
- The page must show which refresh action is required next for the selected metric family.

## 21. `trendsDebug.tsx` Optimization Plan

### 20.1 Current Shortcomings

- The current page is a sustainability-model workbench, not a rolling-metrics validation console.
- It queries only the latest `strength_state = all` row for one player.
- It reads only a narrow metric subset and ignores most of the current schema.
- It does not expose source rows, formulas, rolling-window membership, support fields, freshness blockers, TOI trust, PP context trust, or line-context trust.
- It does not compare stored values to reconstructed values.
- It does not help generate the pass-2 audit-notes output.

### 20.2 Product Positioning

`trendsDebug.tsx` must become the primary manual validation console for pass 2. The current sustainability sandbox behavior may remain as a secondary tab or secondary section, but the default experience must serve rolling-metrics inspection and audit execution first.

### 20.3 Required Controls

- player selector with search
- strength selector: `all`, `ev`, `pp`, `pk`
- season selector
- optional team selector for traded / multi-team inspection
- game-range or date-range selector
- game-date row selector
- metric-family filter
- metric selector
- toggle for canonical fields versus legacy aliases
- toggle for mismatches only
- toggle for stale / blocked only
- toggle for support columns

### 20.4 Required Panels

- Freshness banner: latest source tails, latest stored row, blocker count, required next refresh action.
- Stored value panel: selected metric across canonical field, legacy alias, raw stored support fields, and contextual companions if applicable.
- Formula panel: canonical formula, source fields, scale expectation, window contract summary, and semantic notes.
- Source-input panel: raw rows from WGO, NST counts, NST rates, NST on-ice counts, PP builder rows, and line-combination rows used for the selected comparison.
- Rolling-window membership panel: exact games in the selected rolling window, with flags for selected slot, denominator-present, numerator-present, and excluded-from-components.
- Availability denominator panel: current-team game ledger slice, player appearance flags, games played in window, team games available in window, and semantic type.
- Numerator / denominator component panel: all support columns used to reconstruct the selected metric.
- Source precedence / fallback panel: which source won for each relevant component and whether fallback was used.
- TOI trust panel: counts TOI, counts-on-ice TOI, rates TOI, fallback seed, WGO normalization, chosen TOI source, trust tier, and rejected candidates.
- PP context panel: `PPTOI`, `pp_share_of_team`, `pp_unit`, `pp_unit_usage_index`, `pp_unit_relative_toi`, `pp_vs_unit_avg`, WGO PP fallback fields, and excluded unit-relative fields.
- Line context panel: source row presence, trusted assignment status, `line_combo_slot`, `line_combo_group`, and refreshed line row comparison.
- Freshness / stale-tail diagnostics panel: coverage gaps, missing-date counts, unknown game IDs, stale tails, suspicious outputs, and derived-window completeness.
- Stored-vs-reconstructed diff panel: stored value, reconstructed value, absolute diff, signed diff, percent diff when applicable, and mismatch cause bucket.

### 20.5 Required Tables

- row history table for the selected player and strength
- metric matrix table that can pivot all metrics for one selected row
- support-field table that groups canonical metric, legacy alias, and support components together
- source-row table keyed by source table and source date / game
- window-membership table showing inclusion logic for `last3`, `last5`, `last10`, and `last20`

### 20.6 Required Formula and Copy Helpers

- copy selected metric formula for the audit artifact
- copy formula-only audit-notes entry in the exact `rpm-audit-notes-pass-2.md` format
- copy stored-vs-reconstructed comparison block for the rationale section
- copy refresh prerequisites for the selected metric family

### 20.7 Required Validation Behavior

- The page must show both stored and recomputed values for the selected player / strength / row.
- The page must surface canonical-versus-legacy compatibility drift when both are populated.
- The page must surface null-intentional fields separately from missing-data fields.
- The page must make it obvious when a metric is excluded by contract for the selected strength, such as `pp_share_pct` outside `all` and `pp`.

### 20.8 Implementation Shape

- Prefer a dedicated server-side validation payload over ad hoc browser-side Supabase joins.
- The validation payload should be keyed by player, strength, season, optional team, and date range, and should return:
  - stored rolling rows
  - recomputed rolling rows for comparison
  - source rows
  - diagnostics summaries
  - helper-contract metadata
  - formula metadata
- The UI should render this payload without re-implementing rolling math in the browser.

## 22. Schema Change Recommendations

The final pass-2 audit must keep schema recommendations separate from status inventories and must explicitly address:

- whether canonical `*_all`, `*_lastN`, `*_season`, `*_3ya`, and `*_career` fields are now authoritative and which legacy `*_avg_*` / `*_total_*` fields can be frozen, retained for compatibility, or deprecated
- whether `games_played` and `team_games_played` remain useful as standalone convenience fields or should yield to the canonical availability / participation surface
- whether `gp_semantic_type` remains necessary after downstream consumers fully adopt the replacement availability / participation contract
- whether TOI trust, source precedence, or freshness state requires persisted support columns or whether a validation API is sufficient
- whether additional window-membership support must be stored or can remain derived on demand
- whether the March 10 and March 11 migration set should remain as-is, be superseded by cleanup migrations, or be followed by alias-retirement migrations after downstream readers are updated

## 23. Suggested Metric Additions

- `penalties_drawn`: source tables are `nst_gamelog_as_counts`, `nst_gamelog_es_counts`, `nst_gamelog_pp_counts`, and `nst_gamelog_pk_counts`; formula is `sum(penalties_drawn)`; it helps explain PP-opportunity creation and role-driven value; it belongs in all applicable strength splits; it should be exposed in `trendsDebug.tsx`.
- `penalties_drawn_per_60`: source tables are the same NST counts tables plus resolved TOI; formula is `sum(penalties_drawn) / sum(toi_seconds) * 3600`; it helps compare draw rate independent of deployment; it belongs in all applicable strength splits; it should be exposed in `trendsDebug.tsx`.
- `primary_assists`: source tables are the NST counts tables via `first_assists`; formula is `sum(first_assists)`; it helps validate `primary_points_pct` and `primary_assists_per_60`; it belongs in all applicable strength splits; it should be exposed in `trendsDebug.tsx`.
- `secondary_assists`: source tables are the NST counts tables via `second_assists`; formula is `sum(second_assists)`; it helps validate `secondary_assists_per_60` and assist decomposition; it belongs in all applicable strength splits; it should be exposed in `trendsDebug.tsx`.
- `pp_toi_seconds`: source tables are `powerPlayCombinations.PPTOI` with `wgo_skater_stats.pp_toi` as fallback for compatibility-only inspection; formula is `sum(player_pp_toi_seconds)`; it helps validate PP share and PP deployment without back-solving from share; it belongs in `all` and `pp` splits only; it should be exposed in `trendsDebug.tsx`.

## 24. Success Metrics

- 100% of persisted fields in `rolling_player_game_metrics` are inventoried and classified.
- 100% of audited metrics in scope have a canonical formula, code path, and reconstruction method documented.
- `tasks/rpm-audit-notes-pass-2.md` exists and contains only strict metric entries with formula lines.
- `tasks/rpm-audit-action-items-pass-2.md` exists and functions as a running implementation backlog generated during the audit.
- the final audit documents every relevant refresh surface and refresh order required to make validation trustworthy.
- `trendsDebug.tsx` can inspect any selected metric with stored value, source inputs, formula, rolling-window membership, support fields, freshness state, and stored-vs-reconstructed diff.
- no mismatch remains uncategorized after pass-2 validation.
- every concrete improvement opportunity discovered during the audit is captured either as an open, planned, deferred, blocked, or done item in the separate action-items backlog.
- the next task list can resume implementation from the highest-priority unresolved remediation step without needing another discovery pass.

## 25. Open Questions

- The exact operational writers for WGO and NST raw tables were not present in the inspected file surface. The runbook must capture those exact refresh commands from current operations before pass-2 validation begins.
- If the validation console requires too much derived context for browser-only loading, should the implementation add a dedicated read-only validation API route or a server-side loader helper shared by the page and scripts.
- Should the current sustainability sandbox remain on `trendsDebug.tsx` as a secondary tab, or should it move to a separate route once the rolling audit console becomes the primary page.
- After pass-2 validation, which legacy alias columns can be retired without breaking [trends/player/[playerId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/player/[playerId].tsx), [skater-queries.ts](/Users/tim/Code/fhfhockey.com/web/lib/projections/queries/skater-queries.ts), [run-forge-projections.ts](/Users/tim/Code/fhfhockey.com/web/lib/projections/run-forge-projections.ts), and [update-start-chart-projections.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-start-chart-projections.ts).

## 26. Remediation Plan

1. Correctness blockers
   - build the complete field inventory from the generated table type
   - extract the canonical formula and reconstruction method for every persisted metric and support field
   - execute field-by-field validation for every major family and every disputed metric
   - classify all mismatches into the required cause buckets
   - create actionable backlog items immediately when correctness issues or concrete improvements are discovered
2. Debug-surface and observability work
   - add a validation payload path that returns stored rows, recomputed rows, source rows, helper metadata, and diagnostics
   - redesign `trendsDebug.tsx` around validation selectors, source panels, component panels, freshness panels, and diff panels
   - add copy helpers for audit-notes and rationale output
   - add backlog items for any missing visibility, missing payload fields, or inefficient validation flow discovered during implementation
3. Freshness and runbook work
   - document the exact upstream raw refresh commands missing from the inspected code surface
   - codify refresh order and family-specific prerequisites
   - standardize stale-tail blocker handling and page-level blocker messaging
4. Schema or naming follow-ups
   - decide which canonical fields are authoritative
   - decide which legacy aliases stay, freeze, or deprecate
   - decide whether any additional trust or debug-support fields require storage changes
   - document downstream compatibility expectations for trend pages and projection readers
5. Optional metric additions
   - evaluate `penalties_drawn`, `penalties_drawn_per_60`, `primary_assists`, `secondary_assists`, and `pp_toi_seconds`
   - add only the additions that remain derivable from existing sources without new providers

The remediation plan must explicitly treat [rpm-audit-action-items-pass-2.md](/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-action-items-pass-2.md) as the source for implementation sequencing after the audit.

The pass-2 audit is not only descriptive. It must continuously surface concrete next actions while validation is in progress.

The pass-2 effort must leave behind both:

- a strict validation ledger in [rpm-audit-notes-pass-2.md](/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-notes-pass-2.md)
- an implementation backlog in [rpm-audit-action-items-pass-2.md](/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-action-items-pass-2.md)

Once this pass-2 PRD and audit work are complete, the next implementation phase can resume from the highest-priority unresolved remediation step with the audit notes, action-items backlog, runbook, and `trendsDebug.tsx` validation console acting as the authoritative execution surface.
