# Rolling Player Pass-2 Additive Family Audit

## Purpose

This artifact is the additive-family portion of the pass-2 audit.

It covers every persisted additive metric family in `rolling_player_game_metrics` and records, for each family:

- stored field set
- source tables
- source fields
- code path
- canonical formula
- intended hockey meaning
- current stored-field behavior
- reconstruction method

This artifact does not assign final status buckets yet. Status ledger work remains separate in `/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-notes-pass-2.md`.

## Scope

Additive field surface from the generated row type:

- total additive families: `22`
- additive persisted fields: `286`
- per-family storage grid:
  - `_total_all`
  - `_total_last3`
  - `_total_last5`
  - `_total_last10`
  - `_total_last20`
  - `_avg_all`
  - `_avg_last3`
  - `_avg_last5`
  - `_avg_last10`
  - `_avg_last20`
  - `_avg_season`
  - `_avg_3ya`
  - `_avg_career`

Families in scope:

- player counting and value:
  - `goals`
  - `assists`
  - `shots`
  - `hits`
  - `blocks`
  - `points`
  - `pp_points`
  - `ixg`
- chance-generation counts:
  - `iscf`
  - `ihdcf`
- on-ice and territorial counts:
  - `cf`
  - `ca`
  - `ff`
  - `fa`
  - `oi_gf`
  - `oi_ga`
  - `oi_sf`
  - `oi_sa`
- zone-start counts:
  - `oz_starts`
  - `dz_starts`
  - `nz_starts`
- TOI:
  - `toi_seconds`

## Shared Additive Contract

### Upstream row assembly

The additive write path starts from the WGO appearance spine and then enriches each row with split-specific NST data:

- WGO spine:
  - `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - `fetchWgoRowsForPlayer(...)`
  - `buildGameRecords(...)`
- split-specific authoritative NST sources:
  - `nst_gamelog_as_counts`
  - `nst_gamelog_es_counts`
  - `nst_gamelog_pp_counts`
  - `nst_gamelog_pk_counts`
  - `nst_gamelog_as_counts_oi`
  - `nst_gamelog_es_counts_oi`
  - `nst_gamelog_pp_counts_oi`
  - `nst_gamelog_pk_counts_oi`
- supplementary source for TOI and some weighted-rate reconstruction context:
  - `nst_gamelog_*_rates`

### Additive accumulation code path

Additive metrics are the `aggregation: "simple"` entries in `METRICS`:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`

Runtime flow:

1. `buildGameRecords(...)` merges WGO, NST counts, NST rates, NST on-ice counts, PP rows, and line rows into `PlayerGameData`
2. each additive metric resolves a per-game value through `metric.getValue(game)`
3. `updateAccumulator(...)` builds `all` and `lastN` rolling sums / counts
4. `updateHistoricalAverageAccumulator(...)` builds season / 3YA / career sums / counts
5. `deriveOutputs(...)` emits:
   - `*_total_all` as summed additive value
   - `*_avg_all` as summed additive value divided by additive observation count
   - `*_total_lastN` as summed additive value across the selected additive window
   - `*_avg_lastN` as summed additive value divided by additive observation count in the selected window
   - `*_avg_season`, `*_avg_3ya`, `*_avg_career` as historical means over qualifying observations

### Canonical additive formulas

For any additive family `x`:

- `x_total_all = sum(game_value_x over all qualifying additive observations to date)`
- `x_avg_all = sum(game_value_x) / count(qualifying additive observations)`
- `x_total_lastN = sum(game_value_x over selected additive lastN window)`
- `x_avg_lastN = sum(game_value_x over selected additive lastN window) / count(qualifying additive observations in that window)`
- `x_avg_season = sum(game_value_x in current season) / count(qualifying additive observations in current season)`
- `x_avg_3ya = sum(game_value_x across current season and prior two seasons) / count(qualifying additive observations in that 3YA window)`
- `x_avg_career = sum(game_value_x across career scope) / count(qualifying additive observations across career scope)`

Important additive window contract:

- additive lastN windows are appearance-based, not team-game-based
- the selected window advances only when the metric has a defined additive observation for that row

## Family Audit

### 1. Player Counting and Value Families

Families:

- `goals`
- `assists`
- `shots`
- `hits`
- `blocks`
- `points`
- `pp_points`
- `ixg`

Stored field set:

- each family uses the full 13-field additive grid

Source tables:

- authoritative primary:
  - split-specific `nst_gamelog_*_counts`
- fallback for all-strength only where allowed:
  - `wgo_skater_stats`

Source fields by family:

- `goals`
  - NST: `counts.goals`
  - WGO fallback: `wgo.goals`
- `assists`
  - NST: `counts.total_assists`
  - WGO fallback: `wgo.assists`
- `shots`
  - NST: `counts.shots`
  - WGO fallback: `wgo.shots`
