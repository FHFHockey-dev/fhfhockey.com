# NHL Game Prediction Supabase Source Audit

Generated at: 2026-04-27T23:15:26.225Z

Scope: live schema, source inventory, identity joins, team-power math, NST team-table semantics, WGO/standings semantics, goalie-source semantics, lineup/player-context coverage, prediction storage/provenance fit, representative row-level data quality, and as-of/leakage safety for tasks 1.1 through 1.11 of `tasks/tasks-prd-nhl-game-prediction-model.md`.

Metadata mode: management_api_sql

## Summary

- Planned sources checked: 44
- Existing live relations: 44
- Missing live relations: 0
- Existing relations with missing planned key columns: 0
- Identity check blockers: 0
- Identity check warnings: 3
- Team-power math blockers: 0
- Team-power math warnings: 1
- NST team-table blockers: 0
- NST team-table warnings: 5
- WGO/standings blockers: 0
- WGO/standings warnings: 2
- Goalie-source blockers: 0
- Goalie-source warnings: 6
- Lineup/player-context blockers: 0
- Lineup/player-context warnings: 4
- Storage/provenance blockers: 0
- Storage/provenance warnings: 3
- Row-level data-quality blockers: 0
- Row-level data-quality warnings: 3
- As-of/leakage blockers: 0
- As-of/leakage warnings: 5

## Blockers And Follow-Ups

- No missing live relations in this inventory pass.


- No identity-join blockers in this pass.

- Identity warning: `vw_goalie_stats_unified_team_coverage` should be handled in the data dictionary/fallback rules.
- Identity warning: `line_source_identity_coverage` should be handled in the data dictionary/fallback rules.
- Identity warning: `player_current_team_coverage` should be handled in the data dictionary/fallback rules.

- No team-power math blockers in this pass.

- Team-power math warning: `team_power_source_date_alignment_check` should be handled before using this table for production modeling.

- No NST team-table blockers in this pass.

- NST team-table warning: `nst_team_date_freshness_check` should be handled in source semantics and freshness rules.
- NST team-table warning: `nst_team_percentage_identity_check` should be handled in source semantics and freshness rules.
- NST team-table warning: `nst_team_count_rate_pairing_check` should be handled in source semantics and freshness rules.
- NST team-table warning: `nst_team_snapshot_semantics_check` should be handled in source semantics and freshness rules.
- NST team-table warning: `nst_team_gamelog_gp_check` should be handled in source semantics and freshness rules.

- No WGO/standings blockers in this pass.

- WGO/standings warning: `wgo_team_stats_identity_coverage` should be handled in source semantics and freshness rules.
- WGO/standings warning: `wgo_team_stats_rate_and_percentage_bounds_check` should be handled in source semantics and freshness rules.

- No goalie-source blockers in this pass.

- Goalie-source warning: `goalie_start_probability_bounds_check` should be handled in source semantics and freshness rules.
- Goalie-source warning: `goalie_start_probability_sum_check` should be handled in source semantics and freshness rules.
- Goalie-source warning: `wgo_goalie_value_bounds_check` should be handled in source semantics and freshness rules.
- Goalie-source warning: `wgo_goalie_totals_as_of_safety_check` should be handled in source semantics and freshness rules.
- Goalie-source warning: `nst_goalie_date_freshness_check` should be handled in source semantics and freshness rules.
- Goalie-source warning: `nst_goalie_rate_bounds_check` should be handled in source semantics and freshness rules.

- No lineup/player-context blockers in this pass.

- Lineup/player-context warning: `line_combinations_game_side_coverage_check` should be handled in optional-source and freshness rules.
- Lineup/player-context warning: `line_source_freshness_and_status_check` should be handled in optional-source and freshness rules.
- Lineup/player-context warning: `forge_projection_context_coverage_check` should be handled in optional-source and freshness rules.
- Lineup/player-context warning: `forge_roster_events_coverage_check` should be handled in optional-source and freshness rules.

- No storage/provenance blockers in this pass.

- Storage/provenance warning: `prediction_output_history_contract_check` should be handled before relying on stored prediction history or freshness evidence.
- Storage/provenance warning: `forge_runs_game_model_metadata_fit_check` should be handled before relying on stored prediction history or freshness evidence.
- Storage/provenance warning: `source_provenance_snapshots_freshness_contract_check` should be handled before relying on stored prediction history or freshness evidence.

- No row-level data-quality blockers in this pass.

- Row-level data-quality warning: `core_recent_value_bounds_check` should be handled in feature filters, freshness gates, or clipping rules.
- Row-level data-quality warning: `nst_team_recent_row_quality_check` should be handled in feature filters, freshness gates, or clipping rules.
- Row-level data-quality warning: `recent_game_side_core_source_coverage_check` should be handled in feature filters, freshness gates, or clipping rules.

- No as-of/leakage blockers in this pass.

- As-of/leakage warning: `latest_only_view_exclusion_check` should be handled with strict feature cutoffs or source exclusion rules.
- As-of/leakage warning: `team_feature_strict_pregame_as_of_coverage_check` should be handled with strict feature cutoffs or source exclusion rules.
- As-of/leakage warning: `goalie_projection_temporal_safety_check` should be handled with strict feature cutoffs or source exclusion rules.
- As-of/leakage warning: `lineup_source_temporal_safety_check` should be handled with strict feature cutoffs or source exclusion rules.
- As-of/leakage warning: `forge_projection_as_of_date_safety_check` should be handled with strict feature cutoffs or source exclusion rules.

## Source Inventory

| Source | Priority | Type | Rows | Date Coverage | Planned Key Columns Missing | Use-Case Purpose |
| --- | --- | --- | ---: | --- | --- | --- |
| `games` | core | table | 28344 | `date`: 2003-10-08 to 2026-05-03; `startTime`: 2003-10-09 00:00:00+00 to 2026-05-03 16:00:00+00; `created_at`: 2024-01-11 05:42:18.048305+00 to 2026-04-18 03:00:02.901368+00 | None | Schedule identity, home/away teams, season, start time. |
| `teams` | core | table | 62 | No planned date columns found | None | Team identity and abbreviation mapping. |
| `players` | core | table | 2882 | `birthDate`: 1969-01-09 to 2007-09-05 | None | Player and goalie identity. |
| `seasons` | core | table | 108 | No planned date columns found | None | Season identity for schedule joins. |
| `team_power_ratings_daily` | core | table | 5683 | `date`: 2025-10-07 to 2026-04-27; `created_at`: 2025-12-07 02:26:09.704494+00 to 2026-04-27 09:15:02.986285+00 | None | Primary team-strength ratings and EWMA-derived team features. |
| `nst_team_gamelogs_as_counts` | core | table | 2134 | `date`: 2025-10-07 to 2026-04-11 | None | Game-level all-situation NST team counts. |
| `nst_team_gamelogs_as_rates` | core | table | 1968 | `date`: 2025-10-06 to 2026-04-11 | None | Game-level all-situation NST team rates. |
| `nst_team_gamelogs_pp_counts` | core | table | 1939 | `date`: 2025-10-06 to 2026-04-11 | None | Game-level power-play NST team counts. |
| `nst_team_gamelogs_pp_rates` | core | table | 1939 | `date`: 2025-10-06 to 2026-04-11 | None | Game-level power-play NST team rates. |
| `nst_team_gamelogs_pk_counts` | core | table | 1919 | `date`: 2025-10-06 to 2026-04-11 | None | Game-level penalty-kill NST team counts. |
| `nst_team_gamelogs_pk_rates` | core | table | 1965 | `date`: 2025-10-06 to 2026-04-11 | None | Game-level penalty-kill NST team rates. |
| `nst_team_5v5` | core | table | 9904 | `date`: 2024-10-04 to 2026-03-21; `created_at`: 2024-10-16 19:59:24.071374 to 2026-03-23 08:10:04.683241; `updated_at`: 2024-10-16 19:59:24.071374 to 2026-03-23 08:10:04.683241 | None | NST 5v5 team snapshot/table. |
| `nst_team_all` | core | table | 10222 | `date`: 2024-10-04 to 2026-03-21; `created_at`: 2024-10-16 19:59:10.958807 to 2026-03-22 08:10:03.670928; `updated_at`: 2024-10-16 19:59:10.958807 to 2026-03-22 08:10:03.670928 | None | NST all-situation team snapshot/table. |
| `nst_team_pp` | core | table | 9736 | `date`: 2024-10-04 to 2026-03-21; `created_at`: 2024-10-16 19:59:36.769906 to 2026-03-23 08:10:05.158759; `updated_at`: 2024-10-16 19:59:36.769906 to 2026-03-23 08:10:05.158759 | None | NST team power-play context. |
| `nst_team_pk` | core | table | 9698 | `date`: 2024-10-04 to 2026-03-21; `created_at`: 2024-10-16 19:59:49.492721 to 2026-03-23 08:10:05.64405; `updated_at`: 2024-10-16 19:59:49.492721 to 2026-03-23 08:10:05.64405 | None | NST team penalty-kill context. |
| `wgo_team_stats` | core | table | 35696 | `date`: 2010-10-07 to 2026-04-26 | None | WGO team season/day stats including goals, shots, PP/PK, and discipline. |
| `nhl_standings_details` | core | table | 12448 | `date`: 2024-10-04 to 2026-04-17 | None | Dated standings, l10, home/road, and goal differential context. |
| `goalie_start_projections` | core | table | 6059 | `game_date`: 2025-10-07 to 2026-04-27; `created_at`: 2025-12-05 18:19:42.841493+00 to 2026-04-27 09:30:03.748284+00; `updated_at`: 2025-12-05 18:19:42.841493+00 to 2026-04-27 09:30:03.748284+00 | None | Starter probability, confirmation status, and projected goalie quality. |
| `wgo_goalie_stats` | core | table | 150649 | `date`: 1917-12-19 to 2026-04-26 | None | Goalie game/dated stats, rest splits, save percentage, and GAA. |
| `wgo_goalie_stats_totals` | core | table | 4890 | `updated_at`: 2025-03-25 01:32:39.538+00 to 2026-04-27 08:20:02.059+00 | None | Goalie season totals. |
| `vw_goalie_stats_unified` | core | view |  | `date`: 2023-01-01 to 2026-04-26 | None | Unified WGO/NST goalie view. |
| `nst_gamelog_goalie_all_counts` | core | table | 5340 | `date_scraped`: 2024-10-04 to 2026-04-09 | None | NST goalie all-situation counts. |
| `nst_gamelog_goalie_all_rates` | core | table | 5340 | `date_scraped`: 2024-10-04 to 2026-04-09 | None | NST goalie all-situation rates. |
| `nst_gamelog_goalie_5v5_counts` | core | table | 5410 | `date_scraped`: 2024-10-04 to 2026-04-09 | None | NST goalie 5v5 counts. |
| `nst_gamelog_goalie_5v5_rates` | core | table | 5383 | `date_scraped`: 2024-10-04 to 2026-04-09 | None | NST goalie 5v5 rates. |
| `nst_gamelog_goalie_ev_counts` | core | table | 5386 | `date_scraped`: 2024-10-04 to 2026-04-09 | None | NST goalie even-strength counts. |
| `nst_gamelog_goalie_ev_rates` | core | table | 5311 | `date_scraped`: 2024-10-04 to 2026-04-09 | None | NST goalie even-strength rates. |
| `nst_gamelog_goalie_pk_counts` | core | table | 5104 | `date_scraped`: 2024-10-04 to 2026-04-09 | None | NST goalie penalty-kill counts. |
| `nst_gamelog_goalie_pk_rates` | core | table | 5104 | `date_scraped`: 2024-10-04 to 2026-04-09 | None | NST goalie penalty-kill rates. |
| `nst_gamelog_goalie_pp_counts` | core | table | 5103 | `date_scraped`: 2024-10-04 to 2026-04-09 | None | NST goalie power-play counts. |
| `nst_gamelog_goalie_pp_rates` | core | table | 5103 | `date_scraped`: 2024-10-04 to 2026-04-09 | None | NST goalie power-play rates. |
| `lineCombinations` | optional | table | 10920 | No planned date columns found | None | Current/projected line combinations by game/team. |
| `lines_nhl` | optional | table |  | `snapshot_date`: 2026-04-22 to 2026-04-22; `observed_at`: 2026-04-23 01:00:56.479+00 to 2026-04-23 13:38:04.818+00; `updated_at`: 2026-04-23 01:00:57.372+00 to 2026-04-23 13:38:07.057+00 | None | Historical NHL.com lineup snapshots. |
| `lines_dfo` | optional | table | 8 | `snapshot_date`: 2026-04-22 to 2026-04-23; `observed_at`: 2026-04-21 14:38:56.544+00 to 2026-04-23 01:40:13.546+00; `updated_at`: 2026-04-23 01:02:05.293+00 to 2026-04-23 14:07:26.073+00 | None | Historical DailyFaceoff lineup snapshots. |
| `lines_gdl` | optional | table |  | `snapshot_date`: 2026-04-22 to 2026-04-23; `observed_at`: 2026-04-23 00:21:52.907+00 to 2026-04-23 14:07:26.073+00; `tweet_posted_at`: 2026-02-28 00:00:00+00 to 2026-04-20 04:00:00+00; `updated_at`: 2026-04-23 00:21:52.907+00 to 2026-04-23 14:07:26.073+00 | None | Historical GameDayTweets lineup snapshots. |
| `lines_ccc` | optional | table | 25 | `snapshot_date`: 2026-04-25 to 2026-04-25; `observed_at`: 2026-04-24 21:46:50.425013+00 to 2026-04-25 01:11:34.089855+00; `tweet_posted_at`: 2026-04-24 00:00:00+00 to 2026-04-25 00:00:00+00; `updated_at`: 2026-04-26 18:24:02.161+00 to 2026-04-27 21:00:16.385+00 | None | CCC tweet-derived lineup snapshots. |
| `forge_roster_events` | optional | table |  | `created_at`: null to null; `updated_at`: null to null; `effective_from`: null to null; `effective_to`: null to null | None | Injury, lineup, transaction, and goalie-start events. |
| `forge_player_projections` | optional | table | 24100 | `as_of_date`: 2025-10-07 to 2026-04-16; `created_at`: 2025-12-30 15:09:27.096935+00 to 2026-04-16 10:05:43.191771+00; `updated_at`: 2025-12-30 15:09:27.048+00 to 2026-04-16 10:05:43.149+00 | None | FORGE player-level projection context. |
| `forge_goalie_projections` | optional | table | 2332 | `as_of_date`: 2025-10-07 to 2026-04-16; `created_at`: 2025-12-30 15:09:30.137261+00 to 2026-04-16 10:05:37.287603+00; `updated_at`: 2025-12-30 15:09:30.09+00 to 2026-04-16 10:05:37.257+00 | None | FORGE goalie projection context. |
| `forge_team_projections` | optional | table | 2336 | `as_of_date`: 2025-10-07 to 2026-04-16; `created_at`: 2025-12-30 15:09:27.180153+00 to 2026-04-16 10:05:43.236688+00; `updated_at`: 2025-12-30 15:09:27.139+00 to 2026-04-16 10:05:43.214+00 | None | FORGE team-level projection context. |
| `game_prediction_outputs` | storage | table |  | `snapshot_date`: null to null; `computed_at`: null to null; `updated_at`: null to null | None | Latest/public game prediction output contract. |
| `player_prediction_outputs` | storage | table |  | `snapshot_date`: null to null; `computed_at`: null to null; `updated_at`: null to null | None | Player prediction output contract. |
| `forge_runs` | storage | table | 173 | `as_of_date`: 2025-10-07 to 2026-04-16; `created_at`: 2025-12-26 15:43:04.592168+00 to 2026-04-16 10:05:03.581243+00; `updated_at`: 2025-12-26 15:43:04.674+00 to 2026-04-16 11:30:05.195+00 | None | FORGE run metadata and metrics. |
| `source_provenance_snapshots` | storage | table | 107 | `snapshot_date`: 2026-04-21 to 2026-04-23; `observed_at`: 2026-04-21 14:38:56.544+00 to 2026-04-23 14:07:26.073+00; `freshness_expires_at`: 2026-04-21 22:38:56.544+00 to 2026-04-25 23:18:28.044+00; `updated_at`: 2026-04-21 20:44:16.817+00 to 2026-04-23 14:07:26.073+00 | None | Source freshness/provenance registry. |

