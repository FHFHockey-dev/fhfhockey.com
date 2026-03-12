# Rolling Player Pass-2 Reconstruction Evidence

Date:

- March 12, 2026

Related artifacts:

- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-validation-matrix.md`
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-refresh-execution-2026-03-12.md`
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-additive-family-audit.md`
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-ratio-family-audit.md`
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-weighted-rate-family-audit.md`
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-availability-participation-audit.md`

## Purpose

This artifact records the live reconstruction evidence for task `3.3`.

It captures:

- which validation players were comparison-ready
- which upstream source rows were used for each major family
- the intended reconstruction formula
- whether stored rows matched recomputed rows
- the mismatch cause bucket for any non-match
- which high-risk individual fields still need follow-up

## Commands Used

```bash
npm run check:rolling-player-family-reconstruction
npm run check:rolling-player-disputed-metrics
```

Scripts:

- [check-rolling-player-family-reconstruction.ts](/Users/tim/Code/fhfhockey.com/web/scripts/check-rolling-player-family-reconstruction.ts)
- [check-rolling-player-disputed-metrics.ts](/Users/tim/Code/fhfhockey.com/web/scripts/check-rolling-player-disputed-metrics.ts)

Recompute path:

- [recomputePlayerRowsForValidation(...)](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)

Observed generation times:

- family reconstruction: `2026-03-12T15:02:49.686Z`
- disputed metrics: `2026-03-12T15:02:54.935Z`

## Validation Cases Used

Ready stored-vs-recomputed comparison cases:

- Brent Burns (`8470613`, season `20252026`)
- Jesper Bratt (`8479407`, season `20252026`)

Partially usable validation case:

- Corey Perry (`8470621`, season `20252026`)
  - usable for GP / availability validation
  - PK-sensitive validation still blocked by stale PK source tails after the narrow March 12 PK refresh

Blocked proxy case:

- Seth Jones (`8477495`, season `20252026`)
  - retained as the incomplete-tail proxy
  - PK-sensitive comparisons remain blocked

Important constraint:

- the March 12 direct rolling recompute attempts still failed during `rolling_player_game_metrics` upsert with repeated `Bad Request` responses
- this artifact therefore uses live recompute outputs from the validation scripts against the currently stored rows already present in Supabase
- any mismatch that looks like a missing backfill or stale write must be read in the context of that target-write blocker

## Major Family Reconstruction Summary

| Family | Validation player(s) | Upstream source rows used | Intended formula / reconstruction model | Stored vs reconstructed result | Mismatch cause bucket |
| --- | --- | --- | --- | --- | --- |
| Availability | Corey Perry, Brent Burns, Jesper Bratt | `games`, `wgo_skater_stats`, rolling current-team ledger | `games_played / team_games_available` for availability scopes and current-team `lastN` team-game denominator rules from `rollingPlayerAvailabilityContract.ts` | `MATCH` across all compared ready rows and explicit Perry traded-player GP checks | none |
| Participation | Corey Perry, Brent Burns, Jesper Bratt | `games`, `wgo_skater_stats`, split-strength TOI-qualified appearances | `participation_games / team_games_available`, with split-strength participation requiring resolved split TOI | `MATCH` across all compared ready rows | none |
| TOI | Brent Burns, Jesper Bratt | split `nst_gamelog_*_counts`, `nst_gamelog_*_counts_oi`, `nst_gamelog_*_rates`, WGO fallback TOI seed | resolved TOI from precedence chain in `rollingPlayerToiContract.ts`, then aggregate `sum(toi_seconds)` by scope | `MATCH` across all compared ready rows | none |
| Additive counts | Brent Burns, Jesper Bratt | split `nst_gamelog_*_counts`, selective WGO fallback through `rollingPlayerSourceSelection.ts` | aggregate additive event totals over selected appearance window or historical scope | `MATCH` across all compared ready rows | none |
| Opportunity counts | Brent Burns, Jesper Bratt | split `nst_gamelog_*_counts`, split `nst_gamelog_*_counts_oi`, WGO fallback where contract allows | aggregate raw opportunity numerators and denominators used by ratio families | `MATCH` across all compared ready rows | none |
| Weighted `/60` | Brent Burns, Jesper Bratt | split `nst_gamelog_*_counts`, split `nst_gamelog_*_rates`, split `nst_gamelog_*_counts_oi`, WGO fallback TOI seed | `sum(raw_events) / sum(toi_seconds) * 3600` with `weighted_rate_performance` window semantics | `MATCH` across all compared ready rows in the family pass and explicit `ixg_per_60` dispute signoff | none |
| Finishing ratios | Brent Burns, Jesper Bratt | split `nst_gamelog_*_counts`, WGO fallback where allowed | ratio of aggregated components, including `sum(goals) / sum(shots) * 100` and similar family formulas | `MATCH` across all compared ready rows and explicit disputed `lastN` ratio checks | none |
| On-ice context | Brent Burns, Jesper Bratt | split `nst_gamelog_*_counts_oi` | ratio of aggregated on-ice components such as `sum(oi_gf) / sum(oi_sf) * 100` and `((oi_gf / oi_sf) * 100 + ((oi_sa - oi_ga) / oi_sa) * 100) * 0.01` for PDO | `MATCH` across all compared ready rows | none |
| Zone usage | Brent Burns, Jesper Bratt | split `nst_gamelog_*_counts_oi` | `sum(oz_starts) / sum(oz_starts + dz_starts) * 100` with ratio-of-aggregates semantics | `MATCH` across all compared ready rows | none |
| Territorial | Brent Burns, Jesper Bratt | split `nst_gamelog_*_counts_oi` | `sum(cf) / sum(cf + ca) * 100` and `sum(ff) / sum(ff + fa) * 100` with additive companions | `MATCH` across all compared ready rows | none |
| Historical baselines | Brent Burns, Jesper Bratt | same additive, ratio, TOI, and on-ice source rows used by the historical accumulators in `rollingHistoricalAverages.ts` | historical scope reconstruction uses season / `3ya` / career aggregate components and then applies the family formula | `MISMATCH` only for a narrow weighted-rate historical subset; all other historical fields matched | `stale target` |

