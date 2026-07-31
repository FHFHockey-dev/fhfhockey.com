-- Exact credential-free reconstruction of the hosted analytics schema captured 2026-07-30.
-- Generated from pg_catalog; application row data is intentionally excluded.

create schema if not exists analytics authorization postgres;
alter schema analytics owner to postgres;
revoke all on schema analytics from public;
grant usage on schema analytics to anon, authenticated, service_role;

create sequence analytics.sko_model_v1_id_seq
  as bigint
  start with 1
  increment by 1
  minvalue 1
  maxvalue 9223372036854775807
  cache 1
  no cycle;

create table analytics.sko_model_v1 (
  id bigint default nextval('analytics.sko_model_v1_id_seq'::regclass) not null,
  created_at timestamp with time zone default now(),
  description text,
  mu jsonb not null,
  sigma jsonb not null,
  weights jsonb not null,
  intercept double precision not null,
  sigma_residual double precision not null,
  target text default 'p60'::text not null,
  constraint sko_model_v1_pkey primary key (id)
);

alter sequence analytics.sko_model_v1_id_seq owned by analytics.sko_model_v1.id;

create view analytics.vw_team_ratings_daily as
 SELECT t.id AS team_id,
    r.team_abbreviation,
    r.date AS snapshot_date,
    NULL::integer AS season_id,
    r.off_rating AS offense_rating,
    r.def_rating AS defense_rating,
    r.goalie_rating,
    r.special_rating,
    r.pace_rating,
    r.danger_rating,
    r.discipline_rating,
    r.finishing_rating,
    r.trend10,
    r.variance_flag,
    jsonb_build_object('gf60', r.gf60, 'ga60', r.ga60, 'xgf60', r.xgf60, 'xga60', r.xga60, 'sf60', r.sf60, 'sa60', r.sa60, 'pace60', r.pace60, 'pp_tier', r.pp_tier, 'pk_tier', r.pk_tier) AS components,
    jsonb_build_object('source_table', 'team_power_ratings_daily', 'source_contract', 'analytics.vw_team_ratings_daily') AS provenance,
    COALESCE(r.created_at, now()) AS computed_at
   FROM team_power_ratings_daily r
     LEFT JOIN teams t ON t.abbreviation::text = r.team_abbreviation;;

create view analytics.vw_entity_ratings_daily as
 SELECT 'team'::text AS entity_type,
    vw_team_ratings_daily.team_id::bigint AS entity_id,
    vw_team_ratings_daily.team_id,
    NULL::bigint AS player_id,
    vw_team_ratings_daily.snapshot_date,
    vw_team_ratings_daily.season_id,
    vw_team_ratings_daily.team_abbreviation AS team_abbrev,
    vw_team_ratings_daily.offense_rating AS offense_rating_0_to_100,
    vw_team_ratings_daily.defense_rating AS defense_rating_0_to_100,
    vw_team_ratings_daily.goalie_rating AS goalie_rating_0_to_100,
    NULL::double precision AS overall_rating_0_to_100,
    NULL::integer AS league_rank,
    NULL::double precision AS percentile,
    'team_power_ratings_daily'::text AS source_table,
    vw_team_ratings_daily.components,
    vw_team_ratings_daily.provenance,
    vw_team_ratings_daily.computed_at
   FROM analytics.vw_team_ratings_daily
UNION ALL
 SELECT 'skater_offense'::text AS entity_type,
    skater_offensive_ratings_daily.player_id AS entity_id,
    skater_offensive_ratings_daily.team_id,
    skater_offensive_ratings_daily.player_id,
    skater_offensive_ratings_daily.snapshot_date,
    skater_offensive_ratings_daily.season_id,
    NULL::text AS team_abbrev,
    skater_offensive_ratings_daily.rating_0_to_100 AS offense_rating_0_to_100,
    NULL::double precision AS defense_rating_0_to_100,
    NULL::double precision AS goalie_rating_0_to_100,
    NULL::double precision AS overall_rating_0_to_100,
    skater_offensive_ratings_daily.league_rank,
    skater_offensive_ratings_daily.percentile,
    'skater_offensive_ratings_daily'::text AS source_table,
    skater_offensive_ratings_daily.components,
    skater_offensive_ratings_daily.provenance,
    skater_offensive_ratings_daily.computed_at
   FROM skater_offensive_ratings_daily
UNION ALL
 SELECT 'skater_defense'::text AS entity_type,
    skater_defensive_ratings_daily.player_id AS entity_id,
    skater_defensive_ratings_daily.team_id,
    skater_defensive_ratings_daily.player_id,
    skater_defensive_ratings_daily.snapshot_date,
    skater_defensive_ratings_daily.season_id,
    NULL::text AS team_abbrev,
    NULL::double precision AS offense_rating_0_to_100,
    skater_defensive_ratings_daily.rating_0_to_100 AS defense_rating_0_to_100,
    NULL::double precision AS goalie_rating_0_to_100,
    NULL::double precision AS overall_rating_0_to_100,
    skater_defensive_ratings_daily.league_rank,
    skater_defensive_ratings_daily.percentile,
    'skater_defensive_ratings_daily'::text AS source_table,
    skater_defensive_ratings_daily.components,
    skater_defensive_ratings_daily.provenance,
    skater_defensive_ratings_daily.computed_at
   FROM skater_defensive_ratings_daily
UNION ALL
 SELECT 'goalie'::text AS entity_type,
    goalie_ratings_daily.player_id AS entity_id,
    goalie_ratings_daily.team_id,
    goalie_ratings_daily.player_id,
    goalie_ratings_daily.snapshot_date,
    goalie_ratings_daily.season_id,
    NULL::text AS team_abbrev,
    NULL::double precision AS offense_rating_0_to_100,
    NULL::double precision AS defense_rating_0_to_100,
    goalie_ratings_daily.rating_0_to_100 AS goalie_rating_0_to_100,
    NULL::double precision AS overall_rating_0_to_100,
    goalie_ratings_daily.league_rank,
    goalie_ratings_daily.percentile,
    'goalie_ratings_daily'::text AS source_table,
    goalie_ratings_daily.components,
    goalie_ratings_daily.provenance,
    goalie_ratings_daily.computed_at
   FROM goalie_ratings_daily;;

