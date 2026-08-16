-- Durable, owner-scoped Yahoo live-draft state. The browser may read these
-- tables through RLS and Realtime; only trusted server code may mutate them.

alter table public.provider_sync_runs
  add constraint provider_sync_runs_owner_key unique (id, user_id);

create table public.yahoo_draft_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connected_account_id uuid not null,
  external_league_id uuid not null,
  external_team_id uuid not null,
  draft_ranking_id uuid,
  yahoo_game_key text not null,
  yahoo_season integer not null,
  target_season_id bigint not null references public.seasons(id) on delete restrict,
  yahoo_league_key text not null,
  yahoo_team_key text not null,
  normalized_settings jsonb not null default '{}'::jsonb,
  diagnostics jsonb not null default '{}'::jsonb,
  last_provider_sync_run_id uuid,
  status text not null default 'predraft',
  provider_status text not null default 'unknown',
  snapshot_hash text,
  snapshot_version bigint not null default 0,
  last_pick_number integer not null default 0,
  last_snapshot_at timestamptz,
  last_changed_at timestamptz,
  poll_lease_token uuid,
  poll_lease_expires_at timestamptz,
  next_poll_at timestamptz not null default pg_catalog.clock_timestamp(),
  last_polled_at timestamptz,
  consecutive_failures integer not null default 0,
  last_error_code text,
  last_error_message text,
  started_at timestamptz not null default pg_catalog.clock_timestamp(),
  completed_at timestamptz,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint yahoo_draft_sessions_owner_key unique (id, user_id),
  constraint yahoo_draft_sessions_user_league_key
    unique (user_id, yahoo_league_key),
  constraint yahoo_draft_sessions_account_owner_fk
    foreign key (connected_account_id, user_id)
    references public.connected_accounts(id, user_id) on delete cascade,
  constraint yahoo_draft_sessions_league_owner_fk
    foreign key (external_league_id, user_id)
    references public.external_leagues(id, user_id) on delete cascade,
  constraint yahoo_draft_sessions_team_owner_fk
    foreign key (external_team_id, user_id)
    references public.external_teams(id, user_id) on delete cascade,
  constraint yahoo_draft_sessions_ranking_owner_fk
    foreign key (draft_ranking_id, user_id, target_season_id)
    references public.draft_rankings(id, user_id, target_season_id)
    on delete cascade,
  constraint yahoo_draft_sessions_sync_run_owner_fk
    foreign key (last_provider_sync_run_id, user_id)
    references public.provider_sync_runs(id, user_id) on delete restrict,
  constraint yahoo_draft_sessions_game_key_nonblank
    check (pg_catalog.btrim(yahoo_game_key) <> ''),
  constraint yahoo_draft_sessions_yahoo_season_valid
    check (yahoo_season between 1900 and 3000),
  constraint yahoo_draft_sessions_league_key_nonblank
    check (pg_catalog.btrim(yahoo_league_key) <> ''),
  constraint yahoo_draft_sessions_team_key_nonblank
    check (pg_catalog.btrim(yahoo_team_key) <> ''),
  constraint yahoo_draft_sessions_status_valid
    check (status in (
      'predraft', 'active', 'stopped', 'complete', 'error', 'reauth_required'
    )),
  constraint yahoo_draft_sessions_provider_status_valid
    check (provider_status in ('predraft', 'drafting', 'postdraft', 'unknown')),
  constraint yahoo_draft_sessions_settings_object
    check (pg_catalog.jsonb_typeof(normalized_settings) = 'object'),
  constraint yahoo_draft_sessions_diagnostics_object
    check (pg_catalog.jsonb_typeof(diagnostics) = 'object'),
  constraint yahoo_draft_sessions_snapshot_valid
    check (
      (snapshot_version = 0 and snapshot_hash is null)
      or (
        snapshot_version > 0
        and snapshot_hash ~ '^[a-f0-9]{64}$'
      )
    ),
  constraint yahoo_draft_sessions_last_pick_nonnegative
    check (last_pick_number >= 0),
  constraint yahoo_draft_sessions_failures_nonnegative
    check (consecutive_failures >= 0),
  constraint yahoo_draft_sessions_lease_pair_valid
    check (
      (poll_lease_token is null) = (poll_lease_expires_at is null)
    ),
  constraint yahoo_draft_sessions_error_code_length
    check (last_error_code is null or pg_catalog.length(last_error_code) <= 128),
  constraint yahoo_draft_sessions_error_message_length
    check (last_error_message is null or pg_catalog.length(last_error_message) <= 2000),
  constraint yahoo_draft_sessions_completion_valid
    check (
      (status = 'complete' and completed_at is not null)
      or (status <> 'complete' and completed_at is null)
    )
);

