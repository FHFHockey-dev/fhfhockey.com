# Rolling Player Metrics Audit Pass 2

This is the consolidated main audit artifact for pass 2. It organizes the completed family audits, live reconstruction evidence, freshness/runbook work, schema review, and `trendsDebug.tsx` implementation into the PRD-required section order.

Primary supporting artifacts:

- [rolling-player-game-metrics-pass-2-field-inventory.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-game-metrics-pass-2-field-inventory.md)
- [rolling-player-game-metrics-pass-2-family-grouping.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-game-metrics-pass-2-family-grouping.md)
- [rolling-player-pass-2-additive-family-audit.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-additive-family-audit.md)
- [rolling-player-pass-2-ratio-family-audit.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-ratio-family-audit.md)
- [rolling-player-pass-2-weighted-rate-family-audit.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-weighted-rate-family-audit.md)
- [rolling-player-pass-2-availability-participation-audit.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-availability-participation-audit.md)
- [rolling-player-pass-2-contextual-fields-audit.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-contextual-fields-audit.md)
- [rolling-player-pass-2-reconstruction-evidence-2026-03-12.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-reconstruction-evidence-2026-03-12.md)
- [rolling-player-pass-2-diagnostics-classification-2026-03-12.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-diagnostics-classification-2026-03-12.md)
- [rolling-player-pass-2-refresh-dependency-map.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-refresh-dependency-map.md)
- [rolling-player-pass-2-schema-change-recommendations.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-schema-change-recommendations.md)
- [rolling-player-pass-2-suggested-metric-additions-review.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-suggested-metric-additions-review.md)
- [rpm-audit-notes-pass-2.md](/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-notes-pass-2.md)
- [rpm-audit-action-items-pass-2.md](/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-action-items-pass-2.md)

## Upstream Tables

| Table | Contribution | Role | Dependent families | Freshness / refresh notes |
| --- | --- | --- | --- | --- |
| `players` | player identity and validation selector universe | authoritative | all families indirectly; debug selectors directly | refresh player ingest before validation slices drift |
| `games` | game chronology, team-game ledger, `game_id` authority | authoritative | availability / participation, row identity, current-team windows | stale `games` invalidates denominators and unknown-game checks |
| `lineCombinations` | `line_combo_slot`, `line_combo_group` | contextual derived | line / role context | refresh via line-combination routes before line validation |
| `powerPlayCombinations` | `PPTOI`, `unit`, `pp_share_of_team`, PP unit-relative context | contextual derived plus PP-share denominator authority | PP share, PP unit, PP context | refresh via PP builder route before PP-share or PP-unit validation |
| `wgo_skater_stats` | row spine, WGO fallback counts, WGO PP share inputs, WGO TOI seed | authoritative spine plus fallback | all families | every rolling row starts here |
| `nst_gamelog_as_counts` | all-strength additive counts | authoritative | additive, weighted-rate numerators, finishing, expected / chance | refresh through NST gamelog route |
| `nst_gamelog_as_rates` | all-strength supplementary rates and TOI fallback | fallback / supplementary | weighted-rate, TOI fallback | required for fallback-heavy TOI cases |
| `nst_gamelog_as_counts_oi` | all-strength on-ice and territorial counts | authoritative | on-ice, territorial, PDO, zone starts, TOI secondary authority | required for on-ice validation |
| `nst_gamelog_es_counts` | EV additive counts | authoritative | EV additive, EV finishing, EV expected / chance | required for EV validation |
| `nst_gamelog_es_rates` | EV supplementary rates and TOI fallback | fallback / supplementary | EV weighted-rate, EV TOI fallback | required when EV counts TOI is missing |
| `nst_gamelog_es_counts_oi` | EV on-ice and territorial counts | authoritative | EV on-ice, EV territorial, EV PDO, EV zone starts | required for EV on-ice validation |
| `nst_gamelog_pp_counts` | PP additive counts | authoritative | PP additive, PP finishing, PP expected / chance | required for PP arithmetic validation |
| `nst_gamelog_pp_rates` | PP supplementary rates and TOI fallback | fallback / supplementary | PP weighted-rate, PP TOI fallback | required for PP fallback-heavy cases |
| `nst_gamelog_pp_counts_oi` | PP on-ice counts | authoritative | PP on-ice, PP territorial, PP PDO | required for PP on-ice validation |
| `nst_gamelog_pk_counts` | PK additive counts | authoritative | PK additive, PK finishing, PK expected / chance | still stale for Perry/Jones PK scopes on March 12 |
| `nst_gamelog_pk_rates` | PK supplementary rates and TOI fallback | fallback / supplementary | PK weighted-rate, PK TOI fallback | still stale for Perry/Jones PK scopes on March 12 |
| `nst_gamelog_pk_counts_oi` | PK on-ice counts | authoritative | PK on-ice, PK territorial, PK PDO | still stale for Perry/Jones PK scopes on March 12 |
| `rolling_player_game_metrics` | stored target surface and downstream read contract | derived target | all persisted outputs | stale target rows are blockers, not evidence |

