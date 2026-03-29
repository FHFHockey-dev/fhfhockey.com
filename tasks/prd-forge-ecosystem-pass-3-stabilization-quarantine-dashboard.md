# PRD: FORGE Ecosystem Pass 3 Stabilization, Endpoint Quarantine, and Landing Dashboard Polish

## Overview

This pass is a stabilization and cleanup pass for the current FORGE ecosystem. Prior work already audited the rolling-player metrics pipeline and introduced contract helpers, compatibility layers, diagnostics, and pass-2 validation surfaces. Pass 3 is not another artifact-heavy audit cycle. It is the controlled consolidation pass that turns the current ecosystem into one implementation-ready plan.

This document is the single pass-3 source of truth for:

- FORGE ecosystem health review
- endpoint and run-file health classification
- explicit quarantine tracking for unsafe or drifted surfaces
- freshness and dependency-chain review
- deprecation, merge, and delete candidates
- remediation planning
- landing dashboard visual polish planning

Pass-3 scope is driven by the current codebase, not the historical ideal architecture. The working assumption is that the canonical path today is:

1. core entity freshness
2. skater-source freshness
3. contextual builders
4. rolling recompute
5. projection ingest
6. projection derived build
7. projection execution
8. downstream consumers

The main problem is not lack of moving pieces. The main problem is that multiple overlapping execution surfaces now coexist:

- canonical FORGE outputs and readers
- older legacy projection surfaces still alive beside them
- compatibility shims that were never fully retired
- downstream consumers still reading older tables
- builder and refresh routes whose names, outputs, and operator expectations no longer line up cleanly

The result is avoidable confusion around what is current, what is safe to run, what is stale, and what actually drives the product. The landing dashboard has a parallel issue: it is useful, but visually inconsistent, overly dense, mobile-fragile, and weak at communicating product value.

## Goals

- Stabilize the current rolling-to-FORGE pipeline around a smaller set of canonical execution surfaces.
- Create a compact endpoint health registry with explicit health and run-safety statuses.
- Establish an explicit quarantine ledger for broken, outdated, redundant, unsafe, or drifted surfaces.
- Reduce dead surface area, duplicate ownership, and ambiguous execution paths.
- Make freshness dependencies and ordering risks explicit enough to drive reliable follow-up implementation.
- Produce a remediation plan that maps every meaningful issue to a concrete next action.
- Improve the landing dashboard with targeted polish that increases clarity, cohesion, responsiveness, and scanability without drifting into a full-site redesign.

## User Stories

- As the maintainer of the FORGE stack, I need one canonical document that tells me which routes are healthy, which are suspect, and which should not be run.
- As the operator of refresh and rebuild jobs, I need explicit dependency ordering and freshness validation so stale upstream data does not quietly invalidate downstream outputs.
- As a developer working on rolling, projections, or dashboard consumers, I need to know which files are canonical and which ones are compatibility holdovers or retirement candidates.
- As a reviewer, I need quarantined surfaces to be obvious, evidence-backed, and paired with a repair, replace, merge, deprecate, or delete recommendation.
- As a site visitor, I need the landing dashboard to feel intentional, modern, and easy to scan instead of dense, uneven, and desktop-biased.

## Functional Requirements

1. The implementation must treat this document as the only pass-3 planning artifact. No separate quarantine doc, endpoint inventory, dashboard design note, or sidecar task markdown should be created for pass 3.
2. The implementation must classify relevant endpoint and run-file surfaces with explicit health statuses: `HEALTHY`, `BROKEN`, `OUTDATED`, `REDUNDANT`, `UNKNOWN`, `QUARANTINED`.
3. The implementation must classify run safety with explicit labels: `SAFE TO RUN`, `RUN ONLY AFTER DEPENDENCIES`, `DO NOT RUN`, `NEEDS VERIFICATION`.
4. The implementation must maintain an endpoint health registry with purpose, dependency chain, downstream outputs, health, safety, freshness risk, and recommended disposition.
5. The implementation must maintain an endpoint quarantine ledger for unhealthy or suspect surfaces with file path, route or entrypoint, evidence, downstream risk, and clear disposition.
6. The implementation must identify duplicate or drifted responsibilities and recommend merge, deprecation, or deletion where appropriate.
7. The implementation must make freshness ordering explicit for rolling recompute, contextual builders, projection inputs, derived tables, projection execution, and dashboard consumers.
8. The implementation must treat legacy compatibility surfaces as temporary operational liabilities, not silent long-term architecture.
9. The implementation must review the landing dashboard and directly related shared components and produce a scoped improvement plan with quick wins, medium structural changes, and optional deeper redesign ideas.
10. The implementation must end in a prioritized remediation plan that is sufficient for clean follow-up task generation without another audit pass.

## Non-Goals

- Rewriting the entire app without evidence that the current structure prevents targeted repair.
- Creating more markdown sprawl.
- Redesigning unrelated pages outside the landing dashboard and directly related shared components.
- Replacing healthy FORGE architecture only because older surfaces still exist nearby.
- Introducing new external providers.
- Re-doing already-completed pass-1 or pass-2 work unless pass-3 validation shows the current surface is still stale, duplicated, drifted, or harmful.

## Design Considerations

- Registry and ledger sections should stay table-driven and operationally legible.
- Status should be visible at scan speed, not buried in prose.
- Dashboard polish should favor hierarchy, rhythm, spacing, and clarity over novelty.
- The landing page should clearly communicate what the site helps a fantasy hockey user do today.
- Visual changes should preserve useful current content while improving coherence and reducing noise.

## Technical Considerations

