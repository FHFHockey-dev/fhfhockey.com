-- Owner-scoped, sanitized ESPN Fantasy Hockey state. Credentials remain in
-- connected_account_tokens/Vault and never enter these tables.

create table public.external_league_state_snapshots (
  id uuid primary key default gen_random_uuid(),
  external_league_id uuid not null,
  connected_account_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  schema_version integer not null default 1,
  normalized_state jsonb not null default '{}'::jsonb,
  snapshot_hash text not null,
  sync_cursor jsonb not null default '{}'::jsonb,
  last_full_sync_at timestamptz,
  last_incremental_sync_at timestamptz,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint external_league_state_snapshots_league_unique
    unique (external_league_id),
  constraint external_league_state_snapshots_owner_key
    unique (id, user_id),
  constraint external_league_state_snapshots_league_owner_fk
    foreign key (external_league_id, user_id)
    references public.external_leagues(id, user_id) on delete cascade,
  constraint external_league_state_snapshots_account_owner_fk
    foreign key (connected_account_id, user_id)
    references public.connected_accounts(id, user_id) on delete cascade,
  constraint external_league_state_snapshots_provider_nonblank
    check (pg_catalog.btrim(provider) <> ''),
  constraint external_league_state_snapshots_schema_version_positive
    check (schema_version > 0),
  constraint external_league_state_snapshots_state_object
    check (pg_catalog.jsonb_typeof(normalized_state) = 'object'),
  constraint external_league_state_snapshots_cursor_object
    check (pg_catalog.jsonb_typeof(sync_cursor) = 'object'),
  constraint external_league_state_snapshots_hash_valid
    check (snapshot_hash ~ '^[a-f0-9]{64}$')
);

comment on table public.external_league_state_snapshots is
  'Latest normalized provider league state; no raw provider payload history.';

create index external_league_state_snapshots_account_owner_idx
  on public.external_league_state_snapshots (connected_account_id, user_id);
create index external_league_state_snapshots_user_provider_idx
  on public.external_league_state_snapshots (user_id, provider, updated_at desc);
create unique index provider_sync_runs_espn_active_lease_idx
  on public.provider_sync_runs (external_league_id)
  where provider = 'espn' and status in ('queued', 'running');

create table public.espn_draft_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connected_account_id uuid not null,
  external_league_id uuid not null,
  external_team_id uuid,
  espn_league_id text not null,
  espn_season integer not null,
  normalized_settings jsonb not null default '{}'::jsonb,
  diagnostics jsonb not null default '{}'::jsonb,
  status text not null default 'predraft',
  provider_status text not null default 'unknown',
  snapshot_hash text,
  snapshot_version bigint not null default 0,
  last_pick_number integer not null default 0,
  last_snapshot_at timestamptz,
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
  constraint espn_draft_sessions_owner_key unique (id, user_id),
  constraint espn_draft_sessions_user_league_key
    unique (user_id, external_league_id),
  constraint espn_draft_sessions_account_owner_fk
    foreign key (connected_account_id, user_id)
    references public.connected_accounts(id, user_id) on delete cascade,
  constraint espn_draft_sessions_league_owner_fk
    foreign key (external_league_id, user_id)
    references public.external_leagues(id, user_id) on delete cascade,
  constraint espn_draft_sessions_team_owner_fk
    foreign key (external_team_id, user_id)
    references public.external_teams(id, user_id) on delete cascade,
  constraint espn_draft_sessions_league_id_nonblank
    check (pg_catalog.btrim(espn_league_id) <> ''),
  constraint espn_draft_sessions_season_valid
    check (espn_season between 1900 and 3000),
  constraint espn_draft_sessions_status_valid
    check (status in (
      'predraft', 'active', 'stopped', 'complete', 'error', 'reauth_required'
    )),
  constraint espn_draft_sessions_provider_status_valid
    check (provider_status in ('predraft', 'drafting', 'postdraft', 'unknown')),
  constraint espn_draft_sessions_settings_object
    check (pg_catalog.jsonb_typeof(normalized_settings) = 'object'),
  constraint espn_draft_sessions_diagnostics_object
    check (pg_catalog.jsonb_typeof(diagnostics) = 'object'),
  constraint espn_draft_sessions_snapshot_valid
    check (
      (snapshot_version = 0 and snapshot_hash is null)
      or (snapshot_version > 0 and snapshot_hash ~ '^[a-f0-9]{64}$')
    ),
  constraint espn_draft_sessions_last_pick_nonnegative
    check (last_pick_number >= 0),
  constraint espn_draft_sessions_failures_nonnegative
    check (consecutive_failures >= 0),
  constraint espn_draft_sessions_lease_pair_valid
    check ((poll_lease_token is null) = (poll_lease_expires_at is null)),
  constraint espn_draft_sessions_error_code_length
    check (last_error_code is null or pg_catalog.length(last_error_code) <= 128),
  constraint espn_draft_sessions_error_message_length
    check (last_error_message is null or pg_catalog.length(last_error_message) <= 2000),
  constraint espn_draft_sessions_completion_valid
    check (
      (status = 'complete' and completed_at is not null)
      or (status <> 'complete' and completed_at is null)
    )
);