## Metric Families

The pass-2 audit groups the stored surface into these logical families:

- availability / participation
- TOI
- surface counting stats
- weighted `/60` rates
- finishing / shooting
- expected / chance metrics
- on-ice context
- territorial / possession
- power-play usage
- PP role / PP unit context
- line / role context
- historical baseline columns
- diagnostic support / numerator-denominator support columns
- freshness / trust / fallback support exposed through persisted context or validation payload data

Primary family references:

- [rolling-player-game-metrics-pass-2-family-grouping.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-game-metrics-pass-2-family-grouping.md)
- [rolling-player-pass-2-helper-contract-map.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-helper-contract-map.md)

## Column-by-Column Inventory

Inventory source of truth:

- [rolling-player-game-metrics-pass-2-field-inventory.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-game-metrics-pass-2-field-inventory.md)

Current row-surface totals:

- total row fields: `942`
- row spine, counters, context labels, timestamps: `17`
- legacy additive surfaces: `286`
- legacy ratio snapshot surfaces: `143`
- legacy GP compatibility surfaces: `13`
- legacy weighted-rate surfaces: `104`
- canonical ratio aliases: `88`
- canonical weighted-rate aliases: `64`
- canonical availability / participation surfaces: `35`
- persisted support columns: `192`

Inventory groups:

- row spine and context:
  - `player_id`, `team_id`, `game_id`, `game_date`, `season`, `strength_state`, `games_played`, `team_games_played`, `gp_semantic_type`, `line_combo_slot`, `line_combo_group`, `pp_unit`, `pp_share_of_team`, `pp_unit_usage_index`, `pp_unit_relative_toi`, `pp_vs_unit_avg`, `updated_at`
- additive grids:
  - `22` additive families across the legacy `total` / `avg` scope grid
- ratio grids:
  - `11` ratio families across legacy and canonical scope grids
- weighted-rate grids:
  - `8` weighted-rate families across legacy and canonical scope grids
- availability / participation:
  - explicit season, `3ya`, career, and `lastN team games` counters and percentage fields
- support surfaces:
  - ratio numerators / denominators, weighted-rate numerators / TOI denominators, and PP-share component fields

## WORKING

- ✅ `availability / participation replacement fields` - `games_played / team_games_available` - live parity held on Burns, Bratt, and Perry validation rows
- ✅ `ready-row additive families` - `sum(resolved_event)` - Burns and Bratt ready rows matched
- ✅ `ready-row ratio families` - `sum(numerator) / sum(denominator)` - ready finishing, on-ice, territorial, zone-start, and PP-share rows matched
- ✅ `ready-row weighted-rate families` - `sum(raw_events) / sum(resolved_toi_seconds) * 3600` - Burns and Bratt ready rows matched
- ✅ `context labels` - `builder-derived PP / line assignment lookup` - Bratt PP-unit and Seth Jones line-context labels matched

## BROKEN

- ❌ `historical weighted-rate legacy alias refreshability` - `sum(raw_events) / sum(resolved_toi_seconds) * 3600` - stored historical subset remains stale while targeted upserts fail

## ALMOST

- 🔧 `pp_share_pct mixed-source window confidence` - `sum(player_pp_toi) / sum(team_pp_toi_inferred_from_share)` - arithmetic matches but provenance tracing is still weak
- 🔧 `on_ice_sv_pct and pdo support-column parity` - `sum(oi_sa - oi_ga) / sum(oi_sa) * 100` - reconstruction works but dedicated support traces are thin
- 🔧 `legacy ratio and weighted-rate alias families` - `same canonical family formula on duplicate alias surfaces` - compatibility aliases still create naming drag

