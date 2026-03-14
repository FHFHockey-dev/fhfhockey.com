# Rolling Player Game Metrics Schema Surface Audit

## Purpose

This artifact classifies the current `rolling_player_game_metrics` column surface before migration design work begins.

Primary sources:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/database-generated.types.ts`
- `/Users/tim/Code/fhfhockey.com/migrations/20260309_add_explicit_historical_averages_to_rolling_player_game_metrics.sql`
- `/Users/tim/Code/fhfhockey.com/migrations/20260310_remediate_rolling_player_metrics_gp_pct.sql`
- `/Users/tim/Code/fhfhockey.com/tasks/rolling-player-metrics-audit-notes.md`
- `/Users/tim/Code/fhfhockey.com/tasks/prd-rolling-player-metrics-remediation-blueprint.md`

## Classification Buckets

- `Healthy as-is`
  - current name and stored meaning match the intended contract closely enough to keep
- `Healthy support / transition`
  - useful field that should remain, but it is not the final public semantic surface by itself
- `Semantically misleading`
  - current name does not match the actual meaning or aggregation contract
- `Redundant alias`
  - field currently duplicates another stored value and should not remain a separate canonical concept
- `Replacement fields required`
  - the current table is missing the canonical field family needed by the audit and PRD

## Current Surface by Family

### 1. Row Identity and Spine Columns

`Healthy as-is`

- `player_id`
- `team_id`
- `game_id`
- `game_date`
- `season`
- `strength_state`
- `updated_at`

Notes:

- these fields define the row spine and are not part of the semantic remediation problem
- `game_id` may still be null for unknown IDs, but that is a diagnostics concern, not a naming problem

### 2. Current Per-Row Support Counters

`Healthy support / transition`

- `games_played`
- `team_games_played`

Notes:

- `team_games_played` is the chronological team-game denominator spine and should stay
- `games_played` is acceptable as a low-level accumulated counter, but it is not a clean canonical public field across all strength states because split strengths mean positive-TOI participation rather than ordinary games played
- later schema work should preserve these counters while exposing explicit availability and participation fields above them

### 3. Additive Performance Families

Families:

- `goals`
- `assists`
- `points`
- `shots`
- `hits`
- `blocks`
- `pp_points`
- `ixg`
- `iscf`
- `ihdcf`
- `cf`
- `ca`
- `ff`
- `fa`
- `toi_seconds`

Current column patterns:

- `<metric>_total_all`
- `<metric>_total_last3`
- `<metric>_total_last5`
- `<metric>_total_last10`
- `<metric>_total_last20`
- `<metric>_avg_all`
- `<metric>_avg_last3`
- `<metric>_avg_last5`
- `<metric>_avg_last10`
- `<metric>_avg_last20`
- `<metric>_avg_season`
- `<metric>_avg_3ya`
- `<metric>_avg_career`

`Healthy as-is`

- all additive `total_*` fields
- all additive `avg_*` fields

Notes:

- for additive families, `total_*` genuinely stores additive totals and `avg_*` genuinely stores averages
- no naming cleanup is required for these families
- `toi_seconds` belongs in the healthy additive bucket because its totals and averages are true totals and averages, not ratio snapshots

### 4. Availability and GP Semantics

#### 4.1 Legacy GP Fields

Current columns:

- `gp_pct_total_all`
- `gp_pct_avg_all`
- `gp_pct_total_last3`
- `gp_pct_avg_last3`
- `gp_pct_total_last5`
- `gp_pct_avg_last5`
- `gp_pct_total_last10`
- `gp_pct_avg_last10`
- `gp_pct_total_last20`
- `gp_pct_avg_last20`
- `gp_pct_avg_season`
- `gp_pct_avg_3ya`
- `gp_pct_avg_career`

`Semantically misleading`

- `gp_pct_total_all`
- `gp_pct_total_last3`
- `gp_pct_total_last5`
- `gp_pct_total_last10`
- `gp_pct_total_last20`
- `gp_pct_avg_season`
- `gp_pct_avg_3ya`
- `gp_pct_avg_career`

`Redundant alias`

- `gp_pct_avg_all`
- `gp_pct_avg_last3`
- `gp_pct_avg_last5`
- `gp_pct_avg_last10`
- `gp_pct_avg_last20`

Notes:

- the audit proved `gp_pct_avg_season` is broken for traded players under the legacy meaning
- split-strength `gp_pct_*` fields are participation-in-state outputs, not true availability
- even where values are directionally useful, the `gp_pct_*` surface is not clean enough to remain canonical

#### 4.2 Canonical All-Strength Availability Fields Already Added

Current columns from the March 10 migration:

- `season_availability_pct`
- `three_year_availability_pct`
- `career_availability_pct`
- `availability_pct_last3_team_games`
- `availability_pct_last5_team_games`
- `availability_pct_last10_team_games`
- `availability_pct_last20_team_games`

`Healthy support / transition`

- all fields listed above

Notes:

- these are the intended canonical all-strength availability names
- they are healthy for the all-strength contract
- they are not a full schema solution yet because split-strength participation still reuses legacy GP fields

#### 4.3 Availability Raw Numerator / Denominator Fields Already Added

Current columns:

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

`Healthy support / transition`

- all fields listed above

Notes:

- these should remain as the auditable support layer for canonical availability outputs
- they are not replacements for user-facing availability or participation names

#### 4.4 GP Semantic Label

Current column:

- `gp_semantic_type`

`Healthy support / transition`

- `gp_semantic_type`

Notes:

- this is useful as a compatibility-era discriminator between all-strength availability and split-strength participation
- it should remain at least through the migration period

#### 4.5 Missing Canonical Participation Surface

`Replacement fields required`

- explicit split-strength participation percentage fields for `ev`, `pp`, and `pk`
- explicit split-strength participation numerator / denominator support fields for season, rolling team-game windows, 3YA, and career scopes
- field names that say `participation`, not `gp_pct` or `availability`, for split-strength semantics

Notes:

- the current table has no clean canonical replacement for split-strength participation
- the audit and PRD both require this distinction to become explicit in schema, not just code comments

### 5. Ratio Snapshot Families

Families:

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

Current column patterns:

- `<metric>_total_all`
- `<metric>_total_last3`
- `<metric>_total_last5`
- `<metric>_total_last10`
- `<metric>_total_last20`
- `<metric>_avg_all`
- `<metric>_avg_last3`
- `<metric>_avg_last5`
- `<metric>_avg_last10`
- `<metric>_avg_last20`
- `<metric>_avg_season`
- `<metric>_avg_3ya`
- `<metric>_avg_career`

`Semantically misleading`

- all ratio-family `<metric>_total_all`
- all ratio-family `<metric>_total_last3`
- all ratio-family `<metric>_total_last5`
- all ratio-family `<metric>_total_last10`
- all ratio-family `<metric>_total_last20`
- all ratio-family `<metric>_avg_season`
- all ratio-family `<metric>_avg_3ya`
- all ratio-family `<metric>_avg_career`

`Redundant alias`

- all ratio-family `<metric>_avg_all`
- all ratio-family `<metric>_avg_last3`
- all ratio-family `<metric>_avg_last5`
- all ratio-family `<metric>_avg_last10`
- all ratio-family `<metric>_avg_last20`

Notes:

- the audit proved these fields store ratio snapshots, not additive totals
- for `all` and `lastN`, the `avg_*` columns duplicate the `total_*` snapshot value
- historical `avg_*` columns are not duplicates, but the `avg` prefix still misdescribes their semantics because they are ratio-of-aggregates snapshots, not averages of per-game ratios
- this whole family needs canonical naming cleanup in migration planning

### 6. Weighted `/60` Families

Families:

- `sog_per_60`
- `ixg_per_60`
- `hits_per_60`
- `blocks_per_60`

Current column patterns:

- `<metric>_total_all`
- `<metric>_total_last3`
- `<metric>_total_last5`
- `<metric>_total_last10`
- `<metric>_total_last20`
- `<metric>_avg_all`
- `<metric>_avg_last3`
- `<metric>_avg_last5`
- `<metric>_avg_last10`
- `<metric>_avg_last20`
- `<metric>_avg_season`
- `<metric>_avg_3ya`
- `<metric>_avg_career`

`Semantically misleading`

- all weighted-rate `<metric>_total_all`
- all weighted-rate `<metric>_total_last3`
- all weighted-rate `<metric>_total_last5`
- all weighted-rate `<metric>_total_last10`
- all weighted-rate `<metric>_total_last20`
- all weighted-rate `<metric>_avg_season`
- all weighted-rate `<metric>_avg_3ya`
- all weighted-rate `<metric>_avg_career`

`Redundant alias`

- all weighted-rate `<metric>_avg_all`
- all weighted-rate `<metric>_avg_last3`
- all weighted-rate `<metric>_avg_last5`
- all weighted-rate `<metric>_avg_last10`
- all weighted-rate `<metric>_avg_last20`

Notes:

- the audit proved weighted `/60` fields are snapshot ratios built from aggregated numerators and TOI denominators
- `total_*` is therefore a naming mismatch
- `avg_*` duplicates `total_*` for all-strength and rolling windows
- historical `avg_*` values are weighted snapshots, not simple averages

### 7. Raw Ratio Support Columns

`Replacement fields required`

The current table does not yet expose the raw support fields needed to make ratio validation and downstream semantics transparent.

Required additions from the PRD and audit:

- shooting support:
  - raw goals numerator
  - raw shots denominator
- primary-points support:
  - raw goals-plus-first-assists numerator
  - raw total-points denominator
- expected-shooting support:
  - raw ixG numerator
  - raw shots denominator
- IPP support:
  - raw player-points numerator
  - raw on-ice goals-for denominator
- on-ice shooting support:
  - raw on-ice goals-for numerator
  - raw on-ice shots-for denominator
- PDO support:
  - raw on-ice goals-for
  - raw on-ice shots-for
  - raw on-ice goals-against
  - raw on-ice shots-against
- zone-start support:
  - raw offensive-zone starts
  - raw defensive-zone starts
  - optional neutral-zone starts if the product wants that explicit
- PP share support:
  - raw player PP TOI numerator
  - authoritative team PP TOI denominator or separately named alternative denominator if both builder and WGO paths are kept

Notes:

- without these fields, ratio validation depends on reconstructing hidden internals instead of reading the stored contract directly
- later migration work must decide exact names and whether any components can reuse existing additive columns

### 8. Context Labels

Current columns:

- `pp_unit`
- `line_combo_slot`
- `line_combo_group`

`Healthy support / transition`

- `pp_unit`
- `line_combo_slot`
- `line_combo_group`

Notes:

- these are contextual labels, not metric families
- the audit flagged them for freshness and validation review, not immediate renaming
- schema changes are not required here unless later validation proves the current label contract is insufficient

## Summary for Migration Design

### Healthy and likely retained

- row identity / spine columns
- additive family columns
- `toi_seconds` additive columns
- context labels
- raw availability support counters already added in March 2026
- canonical all-strength availability fields already added in March 2026
- `gp_semantic_type` during transition

### Misleading and should not remain canonical

- all legacy `gp_pct_*` fields
- all ratio-family `*_total_*` fields
- all ratio-family historical `*_avg_*` fields
- all weighted-rate `*_total_*` fields
- all weighted-rate historical `*_avg_*` fields

### Redundant alias surface

- all-strength and rolling-window `gp_pct_avg_*` aliases
- ratio-family `*_avg_all` and `*_avg_lastN`
- weighted-rate `*_avg_all` and `*_avg_lastN`

### Missing replacement surface

- explicit split-strength participation fields
- explicit split-strength participation raw support fields
- raw ratio-support columns for every ratio family
- authoritative PP-share denominator support columns

## Decisions Deferred to 4.2 and 4.3

- whether misleading fields are dropped, renamed in place, or retained as temporary compatibility aliases
- the exact canonical naming scheme for ratio and weighted-rate snapshots
- whether split-strength participation uses new columns only or a mixed compatibility period with legacy `gp_pct_*`
- the exact raw support column names for ratio and PP-share validation
