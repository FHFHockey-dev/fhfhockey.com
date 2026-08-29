-- Production hardening for the Yahoo live-draft private beta.
-- This migration is additive to 20260813015112_yahoo_live_draft_companion.sql.

alter table public.yahoo_draft_sessions
  add column last_nudged_at timestamptz,
  add column last_worker_heartbeat_at timestamptz;

alter table public.yahoo_draft_picks
  add column mapping_revision bigint not null default 1,
  add column correction_confirmed_at timestamptz,
  add constraint yahoo_draft_picks_mapping_revision_positive
    check (mapping_revision > 0);

create index yahoo_draft_sessions_worker_due_idx
  on public.yahoo_draft_sessions (next_poll_at, connected_account_id)
  where status in ('predraft', 'active');

create table public.yahoo_oauth_transactions (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  safe_next_path text not null,
  redirect_uri text not null,
  pkce_code_verifier text not null,
  browser_binding_hash text not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint yahoo_oauth_transactions_state_hash_valid
    check (state_hash ~ '^[0-9a-f]{64}$'),
  constraint yahoo_oauth_transactions_browser_hash_valid
    check (browser_binding_hash ~ '^[0-9a-f]{64}$'),
  constraint yahoo_oauth_transactions_next_path_valid
    check (
      safe_next_path like '/%'
      and safe_next_path not like '//%'
      and pg_catalog.length(safe_next_path) <= 1024
    ),
  constraint yahoo_oauth_transactions_redirect_uri_valid
    check (
      redirect_uri ~ '^https://'
      or redirect_uri ~ '^http://(localhost|127[.]0[.]0[.]1)(:[0-9]+)?/'
    ),
  constraint yahoo_oauth_transactions_pkce_valid
    check (pg_catalog.length(pkce_code_verifier) between 43 and 128),
  constraint yahoo_oauth_transactions_expiry_valid
    check (expires_at > created_at),
  constraint yahoo_oauth_transactions_consumption_valid
    check (consumed_at is null or consumed_at >= created_at)
);

comment on table public.yahoo_oauth_transactions is
  'Service-only, one-time Yahoo OAuth state and PKCE transactions. Raw state and browser binding values are never stored.';

create index yahoo_oauth_transactions_expiry_idx
  on public.yahoo_oauth_transactions (expires_at);

alter table public.yahoo_oauth_transactions enable row level security;
alter table public.yahoo_oauth_transactions force row level security;
revoke all on table public.yahoo_oauth_transactions
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.yahoo_oauth_transactions
  to service_role;

create table public.yahoo_token_refresh_leases (
  connected_account_id uuid primary key,
  user_id uuid not null,
  lease_token uuid not null,
  lease_expires_at timestamptz not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint yahoo_token_refresh_leases_account_owner_fk
    foreign key (connected_account_id, user_id)
    references public.connected_accounts(id, user_id)
    on delete cascade,
  constraint yahoo_token_refresh_leases_expiry_valid
    check (lease_expires_at > updated_at)
);

comment on table public.yahoo_token_refresh_leases is
  'Cross-process serialization boundary for Yahoo refresh-token rotation.';

create index yahoo_token_refresh_leases_expiry_idx
  on public.yahoo_token_refresh_leases (lease_expires_at);

alter table public.yahoo_token_refresh_leases enable row level security;
alter table public.yahoo_token_refresh_leases force row level security;
revoke all on table public.yahoo_token_refresh_leases
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.yahoo_token_refresh_leases
  to service_role;