## NEEDS REVIEW

- ⚠️ `PK-sensitive families for Corey Perry` - `family-specific additive, ratio, and weighted-rate formulas` - blocked by stale PK source tails after March 8, 2026
- ⚠️ `PK-sensitive families for Seth Jones` - `family-specific additive, ratio, and weighted-rate formulas` - blocked by stale PK source tails on March 12, 2026
- ⚠️ `ratio support completeness for primary_points_pct, ipp, pdo, and pp_share_pct` - `stored ratio value plus support columns` - support fields still show `partial` or `valuePresentWithoutComponents`

## Explanation / Rationale

The strongest current evidence says the rolling pipeline is not broadly arithmetically broken. Fresh, ready rows reconstructed cleanly across additive, ratio, weighted-rate, availability, PP context, and line-context families. The largest remaining pass-2 risks are operational and semantic:

- targeted recomputes still fail during `rolling_player_game_metrics` upsert, so stale target rows can survive even after source refreshes succeed
- ratio, weighted-rate, and GP compatibility aliases still create semantic drag because the old field names imply distinctions that are no longer real
- support-column parity and source-provenance visibility remain uneven, especially for PP mixed-source windows, TOI trust, and some ratio-support groups

The pass-2 posture is therefore:

- treat ready-scope arithmetic as mostly sound
- treat freshness and target-write health as mandatory preconditions
- route most follow-up work into observability, compatibility cleanup, and targeted schema/payload improvements rather than another formula redesign sweep

## Live Validation Examples

Representative validation snapshot basis:

- live Supabase-backed validation snapshot run on `2026-03-12T15:18:52.881Z`

Supporting evidence:

- [rolling-player-pass-2-reconstruction-evidence-2026-03-12.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-reconstruction-evidence-2026-03-12.md)
- [rolling-player-pass-2-diagnostics-classification-2026-03-12.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-diagnostics-classification-2026-03-12.md)
- [rolling-player-pass-2-refresh-execution-2026-03-12.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-refresh-execution-2026-03-12.md)

### Example 1: Brent Burns healthy full-season control

- player: `Brent Burns` (`8470613`)
- archetype: healthy full-season skater
- target row: `2026-03-10 | all | game_id 2025021023`
- source rows used:
  - `wgo_skater_stats`: `61`
  - `nst_gamelog_as_counts`: `63`
  - `nst_gamelog_as_rates`: `63`
  - `nst_gamelog_as_counts_oi`: `63`
  - `powerPlayCombinations`: `52`
  - `lineCombinations`: `122`
- intended formulas:
  - `goals_total_last20 = sum(goals over the player’s last 20 all-strength appearances)`
  - `on_ice_sh_pct_last20 = sum(oi_gf) / sum(oi_sf) * 100`
- actual code path:
  - [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)
  - [rollingPlayerSourceSelection.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerSourceSelection.ts)
  - [rollingMetricAggregation.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricAggregation.ts)
- stored values:
  - `goals_total_last20 = 4`
  - `on_ice_sh_pct_last20 = 9.836066`
- reconstructed values:
  - `goals_total_last20 = 4`
  - `on_ice_sh_pct_last20 = 9.836066`
- whether they match: `MATCH`
- mismatch cause bucket: none

### Example 2: Brent Burns TOI / fallback validation

- player: `Brent Burns` (`8470613`)
- archetype: TOI / fallback validation skater
- target row: `2026-03-10 | all | game_id 2025021023`
- source rows used:
  - `wgo_skater_stats`: `61`
  - `nst_gamelog_as_counts`: `63`
  - `nst_gamelog_as_rates`: `63`
  - `nst_gamelog_as_counts_oi`: `63`
- intended formulas:
  - `toi_seconds_total_last20 = sum(resolved_toi_seconds)`
  - `ixg_per_60_last20 = sum(ixg) / sum(toi_seconds) * 3600`
- actual code path:
  - [rollingPlayerToiContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerToiContract.ts)
  - [rollingPlayerMetricMath.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerMetricMath.ts)