- `hits`
  - NST: `counts.hits`
  - WGO fallback: `wgo.hits`
- `blocks`
  - NST: `counts.shots_blocked`
  - WGO fallback: `wgo.blocked_shots`
- `points`
  - NST: `counts.total_points`
  - WGO fallback: `wgo.points`
- `pp_points`
  - PP rows: `counts.total_points` when `strength = "pp"`
  - all-strength fallback: `wgo.pp_points` when `strength = "all"`
- `ixg`
  - NST: `counts.ixg`
  - WGO fallback for all-strength only: `wgo.ixg`

Primary code path:

- source-precedence helpers:
  - `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerSourceSelection.ts`
- per-metric writer call sites:
  - `getGoals(...)`
  - `getAssists(...)`
  - `getShots(...)`
  - `getHits(...)`
  - `getBlocks(...)`
  - `getPoints(...)`
  - `getPpPointsValue(...)`
  - `getIxgValue(...)`
- write path:
  - `METRICS` simple entries in `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - `deriveOutputs(...)`

Canonical formula:

- per-game value:
  - use authoritative NST counts field when present
  - otherwise use WGO fallback only when the source-selection contract allows it
- rolling totals:
  - sum resolved per-game additive values across the additive window
- rolling averages:
  - divide rolling total by additive observation count in the same scope

Intended hockey meaning:

- raw player event totals and per-observation averages
- no ratio semantics
- no weighted-rate semantics

Current stored-field behavior:

- `*_total_*` stores additive totals
- `*_avg_*` stores additive means across qualifying additive observations
- split-strength rows do not use WGO fallback for these player-counting families
- all-strength rows may use WGO fallback when NST counts are missing

Reconstruction method:

1. load WGO row spine for the player / strength / date scope
2. join split-specific NST counts by `date_scraped = wgo.date`
3. resolve the per-game value using the source-selection helper rules
4. sum per-game values for `total_*`
5. divide by observation count for `avg_*`

Evidence from tests:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerSourceSelection.test.ts`
  - confirms NST counts outrank WGO
  - confirms WGO fallback is all-strength only for the guarded families
  - confirms `pp_points` uses PP counts on PP rows and `wgo.pp_points` on all-strength rows

### 2. NST Counts-Only Chance Families

Families:

- `iscf`
- `ihdcf`

Stored field set:

- full 13-field additive grid for each family

Source tables:

- authoritative only:
  - split-specific `nst_gamelog_*_counts`

Source fields:

- `iscf`
  - `counts.iscfs`
- `ihdcf`
  - `counts.hdcf`

Primary code path:

- simple metric definitions in `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`

Canonical formula:

- `family_total_scope = sum(authoritative NST raw count across scope)`
- `family_avg_scope = sum(authoritative NST raw count across scope) / count(qualifying additive observations in scope)`

Intended hockey meaning:

- raw individual scoring-chance and high-danger-chance counts

Current stored-field behavior:

- pure NST-count-backed additive outputs
- no WGO fallback path exists for these families

Reconstruction method:

1. load split-specific NST counts rows by date
2. read `iscfs` or `hdcf`
3. aggregate by the additive storage formulas above

Pass-2 note:

- these families are structurally simpler than `ixg` because they do not depend on fallback source selection

### 3. On-Ice and Territorial Additive Counts

Families:

- `cf`
- `ca`
- `ff`
- `fa`
- `oi_gf`
- `oi_ga`
- `oi_sf`
- `oi_sa`

Stored field set:

- full 13-field additive grid for each family

Source tables:

- authoritative only:
  - split-specific `nst_gamelog_*_counts_oi`

Source fields by family:

- `cf`
  - `countsOi.cf`
- `ca`
  - `countsOi.ca`
- `ff`
  - `countsOi.ff`
- `fa`
  - `countsOi.fa`
- `oi_gf`
  - `countsOi.gf`
- `oi_ga`
  - `countsOi.ga`
- `oi_sf`
  - `countsOi.sf`
- `oi_sa`
  - `countsOi.sa`

Primary code path:

- simple metric definitions in `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`

Canonical formula:

- `family_total_scope = sum(authoritative on-ice count across scope)`
- `family_avg_scope = sum(authoritative on-ice count across scope) / count(qualifying additive observations in scope)`

Intended hockey meaning:

- raw on-ice or territorial event counts, not percentages
- these are also component sources for ratio families like `cf_pct`, `ff_pct`, `on_ice_sh_pct`, and `pdo`

Current stored-field behavior:

- direct additive outputs
- also function as persisted “support-like” raw context families because downstream ratio audit can cross-check them against ratio support columns

Reconstruction method:

1. load split-specific `countsOi` rows by date
2. read the raw on-ice field
3. aggregate by additive total or additive mean in the selected scope

Pass-2 note:

- although these are additive outputs, they should be cross-checked later against ratio support columns for `cf_pct`, `ff_pct`, `on_ice_sh_pct`, and `pdo` because the same underlying source fields feed both families

