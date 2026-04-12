# PRD: Rolling Player Metrics Remediation Blueprint

## Document Status

- Status: Drafted for remediation planning only
- Scope mode: PRD only
- Explicitly out of scope for this document: task generation, task processing, code changes, runtime execution
- Authoritative remediation contract: [rolling-player-metrics-audit-notes.md](/Users/tim/Code/fhfhockey.com/tasks/rolling-player-metrics-audit-notes.md)
- Primary future implementation targets:
  - [update-rolling-player-averages.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-player-averages.ts)
  - [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)

## 1. Introduction / Overview

### 1.1 Purpose

This PRD defines the full remediation scope for the rolling player metrics pipeline and the `rolling_player_game_metrics` contract. It converts the audit notes into an implementation-ready blueprint that future task generation can use with minimal interpretation drift.

### 1.2 Problem Statement

The current pipeline is partially healthy but semantically inconsistent. The audit proved that:

- additive counts and most weighted `/60` arithmetic are materially healthy after recent fixes
- several ratio-family `lastN` fields still use the wrong window contract
- `gp_pct_avg_season` is proven wrong for traded players
- GP% as a family mixes incompatible concepts
- ratio and `/60` suffix naming no longer matches stored behavior in many places
- PP share semantics improved but still need a final denominator contract
- observability and freshness handling are not strong enough to make future validation cheap and repeatable

### 1.3 Primary Goals

The remediation must:

- make every stored metric mathematically correct under a documented contract
- align each rolling window family with a canonical window definition
- redesign GP% and participation semantics so traded players, missed games, and split-strength participation are represented correctly
- clean up schema and naming where current fields encode misleading or redundant meanings
- improve diagnostics, freshness handling, and validation repeatability
- re-verify every metric family against live upstream data after implementation

### 1.4 Primary Implementation Targets

Primary ownership remains in:

- [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)
  - orchestration
  - source merge logic
  - metric definitions
  - rolling windows
  - GP% all-row assembly
  - final output derivation
- [update-rolling-player-averages.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-player-averages.ts)
  - request parsing
  - operational refresh controls
  - endpoint-level observability and refresh ergonomics

### 1.5 Directly Relevant Helper and Dependency Surfaces

The implementation scope must explicitly include the helper surfaces the audit identified as semantic owners:

- [rollingHistoricalAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingHistoricalAverages.ts)
- [rollingMetricAggregation.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricAggregation.ts)
- [rollingPlayerMetricMath.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerMetricMath.ts)
- [rollingPlayerPipelineDiagnostics.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts)
- [powerPlayCombinationMetrics.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts)
- [update-power-play-combinations/[gameId].ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-power-play-combinations/[gameId].ts)
- [update-line-combinations/[id].ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-line-combinations/[id].ts)
- [update-line-combinations/index.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-line-combinations/index.ts)

### 1.6 Source-of-Truth and Interpretation Rules

This PRD adopts the following rules:

- the audit notes override current implementation behavior where the audit proved current behavior wrong
- proven stale-row artifacts do not count as current-code truth
- preserved behavior is acceptable only where the audit found that behavior healthy or directionally acceptable
- schema cleanup is required where field names or suffixes materially misrepresent stored meaning
- freshness issues are part of the remediation workflow and verification workflow, not a reason to skip validation
- because the user designated the audit notes as authoritative and exhaustive, this PRD treats the prompt plus audit as the clarified product input

## 2. Goals

### 2.1 Correctness Goals

- Keep additive count families and weighted `/60` families correct while refactoring surrounding semantics.
- Correct all proven GP% bugs.
- Align ratio-family rolling windows to one documented contract.
- Establish one authoritative denominator contract for `pp_share_pct`.
- Reduce fallback fragility for `ixg_per_60` and TOI-backed calculations.

### 2.2 Semantic Contract Goals

- Define canonical meanings for `lastN` by metric family.
- Separate availability semantics from participation semantics.
- Eliminate misleading `total_*` vs `avg_*` duplication where values are aliases.
- Make team-stint scope explicit for season, rolling, and historical availability.

### 2.3 Schema and Storage Goals

- Evolve `rolling_player_game_metrics` so stored field names match stored behavior.
- Add raw numerator and denominator support where ratios are otherwise opaque.
- Add or rename fields where the current schema cannot cleanly encode intended GP% semantics.
- Preserve backward compatibility only where justified and time-bounded.

### 2.4 Observability and Run-Quality Goals

- Make coverage gaps, fallback usage, stale source tails, and suspicious outputs visible in structured form.
- Make long refresh runs auditable and diagnosable without manual log spelunking.
- Make recompute freshness and validation readiness easy to determine per player and per metric family.

### 2.5 Validation Goals