- stored values:
  - `toi_seconds_total_last20 = 22955`
  - `ixg_per_60_last20 = 0.197604`
- reconstructed values:
  - `toi_seconds_total_last20 = 22955`
  - `ixg_per_60_last20 = 0.197604`
- whether they match: `MATCH`
- mismatch cause bucket: none

### Example 3: Corey Perry missed-games denominator validation

- player: `Corey Perry` (`8470621`)
- archetype: injured / missed-games skater
- target row: `2026-03-10 | all | game_id 2025021015`
- source rows used:
  - `games`
  - `wgo_skater_stats`: `51`
  - `nst_gamelog_as_counts`: `53`
  - `nst_gamelog_as_rates`: `53`
  - `nst_gamelog_as_counts_oi`: `53`
- intended formula:
  - `availability_pct_last20_team_games = games_played_last20_team_games / team_games_available_last20`
- actual code path:
  - [rollingPlayerAvailabilityContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerAvailabilityContract.ts)
  - [rollingWindowContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingWindowContract.ts)
- stored values:
  - `games_played_last20_team_games = 3`
  - `team_games_available_last20 = 20`
  - `availability_pct_last20_team_games = 0.15`
- reconstructed values:
  - `games_played_last20_team_games = 3`
  - `team_games_available_last20 = 20`
  - `availability_pct_last20_team_games = 0.15`
- whether they match: `MATCH`
- mismatch cause bucket: none

### Example 4: Corey Perry traded-player season availability validation

- player: `Corey Perry` (`8470621`)
- archetype: traded or multi-team skater
- target row: `2026-03-10 | all | game_id 2025021015`
- source rows used:
  - `games`
  - `wgo_skater_stats`: `51`
  - player season ledger across team stints
- intended formulas:
  - `season_availability_pct = season_games_played / season_team_games_available`
  - compatibility check: `gp_pct_total_all = games_played / team_games_played`
- actual code path:
  - [rollingHistoricalAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingHistoricalAverages.ts)
  - [rollingPlayerAvailabilityContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerAvailabilityContract.ts)
- stored values:
  - `season_games_played = 51`
  - `season_team_games_available = 138`
  - `season_availability_pct = 0.369565`
  - `gp_pct_total_all = 0.369565`
- reconstructed values:
  - `season_games_played = 51`
  - `season_team_games_available = 138`
  - `season_availability_pct = 0.369565`
  - `gp_pct_total_all = 0.369565`
- whether they match: `MATCH`
- mismatch cause bucket: none

### Example 5: Jesper Bratt heavy-PP PP-share validation

- player: `Jesper Bratt` (`8479407`)
- archetype: heavy-PP skater
- target row: `2026-03-08 | pp | game_id 2025021005`
- source rows used:
  - `wgo_skater_stats`: `62`
  - `nst_gamelog_pp_counts`: `62`
  - `nst_gamelog_pp_rates`: `62`
  - `nst_gamelog_pp_counts_oi`: `62`
  - `powerPlayCombinations`: `60`
- intended formula:
  - `pp_share_pct_last20 = sum(player_pp_toi) / sum(team_pp_toi_inferred_from_share)`
- actual code path:
  - [rollingPlayerPpShareContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPpShareContract.ts)
  - [rollingPlayerPpUnitContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPpUnitContract.ts)
- stored values:
  - `pp_share_pct_last20 = 0.695275`
  - `pp_share_pct_player_pp_toi_last20 = 3488`
  - `pp_share_pct_team_pp_toi_last20 = 5016.722496`
  - `pp_unit = 1`
- reconstructed values:
  - `pp_share_pct_last20 = 0.695275`
  - `pp_share_pct_player_pp_toi_last20 = 3488`
  - `pp_share_pct_team_pp_toi_last20 = 5016.722496`
  - `pp_unit = 1`
- whether they match: `MATCH`
- mismatch cause bucket: none

### Example 6: Seth Jones line-context validation with blocked PK proxy

- player: `Seth Jones` (`8477495`)
- archetypes:
  - line-context validation skater
  - blocked-tail proxy
- target row: `2026-01-02 | all | game_id 2025020641`
- source rows used:
  - `wgo_skater_stats`: `40`
  - `lineCombinations`: `80`