create view analytics.vw_entity_sustainability_scores as
 SELECT 'skater'::text AS entity_type,
    s.player_id AS entity_id,
    NULL::smallint AS team_id,
    s.player_id,
    s.snapshot_date,
    s.season_id,
    'overall'::text AS metric_scope,
    s.window_code,
    NULL::double precision AS baseline_value,
    NULL::double precision AS recent_value,
    NULL::double precision AS expected_value,
    NULL::double precision AS z_score,
    s.s_raw,
    s.s_100,
        CASE
            WHEN s.s_raw >= 0.75::double precision THEN 'overperforming'::text
            WHEN s.s_raw <= '-0.75'::numeric::double precision THEN 'underperforming'::text
            ELSE 'stable'::text
        END AS expectation_state,
    s.components,
    '{}'::jsonb AS provenance,
    s.computed_at
   FROM sustainability_scores s
UNION ALL
 SELECT entity_sustainability_scores_daily.entity_type,
    entity_sustainability_scores_daily.entity_id,
    entity_sustainability_scores_daily.team_id,
    entity_sustainability_scores_daily.player_id,
    entity_sustainability_scores_daily.snapshot_date,
    entity_sustainability_scores_daily.season_id,
    entity_sustainability_scores_daily.metric_scope,
    entity_sustainability_scores_daily.window_code,
    entity_sustainability_scores_daily.baseline_value,
    entity_sustainability_scores_daily.recent_value,
    entity_sustainability_scores_daily.expected_value,
    entity_sustainability_scores_daily.z_score,
    entity_sustainability_scores_daily.s_raw,
    entity_sustainability_scores_daily.s_100,
    entity_sustainability_scores_daily.expectation_state,
    entity_sustainability_scores_daily.components,
    entity_sustainability_scores_daily.provenance,
    entity_sustainability_scores_daily.computed_at
   FROM entity_sustainability_scores_daily;;

create view analytics.vw_nhl_edge_latest_goalie_metrics as
 SELECT DISTINCT ON (nhl_edge_goalie_metrics_daily.goalie_id, nhl_edge_goalie_metrics_daily.game_type) nhl_edge_goalie_metrics_daily.snapshot_date,
    nhl_edge_goalie_metrics_daily.season_id,
    nhl_edge_goalie_metrics_daily.game_type,
    nhl_edge_goalie_metrics_daily.goalie_id,
    nhl_edge_goalie_metrics_daily.goalie_name,
    nhl_edge_goalie_metrics_daily.team_id,
    nhl_edge_goalie_metrics_daily.team_abbreviation,
    nhl_edge_goalie_metrics_daily.games_played,
    nhl_edge_goalie_metrics_daily.wins,
    nhl_edge_goalie_metrics_daily.losses,
    nhl_edge_goalie_metrics_daily.ot_losses,
    nhl_edge_goalie_metrics_daily.goals_against_avg,
    nhl_edge_goalie_metrics_daily.save_pct,
    nhl_edge_goalie_metrics_daily.edge_goals_against_avg,
    nhl_edge_goalie_metrics_daily.edge_goals_against_avg_percentile,
    nhl_edge_goalie_metrics_daily.edge_goals_against_avg_league_avg,
    nhl_edge_goalie_metrics_daily.games_above_900,
    nhl_edge_goalie_metrics_daily.games_above_900_percentile,
    nhl_edge_goalie_metrics_daily.games_above_900_league_avg,
    nhl_edge_goalie_metrics_daily.goal_differential_per_60,
    nhl_edge_goalie_metrics_daily.goal_differential_per_60_percentile,
    nhl_edge_goalie_metrics_daily.goal_differential_per_60_league_avg,
    nhl_edge_goalie_metrics_daily.goal_support_avg,
    nhl_edge_goalie_metrics_daily.goal_support_avg_percentile,
    nhl_edge_goalie_metrics_daily.goal_support_avg_league_avg,
    nhl_edge_goalie_metrics_daily.point_pct,
    nhl_edge_goalie_metrics_daily.point_pct_percentile,
    nhl_edge_goalie_metrics_daily.point_pct_league_avg,
    nhl_edge_goalie_metrics_daily.all_goals_against,
    nhl_edge_goalie_metrics_daily.all_saves,
    nhl_edge_goalie_metrics_daily.all_save_pct,
    nhl_edge_goalie_metrics_daily.high_danger_goals_against,
    nhl_edge_goalie_metrics_daily.high_danger_saves,
    nhl_edge_goalie_metrics_daily.high_danger_save_pct,
    nhl_edge_goalie_metrics_daily.mid_range_goals_against,
    nhl_edge_goalie_metrics_daily.mid_range_saves,
    nhl_edge_goalie_metrics_daily.mid_range_save_pct,
    nhl_edge_goalie_metrics_daily.long_range_goals_against,
    nhl_edge_goalie_metrics_daily.long_range_saves,
    nhl_edge_goalie_metrics_daily.long_range_save_pct,
    nhl_edge_goalie_metrics_daily.source_url,
    nhl_edge_goalie_metrics_daily.raw_payload,
    nhl_edge_goalie_metrics_daily.metadata,
    nhl_edge_goalie_metrics_daily.created_at,
    nhl_edge_goalie_metrics_daily.updated_at
   FROM nhl_edge_goalie_metrics_daily
  ORDER BY nhl_edge_goalie_metrics_daily.goalie_id, nhl_edge_goalie_metrics_daily.game_type, nhl_edge_goalie_metrics_daily.snapshot_date DESC, nhl_edge_goalie_metrics_daily.updated_at DESC;;