## Detailed Reconstruction Evidence by Family

### Availability and Participation

Primary validation cases:

- Corey Perry for traded / missed-games semantics
- Brent Burns and Jesper Bratt for ready full-row parity

Source rows used:

- `games`
- `wgo_skater_stats`
- split-strength TOI-qualified appearance rows derived through the rolling pipeline

Intended formulas:

- availability:
  - `games_played / team_games_available`
- participation:
  - `participation_games / team_games_available`

Stored vs reconstructed evidence:

- family reconstruction script:
  - Burns availability: `MATCH`
  - Burns participation: `MATCH`
  - Bratt availability: `MATCH`
  - Bratt participation: `MATCH`
- disputed metrics script:
  - Perry `gp_pct_avg_season` replacement fields: `PASS`
  - Perry `gp_pct_total_all`: `PASS`
  - Perry rolling GP replacement fields: `PASS`
  - Perry `gp_pct_avg_3ya`: `PASS`
  - Perry `gp_pct_avg_career`: `PASS`

Representative stored-versus-reconstructed result:

- Perry GP replacement validation:
  - compared rows: `51`
  - compared fields per explicit GP check: `204` for season / `3ya` / career replacement groups
  - mismatches: `0`

Mismatch cause bucket:

- none

### TOI and Weighted `/60`

Primary validation cases:

- Brent Burns as the TOI / fallback anchor
- Jesper Bratt as the ready secondary control

Source rows used:

- split `nst_gamelog_*_counts`
- split `nst_gamelog_*_counts_oi`
- split `nst_gamelog_*_rates`
- WGO fallback TOI seed and normalization path

Intended formula:

- TOI:
  - `sum(resolved_toi_seconds)`
- weighted `/60`:
  - `sum(raw_event_total) / sum(resolved_toi_seconds) * 3600`

Stored vs reconstructed evidence:

- family reconstruction script:
  - Burns TOI: `MATCH`
  - Burns weighted `/60`: `MATCH`
  - Bratt TOI: `MATCH`
  - Bratt weighted `/60`: `MATCH`
- disputed metrics script:
  - `ixg_per_60`: `PASS`
    - Burns: `244` rows, `6588` field comparisons, `0` mismatches
    - Bratt: `248` rows, `6696` field comparisons, `0` mismatches

Representative stored-versus-reconstructed result:

- `ixg_per_60`
  - stored values matched recomputed values across all inspected rows and strength states for Burns and Bratt

Mismatch cause bucket:

- none for active rolling and explicit disputed weighted-rate scopes

### Additive Counts and Opportunity Companions

Primary validation cases:

- Brent Burns
- Jesper Bratt

Source rows used:

- split `nst_gamelog_*_counts`
- selective WGO additive fallback where the source-selection contract allows it
- split `nst_gamelog_*_counts_oi` for opportunity-denominator companions

Intended formulas:

- additive totals:
  - `sum(raw_event_total)`
- additive averages:
  - `sum(raw_event_total) / appearances_in_scope`

Stored vs reconstructed evidence:

- Burns additive counts: `MATCH`
- Burns opportunity counts: `MATCH`
- Bratt additive counts: `MATCH`
- Bratt opportunity counts: `MATCH`

Representative stored-versus-reconstructed result:

- the family reconstruction script reported `0` mismatches for all additive and opportunity fields across:
  - Burns: `244` compared rows
  - Bratt: `248` compared rows

Mismatch cause bucket:

- none

### Finishing, On-Ice, Zone, and Territorial Ratios

Primary validation cases:

- Brent Burns
- Jesper Bratt

Source rows used:

- split `nst_gamelog_*_counts`
- split `nst_gamelog_*_counts_oi`
- `powerPlayCombinations` only for PP-share-specific ratio work
- WGO fallback where the ratio contract allows all-strength fallback

Intended formulas:

- `shooting_pct`:
  - `sum(goals) / sum(shots) * 100`
- `expected_sh_pct`:
  - `sum(ixg) / sum(shots)`
- `primary_points_pct`:
  - `sum(goals + first_assists) / sum(total_points)`
- `ipp`:
  - `sum(player_points) / sum(on_ice_goals_for) * 100`
- `on_ice_sh_pct`:
  - `sum(oi_gf) / sum(oi_sf) * 100`
- `oz_start_pct`:
  - `sum(oz_starts) / sum(oz_starts + dz_starts) * 100`
- `cf_pct`:
  - `sum(cf) / sum(cf + ca) * 100`
- `ff_pct`:
  - `sum(ff) / sum(ff + fa) * 100`

Stored vs reconstructed evidence:

- family reconstruction script:
  - finishing ratios: `MATCH`
  - on-ice context: `MATCH`
  - zone usage: `MATCH`
  - territorial: `MATCH`
- disputed metrics script:
  - `shooting_pct_total_lastN`: `PASS`
  - `primary_points_pct_total_lastN`: `PASS`
  - `expected_sh_pct_total_lastN`: `PASS`
  - `ipp_total_lastN`: `PASS`

Representative stored-versus-reconstructed result:

- disputed `lastN` ratio checks:
  - Burns: `488` field comparisons per ratio group, `0` mismatches
  - Bratt: `496` field comparisons per ratio group, `0` mismatches

Mismatch cause bucket:

- none

### Power-Play Share

Primary validation case:

- Jesper Bratt

Source rows used:

- `powerPlayCombinations`
- `wgo_skater_stats` PP-share fallback fields where the PP-share contract allows fallback

Intended formula:

- `pp_share_pct = sum(player_pp_toi) / sum(team_pp_toi_inferred_from_share)`

Stored vs reconstructed evidence:

- disputed metrics script:
  - `pp_share_pct_total_lastN`: `PASS`
  - compared rows: `124`
  - compared fields: `1984`
  - mismatches: `0`

Representative stored-versus-reconstructed result:

- the stored `pp_share_pct` window outputs and their support-field companions matched the recomputed PP-share values for the ready heavy-PP validation case

Mismatch cause bucket:

- none

### Historical Baselines

Primary validation cases:

- Brent Burns
- Jesper Bratt

Source rows used:

- the same additive, ratio, and TOI source rows used by `rollingHistoricalAverages.ts`
- season, `3ya`, and career accumulation scopes derived from the live row history

Intended formula:

- additive historical fields:
  - aggregate source totals or averages across season / `3ya` / career scope
- ratio historical fields:
  - ratio of aggregated historical components
- weighted-rate historical fields:
  - `sum(raw_event_total) / sum(toi_seconds) * 3600`

Stored vs reconstructed evidence:

- family reconstruction script:
  - Burns historical baselines: `MISMATCH`
    - compared rows: `244`
    - compared fields: `30744`
    - mismatch count: `10`
  - Bratt historical baselines: `MISMATCH`
    - compared rows: `248`
    - compared fields: `31248`
    - mismatch count: `10`

Observed mismatch sample for Burns:

- `2025-10-07|all:goals_per_60_avg_season`
  - stored: `null`
  - reconstructed: `0`
- `2025-10-07|all:goals_per_60_avg_3ya`
  - stored: `null`
  - reconstructed: `0`
- `2025-10-07|all:goals_per_60_avg_career`
  - stored: `null`
  - reconstructed: `0`
- `2025-10-07|all:assists_per_60_avg_season`
  - stored: `null`
  - reconstructed: `0`
- `2025-10-07|all:primary_assists_per_60_avg_season`
  - stored: `null`
  - reconstructed: `0`

Observed mismatch sample for Bratt:

- `2025-10-09|all:goals_per_60_avg_season`
  - stored: `null`
  - reconstructed: `3.287671`
- `2025-10-09|all:goals_per_60_avg_3ya`
  - stored: `null`
  - reconstructed: `3.287671`
- `2025-10-09|all:goals_per_60_avg_career`
  - stored: `null`
  - reconstructed: `3.287671`
- `2025-10-09|all:assists_per_60_avg_season`
  - stored: `null`
  - reconstructed: `3.287671`