comment on table public.yahoo_draft_sessions is
  'Owner-scoped polling, lease, and snapshot state for a Yahoo live draft.';

create table public.yahoo_draft_picks (
  session_id uuid not null,
  user_id uuid not null,
  pick_number integer not null,
  round_number integer not null,
  pick_in_round integer not null,
  yahoo_team_key text not null,
  external_team_id uuid,
  yahoo_player_key text not null,
  yahoo_player_id text not null,
  fhfh_player_id bigint,
  mapping_status text not null,
  player_name text,
  nhl_team_abbreviation text,
  position text,
  auction_cost numeric(10, 2),
  is_active boolean not null default true,
  is_correction boolean not null default false,
  revision bigint not null default 1,
  first_observed_at timestamptz not null,
  last_observed_at timestamptz not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint yahoo_draft_picks_pkey primary key (session_id, pick_number),
  constraint yahoo_draft_picks_session_owner_fk
    foreign key (session_id, user_id)
    references public.yahoo_draft_sessions(id, user_id) on delete cascade,
  constraint yahoo_draft_picks_team_owner_fk
    foreign key (external_team_id, user_id)
    references public.external_teams(id, user_id) on delete cascade,
  constraint yahoo_draft_picks_player_fk
    foreign key (fhfh_player_id)
    references public.fhfh_player_identities(id) on delete set null,
  constraint yahoo_draft_picks_pick_positive check (pick_number > 0),
  constraint yahoo_draft_picks_round_positive check (round_number > 0),
  constraint yahoo_draft_picks_pick_in_round_positive check (pick_in_round > 0),
  constraint yahoo_draft_picks_team_key_nonblank
    check (pg_catalog.btrim(yahoo_team_key) <> ''),
  constraint yahoo_draft_picks_player_key_nonblank
    check (pg_catalog.btrim(yahoo_player_key) <> ''),
  constraint yahoo_draft_picks_player_id_nonblank
    check (pg_catalog.btrim(yahoo_player_id) <> ''),
  constraint yahoo_draft_picks_mapping_status_valid
    check (mapping_status in ('mapped', 'unmapped', 'review_required')),
  constraint yahoo_draft_picks_mapping_identity_valid
    check ((mapping_status = 'mapped') = (fhfh_player_id is not null)),
  constraint yahoo_draft_picks_player_name_nonblank
    check (player_name is null or pg_catalog.btrim(player_name) <> ''),
  constraint yahoo_draft_picks_nhl_team_nonblank
    check (
      nhl_team_abbreviation is null
      or pg_catalog.btrim(nhl_team_abbreviation) <> ''
    ),
  constraint yahoo_draft_picks_position_nonblank
    check (position is null or pg_catalog.btrim(position) <> ''),
  constraint yahoo_draft_picks_auction_cost_nonnegative
    check (auction_cost is null or auction_cost >= 0),
  constraint yahoo_draft_picks_revision_positive check (revision > 0)
);

comment on table public.yahoo_draft_picks is
  'Authoritative Yahoo draft-pick slots; missing picks are retained as inactive.';

comment on column public.yahoo_draft_picks.revision is
  'Monotonic material-state revision; pure re-observation does not increment it.';

create index yahoo_draft_sessions_account_owner_idx
  on public.yahoo_draft_sessions (connected_account_id, user_id);
create index yahoo_draft_sessions_league_owner_idx
  on public.yahoo_draft_sessions (external_league_id, user_id);
create index yahoo_draft_sessions_team_owner_idx
  on public.yahoo_draft_sessions (external_team_id, user_id);
