CREATE SCHEMA fhfh_internal;
CREATE TABLE public.games(id bigint primary key,"startTime" timestamptz,"homeTeamId" bigint,"awayTeamId" bigint);
CREATE TABLE public.forge_runs(run_id uuid primary key,status text,updated_at timestamptz,metrics jsonb);
CREATE TABLE public.forge_game_revisions(id uuid primary key,game_id bigint,run_id uuid,decision_as_of timestamptz,published_at timestamptz);
create table public.forge_game_update_queue (
  game_id bigint primary key references public.games(id),
  version bigint not null default 1,
  claimed_version bigint,
  status text not null default 'pending' check (status in ('pending','running','succeeded','failed','cancelled')),
  first_accepted_at timestamptz not null default clock_timestamp(),
  last_accepted_at timestamptz not null default clock_timestamp(),
  source_published_at timestamptz not null,
  received_at timestamptz not null,
  not_before timestamptz not null default clock_timestamp() + interval '30 seconds',
  lease_owner uuid,
  lease_expires_at timestamptz,
  dispatched_at timestamptz,
  completed_at timestamptz,
  published_run_id uuid references public.forge_runs(run_id),
  active_run_id uuid references public.forge_runs(run_id),
  attempt_count integer not null default 0,
  last_error text
);
alter table public.forge_game_update_queue enable row level security;
revoke all on public.forge_game_update_queue from public, anon, authenticated;
grant select, insert, update on public.forge_game_update_queue to service_role;

create function fhfh_internal.enqueue_starter_board_game(p_game_id bigint,p_team_id bigint,p_published_at timestamptz,p_received_at timestamptz) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.games g
    where g.id=p_game_id and g."startTime" > clock_timestamp()
      and (p_team_id is null or p_team_id in (g."homeTeamId",g."awayTeamId"))) then return; end if;
  insert into public.forge_game_update_queue as q(game_id,source_published_at,received_at)
    values(p_game_id,p_published_at,p_received_at)
  on conflict(game_id) do update set
    version=q.version+1, last_accepted_at=clock_timestamp(),
    source_published_at=greatest(q.source_published_at,excluded.source_published_at),
    received_at=greatest(q.received_at,excluded.received_at),
    first_accepted_at=case when q.status in ('succeeded','cancelled') then clock_timestamp() else q.first_accepted_at end,
    -- Repeated news does not keep pushing a pending job into the future.
    not_before=case when q.status in ('succeeded','cancelled') then clock_timestamp()+interval '30 seconds' else q.not_before end,
    status=case when q.status='running' then 'running' else 'pending' end;
end; $$;
revoke all on function fhfh_internal.enqueue_starter_board_game(bigint,bigint,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function fhfh_internal.enqueue_starter_board_game(bigint,bigint,timestamptz,timestamptz) to service_role;