create table public.yahoo_draft_poll_observations (
  id bigint generated always as identity primary key,
  session_ref text not null,
  account_ref text not null,
  worker_instance_id text not null,
  outcome text not null,
  provider_status text,
  local_status text,
  http_status integer,
  request_duration_ms integer,
  pick_count integer,
  last_pick_number integer,
  snapshot_hash text,
  snapshot_version bigint,
  changed boolean,
  refresh_rate text,
  retry_after_seconds integer,
  cache_control text,
  age_seconds integer,
  etag_present boolean,
  last_modified_present boolean,
  content_type text,
  response_date timestamptz,
  request_id_ref text,
  response_format text,
  error_code text,
  token_refresh_attempted boolean not null default false,
  token_refresh_outcome text,
  consecutive_failures integer,
  next_poll_at timestamptz,
  due_poll_lag_ms integer,
  lease_claimed boolean,
  anomaly_detected boolean not null default false,
  correction_confirmation text,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint yahoo_draft_poll_observations_refs_valid
    check (
      session_ref ~ '^[0-9a-f]{24}$'
      and account_ref ~ '^[0-9a-f]{24}$'
      and (request_id_ref is null or request_id_ref ~ '^[0-9a-f]{24}$')
    ),
  constraint yahoo_draft_poll_observations_outcome_valid
    check (outcome in ('claimed', 'skipped', 'changed', 'unchanged', 'failed')),
  constraint yahoo_draft_poll_observations_response_format_valid
    check (response_format is null or response_format in ('standard_json', 'json_f')),
  constraint yahoo_draft_poll_observations_nonnegative
    check (
      coalesce(request_duration_ms, 0) >= 0
      and coalesce(pick_count, 0) >= 0
      and coalesce(last_pick_number, 0) >= 0
      and coalesce(snapshot_version, 0) >= 0
      and coalesce(retry_after_seconds, 0) >= 0
      and coalesce(age_seconds, 0) >= 0
      and coalesce(consecutive_failures, 0) >= 0
      and coalesce(due_poll_lag_ms, 0) >= 0
    )
);

comment on table public.yahoo_draft_poll_observations is
  'Short-retention, pseudonymous Yahoo draft transport and worker observations. No provider payloads or credentials.';

create index yahoo_draft_poll_observations_created_idx
  on public.yahoo_draft_poll_observations (created_at desc);
create index yahoo_draft_poll_observations_outcome_idx
  on public.yahoo_draft_poll_observations (outcome, created_at desc);

alter table public.yahoo_draft_poll_observations enable row level security;
alter table public.yahoo_draft_poll_observations force row level security;
revoke all on table public.yahoo_draft_poll_observations
  from public, anon, authenticated, service_role;
grant select, insert, delete on table public.yahoo_draft_poll_observations
  to service_role;
grant usage, select on sequence public.yahoo_draft_poll_observations_id_seq
  to service_role;

create function public.create_yahoo_oauth_transaction(
  p_state_hash text,
  p_user_id uuid,
  p_safe_next_path text,
  p_redirect_uri text,
  p_pkce_code_verifier text,
  p_browser_binding_hash text,
  p_expires_at timestamptz
)
returns void
language sql
security invoker
set search_path = ''
as $function$
  insert into public.yahoo_oauth_transactions (
    state_hash,
    user_id,
    safe_next_path,
    redirect_uri,
    pkce_code_verifier,
    browser_binding_hash,
    expires_at
  ) values (
    p_state_hash,
    p_user_id,
    p_safe_next_path,
    p_redirect_uri,
    p_pkce_code_verifier,
    p_browser_binding_hash,
    p_expires_at
  );
$function$;