create index yahoo_draft_sessions_ranking_owner_idx
  on public.yahoo_draft_sessions (draft_ranking_id, user_id, target_season_id)
  where draft_ranking_id is not null;
create index yahoo_draft_sessions_target_season_idx
  on public.yahoo_draft_sessions (target_season_id, user_id);
create index yahoo_draft_sessions_sync_run_idx
  on public.yahoo_draft_sessions (last_provider_sync_run_id, user_id)
  where last_provider_sync_run_id is not null;
create index yahoo_draft_sessions_user_status_idx
  on public.yahoo_draft_sessions (user_id, status, updated_at desc);
create index yahoo_draft_sessions_poll_due_idx
  on public.yahoo_draft_sessions (next_poll_at, poll_lease_expires_at)
  where status in ('predraft', 'active');

create index yahoo_draft_picks_session_owner_idx
  on public.yahoo_draft_picks (session_id, user_id);
create index yahoo_draft_picks_user_session_idx
  on public.yahoo_draft_picks (user_id, session_id, pick_number);
create index yahoo_draft_picks_team_owner_idx
  on public.yahoo_draft_picks (external_team_id, user_id)
  where external_team_id is not null;
create index yahoo_draft_picks_player_idx
  on public.yahoo_draft_picks (fhfh_player_id)
  where fhfh_player_id is not null;

create function public.set_yahoo_draft_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  new.updated_at := pg_catalog.statement_timestamp();
  return new;
end;
$function$;

create trigger yahoo_draft_sessions_set_updated_at
before update on public.yahoo_draft_sessions
for each row execute function public.set_yahoo_draft_updated_at();

create trigger yahoo_draft_picks_set_updated_at
before update on public.yahoo_draft_picks
for each row execute function public.set_yahoo_draft_updated_at();

alter table public.yahoo_draft_sessions enable row level security;
alter table public.yahoo_draft_sessions force row level security;
alter table public.yahoo_draft_picks enable row level security;
alter table public.yahoo_draft_picks force row level security;

revoke all on table public.yahoo_draft_sessions
  from public, anon, authenticated, service_role;
revoke all on table public.yahoo_draft_picks
  from public, anon, authenticated, service_role;
grant select on table public.yahoo_draft_sessions to authenticated;
grant select on table public.yahoo_draft_picks to authenticated;
grant select, insert, update, delete on table public.yahoo_draft_sessions
  to service_role;
grant select, insert, update, delete on table public.yahoo_draft_picks
  to service_role;

create policy yahoo_draft_sessions_owner_select
on public.yahoo_draft_sessions
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy yahoo_draft_picks_owner_select
on public.yahoo_draft_picks
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on function public.set_yahoo_draft_updated_at()
  from public, anon, authenticated, service_role;

-- The migration must fail loudly if the Supabase publication is unavailable;
-- silently skipping it would leave the companion looking connected but stale.
do $publication$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication
    where pubname = 'supabase_realtime'
  ) then
    raise exception using message = 'YAHOO_DRAFT_REALTIME_PUBLICATION_MISSING';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'yahoo_draft_sessions'
  ) then
    alter publication supabase_realtime
      add table public.yahoo_draft_sessions;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'yahoo_draft_picks'
  ) then
    alter publication supabase_realtime
      add table public.yahoo_draft_picks;
  end if;
end;
$publication$;

create function public.claim_yahoo_draft_poll(
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
    poll_lease_expires_at = p_claimed_at
      + pg_catalog.make_interval(secs => p_lease_seconds)
  where session.id = p_session_id
    and session.user_id = p_user_id
    and session.status in ('predraft', 'active')
    and session.next_poll_at <= p_claimed_at
    and (
      session.poll_lease_token is null
      or session.poll_lease_expires_at <= p_claimed_at
    )
  returning session.* into claimed_session;

  if found then
    return pg_catalog.jsonb_build_object(
      'claimed', true,
      'sessionId', claimed_session.id,
      'status', claimed_session.status,
      'leaseToken', claimed_session.poll_lease_token,
      'leaseExpiresAt', claimed_session.poll_lease_expires_at,
      'retryAt', claimed_session.poll_lease_expires_at
    );
  end if;

  select session.*
  into claimed_session
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
    'sessionId', claimed_session.id,
    'status', claimed_session.status,
    'leaseToken', null,
    'leaseExpiresAt', claimed_session.poll_lease_expires_at,
    'retryAt', retry_at
  );