### 4. Zone-Start Additive Counts

Families:

- `oz_starts`
- `dz_starts`
- `nz_starts`

Stored field set:

- full 13-field additive grid for each family

Source tables:

- authoritative only:
  - split-specific `nst_gamelog_*_counts_oi`

Source fields:

- `oz_starts`
  - `countsOi.off_zone_starts`
- `dz_starts`
  - `countsOi.def_zone_starts`
- `nz_starts`
  - `countsOi.neu_zone_starts`

Primary code path:

- simple metric definitions in `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`

Canonical formula:

- `family_total_scope = sum(authoritative zone-start count across scope)`
- `family_avg_scope = sum(authoritative zone-start count across scope) / count(qualifying additive observations in scope)`

Intended hockey meaning:

- raw zone-start counts
- also support the interpretation of `oz_start_pct`

Current stored-field behavior:

- direct additive outputs
- `nz_starts` also exists as a support-style bridge for `oz_start_pct` interpretation even though the ratio denominator excludes neutral-zone starts

Reconstruction method:

1. load split-specific `countsOi` rows by date
2. read zone-start raw fields
3. aggregate by additive total or additive mean in the selected scope

Pass-2 note:

- `oz_start_pct` support columns use explicit off-zone, def-zone, and neutral-zone persisted support fields
- these additive families should still be validated on their own because the table stores them independently from the ratio-support surface

### 5. TOI Additive Family

Family:

- `toi_seconds`

Stored field set:

- full 13-field additive grid

Source tables:

- authoritative preferred:
  - split-specific `nst_gamelog_*_counts.toi`
- authoritative secondary:
  - split-specific `nst_gamelog_*_counts_oi.toi`
- supplementary:
  - split-specific `nst_gamelog_*_rates.toi_per_gp`
- fallback:
  - normalized `wgo_skater_stats.toi_per_game`

Source fields:

- `counts.toi`
- `countsOi.toi`
- `rates.toi_per_gp`
- `wgo.toi_per_game`

Primary code path:

- TOI contract:
  - `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerToiContract.ts`
- writer wrappers:
  - `resolveFallbackToiContext(...)`
  - `resolveToiContext(...)`
  - `getToiContext(...)`
  - `getToiSeconds(...)`
- simple metric definition:
  - `key: "toi_seconds"` in `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`

Canonical formula:

- per-game value:
  - resolved TOI seconds from contract precedence:
    1. NST counts TOI
    2. NST counts-on-ice TOI
    3. NST rates `toi_per_gp`
    4. fallback TOI seed
    5. normalized WGO `toi_per_game`
- rolling totals and averages:
  - same additive formulas as any other additive family

Intended hockey meaning:

- total seconds played in the selected strength state and scope
- per-observation average TOI in seconds

Current stored-field behavior:

- additive totals and means are stored correctly from the resolved TOI value
- the trust tier, source choice, rejected candidates, and normalization mode are not persisted in row columns

Reconstruction method:

1. load counts, countsOi, rates, and WGO row for each game
2. resolve the chosen TOI source using the TOI contract
3. aggregate the resolved seconds into additive totals and means

Evidence from tests:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerToiContract.test.ts`
  - confirms WGO normalization
  - confirms fallback seed ordering
  - confirms TOI source precedence and trust-tier semantics

## Stored Behavior Notes Shared Across Additive Families

- additive families do not emit canonical `*_all`, `*_lastN`, `*_season`, `*_3ya`, or `*_career` aliases today
- their current persisted contract remains the legacy additive naming grid
- additive `avg_*` values are true means of resolved per-row values, not ratio snapshots
- additive field windows advance on valid additive observations rather than on team games

## Reconstruction Checklist for Additive Audit Execution

For any additive family:

1. choose player, strength, and anchor row from the validation matrix
2. pull WGO spine rows in chronological order
3. join the relevant authoritative NST table by date
4. resolve per-game value according to the additive source contract
5. compute:
   - `total_all`
   - `avg_all`
   - `total_last3`
   - `avg_last3`
   - `total_last5`
   - `avg_last5`
   - `total_last10`
   - `avg_last10`
   - `total_last20`
   - `avg_last20`
   - `avg_season`
   - `avg_3ya`
   - `avg_career`
6. compare reconstructed outputs to stored row values

## Additive-Specific Risks to Carry Forward

- additive player-counting families for `all` strength still allow WGO fallback; pass 2 must verify whether any current stored outputs depend on fallback-heavy windows
- `toi_seconds` arithmetic can be correct while TOI trust remains opaque, because trust metadata is not persisted in row fields
- on-ice and zone-start additive families are authoritative from `countsOi`, but stale `countsOi` tails would invalidate both additive and downstream ratio validation
- additive families do not yet have canonical alias mirrors, so downstream consumers still rely on the legacy naming grid for these metrics
