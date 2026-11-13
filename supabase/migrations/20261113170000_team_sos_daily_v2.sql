-- NOT APPLIED. Strength of schedule v2 storage: math-audit follow-up lane F2 (decision 21: "past" means final
-- only; rule 21: issued evidence stays as issued). Apply only with TJ's pop-up approval, singly, then record
-- schema_migrations and migration-authority.json (order 145).
--
-- /api/v1/db/update-team-sos now computes descriptive-sos-v2 (web/lib/trends/strengthOfScheduleContract.ts)
-- from the 32 NHL club schedules: past counts only fixtures with a final result observed before the cutoff,
-- started or postponed fixtures are stored as pending, opponents' records exclude games against the team, and
-- each value is a mean over fixtures (direct = opponents, indirect = opponents' opponents; win% and points%).
-- v1 rows in public.sos_standings (keyed season_id, game_date, team_id) counted games dated today as played and
-- pooled opponents' standings including head-to-head; they are issued history and stay as they are.
-- This migration:
--   1. Creates public.team_sos_daily, keyed (season_id, snapshot_date, team_id, sos_version). snapshot_date is the
--      America/New_York date of cutoff_at. One snapshot per run; a same-day rerun replaces that day's row.
--      RLS, the public_read policy and grants match sos_standings (public data; the writer uses service_role).
--   2. Adds a BEFORE INSERT OR UPDATE trigger on public.sos_standings that refuses every write (55000
--      SOS_V1_FROZEN), so neither the old writer nor the legacy manual scripts (lib/supabase/sosStandings.js,
--      Upserts/fetchSoSgameLog.js) can rewrite v1 history. Deletes are not intercepted.
-- No existing row value changes.
-- Rollout: apply, then release the v2 writer and readers together. Between the two, the current v1 writer's
-- 09:12 UTC run fails closed (55000) and writes nothing, and the current readers keep serving the last v1 row.
--
-- PRE-APPLY: select count(*), max(game_date) from public.sos_standings;  -- note N, D
-- READBACK (after apply; catalog and counts, no payload reads):
--   select conname, pg_catalog.pg_get_constraintdef(oid) from pg_catalog.pg_constraint
--    where conrelid = 'public.team_sos_daily'::regclass and contype = 'p';
--   expect team_sos_daily_pkey PRIMARY KEY (season_id, snapshot_date, team_id, sos_version).
--   select relrowsecurity from pg_catalog.pg_class where oid = 'public.team_sos_daily'::regclass;  -- expect t
--   select grantee, string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants
--    where table_schema = 'public' and table_name = 'team_sos_daily' group by 1 order by 1;
--   expect anon SELECT; authenticated SELECT; service_role DELETE,INSERT,SELECT,UPDATE.
--   select tgname from pg_catalog.pg_trigger where tgrelid = 'public.sos_standings'::regclass and not tgisinternal;
--   expect sos_standings_v1_frozen.
--   select count(*), max(game_date) from public.sos_standings;  -- expect N, D (unchanged)
--   select count(*) from public.team_sos_daily;  -- expect 0 until the first v2 run
-- ROLLBACK: supabase/tests/f2_team_sos_daily_v2_rollback.sql (refuses while any v2 row is stored).
-- PROOF: LC_ALL=C python3 -I supabase/tests/f2_team_sos_daily_v2.py (disposable local PostgreSQL 15).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.team_sos_daily (
  season_id integer not null,
  snapshot_date date not null,
  team_id integer not null,
  team_abbrev text not null check (team_abbrev ~ '^[A-Z]{2,3}$'),
  sos_version text not null check (sos_version ~ '^descriptive-sos-v[0-9]+$'),
  past_view text not null check (past_view in ('past-retrospective', 'past-as-known-then')),
  cutoff_at timestamptz not null,
  past_fixtures integer not null check (past_fixtures >= 0),
  pending_fixtures integer not null check (pending_fixtures >= 0),
  future_fixtures integer not null check (future_fixtures >= 0),
  past_direct_supported integer not null check (past_direct_supported between 0 and past_fixtures),
  past_indirect_supported integer not null check (past_indirect_supported between 0 and past_fixtures),
  future_direct_supported integer not null check (future_direct_supported between 0 and future_fixtures),
  future_indirect_supported integer not null check (future_indirect_supported between 0 and future_fixtures),
  past_direct_win_pct double precision check (past_direct_win_pct between 0 and 1),
  past_indirect_win_pct double precision check (past_indirect_win_pct between 0 and 1),
  past_direct_points_pct double precision check (past_direct_points_pct between 0 and 1),
  past_indirect_points_pct double precision check (past_indirect_points_pct between 0 and 1),
  future_direct_win_pct double precision check (future_direct_win_pct between 0 and 1),
  future_indirect_win_pct double precision check (future_indirect_win_pct between 0 and 1),
  future_direct_points_pct double precision check (future_direct_points_pct between 0 and 1),
  future_indirect_points_pct double precision check (future_indirect_points_pct between 0 and 1),
  past_opponents jsonb not null default '[]'::jsonb check (jsonb_typeof(past_opponents) = 'array'),
  future_opponents jsonb not null default '[]'::jsonb check (jsonb_typeof(future_opponents) = 'array'),
  pending_games jsonb not null default '[]'::jsonb check (jsonb_typeof(pending_games) = 'array'),
  evidence jsonb not null check (jsonb_typeof(evidence) = 'object'),
  constraint team_sos_daily_snapshot_date_check
    check (snapshot_date = (cutoff_at at time zone 'America/New_York')::date),
  constraint team_sos_daily_pkey primary key (season_id, snapshot_date, team_id, sos_version)
);

comment on table public.team_sos_daily is
  'Strength of schedule by version (rule 21). descriptive-sos-v2: means over fixtures of opponents'' records excluding games against the team; past = final results observed before cutoff_at (decision 21), pending_games = started or postponed without a final result. Written by /api/v1/db/update-team-sos from NHL club schedules. v1 history stays in sos_standings.';

alter table public.team_sos_daily enable row level security;
create policy public_read on public.team_sos_daily for select to anon, authenticated using (true);
revoke all on table public.team_sos_daily from public, anon, authenticated, service_role;
grant select on table public.team_sos_daily to anon, authenticated;
grant select, insert, update, delete on table public.team_sos_daily to service_role;

create function fhfh_internal.reject_sos_v1_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using errcode = '55000',
    message = 'SOS_V1_FROZEN: sos_standings rows are issued v1 history (rule 21); descriptive-sos-v2 writes public.team_sos_daily';
end;
$$;

revoke all on function fhfh_internal.reject_sos_v1_write() from public, anon, authenticated, service_role;

create trigger sos_standings_v1_frozen
  before insert or update on public.sos_standings
  for each row execute function fhfh_internal.reject_sos_v1_write();

commit;