## Identity Join Checks

### PASS: `games_team_and_season_fk_integrity`

Games should resolve home teams, away teams, and seasons.

```json
[
  {
    "missing_home_team_rows": 0,
    "missing_away_team_rows": 0,
    "missing_season_rows": 0
  }
]
```

### PASS: `team_abbreviation_coverage`

Team abbreviations from primary team sources should resolve to `teams.abbreviation`.

```json
[]
```

### PASS: `wgo_team_id_coverage`

Recent WGO team rows should resolve team IDs where present.

```json
[
  {
    "null_team_id_rows": 0,
    "unmapped_team_id_rows": 0
  }
]
```

### PASS: `goalie_start_projection_identity_coverage`

`goalie_start_projections` rows should resolve games, teams, and players.

```json
[
  {
    "missing_game_rows": 0,
    "missing_team_rows": 0,
    "missing_player_rows": 0
  }
]
```

### PASS: `recent_wgo_goalie_player_coverage`

Recent WGO goalie stat rows should resolve goalie IDs to players.

```json
[
  {
    "recent_rows": 9946,
    "missing_player_rows": 0
  }
]
```

### WARN: `vw_goalie_stats_unified_team_coverage`

Unified goalie rows should have team IDs for model joins.

```json
[
  {
    "rows": 9946,
    "null_team_id_rows": 232
  }
]
```

### PASS: `line_combinations_identity_coverage`

`lineCombinations` rows should resolve games and teams.

```json
[
  {
    "missing_game_rows": 0,
    "missing_team_rows": 0
  }
]
```

### WARN: `line_source_identity_coverage`

Accepted/observed line source rows should resolve games where supplied and teams.

```json
[
  {
    "source_name": "lines_ccc",
    "rows": 7,
    "missing_team_rows": 0,
    "missing_game_rows": 0,
    "null_game_id_rows": 7
  },
  {
    "source_name": "lines_dfo",
    "rows": 8,
    "missing_team_rows": 0,
    "missing_game_rows": 0,
    "null_game_id_rows": 0
  },
  {
    "source_name": "lines_gdl",
    "rows": 42,
    "missing_team_rows": 0,
    "missing_game_rows": 0,
    "null_game_id_rows": 0
  },
  {
    "source_name": "lines_nhl",
    "rows": 30,
    "missing_team_rows": 0,
    "missing_game_rows": 0,
    "null_game_id_rows": 0
  }
]
```

### PASS: `forge_projection_identity_coverage`

FORGE projection rows should resolve games, teams, players/goalies, and runs.

```json
[
  {
    "source_name": "forge_goalie_projections",
    "missing_game_rows": 0,
    "missing_team_rows": 0,
    "missing_opponent_team_rows": 0,
    "missing_entity_rows": 0,
    "missing_run_rows": 0
  },
  {
    "source_name": "forge_player_projections",
    "missing_game_rows": 0,
    "missing_team_rows": 0,
    "missing_opponent_team_rows": 0,
    "missing_entity_rows": 0,
    "missing_run_rows": 0
  },
  {
    "source_name": "forge_team_projections",
    "missing_game_rows": 0,
    "missing_team_rows": 0,
    "missing_opponent_team_rows": 0,
    "missing_entity_rows": 0,
    "missing_run_rows": 0
  }
]
```

### WARN: `player_current_team_coverage`

Player current team assignments can be optional/stale but should be understood before player context use.

```json
[
  {
    "players": 2895,
    "null_team_id_rows": 901,
    "unmapped_team_id_rows": 572
  }
]
```


## Team Power Ratings Math Checks

### PASS: `team_power_duplicate_key_check`

`team_power_ratings_daily` should have one row per team/date.

```json
[
  {
    "duplicate_keys": 0,
    "duplicate_key_rows": "0"
  }
]
```

### PASS: `team_power_null_and_invalid_value_check`

Core rating/rate fields should be populated and physically plausible.

```json
[
  {
    "rows": 6387,
    "null_off_rating": 0,
    "null_def_rating": 0,
    "null_xgf60": 0,
    "null_xga60": 0,
    "negative_xgf60": 0,
    "negative_xga60": 0,
    "negative_pace60": 0,
    "null_special_rating": 0,
    "null_goalie_rating": 0,
    "null_trend10": 0
  }
]
```

### PASS: `team_power_rating_range_check`

Ratings should stay in plausible z-score-derived ranges around 100.

```json
[
  {
    "min_off_rating": "60.638404491006725",
    "max_off_rating": "140.8521909645749",
    "avg_off_rating": "99.7606495217384375",
    "min_def_rating": "64.55796433172318",
    "max_def_rating": "132.88630862411972",
    "avg_def_rating": "100.2448425724009384",
    "min_pace_rating": "53.5617391526482",
    "max_pace_rating": "136.6998937744387",
    "avg_pace_rating": "100.1019916341934747"
  }
]
```

### PASS: `team_power_directionality_check`

Offense should increase with xGF; defense should improve as xGA decreases; pace should increase with pace60.

```json
[
  {
    "off_xgf60_corr": 0.949472998408225,
    "def_xga60_corr": -0.943875686027976,
    "pace_corr": 0.960343348871146
  }
]
```

### PASS: `team_power_special_team_tier_check`

Power-play and penalty-kill tiers should be null or in the expected 1-3 range.

```json
[
  {
    "invalid_pp_tier": 0,
    "invalid_pk_tier": 0,
    "null_pp_tier": 0,
    "null_pk_tier": 0
  }
]
```

### WARN: `team_power_source_date_alignment_check`

Power-rating dates should be understood relative to upstream NST/WGO source freshness.

```json
[
  {
    "max_power_date": "2026-04-27",
    "max_nst_rates_date": "2026-04-11",
    "max_nst_counts_date": "2026-04-11",
    "max_nst_pp_rates_date": "2026-04-11",
    "max_nst_pk_rates_date": "2026-04-11",
    "max_wgo_team_date": "2026-04-26",
    "max_standings_date": "2026-04-17"
  }
]
```

### PASS: `team_power_team_count_by_date_check`

Recent rating dates should generally include a full NHL team set.

```json
[
  {
    "date": "2026-04-27",
    "team_count": 32
  },
  {
    "date": "2026-04-26",
    "team_count": 32
  },
  {
    "date": "2026-04-25",
    "team_count": 32
  },
  {
    "date": "2026-04-24",
    "team_count": 32
  },
  {
    "date": "2026-04-23",
    "team_count": 32
  },
  {
    "date": "2026-04-22",
    "team_count": 32
  },
  {
    "date": "2026-04-21",
    "team_count": 32
  },
  {
    "date": "2026-04-20",
    "team_count": 32
  },
  {
    "date": "2026-04-19",
    "team_count": 32
  },
  {
    "date": "2026-04-18",
    "team_count": 32
  },
  {
    "date": "2026-04-17",
    "team_count": 32
  },
  {
    "date": "2026-04-16",
    "team_count": 32
  },
  {
    "date": "2026-04-15",
    "team_count": 32
  },
  {
    "date": "2026-04-14",
    "team_count": 32
  },
  {
    "date": "2026-04-13",
    "team_count": 32
  }
]
```


## NST Team Table Semantics Checks

### PASS: `nst_team_duplicate_key_check`

NST team sources should have one row per source/team/date.

```json
[
  {
    "source_name": "nst_team_5v5",
    "duplicate_keys": 0,
    "duplicate_key_rows": "0"
  },
  {
    "source_name": "nst_team_all",
    "duplicate_keys": 0,
    "duplicate_key_rows": "0"
  },
  {
    "source_name": "nst_team_gamelogs_as_counts",
    "duplicate_keys": 0,
    "duplicate_key_rows": "0"
  },
  {
    "source_name": "nst_team_gamelogs_as_rates",
    "duplicate_keys": 0,
    "duplicate_key_rows": "0"
  },
  {
    "source_name": "nst_team_gamelogs_pk_counts",
    "duplicate_keys": 0,
    "duplicate_key_rows": "0"
  },
  {
    "source_name": "nst_team_gamelogs_pk_rates",
    "duplicate_keys": 0,
    "duplicate_key_rows": "0"
  },
  {
    "source_name": "nst_team_gamelogs_pp_counts",
    "duplicate_keys": 0,
    "duplicate_key_rows": "0"
  },
  {
    "source_name": "nst_team_gamelogs_pp_rates",
    "duplicate_keys": 0,
    "duplicate_key_rows": "0"
  },
  {
    "source_name": "nst_team_pk",
    "duplicate_keys": 0,
    "duplicate_key_rows": "0"
  },
  {
    "source_name": "nst_team_pp",
    "duplicate_keys": 0,
    "duplicate_key_rows": "0"
  }
]
```

### WARN: `nst_team_date_freshness_check`

NST team source latest dates should be explicit so stale tables are not treated as current.

```json
[
  {
    "source_name": "nst_team_5v5",
    "min_date": "2024-10-04",
    "max_date": "2026-03-21",
    "distinct_dates": 474,
    "days_since_latest": 37,
    "latest_date_team_count": 22
  },
  {
    "source_name": "nst_team_all",
    "min_date": "2024-10-04",
    "max_date": "2026-03-21",
    "distinct_dates": 492,
    "days_since_latest": 37,
    "latest_date_team_count": 22
  },
  {
    "source_name": "nst_team_gamelogs_as_counts",
    "min_date": "2025-10-07",
    "max_date": "2026-04-11",
    "distinct_dates": 162,
    "days_since_latest": 16,
    "latest_date_team_count": 30
  },
  {
    "source_name": "nst_team_gamelogs_as_rates",
    "min_date": "2025-10-06",
    "max_date": "2026-04-11",
    "distinct_dates": 162,
    "days_since_latest": 16,
    "latest_date_team_count": 30
  },
  {
    "source_name": "nst_team_gamelogs_pk_counts",
    "min_date": "2025-10-06",
    "max_date": "2026-04-11",
    "distinct_dates": 161,
    "days_since_latest": 16,
    "latest_date_team_count": 28
  },
  {
    "source_name": "nst_team_gamelogs_pk_rates",
    "min_date": "2025-10-06",
    "max_date": "2026-04-11",
    "distinct_dates": 162,
    "days_since_latest": 16,
    "latest_date_team_count": 28
  },
  {
    "source_name": "nst_team_gamelogs_pp_counts",
    "min_date": "2025-10-06",
    "max_date": "2026-04-11",
    "distinct_dates": 162,
    "days_since_latest": 16,
    "latest_date_team_count": 28
  },
  {
    "source_name": "nst_team_gamelogs_pp_rates",
    "min_date": "2025-10-06",
    "max_date": "2026-04-11",
    "distinct_dates": 162,
    "days_since_latest": 16,
    "latest_date_team_count": 28
  },
  {
    "source_name": "nst_team_pk",
    "min_date": "2024-10-04",
    "max_date": "2026-03-21",
    "distinct_dates": 467,
    "days_since_latest": 37,
    "latest_date_team_count": 22
  },
  {
    "source_name": "nst_team_pp",
    "min_date": "2024-10-04",
    "max_date": "2026-03-21",
    "distinct_dates": 469,
    "days_since_latest": 37,
    "latest_date_team_count": 22
  }
]
```