- Re-verify every metric family and every disputed metric against live upstream data one by one after implementation.
- Require explicit freshness refresh steps when upstream or stored data is stale or incomplete.
- End the remediation only after re-reading the audit notes and confirming every actionable item is addressed.

## 3. User Stories

- As a developer, I need every rolling field to have a documented semantic contract so implementation and validation do not diverge.
- As a developer, I need GP% and participation fields to behave correctly for trades, injuries, missed games, and split-strength usage.
- As a developer, I need ratio and `/60` windows to be legible and reproducible from upstream data.
- As a reviewer, I need schema names to reflect actual stored meaning so API/UI consumers are not misled.
- As an operator, I need recompute runs to expose source freshness, gaps, and suspicious outputs in durable summaries.
- As a validator, I need to reconstruct each metric from live upstream data and compare it against refreshed stored rows without relying on stale artifacts.

## 4. Non-Goals

- This PRD does not generate implementation tasks.
- This PRD does not prescribe exact migration SQL or endpoint payload formats.
- This PRD does not require new external data providers beyond the upstream sources already identified in the audit.
- This PRD does not redesign downstream UI presentation beyond naming and contract requirements that affect schema/API meaning.
- This PRD does not treat context-label fields as arithmetic metrics; those fields require separate semantic validation.

## 5. Current System Scope and Dependency Map

### 5.1 Recompute Flow Map

The audit established the current flow:

1. [update-rolling-player-averages.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-player-averages.ts) parses request controls and delegates.
2. [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts) performs preflight, fetches upstream tables, builds the team ledger, selects player scope, and resolves refresh/resume behavior.
3. `processPlayer(...)` fetches WGO, PP combination, line combination, and split-strength NST sources.
4. `buildGameRecords(...)` merges WGO, NST counts, NST rates, NST on-ice counts, PP rows, and line-combo context into a per-date player record.
5. `METRICS`, `getToiSeconds(...)`, ratio helpers, and historical helpers drive accumulation.
6. `deriveOutputs(...)` materializes row outputs.
7. diagnostics run, rows are upserted, and run summaries are emitted.

Implementation implication:

- endpoint-level code is operational, not metric-semantic
- most remediation belongs in orchestration, helper contracts, merge semantics, output derivation, and schema

### 5.2 Helper Responsibilities

The PRD preserves the helper ownership split from the audit:

- [rollingHistoricalAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingHistoricalAverages.ts)
  - simple historical averages
  - historical GP% accumulation
- [rollingMetricAggregation.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricAggregation.ts)
  - rolling and historical ratio accumulation
  - denominator qualification
  - rolling ratio window mode
- [rollingPlayerMetricMath.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerMetricMath.ts)
  - `/60` component resolution
  - share reconstruction
  - ixG fallback math
- [rollingPlayerPipelineDiagnostics.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts)
  - coverage summaries
  - suspicious output reporting
- [powerPlayCombinationMetrics.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts)
  - PP unit-relative and team-share derived math

Implementation implication:

- fixes must land in the actual semantic owner instead of being papered over at call sites
- GP% fixes are split between rolling row assembly and historical GP% helpers

### 5.3 Upstream Table Inventory and Classification

The audit-defined source classification remains in force:

- `games`
  - authoritative schedule ledger and known game ID source
- `players`
  - authoritative player scope source
- `wgo_skater_stats`
  - authoritative appearance spine and fallback surface-stat source
- `nst_gamelog_*_counts`
  - authoritative player counts
- `nst_gamelog_*_counts_oi`
  - authoritative on-ice and territorial source
- `nst_gamelog_*_rates`
  - fallback and supplementary source
- `powerPlayCombinations`
  - derived PP context source
- `lineCombinations`
  - derived role-context source
- `rolling_player_game_metrics`
  - target table and operational resume artifact, not metric truth

Implementation implication:

- remediation must preserve authoritative-source precedence
- fallback paths must be explicit, diagnosable, and bounded

### 5.4 Upstream Builders That Affect Rolling Semantics

The rolling pipeline depends on upstream builders with real semantic impact:

- [update-power-play-combinations/[gameId].ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-power-play-combinations/[gameId].ts)
  - controls `pp_unit` and upstream PP role semantics
- [powerPlayCombinationMetrics.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts)
  - defines `percentageOfPP`, `pp_unit_usage_index`, `pp_unit_relative_toi`, `pp_vs_unit_avg`, `pp_share_of_team`
- [update-line-combinations/[id].ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-line-combinations/[id].ts)
  - controls `line_combo_slot` and `line_combo_group`
- [update-line-combinations/index.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-line-combinations/index.ts)
  - controls freshness of contextual rows

Implementation implication:

- PP share and PP unit must stay separate concepts
- context-label validation is a builder-semantics problem, not a ratio-math problem

### 5.5 Operational Control Path and Refresh Behavior

The audit identified operational behaviors that affect trust:

