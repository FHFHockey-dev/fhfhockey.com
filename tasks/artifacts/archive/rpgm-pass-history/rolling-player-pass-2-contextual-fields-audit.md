# Rolling Player Pass-2 Contextual Fields Audit

## Purpose

This artifact is the contextual-fields portion of the pass-2 audit.

It covers the persisted PP-context and line-context fields in `rolling_player_game_metrics` and records, for each contextual surface:

- stored field set
- source tables
- source fields
- code path
- derivation rule
- intended hockey meaning
- current stored-field behavior
- trust and freshness requirements
- reconstruction method
- diagnostics and validation implications

This artifact does not assign final status buckets yet. Status ledger work remains separate in `/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-notes-pass-2.md`.

## Scope

Persisted contextual fields in scope:

- PP context:
  - `pp_unit`
  - `pp_share_of_team`
  - `pp_unit_usage_index`
  - `pp_unit_relative_toi`
  - `pp_vs_unit_avg`
- line context:
  - `line_combo_slot`
  - `line_combo_group`

Total contextual fields in scope:

- `7`

Important exclusion:

- `pp_share_pct*` is not part of this artifact
  - it is a rolling metric family audited in `/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-ratio-family-audit.md`
- the contextual fields in this artifact are attached to the row as current-game labels or builder outputs
  - they are not rolling-window aggregates

## Shared Context Contract

### Core principle

These fields are contextual labels or current-game builder outputs, not rolling metrics.

They are written once per stored rolling row from the row's matching builder context:

- PP builder row:
  - `powerPlayCombinations`
- line builder row:
  - `lineCombinations`

They do not use:

- rolling appearance windows
- historical season / 3YA / career accumulation
- numerator / denominator aggregation

### Write path

Contextual fields are written during the final row assembly in:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`

Final row write mapping:

- `line_combo_slot: game.lineCombo?.slot ?? null`
- `line_combo_group: game.lineCombo?.positionGroup ?? null`
- `pp_unit: resolvePpUnitLabel(...)`
- `...getOptionalPpContextOutputs(game)`

### Validation model

Validation is not arithmetic. It is source-row trust validation:

- was the authoritative builder row present
- was the player assigned a trusted label by that builder row
- is the builder tail fresh for the selected games
- does the stored value still match the refreshed builder output

## PP Context Audit

### 1. `pp_unit`

Field:

- `pp_unit`

Source tables:

- authoritative:
  - `powerPlayCombinations`

Source fields:

- `powerPlayCombinations.unit`

Primary code path:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPpUnitContract.ts`
  - `hasTrustedPpUnitContext(...)`
  - `resolvePpUnitLabel(...)`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - final row write

Derivation rule:

- store `unit` only when:
  - `originalGameId` is present
  - `unit` is a positive integer
- otherwise store `null`

Canonical derivation:

- `pp_unit = builder.unit if builder row exists and unit is a trusted positive integer else null`

Intended hockey meaning:

- builder-owned PP unit label for the player's game context
- not inferred from PP TOI
- not inferred from PP share
- not inferred from WGO usage

Current stored-field behavior:

- persisted as a single row-level contextual label
- can be `null` even when a PP builder row exists if the builder row has no trusted unit assignment
- does not change any rolling math

Trust and freshness requirements:

- freshness dependency:
  - `powerPlayCombinations`
- stale refresh action:
  - rerun `/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-power-play-combinations/[gameId].ts`
- validation must compare against refreshed builder rows for the same game

Reconstruction method:

1. locate the PP builder row for the same `gameId` and `playerId`
2. confirm `unit` is a positive integer
3. confirm the rolling row had a valid `originalGameId`
4. compare stored `pp_unit` to `resolvePpUnitLabel(...)`

Evidence from tests:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPpUnitContract.test.ts`
  - confirms `pp_unit` is contextual and builder-owned
  - confirms null / zero / missing-game values are rejected
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`
  - confirms `ppUnitSourcePresent` can be false even when PP source rows exist

### 2. Optional PP builder outputs

Fields:

- `pp_share_of_team`
- `pp_unit_usage_index`
- `pp_unit_relative_toi`
- `pp_vs_unit_avg`

Source tables:

- authoritative:
  - `powerPlayCombinations`

Source fields:

- `pp_share_of_team`
  - `powerPlayCombinations.pp_share_of_team`
- `pp_unit_usage_index`
  - `powerPlayCombinations.pp_unit_usage_index`
- `pp_unit_relative_toi`
  - `powerPlayCombinations.pp_unit_relative_toi`
- `pp_vs_unit_avg`
  - `powerPlayCombinations.pp_vs_unit_avg`

Primary code path:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - `getOptionalPpContextOutputs(...)`
- upstream builder semantics:
  - `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts`

Derivation rules:

- `pp_share_of_team`
  - team-share output:
    - `player.PPTOI / teamPpToiSeconds`
- `pp_unit_usage_index`
  - unit-relative usage index:
    - `player.PPTOI / avgUnitToiSeconds`
- `pp_unit_relative_toi`
  - unit-relative seconds delta:
    - `player.PPTOI - avgUnitToiSeconds`
- `pp_vs_unit_avg`
  - unit-relative usage delta:
    - `pp_unit_usage_index - 1`

Intended hockey meaning:

- `pp_share_of_team`
  - per-game true team PP share
- `pp_unit_usage_index`
  - per-game usage versus unit average
- `pp_unit_relative_toi`
  - per-game TOI difference versus unit average
- `pp_vs_unit_avg`
  - per-game relative usage difference from unit average