### PASS: `nst_team_situation_label_check`

Situation labels should match gamelog table family; snapshot tables may encode the situation in the table name rather than the column.

```json
[
  {
    "source_name": "nst_team_5v5",
    "expected_situation": "5v5",
    "observed_situations": [
      "5v5"
    ],
    "unexpected_situation_rows": 0,
    "snapshot_default_all_rows": 0
  },
  {
    "source_name": "nst_team_all",
    "expected_situation": "all",
    "observed_situations": [
      "all"
    ],
    "unexpected_situation_rows": 0,
    "snapshot_default_all_rows": 0
  },
  {
    "source_name": "nst_team_gamelogs_as_counts",
    "expected_situation": "all",
    "observed_situations": [
      "all"
    ],
    "unexpected_situation_rows": 0,
    "snapshot_default_all_rows": 0
  },
  {
    "source_name": "nst_team_gamelogs_as_rates",
    "expected_situation": "all",
    "observed_situations": [
      "all"
    ],
    "unexpected_situation_rows": 0,
    "snapshot_default_all_rows": 0
  },
  {
    "source_name": "nst_team_gamelogs_pk_counts",
    "expected_situation": "pk",
    "observed_situations": [
      "pk"
    ],
    "unexpected_situation_rows": 0,
    "snapshot_default_all_rows": 0
  },
  {
    "source_name": "nst_team_gamelogs_pk_rates",
    "expected_situation": "pk",
    "observed_situations": [
      "pk"
    ],
    "unexpected_situation_rows": 0,
    "snapshot_default_all_rows": 0
  },
  {
    "source_name": "nst_team_gamelogs_pp_counts",
    "expected_situation": "pp",
    "observed_situations": [
      "pp"
    ],
    "unexpected_situation_rows": 0,
    "snapshot_default_all_rows": 0
  },
  {
    "source_name": "nst_team_gamelogs_pp_rates",
    "expected_situation": "pp",
    "observed_situations": [
      "pp"
    ],
    "unexpected_situation_rows": 0,
    "snapshot_default_all_rows": 0
  },
  {
    "source_name": "nst_team_pk",
    "expected_situation": "pk",
    "observed_situations": [
      "pk"
    ],
    "unexpected_situation_rows": 0,
    "snapshot_default_all_rows": 0
  },
  {
    "source_name": "nst_team_pp",
    "expected_situation": "pp",
    "observed_situations": [
      "pp"
    ],
    "unexpected_situation_rows": 0,
    "snapshot_default_all_rows": 0
  }
]
```

### WARN: `nst_team_percentage_identity_check`

NST percentage fields should match for/(for+against) on a 0-100 percentage scale within source-rounding tolerance.

```json
[
  {
    "source_name": "nst_team_5v5",
    "metric": "cf_pct",
    "total_rows": 9994,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 9994,
    "min_pct_value": 20.91,
    "max_pct_value": 79.09
  },
  {
    "source_name": "nst_team_5v5",
    "metric": "ff_pct",
    "total_rows": 9994,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 9994,
    "min_pct_value": 20.31,
    "max_pct_value": 79.69
  },
  {
    "source_name": "nst_team_5v5",
    "metric": "gf_pct",
    "total_rows": 9914,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 9368,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_5v5",
    "metric": "hdcf_pct",
    "total_rows": 9994,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 9992,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_5v5",
    "metric": "hdgf_pct",
    "total_rows": 9366,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 8311,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_5v5",
    "metric": "hdsf_pct",
    "total_rows": 9994,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 9949,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_5v5",
    "metric": "scf_pct",
    "total_rows": 9994,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 9994,
    "min_pct_value": 13.04,
    "max_pct_value": 86.96
  },
  {
    "source_name": "nst_team_5v5",
    "metric": "sf_pct",
    "total_rows": 9994,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 9994,
    "min_pct_value": 19.15,
    "max_pct_value": 80.85
  },
  {
    "source_name": "nst_team_5v5",
    "metric": "xgf_pct",
    "total_rows": 9990,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 9990,
    "min_pct_value": 12,
    "max_pct_value": 88
  },
  {
    "source_name": "nst_team_all",
    "metric": "cf_pct",
    "total_rows": 10278,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 10278,
    "min_pct_value": 24.19,
    "max_pct_value": 75.81
  },
  {
    "source_name": "nst_team_all",
    "metric": "ff_pct",
    "total_rows": 10278,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 10278,
    "min_pct_value": 21.74,
    "max_pct_value": 78.26
  },
  {
    "source_name": "nst_team_all",
    "metric": "gf_pct",
    "total_rows": 10274,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 10027,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_all",
    "metric": "hdcf_pct",
    "total_rows": 10278,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 10278,
    "min_pct_value": 5.56,
    "max_pct_value": 94.44
  },
  {
    "source_name": "nst_team_all",
    "metric": "hdgf_pct",
    "total_rows": 10018,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 9150,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_all",
    "metric": "hdsf_pct",
    "total_rows": 10278,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 10265,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_all",
    "metric": "scf_pct",
    "total_rows": 10278,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 10278,
    "min_pct_value": 16.98,
    "max_pct_value": 83.02
  },
  {
    "source_name": "nst_team_all",
    "metric": "sf_pct",
    "total_rows": 10278,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 10278,
    "min_pct_value": 22,
    "max_pct_value": 78
  },
  {
    "source_name": "nst_team_all",
    "metric": "xgf_pct",
    "total_rows": 10274,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 10274,
    "min_pct_value": 11.59,
    "max_pct_value": 88.41
  },
  {
    "source_name": "nst_team_gamelogs_as_counts",
    "metric": "cf_pct",
    "total_rows": 2544,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 2544,
    "min_pct_value": 24.19,
    "max_pct_value": 75.81
  },
  {
    "source_name": "nst_team_gamelogs_as_counts",
    "metric": "ff_pct",
    "total_rows": 2544,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 2544,
    "min_pct_value": 23.26,
    "max_pct_value": 76.74
  },
  {
    "source_name": "nst_team_gamelogs_as_counts",
    "metric": "gf_pct",
    "total_rows": 2542,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 2434,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_as_counts",
    "metric": "hdcf_pct",
    "total_rows": 2544,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 2544,
    "min_pct_value": 8.33,
    "max_pct_value": 91.67
  },
  {
    "source_name": "nst_team_gamelogs_as_counts",
    "metric": "hdgf_pct",
    "total_rows": 2398,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 1972,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_as_counts",
    "metric": "hdsf_pct",
    "total_rows": 2544,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 2540,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_as_counts",
    "metric": "scf_pct",
    "total_rows": 2544,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 2544,
    "min_pct_value": 17.74,
    "max_pct_value": 82.26
  },
  {
    "source_name": "nst_team_gamelogs_as_counts",
    "metric": "sf_pct",
    "total_rows": 2544,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 2544,
    "min_pct_value": 21.43,
    "max_pct_value": 78.57
  },
  {
    "source_name": "nst_team_gamelogs_as_counts",
    "metric": "xgf_pct",
    "total_rows": 2544,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 2544,
    "min_pct_value": 13.55,
    "max_pct_value": 86.45
  },
  {
    "source_name": "nst_team_gamelogs_as_rates",
    "metric": "cf_pct",
    "total_rows": 0,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 0,
    "min_pct_value": 24.19,
    "max_pct_value": 75.81
  },
  {
    "source_name": "nst_team_gamelogs_as_rates",
    "metric": "ff_pct",
    "total_rows": 0,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 0,
    "min_pct_value": 25.77,
    "max_pct_value": 74.23
  },
  {
    "source_name": "nst_team_gamelogs_as_rates",
    "metric": "gf_pct",
    "total_rows": 0,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 0,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_as_rates",
    "metric": "hdcf_pct",
    "total_rows": 0,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 0,
    "min_pct_value": 8.33,
    "max_pct_value": 91.67
  },
  {
    "source_name": "nst_team_gamelogs_as_rates",
    "metric": "hdgf_pct",
    "total_rows": 0,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 0,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_as_rates",
    "metric": "hdsf_pct",
    "total_rows": 0,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 0,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_as_rates",
    "metric": "scf_pct",
    "total_rows": 0,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 0,
    "min_pct_value": 17.74,
    "max_pct_value": 82.26
  },
  {
    "source_name": "nst_team_gamelogs_as_rates",
    "metric": "sf_pct",
    "total_rows": 0,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 0,
    "min_pct_value": 21.43,
    "max_pct_value": 78.57
  },
  {
    "source_name": "nst_team_gamelogs_as_rates",
    "metric": "xgf_pct",
    "total_rows": 0,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 0,
    "min_pct_value": 13.55,
    "max_pct_value": 86.45
  },
  {
    "source_name": "nst_team_gamelogs_pk_counts",
    "metric": "cf_pct",
    "total_rows": 2475,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 1476,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pk_counts",
    "metric": "ff_pct",
    "total_rows": 2450,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 1400,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pk_counts",
    "metric": "gf_pct",
    "total_rows": 1302,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 210,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pk_counts",
    "metric": "hdcf_pct",
    "total_rows": 2058,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 504,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pk_counts",
    "metric": "hdgf_pct",
    "total_rows": 726,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 107,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pk_counts",
    "metric": "hdsf_pct",
    "total_rows": 1789,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 396,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pk_counts",
    "metric": "scf_pct",
    "total_rows": 2405,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 921,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pk_counts",
    "metric": "sf_pct",
    "total_rows": 2405,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 1223,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pk_counts",
    "metric": "xgf_pct",
    "total_rows": 2450,
    "fail_percent_scale_rows": 617,
    "fail_fraction_scale_rows": 1400,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pk_rates",
    "metric": "cf_pct",
    "total_rows": 0,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 0,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pk_rates",
    "metric": "ff_pct",
    "total_rows": 0,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 0,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pk_rates",
    "metric": "gf_pct",
    "total_rows": 0,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 0,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pk_rates",
    "metric": "hdcf_pct",
    "total_rows": 0,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 0,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pk_rates",
    "metric": "hdgf_pct",
    "total_rows": 0,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 0,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pk_rates",
    "metric": "hdsf_pct",
    "total_rows": 0,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 0,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pk_rates",
    "metric": "scf_pct",
    "total_rows": 0,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 0,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pk_rates",
    "metric": "sf_pct",
    "total_rows": 0,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 0,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pk_rates",
    "metric": "xgf_pct",
    "total_rows": 0,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 0,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pp_counts",
    "metric": "cf_pct",
    "total_rows": 2495,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 2486,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pp_counts",
    "metric": "ff_pct",
    "total_rows": 2470,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 2452,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pp_counts",
    "metric": "gf_pct",
    "total_rows": 1314,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 1217,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pp_counts",
    "metric": "hdcf_pct",
    "total_rows": 2078,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 1994,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pp_counts",
    "metric": "hdgf_pct",
    "total_rows": 733,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 674,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pp_counts",
    "metric": "hdsf_pct",
    "total_rows": 1808,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 1713,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pp_counts",
    "metric": "scf_pct",
    "total_rows": 2425,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 2394,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pp_counts",
    "metric": "sf_pct",
    "total_rows": 2425,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 2379,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pp_counts",
    "metric": "xgf_pct",
    "total_rows": 2470,
    "fail_percent_scale_rows": 623,
    "fail_fraction_scale_rows": 2452,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pp_rates",
    "metric": "cf_pct",
    "total_rows": 0,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 0,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pp_rates",
    "metric": "ff_pct",
    "total_rows": 0,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 0,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pp_rates",
    "metric": "gf_pct",
    "total_rows": 0,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 0,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pp_rates",
    "metric": "hdcf_pct",
    "total_rows": 0,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 0,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pp_rates",
    "metric": "hdgf_pct",
    "total_rows": 0,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 0,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pp_rates",
    "metric": "hdsf_pct",
    "total_rows": 0,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 0,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pp_rates",
    "metric": "scf_pct",
    "total_rows": 0,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 0,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pp_rates",
    "metric": "sf_pct",
    "total_rows": 0,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 0,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_gamelogs_pp_rates",
    "metric": "xgf_pct",
    "total_rows": 0,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 0,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_pk",
    "metric": "cf_pct",
    "total_rows": 9753,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 8000,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_pk",
    "metric": "ff_pct",
    "total_rows": 9721,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 7826,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_pk",
    "metric": "gf_pct",
    "total_rows": 7633,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 5519,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_pk",
    "metric": "hdcf_pct",
    "total_rows": 8931,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 6073,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_pk",
    "metric": "hdgf_pct",
    "total_rows": 6547,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 4367,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_pk",
    "metric": "hdsf_pct",
    "total_rows": 8429,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 5855,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_pk",
    "metric": "scf_pct",
    "total_rows": 9588,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 6887,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_pk",
    "metric": "sf_pct",
    "total_rows": 9635,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 7499,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_pk",
    "metric": "xgf_pct",
    "total_rows": 9710,
    "fail_percent_scale_rows": 1146,
    "fail_fraction_scale_rows": 7817,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_pp",
    "metric": "cf_pct",
    "total_rows": 9791,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 9765,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_pp",
    "metric": "ff_pct",
    "total_rows": 9758,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 9709,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_pp",
    "metric": "gf_pct",
    "total_rows": 7666,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 7483,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_pp",
    "metric": "hdcf_pct",
    "total_rows": 8967,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 8807,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_pp",
    "metric": "hdgf_pct",
    "total_rows": 6589,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 6474,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_pp",
    "metric": "hdsf_pct",
    "total_rows": 8464,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 8275,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_pp",
    "metric": "scf_pct",
    "total_rows": 9626,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 9562,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_pp",
    "metric": "sf_pct",
    "total_rows": 9672,
    "fail_percent_scale_rows": 0,
    "fail_fraction_scale_rows": 9568,
    "min_pct_value": 0,
    "max_pct_value": 100
  },
  {
    "source_name": "nst_team_pp",
    "metric": "xgf_pct",
    "total_rows": 9747,
    "fail_percent_scale_rows": 1151,
    "fail_fraction_scale_rows": 9705,
    "min_pct_value": 0,
    "max_pct_value": 100
  }
]
```