- full refresh may use truncate, overwrite-only, or delete mode
- auto-resume is conditional
- stale target rows can hide or mimic metric bugs
- targeted recomputes are necessary to separate stale-state artifacts from current-code behavior

Implementation implication:

- remediation must include a disciplined refresh and backfill strategy after schema/logic changes
- validation may not use stale target rows as correctness evidence

## 6. Metric Family Inventory and Current Contract Problems

### 6.1 Row Identity and Context Fields

The row inventory includes:

- `player_id`
- `game_date`
- `game_id`
- `season`
- `team_id`
- `strength_state`
- `line_combo_slot`
- `line_combo_group`
- `pp_unit`
- `updated_at`

These fields are not status-graded like metrics, but their meaning and freshness still matter. The remediation must preserve row identity integrity while clarifying which fields are metric outputs and which are contextual labels.

### 6.2 Availability / Participation Family

Current fields:

- `games_played`
- `team_games_played`
- `gp_pct_*`

Audit-defined problem set:

- current GP% model mixes row-scope running ratios, appearance-anchored rolling spans, and team-bucketed season snapshots
- `gp_pct_avg_season` is proven wrong for traded players
- split strengths currently mean positive-TOI participation, not ordinary games played
- `avg` aliases are semantically fake

### 6.3 TOI Family

Current field family:

- `toi_seconds_*`

Audit-defined problem set:

- arithmetic is healthy
- correctness still depends on TOI source precedence and WGO normalization heuristics
- TOI also acts as the denominator trust anchor for all `/60` families

### 6.4 Additive Surface and Opportunity Count Families

Current families:

- `goals`, `assists`, `shots`, `hits`, `blocks`, `pp_points`, `points`
- `ixg`, `iscf`, `ihdcf`
- `cf`, `ca`, `ff`, `fa`

Audit-defined problem set:

- additive arithmetic is healthy
- source precedence and qualifying-row window membership still need to align with the canonical last-N contract

### 6.5 Weighted `/60` Families

Current families:

- `sog_per_60`
- `ixg_per_60`
- `hits_per_60`
- `blocks_per_60`

Audit-defined problem set:

- weighted-rate arithmetic is healthy
- `ixg_per_60` has extra fallback fragility
- `total_*` naming is misleading because stored values are weighted-rate snapshots, not additive totals
- current windows depend on valid TOI-backed rows unless redesigned

### 6.6 Finishing and Ratio Families

Current families:

- `shooting_pct`
- `primary_points_pct`
- `expected_sh_pct`
- `ipp`
- `on_ice_sh_pct`
- `pdo`
- `cf_pct`
- `ff_pct`

Audit-defined problem set:

- arithmetic is mostly healthy after prior fixes
- current last-N behavior is still family-inconsistent
- `pct` naming mixes `0-100` and `0-1` scales
- null-vs-zero denominator behavior differs by family
- `total_*` and `avg_*` often store identical values

### 6.7 On-Ice Context Families

Current families:

- `ipp`
- `on_ice_sh_pct`
- `pdo`

Audit-defined problem set:

- formulas are healthier than before
- ratio-family window redesign still applies
- lack of raw support fields makes validation and explainability too expensive

### 6.8 Zone / Usage Context Families

Current families:

- `oz_start_pct`
- `pp_share_pct`

Audit-defined problem set:

- `oz_start_pct` is healthy only if NST semantics are the intended product semantics
- `pp_share_pct` is much improved but still needs a final denominator authority decision
- both inherit last-N redesign and raw-support requirements

### 6.9 Territorial Families

Current families:

- counts: `cf`, `ca`, `ff`, `fa`
- ratios: `cf_pct`, `ff_pct`

Audit-defined problem set:

- count arithmetic is healthy
- ratio arithmetic is healthy
- rolling semantics and naming cleanup still apply to ratios

### 6.10 Historical Baseline Layer

Current suffix layer:

- `avg_season`
- `avg_3ya`
- `avg_career`

Audit-defined problem set:

- simple and weighted historical baselines are mostly healthy
- ratio-family historical snapshots are healthy mathematically but naming is misleading
- GP% historical semantics require redesign, especially season scope

### 6.11 Rolling Window Layer

Current suffix layer:

- `total_last3/5/10/20`
- `avg_last3/5/10/20`

Audit-defined problem set:

- the same suffix family means different things across additive, ratio, `/60`, and GP%
- simple families currently mean last N qualifying appearances
- ratio and `/60` families currently mean last N valid observations in many cases
- GP% currently means appearance-anchored team-game span ratios

### 6.12 Career-to-Date Layer

Current suffix layer:

- `total_all`
- `avg_all`

Audit-defined problem set:

- additive families use these coherently
- ratio and `/60` families use them as snapshots, not totals or means
- GP% aliases do not describe distinct concepts

### 6.13 Column Inventory Implications

