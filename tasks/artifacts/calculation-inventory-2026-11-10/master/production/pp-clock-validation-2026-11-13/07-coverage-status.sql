-- Numerator and repair-source coverage (scalar columns only, one row per game).
--  1. Per-game normalization status: complete PBP + shift rows behind the
--     shift-intersection numerator (expected vs observed shift rows).
--  2. Which raw endpoints are stored for one sample game, to see whether a
--     stored boxscore/right-rail payload could repair placeholder "00:00" rows.
set statement_timeout = '10s';
\copy (select game_id, season_id, status, expected_event_rows, observed_event_rows, expected_shift_rows, observed_shift_rows from nhl_api_game_normalization_status where season_id in (20252026, 20262027) order by game_id) to 'OUT_STATUS' with csv header
select column_name from information_schema.columns where table_schema='public' and table_name='nhl_api_game_payloads_raw' and data_type <> 'jsonb' order by ordinal_position;