### PASS: `nst_team_per60_identity_check`

Gamelog per-60 fields should match count * 3600 / TOI seconds.

```json
[
  {
    "source_name": "nst_team_gamelogs_as_rates",
    "metric": "ca_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_as_rates",
    "metric": "cf_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_as_rates",
    "metric": "ga_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_as_rates",
    "metric": "gf_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_as_rates",
    "metric": "hdca_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_as_rates",
    "metric": "hdcf_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_as_rates",
    "metric": "sa_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_as_rates",
    "metric": "sca_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_as_rates",
    "metric": "scf_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_as_rates",
    "metric": "sf_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_as_rates",
    "metric": "xga_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_as_rates",
    "metric": "xgf_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_pk_rates",
    "metric": "ca_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_pk_rates",
    "metric": "cf_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_pk_rates",
    "metric": "ga_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_pk_rates",
    "metric": "gf_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_pk_rates",
    "metric": "hdca_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_pk_rates",
    "metric": "hdcf_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_pk_rates",
    "metric": "sa_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_pk_rates",
    "metric": "sca_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_pk_rates",
    "metric": "scf_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_pk_rates",
    "metric": "sf_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_pk_rates",
    "metric": "xga_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_pk_rates",
    "metric": "xgf_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_pp_rates",
    "metric": "ca_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_pp_rates",
    "metric": "cf_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_pp_rates",
    "metric": "ga_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_pp_rates",
    "metric": "gf_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_pp_rates",
    "metric": "hdca_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_pp_rates",
    "metric": "hdcf_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_pp_rates",
    "metric": "sa_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_pp_rates",
    "metric": "sca_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_pp_rates",
    "metric": "scf_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_pp_rates",
    "metric": "sf_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_pp_rates",
    "metric": "xga_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  },
  {
    "source_name": "nst_team_gamelogs_pp_rates",
    "metric": "xgf_per_60",
    "total_rows": 0,
    "rate_mismatch_rows": 0,
    "max_abs_delta": null
  }
]
```

### WARN: `nst_team_count_rate_pairing_check`

NST count and rate gamelog tables should have matching team/date coverage within each situation family.

```json
[
  {
    "situation_family": "as",
    "count_rows_missing_rate_pair": 22,
    "rate_rows_missing_count_pair": 32
  },
  {
    "situation_family": "pk",
    "count_rows_missing_rate_pair": 0,
    "rate_rows_missing_count_pair": 20
  },
  {
    "situation_family": "pp",
    "count_rows_missing_rate_pair": 0,
    "rate_rows_missing_count_pair": 0
  }
]
```

### WARN: `nst_team_snapshot_semantics_check`

NST snapshot tables with GP greater than 1 are cumulative/snapshot rows, not one-game logs.

```json
[
  {
    "source_name": "nst_team_5v5",
    "rows": 9994,
    "rows_with_gp_gt_1": 5382,
    "min_gp": 1,
    "max_gp": 82,
    "gp_decrease_rows": 64
  },
  {
    "source_name": "nst_team_all",
    "rows": 10278,
    "rows_with_gp_gt_1": 5446,
    "min_gp": 1,
    "max_gp": 82,
    "gp_decrease_rows": 64
  },
  {
    "source_name": "nst_team_pk",
    "rows": 9788,
    "rows_with_gp_gt_1": 5350,
    "min_gp": 1,
    "max_gp": 82,
    "gp_decrease_rows": 64
  },
  {
    "source_name": "nst_team_pp",
    "rows": 9826,
    "rows_with_gp_gt_1": 5382,
    "min_gp": 1,
    "max_gp": 82,
    "gp_decrease_rows": 64
  }
]
```

### WARN: `nst_team_gamelog_gp_check`

NST gamelog tables should normally represent one team-game row when GP is populated.

```json
[
  {
    "source_name": "nst_team_gamelogs_as_counts",
    "rows": 2544,
    "null_gp_rows": 0,
    "rows_where_gp_not_1": 0,
    "min_gp": 1,
    "max_gp": 1
  },
  {
    "source_name": "nst_team_gamelogs_as_rates",
    "rows": 2554,
    "null_gp_rows": 0,
    "rows_where_gp_not_1": 32,
    "min_gp": 1,
    "max_gp": 24
  },
  {
    "source_name": "nst_team_gamelogs_pk_counts",
    "rows": 2493,
    "null_gp_rows": 0,
    "rows_where_gp_not_1": 32,
    "min_gp": 1,
    "max_gp": 24
  },
  {
    "source_name": "nst_team_gamelogs_pk_rates",
    "rows": 2513,
    "null_gp_rows": 0,
    "rows_where_gp_not_1": 32,
    "min_gp": 1,
    "max_gp": 24
  },
  {
    "source_name": "nst_team_gamelogs_pp_counts",
    "rows": 2513,
    "null_gp_rows": 0,
    "rows_where_gp_not_1": 32,
    "min_gp": 1,
    "max_gp": 24
  },
  {
    "source_name": "nst_team_gamelogs_pp_rates",
    "rows": 2513,
    "null_gp_rows": 0,
    "rows_where_gp_not_1": 32,
    "min_gp": 1,
    "max_gp": 24
  }
]
```


## WGO Team And Standings Semantics Checks

### PASS: `wgo_standings_duplicate_key_check`

WGO team stats and standings should have unique source-specific team/date keys.

```json
[
  {
    "source_name": "nhl_standings_details",
    "duplicate_keys": 0,
    "duplicate_key_rows": "0"
  },
  {
    "source_name": "wgo_team_stats",
    "duplicate_keys": 0,
    "duplicate_key_rows": "0"
  }
]
```

### WARN: `wgo_team_stats_identity_coverage`

Recent WGO team rows should resolve team, game, and opponent identities when IDs are supplied.

```json
[
  {
    "recent_rows": 9406,
    "null_team_id_rows": 0,
    "unmapped_team_id_rows": 0,
    "null_game_id_rows": 151,
    "unmapped_game_id_rows": 0,
    "null_opponent_id_rows": 151,
    "unmapped_opponent_id_rows": 0
  }
]
```

### PASS: `wgo_standings_date_freshness_check`

WGO and standings source freshness should be explicit for as-of feature joins.

```json
[
  {
    "source_name": "nhl_standings_details",
    "min_date": "2024-10-04",
    "max_date": "2026-04-17",
    "distinct_dates": 389,
    "days_since_latest": 10,
    "latest_date_team_count": 32
  },
  {
    "source_name": "wgo_team_stats",
    "min_date": "2010-10-07",
    "max_date": "2026-04-26",
    "distinct_dates": 2699,
    "days_since_latest": 1,
    "latest_date_team_count": 8
  }
]
```

### PASS: `wgo_team_stats_game_level_semantics_check`

Recent WGO team rows should normally be one team-game row when games_played is populated.

```json
[
  {
    "rows": 9406,
    "null_games_played_rows": 0,
    "rows_with_games_played_gt_1": 0,
    "min_games_played": 1,
    "max_games_played": 1
  }
]
```

### PASS: `wgo_team_stats_record_math_check`

WGO season-to-date wins, losses, OT losses, points, point percentage, and goals-per-game fields should be internally consistent.

```json
[
  {
    "rows": 9406,
    "points_mismatch_rows": 0,
    "record_sum_mismatch_rows": 0,
    "point_pct_mismatch_rows": 0,
    "goals_for_per_game_mismatch_rows": 0,
    "goals_against_per_game_mismatch_rows": 0,
    "goal_diff_extreme_rows": 0
  }
]
```

### WARN: `wgo_team_stats_rate_and_percentage_bounds_check`

WGO percentage and per-game/per-60 fields should stay within plausible hockey ranges.

```json
[
  {
    "rows": 9406,
    "invalid_percentage_rows": 0,
    "negative_rate_rows": 0,
    "extreme_goals_per_game_rows": 46,
    "extreme_shots_per_game_rows": 2,
    "min_point_pct": 0,
    "max_point_pct": 1,
    "min_power_play_pct": 0,
    "max_power_play_pct": 1,
    "min_penalty_kill_pct": 0,
    "max_penalty_kill_pct": 1
  }
]
```

### PASS: `wgo_team_stats_faceoff_identity_check`

WGO faceoff totals should match won/lost components where all fields are populated.

```json
[
  {
    "rows": 9406,
    "total_faceoff_mismatch_rows": 0,
    "d_zone_faceoff_mismatch_rows": 0,
    "o_zone_faceoff_mismatch_rows": 0,
    "neutral_zone_faceoff_mismatch_rows": 0
  }
]
```

### PASS: `standings_record_math_check`

Standings record, points, goal differential, l10, home, and road split fields should be internally consistent.

```json
[
  {
    "rows": 12448,
    "points_mismatch_rows": 0,
    "record_sum_mismatch_rows": 0,
    "goal_diff_mismatch_rows": 0,
    "point_pctg_mismatch_rows": 0,
    "home_record_sum_mismatch_rows": 0,
    "road_record_sum_mismatch_rows": 0,
    "l10_record_sum_mismatch_rows": 0,
    "home_road_games_mismatch_rows": 0
  }
]
```

### PASS: `standings_percentage_bounds_check`

Standings percentage fields, goal-differential rate fields, and sequence ranks should stay within plausible ranges.

```json
[
  {
    "rows": 12448,
    "invalid_percentage_rows": 0,
    "invalid_sequence_rows": 0,
    "min_point_pctg": "0.00000",
    "max_point_pctg": "1.00000",
    "min_goal_differential_pctg": "-6.00000",
    "max_goal_differential_pctg": "6.00000"
  }
]
```


## Goalie Source Semantics Checks

### WARN: `goalie_start_probability_bounds_check`

`goalie_start_projections` probabilities and supporting start-rate fields should stay within valid ranges.

```json
[
  {
    "rows": 7133,
    "null_start_probability_rows": 0,
    "invalid_start_probability_rows": 0,
    "invalid_l10_start_pct_rows": 0,
    "invalid_season_start_pct_rows": 0,
    "extreme_projected_gsaa_rows": 9,
    "min_projected_gsaa_per_60": "-11.712918660287082",
    "max_projected_gsaa_per_60": "3.5"
  }
]
```

### WARN: `goalie_start_probability_sum_check`

Goalie starter probabilities should generally sum to 1 per game/team, and confirmed starters should be unique.

```json
[
  {
    "game_team_groups": 2692,
    "team_groups_with_probability_sum_issue": 27,
    "team_groups_with_multiple_confirmed_goalies": 0,
    "confirmed_goalies_with_probability_below_one": "0",
    "min_probability_sum": "0.4",
    "max_probability_sum": "1.05454545454545453"
  }
]
```

### PASS: `goalie_start_schedule_coverage_check`

Scheduled games in the goalie-projection date range should have goalie candidates for both teams.

```json
[
  {
    "team_game_sides": 2692,
    "team_game_sides_missing_goalie_candidates": 0,
    "min_candidate_rows": 1,
    "max_candidate_rows": 5
  }
]
```

### PASS: `wgo_goalie_game_level_semantics_check`

Recent WGO goalie rows should normally be one goalie-game row when games_played is populated.

```json
[
  {
    "rows": 9946,
    "null_games_played_rows": 0,
    "rows_with_games_played_gt_1": 0,
    "min_games_played": 1,
    "max_games_played": 1
  }
]
```

### WARN: `wgo_goalie_value_bounds_check`

Recent WGO goalie saves, shots, save percentage, GAA, and rest-split fields should stay plausible.

```json
[
  {
    "rows": 9946,
    "invalid_save_pct_rows": 0,
    "negative_count_rows": 0,
    "saves_exceed_shots_rows": 0,
    "extreme_gaa_rows": 58,
    "invalid_rest_save_pct_rows": 0,
    "min_save_pct": 0,
    "max_save_pct": 1,
    "min_goals_against_avg": 0,
    "max_goals_against_avg": 184.61538
  }
]
```

### WARN: `wgo_goalie_totals_as_of_safety_check`

WGO goalie totals are season-level totals with updated_at but no stat-date key, so they are not historical-training-safe without a snapshot rule.

```json
[
  {
    "rows": 4890,
    "min_updated_at": "2025-03-25 01:32:39.538+00",
    "max_updated_at": "2026-04-27 08:20:02.059+00",
    "null_updated_at_rows": 0
  }
]
```

### PASS: `nst_goalie_duplicate_key_check`

NST goalie tables should have one row per source/player/date.

```json
[
  {
    "source_name": "nst_gamelog_goalie_5v5_counts",
    "duplicate_keys": 0,
    "duplicate_key_rows": "0"
  },
  {
    "source_name": "nst_gamelog_goalie_5v5_rates",
    "duplicate_keys": 0,
    "duplicate_key_rows": "0"
  },
  {
    "source_name": "nst_gamelog_goalie_all_counts",
    "duplicate_keys": 0,
    "duplicate_key_rows": "0"
  },
  {
    "source_name": "nst_gamelog_goalie_all_rates",
    "duplicate_keys": 0,
    "duplicate_key_rows": "0"
  },
  {
    "source_name": "nst_gamelog_goalie_ev_counts",
    "duplicate_keys": 0,
    "duplicate_key_rows": "0"
  },
  {
    "source_name": "nst_gamelog_goalie_ev_rates",
    "duplicate_keys": 0,
    "duplicate_key_rows": "0"
  },
  {
    "source_name": "nst_gamelog_goalie_pk_counts",
    "duplicate_keys": 0,
    "duplicate_key_rows": "0"
  },
  {
    "source_name": "nst_gamelog_goalie_pk_rates",
    "duplicate_keys": 0,
    "duplicate_key_rows": "0"
  },
  {
    "source_name": "nst_gamelog_goalie_pp_counts",
    "duplicate_keys": 0,
    "duplicate_key_rows": "0"
  },
  {
    "source_name": "nst_gamelog_goalie_pp_rates",
    "duplicate_keys": 0,
    "duplicate_key_rows": "0"
  }
]
```

