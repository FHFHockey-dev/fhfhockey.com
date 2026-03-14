# Rolling Player Metrics Post-Implementation Validation Checklist

## Purpose

This checklist converts the validation requirements in [prd-rolling-player-metrics-remediation-blueprint.md](/Users/tim/Code/fhfhockey.com/tasks/prd-rolling-player-metrics-remediation-blueprint.md) into an execution artifact for post-implementation live-data verification.

Authoritative sources:
- [prd-rolling-player-metrics-remediation-blueprint.md](/Users/tim/Code/fhfhockey.com/tasks/prd-rolling-player-metrics-remediation-blueprint.md)
- [rolling-player-metrics-audit-notes.md](/Users/tim/Code/fhfhockey.com/tasks/rolling-player-metrics-audit-notes.md)

Rule of use:
- every metric must be re-verified against live upstream data one by one
- stale or incomplete data is a workflow blocker, not a reason to skip verification
- do not mark a family complete until every field in that family has an explicit result

## Validation Evidence Record

Record this for every verification step:

- validation date
- code commit under validation
- migration state / schema state
- player ID
- season
- strength state
- metric or field family
- upstream freshness status
- target-row freshness status
- targeted refresh actions run
- source-derived value
- stored value
- result: `MATCH`, `MISMATCH`, `BLOCKED`
- mismatch bucket if applicable:
  - `source freshness issue`
  - `target freshness issue`
  - `logic issue`
  - `schema-contract issue`
  - `external blocker`

## Required Validation Player Set

Required baseline player set from the PRD:

- Brent Burns (`8470613`) as the healthy-control skater
- Corey Perry (`8470621`) as the missed-games and traded-player GP/availability case
- Jesper Bratt (`8479407`) as the heavy-PP-role case
- Seth Jones (`8477495`) as the partial / incomplete-source-tail proxy

Replacement rule:
- Seth Jones may be replaced only if a cleaner traded-player or incomplete-tail validation case is found
- the replacement player ID and reason must be documented before the checklist continues

## Freshness Gate Checklist

Complete this gate before every metric comparison:

- [ ] confirm the selected player has fresh WGO rows through the expected validation date range
- [ ] confirm the relevant NST source tables are fresh for the same range
- [ ] confirm `rolling_player_game_metrics` rows were recomputed after the logic under validation
- [ ] confirm `powerPlayCombinations` is fresh before validating `pp_share_pct` or `pp_unit`
- [ ] confirm `lineCombinations` is fresh before validating `line_combo_slot` or `line_combo_group`
- [ ] review rolling diagnostics for:
  - source-tail blockers
  - unknown game IDs
  - fallback-heavy metrics
  - suspicious outputs
- [ ] stop if any freshness blocker is unresolved

## Required Refresh Actions When Freshness Fails

Use the explicit refresh path for the stale layer, then re-check freshness before continuing.

Rolling target refresh:
- [ ] targeted rolling recompute for affected player/season:
  - `/api/v1/db/update-rolling-player-averages?playerId={playerId}&season={season}`

PP builder refresh:
- [ ] rerun per-game PP builder for affected validation games:
  - `/api/v1/db/update-power-play-combinations/{gameId}`

Line builder refresh:
- [ ] rerun per-game or batch line builder for affected validation games:
  - `/api/v1/db/update-line-combinations/{gameId}`
  - `/api/v1/db/update-line-combinations`

WGO/NST source refresh:
- [ ] run the upstream import/refresh path that repopulates the stale source table
- [ ] confirm the latest source date advanced before retrying rolling validation

Ambiguous freshness state:
- [ ] stop validation
- [ ] record the blocking table(s)
- [ ] add the missing refresh action to the validation runbook before proceeding

## Global Validation Workflow

Apply this sequence to every family and disputed metric:

1. [ ] check upstream freshness for the player and date range
2. [ ] run the refresh action if freshness is stale or incomplete
3. [ ] re-check freshness
4. [ ] run targeted rolling recompute for the player and season
5. [ ] confirm stored rows advanced to the expected current range
6. [ ] reconstruct the intended value from live upstream data
7. [ ] compare source-derived value vs fresh stored value
8. [ ] classify any mismatch
9. [ ] record evidence before moving to the next metric

## Metric Family Verification Matrix

### 1. Availability / Participation