Current stored-field behavior:

- these are copied directly from the current game’s PP builder row
- they are not aggregated over rolling windows
- they can be present even when `pp_unit` is null if the builder row exists but the unit label is not trusted
- `pp_share_of_team` is a contextual current-game output here even though its arithmetic also feeds the rolling `pp_share_pct` family elsewhere

Important semantic distinction:

- `pp_share_of_team` in this artifact is the current-game builder field
- `pp_share_pct` in the ratio audit is the rolling ratio built from aggregated PP team-share components
- `pp_unit_usage_index`, `pp_unit_relative_toi`, and `pp_vs_unit_avg` are explicitly excluded from `pp_share_pct` semantics

Reconstruction method:

1. rebuild or load the authoritative PP builder row for the same game
2. compare the stored contextual fields directly to the builder row outputs
3. do not attempt rolling re-aggregation for these four fields

Evidence from tests:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`
  - confirms `getOptionalPpContextOutputs(...)` copies the builder outputs directly
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/powerPlayCombinationMetrics.test.ts`
  - confirms unit-relative fields remain distinct from team-share semantics
  - confirms `pp_share_of_team` is true team PP share
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPpShareContract.test.ts`
  - confirms unit-relative PP fields are excluded from rolling `pp_share_pct`

## Line Context Audit

### 3. `line_combo_slot`

Field:

- `line_combo_slot`

### 4. `line_combo_group`

Field:

- `line_combo_group`

Source tables:

- authoritative:
  - `lineCombinations`

Source fields:

- `forwards`
- `defensemen`
- `goalies`

Primary code path:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerLineContextContract.ts`
  - `resolveTrustedLineAssignment(...)`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - final row write

Derivation rule:

- if the player is found in:
  - `forwards`
    - `line_combo_group = "forward"`
    - `line_combo_slot = floor(index / 3) + 1`
  - `defensemen`
    - `line_combo_group = "defense"`
    - `line_combo_slot = floor(index / 2) + 1`
  - `goalies`
    - `line_combo_group = "goalie"`
    - `line_combo_slot = floor(index / 1) + 1`
- if the line row is missing or the player is not assigned in the builder row:
  - both fields are `null`

Intended hockey meaning:

- contextual builder-owned line assignment label for the player’s game context
- not inferred from TOI
- not inferred from on-ice metrics
- not inferred from PP context

Current stored-field behavior:

- both fields are written once per row from the matching line builder row
- null means:
  - builder row missing
  - or player absent from the builder row
- the stored row does not preserve:
  - `hasSourceRow`
  - `hasTrustedAssignment`
- only the final labels are persisted

Trust and freshness requirements:

- freshness dependency:
  - `lineCombinations`
- stale refresh actions:
  - `/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-line-combinations/[id].ts`
  - `/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-line-combinations/index.ts`

Reconstruction method:

1. load the line-combination row for the same game and team
2. run `resolveTrustedLineAssignment(...)`
3. compare stored `line_combo_slot` and `line_combo_group` to the resolved assignment
4. distinguish:
   - no source row
   - source row present but no trusted assignment

Evidence from tests:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerLineContextContract.test.ts`
  - confirms trusted forward / defense assignments
  - confirms missing-row and unassigned-player null behavior
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`
  - confirms `lineSourcePresent` and `lineAssignmentSourcePresent` are distinct

## Diagnostics and Source-Presence Notes

These contextual fields depend on builder freshness and builder completeness more than arithmetic correctness.

Available diagnostics already cover:

- PP context:
  - `missingPpGameIds`
  - `missingPpShareGameIds`
  - `missingPpUnitGameIds`
  - `ppTailLag`
- line context:
  - `lineTailLag`
- source-tracking row summaries:
  - `ppSourcePresent`
  - `ppUnitSourcePresent`
  - `lineSourcePresent`
  - `lineAssignmentSourcePresent`

Important validation implication:

- a stored `null` contextual field is not enough by itself to classify the metric
- validation must determine whether the null came from:
  - stale builder rows
  - missing builder rows
  - intentionally untrusted builder values
  - player not assigned in the builder row

Evidence from tests:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.test.ts`
  - confirms coverage warnings for missing PP share and PP unit builder values
  - confirms freshness warnings for PP and line tail lag

## `trendsDebug.tsx` Validation Requirements

For these contextual fields, the debug console must expose:

- refreshed builder row for the selected game
- stored contextual value
- trusted / untrusted interpretation
- freshness blockers:
  - PP builder tail lag
  - line builder tail lag
- source-presence flags:
  - PP row present
  - PP unit trusted
  - line row present
  - line assignment trusted

Suggested panel behavior:

- PP context panel:
  - `pp_unit`
  - `pp_share_of_team`
  - `pp_unit_usage_index`
  - `pp_unit_relative_toi`
  - `pp_vs_unit_avg`
  - builder source row snapshot
  - freshness status
- line context panel:
  - `line_combo_slot`
  - `line_combo_group`
  - builder source row snapshot
  - source-row-present flag
  - trusted-assignment flag

## How This Artifact Should Be Used

- task `2.6` should add formula/status entries only for the persisted contextual fields that need explicit ledger coverage, using derivation shorthand rather than ratio formulas
- task `2.7` should add action items when contextual trust, freshness visibility, or downstream semantics are unclear
- tasks in `3.x` should use this artifact during live validation for:
  - heavy-PP players
  - PP-unit trust cases
  - line-assignment validation players
  - stale-builder or missing-builder edge cases