The remediation must treat the column surface as semantically overloaded. The PRD therefore separates:

- correctness fixes
- semantic-contract fixes
- schema and naming work
- helper refactors
- observability work
- optional metric additions

## 7. Required Remediation Workstreams

### 7.1 Endpoint and Orchestration Boundary

Required work:

- keep [update-rolling-player-averages.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-player-averages.ts) thin and operational
- ensure endpoint controls continue to support targeted recomputes needed for validation
- improve endpoint-level reporting of refresh mode, filters, resume behavior, and completion summary

Explicitly not required:

- moving metric logic into the endpoint wrapper

### 7.2 Source Merge and Row-Building Semantics

Required work:

- preserve WGO as the appearance/date spine
- document and implement authoritative precedence among WGO, NST counts, NST rates, and NST on-ice tables
- ensure `buildGameRecords(...)` makes missing source components explicit rather than silently changing row meaning
- surface when WGO fallbacks are used for additive stats
- surface when rate-based reconstruction is used for raw numerators or denominators
- ensure unknown `game_id` handling remains visible in diagnostics

Acceptance outcome:

- per-game row assembly is reproducible and every fallback path is diagnosable

### 7.3 TOI Normalization and Denominator Trust

Required work:

- preserve current TOI fallback ordering unless validation proves a change is needed
- explicitly validate and document unit normalization for WGO `toi_per_game`
- log or count each fallback tier used by `getToiSeconds(...)`
- add diagnostics for suspicious TOI values and excessive fallback reliance
- ensure split-strength TOI semantics are consistent with participation modeling

Acceptance outcome:

- TOI-backed metrics can be trusted or explicitly flagged when fallback-heavy

### 7.4 Additive Metric Preservation and Coverage Guarantees

Required work:

- preserve healthy additive arithmetic during refactors
- ensure appearance-window behavior for additive families follows the canonical rule selected in section 7.6
- validate that count totals and means remain unchanged where the audit marked them healthy
- keep simple historical baselines mathematically intact

Acceptance outcome:

- healthy additive families do not regress while the rest of the pipeline changes

### 7.5 Ratio Aggregation Contract Cleanup

Required work:

- retain ratio-of-aggregates arithmetic from the corrected ratio engine
- define explicit family-by-family null/zero behavior for zero denominators
- define explicit scale documentation for each `pct` family
- stop treating ratio-family `total_*` and `avg_*` as if they encode different mathematics when they do not
- ensure composite metrics such as PDO remain bounded and diagnosable

Acceptance outcome:

- ratio families are mathematically correct and semantically documented

### 7.6 Canonical `lastN` Redesign by Metric Family

The audit’s canonical direction is required unless later implementation discovery proves a blocking constraint.

Required window contracts:

- availability families:
  - `lastN` must mean last N chronological team games for the current team context of the row
- additive performance families:
  - `lastN` must mean last N chronological appearances in the relevant strength state
- ratio and `/60` performance families:
  - `lastN` must mean last N chronological appearances in the relevant strength state, then aggregate numerators and denominators inside that fixed appearance window

Required work:

- update rolling accumulators to support appearance-window membership independent of denominator qualification
- remove or replace valid-observation-only window membership where it conflicts with the intended contract
- define missing-component behavior inside a fixed appearance window per family
- document whether rows with missing numerator/denominator contribute zero, null, or no metric output after the window is selected

Acceptance outcome:

- every `lastN` field has one canonical rule and matches live source reconstruction under that rule

### 7.7 GP% and Availability Redesign

This is the highest-priority workstream.

Required contract:

- all-strength `games_played`
  - count of team games in which the player appeared
- all-strength `team_games_played`
  - team games available in scope from the schedule ledger
- all-strength season availability
  - aggregate across all player-season stints in scope
- rolling availability
  - current-team last N chronological team games only
- 3YA and career availability
  - aggregate across all included stints
- split strengths
  - treated as state participation, not ordinary GP%

Required work:

- redesign `gp_pct_avg_season` and related season availability outputs so trades do not collapse season meaning
- redefine rolling GP% windows to exact team-game windows
- decide whether legacy `gp_pct_total_*`/`gp_pct_avg_*` fields are replaced, aliased, or deprecated
- separate all-strength availability naming from EV/PP/PK participation naming
- store or expose raw numerator and denominator counts for season, rolling, 3YA, and career availability windows
- make team-stint scope explicit in schema or field naming

Acceptance outcome:

- Corey Perry-style post-trade rows produce sane season and rolling availability values

### 7.8 PP Share and PP Role Semantics

Required work:

- preserve separation between:
  - team PP share
  - unit-relative PP role
  - PP unit identity