create view analytics.vw_nhl_edge_latest_skater_metrics as
 SELECT DISTINCT ON (nhl_edge_skater_metrics_daily.player_id, nhl_edge_skater_metrics_daily.game_type) nhl_edge_skater_metrics_daily.snapshot_date,
    nhl_edge_skater_metrics_daily.season_id,
    nhl_edge_skater_metrics_daily.game_type,
    nhl_edge_skater_metrics_daily.player_id,
    nhl_edge_skater_metrics_daily.player_name,
    nhl_edge_skater_metrics_daily.team_id,
    nhl_edge_skater_metrics_daily.team_abbreviation,
    nhl_edge_skater_metrics_daily."position",
    nhl_edge_skater_metrics_daily.games_played,
    nhl_edge_skater_metrics_daily.goals,
    nhl_edge_skater_metrics_daily.assists,
    nhl_edge_skater_metrics_daily.points,
    nhl_edge_skater_metrics_daily.top_shot_speed_mph,
    nhl_edge_skater_metrics_daily.top_shot_speed_kph,
    nhl_edge_skater_metrics_daily.top_shot_speed_percentile,
    nhl_edge_skater_metrics_daily.top_shot_speed_league_avg_mph,
    nhl_edge_skater_metrics_daily.max_skating_speed_mph,
    nhl_edge_skater_metrics_daily.max_skating_speed_kph,
    nhl_edge_skater_metrics_daily.max_skating_speed_percentile,
    nhl_edge_skater_metrics_daily.max_skating_speed_league_avg_mph,
    nhl_edge_skater_metrics_daily.bursts_over_20,
    nhl_edge_skater_metrics_daily.bursts_over_20_percentile,
    nhl_edge_skater_metrics_daily.bursts_over_20_league_avg,
    nhl_edge_skater_metrics_daily.total_distance_miles,
    nhl_edge_skater_metrics_daily.total_distance_km,
    nhl_edge_skater_metrics_daily.total_distance_percentile,
    nhl_edge_skater_metrics_daily.total_distance_league_avg_miles,
    nhl_edge_skater_metrics_daily.max_game_distance_miles,
    nhl_edge_skater_metrics_daily.max_game_distance_km,
    nhl_edge_skater_metrics_daily.max_game_distance_percentile,
    nhl_edge_skater_metrics_daily.max_game_distance_league_avg_miles,
    nhl_edge_skater_metrics_daily.all_shots,
    nhl_edge_skater_metrics_daily.all_goals,
    nhl_edge_skater_metrics_daily.all_shooting_pct,
    nhl_edge_skater_metrics_daily.high_danger_shots,
    nhl_edge_skater_metrics_daily.high_danger_goals,
    nhl_edge_skater_metrics_daily.high_danger_shooting_pct,
    nhl_edge_skater_metrics_daily.mid_range_shots,
    nhl_edge_skater_metrics_daily.mid_range_goals,
    nhl_edge_skater_metrics_daily.mid_range_shooting_pct,
    nhl_edge_skater_metrics_daily.long_range_shots,
    nhl_edge_skater_metrics_daily.long_range_goals,
    nhl_edge_skater_metrics_daily.long_range_shooting_pct,
    nhl_edge_skater_metrics_daily.offensive_zone_pct,
    nhl_edge_skater_metrics_daily.offensive_zone_percentile,
    nhl_edge_skater_metrics_daily.offensive_zone_league_avg,
    nhl_edge_skater_metrics_daily.offensive_zone_ev_pct,
    nhl_edge_skater_metrics_daily.offensive_zone_ev_percentile,
    nhl_edge_skater_metrics_daily.offensive_zone_ev_league_avg,
    nhl_edge_skater_metrics_daily.neutral_zone_pct,
    nhl_edge_skater_metrics_daily.neutral_zone_percentile,
    nhl_edge_skater_metrics_daily.neutral_zone_league_avg,
    nhl_edge_skater_metrics_daily.defensive_zone_pct,
    nhl_edge_skater_metrics_daily.defensive_zone_percentile,
    nhl_edge_skater_metrics_daily.defensive_zone_league_avg,
    nhl_edge_skater_metrics_daily.source_url,
    nhl_edge_skater_metrics_daily.raw_payload,
    nhl_edge_skater_metrics_daily.metadata,
    nhl_edge_skater_metrics_daily.created_at,
    nhl_edge_skater_metrics_daily.updated_at
   FROM nhl_edge_skater_metrics_daily
  ORDER BY nhl_edge_skater_metrics_daily.player_id, nhl_edge_skater_metrics_daily.game_type, nhl_edge_skater_metrics_daily.snapshot_date DESC, nhl_edge_skater_metrics_daily.updated_at DESC;;

create view analytics.vw_nhl_edge_latest_skater_skating_distance_games as
 SELECT DISTINCT ON (nhl_edge_skater_skating_distance_games_daily.player_id, nhl_edge_skater_skating_distance_games_daily.game_type, nhl_edge_skater_skating_distance_games_daily.game_id) nhl_edge_skater_skating_distance_games_daily.snapshot_date,
    nhl_edge_skater_skating_distance_games_daily.season_id,
    nhl_edge_skater_skating_distance_games_daily.game_type,
    nhl_edge_skater_skating_distance_games_daily.player_id,
    nhl_edge_skater_skating_distance_games_daily.player_name,
    nhl_edge_skater_skating_distance_games_daily.team_id,
    nhl_edge_skater_skating_distance_games_daily.team_abbreviation,
    nhl_edge_skater_skating_distance_games_daily."position",
    nhl_edge_skater_skating_distance_games_daily.game_id,
    nhl_edge_skater_skating_distance_games_daily.game_date,
    nhl_edge_skater_skating_distance_games_daily.player_on_home_team,
    nhl_edge_skater_skating_distance_games_daily.home_team_abbreviation,
    nhl_edge_skater_skating_distance_games_daily.away_team_abbreviation,
    nhl_edge_skater_skating_distance_games_daily.toi_all_seconds,
    nhl_edge_skater_skating_distance_games_daily.distance_skated_all_miles,
    nhl_edge_skater_skating_distance_games_daily.distance_skated_all_km,
    nhl_edge_skater_skating_distance_games_daily.toi_even_seconds,
    nhl_edge_skater_skating_distance_games_daily.distance_skated_even_miles,
    nhl_edge_skater_skating_distance_games_daily.distance_skated_even_km,
    nhl_edge_skater_skating_distance_games_daily.toi_pp_seconds,
    nhl_edge_skater_skating_distance_games_daily.distance_skated_pp_miles,
    nhl_edge_skater_skating_distance_games_daily.distance_skated_pp_km,
    nhl_edge_skater_skating_distance_games_daily.toi_pk_seconds,
    nhl_edge_skater_skating_distance_games_daily.distance_skated_pk_miles,
    nhl_edge_skater_skating_distance_games_daily.distance_skated_pk_km,
    nhl_edge_skater_skating_distance_games_daily.game_center_link,
    nhl_edge_skater_skating_distance_games_daily.source_url,
    nhl_edge_skater_skating_distance_games_daily.raw_payload,
    nhl_edge_skater_skating_distance_games_daily.metadata,
    nhl_edge_skater_skating_distance_games_daily.created_at,
    nhl_edge_skater_skating_distance_games_daily.updated_at
   FROM nhl_edge_skater_skating_distance_games_daily
  ORDER BY nhl_edge_skater_skating_distance_games_daily.player_id, nhl_edge_skater_skating_distance_games_daily.game_type, nhl_edge_skater_skating_distance_games_daily.game_id, nhl_edge_skater_skating_distance_games_daily.snapshot_date DESC, nhl_edge_skater_skating_distance_games_daily.updated_at DESC;;