- intended derivation:
  - `line_combo_group = "defense"`
  - `line_combo_slot = 3`
- actual code path:
  - [rollingPlayerLineContextContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerLineContextContract.ts)
- stored values:
  - `line_combo_slot = 3`
  - `line_combo_group = "defense"`
- reconstructed values:
  - `line_combo_slot = 3`
  - `line_combo_group = "defense"`
- whether they match: `MATCH`
- mismatch cause bucket: none for line context
- blocked companion state:
  - Seth Jones `pk` remains blocked with `countsTailLag = 1`, `ratesTailLag = 1`, and `countsOiTailLag = 1`
  - blocked mismatch cause bucket: `stale source`

## Actionable Findings Backlog

Running source of truth:

- [rpm-audit-action-items-pass-2.md](/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-action-items-pass-2.md)

This section is a summary only. The full running implementation backlog remains in the separate backlog file.

Highest-value grouped items pulled from that backlog:

### Correctness blockers

- `P0` fix the `rolling_player_game_metrics` upsert failure blocking targeted recomputes

### Accuracy / semantic improvements

- `P1` reduce ratio and weighted-rate alias ambiguity
- `P1` make legacy `gp_pct_*` semantic overload explicit in downstream and debug surfaces
- `P1` add explicit mixed-source PP-share window tracing

### Debug / observability improvements

- `P1` expose TOI trust traces for weighted-rate validation
- `P1` add `on_ice_sv_pct` support traces or payload-level reconstruction helpers
- `P1` expose ratio-support completeness warnings in the validation console
- `P1` move formulas, windows, and helper-contract metadata into the server validation payload
- `P1` add family-wide mismatch summaries instead of only one focused-metric diff

### Freshness / runbook improvements

- `P1` promote diagnostics snapshots to a first-class validation surface
- `P1` surface PP coverage cautions even when `ppTailLag = 0`

### Performance / efficiency improvements

- `P2` reduce validation-console overfetch and render weight

### Schema / compatibility follow-ups

- `P1` migrate the player trends page off legacy-only suffix selection
- `P2` stage a formal alias-freeze and later cleanup migration set

### Optional enhancements

- `P2` add additive `primary_assists` and `secondary_assists`
- `P2` add `penalties_drawn` and `penalties_drawn_per_60`
- `P2` add `pp_toi_seconds`

## Freshness and Recompute Runbook

Primary operational sources:

- [rolling-player-pass-2-refresh-dependency-map.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-refresh-dependency-map.md)
- [rolling-player-pass-2-refresh-execution-2026-03-12.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-refresh-execution-2026-03-12.md)
- [rolling-player-pass-2-diagnostics-classification-2026-03-12.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-diagnostics-classification-2026-03-12.md)

### Relevant refresh surfaces

| Surface | Table(s) | Route or command surface | Why it matters |
| --- | --- | --- | --- |
| Games | `games` | `/api/v1/db/update-games` | authoritative game ledger for availability windows and `game_id` validation |
| Players | `players`, `rosters` | `/api/v1/db/update-players` | player search universe and team scope |
| WGO row spine | `wgo_skater_stats` | `/api/v1/db/update-wgo-skaters` | row chronology, fallback counts, PP fallback, TOI seed |
| NST gamelog | `nst_gamelog_*` | `/api/v1/db/update-nst-gamelog` | authoritative additive, ratio, on-ice, and weighted-rate source rows |
| PP builder | `powerPlayCombinations` | `/api/v1/db/update-power-play-combinations/[gameId]` | PP-share denominator and PP context |
| Line builder | `lineCombinations` | `/api/v1/db/update-line-combinations/[id]`, index route | line-context label authority |
| Rolling target | `rolling_player_game_metrics` | `/api/v1/db/update-rolling-player-averages` | stored comparison target |

### Recommended refresh order

1. refresh `games` and `players` if denominator or identity drift is suspected
2. refresh `wgo_skater_stats` for the validation slice
3. refresh the relevant NST `counts`, `rates`, and `counts_oi` tables for the strength being validated
4. refresh `powerPlayCombinations` for PP-share or PP-unit validation
5. refresh `lineCombinations` for line-context validation
6. rerun `update-rolling-player-averages` or the local validation recompute helper
7. inspect diagnostics before trusting stored-versus-reconstructed comparisons