create table public.espn_draft_picks (
  session_id uuid not null,
  user_id uuid not null,
  external_pick_key text not null,
  pick_number integer not null,
  round_number integer not null,
  pick_in_round integer not null,
  espn_team_id text not null,
  external_team_id uuid,
  espn_player_id text not null,
  fhfh_player_id bigint,
  mapping_status text not null,
  player_name text,
  position text,
  pro_team_id integer,
  is_keeper boolean not null default false,
  bid_amount numeric(10, 2),
  is_active boolean not null default true,
  is_correction boolean not null default false,
  revision bigint not null default 1,
  first_observed_at timestamptz not null,
  last_observed_at timestamptz not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint espn_draft_picks_pkey primary key (session_id, pick_number),
  constraint espn_draft_picks_external_key_unique
    unique (session_id, external_pick_key),
  constraint espn_draft_picks_session_owner_fk
    foreign key (session_id, user_id)
    references public.espn_draft_sessions(id, user_id) on delete cascade,
  constraint espn_draft_picks_team_owner_fk
    foreign key (external_team_id, user_id)
    references public.external_teams(id, user_id) on delete cascade,
  constraint espn_draft_picks_player_fk
    foreign key (fhfh_player_id)
    references public.fhfh_player_identities(id) on delete set null,
  constraint espn_draft_picks_pick_positive check (pick_number > 0),
  constraint espn_draft_picks_round_positive check (round_number > 0),
  constraint espn_draft_picks_pick_in_round_positive check (pick_in_round > 0),
  constraint espn_draft_picks_keys_nonblank check (
    pg_catalog.btrim(external_pick_key) <> ''
    and pg_catalog.btrim(espn_team_id) <> ''
    and pg_catalog.btrim(espn_player_id) <> ''
  ),
  constraint espn_draft_picks_mapping_status_valid
    check (mapping_status in ('mapped', 'unmapped', 'review_required')),
  constraint espn_draft_picks_mapping_identity_valid
    check ((mapping_status = 'mapped') = (fhfh_player_id is not null)),
  constraint espn_draft_picks_bid_nonnegative
    check (bid_amount is null or bid_amount >= 0),
  constraint espn_draft_picks_revision_positive check (revision > 0)
);

create index espn_draft_sessions_user_status_idx
  on public.espn_draft_sessions (user_id, status, updated_at desc);
create index espn_draft_sessions_poll_due_idx
  on public.espn_draft_sessions (next_poll_at, poll_lease_expires_at)
  where status in ('predraft', 'active');
create index espn_draft_picks_user_session_idx
  on public.espn_draft_picks (user_id, session_id, pick_number);
create index espn_draft_picks_player_idx
  on public.espn_draft_picks (fhfh_player_id)
  where fhfh_player_id is not null;

create function public.set_espn_fantasy_updated_at()
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

create trigger external_league_state_snapshots_set_updated_at
before update on public.external_league_state_snapshots
for each row execute function public.set_espn_fantasy_updated_at();
create trigger espn_draft_sessions_set_updated_at
before update on public.espn_draft_sessions
for each row execute function public.set_espn_fantasy_updated_at();
create trigger espn_draft_picks_set_updated_at
before update on public.espn_draft_picks
for each row execute function public.set_espn_fantasy_updated_at();

alter table public.external_league_state_snapshots enable row level security;
alter table public.external_league_state_snapshots force row level security;
alter table public.espn_draft_sessions enable row level security;
alter table public.espn_draft_sessions force row level security;
alter table public.espn_draft_picks enable row level security;
alter table public.espn_draft_picks force row level security;

revoke all on table public.external_league_state_snapshots
  from public, anon, authenticated, service_role;
revoke all on table public.espn_draft_sessions
  from public, anon, authenticated, service_role;
revoke all on table public.espn_draft_picks
  from public, anon, authenticated, service_role;
grant select on table public.external_league_state_snapshots to authenticated;
grant select on table public.espn_draft_sessions to authenticated;
grant select on table public.espn_draft_picks to authenticated;
grant select, insert, update, delete
  on table public.external_league_state_snapshots to service_role;
grant select, insert, update, delete
  on table public.espn_draft_sessions to service_role;
grant select, insert, update, delete
  on table public.espn_draft_picks to service_role;

create policy external_league_state_snapshots_owner_select
on public.external_league_state_snapshots
for select to authenticated
using ((select auth.uid()) = user_id);
create policy espn_draft_sessions_owner_select
on public.espn_draft_sessions
for select to authenticated
using ((select auth.uid()) = user_id);
create policy espn_draft_picks_owner_select
on public.espn_draft_picks
for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on function public.set_espn_fantasy_updated_at()
  from public, anon, authenticated, service_role;

do $publication$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication
    where pubname = 'supabase_realtime'
  ) then
    raise exception using message = 'ESPN_DRAFT_REALTIME_PUBLICATION_MISSING';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'espn_draft_sessions'
  ) then
    alter publication supabase_realtime add table public.espn_draft_sessions;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'espn_draft_picks'
  ) then
    alter publication supabase_realtime add table public.espn_draft_picks;
  end if;
end;
$publication$;