create view analytics.vw_nhl_edge_latest_team_metrics as
 SELECT DISTINCT ON (nhl_edge_team_metrics_daily.team_id, nhl_edge_team_metrics_daily.game_type) nhl_edge_team_metrics_daily.snapshot_date,
    nhl_edge_team_metrics_daily.season_id,
    nhl_edge_team_metrics_daily.game_type,
    nhl_edge_team_metrics_daily.team_id,
    nhl_edge_team_metrics_daily.team_abbreviation,
    nhl_edge_team_metrics_daily.team_name,
    nhl_edge_team_metrics_daily.conference,
    nhl_edge_team_metrics_daily.division,
    nhl_edge_team_metrics_daily.games_played,
    nhl_edge_team_metrics_daily.wins,
    nhl_edge_team_metrics_daily.losses,
    nhl_edge_team_metrics_daily.ot_losses,
    nhl_edge_team_metrics_daily.points,
    nhl_edge_team_metrics_daily.shot_attempts_over_90,
    nhl_edge_team_metrics_daily.shot_attempts_over_90_rank,
    nhl_edge_team_metrics_daily.top_shot_speed_mph,
    nhl_edge_team_metrics_daily.top_shot_speed_kph,
    nhl_edge_team_metrics_daily.top_shot_speed_rank,
    nhl_edge_team_metrics_daily.top_shot_speed_league_avg_mph,
    nhl_edge_team_metrics_daily.bursts_over_22,
    nhl_edge_team_metrics_daily.bursts_over_22_rank,
    nhl_edge_team_metrics_daily.bursts_over_20,
    nhl_edge_team_metrics_daily.bursts_over_20_rank,
    nhl_edge_team_metrics_daily.bursts_over_20_league_avg,
    nhl_edge_team_metrics_daily.max_skating_speed_mph,
    nhl_edge_team_metrics_daily.max_skating_speed_kph,
    nhl_edge_team_metrics_daily.max_skating_speed_rank,
    nhl_edge_team_metrics_daily.max_skating_speed_league_avg_mph,
    nhl_edge_team_metrics_daily.total_distance_miles,
    nhl_edge_team_metrics_daily.total_distance_km,
    nhl_edge_team_metrics_daily.total_distance_rank,
    nhl_edge_team_metrics_daily.total_distance_league_avg_miles,
    nhl_edge_team_metrics_daily.all_shots,
    nhl_edge_team_metrics_daily.all_goals,
    nhl_edge_team_metrics_daily.all_shooting_pct,
    nhl_edge_team_metrics_daily.all_shots_rank,
    nhl_edge_team_metrics_daily.all_goals_rank,
    nhl_edge_team_metrics_daily.all_shooting_pct_rank,
    nhl_edge_team_metrics_daily.high_danger_shots,
    nhl_edge_team_metrics_daily.high_danger_goals,
    nhl_edge_team_metrics_daily.high_danger_shooting_pct,
    nhl_edge_team_metrics_daily.high_danger_shots_rank,
    nhl_edge_team_metrics_daily.high_danger_goals_rank,
    nhl_edge_team_metrics_daily.high_danger_shooting_pct_rank,
    nhl_edge_team_metrics_daily.mid_range_shots,
    nhl_edge_team_metrics_daily.mid_range_goals,
    nhl_edge_team_metrics_daily.mid_range_shooting_pct,
    nhl_edge_team_metrics_daily.mid_range_shots_rank,
    nhl_edge_team_metrics_daily.mid_range_goals_rank,
    nhl_edge_team_metrics_daily.mid_range_shooting_pct_rank,
    nhl_edge_team_metrics_daily.long_range_shots,
    nhl_edge_team_metrics_daily.long_range_goals,
    nhl_edge_team_metrics_daily.long_range_shooting_pct,
    nhl_edge_team_metrics_daily.long_range_shots_rank,
    nhl_edge_team_metrics_daily.long_range_goals_rank,
    nhl_edge_team_metrics_daily.long_range_shooting_pct_rank,
    nhl_edge_team_metrics_daily.offensive_zone_pct,
    nhl_edge_team_metrics_daily.offensive_zone_rank,
    nhl_edge_team_metrics_daily.offensive_zone_league_avg,
    nhl_edge_team_metrics_daily.offensive_zone_ev_pct,
    nhl_edge_team_metrics_daily.offensive_zone_ev_rank,
    nhl_edge_team_metrics_daily.offensive_zone_ev_league_avg,
    nhl_edge_team_metrics_daily.neutral_zone_pct,
    nhl_edge_team_metrics_daily.neutral_zone_rank,
    nhl_edge_team_metrics_daily.neutral_zone_league_avg,
    nhl_edge_team_metrics_daily.defensive_zone_pct,
    nhl_edge_team_metrics_daily.defensive_zone_rank,
    nhl_edge_team_metrics_daily.defensive_zone_league_avg,
    nhl_edge_team_metrics_daily.source_url,
    nhl_edge_team_metrics_daily.raw_payload,
    nhl_edge_team_metrics_daily.metadata,
    nhl_edge_team_metrics_daily.created_at,
    nhl_edge_team_metrics_daily.updated_at
   FROM nhl_edge_team_metrics_daily
  ORDER BY nhl_edge_team_metrics_daily.team_id, nhl_edge_team_metrics_daily.game_type, nhl_edge_team_metrics_daily.snapshot_date DESC, nhl_edge_team_metrics_daily.updated_at DESC;;

