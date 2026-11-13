-- PBP and shift coverage by season, via narrow indexed predicates (one game-end row per game).
\timing on
set statement_timeout = '10s';
select column_name, data_type from information_schema.columns
where table_schema='public' and table_name='nhl_api_game_normalization_status' order by ordinal_position;
select season_id, count(*) as game_end_rows, count(distinct game_id) as pbp_games
from nhl_api_pbp_events where type_desc_key = 'game-end' and season_id >= 20212022
group by 1 order by 1 desc;