create function public.commit_espn_connection_secure(
  p_user_id uuid,
  p_target_account_id uuid,
  p_account_label text,
  p_provider_user_digest text,
  p_swid text,
  p_espn_s2 text,
  p_consent_version text,
  p_league jsonb,
  p_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_account public.connected_accounts%rowtype;
  v_league public.external_leagues%rowtype;
  v_external_league_key text;
  v_existing_count integer;
begin
  if p_user_id is null
     or nullif(pg_catalog.btrim(p_account_label), '') is null
     or nullif(pg_catalog.btrim(p_provider_user_digest), '') is null
     or nullif(pg_catalog.btrim(p_swid), '') is null
     or nullif(pg_catalog.btrim(p_espn_s2), '') is null
     or p_consent_version <> 'espn-fantasy-private-beta-v1'
     or pg_catalog.jsonb_typeof(p_league) <> 'object'
     or pg_catalog.jsonb_typeof(p_snapshot) <> 'object'
  then
    raise exception using message = 'INVALID_ESPN_CONNECTION_PAYLOAD';
  end if;
  v_external_league_key := nullif(
    pg_catalog.btrim(p_league ->> 'externalLeagueKey'), ''
  );
  if v_external_league_key is null
     or nullif(pg_catalog.btrim(p_league ->> 'leagueName'), '') is null
     or nullif(pg_catalog.btrim(p_league ->> 'seasonKey'), '') is null
     or pg_catalog.jsonb_typeof(p_league -> 'leagueMetadata') <> 'object'
     or pg_catalog.jsonb_typeof(p_league -> 'scoringSettings') <> 'object'
     or pg_catalog.jsonb_typeof(p_league -> 'rosterSettings') <> 'object'
     or pg_catalog.jsonb_typeof(p_league -> 'teams') <> 'array'
     or nullif(pg_catalog.btrim(p_snapshot ->> 'snapshotHash'), '') is null
     or pg_catalog.jsonb_typeof(p_snapshot -> 'normalizedState') <> 'object'
     or pg_catalog.jsonb_typeof(p_snapshot -> 'syncCursor') <> 'object'
  then
    raise exception using message = 'INVALID_ESPN_LEAGUE_PAYLOAD';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('espn-connect:' || p_user_id::text, 0)
  );

  if p_target_account_id is null then
    select account.* into v_account
    from public.connected_accounts as account
    where account.user_id = p_user_id
      and account.provider = 'espn'
      and account.provider_user_id is null
    order by account.created_at
    limit 1
    for update;
    if not found then
      insert into public.connected_accounts (
        user_id, provider, provider_user_id, account_label, status, scopes,
        metadata, last_synced_at
      ) values (
        p_user_id,
        'espn',
        pg_catalog.btrim(p_provider_user_digest),
        pg_catalog.left(pg_catalog.btrim(p_account_label), 80),
        'connected',
        '["league:read","draft:read"]'::jsonb,
        '{}'::jsonb,
        pg_catalog.statement_timestamp()
      ) returning * into v_account;
    end if;
  else
    select account.* into v_account
    from public.connected_accounts as account
    where account.id = p_target_account_id
      and account.user_id = p_user_id
      and account.provider = 'espn'
    for update;
    if not found then
      raise exception using message = 'ESPN_ACCOUNT_NOT_FOUND';
    end if;
  end if;

  update public.connected_accounts
  set provider_user_id = pg_catalog.btrim(p_provider_user_digest),
      account_label = pg_catalog.left(pg_catalog.btrim(p_account_label), 80),
      status = 'connected',
      scopes = '["league:read","draft:read"]'::jsonb,
      metadata = coalesce(metadata, '{}'::jsonb) || pg_catalog.jsonb_build_object(
        'integration_mode', 'api',
        'integration_modes', case
          when coalesce(metadata -> 'integration_modes', '[]'::jsonb) ? 'manual_import'
            or metadata ->> 'integration_mode' = 'manual_import'
          then '["manual_import","api"]'::jsonb
          else '["api"]'::jsonb
        end,
        'api_linked', true,
        'credentials_stored', true,
        'consent_version', p_consent_version,
        'consented_at', pg_catalog.statement_timestamp()
      ),
      last_synced_at = pg_catalog.statement_timestamp(),
      updated_at = pg_catalog.statement_timestamp()
  where id = v_account.id
  returning * into v_account;

  select pg_catalog.count(*)::integer into v_existing_count
  from public.external_leagues as league
  where league.connected_account_id = v_account.id
    and league.league_metadata @> '{"api_sync_enabled":true}'::jsonb;
  if v_existing_count >= 10 and not exists (
    select 1 from public.external_leagues as league
    where league.connected_account_id = v_account.id
      and league.external_league_key = v_external_league_key
  ) then
    raise exception using message = 'ESPN_LEAGUE_LIMIT_REACHED';
  end if;

  perform public.upsert_connected_account_tokens_secure(
    v_account.id,
    p_user_id,
    'espn',
    p_swid,
    p_espn_s2,
    'espn_session_cookies_v1',
    '["league:read","draft:read"]'::jsonb,
    pg_catalog.btrim(p_provider_user_digest),
    null,
    null,
    pg_catalog.statement_timestamp(),
    pg_catalog.jsonb_build_object(
      'consent_version', p_consent_version,
      'credential_fields', pg_catalog.jsonb_build_array('SWID', 'espn_s2')
    )
  );

  insert into public.external_leagues (
    connected_account_id, user_id, provider, external_league_key, league_name,
    season_key, league_metadata, scoring_settings, roster_settings, imported_at
  ) values (
    v_account.id,
    p_user_id,
    'espn',
    v_external_league_key,
    p_league ->> 'leagueName',
    p_league ->> 'seasonKey',
    p_league -> 'leagueMetadata',
    p_league -> 'scoringSettings',
    p_league -> 'rosterSettings',
    pg_catalog.statement_timestamp()
  )
  on conflict (connected_account_id, external_league_key) do update
  set league_name = excluded.league_name,
      season_key = excluded.season_key,
      league_metadata = case
        when coalesce(
          public.external_leagues.league_metadata -> 'source_modes',
          '[]'::jsonb
        ) ? 'manual_import'
        then public.external_leagues.league_metadata
          || excluded.league_metadata
          || pg_catalog.jsonb_build_object(
            'source_modes', '["manual_import","api"]'::jsonb
          )
        else excluded.league_metadata
      end,
      scoring_settings = excluded.scoring_settings,
      roster_settings = excluded.roster_settings,
      imported_at = excluded.imported_at,
      updated_at = pg_catalog.statement_timestamp()
  returning * into v_league;

  insert into public.external_teams (
    external_league_id, connected_account_id, user_id, provider,
    external_team_key, team_name, team_metadata, roster_snapshot, imported_at
  )
  select
    v_league.id,
    v_account.id,
    p_user_id,
    'espn',
    team.external_team_key,
    team.team_name,
    team.team_metadata,
    team.roster_snapshot,
    pg_catalog.statement_timestamp()
  from pg_catalog.jsonb_to_recordset(p_league -> 'teams') as team(
    external_team_key text,
    team_name text,
    team_metadata jsonb,
    roster_snapshot jsonb
  )
  where nullif(pg_catalog.btrim(team.external_team_key), '') is not null
    and nullif(pg_catalog.btrim(team.team_name), '') is not null
    and pg_catalog.jsonb_typeof(team.team_metadata) = 'object'
    and pg_catalog.jsonb_typeof(team.roster_snapshot) = 'object'
  on conflict (external_league_id, external_team_key) do update
  set team_name = excluded.team_name,
      team_metadata = case
        when coalesce(
          public.external_teams.team_metadata -> 'source_modes',
          '[]'::jsonb
        ) ? 'manual_import'
        then public.external_teams.team_metadata
          || excluded.team_metadata
          || pg_catalog.jsonb_build_object(
            'source_modes', '["manual_import","api"]'::jsonb
          )
        else excluded.team_metadata
      end,
      roster_snapshot = excluded.roster_snapshot,
      imported_at = excluded.imported_at,
      updated_at = pg_catalog.statement_timestamp();

  insert into public.external_league_state_snapshots (
    external_league_id, connected_account_id, user_id, provider,
    schema_version, normalized_state, snapshot_hash, sync_cursor,
    last_full_sync_at, last_incremental_sync_at
  ) values (
    v_league.id,
    v_account.id,
    p_user_id,
    'espn',
    coalesce((p_snapshot ->> 'schemaVersion')::integer, 1),
    p_snapshot -> 'normalizedState',
    p_snapshot ->> 'snapshotHash',
    p_snapshot -> 'syncCursor',
    pg_catalog.statement_timestamp(),
    pg_catalog.statement_timestamp()
  )
  on conflict (external_league_id) do update
  set normalized_state = excluded.normalized_state,
      snapshot_hash = excluded.snapshot_hash,
      sync_cursor = excluded.sync_cursor,
      last_full_sync_at = excluded.last_full_sync_at,
      last_incremental_sync_at = excluded.last_incremental_sync_at,
      updated_at = pg_catalog.statement_timestamp();

  insert into public.user_provider_preferences (
    user_id, provider, connected_account_id, default_external_league_id,
    default_external_team_id, refresh_on_login, active_context
  ) values (
    p_user_id, 'espn', v_account.id, v_league.id,
    (
      select team.id from public.external_teams as team
      where team.external_league_id = v_league.id
        and team.user_id = p_user_id
        and coalesce((team.team_metadata ->> 'is_owned')::boolean, false)
      order by team.created_at limit 1
    ),
    false,
    '{}'::jsonb
  )
  on conflict (user_id, provider) do update
  set connected_account_id = excluded.connected_account_id,
      updated_at = pg_catalog.statement_timestamp();

  return pg_catalog.jsonb_build_object(
    'accountId', v_account.id,
    'externalLeagueId', v_league.id
  );