create view analytics.vw_nhl_edge_latest_team_skating_distance_games as
 SELECT DISTINCT ON (nhl_edge_team_skating_distance_games_daily.team_id, nhl_edge_team_skating_distance_games_daily.game_type, nhl_edge_team_skating_distance_games_daily.game_id) nhl_edge_team_skating_distance_games_daily.snapshot_date,
    nhl_edge_team_skating_distance_games_daily.season_id,
    nhl_edge_team_skating_distance_games_daily.game_type,
    nhl_edge_team_skating_distance_games_daily.team_id,
    nhl_edge_team_skating_distance_games_daily.team_abbreviation,
    nhl_edge_team_skating_distance_games_daily.team_name,
    nhl_edge_team_skating_distance_games_daily.game_id,
    nhl_edge_team_skating_distance_games_daily.game_date,
    nhl_edge_team_skating_distance_games_daily.is_home_team,
    nhl_edge_team_skating_distance_games_daily.home_team_abbreviation,
    nhl_edge_team_skating_distance_games_daily.away_team_abbreviation,
    nhl_edge_team_skating_distance_games_daily.toi_all_seconds,
    nhl_edge_team_skating_distance_games_daily.distance_skated_all_miles,
    nhl_edge_team_skating_distance_games_daily.distance_skated_all_km,
    nhl_edge_team_skating_distance_games_daily.toi_even_seconds,
    nhl_edge_team_skating_distance_games_daily.distance_skated_even_miles,
    nhl_edge_team_skating_distance_games_daily.distance_skated_even_km,
    nhl_edge_team_skating_distance_games_daily.toi_pp_seconds,
    nhl_edge_team_skating_distance_games_daily.distance_skated_pp_miles,
    nhl_edge_team_skating_distance_games_daily.distance_skated_pp_km,
    nhl_edge_team_skating_distance_games_daily.toi_pk_seconds,
    nhl_edge_team_skating_distance_games_daily.distance_skated_pk_miles,
    nhl_edge_team_skating_distance_games_daily.distance_skated_pk_km,
    nhl_edge_team_skating_distance_games_daily.game_center_link,
    nhl_edge_team_skating_distance_games_daily.source_url,
    nhl_edge_team_skating_distance_games_daily.raw_payload,
    nhl_edge_team_skating_distance_games_daily.metadata,
    nhl_edge_team_skating_distance_games_daily.created_at,
    nhl_edge_team_skating_distance_games_daily.updated_at
   FROM nhl_edge_team_skating_distance_games_daily
  ORDER BY nhl_edge_team_skating_distance_games_daily.team_id, nhl_edge_team_skating_distance_games_daily.game_type, nhl_edge_team_skating_distance_games_daily.game_id, nhl_edge_team_skating_distance_games_daily.snapshot_date DESC, nhl_edge_team_skating_distance_games_daily.updated_at DESC;;

create view analytics.vw_player_status_current as
 WITH ranked AS (
         SELECT h.capture_key,
            h.snapshot_date,
            h.observed_at,
            h.player_id,
            h.player_name,
            h.team_id,
            h.team_abbreviation,
            h.status_state,
            h.raw_status,
            h.status_detail,
            h.source_name,
            h.source_url,
            h.source_rank,
            h.status_expires_at,
            h.metadata,
            h.updated_at,
            row_number() OVER (PARTITION BY (COALESCE(h.player_id, '-1'::integer::bigint)), (lower(h.player_name)), (COALESCE(h.team_id, '-1'::integer::bigint)) ORDER BY h.snapshot_date DESC, h.observed_at DESC, h.updated_at DESC) AS rn
           FROM player_status_history h
          WHERE h.status_expires_at IS NULL OR h.status_expires_at > now()
        )
 SELECT ranked.capture_key,
    ranked.snapshot_date,
    ranked.observed_at,
    ranked.player_id,
    ranked.player_name,
    ranked.team_id,
    ranked.team_abbreviation,
    ranked.status_state,
    ranked.raw_status,
    ranked.status_detail,
    ranked.source_name,
    ranked.source_url,
    ranked.source_rank,
    ranked.status_expires_at,
        CASE
            WHEN ranked.status_state = 'returning'::text THEN 'Returning'::text
            ELSE COALESCE(ranked.raw_status, 'Out'::text)
        END AS display_status,
        CASE
            WHEN ranked.status_state = 'returning'::text THEN 'positive'::text
            ELSE 'negative'::text
        END AS display_tone,
    ranked.metadata,
    ranked.updated_at
   FROM ranked
  WHERE ranked.rn = 1;;

create view analytics.vw_sko_skater_base as
 SELECT ws.player_id,
    ws.player_name,
    COALESCE(ws.position_code, 'F'::text) AS position_code,
    COALESCE(ws.season_id, nc.season) AS season_id,
    ws.game_id,
    ws.date,
    ws.shots,
    ws.toi_per_game,
    ws.pp_toi_per_game,
    ws.o_zone_fo_percentage,
    ws.on_ice_shooting_pct,
    ws.shooting_percentage,
    nc.ixg,
    nr.ixg_per_60
   FROM wgo_skater_stats ws
     LEFT JOIN nst_gamelog_as_counts nc ON nc.player_id = ws.player_id AND nc.date_scraped = ws.date
     LEFT JOIN nst_gamelog_as_rates nr ON nr.player_id = ws.player_id AND nr.date_scraped = ws.date;;