### Metric-family-specific prerequisites

- availability / participation:
  - fresh `games`
  - fresh WGO row spine
  - refreshed rolling target row
- additive:
  - fresh WGO spine
  - fresh split NST counts
  - refreshed rolling target row
- ratio:
  - fresh split NST counts
  - fresh split NST on-ice counts when the family depends on on-ice rows
  - refreshed rolling target row
- weighted `/60`:
  - fresh counts, counts-on-ice, and rates
  - healthy TOI precedence chain
  - refreshed rolling target row
- PP share / PP context:
  - fresh PP builder rows
  - fresh WGO PP fallback context
  - fresh PP NST tables when validating PP arithmetic beyond pure share
- line context:
  - fresh line builder rows

### Stale-tail and blocker rules

- `countsTailLag > 0` blocks count-driven families for that strength
- `ratesTailLag > 0` blocks TOI fallback and rate-reconstruction confidence
- `countsOiTailLag > 0` blocks on-ice, territorial, zone-start, and PDO families
- `ppTailLag > 0` blocks PP-share and PP-unit validation
- `lineTailLag > 0` blocks line-context validation
- `unknownGameIds > 0` blocks trust in row identity and game-ledger reconstruction
- target-write failure blocks trust in any comparison that requires a newly refreshed stored row

March 12 blocker state:

- Corey Perry `pk`:
  - `countsTailLag = 1`
  - `ratesTailLag = 1`
  - `countsOiTailLag = 1`
- Seth Jones `pk`:
  - `countsTailLag = 1`
  - `ratesTailLag = 1`
  - `countsOiTailLag = 1`
- Burns and Bratt retained ready scopes:
  - all relevant tail lags were `0`

### Freshness diagnostics that must be checked

- `summarizeCoverage(...)`
- `summarizeSourceTailFreshness(...)`
- `summarizeDerivedWindowDiagnostics(...)`
- `summarizeSuspiciousOutputs(...)`

March 12 live interpretation:

- `suspiciousIssueCount = 0` across retained ready players
- GP windows were coherent
- ratio support completeness remained weaker than GP support, especially for `primary_points_pct`, `ipp`, and `pdo`
- targeted PK refreshes improved source coverage but did not clear Perry/Jones PK blockers
- targeted rolling recomputes still failed on final upsert

### `trendsDebug.tsx` freshness requirements

The debug console must show:

- latest source dates for counts, rates, and counts-on-ice
- latest PP builder and line builder coverage for the selected player / row
- latest stored rolling-row date
- blocker counts for `countsTailLag`, `ratesTailLag`, `countsOiTailLag`, `ppTailLag`, and `lineTailLag`
- coverage cautions such as missing PP rows, missing PP-share rows, missing split dates, and unknown game ids
- a visible readiness label:
  - `READY`
  - `READY WITH CAUTIONS`
  - `BLOCKED`
- the next required refresh action for the selected family

## trendsDebug.tsx Optimization Plan

Pass-2 implementation has already turned `trendsDebug.tsx` into a validation-first surface with:

- the read-only validation payload route
- player, strength, season, team, date-range, row, family, and metric selectors
- readiness and freshness summaries
- stored-versus-recomputed comparison panels
- source-input, rolling-window, support-field, TOI-trust, PP-context, line-context, and diagnostics panels
- copy helpers for formula-ledger entries, comparison blocks, and refresh prerequisites

Remaining optimization work:

- push formula metadata, helper-contract summaries, and server-authoritative window membership into the validation payload so the browser stops deriving them heuristically
- add family-wide mismatch summaries and row-level diff matrices for faster audit sweeps
- reduce payload weight and consider moving the legacy sustainability sandbox to a secondary tab or route once the validation-console workflow is fully stable

Implementation references:

- [rolling-player-pass-2-trendsdebug-current-surface-audit.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-trendsdebug-current-surface-audit.md)
- [rolling-player-pass-2-trendsdebug-validation-payload-design.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-trendsdebug-validation-payload-design.md)
- [rolling-player-pass-2-trendsdebug-server-path.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-trendsdebug-server-path.md)
- [rolling-player-pass-2-trendsdebug-validation-panels.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-trendsdebug-validation-panels.md)
- [rolling-player-pass-2-trendsdebug-gap-backlog.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-trendsdebug-gap-backlog.md)