- `fetchRollingPlayerAverages.ts` is now the semantic owner for the rolling pipeline, but it is still a very large orchestration surface with substantial compatibility baggage.
- `rolling_player_game_metrics` contains canonical fields, legacy alias fields, compatibility-only fields, and newer support columns; downstream readers still depend on both canonical and legacy ordering rules.
- `run-forge-projections.ts` is the canonical projection runner, and the old `runProjectionV2.ts` shim has been removed from runtime.
- `run-rolling-forge-pipeline.ts` and `rollingForgePipeline.ts` now define the newer stage model with stage 8 reduced to accuracy refresh only after the legacy start-chart materializer was retired.
- The start-chart read layer is aligned to canonical `forge_player_projections`, and the legacy `player_projections` materializer has now been removed from the live pipeline.
- `goalie_start_projections` remains a live dependency for multiple readers and runners, which means the table still carries shared ownership and legacy naming pressure even though the old writer route is now disabled.
- `team_power_ratings_daily` and `team_power_ratings_daily__new` still both exist structurally, but the rating service now reads only `team_power_ratings_daily` and the alternate writer is disabled.
- The landing page was broken into focused homepage sections and no longer relies on the previous hard `min-width: 1300px` desktop lock, though further browser verification is still warranted.

## Success Metrics

- One canonical pass-3 document is sufficient to generate the follow-up task list.
- Every meaningful surface in the registry has a disposition and a next action.
- At least the highest-risk drifted routes are either quarantined or assigned a canonical replacement path.
- The number of ambiguous read/write surfaces in the rolling-to-FORGE chain is materially reduced.
- Freshness ordering for rolling, builders, derived tables, and consumer reads is explicit enough to prevent false validation.
- The landing dashboard no longer forces horizontal desktop assumptions on mobile and has coherent loading, empty, and error presentation.
- The landing dashboard clearly surfaces primary value and primary actions instead of reading like a stack of unrelated utilities.

## File Surface Reviewed

### Rolling and FORGE Core