All-strength availability:
- [ ] `games_played`
- [ ] `team_games_played`
- [ ] `season_availability_pct`
- [ ] `three_year_availability_pct`
- [ ] `career_availability_pct`
- [ ] `availability_pct_last3_team_games`
- [ ] `availability_pct_last5_team_games`
- [ ] `availability_pct_last10_team_games`
- [ ] `availability_pct_last20_team_games`
- [ ] `season_games_played`
- [ ] `season_team_games_available`
- [ ] `three_year_games_played`
- [ ] `three_year_team_games_available`
- [ ] `career_games_played`
- [ ] `career_team_games_available`
- [ ] `games_played_last3_team_games`
- [ ] `team_games_available_last3`
- [ ] `games_played_last5_team_games`
- [ ] `team_games_available_last5`
- [ ] `games_played_last10_team_games`
- [ ] `team_games_available_last10`
- [ ] `games_played_last20_team_games`
- [ ] `team_games_available_last20`

Split-strength participation:
- [ ] `season_participation_pct`
- [ ] `three_year_participation_pct`
- [ ] `career_participation_pct`
- [ ] `participation_pct_last3_team_games`
- [ ] `participation_pct_last5_team_games`
- [ ] `participation_pct_last10_team_games`
- [ ] `participation_pct_last20_team_games`
- [ ] `season_participation_games`
- [ ] `three_year_participation_games`
- [ ] `career_participation_games`
- [ ] `participation_games_last3_team_games`
- [ ] `participation_games_last5_team_games`
- [ ] `participation_games_last10_team_games`
- [ ] `participation_games_last20_team_games`

Compatibility aliases:
- [ ] verify retained legacy `gp_pct_*` behavior matches the documented compatibility contract for all-strength rows
- [ ] verify retained legacy `gp_pct_*` behavior matches the documented compatibility contract for EV/PP/PK participation rows

Required case coverage:
- [ ] Brent Burns healthy-control availability case
- [ ] Corey Perry traded-player season-availability case
- [ ] Corey Perry missed-games denominator case
- [ ] rolling current-team `last3/5/10/20` availability case
- [ ] EV participation case
- [ ] PP participation case
- [ ] PK participation case

### 2. TOI

- [ ] `toi_seconds_total_all`
- [ ] `toi_seconds_avg_all`
- [ ] `toi_seconds_total_last3`
- [ ] `toi_seconds_avg_last3`
- [ ] `toi_seconds_total_last5`
- [ ] `toi_seconds_avg_last5`
- [ ] `toi_seconds_total_last10`
- [ ] `toi_seconds_avg_last10`
- [ ] `toi_seconds_total_last20`
- [ ] `toi_seconds_avg_last20`
- [ ] `toi_seconds_avg_season`
- [ ] `toi_seconds_avg_3ya`
- [ ] `toi_seconds_avg_career`

TOI trust checks:
- [ ] verify WGO `toi_per_game` normalization is correct where WGO fallback is used
- [ ] verify TOI fallback tier diagnostics match the actual resolution path
- [ ] verify split-strength participation uses TOI consistently with the intended participation contract

### 3. Additive Counts

- [ ] `goals`
- [ ] `assists`
- [ ] `shots`
- [ ] `hits`
- [ ] `blocks`
- [ ] `pp_points`
- [ ] `points`

Required scopes:
- [ ] all / running scope
- [ ] `last3`
- [ ] `last5`
- [ ] `last10`
- [ ] `last20`
- [ ] season
- [ ] 3YA
- [ ] career

### 4. Opportunity Counts

- [ ] `ixg`
- [ ] `iscf`
- [ ] `ihdcf`

Required scopes:
- [ ] all / running scope
- [ ] `last3`
- [ ] `last5`
- [ ] `last10`
- [ ] `last20`
- [ ] season
- [ ] 3YA
- [ ] career

### 5. Weighted `/60`

- [ ] `sog_per_60`
- [ ] `ixg_per_60`
- [ ] `hits_per_60`
- [ ] `blocks_per_60`

Required scopes:
- [ ] all
- [ ] `last3`
- [ ] `last5`
- [ ] `last10`
- [ ] `last20`
- [ ] season
- [ ] 3YA
- [ ] career

Special checks:
- [ ] verify fixed-appearance window membership
- [ ] verify weighted numerator/TOI aggregation instead of average-of-rates behavior
- [ ] explicitly verify `ixg_per_60` source path:
  - `counts_raw`
  - `wgo_raw`
  - `rate_reconstruction`
  - `unavailable`

### 6. Finishing Ratios

- [ ] `shooting_pct`
- [ ] `primary_points_pct`
- [ ] `expected_sh_pct`

Required scopes:
- [ ] all
- [ ] `last3`
- [ ] `last5`
- [ ] `last10`
- [ ] `last20`
- [ ] season
- [ ] 3YA
- [ ] career

Support-field checks:
- [ ] verify stored raw numerators and denominators match the reconstructed ratio
- [ ] verify null-vs-zero denominator behavior matches the declared contract
- [ ] verify scale handling matches the documented family scale