create materialized view analytics.mv_sko_skater_moments as
 WITH base AS (
         SELECT vw_sko_skater_base.player_id,
            COALESCE(vw_sko_skater_base.position_code, 'F'::text) AS position_code,
            vw_sko_skater_base.date,
            vw_sko_skater_base.shots,
            vw_sko_skater_base.toi_per_game,
            vw_sko_skater_base.pp_toi_per_game,
            vw_sko_skater_base.o_zone_fo_percentage,
            vw_sko_skater_base.on_ice_shooting_pct,
            vw_sko_skater_base.shooting_percentage,
            vw_sko_skater_base.ixg,
            vw_sko_skater_base.ixg_per_60
           FROM analytics.vw_sko_skater_base
        ), player_base AS (
         SELECT base.player_id,
            base.position_code,
            base.shots,
            base.toi_per_game,
            base.pp_toi_per_game,
            base.o_zone_fo_percentage,
            base.on_ice_shooting_pct,
            base.shooting_percentage,
            base.ixg,
            base.ixg_per_60,
            NULLIF(base.on_ice_shooting_pct, 0::double precision) AS onice_shooting_for_stats,
            NULLIF(base.shooting_percentage, 0::double precision) AS shooting_pct_for_stats
           FROM base
        ), player_medians AS (
         SELECT player_base.player_id,
            player_base.position_code,
            count(*) FILTER (WHERE player_base.shots IS NOT NULL) AS n_games,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (player_base.shots::double precision)) AS shots_med,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY player_base.toi_per_game) AS toi_med,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY player_base.pp_toi_per_game) AS pp_toi_med,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY player_base.o_zone_fo_percentage) AS ozfo_med,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY player_base.on_ice_shooting_pct) AS onice_sh_med,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY player_base.shooting_percentage) AS shooting_pct_med,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY player_base.ixg) AS ixg_med,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (player_base.ixg_per_60::double precision)) AS ixg_per_60_med
           FROM player_base
          GROUP BY player_base.player_id, player_base.position_code
        ), player_mads AS (
         SELECT pb.player_id,
            pb.position_code,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (abs(pb.shots::double precision - pm_1.shots_med))) AS shots_mad_raw,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (abs(pb.toi_per_game - pm_1.toi_med))) AS toi_mad_raw,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (abs(pb.pp_toi_per_game - pm_1.pp_toi_med))) AS pp_toi_mad_raw,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (abs(pb.o_zone_fo_percentage - pm_1.ozfo_med))) AS ozfo_mad_raw,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (abs(pb.on_ice_shooting_pct - pm_1.onice_sh_med))) AS onice_sh_mad_raw,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (abs(pb.shooting_percentage - pm_1.shooting_pct_med))) AS shooting_pct_mad_raw,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (abs(pb.ixg - pm_1.ixg_med))) AS ixg_mad_raw,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (abs(pb.ixg_per_60::double precision - pm_1.ixg_per_60_med))) AS ixg_per_60_mad_raw
           FROM player_base pb
             JOIN player_medians pm_1 USING (player_id, position_code)
          GROUP BY pb.player_id, pb.position_code
        ), league_base AS (
         SELECT base.position_code,
            base.shots,
            base.toi_per_game,
            base.pp_toi_per_game,
            base.o_zone_fo_percentage,
            NULLIF(base.on_ice_shooting_pct, 0::double precision) AS onice_shooting_for_stats,
            NULLIF(base.shooting_percentage, 0::double precision) AS shooting_pct_for_stats,
            base.ixg,
            base.ixg_per_60
           FROM base
        ), league_medians AS (
         SELECT league_base.position_code,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (league_base.shots::double precision)) AS shots_med,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY league_base.toi_per_game) AS toi_med,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY league_base.pp_toi_per_game) AS pp_toi_med,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY league_base.o_zone_fo_percentage) AS ozfo_med,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY league_base.onice_shooting_for_stats) AS onice_sh_med,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY league_base.shooting_pct_for_stats) AS shooting_pct_med,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY league_base.ixg) AS ixg_med,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (league_base.ixg_per_60::double precision)) AS ixg_per_60_med
           FROM league_base
          GROUP BY league_base.position_code
        ), league_mads AS (
         SELECT lb.position_code,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (abs(lb.shots::double precision - lm_1.shots_med))) AS shots_mad_raw,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (abs(lb.toi_per_game - lm_1.toi_med))) AS toi_mad_raw,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (abs(lb.pp_toi_per_game - lm_1.pp_toi_med))) AS pp_toi_mad_raw,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (abs(lb.o_zone_fo_percentage - lm_1.ozfo_med))) AS ozfo_mad_raw,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (abs(lb.onice_shooting_for_stats - lm_1.onice_sh_med))) AS onice_sh_mad_raw,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (abs(lb.shooting_pct_for_stats - lm_1.shooting_pct_med))) AS shooting_pct_mad_raw,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (abs(lb.ixg - lm_1.ixg_med))) AS ixg_mad_raw,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (abs(lb.ixg_per_60::double precision - lm_1.ixg_per_60_med))) AS ixg_per_60_mad_raw
           FROM league_base lb
             JOIN league_medians lm_1 USING (position_code)
          GROUP BY lb.position_code
        )
 SELECT pm.player_id,
    pm.position_code,
    pm.n_games,
    pm.shots_med,
    1.4826::double precision * pmad.shots_mad_raw AS shots_mad,
    pm.toi_med,
    1.4826::double precision * pmad.toi_mad_raw AS toi_mad,
    pm.pp_toi_med,
    1.4826::double precision * pmad.pp_toi_mad_raw AS pp_toi_mad,
    pm.ozfo_med,
    1.4826::double precision * pmad.ozfo_mad_raw AS ozfo_mad,
    pm.onice_sh_med,
    1.4826::double precision * pmad.onice_sh_mad_raw AS onice_sh_mad,
    pm.shooting_pct_med,
    1.4826::double precision * pmad.shooting_pct_mad_raw AS shooting_pct_mad,
    pm.ixg_med,
    1.4826::double precision * pmad.ixg_mad_raw AS ixg_mad,
    pm.ixg_per_60_med,
    1.4826::double precision * pmad.ixg_per_60_mad_raw AS ixg_per_60_mad,
    lm.shots_med AS league_shots_med,
    1.4826::double precision * lmad.shots_mad_raw AS league_shots_mad,
    lm.toi_med AS league_toi_med,
    1.4826::double precision * lmad.toi_mad_raw AS league_toi_mad,
    lm.pp_toi_med AS league_pp_toi_med,
    1.4826::double precision * lmad.pp_toi_mad_raw AS league_pp_toi_mad,
    lm.ozfo_med AS league_ozfo_med,
    1.4826::double precision * lmad.ozfo_mad_raw AS league_ozfo_mad,
    lm.onice_sh_med AS league_onice_sh_med,
    1.4826::double precision * lmad.onice_sh_mad_raw AS league_onice_sh_mad,
    lm.shooting_pct_med AS league_shooting_pct_med,
    1.4826::double precision * lmad.shooting_pct_mad_raw AS league_shooting_pct_mad,
    lm.ixg_med AS league_ixg_med,
    1.4826::double precision * lmad.ixg_mad_raw AS league_ixg_mad,
    lm.ixg_per_60_med AS league_ixg_per_60_med,
    1.4826::double precision * lmad.ixg_per_60_mad_raw AS league_ixg_per_60_mad
   FROM player_medians pm
     JOIN player_mads pmad USING (player_id, position_code)
     JOIN league_medians lm USING (position_code)
     JOIN league_mads lmad USING (position_code)
-- The supported baseline is schema-only; populate from retained source rows
-- only in an environment where those rows exist.
with no data;