exception
  when unique_violation then
    raise exception using message = 'ESPN_CREDENTIAL_ALREADY_LINKED';
end;
$function$;

create function public.apply_espn_settings_secure(
  p_user_id uuid,
  p_external_league_id uuid,
  p_external_team_id uuid,
  p_settings_hash text,
  p_acknowledge_warnings boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_league public.external_leagues%rowtype;
  v_team public.external_teams%rowtype;
  v_settings jsonb;
  v_status text;
  v_roster_config jsonb;
  v_active_context jsonb;
  v_row public.user_settings%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('espn-apply:' || p_user_id::text, 0)
  );
  select league.* into v_league
  from public.external_leagues as league
  where league.id = p_external_league_id
    and league.user_id = p_user_id
    and league.provider = 'espn';
  if not found then raise exception using message = 'ESPN_LEAGUE_NOT_FOUND'; end if;

  v_settings := v_league.league_metadata -> 'normalized_settings';
  v_status := v_settings #>> '{diagnostics,status}';
  if pg_catalog.jsonb_typeof(v_settings) <> 'object'
     or coalesce(v_settings ->> 'sourceHash', '') <> coalesce(p_settings_hash, '')
  then raise exception using message = 'ESPN_SETTINGS_STALE'; end if;
  if v_status = 'unsupported' or v_status is null then
    raise exception using message = 'ESPN_SETTINGS_UNSUPPORTED';
  end if;
  if v_status = 'partial' and not coalesce(p_acknowledge_warnings, false) then
    raise exception using message = 'ESPN_WARNINGS_UNACKNOWLEDGED';
  end if;

  if p_external_team_id is not null then
    select team.* into v_team
    from public.external_teams as team
    where team.id = p_external_team_id
      and team.external_league_id = v_league.id
      and team.user_id = p_user_id
      and team.provider = 'espn';
    if not found then raise exception using message = 'ESPN_TEAM_NOT_FOUND'; end if;
  else
    select team.* into v_team
    from public.external_teams as team
    where team.external_league_id = v_league.id
      and team.user_id = p_user_id
      and team.provider = 'espn'
      and coalesce((team.team_metadata ->> 'is_owned')::boolean, false)
    order by team.created_at limit 1;
  end if;

  v_roster_config := case
    when pg_catalog.jsonb_typeof(v_settings -> 'rosterConfig') = 'object'
      and v_settings -> 'rosterConfig' <> '{}'::jsonb
    then '{"C":0,"LW":0,"RW":0,"D":0,"G":0,"bench":0,"utility":0}'::jsonb
      || (v_settings -> 'rosterConfig')
    else null
  end;
  v_active_context := pg_catalog.jsonb_build_object(
    'source_type', 'espn',
    'provider', 'espn',
    'connected_account_id', v_league.connected_account_id,
    'external_league_id', v_league.id,
    'external_team_id', v_team.id,
    'external_league_key', v_league.external_league_key,
    'external_team_key', v_team.external_team_key,
    'applied_settings_hash', p_settings_hash,
    'applied_at', pg_catalog.statement_timestamp()
  );

  insert into public.user_settings (
    user_id, league_type, scoring_categories, goalie_scoring_categories,
    category_weights, roster_config, team_count, draft_order_type, active_context
  ) values (
    p_user_id,
    case when v_settings ->> 'leagueType' = 'categories'
      then 'categories' else 'points' end,
    coalesce(v_settings -> 'skaterScoringCategories', '{}'::jsonb),
    coalesce(v_settings -> 'goalieScoringCategories', '{}'::jsonb),
    coalesce(v_settings -> 'categoryWeights', '{}'::jsonb),
    coalesce(v_roster_config,
      '{"C":2,"LW":2,"RW":2,"D":4,"G":2,"bench":4,"utility":1}'::jsonb),
    case when (v_settings ->> 'teamCount') ~ '^[0-9]+$'
      then (v_settings ->> 'teamCount')::integer else 12 end,
    case when v_settings ->> 'draftOrderType' = 'straight'
      then 'straight' else 'snake' end,
    v_active_context
  )
  on conflict (user_id) do update set
    league_type = excluded.league_type,
    scoring_categories = case when excluded.league_type = 'points'
      then excluded.scoring_categories else public.user_settings.scoring_categories end,
    goalie_scoring_categories = case when excluded.league_type = 'points'
      then excluded.goalie_scoring_categories else public.user_settings.goalie_scoring_categories end,
    category_weights = case when excluded.league_type = 'categories'
      then excluded.category_weights else public.user_settings.category_weights end,
    roster_config = coalesce(v_roster_config, public.user_settings.roster_config),
    team_count = excluded.team_count,
    draft_order_type = excluded.draft_order_type,
    active_context = excluded.active_context,
    updated_at = pg_catalog.statement_timestamp()
  returning * into v_row;

  insert into public.user_provider_preferences (
    user_id, provider, connected_account_id, default_external_league_id,
    default_external_team_id, refresh_on_login, active_context
  ) values (
    p_user_id, 'espn', v_league.connected_account_id, v_league.id, v_team.id,
    false, v_active_context
  )
  on conflict (user_id, provider) do update set
    connected_account_id = excluded.connected_account_id,
    default_external_league_id = excluded.default_external_league_id,
    default_external_team_id = excluded.default_external_team_id,
    refresh_on_login = false,
    active_context = excluded.active_context,
    updated_at = pg_catalog.statement_timestamp();

  return pg_catalog.to_jsonb(v_row);