## Schema Change Recommendations

Current schema posture:

- keep the current storage model
- treat canonical ratio aliases, canonical weighted-rate aliases, and explicit availability / participation replacement fields as authoritative
- keep additive and TOI `avg` / `total` surfaces as authoritative because they still encode distinct meanings
- freeze ratio, weighted-rate, and GP compatibility aliases for compatibility only
- prefer validation-payload expansion over new debug-only row columns
- reserve future schema additions for narrow support-parity gaps only

Primary supporting artifacts:

- [rolling-player-pass-2-authoritative-field-classification.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-authoritative-field-classification.md)
- [rolling-player-pass-2-gp-compatibility-role-review.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-gp-compatibility-role-review.md)
- [rolling-player-pass-2-trust-debug-support-decision-matrix.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-trust-debug-support-decision-matrix.md)
- [rolling-player-pass-2-schema-change-recommendations.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-schema-change-recommendations.md)

## Suggested Metric Additions

Only additions derivable from existing sources remain in scope:

- `primary_assists`
  - source tables: NST counts tables via `first_assists`
  - formula: `sum(first_assists)`
  - why it helps: additive parity under `primary_assists_per_60`
  - splits: `all`, `ev`, `pp`, `pk`
  - `trendsDebug.tsx`: yes
- `secondary_assists`
  - source tables: NST counts tables via `second_assists`
  - formula: `sum(second_assists)`
  - why it helps: additive parity under `secondary_assists_per_60`
  - splits: `all`, `ev`, `pp`, `pk`
  - `trendsDebug.tsx`: yes
- `penalties_drawn`
  - source tables: NST counts tables via `penalties_drawn`
  - formula: `sum(penalties_drawn)`
  - why it helps: discipline / opportunity-creation context
  - splits: `all`, `ev`, `pp`, `pk`
  - `trendsDebug.tsx`: yes
- `penalties_drawn_per_60`
  - source tables: NST counts tables plus resolved TOI
  - formula: `sum(penalties_drawn) / sum(toi_seconds) * 3600`
  - why it helps: deployment-adjusted discipline signal
  - splits: `all`, `ev`, `pp`, `pk`
  - `trendsDebug.tsx`: yes
- `pp_toi_seconds`
  - source tables: `powerPlayCombinations.PPTOI` with WGO `pp_toi` as fallback-only context
  - formula: `sum(player_pp_toi_seconds)`
  - why it helps: direct PP deployment validation without back-solving from share
  - splits: `all`, `pp`
  - `trendsDebug.tsx`: yes

Supporting artifact:

- [rolling-player-pass-2-suggested-metric-additions-review.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-suggested-metric-additions-review.md)

## Remediation Plan

Implementation order after the audit:

1. correctness blockers
   - fix the targeted `rolling_player_game_metrics` upsert failure
   - restore reliable post-refresh target recomputes
2. debug-surface and observability work
   - push formula, window, contract, and provenance metadata into the server validation payload
   - add family-wide mismatch summaries and clearer support-completeness visibility
3. freshness and runbook work
   - promote diagnostics snapshots and PP coverage cautions into repeatable validation surfaces
4. schema and compatibility follow-up
   - migrate downstream readers toward canonical ratio / weighted-rate / availability surfaces
   - freeze compatibility-only aliases and prepare later cleanup sequencing
5. optional enhancements
   - sequence additive assist decomposition, penalties-drawn families, and `pp_toi_seconds` after the higher-priority audit backlog is burned down

The implementation backlog in [rpm-audit-action-items-pass-2.md](/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-action-items-pass-2.md) is the source for post-audit sequencing. Pass 2 leaves behind both:

- a validation ledger in [rpm-audit-notes-pass-2.md](/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-notes-pass-2.md)
- an implementation backlog in [rpm-audit-action-items-pass-2.md](/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-action-items-pass-2.md)

This audit is not only descriptive. It continuously converted concrete findings into implementation-sequencing inputs, and the backlog file is the authoritative handoff surface for the next remediation phase.