### 7. On-Ice Context

- [ ] `ipp`
- [ ] `on_ice_sh_pct`
- [ ] `pdo`

Required scopes:
- [ ] all
- [ ] `last3`
- [ ] `last5`
- [ ] `last10`
- [ ] `last20`
- [ ] season
- [ ] 3YA
- [ ] career

Support-field checks:
- [ ] verify component support fields for all retained scopes
- [ ] verify composite PDO arithmetic uses aggregated components

### 8. Zone / Usage

- [ ] `oz_start_pct`
- [ ] `pp_share_pct`

Required scopes:
- [ ] all
- [ ] `last3`
- [ ] `last5`
- [ ] `last10`
- [ ] `last20`
- [ ] season
- [ ] 3YA
- [ ] career

Special checks:
- [ ] verify `oz_start_pct` matches the intended NST semantics
- [ ] verify `pp_share_pct` against the final authoritative denominator contract
- [ ] verify `pp_share_pct` support fields store the reconstructed player and team PP TOI inputs correctly
- [ ] verify PP-share validation on Jesper Bratt and one low-PP case

### 9. Territorial

Counts:
- [ ] `cf`
- [ ] `ca`
- [ ] `ff`
- [ ] `fa`

Ratios:
- [ ] `cf_pct`
- [ ] `ff_pct`

Required scopes:
- [ ] all
- [ ] `last3`
- [ ] `last5`
- [ ] `last10`
- [ ] `last20`
- [ ] season
- [ ] 3YA
- [ ] career

### 10. Historical Baselines

For every retained family with `avg_season`, `avg_3ya`, or `avg_career` compatibility outputs:
- [ ] verify simple historical averages remain mathematically healthy
- [ ] verify weighted `/60` historical snapshots remain mathematically healthy
- [ ] verify ratio historical snapshots remain mathematically healthy
- [ ] verify historical availability semantics match the redesigned cross-stint contract

### 11. Context Labels

- [ ] `pp_unit`
- [ ] `line_combo_slot`
- [ ] `line_combo_group`

Context validation checks:
- [ ] verify builder freshness before comparison
- [ ] verify row values match upstream builder outputs for the affected games
- [ ] verify these fields remain treated as contextual labels, not arithmetic metrics

## Explicit Disputed Metric Checklist

The following require an explicit signed result even if the family-level checklist already covers them:

- [ ] `gp_pct_avg_season` replacement field(s)
- [ ] `gp_pct_total_all`
- [ ] rolling GP replacement field(s)
- [ ] `gp_pct_avg_3ya`
- [ ] `gp_pct_avg_career`
- [ ] `shooting_pct_total_lastN`
- [ ] `primary_points_pct_total_lastN`
- [ ] `expected_sh_pct_total_lastN`
- [ ] `ipp_total_lastN`
- [ ] `pp_share_pct_total_lastN`
- [ ] `ixg_per_60`
- [ ] any renamed ratio-family aliases
- [ ] any renamed weighted `/60` aliases
- [ ] any newly introduced numerator / denominator support fields

## Observability and Run-Quality Evidence Checklist

For the validation run itself, capture evidence that the pipeline surfaces the required diagnostics:

- [ ] coverage warnings
- [ ] suspicious-output warnings
- [ ] unknown game ID reporting
- [ ] GP-window denominator diagnostics
- [ ] ratio-window component completeness diagnostics
- [ ] TOI fallback tier diagnostics
- [ ] rate reconstruction diagnostics
- [ ] stale-tail diagnostics
- [ ] structured run summary output
- [ ] phase-level progress logs for:
  - bootstrap
  - fetch
  - merge
  - derive
  - upsert
  - summary

## Signoff Rules

Do not mark remediation validated unless all of the following are true:

- [ ] every metric family above has a recorded result
- [ ] every disputed metric above has a recorded result
- [ ] all freshness blockers were resolved or documented as external blockers
- [ ] all mismatches were classified
- [ ] current-code rows, not stale legacy rows, were used as evidence
- [ ] the structured run summary was captured from a post-remediation run

## Final Audit Re-Read Completeness Check

Final signoff must include a fresh re-read of [rolling-player-metrics-audit-notes.md](/Users/tim/Code/fhfhockey.com/tasks/rolling-player-metrics-audit-notes.md).

Record the outcome of each actionable audit item as one of:

- [ ] implemented
- [ ] intentionally deferred as optional
- [ ] intentionally deferred as follow-up
- [ ] unresolved

Completion rule:
- reject remediation completion if any required actionable audit item remains unresolved

