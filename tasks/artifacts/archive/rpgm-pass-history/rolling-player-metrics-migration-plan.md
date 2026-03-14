# Rolling Player Metrics Migration Plan

## Purpose

This artifact defines the migration strategy for remediating `rolling_player_game_metrics` schema semantics without breaking the current pipeline mid-rollout.

It translates the PRD and audit into concrete schema decisions for:

- all-strength availability
- split-strength participation
- ratio-family canonical naming
- weighted `/60` canonical naming
- raw numerator / denominator support fields
- legacy compatibility behavior
- backfill and rollout sequencing

Primary inputs:

- `/Users/tim/Code/fhfhockey.com/tasks/prd-rolling-player-metrics-remediation-blueprint.md`
- `/Users/tim/Code/fhfhockey.com/tasks/rolling-player-metrics-audit-notes.md`
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-game-metrics-schema-surface-audit.md`

## Decision Summary

### 1. Migration Shape

Initial remediation will use an additive compatibility migration, not an in-place rename migration.

Decisions:

- do not rename existing columns in place during the first remediation rollout
- do not drop misleading legacy columns during the first remediation rollout
- add canonical replacement columns alongside the existing legacy surface
- dual-write canonical fields and legacy compatibility aliases during the transition
- move downstream readers to canonical fields before any cleanup migration is considered

Reasoning:

- the table is already consumed by trends pages, debug views, projection queries, and diagnostics
- in-place renames would create unnecessary coupled rollout risk
- the audit requires correctness first, then contract cleanup, then validation, not a one-shot destructive rename

### 2. Existing March 2026 GP Migration

Decision:

- keep `/Users/tim/Code/fhfhockey.com/migrations/20260310_remediate_rolling_player_metrics_gp_pct.sql` as historical context
- do not amend that existing migration file
- create a new superseding migration for the broader contract cleanup

Reasoning:

- the existing migration is already part of repository history
- the new remediation scope is broader than GP alone
- the follow-up migration needs to handle compatibility, new canonical families, and raw support fields in one coherent step

### 3. Canonical Naming Direction

Decisions:

- keep additive family names as they are today
- keep all-strength availability field names already introduced on March 10, 2026
- add explicit participation field names for split strengths
- replace misleading ratio and weighted-rate `total_*` / `avg_*` naming with canonical scope-based snapshot fields

Canonical scope suffixes for ratio and weighted-rate families:

- `_all`
- `_last3`
- `_last5`
- `_last10`
- `_last20`
- `_season`
- `_3ya`
- `_career`

Examples:

- `shooting_pct_all`
- `shooting_pct_last10`
- `shooting_pct_season`
- `cf_pct_career`
- `sog_per_60_last5`
- `ixg_per_60_3ya`

Reasoning:

- ratio and weighted-rate families are snapshots, not totals
- historical ratio and weighted-rate values are also snapshots, not averages of row-level values
- removing both `total` and `avg` from canonical names eliminates the false implication that those suffixes encode different mathematics

## Canonical Field Plan

### 4. All-Strength Availability

Keep as canonical:

- `season_availability_pct`
- `three_year_availability_pct`
- `career_availability_pct`
- `availability_pct_last3_team_games`
- `availability_pct_last5_team_games`
- `availability_pct_last10_team_games`
- `availability_pct_last20_team_games`

Keep as required support:

- `season_games_played`
- `season_team_games_available`
- `three_year_games_played`
- `three_year_team_games_available`
- `career_games_played`
- `career_team_games_available`
- `games_played_last3_team_games`
- `team_games_available_last3`
- `games_played_last5_team_games`
- `team_games_available_last5`
- `games_played_last10_team_games`
- `team_games_available_last10`
- `games_played_last20_team_games`
- `team_games_available_last20`

Compatibility:

- keep `gp_pct_*` populated on all-strength rows during the transition
- derive all-strength `gp_pct_*` aliases from the canonical availability fields

### 5. Split-Strength Participation

Add new canonical fields:

- `season_participation_pct`
- `three_year_participation_pct`
- `career_participation_pct`
- `participation_pct_last3_team_games`
- `participation_pct_last5_team_games`
- `participation_pct_last10_team_games`
- `participation_pct_last20_team_games`

Add new split-strength numerator support fields:

- `season_participation_games`
- `three_year_participation_games`
- `career_participation_games`
- `participation_games_last3_team_games`
- `participation_games_last5_team_games`
- `participation_games_last10_team_games`
- `participation_games_last20_team_games`

Reuse existing denominator support fields:

- `season_team_games_available`
- `three_year_team_games_available`
- `career_team_games_available`
- `team_games_available_last3`
- `team_games_available_last5`
- `team_games_available_last10`
- `team_games_available_last20`

Populate rules:

- on `all` rows:
  - populate availability fields
  - leave participation fields null
- on `ev`, `pp`, and `pk` rows:
  - populate participation fields
  - leave availability fields null

Compatibility:

- keep split-strength legacy `gp_pct_*` fields populated during transition
- treat them as compatibility aliases for participation outputs, not availability
- keep `gp_semantic_type` during the compatibility phase so downstream readers can distinguish meanings

### 6. Ratio-Family Canonical Snapshot Fields

Add canonical snapshot columns for each ratio family:

- `shooting_pct`
- `primary_points_pct`
- `expected_sh_pct`
- `ipp`
- `on_ice_sh_pct`
- `oz_start_pct`
- `pp_share_pct`
- `cf_pct`
- `ff_pct`
- `pdo`

Canonical field template:

- `<metric>_all`
- `<metric>_last3`
- `<metric>_last5`
- `<metric>_last10`
- `<metric>_last20`
- `<metric>_season`
- `<metric>_3ya`
- `<metric>_career`

Examples:

- `primary_points_pct_all`
- `ipp_last20`
- `pp_share_pct_season`
- `pdo_career`

Compatibility:

- keep legacy `<metric>_total_*` and `<metric>_avg_*` fields during transition
- dual-write them from the canonical snapshot values
- treat the legacy fields as deprecated aliases only

### 7. Weighted `/60` Canonical Snapshot Fields

Add canonical snapshot columns for:

- `sog_per_60`
- `ixg_per_60`
- `hits_per_60`
- `blocks_per_60`

Canonical field template:

- `<metric>_all`
- `<metric>_last3`
- `<metric>_last5`
- `<metric>_last10`
- `<metric>_last20`
- `<metric>_season`
- `<metric>_3ya`
- `<metric>_career`

Examples:

- `sog_per_60_all`
- `ixg_per_60_last10`
- `blocks_per_60_season`

Compatibility:

- keep legacy `<metric>_total_*` and `<metric>_avg_*` fields during transition
- dual-write them from the canonical weighted snapshot values
- do not treat the legacy fields as distinct metrics

## Raw Support Field Plan

### 8. Storage Strategy

The remediation will not add raw support for every metric in every scope if an exact and already-healthy support field already exists.

Rules:

- reuse existing additive totals when they already represent the exact raw component needed for `all` and `lastN`
- add dedicated support columns where:
  - the needed component is not currently stored anywhere
  - the needed component exists only as an average, not a total
  - the component meaning is otherwise ambiguous

This avoids unnecessary schema bloat while still making ratio and weighted-rate families auditable.

### 9. Reuse Existing Support Where Exact Totals Already Exist

For `all` and `lastN` scopes, reuse existing additive totals for these ratio families:

- `shooting_pct`
  - reuse `goals_total_*`
  - reuse `shots_total_*`
- `expected_sh_pct`
  - reuse `ixg_total_*`
  - reuse `shots_total_*`
- `cf_pct`
  - reuse `cf_total_*`
  - reuse `ca_total_*`
- `ff_pct`
  - reuse `ff_total_*`
  - reuse `fa_total_*`
- weighted `/60` families
  - reuse the additive event totals already stored for the numerator
  - reuse `toi_seconds_total_*`

Important limit:

- this reuse only works for `all` and `lastN`
- current `season`, `3ya`, and `career` additive fields are averages, not totals, so historical raw support still needs explicit columns

### 10. Add New Historical Raw Support for Ratio and Weighted-Rate Families

Add explicit historical raw support columns for the `season`, `3ya`, and `career` scopes wherever current schema lacks total raw components.

Historical support scope suffixes:

- `_season`
- `_3ya`
- `_career`

Required additions by family:

#### 10.1 `shooting_pct`

- `shooting_pct_goals_season`
- `shooting_pct_shots_season`
- `shooting_pct_goals_3ya`
- `shooting_pct_shots_3ya`
- `shooting_pct_goals_career`
- `shooting_pct_shots_career`

#### 10.2 `primary_points_pct`

Add support for all scopes because the numerator component is not stored elsewhere:

- `primary_points_pct_primary_points_all`
- `primary_points_pct_points_all`
- `primary_points_pct_primary_points_last3`
- `primary_points_pct_points_last3`
- `primary_points_pct_primary_points_last5`
- `primary_points_pct_points_last5`
- `primary_points_pct_primary_points_last10`
- `primary_points_pct_points_last10`
- `primary_points_pct_primary_points_last20`
- `primary_points_pct_points_last20`
- `primary_points_pct_primary_points_season`
- `primary_points_pct_points_season`
- `primary_points_pct_primary_points_3ya`
- `primary_points_pct_points_3ya`
- `primary_points_pct_primary_points_career`
- `primary_points_pct_points_career`

#### 10.3 `expected_sh_pct`

- `expected_sh_pct_ixg_season`
- `expected_sh_pct_shots_season`
- `expected_sh_pct_ixg_3ya`
- `expected_sh_pct_shots_3ya`
- `expected_sh_pct_ixg_career`
- `expected_sh_pct_shots_career`

#### 10.4 `ipp`

Add support for all scopes because the denominator component is not otherwise stored:

- `ipp_points_all`
- `ipp_on_ice_goals_for_all`
- `ipp_points_last3`
- `ipp_on_ice_goals_for_last3`
- `ipp_points_last5`
- `ipp_on_ice_goals_for_last5`
- `ipp_points_last10`
- `ipp_on_ice_goals_for_last10`
- `ipp_points_last20`
- `ipp_on_ice_goals_for_last20`
- `ipp_points_season`
- `ipp_on_ice_goals_for_season`
- `ipp_points_3ya`
- `ipp_on_ice_goals_for_3ya`
- `ipp_points_career`
- `ipp_on_ice_goals_for_career`

#### 10.5 `on_ice_sh_pct`

Add support for all scopes:

- `on_ice_sh_pct_goals_for_all`
- `on_ice_sh_pct_shots_for_all`
- `on_ice_sh_pct_goals_for_last3`
- `on_ice_sh_pct_shots_for_last3`
- `on_ice_sh_pct_goals_for_last5`
- `on_ice_sh_pct_shots_for_last5`
- `on_ice_sh_pct_goals_for_last10`
- `on_ice_sh_pct_shots_for_last10`
- `on_ice_sh_pct_goals_for_last20`
- `on_ice_sh_pct_shots_for_last20`
- `on_ice_sh_pct_goals_for_season`
- `on_ice_sh_pct_shots_for_season`
- `on_ice_sh_pct_goals_for_3ya`
- `on_ice_sh_pct_shots_for_3ya`
- `on_ice_sh_pct_goals_for_career`
- `on_ice_sh_pct_shots_for_career`

#### 10.6 `pdo`

Add support for all scopes:

- `pdo_goals_for_all`
- `pdo_shots_for_all`
- `pdo_goals_against_all`
- `pdo_shots_against_all`
- same component pattern for `last3`, `last5`, `last10`, `last20`, `season`, `3ya`, and `career`

#### 10.7 `oz_start_pct`

Add support for all scopes:

- `oz_start_pct_off_zone_starts_all`
- `oz_start_pct_def_zone_starts_all`
- `oz_start_pct_neutral_zone_starts_all`
- same component pattern for `last3`, `last5`, `last10`, `last20`, `season`, `3ya`, and `career`

Reasoning:

- neutral-zone starts are excluded from the current denominator, but the raw count is still useful for verification and future semantic review

#### 10.8 `pp_share_pct`

Add support for all scopes:

- `pp_share_pct_player_pp_toi_all`
- `pp_share_pct_team_pp_toi_all`
- `pp_share_pct_player_pp_toi_last3`
- `pp_share_pct_team_pp_toi_last3`
- `pp_share_pct_player_pp_toi_last5`
- `pp_share_pct_team_pp_toi_last5`
- `pp_share_pct_player_pp_toi_last10`
- `pp_share_pct_team_pp_toi_last10`
- `pp_share_pct_player_pp_toi_last20`
- `pp_share_pct_team_pp_toi_last20`
- `pp_share_pct_player_pp_toi_season`
- `pp_share_pct_team_pp_toi_season`
- `pp_share_pct_player_pp_toi_3ya`
- `pp_share_pct_team_pp_toi_3ya`
- `pp_share_pct_player_pp_toi_career`
- `pp_share_pct_team_pp_toi_career`

Resolution used in this migration plan:

- `pp_share_pct_team_pp_toi_*` will store the resolved denominator actually used by the rolling row contract
- source-path provenance remains a diagnostics concern rather than a second schema family in this migration

This keeps the schema source-agnostic while leaving room for diagnostics to record whether the denominator was builder-derived or WGO-inferred.

#### 10.9 Historical `/60` Support

Add historical numerator and TOI support for weighted-rate families:

- `sog_per_60_shots_season`
- `sog_per_60_toi_seconds_season`
- `sog_per_60_shots_3ya`
- `sog_per_60_toi_seconds_3ya`
- `sog_per_60_shots_career`
- `sog_per_60_toi_seconds_career`
- same pattern for:
  - `ixg_per_60`
  - `hits_per_60`
  - `blocks_per_60`

Reasoning:

- current historical weighted-rate columns store snapshots only
- explicit raw components are needed to audit historical `/60` values directly

## Legacy Compatibility Plan

### 11. Legacy Fields to Keep Temporarily

Keep during transition:

- all `gp_pct_*` fields
- all ratio-family `*_total_*` fields
- all ratio-family `*_avg_*` fields
- all weighted-rate `*_total_*` fields
- all weighted-rate `*_avg_*` fields

Compatibility behavior:

- treat these as deprecated alias outputs only
- populate them from the new canonical fields and resolved support components
- do not let downstream code treat them as independent semantics

### 12. Legacy Fields Not to Expand

Do not add new legacy-style fields.

Specifically:

- do not add additional `gp_pct_avg_*` variants
- do not add new ratio-family `avg_*` aliases beyond the current surface
- do not create second-generation misleading `total_*` fields for new canonical metrics

## Backfill and Rollout Sequence

### 13. Required Rollout Order

1. add the new canonical and support columns
2. update generated Supabase types
3. update the writer to dual-write canonical and compatibility fields
4. update diagnostics to validate canonical fields first and compatibility fields second
5. backfill the entire target table through a controlled rolling recompute
6. update downstream consumers to canonical-first reads
7. complete live-data validation against refreshed rows
8. only after successful validation, consider a later cleanup migration for deprecated aliases

### 14. Backfill Method

Decision:

- use a full recompute of `rolling_player_game_metrics` after the writer is updated
- do not rely on piecemeal SQL backfills for the semantic conversions

Reasoning:

- the row values are derived from multiple source tables and rolling accumulators
- correctness depends on the writer logic, not just field renaming
- a full recompute avoids mixed-contract rows inside the same table

### 15. Mixed-Semantics Safeguards

Required safeguards:

- do not treat old rows as valid signoff evidence after schema change
- validate that recomputed rows postdate the remediation deployment
- use diagnostics and run summaries to detect rows still missing canonical fields

## Downstream Consumer Strategy

### 16. Reader Transition Policy

Downstream readers should migrate in this order:

1. canonical availability and participation fields
2. canonical ratio snapshot fields
3. canonical weighted-rate snapshot fields
4. raw support fields where debug or verification surfaces need explainability

During transition:

- readers may continue to fall back to legacy aliases only where required
- new feature work should not target legacy alias fields

## Open Items Resolved Here

### 17. PP Share Denominator Ambiguity

The audit left some ambiguity about the final denominator authority for `pp_share_pct`.

Resolution for migration planning:

- store the resolved team PP TOI denominator in source-agnostic fields named `pp_share_pct_team_pp_toi_*`
- keep source provenance in diagnostics, not in duplicated schema columns
- if later product work requires exposing both denominator paths, add that as a separate follow-up schema expansion rather than blocking this remediation rollout

### 18. Participation Denominator Duplication

Resolution:

- reuse the existing team-game denominator fields for both availability and participation
- add participation numerators and participation pct fields only
- do not create a second duplicated denominator family for split-strength participation

This keeps the contract explicit without duplicating already-correct denominator storage.

## Output of This Plan

This plan gives `4.3` a concrete implementation target:

- new additive migration rather than amending old migrations
- new canonical availability and participation fields
- new canonical ratio and `/60` snapshot fields
- targeted raw support additions
- legacy dual-write compatibility period
- full recompute backfill after writer changes