- compare the current WGO-inferred `pp_share_pct` denominator path to upstream `pp_share_of_team`
- decide whether rolling `pp_share_pct` continues to be WGO-derived, becomes builder-derived, or stores both with clear naming
- ensure `pp_unit` remains a contextual label, not a rolling ratio
- add validation for upstream PP builder freshness and semantics

Acceptance outcome:

- `pp_share_pct` has one authoritative denominator contract and is clearly distinct from PP unit-relative fields

### 7.9 Historical Baseline Contract Cleanup

Required work:

- preserve healthy simple historical averages
- preserve healthy weighted `/60` historical snapshots
- preserve healthy ratio historical snapshots while renaming or deprecating misleading `avg_*` semantics where needed
- redesign GP% historical season scope
- confirm 3YA and career availability semantics across stints

Acceptance outcome:

- historical fields remain mathematically sound and semantically legible

### 7.10 Schema / Naming / Migration Work

Required work:

- identify every field family where `total_*` and `avg_*` are aliases
- identify every field family where stored names misrepresent scale, scope, or calculation type
- define migration/backfill strategy for:
  - GP% redesign
  - alias deprecation
  - new numerator/denominator support fields
  - new participation naming where applicable
- define backward compatibility strategy for downstream consumers

Acceptance outcome:

- field names and stored meaning are no longer materially divergent

### 7.11 Diagnostics, Observability, and Run Summaries

Required work:

- preserve existing coverage and suspicious-output diagnostics
- add per-family diagnostics for:
  - GP% window membership and denominator counts
  - ratio-family fixed-window membership vs component presence
  - TOI fallback tier usage
  - rate reconstruction usage
  - stale or partial source tails
- persist or export structured run summaries
- make phase-level progress visible during full refreshes

Acceptance outcome:

- a run can be judged for correctness risk and freshness without manually reconstructing what happened

### 7.12 Validation and Verification Framework

Required work:

- maintain a fixed validation player set, with authority to replace the incomplete proxy if a better traded-player example is discovered
- require targeted recomputes before stored-vs-source comparisons
- require one-by-one metric verification against live upstream data after implementation
- block signoff if freshness is stale and refresh instructions were not executed
- conclude with an audit re-read that checks every actionable item

Acceptance outcome:

- remediation closes only when evidence, not assumption, says the audit contract is satisfied

## 8. Detailed Requirements by Audit Section

### 8.1 Requirements from Audit Section 1.x

From sections `1.1` through `1.5`, implementation must:

- leave the endpoint wrapper operationally focused
- treat `fetchRollingPlayerAverages.ts` as the main semantic owner
- apply fixes in helper owners, not ad hoc in call sites
- preserve source classification between authoritative, fallback, and contextual sources
- treat upstream builders as first-class semantic dependencies
- never use stale `rolling_player_game_metrics` rows as proof of current-code truth during validation

### 8.2 Requirements from Audit Section 2.x

From sections `2.1` through `2.10`, implementation must:

- preserve healthy additive arithmetic and healthy weighted `/60` arithmetic
- redesign `lastN` behavior per family rather than forcing one universal rule
- remove ratio-family dependence on valid-observation semantics where that conflicts with canonical appearance windows
- retain ratio-of-aggregates math for bounded ratios
- define explicit scale and denominator behavior for each ratio family
- preserve `oz_start_pct` only if NST semantics remain the chosen contract
- finalize `pp_share_pct` denominator authority
- redesign GP% as a distinct availability model, not a generic ratio family
- treat suffix naming as a schema/API contract problem, not only a code problem

### 8.3 Requirements from Audit Section 3.x

From sections `3.1` through `3.6`, implementation and validation must:

- keep Brent Burns, Corey Perry, Jesper Bratt, and Seth Jones as baseline validation cases unless a better traded-player example replaces Seth Jones
- preserve the audit’s distinction between stale-row artifacts and current-code semantics
- prove healthy families remain healthy on refreshed rows
- prove ratio-family `last20` mismatches are eliminated after contract changes
- prove post-trade GP% season behavior is fixed on fresh rows
- treat missing or stale source tails as validation blockers that require refresh actions

### 8.4 Requirements from Audit Section 4.x

From sections `4.1` through `4.5`, implementation must:

- replace the mixed GP% model with a coherent availability/participation model
- stop treating GP% `avg_*` aliases as real averages
- aggregate season availability across stints
- use current-team chronological windows for rolling availability
- support career and 3YA across stints
- distinguish split-strength participation from all-strength availability
- determine and implement the necessary schema changes rather than trying to solve GP% with documentation only

### 8.5 Requirements from Audit Section 5.x

From sections `5.1` through `5.10`, implementation planning and signoff must:

- preserve the audit’s status distinctions between `WORKING`, `BROKEN`, `ALMOST`, and `NEEDS REVIEW`
- prioritize proven blockers first
- keep optional additions separate from correctness work
- keep rationale separate from the final implementation tasks that will later be generated
- perform a final completeness cross-check against the column inventory
- explicitly handle inventory-only fields and row-context labels in signoff documentation