- `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
- `web/pages/api/v1/db/update-rolling-player-averages.ts`
- `web/lib/projections/run-forge-projections.ts`
- `web/lib/projections/queries/skater-queries.ts`
- `web/pages/api/v1/db/run-projection-v2.ts`
- `web/pages/api/v1/db/run-rolling-forge-pipeline.ts`
- `web/lib/rollingForgePipeline.ts`
- `web/lib/projections/goaliePipeline.ts`

### Rolling Helper and Contract Surfaces

- `web/lib/supabase/Upserts/rollingHistoricalAverages.ts`
- `web/lib/supabase/Upserts/rollingMetricAggregation.ts`
- `web/lib/supabase/Upserts/rollingPlayerMetricMath.ts`
- `web/lib/supabase/Upserts/rollingWindowContract.ts`
- `web/lib/supabase/Upserts/rollingPlayerPpShareContract.ts`
- `web/lib/supabase/Upserts/rollingPlayerPpUnitContract.ts`
- `web/lib/supabase/Upserts/rollingPlayerLineContextContract.ts`
- `web/lib/supabase/Upserts/rollingPlayerToiContract.ts`
- `web/lib/supabase/Upserts/rollingPlayerSourceSelection.ts`
- `web/lib/supabase/Upserts/rollingPlayerAvailabilityContract.ts`
- `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts`
- `web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts`
- `web/lib/rollingPlayerMetricCompatibility.ts`

### Endpoint and Consumer Surfaces

- `web/pages/api/v1/db/update-line-combinations/index.ts`
- `web/pages/api/v1/db/update-line-combinations/[id].ts`
- `web/pages/api/v1/db/update-power-play-combinations/[gameId].ts`
- `web/pages/api/v1/db/ingest-projection-inputs.ts`
- `web/pages/api/v1/db/build-projection-derived-v2.ts`
- `web/pages/api/v1/db/update-goalie-projections-v2.ts`
- `web/pages/api/v1/db/update-goalie-projections.ts`
- `web/pages/api/v1/db/run-projection-accuracy.ts`
- `web/pages/api/v1/start-chart.ts`
- `web/pages/api/v1/forge/players.ts`
- `web/pages/api/v1/forge/goalies.ts`
- `web/pages/api/v1/forge/accuracy.ts`
- `web/pages/api/v1/projections/players.ts`
- `web/pages/api/v1/projections/goalies.ts`
- `web/pages/api/v1/runs/latest.ts`
- `web/pages/api/v1/db/update-team-power-ratings.ts`
- `web/pages/api/v1/db/update-team-power-ratings-new.ts`
- `web/pages/api/v1/db/update-rolling-games.ts`
- `web/pages/api/v1/db/update-power-rankings.ts`
- `web/pages/api/v1/db/update-games.ts`
- `web/pages/api/v1/db/update-teams.ts`
- `web/pages/api/v1/db/update-players.ts`
- `web/pages/api/v1/db/update-nst-gamelog.ts`
- `web/pages/api/v1/db/update-wgo-skaters.ts`
- `web/pages/api/v1/db/update-wgo-totals.ts`
- `web/pages/api/v1/db/update-wgo-averages.ts`
- `web/pages/api/v1/db/update-wgo-ly.ts`

### UI and Dashboard Surfaces

- `web/pages/index.tsx`
- `web/styles/Home.module.scss`
- `web/components/TransactionTrends/TransactionTrends.tsx`
- `web/components/TeamStandingsChart/TeamStandingsChart.tsx`
- `web/pages/trendsDebug.tsx`
- `web/pages/trends/player/[playerId].tsx`
- `web/pages/trends/index.tsx`
- `web/lib/dashboard/dataFetchers.ts`
- `web/lib/dashboard/freshness.ts`

### Schema, Migrations, and Historical Planning Inputs

- `web/lib/supabase/database-generated.types.ts`
- `migrations/20251224_rename_projection_tables_to_forge.sql`
- `migrations/20260310_remediate_rolling_player_metrics_gp_pct.sql`
- `migrations/20260311_add_canonical_rolling_player_metric_contract_fields.sql`
- `migrations/20260309_add_power_play_combination_usage_fields.sql`
- `migrations/20260311_add_optional_rolling_player_pp_context_fields.sql`
- `migrations/20260311_add_optional_rolling_player_support_metrics.sql`
- `migrations/20260311_add_optional_rolling_player_weighted_rate_metrics.sql`
- `migrations/20260227_add_truncate_rolling_player_game_metrics_rpc.sql`
- `tasks/rolling-player-metrics-audit-notes.md`
- `tasks/prd-rolling-player-metrics-remediation-blueprint.md`
- `tasks/prd-rolling-player-metrics-audit-pass-2-trends-debug.md`

### Adjacent Tests Reviewed for Contract Evidence

- `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`
- `web/lib/supabase/Upserts/rollingHistoricalAverages.test.ts`
- `web/lib/supabase/Upserts/rollingMetricAggregation.test.ts`
- `web/lib/supabase/Upserts/rollingPlayerMetricMath.test.ts`
- `web/lib/supabase/Upserts/rollingWindowContract.test.ts`
- `web/lib/supabase/Upserts/rollingPlayerPpShareContract.test.ts`
- `web/lib/supabase/Upserts/rollingPlayerPpUnitContract.test.ts`
- `web/lib/supabase/Upserts/rollingPlayerLineContextContract.test.ts`
- `web/lib/supabase/Upserts/rollingPlayerToiContract.test.ts`
- `web/lib/supabase/Upserts/rollingPlayerSourceSelection.test.ts`
- `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.test.ts`
- `web/lib/supabase/Upserts/rollingPlayerHelperContracts.test.ts`
- `web/lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts`
- `web/lib/projections/queries/skater-queries.test.ts`
- `web/lib/projections/runProjectionV2.test.ts`
- `web/lib/projections/module-imports.test.ts`
- `web/lib/projections/goaliePipeline.test.ts`
- `web/lib/dashboard/normalizers.test.ts`
- `web/lib/dashboard/playerOwnership.test.ts`
- `web/lib/dashboard/teamContext.test.ts`
- `web/lib/dashboard/topAddsScheduleContext.test.ts`
- `web/lib/dashboard/topAddsRanking.test.ts`

## Status Model

### Health Status

- `HEALTHY`: aligned with the current architecture and appears safe for continued use.
- `BROKEN`: known to fail, drift materially from expected behavior, or encode an invalid contract.
- `OUTDATED`: still present, but superseded or architecturally stale.
- `REDUNDANT`: duplicates another current surface with no strong reason to keep both.
- `UNKNOWN`: cannot be trusted without targeted verification or freshness confirmation.
- `QUARANTINED`: explicitly suspect and should be repair-first, replacement-first, or retirement-first.

### Run Safety

- `SAFE TO RUN`
- `RUN ONLY AFTER DEPENDENCIES`
- `DO NOT RUN`
- `NEEDS VERIFICATION`

## Top Immediate Fix Outcomes

- `/api/v1/start-chart` now reads skater rows from canonical `forge_player_projections` while still joining `goalie_start_projections` for goalie context.
- `web/pages/api/v1/db/update-goalie-projections.ts` is quarantined behind `410 Gone`; `/api/v1/db/update-goalie-projections-v2` is the only supported goalie-start writer.
- `/api/v1/projections/players` and `/api/v1/projections/goalies` remain readable compatibility surfaces, but they now emit explicit deprecation headers and metadata pointing callers to `/api/v1/forge/*`.
- `teamRatingsService` now reads only canonical `team_power_ratings_daily`; `update-team-power-ratings-new.ts` is quarantined behind `410 Gone`.
- Legacy JS-backed loaders `update-rolling-games.ts` and `update-power-rankings.ts` are quarantined behind `410 Gone`.
- The remaining high-risk follow-up is no longer “which path is canonical”; it is finishing retirement of transitional or deprecated surfaces that are now explicitly marked and bounded.

## Execution Safety Notes

- Do not treat `/api/v1/start-chart` as a same-day validation surface unless its explicit `serving` metadata confirms the requested date is being served without fallback.
- Do not use `update-goalie-projections.ts`, `update-team-power-ratings-new.ts`, `update-rolling-games.ts`, or `update-power-rankings.ts` as active operator surfaces; they now return `410 Gone`.
- Do not use the removed `runProjectionV2.ts` shim as justification for teaching the old runner path; `run-forge-projections.ts` is the active module owner.
- Do not trust rolling PP or line-context labels until `powerPlayCombinations` and `lineCombinations` have been refreshed for the target games.
- Do not treat deprecated `/api/v1/projections/*` readers as canonical ownership just because they still return data for compatibility.
- Do not interpret stage 8 of the rolling-to-FORGE pipeline as a canonical skater write stage; it is legacy start-chart materialization plus optional accuracy refresh.
- Do not validate freshness using a consumer endpoint that falls back across dates unless the fallback state is surfaced and accepted for that check.

## Endpoint Health Registry

| Surface | Route / Entrypoint | Purpose | Key Dependencies / Outputs | Active Relevance | Health | Run Safety | Freshness / Observability Risk | Recommended Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `web/pages/api/v1/db/update-games.ts` | `/api/v1/db/update-games` | Refresh game ledger | Depends on `teams` and `team_season`; produces `games` | High | `HEALTHY` | `RUN ONLY AFTER DEPENDENCIES` | Hidden dependency on current `team_season` membership can undercut completeness | Keep; document ordering with `update-teams` and `update-seasons` |
| `web/pages/api/v1/db/update-teams.ts` | `/api/v1/db/update-teams` | Refresh teams and season participation | Depends on `seasons`; produces `teams`, `team_season` | High | `HEALTHY` | `RUN ONLY AFTER DEPENDENCIES` | Good guardrails, but still core-order sensitive | Keep as canonical core-entity refresh |
| `web/pages/api/v1/db/update-players.ts` | `/api/v1/db/update-players` | Refresh players and current roster membership | Depends on team freshness; writes `players`, `rosters` | High | `HEALTHY` | `RUN ONLY AFTER DEPENDENCIES` | Roster RPC is a hidden dependency | Keep as canonical player refresh |
| `web/pages/api/v1/db/update-nst-gamelog.ts` | `/api/v1/db/update-nst-gamelog` | Refresh NST counts/rates/on-ice tables | Produces `nst_gamelog_*` | High | `HEALTHY` | `RUN ONLY AFTER DEPENDENCIES` | Heavy runtime, rate-limited upstream, difficult operator ergonomics | Keep; improve run visibility, not architecture |
| `web/pages/api/v1/db/update-wgo-skaters.ts` | `/api/v1/db/update-wgo-skaters` | Refresh WGO per-game skater spine | Produces `wgo_skater_stats` | High | `HEALTHY` | `RUN ONLY AFTER DEPENDENCIES` | Large multi-endpoint fetch surface | Keep; treat as rolling-spine dependency |
| `web/pages/api/v1/db/update-wgo-totals.ts` | `/api/v1/db/update-wgo-totals` | Refresh WGO season totals | Support tables for downstream historical context | Medium | `UNKNOWN` | `NEEDS VERIFICATION` | Relevant but not clearly tied to canonical FORGE consumers | Keep only if current consumers still rely on it; verify |
| `web/pages/api/v1/db/update-wgo-averages.ts` | `/api/v1/db/update-wgo-averages` | Build WGO average surfaces | Support tables for downstream stats | Medium | `UNKNOWN` | `NEEDS VERIFICATION` | Large derived surface, unclear current consumer ownership | Verify continued need; keep only if still consumed |
| `web/pages/api/v1/db/update-wgo-ly.ts` | `/api/v1/db/update-wgo-ly` | Build last-year WGO helper data | Support table for historical context | Low | `OUTDATED` | `NEEDS VERIFICATION` | Architecturally old support path with unclear current owner | Verify dependency; likely deprecate or fold into a canonical historical path |
| `web/pages/api/v1/db/update-line-combinations/[id].ts` | `/api/v1/db/update-line-combinations/[id]` | Per-game line builder | Produces `lineCombinations` | High | `HEALTHY` | `RUN ONLY AFTER DEPENDENCIES` | Needed for rolling context and start-chart player selection | Keep as canonical per-game builder |
| `web/pages/api/v1/db/update-line-combinations/index.ts` | `/api/v1/db/update-line-combinations` | Line-combination repair surface | Produces `lineCombinations` through explicit `recent_gap` or `historical_backfill` modes | High | `HEALTHY` | `RUN ONLY AFTER DEPENDENCIES` | Historical repair is now explicit, but callers still need to choose the right scope intentionally | Keep as canonical batch repair route |
| `web/pages/api/v1/db/update-power-play-combinations/[gameId].ts` | `/api/v1/db/update-power-play-combinations/[gameId]` | Per-game PP context builder | Produces `powerPlayCombinations` | High | `HEALTHY` | `RUN ONLY AFTER DEPENDENCIES` | Still a per-game builder, but no longer the only repair option | Keep as canonical per-game PP builder |
| `web/pages/api/v1/db/update-power-play-combinations/index.ts` | `/api/v1/db/update-power-play-combinations` | Bulk PP context repair surface | Produces `powerPlayCombinations` for a date range or explicit game set | High | `HEALTHY` | `RUN ONLY AFTER DEPENDENCIES` | Large repair scopes can still be expensive, but the missing bulk-repair story is now addressed | Keep as canonical batch PP repair route |
| `web/pages/api/v1/db/update-rolling-player-averages.ts` | `/api/v1/db/update-rolling-player-averages` | Rolling recompute operator surface | Delegates to `fetchRollingPlayerAverages.ts`; writes `rolling_player_game_metrics` | High | `HEALTHY` | `RUN ONLY AFTER DEPENDENCIES` | Flexible operator surface now exposes `freshnessGate` and blocks on upstream freshness unless explicitly bypassed | Keep as canonical rolling writer |
| `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts` | module entry | Rolling pipeline semantic owner | Reads WGO, NST, PP, line combos; writes rolling rows | High | `HEALTHY` | `RUN ONLY AFTER DEPENDENCIES` | Large monolith with compatibility and diagnostics burden | Keep as owner; continue consolidation inside it |
| `web/pages/api/v1/db/ingest-projection-inputs.ts` | `/api/v1/db/ingest-projection-inputs` | Ingest PBP and shift inputs | Produces `pbp_games`, `pbp_plays`, `shift_charts` | High | `HEALTHY` | `RUN ONLY AFTER DEPENDENCIES` | Partial-resume and skip behavior need explicit freshness interpretation | Keep as canonical ingest stage |
| `web/pages/api/v1/db/build-projection-derived-v2.ts` | `/api/v1/db/build-projection-derived-v2` | Build derived strength tables | Produces `forge_player_game_strength`, `forge_team_game_strength`, `forge_goalie_game` | High | `HEALTHY` | `RUN ONLY AFTER DEPENDENCIES` | Current stage appears aligned and test-backed | Keep as canonical derived builder |
| `web/pages/api/v1/db/update-goalie-projections-v2.ts` | `/api/v1/db/update-goalie-projections-v2` | Build goalie start priors | Writes `goalie_start_projections` | High | `HEALTHY` | `RUN ONLY AFTER DEPENDENCIES` | Still writes pre-FORGE-named table; observability lighter than other v2 surfaces | Keep for now; rename or wrap under canonical ownership later |
| `web/pages/api/v1/db/run-projection-v2.ts` | `/api/v1/db/run-projection-v2` | Canonical FORGE projection execution endpoint | Calls `run-forge-projections.ts`; writes `forge_runs` and projection outputs | High | `HEALTHY` | `RUN ONLY AFTER DEPENDENCIES` | Route name is still migration-era, but preflight, scan summary, and compatibility inventory are now explicit | Keep as canonical executor while planning route/name cleanup |
| `web/lib/projections/run-forge-projections.ts` | module entry | Canonical projection runner | Reads rolling + derived tables; writes FORGE projection tables | High | `HEALTHY` | `RUN ONLY AFTER DEPENDENCIES` | Strong centrality means drift elsewhere quickly becomes product-visible | Keep as canonical runner |
| `web/lib/projections/queries/skater-queries.ts` | module entry | Rolling-reader query surface for skater projection inputs | Reads `rolling_player_game_metrics` with compatibility fallback ordering | High | `HEALTHY` | `RUN ONLY AFTER DEPENDENCIES` | Still depends on canonical-plus-legacy duality | Keep; retire compatibility once downstream is cleaned up |
| `web/pages/api/v1/db/run-projection-accuracy.ts` | `/api/v1/db/run-projection-accuracy` | Accuracy and calibration pass | Reads FORGE outputs; writes accuracy tables | High | `HEALTHY` | `RUN ONLY AFTER DEPENDENCIES` | Now preflights projection freshness and returns `422` unless bypassed when prerequisites are stale | Keep as canonical accuracy stage |
| `web/pages/api/v1/db/run-rolling-forge-pipeline.ts` | `/api/v1/db/run-rolling-forge-pipeline` | Orchestrates the full newer stage model | Invokes all major routes in sequence | High | `HEALTHY` | `RUN ONLY AFTER DEPENDENCIES` | Now exposes operator order, downstream stage meaning, scan summary, and compatibility inventory directly in the response | Keep as canonical orchestration surface |
| `web/lib/rollingForgePipeline.ts` | module entry | Declares canonical stage order | Defines rolling-to-FORGE pipeline model | High | `HEALTHY` | `SAFE TO RUN` | Stage 8 is now accuracy-only, which removes the last live `player_projections` side channel from the operator contract | Keep as authoritative stage contract |
| `web/pages/api/v1/forge/players.ts` | `/api/v1/forge/players` | Current player projection reader | Reads `forge_player_projections`, filters to active roster | High | `HEALTHY` | `SAFE TO RUN` | Fallback behavior is now explicit through `serving` and `scanSummary` metadata instead of implicit | Keep as canonical player reader |
| `web/pages/api/v1/forge/goalies.ts` | `/api/v1/forge/goalies` | Current goalie projection reader | Reads `forge_goalie_projections` with calibration hints | High | `HEALTHY` | `SAFE TO RUN` | Still depends on shared `goalie_start_projections`, but fallback and scan metadata are explicit | Keep as canonical goalie reader |
| `web/pages/api/v1/forge/accuracy.ts` | `/api/v1/forge/accuracy` | Current accuracy reader | Reads `forge_projection_accuracy_daily` | Medium | `HEALTHY` | `SAFE TO RUN` | Low risk | Keep |
| `web/pages/api/v1/runs/latest.ts` | `/api/v1/runs/latest` | Latest run metadata reader | Reads `forge_runs` | Medium | `HEALTHY` | `SAFE TO RUN` | Now emits scan-friendly metadata instead of requiring callers to infer freshness from deeper payloads | Keep |
| `web/pages/api/v1/db/update-start-chart-projections.ts` | retired route | Removed legacy start-chart materializer | Formerly wrote `player_projections` from rolling rows plus contextual inputs | Low | `RETIRED` | `DO NOT RUN` | Live readers no longer depended on `player_projections`, so the route was removed after caller verification and pipeline cleanup | Keep deleted; retain only historical references where needed |
| `web/pages/api/v1/start-chart.ts` | `/api/v1/start-chart` | Start-chart consumer API | Reads skaters from `forge_player_projections` and goalie context from `goalie_start_projections` | High | `HEALTHY` | `SAFE TO RUN` | Still supports fallback serving, but that state is now explicit through canonical-source, compatibility, and serving metadata | Keep as the curated start-chart consumer layer |
| `web/pages/api/v1/projections/players.ts` | `/api/v1/projections/players` | Deprecated generic player projection reader | Reads `forge_player_projections` | Medium | `REDUNDANT` | `SAFE TO RUN` | Duplicates `/api/v1/forge/players`, but now emits explicit deprecation headers and replacement metadata | Keep readable for compatibility, then retire after usage verification |
| `web/pages/api/v1/projections/goalies.ts` | `/api/v1/projections/goalies` | Deprecated generic goalie projection reader | Reads `forge_goalie_projections` | Medium | `REDUNDANT` | `SAFE TO RUN` | Same duplication pattern as the player route, now with explicit deprecation signaling | Keep readable for compatibility, then retire after usage verification |
| `web/pages/api/v1/db/update-goalie-projections.ts` | `/api/v1/db/update-goalie-projections` | Old goalie-prior RPC wrapper | Formerly wrote `goalie_start_projections` through old RPC | Low | `QUARANTINED` | `DO NOT RUN` | Now returns `410 Gone`; remaining risk is hidden scheduler or operator expectations, not dual-write behavior | Delete after usage verification |
| `web/lib/projections/runProjectionV2.ts` | removed shim | Removed compatibility export shim | Formerly re-exported `run-forge-projections` | Low | `OUTDATED` | `DO NOT RUN` | Runtime ambiguity is gone; remaining risk is stale documentation or task references | Keep deleted; clean residual docs only |
| `web/pages/api/v1/db/update-team-power-ratings.ts` | `/api/v1/db/update-team-power-ratings` | Current team power ratings writer | Writes `team_power_ratings_daily` | Medium | `HEALTHY` | `RUN ONLY AFTER DEPENDENCIES` | Still part of downstream start-chart logic | Keep until table ownership is cleaned up |
| `web/pages/api/v1/db/update-team-power-ratings-new.ts` | `/api/v1/db/update-team-power-ratings-new` | Alternate writer for `__new` table | Formerly wrote `team_power_ratings_daily__new` | Low | `QUARANTINED` | `DO NOT RUN` | Now returns `410 Gone`; canonical reads stay on `team_power_ratings_daily` | Delete after confirming no hidden callers still expect the alternate writer |
| `web/pages/api/v1/db/update-rolling-games.ts` | `/api/v1/db/update-rolling-games` | Legacy rolling-games wrapper | Formerly dynamically imported `fetchRollingGames.js` | Low | `QUARANTINED` | `DO NOT RUN` | Now returns `410 Gone`; remaining risk is stale scheduler or benchmark inventory references | Delete after confirming no hidden callers still depend on it |
| `web/pages/api/v1/db/update-power-rankings.ts` | `/api/v1/db/update-power-rankings` | Legacy power-rankings wrapper | Formerly dynamically imported `fetchPowerRankings.js` | Low | `QUARANTINED` | `DO NOT RUN` | Now returns `410 Gone`; there is still no current canonical operator story for this legacy path | Delete after scheduler and consumer verification |

## Endpoint Quarantine Ledger

| Quarantine Status | File Path | Route / Entrypoint | Reason for Quarantine | Evidence | Likely Root Cause | Downstream Impact | `DO NOT RUN` | Recommended Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `QUARANTINED` | `web/pages/api/v1/db/update-goalie-projections.ts` | `/api/v1/db/update-goalie-projections` | Old goalie-start writer is now intentionally disabled | Route returns `410 Gone` and points to `/api/v1/db/update-goalie-projections-v2` | Route-level migration is complete, but cleanup has not yet reached every possible scheduler or manual script | Confusion risk is now limited to stale callers, not silent dual writes | Yes | `delete` after verifying no hidden scheduler or runbook still references it |
| `RETIRED` | `web/pages/api/v1/db/update-start-chart-projections.ts` | `/api/v1/db/update-start-chart-projections` | Legacy downstream materializer was removed after consumer verification | Start-chart and other live skater readers already used `forge_player_projections`; stage-8 orchestration and cron docs were updated before deletion | The route survived earlier as bounded migration debt until the final caller audit was complete | Remaining risk is limited to stale historical docs, not a live side channel | Yes | Keep deleted and continue cleaning residual historical references opportunistically |
| `QUARANTINED` | `web/pages/api/v1/projections/players.ts` | `/api/v1/projections/players` | Deprecated reader duplicates `/api/v1/forge/players` | Route now emits deprecation headers and replacement metadata while still serving compatibility traffic | Namespace cleanup was deferred to avoid breaking unknown callers immediately | Keeps API ownership ambiguous until usage is proven low enough for removal | No | `deprecate` in place, then `delete` after usage verification |
| `QUARANTINED` | `web/pages/api/v1/projections/goalies.ts` | `/api/v1/projections/goalies` | Deprecated reader duplicates `/api/v1/forge/goalies` | Same deprecation contract as the player route | Same as above | Same duplication and compatibility burden | No | `deprecate` in place, then `delete` after usage verification |
| `QUARANTINED` | `web/pages/api/v1/db/update-team-power-ratings-new.ts` | `/api/v1/db/update-team-power-ratings-new` | Alternate writer is intentionally disabled | Route returns `410 Gone`; `teamRatingsService` reads only `team_power_ratings_daily` | Canonical table choice is made, but cleanup is not fully finished | Remaining risk is hidden operator use of the disabled writer or stale `__new` table expectations | Yes | `delete` after hidden-caller verification |
| `QUARANTINED` | `web/pages/api/v1/db/update-rolling-games.ts` | `/api/v1/db/update-rolling-games` | Legacy rolling-games route is intentionally disabled | Route returns `410 Gone`; task audit still found cron or benchmark references in repo inventory | Route survived earlier rewrites as operational drift | Remaining risk is stale operational references, not silent runtime divergence | Yes | `delete` after scheduler verification |
| `QUARANTINED` | `web/pages/api/v1/db/update-power-rankings.ts` | `/api/v1/db/update-power-rankings` | Legacy power-rankings route is intentionally disabled | Route returns `410 Gone`; there is no supported canonical replacement inside the current rolling-to-FORGE operator story | Legacy maintenance path was never folded into the newer stage model | Remaining risk is hidden consumer or schedule expectations | Yes | `delete` after scheduler and consumer verification |

## Freshness and Dependency Review

### Canonical Dependency Chain

| Order | Stage | Canonical Surfaces | Primary Outputs | Main Risk if Stale |
| --- | --- | --- | --- | --- |
| 1 | Core entity freshness | `update-teams`, `update-games`, `update-players` | `teams`, `team_season`, `games`, `players`, `rosters` | Later stages can use incomplete teams, games, or rosters |
| 2 | Upstream skater sources | `update-nst-gamelog`, `update-wgo-skaters`, `update-wgo-totals`, `update-wgo-averages`, `update-wgo-ly` | NST and WGO source tables | Rolling rows become stale or falsely validated |
| 3 | Contextual builders | `update-line-combinations/[id]`, `update-line-combinations`, `update-power-play-combinations/[gameId]`, `update-power-play-combinations` | `lineCombinations`, `powerPlayCombinations` | PP share, PP unit, and line labels lose trust |
| 4 | Rolling recompute | `update-rolling-player-averages`, `fetchRollingPlayerAverages.ts` | `rolling_player_game_metrics` | Projection inputs and trends pages inherit stale metrics |
| 5 | Projection ingest | `ingest-projection-inputs` | `pbp_games`, `pbp_plays`, `shift_charts` | Derived tables miss current games |
| 6 | Derived build | `build-projection-derived-v2` | `forge_player_game_strength`, `forge_team_game_strength`, `forge_goalie_game` | Projection runner preflight fails or uses stale features |
| 7 | Projection execution | `update-goalie-projections-v2`, `run-projection-v2` | `goalie_start_projections`, `forge_runs`, `forge_*_projections` | FORGE readers and accuracy tables drift from reality |
| 8 | Downstream consumers and transitional materializers | `/api/v1/forge/*`, `/api/v1/start-chart`, dashboard pages, `update-start-chart-projections` | API payloads, product surfaces, and legacy materializations | Product pages can look healthy while serving fallback data or while transitional legacy materializations linger unnecessarily |

### Freshness Risks That Need Explicit Repair

- `update-games` is not truly standalone. It depends on fresh `teams` and `team_season`, which means the current stage naming underplays the ordering dependency.
- The builder repair story is now materially better, but operators still need to choose the correct repair scope. `update-line-combinations/index.ts` distinguishes `recent_gap` from `historical_backfill`, and `update-power-play-combinations/index.ts` supports bulk repair, but neither removes the need for intentional date or game selection.
- `update-rolling-player-averages` is still a flexible operator surface. It now reports `runSummary` and `freshnessGate`, and blocks on upstream freshness unless bypassed, but bypass flags can still be misused.
- `run-projection-v2` and `run-projection-accuracy` now enforce dependency-aware preflight behavior. The remaining weak point is downstream validation discipline when a reader endpoint is allowed to serve fallback data.
- `/api/v1/forge/players`, `/api/v1/forge/goalies`, and `/api/v1/start-chart` still allow fallback behavior for resilience, but they now expose `serving` metadata and scan summaries. The residual risk is operator misuse of those fallback-capable readers as strict same-day validation surfaces.
- `goalie_start_projections` remains a shared upstream dependency with legacy naming. The write path is singular now, but the table name still under-communicates that it is part of the canonical FORGE serving story.
- `update-start-chart-projections.ts` still materializes `player_projections`, which means the ecosystem still carries one bounded legacy skater-output side channel even though the start-chart read layer was corrected.

### Stale-Tail and False-Validation Risks

- Rolling validation can be falsely “green” when `rolling_player_game_metrics` is fresh relative to stale source tables.
- PP and line-context validation can fail for the wrong reason when builder freshness lags behind WGO/NST freshness.
- Projection execution can succeed while downstream readers legitimately serve fallback snapshots; the important distinction now is whether that fallback is explicit and accepted.
- Consumer fallback behavior can still mask missing same-day runs if callers ignore the exposed `serving` or `scanSummary` metadata.
- Compatibility helpers can let readers survive schema migration, but they also delay discovery of truly dead fields.

### Duplicated or Unnecessary Recompute Paths

- The old goalie-start writer route still exists, but it is gated behind `410 Gone` rather than acting as a second active writer.
- Two projection read namespaces still exist.
- Two team ratings tables still exist.
- The start-chart reader is now a downstream view over canonical FORGE skater outputs, but the legacy `player_projections` materializer still exists as transitional debt.
- Legacy JS loader routes for rolling games and power rankings still exist only as disabled `410 Gone` surfaces outside the current stage model.

### Freshness and Execution Safety Validation Standard

Pass 3 now codifies large parts of this standard directly in route contracts and response metadata. Before trusting a rolling or projection output, operators should still validate:

1. `games`, `teams`, `players`, and `rosters` are current for the target date range.
2. relevant NST and WGO sources are current through the target date range.
3. `lineCombinations` and `powerPlayCombinations` are current for the target game set.
4. `rolling_player_game_metrics` was recomputed after source freshness was achieved.
5. `forge_*` derived tables were rebuilt after PBP and shifts were ingested.
6. `goalie_start_projections` and `forge_runs` were produced after the latest derived build.
7. consumer endpoints clearly indicate whether they are serving same-date data or fallback data.

## Landing Dashboard Visual Audit

### Pass-3 Improvements Completed

- The homepage no longer opens as a dense utility stack. It now leads with a concise slate hero, summary rail, and direct action links to `start-chart`, `goalies`, and `trends`.
- `web/pages/index.tsx` is no longer carrying the full homepage orchestration alone. Slate fetching, game presentation, and standings or injuries rendering were split into focused homepage components and hooks.
- The hard `min-width: 1300px` desktop lock was removed from `web/styles/Home.module.scss`, and the homepage now uses more deliberate tablet and mobile layouts.
- Loading, empty, error, and stale states were standardized across homepage modules with shared freshness helpers and clearer module-level presentation.
- `TransactionTrends` now reads like a summary-first homepage insight card instead of an isolated table block.
- `TeamStandingsChart` now opens with a compact standings-signal summary rather than dropping users directly into the full control surface.
- The standings and injuries area now acts more like supporting context and less like the dominant visual payload.

### Residual UX Gaps

- Standings and injuries are still fundamentally table-based modules. The page is more coherent now, but a future card-first or progressively disclosed treatment could improve scanability further.
- The homepage refactor was typechecked and covered by targeted shared-helper tests, but it was not fully browser-verified in this pass.
- The product story is materially stronger than before, but there is still room for a more opinionated “today in fantasy” summary layer if the homepage needs another iteration later.

## Landing Dashboard Improvement Plan

### Implemented in Pass 3

| Priority | Change | Status | File-Level Targets |
| --- | --- | --- | --- |
| P1 | Add a concise top-level hero or intro strip that explains what the homepage helps the user do today and gives clear CTAs to `trends` and `FORGE` | `COMPLETED` | `web/pages/index.tsx`, `web/components/HomePage/HomepageGamesSection.tsx`, `web/styles/Home.module.scss` |
| P1 | Replace the current schedule header treatment with cleaner date controls, a simpler date chip, and clearer state labeling | `COMPLETED` | `web/components/HomePage/HomepageGamesSection.tsx`, `web/styles/Home.module.scss` |
| P1 | Standardize panel chrome, heading styles, spacing, and section intros across games, trends, chart, standings, and injuries | `PARTIALLY COMPLETED` | homepage component layer, `TransactionTrends.tsx`, `TeamStandingsChart.tsx`, `Home.module.scss` |
| P1 | Add consistent loading, empty, and error state treatments to all landing modules | `COMPLETED` | `web/lib/dashboard/freshness.ts`, homepage components, `TransactionTrends.tsx`, `TeamStandingsChart.tsx` |
| P1 | Remove the hard `min-width: 1300px` desktop assumption and rework section spacing for tablet/mobile | `COMPLETED` | `web/styles/Home.module.scss` |
| P1 | Break `index.tsx` into dedicated homepage sections so content, loading, and data concerns are no longer centralized in one file | `COMPLETED` | `web/pages/index.tsx`, homepage component files |
| P1 | Reframe the first viewport around one primary insight band: today’s slate, key schedule context, and top next-click actions | `COMPLETED` | `web/components/HomePage/HomepageGamesSection.tsx`, `web/styles/Home.module.scss` |
| P2 | Make `TransactionTrends` feel like a first-class homepage insight card instead of an isolated table block | `COMPLETED` | `web/components/TransactionTrends/TransactionTrends.tsx` |
| P2 | Reduce the visual weight of `TeamStandingsChart` on the homepage by adding summary framing, clearer default filters, or progressive disclosure | `COMPLETED` | `web/components/TeamStandingsChart/TeamStandingsChart.tsx` |

### Remaining Optional Follow-Up

| Priority | Change | Status | File-Level Targets |
| --- | --- | --- | --- |
| P2 | Convert standings and injuries from raw table-first presentation to card-first or summary-first presentation with expandable detail | `OPEN` | `web/components/HomePage/HomepageStandingsInjuriesSection.tsx`, `web/styles/Home.module.scss` |
| P3 | Introduce a two-column homepage architecture with a main insight rail and a secondary utility rail | `OPTIONAL` | `web/pages/index.tsx`, `web/styles/Home.module.scss` |
| P3 | Create a dedicated shared homepage section system for consistent wrappers, titles, status panels, and compact summaries | `OPTIONAL` | homepage component layer |
| P3 | Introduce a lightweight “today in fantasy” summary card that bridges homepage utilities with FORGE surfaces | `OPTIONAL` | homepage component layer |

## Deprecation / Merge / Delete Candidates

| Candidate | Why It Exists | Why It May No Longer Be Needed | Superseding Surface | Risk Before Removal | Validation Required |
| --- | --- | --- | --- | --- | --- |
| `web/pages/api/v1/db/update-goalie-projections.ts` | Older goalie-start projection writer | Route is now disabled and no longer functions as a live alternate writer | `web/pages/api/v1/db/update-goalie-projections-v2.ts` | Hidden schedulers or scripts may still call the disabled path | Audit cron inventory and Vercel schedules before deletion |
| `web/pages/api/v1/projections/players.ts` | Older projection reader namespace | `/api/v1/forge/players` is the canonical namespace and the old route now self-identifies as deprecated | `web/pages/api/v1/forge/players.ts` | External consumers may still rely on the old namespace | Search logs and internal references before deletion |
| `web/pages/api/v1/projections/goalies.ts` | Older projection reader namespace | `/api/v1/forge/goalies` is canonical and the old route now self-identifies as deprecated | `web/pages/api/v1/forge/goalies.ts` | Same external-consumer risk | Search logs and internal references before deletion |
| `web/lib/projections/runProjectionV2.ts` | Import shim during runner rename | Removed in pass 3 | `web/lib/projections/run-forge-projections.ts` | Residual docs can still teach the dead path | Clean active docs and task references |
| `web/pages/api/v1/db/update-team-power-ratings-new.ts` | Migration path for alternate ratings table | Canonical read path is now fixed on `team_power_ratings_daily`; alternate writer is disabled | `web/pages/api/v1/db/update-team-power-ratings.ts` | Hidden callers may still expect the alternate route | Audit logs and then delete |
| `web/pages/api/v1/db/update-rolling-games.ts` | Legacy rolling-games entrypoint | Disabled in pass 3 | `web/pages/api/v1/db/update-rolling-player-averages.ts` | Hidden automation could still call it | Audit cron inventory and logs before deletion |
| `web/pages/api/v1/db/update-power-rankings.ts` | Legacy power-rankings entrypoint | Disabled in pass 3 and still lacks a supported canonical successor | TBD; likely no direct replacement inside the current rolling-to-FORGE chain | Could still feed a niche consumer or stale automation | Audit references and consumer expectations before deletion |
| `web/pages/api/v1/db/update-start-chart-projections.ts` | Transitional legacy start-chart materializer | Start-chart reads were corrected, but this materializer still writes `player_projections` | Canonical FORGE readers plus curated `start-chart` read logic | Hidden consumers may still depend on the legacy table | Map remaining `player_projections` consumers before deletion or replacement |

## Remediation Plan

### Completed in Pass 3

1. Established the canonical downstream skater read model by moving `/api/v1/start-chart` onto `forge_player_projections` while preserving goalie context from `goalie_start_projections`.
2. Quarantined old goalie-start write entrypoints by forcing `update-goalie-projections.ts` to return `410 Gone` and point to `/api/v1/db/update-goalie-projections-v2`.
3. Aligned the pipeline spec with real storage and downstream meaning in `rollingForgePipeline.ts` and `run-rolling-forge-pipeline.ts`.
4. Marked `/api/v1/forge/players` and `/api/v1/forge/goalies` as canonical and converted `/api/v1/projections/*` into explicitly deprecated-readable compatibility routes.
5. Quarantined legacy JS loader routes outside the current rolling/FORGE model by forcing `update-rolling-games.ts` and `update-power-rankings.ts` to return `410 Gone`.
6. Converged the team power ratings story at the read layer by fixing `teamRatingsService` on `team_power_ratings_daily` and disabling `update-team-power-ratings-new.ts`.
7. Added a canonical batch PP repair route and explicit historical line-combination repair modes.
8. Tightened freshness signaling by exposing same-day versus fallback serving metadata in `/api/v1/forge/players`, `/api/v1/forge/goalies`, and `/api/v1/start-chart`.
9. Standardized the safe validation sequence by exposing a shared operator dependency contract and enforcing freshness-aware preflight behavior in rolling and accuracy surfaces.
10. Improved run-surface visibility with shared scan summaries, clearer operator response metadata, and explicit compatibility inventory surfacing.
11. Removed the `runProjectionV2.ts` shim from runtime and added regression coverage so it is not silently reintroduced.
12. Refactored the landing page into a more summary-first, responsive, and state-aware surface without a full redesign.

### Remaining Follow-Up After Pass 3

The follow-up implementation queue should stay in this PRD and the companion task file. Do not split these residual items into another pass-3 planning markdown.

13. Verify that no hidden schedulers, cron jobs, benchmarks, or external callers still rely on the disabled `410 Gone` routes before deleting them.
14. Clean any remaining active docs or task references that still teach the retired start-chart materializer as a live route.
15. Clean active docs and task references that still teach `runProjectionV2.ts` as a live runner path.
16. Decide whether `goalie_start_projections` remains an intentionally shared table name or should be renamed or wrapped under clearer FORGE ownership in a later pass.
17. Revisit whether support-only WGO writers such as `update-wgo-ly.ts` and adjacent helper tables still deserve active write paths or should be folded into a narrower historical contract.
18. If homepage iteration continues, evaluate a card-first standings or injuries treatment and optional “today in fantasy” summary layer after browser verification.

## Open Questions

- Is `goalie_start_projections` intended to remain a permanent shared table, or should it be renamed and absorbed into a more obviously FORGE-owned surface in a later pass?
- Are there any production schedulers, Vercel cron jobs, or external consumers still hitting the quarantined legacy routes that are not visible from repo references alone?
- Which of the support WGO writers are still required for active product surfaces versus historical analysis only?
- These questions should be resolved during implementation sequencing, but they do not justify another pass-3 planning document. This PRD remains the single pass-3 source of truth for task generation, endpoint quarantine, stabilization work, and landing dashboard polish.