end;
$function$;

create function public.apply_yahoo_draft_snapshot(
  p_session_id uuid,
  p_user_id uuid,
  p_lease_token uuid,
  p_snapshot_hash text,
  p_status text,
  p_provider_status text,
  p_normalized_settings jsonb,
  p_diagnostics jsonb,
  p_provider_sync_run_id uuid,
  p_picks jsonb,
  p_next_poll_at timestamptz,
  p_observed_at timestamptz default pg_catalog.clock_timestamp()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  locked_session public.yahoo_draft_sessions%rowtype;
  normalized_picks jsonb;
  source_count integer;
  active_pick_count integer;
  upserted_pick_count integer := 0;
  deactivated_pick_count integer := 0;
  next_snapshot_version bigint;
  snapshot_changed boolean;
begin
  if p_session_id is null
     or p_user_id is null
     or p_lease_token is null
     or p_snapshot_hash is null
     or p_snapshot_hash !~ '^[a-f0-9]{64}$'
     or p_status is null
     or p_status not in (
       'predraft', 'active', 'stopped', 'complete', 'error', 'reauth_required'
     )
     or p_provider_status is null
     or p_provider_status not in ('predraft', 'drafting', 'postdraft', 'unknown')
     or p_normalized_settings is null
     or pg_catalog.jsonb_typeof(p_normalized_settings) <> 'object'
     or p_diagnostics is null
     or pg_catalog.jsonb_typeof(p_diagnostics) <> 'object'
     or p_picks is null
     or pg_catalog.jsonb_typeof(p_picks) <> 'array'
     or p_next_poll_at is null
     or p_observed_at is null
  then
    raise exception using message = 'YAHOO_DRAFT_SNAPSHOT_INVALID';
  end if;

  begin
    select
      coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'pick_number', parsed.pick_number,
            'round_number', parsed.round_number,
            'pick_in_round', parsed.pick_in_round,
            'yahoo_team_key', pg_catalog.btrim(parsed.yahoo_team_key),
            'external_team_id', parsed.external_team_id,
            'yahoo_player_key', pg_catalog.btrim(parsed.yahoo_player_key),
            'yahoo_player_id', pg_catalog.btrim(parsed.yahoo_player_id),
            'fhfh_player_id', parsed.fhfh_player_id,
            'mapping_status', pg_catalog.btrim(parsed.mapping_status),
            'player_name', nullif(pg_catalog.btrim(parsed.player_name), ''),
            'nhl_team_abbreviation', nullif(
              pg_catalog.upper(pg_catalog.btrim(parsed.nhl_team_abbreviation)),
              ''
            ),
            'position', nullif(
              pg_catalog.upper(pg_catalog.btrim(parsed.position)),
              ''
            ),
            'auction_cost', parsed.auction_cost,
            'is_correction', coalesce(parsed.is_correction, false)
          )
          order by parsed.pick_number
        ),
        '[]'::jsonb
      ),
      pg_catalog.count(*)::integer
    into normalized_picks, source_count
    from pg_catalog.jsonb_to_recordset(p_picks) as parsed(
      pick_number integer,
      round_number integer,
      pick_in_round integer,
      yahoo_team_key text,
      external_team_id uuid,
      yahoo_player_key text,
      yahoo_player_id text,
      fhfh_player_id bigint,
      mapping_status text,
      player_name text,
      nhl_team_abbreviation text,
      position text,
      auction_cost numeric,
      is_correction boolean
    );
  exception when others then
    raise exception using message = 'YAHOO_DRAFT_SNAPSHOT_ROWS_INVALID';
  end;

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(normalized_picks) as pick(
      pick_number integer,
      round_number integer,
      pick_in_round integer,
      yahoo_team_key text,
      yahoo_player_key text,
      yahoo_player_id text,
      fhfh_player_id bigint,
      mapping_status text,
      auction_cost numeric
    )
    where pick.pick_number is null
       or pick.pick_number <= 0
       or pick.round_number is null
       or pick.round_number <= 0
       or pick.pick_in_round is null
       or pick.pick_in_round <= 0
       or coalesce(pick.yahoo_team_key, '') = ''
       or coalesce(pick.yahoo_player_key, '') = ''
       or coalesce(pick.yahoo_player_id, '') = ''
       or pick.mapping_status is null
       or pick.mapping_status not in ('mapped', 'unmapped', 'review_required')
       or ((pick.mapping_status = 'mapped') <> (pick.fhfh_player_id is not null))
       or pick.auction_cost < 0
  )
  or (
    select pg_catalog.count(distinct pick.pick_number)
    from pg_catalog.jsonb_to_recordset(normalized_picks)
      as pick(pick_number integer)
  ) <> source_count
  or (
    select pg_catalog.count(distinct pick.yahoo_player_key)
    from pg_catalog.jsonb_to_recordset(normalized_picks)
      as pick(yahoo_player_key text)
  ) <> source_count
  or exists (
    select 1
    from pg_catalog.jsonb_to_recordset(normalized_picks)
      as pick(external_team_id uuid)
    where pick.external_team_id is not null
      and not exists (
        select 1
        from public.external_teams as external_team
        where external_team.id = pick.external_team_id
          and external_team.user_id = p_user_id
      )
  )
  or (
    p_provider_sync_run_id is not null
    and not exists (
      select 1
      from public.provider_sync_runs as sync_run
      where sync_run.id = p_provider_sync_run_id
        and sync_run.user_id = p_user_id
    )
  )
  then
    raise exception using message = 'YAHOO_DRAFT_SNAPSHOT_ROWS_INVALID';
  end if;

  select session.*
  into locked_session
  from public.yahoo_draft_sessions as session
  where session.id = p_session_id
    and session.user_id = p_user_id
  for update;

  if not found then
    raise exception using message = 'YAHOO_DRAFT_SESSION_NOT_FOUND';
  end if;

  if locked_session.poll_lease_token is distinct from p_lease_token
     or locked_session.poll_lease_expires_at <= p_observed_at
  then
    raise exception using message = 'YAHOO_DRAFT_POLL_LEASE_LOST';
  end if;

  snapshot_changed := locked_session.snapshot_hash is distinct from p_snapshot_hash;
  next_snapshot_version := locked_session.snapshot_version;

  if snapshot_changed then
    insert into public.yahoo_draft_picks (
      session_id,
      user_id,
      pick_number,
      round_number,
      pick_in_round,
      yahoo_team_key,
      external_team_id,
      yahoo_player_key,
      yahoo_player_id,
      fhfh_player_id,
      mapping_status,
      player_name,
      nhl_team_abbreviation,
      position,
      auction_cost,
      is_active,
      is_correction,
      revision,
      first_observed_at,
      last_observed_at
    )
    select
      p_session_id,
      p_user_id,
      pick.pick_number,
      pick.round_number,
      pick.pick_in_round,
      pick.yahoo_team_key,
      pick.external_team_id,
      pick.yahoo_player_key,
      pick.yahoo_player_id,
      pick.fhfh_player_id,
      pick.mapping_status,
      pick.player_name,
      pick.nhl_team_abbreviation,
      pick.position,
      pick.auction_cost,
      true,
      pick.is_correction,
      1,
      p_observed_at,
      p_observed_at
    from pg_catalog.jsonb_to_recordset(normalized_picks) as pick(
      pick_number integer,
      round_number integer,
      pick_in_round integer,
      yahoo_team_key text,
      external_team_id uuid,
      yahoo_player_key text,
      yahoo_player_id text,
      fhfh_player_id bigint,
      mapping_status text,
      player_name text,
      nhl_team_abbreviation text,
      position text,
      auction_cost numeric,
      is_correction boolean
    )
    on conflict (session_id, pick_number) do update
    set
      user_id = excluded.user_id,
      round_number = excluded.round_number,
      pick_in_round = excluded.pick_in_round,
      yahoo_team_key = excluded.yahoo_team_key,
      external_team_id = excluded.external_team_id,
      yahoo_player_key = excluded.yahoo_player_key,
      yahoo_player_id = excluded.yahoo_player_id,
      fhfh_player_id = excluded.fhfh_player_id,
      mapping_status = excluded.mapping_status,
      player_name = excluded.player_name,
      nhl_team_abbreviation = excluded.nhl_team_abbreviation,
      position = excluded.position,
      auction_cost = excluded.auction_cost,
      is_active = true,
      is_correction = (
        public.yahoo_draft_picks.is_correction
        or excluded.is_correction
        or not public.yahoo_draft_picks.is_active
        or public.yahoo_draft_picks.yahoo_player_key
          is distinct from excluded.yahoo_player_key
        or public.yahoo_draft_picks.yahoo_player_id
          is distinct from excluded.yahoo_player_id
      ),
      revision = public.yahoo_draft_picks.revision + 1,
      last_observed_at = excluded.last_observed_at
    where (
      public.yahoo_draft_picks.user_id,
      public.yahoo_draft_picks.round_number,
      public.yahoo_draft_picks.pick_in_round,
      public.yahoo_draft_picks.yahoo_team_key,
      public.yahoo_draft_picks.external_team_id,
      public.yahoo_draft_picks.yahoo_player_key,
      public.yahoo_draft_picks.yahoo_player_id,
      public.yahoo_draft_picks.fhfh_player_id,
      public.yahoo_draft_picks.mapping_status,
      public.yahoo_draft_picks.player_name,
      public.yahoo_draft_picks.nhl_team_abbreviation,
      public.yahoo_draft_picks.position,
      public.yahoo_draft_picks.auction_cost,
      public.yahoo_draft_picks.is_active
    ) is distinct from (
      excluded.user_id,
      excluded.round_number,
      excluded.pick_in_round,
      excluded.yahoo_team_key,
      excluded.external_team_id,
      excluded.yahoo_player_key,
      excluded.yahoo_player_id,
      excluded.fhfh_player_id,
      excluded.mapping_status,
      excluded.player_name,
      excluded.nhl_team_abbreviation,
      excluded.position,
      excluded.auction_cost,
      true
    )
    or (
      excluded.is_correction
      and not public.yahoo_draft_picks.is_correction
    );

    get diagnostics upserted_pick_count = row_count;

    update public.yahoo_draft_picks as existing
    set
      is_active = false,
      is_correction = true,
      revision = existing.revision + 1,
      last_observed_at = p_observed_at
    where existing.session_id = p_session_id
      and existing.user_id = p_user_id
      and existing.is_active
      and not exists (
        select 1
        from pg_catalog.jsonb_to_recordset(normalized_picks)
          as current_pick(pick_number integer)
        where current_pick.pick_number = existing.pick_number
      );

    get diagnostics deactivated_pick_count = row_count;
    next_snapshot_version := locked_session.snapshot_version + 1;
  end if;

  select
    pg_catalog.count(*)::integer,
    coalesce(pg_catalog.max(pick.pick_number), 0)::integer
  into active_pick_count, locked_session.last_pick_number
  from public.yahoo_draft_picks as pick
  where pick.session_id = p_session_id
    and pick.user_id = p_user_id
    and pick.is_active;

  update public.yahoo_draft_sessions as session
  set
    status = p_status,
    provider_status = p_provider_status,
    normalized_settings = p_normalized_settings,
    diagnostics = p_diagnostics,
    last_provider_sync_run_id = coalesce(
      p_provider_sync_run_id,
      session.last_provider_sync_run_id
    ),
    snapshot_hash = case
      when snapshot_changed then p_snapshot_hash
      else session.snapshot_hash
    end,
    snapshot_version = next_snapshot_version,
    last_pick_number = locked_session.last_pick_number,
    last_snapshot_at = p_observed_at,
    last_changed_at = case
      when snapshot_changed then p_observed_at
      else session.last_changed_at
    end,
    poll_lease_token = null,
    poll_lease_expires_at = null,
    next_poll_at = p_next_poll_at,
    last_polled_at = p_observed_at,
    consecutive_failures = 0,
    last_error_code = null,
    last_error_message = null,
    completed_at = case
      when p_status = 'complete'
        then coalesce(session.completed_at, p_observed_at)
      else null
    end
  where session.id = p_session_id
    and session.user_id = p_user_id;

  return pg_catalog.jsonb_build_object(
    'sessionId', p_session_id,
    'changed', snapshot_changed,
    'snapshotVersion', next_snapshot_version,
    'activePickCount', active_pick_count,
    'mutatedPickCount', upserted_pick_count + deactivated_pick_count,
    'deactivatedPickCount', deactivated_pick_count,
    'status', p_status,
    'providerStatus', p_provider_status,
    'nextPollAt', p_next_poll_at
  );