create function public.consume_yahoo_oauth_transaction(
  p_state_hash text,
  p_browser_binding_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  consumed public.yahoo_oauth_transactions%rowtype;
  v_consumed_at timestamptz := pg_catalog.clock_timestamp();
begin
  update public.yahoo_oauth_transactions as transaction
  set consumed_at = v_consumed_at
  where transaction.state_hash = p_state_hash
    and transaction.browser_binding_hash = p_browser_binding_hash
    and transaction.consumed_at is null
    and transaction.expires_at > v_consumed_at
  returning transaction.* into consumed;

  if not found then
    raise exception using message = 'YAHOO_OAUTH_TRANSACTION_INVALID';
  end if;

  return pg_catalog.jsonb_build_object(
    'userId', consumed.user_id,
    'safeNextPath', consumed.safe_next_path,
    'redirectUri', consumed.redirect_uri,
    'pkceCodeVerifier', consumed.pkce_code_verifier,
    'consumedAt', consumed.consumed_at
  );
end;
$function$;

create function public.cleanup_yahoo_oauth_transactions(
  p_before timestamptz default pg_catalog.clock_timestamp() - interval '1 day'
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  deleted_count bigint;
begin
  delete from public.yahoo_oauth_transactions as transaction
  where transaction.expires_at < p_before
     or transaction.consumed_at < p_before;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$function$;

create function public.claim_yahoo_token_refresh_lease(
  p_connected_account_id uuid,
  p_user_id uuid,
  p_lease_seconds integer default 15
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  lease public.yahoo_token_refresh_leases%rowtype;
  claimed_at timestamptz := pg_catalog.clock_timestamp();
begin
  if p_connected_account_id is null
     or p_user_id is null
     or p_lease_seconds < 5
     or p_lease_seconds > 60
  then
    raise exception using message = 'YAHOO_TOKEN_REFRESH_LEASE_INVALID';
  end if;

  insert into public.yahoo_token_refresh_leases as existing (
    connected_account_id,
    user_id,
    lease_token,
    lease_expires_at,
    updated_at
  ) values (
    p_connected_account_id,
    p_user_id,
    pg_catalog.gen_random_uuid(),
    claimed_at + pg_catalog.make_interval(secs => p_lease_seconds),
    claimed_at
  )
  on conflict (connected_account_id) do update
  set
    user_id = excluded.user_id,
    lease_token = excluded.lease_token,
    lease_expires_at = excluded.lease_expires_at,
    updated_at = excluded.updated_at
  where existing.user_id = excluded.user_id
    and existing.lease_expires_at <= claimed_at
  returning * into lease;

  if found then
    return pg_catalog.jsonb_build_object(
      'claimed', true,
      'leaseToken', lease.lease_token,
      'retryAt', lease.lease_expires_at
    );
  end if;

  select existing.* into lease
  from public.yahoo_token_refresh_leases as existing
  where existing.connected_account_id = p_connected_account_id
    and existing.user_id = p_user_id;

  return pg_catalog.jsonb_build_object(
    'claimed', false,
    'leaseToken', null,
    'retryAt', lease.lease_expires_at
  );
end;
$function$;

create function public.release_yahoo_token_refresh_lease(
  p_connected_account_id uuid,
  p_user_id uuid,
  p_lease_token uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  delete from public.yahoo_token_refresh_leases as lease
  where lease.connected_account_id = p_connected_account_id
    and lease.user_id = p_user_id
    and lease.lease_token = p_lease_token;
  return found;
end;
$function$;

create or replace function public.claim_yahoo_draft_poll(
  p_session_id uuid,
  p_user_id uuid,
  p_lease_seconds integer default 30,
  p_claimed_at timestamptz default pg_catalog.clock_timestamp()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  claimed_session public.yahoo_draft_sessions%rowtype;
  retry_at timestamptz;
  claimed_at timestamptz := pg_catalog.clock_timestamp();
begin
  if p_session_id is null
     or p_user_id is null
     or p_claimed_at is null
     or p_lease_seconds < 5
     or p_lease_seconds > 120
  then
    raise exception using message = 'YAHOO_DRAFT_POLL_CLAIM_INVALID';
  end if;

  update public.yahoo_draft_sessions as session
  set
    poll_lease_token = pg_catalog.gen_random_uuid(),
    poll_lease_expires_at = claimed_at
      + pg_catalog.make_interval(secs => p_lease_seconds),
    last_worker_heartbeat_at = claimed_at
  where session.id = p_session_id
    and session.user_id = p_user_id
    and session.status in ('predraft', 'active')
    and session.next_poll_at <= claimed_at
    and (
      session.poll_lease_token is null
      or session.poll_lease_expires_at <= claimed_at
    )
  returning session.* into claimed_session;

  if found then
    return pg_catalog.jsonb_build_object(
      'claimed', true,
      'connectedAccountId', claimed_session.connected_account_id,
      'sessionId', claimed_session.id,
      'status', claimed_session.status,
      'leaseToken', claimed_session.poll_lease_token,
      'leaseExpiresAt', claimed_session.poll_lease_expires_at,
      'retryAt', claimed_session.poll_lease_expires_at
    );
  end if;

  select session.* into claimed_session
  from public.yahoo_draft_sessions as session
  where session.id = p_session_id
    and session.user_id = p_user_id;

  if not found then
    raise exception using message = 'YAHOO_DRAFT_SESSION_NOT_FOUND';
  end if;

  retry_at := greatest(
    claimed_session.next_poll_at,
    claimed_session.poll_lease_expires_at
  );

  return pg_catalog.jsonb_build_object(
    'claimed', false,
    'connectedAccountId', claimed_session.connected_account_id,
    'sessionId', claimed_session.id,
    'status', claimed_session.status,
    'leaseToken', null,
    'leaseExpiresAt', claimed_session.poll_lease_expires_at,
    'retryAt', retry_at
  );
end;
$function$;

create function public.nudge_yahoo_draft_poll(
  p_session_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  session public.yahoo_draft_sessions%rowtype;
  nudged_at timestamptz := pg_catalog.clock_timestamp();
begin
  update public.yahoo_draft_sessions as candidate
  set
    next_poll_at = least(candidate.next_poll_at, nudged_at),
    last_nudged_at = nudged_at
  where candidate.id = p_session_id
    and candidate.user_id = p_user_id
    and candidate.status in ('predraft', 'active')
    and (
      candidate.last_nudged_at is null
      or candidate.last_nudged_at <= nudged_at - interval '5 seconds'
    )
    and (
      candidate.poll_lease_token is null
      or candidate.poll_lease_expires_at <= nudged_at
    )
  returning candidate.* into session;

  if found then
    return pg_catalog.jsonb_build_object(
      'nudged', true,
      'nextPollAt', session.next_poll_at,
      'retryAt', nudged_at + interval '5 seconds'
    );
  end if;

  select candidate.* into session
  from public.yahoo_draft_sessions as candidate
  where candidate.id = p_session_id
    and candidate.user_id = p_user_id;

  if not found then
    raise exception using message = 'YAHOO_DRAFT_SESSION_NOT_FOUND';
  end if;

  return pg_catalog.jsonb_build_object(
    'nudged', false,
    'nextPollAt', session.next_poll_at,
    'retryAt', greatest(
      session.last_nudged_at + interval '5 seconds',
      session.poll_lease_expires_at,
      session.next_poll_at
    )
  );
end;
$function$;

create function public.bump_yahoo_draft_pick_mapping_revision()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if old.fhfh_player_id is distinct from new.fhfh_player_id
     or old.mapping_status is distinct from new.mapping_status
  then
    new.mapping_revision := old.mapping_revision + 1;
  end if;
  return new;
end;
$function$;

create trigger yahoo_draft_picks_bump_mapping_revision
before update on public.yahoo_draft_picks
for each row execute function public.bump_yahoo_draft_pick_mapping_revision();

create function public.reconcile_yahoo_draft_pick_identities(
  p_session_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  updated_count bigint;
begin
  if p_session_id is null then
    raise exception using message = 'YAHOO_DRAFT_IDENTITY_RECONCILIATION_INVALID';
  end if;

  if not exists (
    select 1
    from public.yahoo_draft_sessions as session
    where session.id = p_session_id
  ) then
    raise exception using message = 'YAHOO_DRAFT_SESSION_NOT_FOUND';
  end if;

  with resolved as (
    select
      pick.session_id,
      pick.pick_number,
      pg_catalog.min(external.fhfh_player_id) as fhfh_player_id
    from public.yahoo_draft_picks as pick
    join public.yahoo_draft_sessions as session
      on session.id = pick.session_id
    join public.fhfh_player_external_identities as external
      on external.provider = 'yahoo'
     and external.external_player_id = pick.yahoo_player_key
     and external.context_key = pg_catalog.format(
       'yahoo:game:%s:season:%s',
       session.yahoo_game_key,
       session.yahoo_season
     )
     and external.season_id = session.target_season_id
     and external.verification_status = 'verified'
    join public.fhfh_player_identities as identity
      on identity.id = external.fhfh_player_id
     and identity.verification_status = 'verified'
    where pick.session_id = p_session_id
      and pick.mapping_status in ('unmapped', 'review_required')
    group by pick.session_id, pick.pick_number
    having pg_catalog.count(distinct external.fhfh_player_id) = 1
  ), updated as (
    update public.yahoo_draft_picks as pick
    set
      fhfh_player_id = resolved.fhfh_player_id,
      mapping_status = 'mapped',
      mapping_revision = pick.mapping_revision + 1,
      updated_at = pg_catalog.clock_timestamp()
    from resolved
    where pick.session_id = resolved.session_id
      and pick.pick_number = resolved.pick_number
      and (
        pick.fhfh_player_id is distinct from resolved.fhfh_player_id
        or pick.mapping_status is distinct from 'mapped'
      )
    returning 1
  )
  select pg_catalog.count(*) into updated_count from updated;

  return pg_catalog.jsonb_build_object(
    'sessionId', p_session_id,
    'updatedPickCount', updated_count
  );
end;
$function$;

create function public.cleanup_yahoo_draft_poll_observations(
  p_before timestamptz default pg_catalog.clock_timestamp() - interval '30 days'
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  deleted_count bigint;
begin
  delete from public.yahoo_draft_poll_observations as observation
  where observation.created_at < p_before;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$function$;

create function public.verified_yahoo_player_identities_read()
returns table (
  external_player_id text,
  season_id bigint,
  fhfh_player_id bigint,
  nhl_player_id bigint,
  canonical_name text
)
language sql
stable
security definer
set search_path = ''
set row_security = off
as $function$
  select
    external.external_player_id,
    external.season_id,
    identity.id,
    identity.nhl_player_id,
    identity.canonical_name
  from public.fhfh_player_external_identities as external
  join public.fhfh_player_identities as identity
    on identity.id = external.fhfh_player_id
  where external.provider = 'yahoo'
    and external.verification_status = 'verified'
    and identity.verification_status = 'verified'
    and identity.nhl_player_id is not null
    and external.season_id is not null
    and external.context_key like 'yahoo:game:%:season:%'
    and external.external_player_id ~ '^[0-9]+[.]p[.][0-9]+$'
    and not exists (
      select 1
      from public.fhfh_player_external_identities as conflicting
      where conflicting.provider = external.provider
        and conflicting.external_player_id = external.external_player_id
        and conflicting.context_key = external.context_key
        and conflicting.season_id = external.season_id
        and conflicting.verification_status = 'verified'
        and conflicting.fhfh_player_id <> external.fhfh_player_id
    );
$function$;

create or replace view public.yahoo_nhl_player_map_read
with (security_invoker = true)
as
select
  canonical.nhl_player_id::text as nhl_player_id,
  canonical.canonical_name as nhl_player_name,
  coalesce(player.editorial_team_abbreviation, legacy.nhl_team_abbreviation)::text
    as nhl_team_abbreviation,
  player.player_key as yahoo_player_id,
  coalesce(player.full_name, player.player_name, legacy.yahoo_player_name)
    as yahoo_player_name,
  coalesce(player.editorial_team_abbreviation, legacy.yahoo_team) as yahoo_team,
  coalesce(player.percent_ownership, legacy.percent_ownership)
    as percent_ownership,
  coalesce(player.eligible_positions, legacy.eligible_positions)
    as eligible_positions,
  coalesce(player.injury_note, legacy.injury_note) as injury_note,
  coalesce(player.status, legacy.status) as status,
  coalesce(player.status_full, legacy.status_full) as status_full,
  legacy.points,
  legacy.goals,
  legacy.assists,
  legacy.shots,
  legacy.pp_points,
  legacy.blocked_shots,
  legacy.hits,
  legacy.total_fow,
  legacy.penalty_minutes,
  legacy.sh_points,
  legacy.wins,
  legacy.losses,
  legacy.saves,
  legacy.shots_against,
  legacy.shutouts,
  legacy.quality_start,
  legacy.goals_against_avg,
  legacy.save_pct,
  coalesce(player.position_type, legacy.player_type)::text as player_type,
  case
    when lower(coalesce(player.position_type, legacy.player_type, ''))
      in ('g', 'goalie') then 'G'
    else 'Skater'
  end as player_position,
  case
    when lower(coalesce(player.position_type, legacy.player_type, ''))
      in ('g', 'goalie') then 'G'
    else 'Skater'
  end as mapped_position,
  case
    when lower(coalesce(player.position_type, legacy.player_type, ''))
      in ('g', 'goalie') then 'G'
    else 'Skater'
  end as normalized_position,
  public.immutable_unaccent(
    lower(
      coalesce(
        player.editorial_team_abbreviation,
        legacy.nhl_team_abbreviation,
        legacy.yahoo_team
      )
    )
  ) as normalized_team,
  null::numeric as percent_games,
  canonical.fhfh_player_id as fhfh_player_id
from public.verified_yahoo_player_identities_read() as canonical
join public.yahoo_players as player
  on player.player_key = canonical.external_player_id
left join lateral (
  select mapping.*
  from public.yahoo_nhl_player_map as mapping
  where mapping.nhl_player_id = canonical.nhl_player_id::text
    and mapping.yahoo_player_id in (player.player_key, player.player_id)
  order by
    (mapping.yahoo_player_id = player.player_key) desc,
    mapping.percent_ownership desc nulls last
  limit 1
) as legacy on true;

comment on function public.verified_yahoo_player_identities_read() is
  'Narrow public projection of unambiguous, verified canonical Yahoo-to-NHL identities. It exposes no review provenance.';
comment on view public.yahoo_nhl_player_map_read is
  'Compatibility reader whose identity authority is verified canonical FHFH identity plus exact seasonal Yahoo player data; legacy rows only decorate an already-agreed identity.';

revoke all on function public.create_yahoo_oauth_transaction(
  text, uuid, text, text, text, text, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.consume_yahoo_oauth_transaction(text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.cleanup_yahoo_oauth_transactions(timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_yahoo_token_refresh_lease(uuid, uuid, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.release_yahoo_token_refresh_lease(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_yahoo_draft_poll(uuid, uuid, integer, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.nudge_yahoo_draft_poll(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.bump_yahoo_draft_pick_mapping_revision()
  from public, anon, authenticated, service_role;
revoke all on function public.reconcile_yahoo_draft_pick_identities(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.cleanup_yahoo_draft_poll_observations(timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.verified_yahoo_player_identities_read()
  from public, anon, authenticated, service_role;

grant execute on function public.create_yahoo_oauth_transaction(
  text, uuid, text, text, text, text, timestamptz
) to service_role;
grant execute on function public.consume_yahoo_oauth_transaction(text, text)
  to service_role;
grant execute on function public.cleanup_yahoo_oauth_transactions(timestamptz)
  to service_role;
grant execute on function public.claim_yahoo_token_refresh_lease(uuid, uuid, integer)
  to service_role;
grant execute on function public.release_yahoo_token_refresh_lease(uuid, uuid, uuid)
  to service_role;
grant execute on function public.claim_yahoo_draft_poll(uuid, uuid, integer, timestamptz)
  to service_role;
grant execute on function public.nudge_yahoo_draft_poll(uuid, uuid)
  to service_role;
grant execute on function public.reconcile_yahoo_draft_pick_identities(uuid)
  to service_role;
grant execute on function public.cleanup_yahoo_draft_poll_observations(timestamptz)
  to service_role;
grant execute on function public.verified_yahoo_player_identities_read()
  to anon, authenticated, service_role;