create view analytics.vw_sko_skater_zscores as
 WITH constants AS (
         SELECT 30.0 AS kappa
        ), weights AS (
         SELECT m.player_id,
            m.position_code,
            m.n_games,
            m.shots_med,
            m.shots_mad,
            m.toi_med,
            m.toi_mad,
            m.pp_toi_med,
            m.pp_toi_mad,
            m.ozfo_med,
            m.ozfo_mad,
            m.onice_sh_med,
            m.onice_sh_mad,
            m.shooting_pct_med,
            m.shooting_pct_mad,
            m.ixg_med,
            m.ixg_mad,
            m.ixg_per_60_med,
            m.ixg_per_60_mad,
            m.league_shots_med,
            m.league_shots_mad,
            m.league_toi_med,
            m.league_toi_mad,
            m.league_pp_toi_med,
            m.league_pp_toi_mad,
            m.league_ozfo_med,
            m.league_ozfo_mad,
            m.league_onice_sh_med,
            m.league_onice_sh_mad,
            m.league_shooting_pct_med,
            m.league_shooting_pct_mad,
            m.league_ixg_med,
            m.league_ixg_mad,
            m.league_ixg_per_60_med,
            m.league_ixg_per_60_mad,
            (m.n_games::numeric / (m.n_games::numeric + c.kappa))::double precision AS w_player,
            (c.kappa / (m.n_games::numeric + c.kappa))::double precision AS w_league
           FROM analytics.mv_sko_skater_moments m
             CROSS JOIN constants c
        )
 SELECT b.player_id,
    b.position_code,
    b.season_id,
    COALESCE(b.game_id, row_number() OVER (PARTITION BY b.player_id ORDER BY b.date, b.game_id)) AS game_id,
    b.date,
    b.shots,
    b.ixg,
    b.ixg_per_60,
    b.toi_per_game,
    b.pp_toi_per_game,
    b.o_zone_fo_percentage,
    b.on_ice_shooting_pct,
    b.shooting_percentage,
    w.n_games,
    w.w_player,
    w.w_league,
        CASE
            WHEN b.shots IS NULL THEN NULL::double precision
            ELSE (b.shots::double precision - (w.w_player * w.shots_med + w.w_league * w.league_shots_med)) / NULLIF(w.w_player * w.shots_mad + w.w_league * w.league_shots_mad, 0::double precision)
        END AS shots_z,
        CASE
            WHEN b.ixg IS NULL THEN NULL::double precision
            ELSE (b.ixg - (w.w_player * w.ixg_med + w.w_league * w.league_ixg_med)) / NULLIF(w.w_player * w.ixg_mad + w.w_league * w.league_ixg_mad, 0::double precision)
        END AS ixg_z,
        CASE
            WHEN b.ixg_per_60 IS NULL THEN NULL::double precision
            ELSE (b.ixg_per_60::double precision - (w.w_player * w.ixg_per_60_med + w.w_league * w.league_ixg_per_60_med)) / NULLIF(w.w_player * w.ixg_per_60_mad + w.w_league * w.league_ixg_per_60_mad, 0::double precision)
        END AS ixg_per_60_z,
        CASE
            WHEN b.toi_per_game IS NULL THEN NULL::double precision
            ELSE (b.toi_per_game - (w.w_player * w.toi_med + w.w_league * w.league_toi_med)) / NULLIF(w.w_player * w.toi_mad + w.w_league * w.league_toi_mad, 0::double precision)
        END AS toi_z,
        CASE
            WHEN b.pp_toi_per_game IS NULL THEN NULL::double precision
            ELSE (b.pp_toi_per_game - (w.w_player * w.pp_toi_med + w.w_league * w.league_pp_toi_med)) / NULLIF(w.w_player * w.pp_toi_mad + w.w_league * w.league_pp_toi_mad, 0::double precision)
        END AS pp_toi_z,
        CASE
            WHEN b.o_zone_fo_percentage IS NULL THEN NULL::double precision
            ELSE (b.o_zone_fo_percentage - (w.w_player * w.ozfo_med + w.w_league * w.league_ozfo_med)) / NULLIF(w.w_player * w.ozfo_mad + w.w_league * w.league_ozfo_mad, 0::double precision)
        END AS ozfo_z,
        CASE
            WHEN b.on_ice_shooting_pct IS NULL THEN NULL::double precision
            ELSE (b.on_ice_shooting_pct - (w.w_player * w.onice_sh_med + w.w_league * w.league_onice_sh_med)) / NULLIF(w.w_player * w.onice_sh_mad + w.w_league * w.league_onice_sh_mad, 0::double precision)
        END AS onice_sh_z,
        CASE
            WHEN b.shooting_percentage IS NULL THEN NULL::double precision
            ELSE (b.shooting_percentage - (w.w_player * w.shooting_pct_med + w.w_league * w.league_shooting_pct_med)) / NULLIF(w.w_player * w.shooting_pct_mad + w.w_league * w.league_shooting_pct_mad, 0::double precision)
        END AS shooting_pct_z
   FROM analytics.vw_sko_skater_base b
     JOIN weights w ON w.player_id = b.player_id AND w.position_code = b.position_code;;

create view analytics.vw_sko_skater_scores as
 SELECT z.player_id,
    z.position_code,
    z.season_id,
    z.game_id,
    z.date,
    z.shots_z,
    z.ixg_z,
    z.ixg_per_60_z,
    z.toi_z,
    z.pp_toi_z,
    z.ozfo_z,
    z.onice_sh_z,
    z.shooting_pct_z,
    (- 0.03::double precision) + 0.24::double precision * COALESCE(z.shots_z, 0::double precision) + 0.28::double precision * COALESCE(z.ixg_z, 0::double precision) + 0.13::double precision * COALESCE(z.ixg_per_60_z, 0::double precision) + 0.09::double precision * COALESCE(z.toi_z, 0::double precision) + 0.07::double precision * COALESCE(z.pp_toi_z, 0::double precision) + 0.09::double precision * COALESCE(z.ozfo_z, 0::double precision) - 0.06::double precision * COALESCE(z.onice_sh_z, 0::double precision) - 0.05::double precision * COALESCE(z.shooting_pct_z, 0::double precision) AS sko_raw,
    tanh((- 0.03::double precision) + 0.24::double precision * COALESCE(z.shots_z, 0::double precision) + 0.28::double precision * COALESCE(z.ixg_z, 0::double precision) + 0.13::double precision * COALESCE(z.ixg_per_60_z, 0::double precision) + 0.09::double precision * COALESCE(z.toi_z, 0::double precision) + 0.07::double precision * COALESCE(z.pp_toi_z, 0::double precision) + 0.09::double precision * COALESCE(z.ozfo_z, 0::double precision) - 0.06::double precision * COALESCE(z.onice_sh_z, 0::double precision) - 0.05::double precision * COALESCE(z.shooting_pct_z, 0::double precision)) AS sko
   FROM analytics.vw_sko_skater_zscores z;;

