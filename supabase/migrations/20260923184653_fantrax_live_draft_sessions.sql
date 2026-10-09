create table public.fantrax_draft_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connected_account_id uuid not null,
  external_league_id uuid not null,
  external_team_id uuid not null,
  status text not null default 'active' check (status in ('active', 'stopped', 'complete', 'error')),
  provider_status text not null default 'unknown',
  snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(snapshot) = 'object'),
  snapshot_hash text,
  next_poll_at timestamptz not null default now(),
  poll_lease_token uuid,
  poll_lease_expires_at timestamptz,
  consecutive_failures integer not null default 0,
  last_error_code text,
  last_polled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, external_league_id),
  foreign key (connected_account_id, user_id) references public.connected_accounts(id, user_id) on delete cascade,
  foreign key (external_league_id, user_id) references public.external_leagues(id, user_id) on delete cascade,
  foreign key (external_team_id, user_id) references public.external_teams(id, user_id) on delete cascade,
  check ((poll_lease_token is null) = (poll_lease_expires_at is null))
);

alter table public.fantrax_draft_sessions enable row level security;
revoke all on public.fantrax_draft_sessions from anon, authenticated;

create or replace function public.claim_fantrax_draft_poll(
  p_session_id uuid,
  p_user_id uuid,
  p_now timestamptz
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token uuid := gen_random_uuid();
begin
  update public.fantrax_draft_sessions
  set poll_lease_token = v_token,
      poll_lease_expires_at = p_now + interval '45 seconds',
      updated_at = p_now
  where id = p_session_id and user_id = p_user_id and status = 'active'
    and next_poll_at <= p_now
    and (poll_lease_expires_at is null or poll_lease_expires_at <= p_now);
  if found then return v_token; end if;
  return null;
end;
$$;

revoke all on function public.claim_fantrax_draft_poll(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_fantrax_draft_poll(uuid, uuid, timestamptz) to service_role;