## 9. Functional Requirements

1. The system must preserve current endpoint filtering and targeted recompute capabilities.
2. The system must continue to use `games` as the authoritative team-ledger source.
3. The system must continue to use WGO as the appearance/date spine unless a future audit supersedes that decision.
4. The system must expose or log which source and fallback path produced each sensitive denominator family at least in aggregate diagnostic form.
5. The system must preserve additive count correctness for all currently healthy additive families.
6. The system must preserve weighted `/60` correctness for all currently healthy weighted `/60` families.
7. The system must redesign ratio-family rolling windows to fixed appearance windows where the audit requires that contract.
8. The system must redesign GP% rolling windows to exact current-team chronological team-game windows.
9. The system must redesign GP% season semantics to aggregate across player-season stints.
10. The system must redesign split-strength GP% naming and behavior as participation-in-state, not ordinary GP%.
11. The system must retain or introduce raw numerator and denominator support for GP% windows.
12. The system must define explicit null/zero behavior for each ratio family when denominators are absent.
13. The system must define and document scale conventions for all `pct` families.
14. The system must either deprecate or rename misleading ratio and `/60` `total_*` fields.
15. The system must either deprecate or rename misleading GP% `avg_*` alias fields.
16. The system must make team-stint scope explicit where season and rolling scopes differ.
17. The system must validate `pp_share_pct` against one authoritative denominator contract.
18. The system must keep PP unit-relative usage semantics distinct from team-share semantics.
19. The system must validate contextual fields `pp_unit`, `line_combo_slot`, and `line_combo_group` against upstream builder freshness and semantics.
20. The system must emit structured diagnostics for coverage gaps, suspicious outputs, and unknown game IDs.
21. The system must add structured diagnostics for GP% windows, rate reconstruction, TOI fallback use, and stale source tails.
22. The system must support persisted or exportable run summaries.
23. The system must support full recompute and targeted recompute validation flows after schema or logic changes.
24. The system must not treat stale target rows as signoff evidence.
25. The system must be re-verified metric by metric against live upstream data before remediation is considered complete.

## 10. Technical Considerations

- The main semantic change surface is concentrated in [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts), [rollingMetricAggregation.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricAggregation.ts), and [rollingHistoricalAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingHistoricalAverages.ts).
- `rollingMetricAggregation.ts` already exposes a window-mode concept; remediation may expand that rather than invent a second ratio engine.
- GP% may require a distinct accumulator model rather than forcing it through the generic metric template.
- Schema changes and backfills will require careful sequencing with refresh controls so resume logic does not mix old and new semantics in the same target table.
- Builder freshness for `powerPlayCombinations` and `lineCombinations` must be considered part of semantic correctness.
- Validation must operate on refreshed rows that postdate the logic change being validated.

## 11. Data, Schema, and Migration Requirements

### 11.1 Required Schema Review Areas

- GP% and participation field family
- ratio-family naming duplication
- `/60` naming duplication
- raw ratio support fields
- PP role and PP team-share support fields

### 11.2 Required Migration Decisions

The implementation phase must decide, explicitly and early:

- which legacy fields remain temporarily for backward compatibility
- which fields are renamed in place versus replaced with new columns
- whether legacy aliases are backfilled, derived, or frozen
- how downstream consumers will discover the new canonical fields

### 11.3 Required New or Replacement Concepts

The audit implies likely schema additions or replacements for:

- season availability numerator and denominator fields across stints
- rolling availability numerator and denominator fields per team-game window
- career and 3YA availability numerator and denominator fields
- participation-in-state fields for EV/PP/PK
- raw ratio support fields for shooting, expected shooting, IPP, on-ice conversion, PDO components, zone-start counts, and PP share

### 11.4 Backfill and Refresh Requirements

- Any schema change that alters meaning requires a full backfill or explicit field-level backfill plan.
- Targeted recomputes are required for validation during development.
- Final signoff requires a refresh strategy that avoids mixed old/new semantics across rows.

## 12. Real-Data Validation Plan

### 12.1 Validation Principles

- Every metric must be re-verified against live upstream data one by one after implementation.
- Freshness problems are part of the workflow. If source or target data is stale, the validator must first refresh that data and then resume verification.
- Verification may not skip a metric family because source coverage is incomplete; instead, the workflow must include explicit refresh and retry instructions.
- Validation must compare source-derived intended values to fresh stored rows produced by current code.

### 12.2 Required Validation Player Set

Initial required player set from the audit:

- Brent Burns (`8470613`) as the healthy-control skater
- Corey Perry (`8470621`) as the missed-games and traded-player GP% case
- Jesper Bratt (`8479407`) as the heavy PP-role case
- Seth Jones (`8477495`) as the partial / incomplete-source-tail proxy