### WARN: `nst_goalie_date_freshness_check`

NST goalie source latest dates should be explicit so stale goalie quality inputs are not treated as current.

```json
[
  {
    "source_name": "nst_gamelog_goalie_5v5_counts",
    "min_date": "2024-10-04",
    "max_date": "2026-04-09",
    "distinct_dates": 339,
    "days_since_latest": 18,
    "latest_date_goalie_count": 30
  },
  {
    "source_name": "nst_gamelog_goalie_5v5_rates",
    "min_date": "2024-10-04",
    "max_date": "2026-04-09",
    "distinct_dates": 338,
    "days_since_latest": 18,
    "latest_date_goalie_count": 30
  },
  {
    "source_name": "nst_gamelog_goalie_all_counts",
    "min_date": "2024-10-04",
    "max_date": "2026-04-09",
    "distinct_dates": 335,
    "days_since_latest": 18,
    "latest_date_goalie_count": 30
  },
  {
    "source_name": "nst_gamelog_goalie_all_rates",
    "min_date": "2024-10-04",
    "max_date": "2026-04-09",
    "distinct_dates": 335,
    "days_since_latest": 18,
    "latest_date_goalie_count": 30
  },
  {
    "source_name": "nst_gamelog_goalie_ev_counts",
    "min_date": "2024-10-04",
    "max_date": "2026-04-09",
    "distinct_dates": 338,
    "days_since_latest": 18,
    "latest_date_goalie_count": 30
  },
  {
    "source_name": "nst_gamelog_goalie_ev_rates",
    "min_date": "2024-10-04",
    "max_date": "2026-04-09",
    "distinct_dates": 334,
    "days_since_latest": 18,
    "latest_date_goalie_count": 30
  },
  {
    "source_name": "nst_gamelog_goalie_pk_counts",
    "min_date": "2024-10-04",
    "max_date": "2026-04-09",
    "distinct_dates": 335,
    "days_since_latest": 18,
    "latest_date_goalie_count": 26
  },
  {
    "source_name": "nst_gamelog_goalie_pk_rates",
    "min_date": "2024-10-04",
    "max_date": "2026-04-09",
    "distinct_dates": 335,
    "days_since_latest": 18,
    "latest_date_goalie_count": 26
  },
  {
    "source_name": "nst_gamelog_goalie_pp_counts",
    "min_date": "2024-10-04",
    "max_date": "2026-04-09",
    "distinct_dates": 335,
    "days_since_latest": 18,
    "latest_date_goalie_count": 26
  },
  {
    "source_name": "nst_gamelog_goalie_pp_rates",
    "min_date": "2024-10-04",
    "max_date": "2026-04-09",
    "distinct_dates": 335,
    "days_since_latest": 18,
    "latest_date_goalie_count": 26
  }
]
```

### PASS: `nst_goalie_counts_identity_check`

NST goalie count rows should have nonnegative counts and saves/goals should not exceed shots against.

```json
[
  {
    "source_name": "nst_gamelog_goalie_5v5_counts",
    "rows": 5422,
    "negative_count_rows": 0,
    "saves_exceed_shots_rows": 0,
    "goals_exceed_shots_rows": 0
  },
  {
    "source_name": "nst_gamelog_goalie_all_counts",
    "rows": 5352,
    "negative_count_rows": 0,
    "saves_exceed_shots_rows": 0,
    "goals_exceed_shots_rows": 0
  },
  {
    "source_name": "nst_gamelog_goalie_ev_counts",
    "rows": 5398,
    "negative_count_rows": 0,
    "saves_exceed_shots_rows": 0,
    "goals_exceed_shots_rows": 0
  },
  {
    "source_name": "nst_gamelog_goalie_pk_counts",
    "rows": 5116,
    "negative_count_rows": 0,
    "saves_exceed_shots_rows": 0,
    "goals_exceed_shots_rows": 0
  },
  {
    "source_name": "nst_gamelog_goalie_pp_counts",
    "rows": 5114,
    "negative_count_rows": 0,
    "saves_exceed_shots_rows": 0,
    "goals_exceed_shots_rows": 0
  }
]
```

### WARN: `nst_goalie_rate_bounds_check`

NST goalie rate rows should stay nonnegative and within plausible hockey ranges.

```json
[
  {
    "source_name": "nst_gamelog_goalie_5v5_rates",
    "rows": 5395,
    "negative_rate_rows": 0,
    "invalid_save_pct_rows": 0,
    "extreme_rate_rows": 15,
    "min_sv_percentage": "0",
    "max_sv_percentage": "1"
  },
  {
    "source_name": "nst_gamelog_goalie_all_rates",
    "rows": 5352,
    "negative_rate_rows": 0,
    "invalid_save_pct_rows": 0,
    "extreme_rate_rows": 16,
    "min_sv_percentage": "0",
    "max_sv_percentage": "1"
  },
  {
    "source_name": "nst_gamelog_goalie_ev_rates",
    "rows": 5323,
    "negative_rate_rows": 0,
    "invalid_save_pct_rows": 0,
    "extreme_rate_rows": 15,
    "min_sv_percentage": "0",
    "max_sv_percentage": "1"
  },
  {
    "source_name": "nst_gamelog_goalie_pk_rates",
    "rows": 5116,
    "negative_rate_rows": 0,
    "invalid_save_pct_rows": 0,
    "extreme_rate_rows": 1070,
    "min_sv_percentage": "0",
    "max_sv_percentage": "1"
  },
  {
    "source_name": "nst_gamelog_goalie_pp_rates",
    "rows": 5113,
    "negative_rate_rows": 0,
    "invalid_save_pct_rows": 0,
    "extreme_rate_rows": 49,
    "min_sv_percentage": "0",
    "max_sv_percentage": "1"
  }
]
```


## Lineup And Player Context Checks

### WARN: `line_combinations_game_side_coverage_check`

`lineCombinations` should be understood as game/team context and should not be assumed complete for all historical training rows.

```json
[
  {
    "team_game_sides": 2792,
    "team_game_sides_missing_line_combinations": 50,
    "min_lineup_rows": 0,
    "max_lineup_rows": 1
  }
]
```

### WARN: `line_source_freshness_and_status_check`

Prospective line-source tables should be treated as sparse/current-context inputs until historical coverage is proven.

```json
[
  {
    "source_name": "lines_ccc",
    "rows": 7,
    "observed_or_accepted_rows": 7,
    "min_snapshot_date": "2026-04-25",
    "max_snapshot_date": "2026-04-25",
    "max_observed_at": "2026-04-25 01:11:34.089855+00",
    "days_since_latest_observed_at": 2,
    "null_game_id_rows": 7,
    "null_team_id_rows": 0
  },
  {
    "source_name": "lines_dfo",
    "rows": 14,
    "observed_or_accepted_rows": 8,
    "min_snapshot_date": "2026-04-22",
    "max_snapshot_date": "2026-04-23",
    "max_observed_at": "2026-04-23 01:40:13.546+00",
    "days_since_latest_observed_at": 4,
    "null_game_id_rows": 0,
    "null_team_id_rows": 0
  },
  {
    "source_name": "lines_gdl",
    "rows": 42,
    "observed_or_accepted_rows": 42,
    "min_snapshot_date": "2026-04-22",
    "max_snapshot_date": "2026-04-23",
    "max_observed_at": "2026-04-23 14:07:26.073+00",
    "days_since_latest_observed_at": 4,
    "null_game_id_rows": 0,
    "null_team_id_rows": 0
  },
  {
    "source_name": "lines_nhl",
    "rows": 30,
    "observed_or_accepted_rows": 30,
    "min_snapshot_date": "2026-04-22",
    "max_snapshot_date": "2026-04-22",
    "max_observed_at": "2026-04-23 13:38:04.818+00",
    "days_since_latest_observed_at": 4,
    "null_game_id_rows": 0,
    "null_team_id_rows": 0
  }
]
```

### WARN: `forge_projection_context_coverage_check`

FORGE player, goalie, and team projection tables are optional context and should be gated by freshness and game coverage.

```json
[
  {
    "source_name": "forge_goalie_projections",
    "rows": 2563,
    "distinct_games": 1082,
    "min_as_of_date": "2025-10-07",
    "max_as_of_date": "2026-04-16",
    "days_since_latest_as_of_date": 11,
    "min_horizon_games": 1,
    "max_horizon_games": 1,
    "null_game_id_rows": 0,
    "null_team_id_rows": 0
  },
  {
    "source_name": "forge_player_projections",
    "rows": 27568,
    "distinct_games": 1085,
    "min_as_of_date": "2025-10-07",
    "max_as_of_date": "2026-04-16",
    "days_since_latest_as_of_date": 11,
    "min_horizon_games": 1,
    "max_horizon_games": 1,
    "null_game_id_rows": 0,
    "null_team_id_rows": 0
  },
  {
    "source_name": "forge_team_projections",
    "rows": 2571,
    "distinct_games": 1085,
    "min_as_of_date": "2025-10-07",
    "max_as_of_date": "2026-04-16",
    "days_since_latest_as_of_date": 11,
    "min_horizon_games": 1,
    "max_horizon_games": 1,
    "null_game_id_rows": 0,
    "null_team_id_rows": 0
  }
]
```

### WARN: `forge_roster_events_coverage_check`

`forge_roster_events` is optional availability/news context and should not be required when empty.

```json
[
  {
    "rows": 0,
    "min_effective_from": null,
    "max_effective_from": null,
    "null_event_type_rows": 0,
    "null_confidence_rows": 0
  }
]
```


## Storage And Provenance Checks

### WARN: `prediction_output_history_contract_check`

`game_prediction_outputs` and `player_prediction_outputs` are suitable as latest/serving rows only if they cannot preserve multiple same-day same-model predictions without an additional history key.

```json
[
  {
    "table_name": "game_prediction_outputs",
    "pk_columns": "{snapshot_date,game_id,model_name,model_version,prediction_scope}",
    "columns": "{snapshot_date,game_id,model_name,model_version,prediction_scope,home_team_id,away_team_id,home_win_probability,away_win_probability,home_expected_goals,away_expected_goals,total_expected_goals,spread_projection,components,provenance,metadata,computed_at,updated_at}",
    "rows": 0,
    "pk_includes_computed_at": false,
    "has_prediction_id": false,
    "has_feature_snapshot_id": false,
    "has_run_id": false
  },
  {
    "table_name": "player_prediction_outputs",
    "pk_columns": "{snapshot_date,player_id,model_name,model_version,prediction_scope,metric_key,game_id}",
    "columns": "{snapshot_date,game_id,player_id,team_id,opponent_team_id,model_name,model_version,prediction_scope,metric_key,expected_value,floor_value,ceiling_value,probability_over,line_value,components,provenance,metadata,computed_at,updated_at}",
    "rows": 0,
    "pk_includes_computed_at": false,
    "has_prediction_id": false,
    "has_feature_snapshot_id": false,
    "has_run_id": false
  }
]
```

### PASS: `prediction_output_payload_contract_check`

Prediction output tables should expose probability/output fields plus JSON payloads for components, provenance, metadata, and timestamps for reproducibility.

```json
[
  {
    "table_name": "game_prediction_outputs",
    "rows": 0,
    "missing_required_columns": 0,
    "null_payload_rows": 0,
    "invalid_probability_rows": 0
  },
  {
    "table_name": "player_prediction_outputs",
    "rows": 0,
    "missing_required_columns": 0,
    "null_payload_rows": 0,
    "invalid_probability_rows": 0
  }
]
```

### WARN: `forge_runs_game_model_metadata_fit_check`

`forge_runs` can carry run metadata, status, git SHA, and coarse metrics, but game prediction metrics still need explicit model/version/feature-set segmentation if metrics are not populated with that contract.

```json
[
  {
    "rows": 213,
    "min_as_of_date": "2025-10-07",
    "max_as_of_date": "2026-04-16",
    "days_since_latest_as_of_date": 11,
    "succeeded_rows": 199,
    "failed_rows": 14,
    "empty_metrics_rows": 0,
    "null_git_sha_rows": 145
  }
]
```

### WARN: `source_provenance_snapshots_freshness_contract_check`

`source_provenance_snapshots` has the right freshness/provenance shape, but model use depends on current, non-expired, source-specific coverage.

```json
[
  {
    "rows": 132,
    "distinct_source_names": 8,
    "min_observed_at": "2026-04-21 14:38:56.544+00",
    "max_observed_at": "2026-04-23 14:07:26.073+00",
    "max_freshness_expires_at": "2026-04-25 23:18:28.044+00",
    "null_freshness_rows": 97,
    "expired_freshness_rows": 35,
    "non_observed_rows": 34,
    "empty_payload_rows": 0
  }
]
```


## Row-Level Data Quality Checks

### PASS: `recent_games_required_fields_check`

Recent and near-future schedule rows should have usable home/away teams, season/date/start time, and no duplicate natural matchups.

```json
[
  {
    "rows": 1396,
    "min_date": "2025-10-01",
    "max_date": "2026-05-03",
    "null_required_rows": 0,
    "home_equals_away_rows": 0,
    "missing_home_team_rows": 0,
    "missing_away_team_rows": 0,
    "duplicate_natural_key_groups": 0
  }
]
```

### PASS: `planned_source_duplicate_key_check`

