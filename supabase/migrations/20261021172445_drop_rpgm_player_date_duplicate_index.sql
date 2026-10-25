-- FORGE projection audit 2026-10-21, Q5: idx_rpgm_player_date (player_id, game_date desc) duplicates the
-- leading columns of rolling_player_game_metrics_pkey (player_id, game_date, strength_state), which a btree
-- also scans backward. It had 0 scans (database stats never reset) against 15,973 on the primary key, and every
-- rolling upsert paid for it. Idempotent.
set local lock_timeout = '5s';
drop index if exists public.idx_rpgm_player_date;
