-- Rollback for 20261113180000_games_game_state.sql: drops game_state, game_schedule_state and
-- game_state_observed_at (their CHECKs go with them). The stored states are re-fetchable NHL schedule
-- observations, not issued history, so the rollback does not refuse while they are stored.
-- Revert the F4 ingester and readers first: the released code selects and writes these columns.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.games
  drop column game_state,
  drop column game_schedule_state,
  drop column game_state_observed_at;

commit;
