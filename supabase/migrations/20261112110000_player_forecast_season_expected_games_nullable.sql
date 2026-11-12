-- NOT APPLIED. Math-audit fix lane L4a, SQL ticket from L15 (rule 5; writer change bef023fa8). Apply only with TJ's
-- pop-up approval, singly, then record schema_migrations and migration-authority.json (order 139).
--
-- Defect: expected_games is NOT NULL on public.player_forecast_season_player_aggregates and
-- public.player_forecast_season_release_players (20260813001304), so a player whose season GP mean is unknown can
-- only be written as a number (0) or not at all. Since bef023fa8 the writer sends NULL for an unknown mean
-- (rule 5: unknown stays NULL), which this constraint rejects, failing the run closed.
-- Fix: drop NOT NULL on exactly those two columns. Nothing else changes: the column type, the existing CHECK
-- (expected_games >= 0 and <= 84 and not NaN, which NULL satisfies), the expected_starts CHECK, defaults, other
-- columns, RLS, grants and the immutability triggers are untouched. Catalog-only: no table scan, no data change.
-- Note: with expected_games NULL the expected_starts CHECK (expected_starts <= expected_games) evaluates to NULL and
-- so admits any non-negative expected_starts; the writer sends both NULL together (bef023fa8).
-- Readers: the FORGE season-forecast pipeline (L15's writer) and the publish / clone functions of 20260813001304,
-- which copy the column through unchanged.
--
-- READBACK (after apply; catalog only):
--   select table_name, is_nullable, data_type from information_schema.columns
--    where table_schema = 'public' and column_name = 'expected_games'
--      and table_name in ('player_forecast_season_player_aggregates', 'player_forecast_season_release_players');
--   expect both is_nullable YES, data_type numeric.
--   select conrelid::regclass, pg_catalog.pg_get_constraintdef(oid) from pg_catalog.pg_constraint
--    where conrelid in ('public.player_forecast_season_player_aggregates'::regclass,
--                       'public.player_forecast_season_release_players'::regclass)
--      and pg_catalog.pg_get_constraintdef(oid) like '%expected_games%';
--   expect the two CHECKs per table still present.
-- ROLLBACK: supabase/tests/l4a_expected_games_nullable_rollback.sql. It refuses while any NULL expected_games row
--   exists in either table. Both tables are append-only (update/delete triggers reject every change), so once the
--   writer stores a NULL the rollback stays refused for good.
-- PROOF: LC_ALL=C python3 -I supabase/tests/l4a_expected_games_nullable.py (disposable local PostgreSQL 15).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.player_forecast_season_player_aggregates alter column expected_games drop not null;
alter table public.player_forecast_season_release_players alter column expected_games drop not null;

commit;
