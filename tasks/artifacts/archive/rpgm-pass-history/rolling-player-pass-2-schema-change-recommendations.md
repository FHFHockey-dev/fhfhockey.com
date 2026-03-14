## pass-2 schema change recommendations

Sub-task: `5.5`

This artifact keeps schema recommendations separate from status inventories and validation rationale, per the PRD.

## Recommendation Summary

Pass-2 does not justify a broad schema rewrite. The recommended schema posture is:

- keep the current storage model
- treat canonical ratio, weighted-rate, and availability / participation replacement fields as authoritative
- freeze misleading legacy alias surfaces for compatibility only
- defer removal until downstream readers migrate
- prefer validation-payload expansion over new debug-only row columns
- reserve future schema additions for narrow support-parity gaps only

## 1. No broad storage-model replacement

Recommendation:

- do not replace `rolling_player_game_metrics` with a new table or a fully different naming system during pass 2

Reason:

- most of the current schema is usable
- the largest current problems are:
  - compatibility drag
  - debug visibility gaps
  - payload completeness gaps
- those do not require replacing the storage model

## 2. Treat these surfaces as authoritative going forward

### Canonical ratio aliases

Authoritative:

- `*_all`
- `*_last3`
- `*_last5`
- `*_last10`
- `*_last20`
- `*_season`
- `*_3ya`
- `*_career`

Applies to ratio families such as:

- `shooting_pct`
- `expected_sh_pct`
- `primary_points_pct`
- `ipp`
- `oz_start_pct`
- `pp_share_pct`
- `on_ice_sh_pct`
- `on_ice_sv_pct`
- `pdo`
- `cf_pct`
- `ff_pct`

### Canonical weighted-rate aliases

Authoritative:

- `*_all`
- `*_last3`
- `*_last5`
- `*_last10`
- `*_last20`
- `*_season`
- `*_3ya`
- `*_career`

Applies to:

- `sog_per_60`
- `ixg_per_60`
- `goals_per_60`
- `assists_per_60`
- `primary_assists_per_60`
- `secondary_assists_per_60`
- `hits_per_60`
- `blocks_per_60`

### Availability / participation replacement fields

Authoritative:

- `season_availability_pct`
- `three_year_availability_pct`
- `career_availability_pct`
- `availability_pct_lastN_team_games`
- `season_participation_games`
- `three_year_participation_games`
- `career_participation_games`
- `participation_games_lastN_team_games`
- `season_participation_pct`
- `three_year_participation_pct`
- `career_participation_pct`
- `participation_pct_lastN_team_games`
- explicit support counters such as:
  - `season_games_played`
  - `season_team_games_available`
  - `games_played_lastN_team_games`
  - `team_games_available_lastN`

## 3. Freeze these surfaces for compatibility only

Recommendation:

- continue writing them for now
- do not add new readers against them
- route any surviving reads through compatibility helpers where practical

Freeze-for-compatibility surfaces:

- ratio legacy aliases:
  - `*_total_*`
  - `*_avg_*`
  - where both store the same ratio snapshot
- weighted-rate legacy aliases:
  - `*_total_*`
  - `*_avg_*`
  - where both store the same weighted-rate snapshot
- GP compatibility aliases:
  - `gp_pct_*`

Reason:

- these are the misleading duplicate surfaces, not additive and TOI `avg` / `total`

## 4. Do not target additive and TOI `avg` / `total` surfaces for the same cleanup pass

Recommendation:

- keep additive and TOI legacy naming in place for now

Reason:

- additive `total` versus `avg` still encode distinct meanings
- TOI `total` versus `avg` still encode distinct meanings
- there is no full canonical additive or TOI replacement set yet

Implication:

- pass-2 cleanup should not lump additive / TOI naming in with ratio and weighted-rate alias cleanup

## 5. Keep `games_played`, `team_games_played`, and `gp_semantic_type` under different cleanup timelines

Recommendation:

- `games_played`
  - keep temporarily as convenience / compatibility
- `team_games_played`
  - keep temporarily as convenience / compatibility
- `gp_semantic_type`
  - keep longer than the two convenience fields

Reason:

- `gp_semantic_type` is still the semantic guardrail for legacy GP interpretation
- removing it before legacy GP readers are gone would make the schema less safe

## 6. Prefer payload expansion over new debug-only columns

Recommendation:

- do not add persisted columns for:
  - readiness state
  - stale-tail counts
  - next recommended action
  - copy-helper output
  - run-scoped warnings

Reason:

- these are freshness-sensitive and recompute-slice-specific
- persisting them would stale immediately and bloat the row contract

Preferred implementation:

- expand the validation payload instead

## 7. Narrow future schema additions that remain reasonable

These are the only schema additions still plausibly justified after pass 2:

- dedicated `on_ice_sv_pct` support columns
- optional all-scope / `lastN` weighted-rate support columns if payload-only support proves insufficient

Recommendation:

- evaluate these only after validation-payload expansion is in place
- do not add them as a first response to debug-console gaps

## 8. Recommended migration sequencing

1. downstream compatibility migration
   - move readers to canonical-first ratio / weighted-rate reads
   - especially [player/[playerId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/player/[playerId].tsx)
2. alias freeze
   - formally document ratio / weighted-rate / `gp_pct_*` legacy fields as compatibility-only
3. payload expansion
   - fill trust/debug metadata gaps in the validation payload
4. optional support-parity additions
   - only where payload-only support still proves insufficient
5. later cleanup migration set
   - deprecate or stop writing compatibility-only legacy aliases once downstream readers are migrated