end;
$function$;

create function public.disconnect_espn_account_secure(
  p_user_id uuid,
  p_connected_account_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_deleted integer := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('espn-disconnect:' || p_user_id::text, 0)
  );
  if exists (
    select 1 from public.user_settings as settings
    where settings.user_id = p_user_id
      and settings.active_context ->> 'provider' = 'espn'
      and settings.active_context ->> 'connected_account_id' = p_connected_account_id::text
  ) then
    update public.user_settings
    set active_context = pg_catalog.jsonb_build_object(
          'source_type', 'manual', 'provider', null,
          'connected_account_id', null, 'external_league_id', null,
          'external_team_id', null, 'external_league_key', null,
          'external_team_key', null, 'applied_settings_hash', null,
          'applied_at', null
        ),
        updated_at = pg_catalog.statement_timestamp()
    where user_id = p_user_id;
  end if;
  delete from public.connected_accounts
  where id = p_connected_account_id
    and user_id = p_user_id
    and provider = 'espn';
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$function$;

create function public.delete_espn_league_secure(
  p_user_id uuid,
  p_connected_account_id uuid,
  p_external_league_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_deleted integer := 0;
begin
  update public.user_provider_preferences
  set default_external_league_id = case
        when default_external_league_id = p_external_league_id then null
        else default_external_league_id end,
      default_external_team_id = case
        when default_external_league_id = p_external_league_id then null
        else default_external_team_id end,
      active_context = case
        when active_context ->> 'external_league_id' = p_external_league_id::text
          then '{}'::jsonb else active_context end,
      updated_at = pg_catalog.statement_timestamp()
  where user_id = p_user_id and provider = 'espn'
    and (
      default_external_league_id = p_external_league_id
      or active_context ->> 'external_league_id' = p_external_league_id::text
    );
  if exists (
    select 1 from public.user_settings as settings
    where settings.user_id = p_user_id
      and settings.active_context ->> 'external_league_id' = p_external_league_id::text
  ) then
    update public.user_settings
    set active_context = pg_catalog.jsonb_build_object(
          'source_type', 'manual', 'provider', null,
          'connected_account_id', null, 'external_league_id', null,
          'external_team_id', null, 'external_league_key', null,
          'external_team_key', null, 'applied_settings_hash', null,
          'applied_at', null
        ),
        updated_at = pg_catalog.statement_timestamp()
    where user_id = p_user_id;
  end if;
  delete from public.external_leagues
  where id = p_external_league_id
    and connected_account_id = p_connected_account_id
    and user_id = p_user_id
    and provider = 'espn';
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$function$;

create function public.claim_espn_draft_poll(
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
  v_session public.espn_draft_sessions%rowtype;
  v_retry_at timestamptz;
begin
  if p_session_id is null or p_user_id is null or p_claimed_at is null
     or p_lease_seconds < 5 or p_lease_seconds > 120
  then raise exception using message = 'ESPN_DRAFT_POLL_CLAIM_INVALID'; end if;
  update public.espn_draft_sessions as session
  set poll_lease_token = pg_catalog.gen_random_uuid(),
      poll_lease_expires_at = p_claimed_at
        + pg_catalog.make_interval(secs => p_lease_seconds)
  where session.id = p_session_id
    and session.user_id = p_user_id
    and session.status in ('predraft', 'active')
    and session.next_poll_at <= p_claimed_at
    and (session.poll_lease_token is null
      or session.poll_lease_expires_at <= p_claimed_at)
  returning session.* into v_session;
  if found then
    return pg_catalog.jsonb_build_object(
      'claimed', true, 'sessionId', v_session.id,
      'leaseToken', v_session.poll_lease_token,
      'retryAt', v_session.poll_lease_expires_at
    );
  end if;
  select session.* into v_session
  from public.espn_draft_sessions as session
  where session.id = p_session_id and session.user_id = p_user_id;
  if not found then raise exception using message = 'ESPN_DRAFT_SESSION_NOT_FOUND'; end if;
  v_retry_at := greatest(v_session.next_poll_at, v_session.poll_lease_expires_at);
  return pg_catalog.jsonb_build_object(
    'claimed', false, 'sessionId', v_session.id,
    'leaseToken', null, 'retryAt', v_retry_at
  );
end;
$function$;

create function public.claim_espn_sync_lease(
  p_user_id uuid,
  p_connected_account_id uuid,
  p_external_league_id uuid,
  p_trigger_source text,
  p_dedupe_key text,
  p_lease_seconds integer default 240,
  p_claimed_at timestamptz default pg_catalog.clock_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_run public.provider_sync_runs%rowtype;
begin
  if p_user_id is null or p_connected_account_id is null
     or p_external_league_id is null or p_claimed_at is null
     or nullif(pg_catalog.btrim(p_trigger_source), '') is null
     or nullif(pg_catalog.btrim(p_dedupe_key), '') is null
     or p_lease_seconds < 30 or p_lease_seconds > 600
  then raise exception using message = 'ESPN_SYNC_LEASE_INVALID'; end if;

  if not exists (
    select 1 from public.external_leagues as league
    where league.id = p_external_league_id
      and league.connected_account_id = p_connected_account_id
      and league.user_id = p_user_id
      and league.provider = 'espn'
  ) then raise exception using message = 'ESPN_LEAGUE_NOT_FOUND'; end if;

  update public.provider_sync_runs as run
  set status = 'failed',
      finished_at = p_claimed_at,
      error_details = pg_catalog.jsonb_build_object('code', 'ESPN_SYNC_LEASE_EXPIRED'),
      updated_at = p_claimed_at
  where run.external_league_id = p_external_league_id
    and run.provider = 'espn'
    and run.status in ('queued', 'running')
    and coalesce(run.started_at, run.created_at)
      <= p_claimed_at - pg_catalog.make_interval(secs => p_lease_seconds);

  begin
    insert into public.provider_sync_runs (
      user_id, provider, connected_account_id, external_league_id,
      trigger_source, status, dedupe_key, started_at
    ) values (
      p_user_id, 'espn', p_connected_account_id, p_external_league_id,
      pg_catalog.btrim(p_trigger_source), 'running',
      pg_catalog.btrim(p_dedupe_key), p_claimed_at
    ) returning * into v_run;
  exception when unique_violation then
    return pg_catalog.jsonb_build_object(
      'claimed', false, 'runId', null,
      'retryAt', p_claimed_at + pg_catalog.make_interval(secs => p_lease_seconds)
    );
  end;

  return pg_catalog.jsonb_build_object(
    'claimed', true, 'runId', v_run.id,
    'retryAt', p_claimed_at + pg_catalog.make_interval(secs => p_lease_seconds)
  );
end;
$function$;

create function public.apply_espn_draft_snapshot(
  p_session_id uuid,
  p_user_id uuid,
  p_lease_token uuid,
  p_snapshot_hash text,
  p_status text,
  p_provider_status text,
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
  v_session public.espn_draft_sessions%rowtype;
  v_changed boolean;
  v_version bigint;
  v_pick_count integer;
begin
  if p_session_id is null or p_user_id is null or p_lease_token is null
     or p_snapshot_hash !~ '^[a-f0-9]{64}$'
     or p_status not in ('predraft','active','stopped','complete','error','reauth_required')
     or p_provider_status not in ('predraft','drafting','postdraft','unknown')
     or pg_catalog.jsonb_typeof(p_picks) <> 'array'
     or p_next_poll_at is null or p_observed_at is null
  then raise exception using message = 'ESPN_DRAFT_SNAPSHOT_INVALID'; end if;

  select session.* into v_session
  from public.espn_draft_sessions as session
  where session.id = p_session_id and session.user_id = p_user_id
  for update;
  if not found then raise exception using message = 'ESPN_DRAFT_SESSION_NOT_FOUND'; end if;
  if v_session.poll_lease_token is distinct from p_lease_token
     or v_session.poll_lease_expires_at <= p_observed_at
  then raise exception using message = 'ESPN_DRAFT_POLL_LEASE_LOST'; end if;

  v_changed := v_session.snapshot_hash is distinct from p_snapshot_hash;
  v_version := v_session.snapshot_version + case when v_changed then 1 else 0 end;
  if v_changed then
    insert into public.espn_draft_picks (
      session_id, user_id, external_pick_key, pick_number, round_number,
      pick_in_round, espn_team_id, external_team_id, espn_player_id,
      fhfh_player_id, mapping_status, player_name, position, pro_team_id,
      is_keeper, bid_amount, is_active, is_correction, revision,
      first_observed_at, last_observed_at
    )
    select
      p_session_id, p_user_id, pick.external_pick_key, pick.pick_number,
      pick.round_number, pick.pick_in_round, pick.espn_team_id,
      pick.external_team_id, pick.espn_player_id, pick.fhfh_player_id,
      pick.mapping_status, nullif(pg_catalog.btrim(pick.player_name), ''),
      nullif(pg_catalog.btrim(pick.position), ''), pick.pro_team_id,
      coalesce(pick.is_keeper, false), pick.bid_amount, true,
      coalesce(pick.is_correction, false), 1, p_observed_at, p_observed_at
    from pg_catalog.jsonb_to_recordset(p_picks) as pick(
      external_pick_key text, pick_number integer, round_number integer,
      pick_in_round integer, espn_team_id text, external_team_id uuid,
      espn_player_id text, fhfh_player_id bigint, mapping_status text,
      player_name text, position text, pro_team_id integer,
      is_keeper boolean, bid_amount numeric, is_correction boolean
    )
    on conflict (session_id, pick_number) do update
    set external_pick_key = excluded.external_pick_key,
        round_number = excluded.round_number,
        pick_in_round = excluded.pick_in_round,
        espn_team_id = excluded.espn_team_id,
        external_team_id = excluded.external_team_id,
        espn_player_id = excluded.espn_player_id,
        fhfh_player_id = excluded.fhfh_player_id,
        mapping_status = excluded.mapping_status,
        player_name = excluded.player_name,
        position = excluded.position,
        pro_team_id = excluded.pro_team_id,
        is_keeper = excluded.is_keeper,
        bid_amount = excluded.bid_amount,
        is_active = true,
        is_correction = public.espn_draft_picks.is_correction
          or excluded.is_correction
          or public.espn_draft_picks.espn_player_id is distinct from excluded.espn_player_id,
        revision = public.espn_draft_picks.revision + 1,
        last_observed_at = excluded.last_observed_at;

    update public.espn_draft_picks as existing
    set is_active = false,
        is_correction = true,
        revision = existing.revision + 1,
        last_observed_at = p_observed_at
    where existing.session_id = p_session_id
      and existing.user_id = p_user_id
      and existing.is_active
      and not exists (
        select 1 from pg_catalog.jsonb_to_recordset(p_picks)
          as current_pick(pick_number integer)
        where current_pick.pick_number = existing.pick_number
      );
  end if;

  select pg_catalog.count(*)::integer into v_pick_count
  from public.espn_draft_picks as pick
  where pick.session_id = p_session_id and pick.user_id = p_user_id
    and pick.is_active;

  update public.espn_draft_sessions
  set status = p_status,
      provider_status = p_provider_status,
      snapshot_hash = p_snapshot_hash,
      snapshot_version = v_version,
      last_pick_number = coalesce((
        select pg_catalog.max(pick.pick_number)
        from public.espn_draft_picks as pick
        where pick.session_id = p_session_id and pick.is_active
      ), 0),
      last_snapshot_at = p_observed_at,
      poll_lease_token = null,
      poll_lease_expires_at = null,
      next_poll_at = p_next_poll_at,
      last_polled_at = p_observed_at,
      consecutive_failures = 0,
      last_error_code = null,
      last_error_message = null,
      completed_at = case when p_status = 'complete'
        then coalesce(completed_at, p_observed_at) else null end
  where id = p_session_id and user_id = p_user_id;

  return pg_catalog.jsonb_build_object(
    'sessionId', p_session_id, 'changed', v_changed,
    'snapshotVersion', v_version, 'activePickCount', v_pick_count,
    'status', p_status, 'providerStatus', p_provider_status,
    'nextPollAt', p_next_poll_at
  );
end;
$function$;

create function public.record_espn_draft_poll_failure(
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
  v_session public.espn_draft_sessions%rowtype;
  v_status text;
begin
  select session.* into v_session
  from public.espn_draft_sessions as session
  where session.id = p_session_id and session.user_id = p_user_id
  for update;
  if not found then raise exception using message = 'ESPN_DRAFT_SESSION_NOT_FOUND'; end if;
  if v_session.poll_lease_token is distinct from p_lease_token
  then raise exception using message = 'ESPN_DRAFT_POLL_LEASE_LOST'; end if;
  v_status := coalesce(p_status, v_session.status);
  update public.espn_draft_sessions
  set status = v_status,
      poll_lease_token = null,
      poll_lease_expires_at = null,
      next_poll_at = p_retry_at,
      last_polled_at = p_failed_at,
      consecutive_failures = consecutive_failures + 1,
      last_error_code = pg_catalog.left(pg_catalog.btrim(p_error_code), 128),
      last_error_message = pg_catalog.left(
        nullif(pg_catalog.btrim(p_error_message), ''), 2000
      ),
      completed_at = case when v_status = 'complete'
        then coalesce(completed_at, p_failed_at) else null end
  where id = p_session_id and user_id = p_user_id;
  return pg_catalog.jsonb_build_object(
    'sessionId', p_session_id, 'status', v_status, 'retryAt', p_retry_at
  );
end;
$function$;

revoke all on function public.commit_espn_connection_secure(
  uuid, uuid, text, text, text, text, text, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function public.apply_espn_settings_secure(
  uuid, uuid, uuid, text, boolean
) from public, anon, authenticated;
revoke all on function public.disconnect_espn_account_secure(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.delete_espn_league_secure(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.claim_espn_draft_poll(
  uuid, uuid, integer, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.claim_espn_sync_lease(
  uuid, uuid, uuid, text, text, integer, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.apply_espn_draft_snapshot(
  uuid, uuid, uuid, text, text, text, jsonb, timestamptz, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.record_espn_draft_poll_failure(
  uuid, uuid, uuid, text, text, timestamptz, text, timestamptz
) from public, anon, authenticated, service_role;

grant execute on function public.commit_espn_connection_secure(
  uuid, uuid, text, text, text, text, text, jsonb, jsonb
) to service_role;
grant execute on function public.apply_espn_settings_secure(
  uuid, uuid, uuid, text, boolean
) to service_role;
grant execute on function public.disconnect_espn_account_secure(uuid, uuid)
  to service_role;
grant execute on function public.delete_espn_league_secure(uuid, uuid, uuid)
  to service_role;
grant execute on function public.claim_espn_draft_poll(
  uuid, uuid, integer, timestamptz
) to service_role;
grant execute on function public.claim_espn_sync_lease(
  uuid, uuid, uuid, text, text, integer, timestamptz
) to service_role;
grant execute on function public.apply_espn_draft_snapshot(
  uuid, uuid, uuid, text, text, text, jsonb, timestamptz, timestamptz
) to service_role;
grant execute on function public.record_espn_draft_poll_failure(
  uuid, uuid, uuid, text, text, timestamptz, text, timestamptz
) to service_role;
