-- NOT APPLIED. Stored game state for game finality: math-audit follow-up lane F4 (rule 19: finality comes from a
-- game state; L2 W2-3 D7). Apply only with TJ's pop-up approval, singly, then record schema_migrations and
-- migration-authority.json (order 146).
--
-- public.games holds no game state today, so the underlying-stats readers guess finality from dates
-- (`date < UTC today OR start + 8 h`), and every game of an ET date reads final from 00:00 UTC, before or
-- during play. This migration adds three nullable columns, written by /api/v1/db/update-games from the NHL club
-- schedules (contract nhl-game-state-v1, web/lib/games/gameFinality.ts):
--   game_state              NHL gameState: FUT, PRE, LIVE, CRIT, FINAL, OFF (FINAL and OFF are final);
--   game_schedule_state     NHL gameScheduleState: OK, TBD, PPD, SUSP, CNCL;
--   game_state_observed_at  when the ingester fetched that state (set exactly when either state is set).
-- NULL means unknown: the readers then fall back, labelled, to start + 8 h. Unknown NHL values are stored as NULL
-- by the ingester, so the CHECKs never fail a schedule run.
-- No existing row value changes; no default, so the column adds are catalog-only. No trigger, RLS, policy or
-- grant change (the table's existing grants cover the new columns).
-- Rollout: apply, then release the ingester and readers together (the readers select the new columns, so they
-- must not ship first), then backfill: one /api/v1/db/update-games run for the current season (32 club-schedule
-- GETs, same as the 03:00 UTC cron), and one ?seasonId=<id> run per earlier season the landing serves.
--
-- PRE-APPLY: select count(*) from public.games;  -- note N
-- READBACK (after apply; catalog and counts, no payload reads):
--   select column_name, data_type, is_nullable from information_schema.columns
--    where table_schema = 'public' and table_name = 'games'
--      and column_name in ('game_state', 'game_schedule_state', 'game_state_observed_at') order by 1;
--   expect game_schedule_state text YES; game_state text YES; game_state_observed_at timestamp with time zone YES.
--   select conname from pg_catalog.pg_constraint where conrelid = 'public.games'::regclass
--      and conname like 'games_game_%' order by 1;
--   expect games_game_schedule_state_check, games_game_state_check, games_game_state_observed_at_check.
--   select count(*), count(game_state_observed_at) from public.games;  -- expect N, 0 until the first run
-- ROLLBACK: supabase/tests/f4_games_game_state_rollback.sql (drops the three columns and their state).
-- PROOF: LC_ALL=C python3 -I supabase/tests/f4_games_game_state.py (disposable local PostgreSQL 15).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.games
  add column game_state text,
  add column game_schedule_state text,
  add column game_state_observed_at timestamptz;

alter table public.games
  add constraint games_game_state_check
    check (game_state in ('FUT', 'PRE', 'LIVE', 'CRIT', 'FINAL', 'OFF')),
  add constraint games_game_schedule_state_check
    check (game_schedule_state in ('OK', 'TBD', 'PPD', 'SUSP', 'CNCL')),
  add constraint games_game_state_observed_at_check
    check ((game_state_observed_at is null) = (game_state is null and game_schedule_state is null));

comment on column public.games.game_state is
  'NHL gameState at game_state_observed_at (FUT, PRE, LIVE, CRIT, FINAL, OFF; FINAL and OFF are final). NULL = unknown. Written by /api/v1/db/update-games; contract nhl-game-state-v1.';
comment on column public.games.game_schedule_state is
  'NHL gameScheduleState at game_state_observed_at (OK, TBD, PPD, SUSP, CNCL). NULL = unknown.';
comment on column public.games.game_state_observed_at is
  'When the schedule ingester fetched game_state and game_schedule_state. NHL supplies no game-end time, so a final state is known from this time.';

commit;