Rule:

- If a cleaner traded-player example is discovered during implementation validation, Seth Jones may be replaced, but the replacement and reason must be documented.

### 12.3 Metric-Family-by-Metric-Family Verification

The following families require direct post-implementation live-data reconstruction:

- Availability / participation:
  - `games_played`
  - `team_games_played`
  - all GP% or renamed availability fields
- TOI:
  - `toi_seconds_*`
- Additive counts:
  - `goals`, `assists`, `shots`, `hits`, `blocks`, `pp_points`, `points`
- Opportunity counts:
  - `ixg`, `iscf`, `ihdcf`
- Weighted `/60`:
  - `sog_per_60`, `ixg_per_60`, `hits_per_60`, `blocks_per_60`
- Finishing ratios:
  - `shooting_pct`, `primary_points_pct`, `expected_sh_pct`
- On-ice context:
  - `ipp`, `on_ice_sh_pct`, `pdo`
- Zone / usage:
  - `oz_start_pct`, `pp_share_pct`
- Territorial:
  - `cf`, `ca`, `ff`, `fa`, `cf_pct`, `ff_pct`
- Historical baselines:
  - every retained `avg_season`, `avg_3ya`, `avg_career` family
- Context labels:
  - `pp_unit`, `line_combo_slot`, `line_combo_group`

### 12.4 Disputed Metric Verification

The audit identified the following families as requiring especially explicit re-verification:

- `gp_pct_avg_season` replacement field(s)
- `gp_pct_total_all`
- rolling GP% replacement field(s)
- `gp_pct_avg_3ya`
- `gp_pct_avg_career`
- `shooting_pct_total_lastN`
- `primary_points_pct_total_lastN`
- `expected_sh_pct_total_lastN`
- `ipp_total_lastN`
- `pp_share_pct_total_lastN`
- `ixg_per_60`
- any renamed ratio-family or `/60` aliases
- any newly introduced numerator/denominator support fields

### 12.5 Freshness-Gated Verification Workflow

Required validation workflow:

1. Check upstream freshness for the selected player and date range.
2. If source tails are stale or incomplete, run the explicit refresh action for the stale layer before continuing.
   Required stale-layer actions:
   - stale `rolling_player_game_metrics` rows:
     - run the targeted rolling recompute endpoint for the affected `playerId` and `season`
   - stale `powerPlayCombinations` rows:
     - rerun [update-power-play-combinations/[gameId].ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-power-play-combinations/[gameId].ts) for each affected game in the validation window before retrying PP validation
   - stale `lineCombinations` rows:
     - rerun [update-line-combinations/[id].ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-line-combinations/[id].ts) or the batch wrapper [update-line-combinations/index.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-line-combinations/index.ts) for the affected validation games before retrying context-label validation
   - stale WGO or NST source tails:
     - execute the upstream refresh/import path that populates the affected source tables, confirm the latest game dates advanced, and only then resume rolling validation
   - ambiguous freshness state:
     - stop the verification step, record the blocking table(s), and add the missing refresh action to the validation runbook before proceeding
3. Re-check source freshness before continuing.
4. Run targeted recomputes for the player and season using the rolling endpoint.
5. Confirm that the stored row dates advanced to the expected current range.
6. Reconstruct the intended metric from live upstream data.
7. Compare the reconstructed value to the fresh stored value.
8. Record whether any mismatch is:
   - a source freshness issue
   - a target freshness issue
   - a logic issue
   - a schema-contract issue
9. Do not mark a metric verified until freshness blockers have been resolved or explicitly documented as external blockers.

### 12.6 Final Audit Re-Read Completeness Check

The final verification phase must:

- re-read [rolling-player-metrics-audit-notes.md](/Users/tim/Code/fhfhockey.com/tasks/rolling-player-metrics-audit-notes.md)
- walk every actionable remediation item again
- confirm whether that item is:
  - implemented
  - intentionally deferred as optional
  - intentionally deferred as follow-up
  - still unresolved
- reject completion if any required actionable audit item is unaddressed

## 13. Optional Enhancements

These items are part of the audit scope but must remain in an explicit optional phase after required correctness work:

- `on_ice_sv_pct`
- raw zone-start counts
- raw on-ice goal and shot counts
- `goals_per_60`
- `assists_per_60`
- `primary_assists_per_60`
- `secondary_assists_per_60`
- `pp_unit_usage_index`
- `pp_unit_relative_toi`
- `pp_vs_unit_avg`
- `pp_share_of_team` on rolling rows if not adopted as the core PP-share contract

Optional-phase rule:

- these additions may not displace required correctness, schema, or verification work

## 14. Follow-Up Improvements

These items may follow after the required remediation and optional additions:

- richer downstream API alias strategy for deprecated columns
- UI-facing contract cleanup once canonical field names are stabilized
- expanded historical auditability surfaces beyond the core support fields
- additional monitoring or dashboards over persisted run summaries

## 15. Success Metrics

- Corey Perry post-trade season availability verifies correctly on fresh rows.
- Rolling availability windows verify as literal team-game windows.
- Ratio-family `lastN` fields verify against fixed appearance-window reconstructions.
- Weighted `/60` families remain matched to source reconstruction after refactor.
- `pp_share_pct` validates against its final denominator contract in both heavy-PP and low-PP cases.
- Every metric family and every disputed metric has a signed-off live-data verification result.
- Structured run summaries expose coverage warnings, suspicious outputs, unknown game IDs, fallback usage, and freshness blockers.
- Final audit re-read shows every required actionable item addressed.

## 16. Open Questions and Assumptions

### 16.1 Assumptions Adopted in This PRD

- The audit’s recommended canonical `lastN` rules are the intended product direction.
- NST-style OZS semantics remain acceptable for `oz_start_pct` unless downstream product owners later reject that definition.
- The current upstream source footprint is sufficient for required remediation and optional additions.
- A migration path for legacy consumers is needed, but preserving misleading names indefinitely is not a goal.

### 16.2 Questions for Implementation Discovery

- Whether `pp_share_pct` should be fully re-based to upstream `pp_share_of_team` or whether both contracts should be stored separately.
- Whether ratio and `/60` alias columns should be deprecated immediately or carried temporarily for backward compatibility.
- Whether split-strength participation fields should reuse GP% storage slots with renamed semantics or move to explicit new fields.
- Whether any current consumers depend on the misleading `avg_*`/`total_*` duplication in ways that require a compatibility layer.

## 17. Traceability Matrix

| Audit Section | Audit Theme | PRD Section(s) |
| --- | --- | --- |
| `1.1` | recompute flow map | `5.1`, `7.1`, `7.2` |
| `1.2` | direct helper responsibilities | `1.5`, `5.2`, `7.5`, `7.7`, `7.9`, `7.11` |
| `1.3` | upstream table inventory | `5.3`, `7.2`, `10`, `12.5` |
| `1.4` | upstream builders affecting semantics | `5.4`, `7.8`, `12.3` |
| `1.5` | draft upstream tables section | `5.3`, `5.4`, `10` |
| `2.1` | metric family inventory | `6`, `8.2`, `12.3` |
| `2.2` | column inventory | `6.13`, `11`, `12.3`, `12.6` |
| `2.3` | shorthand formula inventory | `7.5`, `7.6`, `7.7`, `9` |
| `2.4` | additive and baseline audit | `6.4`, `7.4`, `12.3` |
| `2.5` | bounded ratio audit | `6.6`, `7.5`, `7.6`, `12.4` |
| `2.6` | `/60` audit | `6.5`, `7.3`, `7.5`, `12.4` |
| `2.7` | PP and role-context audit | `6.8`, `7.8`, `12.3` |
| `2.8` | historical baseline audit | `6.10`, `7.9`, `12.3` |
| `2.9` | actual `lastN` behavior | `6.11`, `7.6`, `12.4` |
| `2.10` | canonical `lastN` recommendation | `7.6`, `11`, `15` |
| `3.1` | validation player set | `12.2` |
| `3.2` | manual source reconstruction | `12.3`, `12.4`, `12.5` |
| `3.3` | stored vs source mismatch classification | `12.5`, `15` |
| `3.4` | targeted recomputes | `5.5`, `12.5` |
| `3.5` | live validation examples | `12.2`, `12.4`, `15` |
| `3.6` | evidence-based status assignment | `8.5`, `15` |
| `4.1` | reverse-engineered GP% logic | `6.2`, `7.7`, `9`, `11` |
| `4.2` | GP% vs intended semantics | `7.7`, `11`, `12.4` |
| `4.3` | intended GP% model | `7.7`, `9`, `11` |
| `4.4` | schema fit for GP% | `7.10`, `11` |
| `4.5` | schema change recommendations | `7.7`, `7.10`, `11` |
| `5.1` | draft metric families / inventory output | `6`, `11`, `12.6` |
| `5.2` | working bucket | `7.4`, `7.5`, `15` |
| `5.3` | broken bucket | `7.7`, `15` |
| `5.4` | almost bucket | `7.5`, `7.6`, `7.8`, `15` |
| `5.5` | needs review bucket | `7.7`, `7.8`, `12.3`, `12.4` |
| `5.6` | rationale section | `1.2`, `7`, `15` |
| `5.7` | suggested metric additions | `13` |
| `5.8` | remediation plan | `7`, `11`, `12`, `13`, `14` |
| `5.9` | final output structure check | `8.5`, `12.6`, `17` |
| `5.10` | completeness cross-check | `6.13`, `12.6`, `17` |