CREATE OR REPLACE FUNCTION analytics.rpc_sko_player_series(p_player_id bigint, p_span integer DEFAULT 5, p_lambda_hot numeric DEFAULT 1.8, p_lambda_cold numeric DEFAULT 1.6, p_l_hot integer DEFAULT 2, p_l_cold integer DEFAULT 3)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'analytics', 'public'
AS $function$
DECLARE
  alpha numeric := 2::numeric / (p_span + 1);
  mu0 numeric;
  sigma0 numeric;
  n_train integer;
  payload jsonb;
  v_player_name text;
  v_position text;
BEGIN
  BEGIN
    SELECT
      COALESCE(ws.player_name, CONCAT('Player ', p_player_id)),
      COALESCE(ws.position_code, 'F')
    INTO v_player_name, v_position
    FROM analytics.vw_sko_skater_base ws
    WHERE ws.player_id = p_player_id
    ORDER BY ws.date DESC
    LIMIT 1;
  EXCEPTION
    WHEN undefined_column THEN
      v_player_name := CONCAT('Player ', p_player_id);
      v_position := 'F';
  END;

  IF v_player_name IS NULL THEN
    v_player_name := CONCAT('Player ', p_player_id);
  END IF;

  SELECT
    percentile_cont(0.5) WITHIN GROUP (ORDER BY sko),
    COUNT(*)
  INTO mu0, n_train
  FROM analytics.vw_sko_skater_scores
  WHERE player_id = p_player_id
    AND season_id IN (20212022, 20222023, 20232024);

  IF n_train IS NULL OR n_train = 0 OR mu0 IS NULL THEN
    sigma0 := 0;
  ELSE
    SELECT
      1.4826 * percentile_cont(0.5) WITHIN GROUP (ORDER BY ABS(sko - mu0))
    INTO sigma0
    FROM analytics.vw_sko_skater_scores
    WHERE player_id = p_player_id
      AND season_id IN (20212022, 20222023, 20232024);
  END IF;

  WITH RECURSIVE ordered AS (
    SELECT
      s.*,
      ROW_NUMBER() OVER (ORDER BY date, game_id NULLS LAST) AS rn
    FROM analytics.vw_sko_skater_scores s
    WHERE s.player_id = p_player_id
    ORDER BY date, game_id
  ),
  ewma AS (
    SELECT
      o.rn,
      o.season_id,
      o.game_id,
      o.date,
      o.sko,
      o.sko_raw,
      o.shots_z,
      o.ixg_z,
      o.ixg_per_60_z,
      o.toi_z,
      o.pp_toi_z,
      o.ozfo_z,
      o.onice_sh_z,
      o.shooting_pct_z,
      o.sko AS ewma
    FROM ordered o
    WHERE o.rn = 1
    UNION ALL
    SELECT
      o.rn,
      o.season_id,
      o.game_id,
      o.date,
      o.sko,
      o.sko_raw,
      o.shots_z,
      o.ixg_z,
      o.ixg_per_60_z,
      o.toi_z,
      o.pp_toi_z,
      o.ozfo_z,
      o.onice_sh_z,
      o.shooting_pct_z,
      alpha * o.sko + (1 - alpha) * e.ewma AS ewma
    FROM ordered o
      JOIN ewma e ON o.rn = e.rn + 1
  ),
  flags AS (
    SELECT
      e.*,
      CASE WHEN e.ewma - mu0 >= p_lambda_hot * sigma0 THEN 1 ELSE 0 END AS hot_flag,
      CASE WHEN mu0 - e.ewma >= p_lambda_cold * sigma0 THEN 1 ELSE 0 END AS cold_flag
    FROM ewma e
  ),
  streaks AS (
    SELECT
      f.*,
      CASE WHEN hot_flag = 1 AND lag(hot_flag, p_L_hot - 1, 0) OVER (ORDER BY rn) = 1 THEN 1 ELSE 0 END AS hot_start,
      CASE WHEN cold_flag = 1 AND lag(cold_flag, p_L_cold - 1, 0) OVER (ORDER BY rn) = 1 THEN 1 ELSE 0 END AS cold_start
    FROM flags f
  ),
  labeled AS (
    SELECT
      s.*,
      SUM(hot_start) OVER (ORDER BY rn) AS hot_streak_id,
      SUM(cold_start) OVER (ORDER BY rn) AS cold_streak_id
    FROM streaks s
  )
  SELECT jsonb_build_object(
      'player_id', p_player_id,
      'player_name', v_player_name,
      'position_code', v_position,
      'baseline', jsonb_build_object(
        'mu0', mu0,
        'sigma0', sigma0,
        'n_train', COALESCE(n_train, 0)
      ),
      'series', jsonb_agg(
        jsonb_build_object(
          'season_id', season_id,
          'game_id', game_id,
          'date', date,
          'sko', sko,
          'sko_raw', sko_raw,
          'ewma', ewma,
          'hot_flag', hot_flag,
          'cold_flag', cold_flag,
          'hot_streak_id', NULLIF(hot_streak_id, 0),
          'cold_streak_id', NULLIF(cold_streak_id, 0),
          'features', jsonb_build_object(
            'shots_z', shots_z,
            'ixg_z', ixg_z,
            'ixg_per_60_z', ixg_per_60_z,
            'toi_z', toi_z,
            'pp_toi_z', pp_toi_z,
            'oz_fo_pct_z', ozfo_z,
            'onice_sh_pct_z', onice_sh_z,
            'shooting_pct_z', shooting_pct_z
          )
        )
        ORDER BY rn
      )
    )
  INTO payload
  FROM labeled;

  RETURN payload;
END;
$function$;

grant select on analytics.vw_player_status_current to service_role;
grant execute on function analytics.rpc_sko_player_series(bigint, integer, numeric, numeric, integer, integer) to anon, authenticated;