Representative natural keys should not contain duplicate groups that would make as-of joins ambiguous.

```json
[
  {
    "source_name": "goalie_start_projections",
    "duplicate_key_groups": 0,
    "duplicate_rows_above_one_per_key": "0"
  },
  {
    "source_name": "lineCombinations",
    "duplicate_key_groups": 0,
    "duplicate_rows_above_one_per_key": "0"
  },
  {
    "source_name": "nhl_standings_details",
    "duplicate_key_groups": 0,
    "duplicate_rows_above_one_per_key": "0"
  },
  {
    "source_name": "nst_team_gamelogs_as_counts",
    "duplicate_key_groups": 0,
    "duplicate_rows_above_one_per_key": "0"
  },
  {
    "source_name": "nst_team_gamelogs_as_rates",
    "duplicate_key_groups": 0,
    "duplicate_rows_above_one_per_key": "0"
  },
  {
    "source_name": "team_power_ratings_daily",
    "duplicate_key_groups": 0,
    "duplicate_rows_above_one_per_key": "0"
  },
  {
    "source_name": "wgo_team_stats",
    "duplicate_key_groups": 0,
    "duplicate_rows_above_one_per_key": "0"
  }
]
```

### WARN: `core_recent_value_bounds_check`

Core recent feature tables should not contain null identity fields, impossible probabilities, negative impossible counts/rates, or extreme values that need clipping.

```json
[
  {
    "source_name": "team_power_ratings_daily",
    "rows": 6387,
    "null_identity_rows": 0,
    "invalid_probability_rows": 0,
    "negative_value_rows": 0,
    "extreme_value_rows": 0
  },
  {
    "source_name": "wgo_team_stats",
    "rows": 2686,
    "null_identity_rows": 0,
    "invalid_probability_rows": 0,
    "negative_value_rows": 0,
    "extreme_value_rows": 16
  },
  {
    "source_name": "nhl_standings_details",
    "rows": 6176,
    "null_identity_rows": 0,
    "invalid_probability_rows": 0,
    "negative_value_rows": 0,
    "extreme_value_rows": 0
  },
  {
    "source_name": "goalie_start_projections",
    "rows": 7133,
    "null_identity_rows": 0,
    "invalid_probability_rows": 0,
    "negative_value_rows": 0,
    "extreme_value_rows": 9
  }
]
```

### WARN: `nst_team_recent_row_quality_check`

NST team gamelog rows should have nonnegative counts/rates, percent-scale percentages, and one-game rows for rolling-window usage.

```json
[
  {
    "source_name": "nst_team_gamelogs_as_counts",
    "rows": 2544,
    "null_identity_rows": 0,
    "negative_value_rows": 0,
    "invalid_percentage_rows": 0,
    "non_one_game_rows": 0
  },
  {
    "source_name": "nst_team_gamelogs_as_rates",
    "rows": 2554,
    "null_identity_rows": 0,
    "negative_value_rows": 0,
    "invalid_percentage_rows": 0,
    "non_one_game_rows": 32
  },
  {
    "source_name": "nst_team_gamelogs_pk_counts",
    "rows": 2493,
    "null_identity_rows": 0,
    "negative_value_rows": 0,
    "invalid_percentage_rows": 0,
    "non_one_game_rows": 32
  },
  {
    "source_name": "nst_team_gamelogs_pk_rates",
    "rows": 2513,
    "null_identity_rows": 0,
    "negative_value_rows": 0,
    "invalid_percentage_rows": 0,
    "non_one_game_rows": 32
  },
  {
    "source_name": "nst_team_gamelogs_pp_counts",
    "rows": 2513,
    "null_identity_rows": 0,
    "negative_value_rows": 0,
    "invalid_percentage_rows": 0,
    "non_one_game_rows": 32
  },
  {
    "source_name": "nst_team_gamelogs_pp_rates",
    "rows": 2513,
    "null_identity_rows": 0,
    "negative_value_rows": 0,
    "invalid_percentage_rows": 0,
    "non_one_game_rows": 32
  }
]
```

### WARN: `recent_game_side_core_source_coverage_check`

Each recent game/team side should have reasonably current team-power and standings context available before or on game date.

```json
[
  {
    "team_game_sides": 2748,
    "missing_recent_team_power_rows": 56,
    "missing_recent_standings_rows": 56
  }
]
```


## As-Of And Leakage Checks

### WARN: `latest_only_view_exclusion_check`

Latest-only display views should not be used for historical training rows because they encode current database state instead of an as-of cutoff.

```json
[
  {
    "relation_name": "nhl_team_data",
    "relation_exists": true,
    "is_planned_source": false
  }
]
```

### WARN: `team_feature_strict_pregame_as_of_coverage_check`

Historical team features should be joinable from rows dated before the game date; same-day-only joins are leakage-prone for completed games.

```json
[
  {
    "team_game_sides": 2748,
    "missing_team_power_before_game_rows": 88,
    "missing_standings_before_game_rows": 0,
    "missing_wgo_before_game_rows": 88,
    "team_power_same_day_only_rows": 32,
    "standings_same_day_only_rows": 0,
    "wgo_same_day_only_rows": 0
  }
]
```

### WARN: `goalie_projection_temporal_safety_check`

`goalie_start_projections` has timestamps, but rows created or updated after scheduled puck drop cannot be used for historical pregame training at that cutoff.

```json
[
  {
    "rows_joined_to_games": 7133,
    "null_created_at_rows": 0,
    "created_after_start_rows": 5270,
    "updated_after_start_rows": 5270,
    "min_created_at": "2025-12-05 18:19:42.841493+00",
    "max_created_at": "2026-04-27 09:30:03.748284+00"
  }
]
```

### WARN: `lineup_source_temporal_safety_check`

Lineup sources need observed/snapshot timestamps before game start for historical training; `lineCombinations` has no observation timestamp and should remain current/explanation-only unless provenance is added.

```json
[
  {
    "source_name": "lineCombinations",
    "rows_with_game_id": 11930,
    "rows_joined_to_games": 11930,
    "observed_after_start_rows": null,
    "has_observed_at_column": false
  },
  {
    "source_name": "lines_ccc",
    "rows_with_game_id": 0,
    "rows_joined_to_games": 0,
    "observed_after_start_rows": 0,
    "has_observed_at_column": true
  },
  {
    "source_name": "lines_dfo",
    "rows_with_game_id": 14,
    "rows_joined_to_games": 14,
    "observed_after_start_rows": 0,
    "has_observed_at_column": true
  },
  {
    "source_name": "lines_gdl",
    "rows_with_game_id": 42,
    "rows_joined_to_games": 42,
    "observed_after_start_rows": 20,
    "has_observed_at_column": true
  },
  {
    "source_name": "lines_nhl",
    "rows_with_game_id": 30,
    "rows_joined_to_games": 30,
    "observed_after_start_rows": 18,
    "has_observed_at_column": true
  }
]
```

### WARN: `forge_projection_as_of_date_safety_check`

FORGE projections use date-level `as_of_date`; rows on or after the game date need timestamp provenance or conservative exclusion for strict pregame training.

```json
[
  {
    "source_name": "forge_goalie_projections",
    "rows": 2563,
    "null_as_of_date_rows": 0,
    "rows_joined_to_games": 2563,
    "as_of_on_or_after_game_date_rows": 2561,
    "min_as_of_date": "2025-10-07",
    "max_as_of_date": "2026-04-16"
  },
  {
    "source_name": "forge_player_projections",
    "rows": 27568,
    "null_as_of_date_rows": 0,
    "rows_joined_to_games": 27568,
    "as_of_on_or_after_game_date_rows": 27548,
    "min_as_of_date": "2025-10-07",
    "max_as_of_date": "2026-04-16"
  },
  {
    "source_name": "forge_team_projections",
    "rows": 2571,
    "null_as_of_date_rows": 0,
    "rows_joined_to_games": 2571,
    "as_of_on_or_after_game_date_rows": 2569,
    "min_as_of_date": "2025-10-07",
    "max_as_of_date": "2026-04-16"
  }
]
```


## Per-Source Details

### `games`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 28344
- Planned use: Schedule identity, home/away teams, season, start time.
- Notes: Backbone for schedule, rest, home ice, matchup, and result joins.
- Primary key: `id`
- Foreign keys: `games_awayTeamId_fkey: FOREIGN KEY ("awayTeamId") REFERENCES teams(id)`; `games_homeTeamId_fkey: FOREIGN KEY ("homeTeamId") REFERENCES teams(id)`; `games_seasonId_fkey: FOREIGN KEY ("seasonId") REFERENCES seasons(id)`
- Indexes: `games_pkey`, `idx_games_date`
- Date coverage: `date`: 2003-10-08 to 2026-05-03; `startTime`: 2003-10-09 00:00:00+00 to 2026-05-03 16:00:00+00; `created_at`: 2024-01-11 05:42:18.048305+00 to 2026-04-18 03:00:02.901368+00
- Planned key columns present: `id`, `date`, `seasonId`, `startTime`, `homeTeamId`, `awayTeamId`
- Planned key columns missing: None
- Column count: 8

### `teams`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 62
- Planned use: Team identity and abbreviation mapping.
- Notes: Must reconcile with NST/WGO team abbreviations.
- Primary key: `id`
- Foreign keys: None
- Indexes: `teams_pkey`
- Date coverage: No planned date columns found
- Planned key columns present: `id`, `abbreviation`, `name`
- Planned key columns missing: None
- Column count: 4

### `players`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 2882
- Planned use: Player and goalie identity.
- Notes: Goalies are represented as players; player team assignments can be stale.
- Primary key: `id`
- Foreign keys: None
- Indexes: `players_pkey`
- Date coverage: `birthDate`: 1969-01-09 to 2007-09-05
- Planned key columns present: `id`, `fullName`, `position`, `team_id`
- Planned key columns missing: None
- Column count: 13

### `seasons`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 108
- Planned use: Season identity for schedule joins.
- Notes: Needed to interpret season IDs in `games` and stat tables.
- Primary key: `id`
- Foreign keys: None
- Indexes: `seasons_pkey`
- Date coverage: No planned date columns found
- Planned key columns present: `id`
- Planned key columns missing: None
- Column count: 6

### `team_power_ratings_daily`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 5683
- Planned use: Primary team-strength ratings and EWMA-derived team features.
- Notes: Must be mathematically audited before model use.
- Primary key: `team_abbreviation`, `date`
- Foreign keys: None
- Indexes: `idx_team_power_ratings_daily_date`, `team_power_ratings_daily_pkey`
- Date coverage: `date`: 2025-10-07 to 2026-04-27; `created_at`: 2025-12-07 02:26:09.704494+00 to 2026-04-27 09:15:02.986285+00
- Planned key columns present: `team_abbreviation`, `date`, `off_rating`, `def_rating`, `xgf60`, `xga60`
- Planned key columns missing: None
- Column count: 22

### `nst_team_gamelogs_as_counts`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 2134
- Planned use: Game-level all-situation NST team counts.
- Notes: Candidate source for rolling/as-of team xG and shot features.
- Primary key: `id`
- Foreign keys: None
- Indexes: `idx_nst_team_gamelogs_as_counts_date`, `idx_nst_team_gamelogs_as_counts_season`, `nst_team_gamelogs_as_counts_pkey`, `nst_team_gamelogs_as_counts_unique`
- Date coverage: `date`: 2025-10-07 to 2026-04-11
- Planned key columns present: `team_abbreviation`, `season_id`, `date`, `xgf`, `xga`, `cf`, `ca`
- Planned key columns missing: None
- Column count: 113

### `nst_team_gamelogs_as_rates`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 1968
- Planned use: Game-level all-situation NST team rates.
- Notes: Candidate source for rolling/as-of per-60 team features.
- Primary key: None
- Foreign keys: None
- Indexes: `idx_nst_team_gamelogs_as_rates_date`, `idx_nst_team_gamelogs_as_rates_season`, `nst_team_gamelogs_as_rates_unique`
- Date coverage: `date`: 2025-10-06 to 2026-04-11
- Planned key columns present: `team_abbreviation`, `season_id`, `date`, `xgf_per_60`, `xga_per_60`
- Planned key columns missing: None
- Column count: 113

### `nst_team_gamelogs_pp_counts`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 1939
- Planned use: Game-level power-play NST team counts.
- Notes: Upstream source for team power-rating special-teams features and PP feature candidates.
- Primary key: None
- Foreign keys: None
- Indexes: `idx_nst_team_gamelogs_pp_counts_date`, `idx_nst_team_gamelogs_pp_counts_season`, `nst_team_gamelogs_pp_counts_unique`
- Date coverage: `date`: 2025-10-06 to 2026-04-11
- Planned key columns present: `team_abbreviation`, `season_id`, `date`, `xgf`, `xga`, `cf`, `ca`
- Planned key columns missing: None
- Column count: 113

### `nst_team_gamelogs_pp_rates`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 1939
- Planned use: Game-level power-play NST team rates.
- Notes: Read by `web/lib/power-ratings.ts` for PP offensive rating inputs.
- Primary key: None
- Foreign keys: None
- Indexes: `idx_nst_team_gamelogs_pp_rates_date`, `idx_nst_team_gamelogs_pp_rates_season`, `nst_team_gamelogs_pp_rates_unique`
- Date coverage: `date`: 2025-10-06 to 2026-04-11
- Planned key columns present: `team_abbreviation`, `season_id`, `date`, `xgf_per_60`, `xga_per_60`
- Planned key columns missing: None
- Column count: 113