end;
$function$;

create function public.record_yahoo_draft_poll_failure(
  p_session_id uuid,
  p_user_id uuid,
  p_lease_token uuid,
  p_error_code text,
  p_error_message text,
  p_retry_at timestamptz,
  p_status text default null,
  p_failed_at timestamptz default pg_catalog.clock_timestamp()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  locked_session public.yahoo_draft_sessions%rowtype;
  next_status text;
  next_failure_count integer;
begin
  if p_session_id is null
     or p_user_id is null
     or p_lease_token is null
     or p_error_code is null
     or pg_catalog.btrim(p_error_code) = ''
     or p_retry_at is null
     or p_failed_at is null
     or p_retry_at < p_failed_at
     or (
       p_status is not null
       and p_status not in (
         'predraft', 'active', 'stopped', 'complete', 'error', 'reauth_required'
       )
     )
  then
    raise exception using message = 'YAHOO_DRAFT_POLL_FAILURE_INVALID';
  end if;

  select session.*
  into locked_session
  from public.yahoo_draft_sessions as session
  where session.id = p_session_id
    and session.user_id = p_user_id
  for update;

  if not found then
    raise exception using message = 'YAHOO_DRAFT_SESSION_NOT_FOUND';
  end if;

  if locked_session.poll_lease_token is distinct from p_lease_token
     or locked_session.poll_lease_expires_at <= p_failed_at
  then
    raise exception using message = 'YAHOO_DRAFT_POLL_LEASE_LOST';
  end if;

  next_status := coalesce(p_status, locked_session.status);
  next_failure_count := locked_session.consecutive_failures + 1;

  update public.yahoo_draft_sessions as session
  set
    status = next_status,
    poll_lease_token = null,
    poll_lease_expires_at = null,
    next_poll_at = p_retry_at,
    last_polled_at = p_failed_at,
    consecutive_failures = next_failure_count,
    last_error_code = pg_catalog.left(pg_catalog.btrim(p_error_code), 128),
    last_error_message = pg_catalog.left(
      nullif(pg_catalog.btrim(p_error_message), ''),
      2000
    ),
    completed_at = case
      when next_status = 'complete'
        then coalesce(session.completed_at, p_failed_at)
      else null
    end
  where session.id = p_session_id
    and session.user_id = p_user_id;

  return pg_catalog.jsonb_build_object(
    'sessionId', p_session_id,
    'consecutiveFailures', next_failure_count,
    'status', next_status,
    'retryAt', p_retry_at
  );
end;
$function$;

revoke all on function public.claim_yahoo_draft_poll(
  uuid, uuid, integer, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.apply_yahoo_draft_snapshot(
  uuid, uuid, uuid, text, text, text, jsonb, jsonb, uuid, jsonb,
  timestamptz, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.record_yahoo_draft_poll_failure(
  uuid, uuid, uuid, text, text, timestamptz, text, timestamptz
) from public, anon, authenticated, service_role;

grant execute on function public.claim_yahoo_draft_poll(
  uuid, uuid, integer, timestamptz
) to service_role;
grant execute on function public.apply_yahoo_draft_snapshot(
  uuid, uuid, uuid, text, text, text, jsonb, jsonb, uuid, jsonb,
  timestamptz, timestamptz
) to service_role;
grant execute on function public.record_yahoo_draft_poll_failure(
  uuid, uuid, uuid, text, text, timestamptz, text, timestamptz
) to service_role;
