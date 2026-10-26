-- RSO Yahoo diet, TJ decision D4 (2026-10-26): elapsed-day Yahoo lineups, stored once.
-- NOT APPLIED. Written and reviewed offline; applying it needs TJ's separate approval.
-- A recorded lineup for a finished day never changes, so the provider snapshot reads it here
-- before asking Yahoo again (web/lib/integrations/yahoo/rosterPlanning.ts, behind the server
-- flag RSO_YAHOO_DIET=1). The code treats a missing table or a failed read as "not stored" and
-- falls back to Yahoo, so the flag is safe before this migration lands.
-- Privacy: Yahoo player keys and slot codes only. No names, league names, scores or tokens.
-- No browser access: RLS on, no policies, explicit grants to service_role only (D4 pattern,
-- 20261020224600_data_api_reviewed_object_grants.sql).
-- Season-end purge: call public.purge_rso_yahoo_past_lineups(<new season id>) once the new
-- season starts (scheduling it as a pg_cron job is a separate approval).
-- Rollback: drop function public.purge_rso_yahoo_past_lineups(integer);
--           drop table public.rso_yahoo_past_lineups;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.rso_yahoo_past_lineups (
  user_id uuid not null references auth.users (id) on delete cascade,
  external_team_id uuid not null references public.external_teams (id) on delete cascade,
  season_id integer not null check (season_id between 19000000 and 99999999),
  lineup_date date not null,
  -- [{ "player_key": "465.p.1234", "position": "C" }, ...]
  entries jsonb not null check (jsonb_typeof(entries) = 'array' and jsonb_array_length(entries) <= 100),
  created_at timestamptz not null default now(),
  primary key (user_id, external_team_id, lineup_date)
);

comment on table public.rso_yahoo_past_lineups is
  'RSO: Yahoo-recorded lineups for elapsed days (player keys and slots only), per user and owned team. Service role only; purged each season.';

create index if not exists rso_yahoo_past_lineups_season_idx
  on public.rso_yahoo_past_lineups (season_id);

alter table public.rso_yahoo_past_lineups enable row level security;

revoke all on table public.rso_yahoo_past_lineups from public, anon, authenticated, service_role;
grant select, insert, update on table public.rso_yahoo_past_lineups to service_role;

create or replace function public.purge_rso_yahoo_past_lineups(current_season_id integer)
returns bigint
language sql
security invoker
set search_path = public
as $$
  with removed as (
    delete from public.rso_yahoo_past_lineups where season_id < current_season_id returning 1
  )
  select count(*) from removed;
$$;

revoke all on function public.purge_rso_yahoo_past_lineups(integer) from public, anon, authenticated;
grant execute on function public.purge_rso_yahoo_past_lineups(integer) to service_role;
grant delete on table public.rso_yahoo_past_lineups to service_role;