### `nst_team_gamelogs_pk_counts`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 1919
- Planned use: Game-level penalty-kill NST team counts.
- Notes: Upstream source for team power-rating special-teams features and PK feature candidates.
- Primary key: None
- Foreign keys: None
- Indexes: `idx_nst_team_gamelogs_pk_counts_date`, `idx_nst_team_gamelogs_pk_counts_season`, `nst_team_gamelogs_pk_counts_unique`
- Date coverage: `date`: 2025-10-06 to 2026-04-11
- Planned key columns present: `team_abbreviation`, `season_id`, `date`, `xgf`, `xga`, `cf`, `ca`
- Planned key columns missing: None
- Column count: 113

### `nst_team_gamelogs_pk_rates`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 1965
- Planned use: Game-level penalty-kill NST team rates.
- Notes: Read by `web/lib/power-ratings.ts` for PK defensive rating inputs.
- Primary key: None
- Foreign keys: None
- Indexes: `idx_nst_team_gamelogs_pk_rates_date`, `idx_nst_team_gamelogs_pk_rates_season`, `nst_team_gamelogs_pk_rates_unique`
- Date coverage: `date`: 2025-10-06 to 2026-04-11
- Planned key columns present: `team_abbreviation`, `season_id`, `date`, `xgf_per_60`, `xga_per_60`
- Planned key columns missing: None
- Column count: 113

### `nst_team_5v5`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 9904
- Planned use: NST 5v5 team snapshot/table.
- Notes: Use carefully: verify whether rows are daily snapshots or cumulative.
- Primary key: `team_abbreviation`, `date`
- Foreign keys: None
- Indexes: `nst_team_5v5_pkey`
- Date coverage: `date`: 2024-10-04 to 2026-03-21; `created_at`: 2024-10-16 19:59:24.071374 to 2026-03-23 08:10:04.683241; `updated_at`: 2024-10-16 19:59:24.071374 to 2026-03-23 08:10:04.683241
- Planned key columns present: `team_abbreviation`, `date`, `xgf`, `xga`, `cf`, `ca`
- Planned key columns missing: None
- Column count: 42

### `nst_team_all`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 10222
- Planned use: NST all-situation team snapshot/table.
- Notes: Use carefully: verify whether rows are daily snapshots or cumulative.
- Primary key: `team_abbreviation`, `date`
- Foreign keys: None
- Indexes: `nst_team_all_pkey`
- Date coverage: `date`: 2024-10-04 to 2026-03-21; `created_at`: 2024-10-16 19:59:10.958807 to 2026-03-22 08:10:03.670928; `updated_at`: 2024-10-16 19:59:10.958807 to 2026-03-22 08:10:03.670928
- Planned key columns present: `team_abbreviation`, `date`, `xgf`, `xga`, `cf`, `ca`
- Planned key columns missing: None
- Column count: 42

### `nst_team_pp`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 9736
- Planned use: NST team power-play context.
- Notes: Secondary feature source for special-teams matchup terms.
- Primary key: `team_abbreviation`, `date`
- Foreign keys: None
- Indexes: `nst_team_pp_pkey`
- Date coverage: `date`: 2024-10-04 to 2026-03-21; `created_at`: 2024-10-16 19:59:36.769906 to 2026-03-23 08:10:05.158759; `updated_at`: 2024-10-16 19:59:36.769906 to 2026-03-23 08:10:05.158759
- Planned key columns present: `team_abbreviation`, `date`, `xgf`, `xga`, `gf`, `ga`
- Planned key columns missing: None
- Column count: 42

### `nst_team_pk`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 9698
- Planned use: NST team penalty-kill context.
- Notes: Secondary feature source for special-teams matchup terms.
- Primary key: `team_abbreviation`, `date`
- Foreign keys: None
- Indexes: `nst_team_pk_pkey`
- Date coverage: `date`: 2024-10-04 to 2026-03-21; `created_at`: 2024-10-16 19:59:49.492721 to 2026-03-23 08:10:05.64405; `updated_at`: 2024-10-16 19:59:49.492721 to 2026-03-23 08:10:05.64405
- Planned key columns present: `team_abbreviation`, `date`, `xgf`, `xga`, `gf`, `ga`
- Planned key columns missing: None
- Column count: 42

### `wgo_team_stats`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 35696
- Planned use: WGO team season/day stats including goals, shots, PP/PK, and discipline.
- Notes: Recent rows audit as team-game rows; use game/date keys and handle null game/opponent IDs.
- Primary key: `id`
- Foreign keys: None
- Indexes: `unique_season_team_date`, `wgo_team_stats_pkey`
- Date coverage: `date`: 2010-10-07 to 2026-04-26
- Planned key columns present: `team_id`, `franchise_name`, `season_id`, `date`
- Planned key columns missing: None
- Column count: 158

### `nhl_standings_details`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 12448
- Planned use: Dated standings, l10, home/road, and goal differential context.
- Notes: Useful for dated record/form context and preseason/current-season shrinkage.
- Primary key: `season_id`, `date`, `team_abbrev`
- Foreign keys: None
- Indexes: `nhl_standings_pkey`
- Date coverage: `date`: 2024-10-04 to 2026-04-17
- Planned key columns present: `season_id`, `date`, `team_abbrev`
- Planned key columns missing: None
- Column count: 76

### `goalie_start_projections`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 6059
- Planned use: Starter probability, confirmation status, and projected goalie quality.
- Notes: Must validate probability bounds and per-game/team sums.
- Primary key: `game_id`, `player_id`
- Foreign keys: None
- Indexes: `goalie_start_projections_pkey`, `idx_goalie_start_projections_game`, `idx_goalie_start_projections_player`, `idx_goalie_start_projections_team`
- Date coverage: `game_date`: 2025-10-07 to 2026-04-27; `created_at`: 2025-12-05 18:19:42.841493+00 to 2026-04-27 09:30:03.748284+00; `updated_at`: 2025-12-05 18:19:42.841493+00 to 2026-04-27 09:30:03.748284+00
- Planned key columns present: `game_id`, `team_id`, `player_id`, `start_probability`, `confirmed_status`
- Planned key columns missing: None
- Column count: 12

### `wgo_goalie_stats`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 150649
- Planned use: Goalie game/dated stats, rest splits, save percentage, and GAA.
- Notes: Core goalie-quality source if joined as-of.
- Primary key: `goalie_id`, `date`
- Foreign keys: None
- Indexes: `goalie_name_norm_btree`, `idx_wgo_goalie_stats_date`, `unique_goalie_date`, `wgo_goalie_stats_pkey`
- Date coverage: `date`: 1917-12-19 to 2026-04-26
- Planned key columns present: `goalie_id`, `date`, `season_id`, `save_pct`, `goals_against_avg`
- Planned key columns missing: None
- Column count: 39

### `wgo_goalie_stats_totals`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 4890
- Planned use: Goalie season totals.
- Notes: Not as-of safe by itself for historical training unless snapshotted by date.
- Primary key: `goalie_id`, `season_id`
- Foreign keys: None
- Indexes: `wgo_goalie_stats_totals_pkey`
- Date coverage: `updated_at`: 2025-03-25 01:32:39.538+00 to 2026-04-27 08:20:02.059+00
- Planned key columns present: `goalie_id`, `season_id`, `save_pct`, `goals_against_avg`
- Planned key columns missing: None
- Column count: 29

### `vw_goalie_stats_unified`

- Priority: core
- Relation type: view
- Metadata mode: management_api_sql
- Row count: n/a
- Planned use: Unified WGO/NST goalie view.
- Notes: Convenient source, but validate view definition and as-of safety.
- Primary key: None
- Foreign keys: None
- Indexes: None
- Date coverage: `date`: 2023-01-01 to 2026-04-26
- Planned key columns present: `player_id`, `date`, `season_id`, `team_id`
- Planned key columns missing: None
- Column count: 305

### `nst_gamelog_goalie_all_counts`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 5340
- Planned use: NST goalie all-situation counts.
- Notes: Goalie xGA/GSAA input source.
- Primary key: `player_id`, `date_scraped`
- Foreign keys: None
- Indexes: `pk_nst_gamelog_goalie_all_counts`, `unique_all_counts`
- Date coverage: `date_scraped`: 2024-10-04 to 2026-04-09
- Planned key columns present: `player_id`, `date_scraped`, `season`, `xg_against`, `gsaa`
- Planned key columns missing: None
- Column count: 33

### `nst_gamelog_goalie_all_rates`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 5340
- Planned use: NST goalie all-situation rates.
- Notes: Goalie per-60 input source.
- Primary key: `player_id`, `date_scraped`
- Foreign keys: None
- Indexes: `pk_nst_gamelog_goalie_all_rates`, `unique_all_rates`
- Date coverage: `date_scraped`: 2024-10-04 to 2026-04-09
- Planned key columns present: `player_id`, `date_scraped`, `season`, `xg_against_per_60`, `gsaa_per_60`
- Planned key columns missing: None
- Column count: 33

### `nst_gamelog_goalie_5v5_counts`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 5410
- Planned use: NST goalie 5v5 counts.
- Notes: 5v5 goalie quality source.
- Primary key: `player_id`, `date_scraped`
- Foreign keys: None
- Indexes: `pk_nst_gamelog_goalie_5v5_counts`
- Date coverage: `date_scraped`: 2024-10-04 to 2026-04-09
- Planned key columns present: `player_id`, `date_scraped`, `season`, `xg_against`, `gsaa`
- Planned key columns missing: None
- Column count: 33

### `nst_gamelog_goalie_5v5_rates`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 5383
- Planned use: NST goalie 5v5 rates.
- Notes: 5v5 goalie quality source.
- Primary key: `player_id`, `date_scraped`
- Foreign keys: None
- Indexes: `pk_nst_gamelog_goalie_5v5_rates`
- Date coverage: `date_scraped`: 2024-10-04 to 2026-04-09
- Planned key columns present: `player_id`, `date_scraped`, `season`, `xg_against_per_60`, `gsaa_per_60`
- Planned key columns missing: None
- Column count: 33

### `nst_gamelog_goalie_ev_counts`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 5386
- Planned use: NST goalie even-strength counts.
- Notes: Even-strength goalie quality source.
- Primary key: `player_id`, `date_scraped`
- Foreign keys: None
- Indexes: `pk_nst_gamelog_goalie_ev_counts`, `unique_ev_counts`
- Date coverage: `date_scraped`: 2024-10-04 to 2026-04-09
- Planned key columns present: `player_id`, `date_scraped`, `season`, `xg_against`, `gsaa`
- Planned key columns missing: None
- Column count: 33

### `nst_gamelog_goalie_ev_rates`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 5311
- Planned use: NST goalie even-strength rates.
- Notes: Even-strength goalie per-60 quality source.
- Primary key: `player_id`, `date_scraped`
- Foreign keys: None
- Indexes: `pk_nst_gamelog_goalie_ev_rates`, `unique_ev_rates`
- Date coverage: `date_scraped`: 2024-10-04 to 2026-04-09
- Planned key columns present: `player_id`, `date_scraped`, `season`, `xg_against_per_60`, `gsaa_per_60`
- Planned key columns missing: None
- Column count: 33

### `nst_gamelog_goalie_pk_counts`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 5104
- Planned use: NST goalie penalty-kill counts.
- Notes: Penalty-kill goalie quality source.
- Primary key: `player_id`, `date_scraped`
- Foreign keys: None
- Indexes: `pk_nst_gamelog_goalie_pk_counts`, `unique_pk_counts`
- Date coverage: `date_scraped`: 2024-10-04 to 2026-04-09
- Planned key columns present: `player_id`, `date_scraped`, `season`, `xg_against`, `gsaa`
- Planned key columns missing: None
- Column count: 33

### `nst_gamelog_goalie_pk_rates`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 5104
- Planned use: NST goalie penalty-kill rates.
- Notes: Penalty-kill goalie per-60 quality source.
- Primary key: `player_id`, `date_scraped`
- Foreign keys: None
- Indexes: `pk_nst_gamelog_goalie_pk_rates`, `unique_pk_rates`
- Date coverage: `date_scraped`: 2024-10-04 to 2026-04-09
- Planned key columns present: `player_id`, `date_scraped`, `season`, `xg_against_per_60`, `gsaa_per_60`
- Planned key columns missing: None
- Column count: 33

### `nst_gamelog_goalie_pp_counts`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 5103
- Planned use: NST goalie power-play counts.
- Notes: Power-play goalie quality source.
- Primary key: `player_id`, `date_scraped`
- Foreign keys: None
- Indexes: `pk_nst_gamelog_goalie_pp_counts`, `unique_pp_counts`
- Date coverage: `date_scraped`: 2024-10-04 to 2026-04-09
- Planned key columns present: `player_id`, `date_scraped`, `season`, `xg_against`, `gsaa`
- Planned key columns missing: None
- Column count: 33

### `nst_gamelog_goalie_pp_rates`

- Priority: core
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 5103
- Planned use: NST goalie power-play rates.
- Notes: Power-play goalie per-60 quality source.
- Primary key: `player_id`, `date_scraped`
- Foreign keys: None
- Indexes: `pk_nst_gamelog_goalie_pp_rates`, `unique_pp_rates`
- Date coverage: `date_scraped`: 2024-10-04 to 2026-04-09
- Planned key columns present: `player_id`, `date_scraped`, `season`, `xg_against_per_60`, `gsaa_per_60`
- Planned key columns missing: None
- Column count: 33

### `lineCombinations`

- Priority: optional
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 10920
- Planned use: Current/projected line combinations by game/team.
- Notes: Optional feature/explanation source; historical completeness must be verified.
- Primary key: `gameId`, `teamId`
- Foreign keys: `lineCombinations_gameId_fkey: FOREIGN KEY ("gameId") REFERENCES games(id)`; `lineCombinations_teamId_fkey: FOREIGN KEY ("teamId") REFERENCES teams(id)`
- Indexes: `lineCombinations_pkey`
- Date coverage: No planned date columns found
- Planned key columns present: `gameId`, `teamId`, `forwards`, `defensemen`, `goalies`
- Planned key columns missing: None
- Column count: 5