- `2025-10-09|all:primary_assists_per_60_avg_3ya`
  - stored: `null`
  - reconstructed: `3.287671`

Interpretation:

- the mismatch is narrow
- it is limited to a historical weighted-rate subset on the earliest stored row for the ready players
- the recomputed values are populated and internally consistent, while the stored target row still holds `null`
- because the March 12 direct rolling recompute attempts failed in the final upsert phase, the current best pass-2 classification is `stale target`, not `logic defect`

Mismatch cause bucket:

- `stale target`

## Highest-Risk Individual Field Evidence

### `gp_pct_avg_season` replacement fields

- player:
  - Corey Perry
- source rows used:
  - `games`
  - `wgo_skater_stats`
- intended formula:
  - current replacement availability fields derived from `games_played / team_games_available`
- stored value:
  - matched all `51` compared rows in the explicit Perry validation set
- reconstructed value:
  - matched all `51` compared rows in the explicit Perry validation set
- result:
  - `PASS`
- mismatch cause bucket:
  - none

### `pp_share_pct_total_lastN`

- player:
  - Jesper Bratt
- source rows used:
  - `powerPlayCombinations`
  - WGO PP fallback fields when applicable
- intended formula:
  - `sum(player_pp_toi) / sum(team_pp_toi_inferred_from_share)`
- stored value:
  - matched all `124` compared rows and `1984` compared fields in the explicit PP-share validation set
- reconstructed value:
  - matched all `124` compared rows and `1984` compared fields in the explicit PP-share validation set
- result:
  - `PASS`
- mismatch cause bucket:
  - none

### `ixg_per_60`

- players:
  - Brent Burns
  - Jesper Bratt
- source rows used:
  - split `nst_gamelog_*_counts`
  - split `nst_gamelog_*_rates`
  - resolved TOI from the TOI contract
- intended formula:
  - `sum(ixg) / sum(toi_seconds) * 3600`
- stored value:
  - matched all inspected rows and fields in the explicit weighted-rate validation set
- reconstructed value:
  - matched all inspected rows and fields in the explicit weighted-rate validation set
- result:
  - `PASS`
- mismatch cause bucket:
  - none

### Historical weighted-rate legacy fields

Fields with live mismatch evidence:

- `goals_per_60_avg_season`
- `goals_per_60_avg_3ya`
- `goals_per_60_avg_career`
- `assists_per_60_avg_season`
- `assists_per_60_avg_3ya`
- `assists_per_60_avg_career`
- `primary_assists_per_60_avg_season`
- `primary_assists_per_60_avg_3ya`
- `primary_assists_per_60_avg_career`
- `secondary_assists_per_60_avg_season`

Source rows used:

- historical accumulators built from split counts and resolved TOI

Intended formula:

- `sum(raw_event_total) / sum(toi_seconds) * 3600`

Stored value:

- representative stored values on the earliest compared ready rows were `null`

Reconstructed value:

- representative recomputed values were non-null:
  - Burns examples: `0`
  - Bratt examples: `3.287671`

Result:

- `MISMATCH`

Mismatch cause bucket:

- `stale target`

## Blocked Comparison Cases

### Corey Perry PK-sensitive validation

Blocked scope:

- PK-sensitive arithmetic validation

Source rows used:

- PK source tables remained incomplete at the player level even after the narrow March 12 refresh

Stored value:

- not used for final signoff in the blocked PK scope

Reconstructed value:

- not trusted for final signoff in the blocked PK scope

Mismatch cause bucket:

- `unresolved verification blocker`

Reason:

- the narrow PK refresh succeeded at the table level, but Perry still had no player-level PK rows past `2026-03-08`

### Seth Jones PK-tail proxy

Blocked scope:

- PK-sensitive disputed-metric validation

Source rows used:

- PK NST source tails still stopped at `2025-12-30` while WGO extended to `2026-01-02`

Stored value:

- not used for final signoff in the blocked PK scope

Reconstructed value:

- not trusted for final signoff in the blocked PK scope

Mismatch cause bucket:

- `stale source`

Reason:

- the disputed metrics script explicitly retained Jones as the freshness-blocked proxy

## Conclusion

Task `3.3` evidence status:

- all ready major metric families matched stored-versus-recomputed outputs except for a narrow historical weighted-rate legacy subset
- the highest-risk individually disputed active fields passed:
  - GP replacement fields
  - `pp_share_pct_total_lastN`
  - `ixg_per_60`
  - disputed ratio `lastN` fields
- the current live mismatch evidence is concentrated in historical weighted-rate legacy fields where stored target rows remain `null` but recomputed values are present
- the best current cause bucket for those historical mismatches is `stale target`
- PK-sensitive comparisons remain blocked where source freshness is still incomplete