### `lines_nhl`

- Priority: optional
- Relation type: table
- Metadata mode: management_api_sql
- Row count: n/a
- Planned use: Historical NHL.com lineup snapshots.
- Notes: Prospective source snapshots; likely better for current context than backtests until coverage is known.
- Primary key: `capture_key`
- Foreign keys: `lines_nhl_game_id_fkey: FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE`; `lines_nhl_team_id_fkey: FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE`
- Indexes: `lines_nhl_game_idx`, `lines_nhl_pkey`, `lines_nhl_snapshot_date_idx`
- Date coverage: `snapshot_date`: 2026-04-22 to 2026-04-22; `observed_at`: 2026-04-23 01:00:56.479+00 to 2026-04-23 13:38:04.818+00; `updated_at`: 2026-04-23 01:00:57.372+00 to 2026-04-23 13:38:07.057+00
- Planned key columns present: `capture_key`, `snapshot_date`, `game_id`, `team_id`
- Planned key columns missing: None
- Column count: 36

### `lines_dfo`

- Priority: optional
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 8
- Planned use: Historical DailyFaceoff lineup snapshots.
- Notes: Optional lineup context source.
- Primary key: `capture_key`
- Foreign keys: `lines_dfo_game_id_fkey: FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE`; `lines_dfo_team_id_fkey: FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE`
- Indexes: `lines_dfo_game_idx`, `lines_dfo_pkey`, `lines_dfo_snapshot_date_idx`
- Date coverage: `snapshot_date`: 2026-04-22 to 2026-04-23; `observed_at`: 2026-04-21 14:38:56.544+00 to 2026-04-23 01:40:13.546+00; `updated_at`: 2026-04-23 01:02:05.293+00 to 2026-04-23 14:07:26.073+00
- Planned key columns present: `capture_key`, `snapshot_date`, `game_id`, `team_id`
- Planned key columns missing: None
- Column count: 36

### `lines_gdl`

- Priority: optional
- Relation type: table
- Metadata mode: management_api_sql
- Row count: n/a
- Planned use: Historical GameDayTweets lineup snapshots.
- Notes: Optional lineup context source.
- Primary key: `capture_key`
- Foreign keys: `lines_gdl_game_id_fkey: FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE`; `lines_gdl_team_id_fkey: FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE`
- Indexes: `lines_gdl_game_idx`, `lines_gdl_pkey`, `lines_gdl_snapshot_date_idx`
- Date coverage: `snapshot_date`: 2026-04-22 to 2026-04-23; `observed_at`: 2026-04-23 00:21:52.907+00 to 2026-04-23 14:07:26.073+00; `tweet_posted_at`: 2026-02-28 00:00:00+00 to 2026-04-20 04:00:00+00; `updated_at`: 2026-04-23 00:21:52.907+00 to 2026-04-23 14:07:26.073+00
- Planned key columns present: `capture_key`, `snapshot_date`, `game_id`, `team_id`
- Planned key columns missing: None
- Column count: 37

### `lines_ccc`

- Priority: optional
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 25
- Planned use: CCC tweet-derived lineup snapshots.
- Notes: Optional source; query only accepted observed NHL rows for model context.
- Primary key: `capture_key`
- Foreign keys: `lines_ccc_game_id_fkey: FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE`; `lines_ccc_team_id_fkey: FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE`
- Indexes: `lines_ccc_game_idx`, `lines_ccc_nhl_filter_status_idx`, `lines_ccc_pkey`, `lines_ccc_quoted_tweet_id_idx`, `lines_ccc_quoted_tweet_id_team_unique_idx`, `lines_ccc_snapshot_date_idx`, `lines_ccc_status_idx`, `lines_ccc_tweet_id_idx`, `lines_ccc_tweet_id_team_unique_idx`
- Date coverage: `snapshot_date`: 2026-04-25 to 2026-04-25; `observed_at`: 2026-04-24 21:46:50.425013+00 to 2026-04-25 01:11:34.089855+00; `tweet_posted_at`: 2026-04-24 00:00:00+00 to 2026-04-25 00:00:00+00; `updated_at`: 2026-04-26 18:24:02.161+00 to 2026-04-27 21:00:16.385+00
- Planned key columns present: `capture_key`, `snapshot_date`, `game_id`, `team_id`, `nhl_filter_status`
- Planned key columns missing: None
- Column count: 59

### `forge_roster_events`

- Priority: optional
- Relation type: table
- Metadata mode: management_api_sql
- Row count: n/a
- Planned use: Injury, lineup, transaction, and goalie-start events.
- Notes: Optional availability/news context with confidence weighting.
- Primary key: `event_id`
- Foreign keys: `roster_events_player_id_fkey: FOREIGN KEY (player_id) REFERENCES players(id)`; `roster_events_team_id_fkey: FOREIGN KEY (team_id) REFERENCES teams(id)`
- Indexes: `idx_roster_events_player_effective_from`, `idx_roster_events_team_effective_from`, `roster_events_pkey`
- Date coverage: `created_at`: null to null; `updated_at`: null to null; `effective_from`: null to null; `effective_to`: null to null
- Planned key columns present: `event_id`, `event_type`, `confidence`
- Planned key columns missing: None
- Column count: 11

### `forge_player_projections`

- Priority: optional
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 24100
- Planned use: FORGE player-level projection context.
- Notes: Optional player context; do not hard-block game predictions.
- Primary key: `run_id`, `game_id`, `player_id`, `horizon_games`
- Foreign keys: `player_projections_v2_game_id_fkey: FOREIGN KEY (game_id) REFERENCES games(id)`; `player_projections_v2_opponent_team_id_fkey: FOREIGN KEY (opponent_team_id) REFERENCES teams(id)`; `player_projections_v2_player_id_fkey: FOREIGN KEY (player_id) REFERENCES players(id)`; `player_projections_v2_run_id_fkey: FOREIGN KEY (run_id) REFERENCES forge_runs(run_id)`; `player_projections_v2_team_id_fkey: FOREIGN KEY (team_id) REFERENCES teams(id)`
- Indexes: `idx_player_projections_v2_as_of_date`, `idx_player_projections_v2_date_horizon`, `idx_player_projections_v2_date_opponent_horizon`, `idx_player_projections_v2_date_team_horizon`, `idx_player_projections_v2_game`, `idx_player_projections_v2_player`, `idx_player_projections_v2_team`, `player_projections_v2_pkey`
- Date coverage: `as_of_date`: 2025-10-07 to 2026-04-16; `created_at`: 2025-12-30 15:09:27.096935+00 to 2026-04-16 10:05:43.191771+00; `updated_at`: 2025-12-30 15:09:27.048+00 to 2026-04-16 10:05:43.149+00
- Planned key columns present: `run_id`, `game_id`, `player_id`, `team_id`, `horizon_games`
- Planned key columns missing: None
- Column count: 26

### `forge_goalie_projections`

- Priority: optional
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 2332
- Planned use: FORGE goalie projection context.
- Notes: Optional goalie projection context, separate from starter probabilities.
- Primary key: `run_id`, `game_id`, `goalie_id`, `horizon_games`
- Foreign keys: `goalie_projections_v2_game_id_fkey: FOREIGN KEY (game_id) REFERENCES games(id)`; `goalie_projections_v2_goalie_id_fkey: FOREIGN KEY (goalie_id) REFERENCES players(id)`; `goalie_projections_v2_opponent_team_id_fkey: FOREIGN KEY (opponent_team_id) REFERENCES teams(id)`; `goalie_projections_v2_run_id_fkey: FOREIGN KEY (run_id) REFERENCES forge_runs(run_id)`; `goalie_projections_v2_team_id_fkey: FOREIGN KEY (team_id) REFERENCES teams(id)`
- Indexes: `goalie_projections_v2_pkey`, `idx_goalie_projections_v2_as_of_date`, `idx_goalie_projections_v2_date_horizon`, `idx_goalie_projections_v2_date_team_horizon`, `idx_goalie_projections_v2_game`, `idx_goalie_projections_v2_goalie`
- Date coverage: `as_of_date`: 2025-10-07 to 2026-04-16; `created_at`: 2025-12-30 15:09:30.137261+00 to 2026-04-16 10:05:37.287603+00; `updated_at`: 2025-12-30 15:09:30.09+00 to 2026-04-16 10:05:37.257+00
- Planned key columns present: `run_id`, `game_id`, `goalie_id`, `team_id`, `horizon_games`
- Planned key columns missing: None
- Column count: 16

### `forge_team_projections`

- Priority: optional
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 2336
- Planned use: FORGE team-level projection context.
- Notes: Optional team projection context.
- Primary key: `run_id`, `game_id`, `team_id`, `horizon_games`
- Foreign keys: `team_projections_v2_game_id_fkey: FOREIGN KEY (game_id) REFERENCES games(id)`; `team_projections_v2_opponent_team_id_fkey: FOREIGN KEY (opponent_team_id) REFERENCES teams(id)`; `team_projections_v2_run_id_fkey: FOREIGN KEY (run_id) REFERENCES forge_runs(run_id)`; `team_projections_v2_team_id_fkey: FOREIGN KEY (team_id) REFERENCES teams(id)`
- Indexes: `idx_team_projections_v2_as_of_date`, `idx_team_projections_v2_date_horizon`, `idx_team_projections_v2_date_team_horizon`, `idx_team_projections_v2_game`, `idx_team_projections_v2_team`, `team_projections_v2_pkey`
- Date coverage: `as_of_date`: 2025-10-07 to 2026-04-16; `created_at`: 2025-12-30 15:09:27.180153+00 to 2026-04-16 10:05:43.236688+00; `updated_at`: 2025-12-30 15:09:27.139+00 to 2026-04-16 10:05:43.214+00
- Planned key columns present: `run_id`, `game_id`, `team_id`, `horizon_games`
- Planned key columns missing: None
- Column count: 18

### `game_prediction_outputs`

- Priority: storage
- Relation type: table
- Metadata mode: management_api_sql
- Row count: n/a
- Planned use: Latest/public game prediction output contract.
- Notes: Existing key cannot preserve repeated same-day outputs for the same model/game.
- Primary key: `snapshot_date`, `game_id`, `model_name`, `model_version`, `prediction_scope`
- Foreign keys: `game_prediction_outputs_away_team_id_fkey: FOREIGN KEY (away_team_id) REFERENCES teams(id)`; `game_prediction_outputs_game_id_fkey: FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE`; `game_prediction_outputs_home_team_id_fkey: FOREIGN KEY (home_team_id) REFERENCES teams(id)`
- Indexes: `game_prediction_outputs_pkey`
- Date coverage: `snapshot_date`: null to null; `computed_at`: null to null; `updated_at`: null to null
- Planned key columns present: `snapshot_date`, `game_id`, `model_name`, `model_version`, `prediction_scope`
- Planned key columns missing: None
- Column count: 18

### `player_prediction_outputs`

- Priority: storage
- Relation type: table
- Metadata mode: management_api_sql
- Row count: n/a
- Planned use: Player prediction output contract.
- Notes: Not core to game model v1, but useful for optional player context.
- Primary key: `snapshot_date`, `player_id`, `model_name`, `model_version`, `prediction_scope`, `metric_key`, `game_id`
- Foreign keys: `player_prediction_outputs_game_id_fkey: FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE`; `player_prediction_outputs_opponent_team_id_fkey: FOREIGN KEY (opponent_team_id) REFERENCES teams(id)`; `player_prediction_outputs_player_id_fkey: FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE`; `player_prediction_outputs_team_id_fkey: FOREIGN KEY (team_id) REFERENCES teams(id)`
- Indexes: `player_prediction_outputs_pkey`
- Date coverage: `snapshot_date`: null to null; `computed_at`: null to null; `updated_at`: null to null
- Planned key columns present: `snapshot_date`, `player_id`, `model_name`, `model_version`, `metric_key`
- Planned key columns missing: None
- Column count: 19

### `forge_runs`

- Priority: storage
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 173
- Planned use: FORGE run metadata and metrics.
- Notes: May be reused for game model run metadata if metrics are sufficient.
- Primary key: `run_id`
- Foreign keys: None
- Indexes: `idx_projection_runs_v2_as_of_date`, `idx_projection_runs_v2_status`, `projection_runs_v2_pkey`
- Date coverage: `as_of_date`: 2025-10-07 to 2026-04-16; `created_at`: 2025-12-26 15:43:04.592168+00 to 2026-04-16 10:05:03.581243+00; `updated_at`: 2025-12-26 15:43:04.674+00 to 2026-04-16 11:30:05.195+00
- Planned key columns present: `run_id`, `as_of_date`, `status`, `metrics`
- Planned key columns missing: None
- Column count: 8

### `source_provenance_snapshots`

- Priority: storage
- Relation type: table
- Metadata mode: management_api_sql
- Row count: 107
- Planned use: Source freshness/provenance registry.
- Notes: Preferred source freshness contract when present.
- Primary key: `snapshot_date`, `source_type`, `entity_type`, `entity_id`, `source_name`, `game_id`
- Foreign keys: `source_provenance_snapshots_game_id_fkey: FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE`
- Indexes: `source_provenance_snapshots_pkey`
- Date coverage: `snapshot_date`: 2026-04-21 to 2026-04-23; `observed_at`: 2026-04-21 14:38:56.544+00 to 2026-04-23 14:07:26.073+00; `freshness_expires_at`: 2026-04-21 22:38:56.544+00 to 2026-04-25 23:18:28.044+00; `updated_at`: 2026-04-21 20:44:16.817+00 to 2026-04-23 14:07:26.073+00
- Planned key columns present: `snapshot_date`, `source_type`, `entity_type`, `entity_id`, `source_name`
- Planned key columns missing: None
- Column count: 15

