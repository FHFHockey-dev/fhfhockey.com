alter table public.user_settings
  add column if not exists goalie_scoring_categories jsonb not null
    default '{"GOALS_AGAINST_GOALIE": -1, "SAVES_GOALIE": 0.2, "SHUTOUTS_GOALIE": 3, "WINS_GOALIE": 4}'::jsonb,
  add column if not exists team_count integer not null default 12,
  add column if not exists draft_order_type text not null default 'snake';

alter table public.user_settings
  drop constraint if exists user_settings_team_count_check,
  add constraint user_settings_team_count_check
    check (team_count between 2 and 40),
  drop constraint if exists user_settings_draft_order_type_check,
  add constraint user_settings_draft_order_type_check
    check (draft_order_type in ('snake', 'straight'));

-- Fantasy Projections previously persisted skater and goalie scoring in one JSON
-- object. Split goalie-only keys while copying shared workload keys to both maps.
update public.user_settings
set
  goalie_scoring_categories =
    '{"GOALS_AGAINST_GOALIE": -1, "SAVES_GOALIE": 0.2, "SHUTOUTS_GOALIE": 3, "WINS_GOALIE": 4}'::jsonb
    || jsonb_strip_nulls(
      jsonb_build_object(
        'GAMES_PLAYED', scoring_categories -> 'GAMES_PLAYED',
        'GAMES_STARTED', scoring_categories -> 'GAMES_STARTED',
        'TOTAL_TOI', scoring_categories -> 'TOTAL_TOI',
        'WINS_GOALIE', scoring_categories -> 'WINS_GOALIE',
        'LOSSES_GOALIE', scoring_categories -> 'LOSSES_GOALIE',
        'OTL_GOALIE', scoring_categories -> 'OTL_GOALIE',
        'SHOTS_AGAINST_GOALIE', scoring_categories -> 'SHOTS_AGAINST_GOALIE',
        'SAVES_GOALIE', scoring_categories -> 'SAVES_GOALIE',
        'GOALS_AGAINST_GOALIE', scoring_categories -> 'GOALS_AGAINST_GOALIE',
        'SHUTOUTS_GOALIE', scoring_categories -> 'SHUTOUTS_GOALIE',
        'SAVE_PERCENTAGE', scoring_categories -> 'SAVE_PERCENTAGE',
        'GOALS_AGAINST_AVERAGE', scoring_categories -> 'GOALS_AGAINST_AVERAGE'
      )
    ),
  scoring_categories = scoring_categories - array[
    'GAMES_STARTED',
    'WINS_GOALIE',
    'LOSSES_GOALIE',
    'OTL_GOALIE',
    'SHOTS_AGAINST_GOALIE',
    'SAVES_GOALIE',
    'GOALS_AGAINST_GOALIE',
    'SHUTOUTS_GOALIE',
    'SAVE_PERCENTAGE',
    'GOALS_AGAINST_AVERAGE'
  ]::text[]
where jsonb_typeof(scoring_categories) = 'object';

comment on column public.user_settings.goalie_scoring_categories is
  'Goalie fantasy point values stored separately from skater values.';
comment on column public.user_settings.team_count is
  'Default fantasy league team count used by draft tools.';
comment on column public.user_settings.draft_order_type is
  'Default draft traversal format; team order itself remains tool-local.';

create unique index if not exists idx_provider_sync_runs_fantrax_active_league
  on public.provider_sync_runs (external_league_id)
  where provider = 'fantrax'
    and external_league_id is not null
    and status in ('queued', 'running');

create or replace function public.commit_fantrax_connection_secure(
  p_user_id uuid,
  p_target_account_id uuid,
  p_account_label text,
  p_secret_id text,
  p_consent_version text,
  p_leagues jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.connected_accounts%rowtype;
  v_candidate public.connected_accounts%rowtype;
  v_existing_secret text;
  v_account_count integer;
  v_is_legacy_manual boolean := false;
  v_modes jsonb := '["api"]'::jsonb;
  v_league jsonb;
  v_team jsonb;
  v_league_id uuid;
  v_league_metadata jsonb;
  v_existing_league public.external_leagues%rowtype;
  v_existing_team public.external_teams%rowtype;
  v_manual_snapshot jsonb;
  v_team_metadata jsonb;
  v_team_manual_snapshot jsonb;
begin
  if p_user_id is null
    or nullif(btrim(p_account_label), '') is null
    or char_length(btrim(p_account_label)) > 80
    or nullif(btrim(p_secret_id), '') is null
    or char_length(p_secret_id) > 512
    or p_consent_version is distinct from 'fantrax-settings-v1'
    or p_leagues is null
    or jsonb_typeof(p_leagues) <> 'array'
  then
    raise exception using message = 'INVALID_FANTRAX_CONNECTION_PAYLOAD';
  end if;
  if jsonb_array_length(p_leagues) = 0 and p_target_account_id is null then
    raise exception using message = 'INVALID_FANTRAX_CONNECTION_PAYLOAD';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('fantrax-link:' || p_user_id::text, 0)
  );

  for v_candidate in
    select account.*
    from public.connected_accounts as account
    where account.user_id = p_user_id
      and account.provider = 'fantrax'
    order by account.created_at
  loop
    v_existing_secret := null;
    select token.access_token
    into v_existing_secret
    from public.get_connected_account_tokens_secure(v_candidate.id, p_user_id) as token
    where token.provider = 'fantrax'
    limit 1;

    if v_existing_secret = p_secret_id then
      if p_target_account_id is not null and p_target_account_id <> v_candidate.id then
        raise exception using message = 'FANTRAX_SECRET_ALREADY_LINKED';
      end if;
      v_account := v_candidate;
      exit;
    end if;
  end loop;

  if v_account.id is null and p_target_account_id is not null then
    select account.*
    into v_account
    from public.connected_accounts as account
    where account.id = p_target_account_id
      and account.user_id = p_user_id
      and account.provider = 'fantrax';

    if v_account.id is null then
      raise exception using message = 'FANTRAX_ACCOUNT_NOT_FOUND';
    end if;
  end if;

  if v_account.id is null then
    select count(*)::integer
    into v_account_count
    from public.connected_accounts as account
    where account.user_id = p_user_id
      and account.provider = 'fantrax';

    if v_account_count = 1 then
      select account.*
      into v_candidate
      from public.connected_accounts as account
      where account.user_id = p_user_id
        and account.provider = 'fantrax'
      limit 1;

      if coalesce((v_candidate.metadata ->> 'api_linked')::boolean, false) = false
        and (
          v_candidate.metadata ->> 'integration_mode' = 'manual_import'
          or coalesce(v_candidate.metadata -> 'integration_modes', '[]'::jsonb)
            ? 'manual_import'
        )
      then
        v_account := v_candidate;
        v_is_legacy_manual := true;
      end if;
    end if;
  end if;

  if v_account.id is null then
    insert into public.connected_accounts (
      user_id,
      provider,
      provider_user_id,
      account_label,
      status,
      scopes,
      metadata
    ) values (
      p_user_id,
      'fantrax',
      null,
      btrim(p_account_label),
      'syncing',
      '["league_identity", "team_identity", "league_settings", "continuous_sync"]'::jsonb,
      '{}'::jsonb
    )
    returning * into v_account;
  end if;

  if v_is_legacy_manual
    or v_account.metadata ->> 'integration_mode' = 'manual_import'
    or coalesce(v_account.metadata -> 'integration_modes', '[]'::jsonb) ? 'manual_import'
  then
    v_modes := '["manual_import", "api"]'::jsonb;
    update public.external_leagues as league
    set league_metadata = jsonb_set(
      league.league_metadata || jsonb_build_object(
        'manual_snapshot', coalesce(
          league.league_metadata -> 'manual_snapshot',
          jsonb_build_object(
            'league_name', league.league_name,
            'season_key', league.season_key,
            'scoring_settings', league.scoring_settings,
            'roster_settings', league.roster_settings
          )
        )
      ),
      '{source_modes}',
      '["manual_import"]'::jsonb,
      true
    )
    where league.connected_account_id = v_account.id
      and league.user_id = p_user_id;
  end if;

  update public.connected_accounts as account
  set
    provider_user_id = null,
    account_label = btrim(p_account_label),
    status = 'syncing',
    scopes = '["league_identity", "team_identity", "league_settings", "continuous_sync"]'::jsonb,
    metadata = account.metadata || jsonb_build_object(
      'api_linked', true,
      'credentials_stored', true,
      'consent_version', p_consent_version,
      'consented_at', statement_timestamp(),
      'sync_interval_hours', 24,
      'integration_modes', v_modes
    ),
    updated_at = statement_timestamp()
  where account.id = v_account.id
    and account.user_id = p_user_id
  returning * into v_account;

  perform public.upsert_connected_account_tokens_secure(
    v_account.id,
    p_user_id,
    'fantrax',
    p_secret_id,
    null,
    'fantrax_user_secret_id',
    '["league_identity", "team_identity", "league_settings", "continuous_sync"]'::jsonb,
    null,
    null,
    null,
    statement_timestamp(),
    jsonb_build_object(
      'provider', 'fantrax',
      'credential_type', 'user_secret_id',
      'consent_version', p_consent_version
    )
  );

  for v_league in
    select item.value
    from jsonb_array_elements(p_leagues) as item(value)
  loop
    if nullif(v_league ->> 'externalLeagueKey', '') is null then
      raise exception using message = 'INVALID_FANTRAX_LEAGUE_PAYLOAD';
    end if;

    select league.*
    into v_existing_league
    from public.external_leagues as league
    where league.connected_account_id = v_account.id
      and league.external_league_key = v_league ->> 'externalLeagueKey';

    v_league_metadata := coalesce(v_league -> 'leagueMetadata', '{}'::jsonb);
    if v_existing_league.id is not null
      and coalesce(v_existing_league.league_metadata -> 'source_modes', '[]'::jsonb) ? 'manual_import'
    then
      v_manual_snapshot := coalesce(
        v_existing_league.league_metadata -> 'manual_snapshot',
        jsonb_build_object(
          'league_name', v_existing_league.league_name,
          'season_key', v_existing_league.season_key,
          'scoring_settings', v_existing_league.scoring_settings,
          'roster_settings', v_existing_league.roster_settings
        )
      );
      v_league_metadata := v_league_metadata || jsonb_build_object(
        'source_modes', '["manual_import", "api"]'::jsonb,
        'manual_snapshot', v_manual_snapshot
      );
    end if;

    insert into public.external_leagues (
      connected_account_id,
      user_id,
      provider,
      external_league_key,
      league_name,
      season_key,
      league_metadata,
      scoring_settings,
      roster_settings,
      imported_at,
      updated_at
    ) values (
      v_account.id,
      p_user_id,
      'fantrax',
      v_league ->> 'externalLeagueKey',
      nullif(v_league ->> 'leagueName', ''),
      nullif(v_league ->> 'seasonKey', ''),
      v_league_metadata,
      coalesce(v_league -> 'scoringSettings', '{}'::jsonb),
      coalesce(v_league -> 'rosterSettings', '{}'::jsonb),
      statement_timestamp(),
      statement_timestamp()
    )
    on conflict (connected_account_id, external_league_key)
    do update set
      league_name = excluded.league_name,
      season_key = excluded.season_key,
      league_metadata = public.external_leagues.league_metadata || excluded.league_metadata,
      scoring_settings = excluded.scoring_settings,
      roster_settings = excluded.roster_settings,
      imported_at = excluded.imported_at,
      updated_at = excluded.updated_at
    returning id into v_league_id;

    for v_team in
      select item.value
      from jsonb_array_elements(coalesce(v_league -> 'teams', '[]'::jsonb)) as item(value)
    loop
      if nullif(v_team ->> 'externalTeamKey', '') is null then
        continue;
      end if;

      select team.*
      into v_existing_team
      from public.external_teams as team
      where team.external_league_id = v_league_id
        and team.external_team_key = v_team ->> 'externalTeamKey';

      v_team_metadata := coalesce(v_team -> 'teamMetadata', '{}'::jsonb);
      if v_existing_team.id is not null
        and (
          coalesce(v_existing_team.team_metadata -> 'source_modes', '[]'::jsonb)
            ? 'manual_import'
          or v_existing_team.team_metadata ? 'manual_snapshot'
        )
      then
        v_team_manual_snapshot := coalesce(
          v_existing_team.team_metadata -> 'manual_snapshot',
          jsonb_build_object(
            'team_name', v_existing_team.team_name,
            'team_metadata', v_existing_team.team_metadata,
            'roster_snapshot', v_existing_team.roster_snapshot
          )
        );
        v_team_metadata := v_existing_team.team_metadata
          || v_team_metadata
          || jsonb_build_object(
            'source_mode', 'api',
            'source_modes', '["manual_import", "api"]'::jsonb,
            'manual_snapshot', v_team_manual_snapshot
          );
      else
        v_team_metadata := coalesce(v_existing_team.team_metadata, '{}'::jsonb)
          || v_team_metadata
          || jsonb_build_object(
            'source_mode', 'api',
            'source_modes', '["api"]'::jsonb
          );
      end if;

      insert into public.external_teams (
        external_league_id,
        connected_account_id,
        user_id,
        provider,
        external_team_key,
        team_name,
        team_metadata,
        roster_snapshot,
        imported_at,
        updated_at
      ) values (
        v_league_id,
        v_account.id,
        p_user_id,
        'fantrax',
        v_team ->> 'externalTeamKey',
        nullif(v_team ->> 'teamName', ''),
        v_team_metadata,
        '{}'::jsonb,
        statement_timestamp(),
        statement_timestamp()
      )
      on conflict (external_league_id, external_team_key)
      do update set
        team_name = excluded.team_name,
        team_metadata = excluded.team_metadata,
        imported_at = excluded.imported_at,
        updated_at = excluded.updated_at;
    end loop;

    for v_existing_team in
      select team.*
      from public.external_teams as team
      where team.external_league_id = v_league_id
        and team.user_id = p_user_id
        and (
          team.team_metadata ->> 'source_mode' = 'api'
          or coalesce(team.team_metadata -> 'source_modes', '[]'::jsonb) ? 'api'
        )
        and not exists (
          select 1
          from jsonb_array_elements(coalesce(v_league -> 'teams', '[]'::jsonb)) as selected(value)
          where selected.value ->> 'externalTeamKey' = team.external_team_key
        )
    loop
      if coalesce(v_existing_team.team_metadata -> 'source_modes', '[]'::jsonb)
        ? 'manual_import'
        or v_existing_team.team_metadata ? 'manual_snapshot'
      then
        v_team_manual_snapshot := coalesce(
          v_existing_team.team_metadata -> 'manual_snapshot',
          '{}'::jsonb
        );
        update public.external_teams as team
        set
          team_name = coalesce(
            v_team_manual_snapshot ->> 'team_name',
            team.team_name
          ),
          roster_snapshot = coalesce(
            v_team_manual_snapshot -> 'roster_snapshot',
            team.roster_snapshot
          ),
          team_metadata = coalesce(
            v_team_manual_snapshot -> 'team_metadata',
            '{}'::jsonb
          ) || jsonb_build_object('source_modes', '["manual_import"]'::jsonb),
          updated_at = statement_timestamp()
        where team.id = v_existing_team.id;
      else
        update public.user_provider_preferences as preference
        set default_external_team_id = null,
            active_context = jsonb_set(
              jsonb_set(preference.active_context, '{external_team_id}', 'null'::jsonb, true),
              '{external_team_key}',
              'null'::jsonb,
              true
            ),
            updated_at = statement_timestamp()
        where preference.user_id = p_user_id
          and preference.provider = 'fantrax'
          and preference.default_external_team_id = v_existing_team.id;

        update public.user_settings as settings
        set active_context = jsonb_set(
              jsonb_set(settings.active_context, '{external_team_id}', 'null'::jsonb, true),
              '{external_team_key}',
              'null'::jsonb,
              true
            ),
            updated_at = statement_timestamp()
        where settings.user_id = p_user_id
          and settings.active_context ->> 'external_team_id' = v_existing_team.id::text;

        delete from public.external_teams
        where id = v_existing_team.id
          and user_id = p_user_id;
      end if;
    end loop;
  end loop;

  for v_existing_league in
    select league.*
    from public.external_leagues as league
    where league.connected_account_id = v_account.id
      and league.user_id = p_user_id
      and coalesce((league.league_metadata ->> 'api_sync_enabled')::boolean, false)
      and not exists (
        select 1
        from jsonb_array_elements(p_leagues) as selected(value)
        where selected.value ->> 'externalLeagueKey' = league.external_league_key
      )
  loop
    update public.user_settings as settings
    set active_context = jsonb_build_object(
          'source_type', 'manual',
          'provider', null,
          'connected_account_id', null,
          'external_league_id', null,
          'external_team_id', null,
          'external_league_key', null,
          'external_team_key', null,
          'applied_settings_hash', null,
          'applied_at', null
        ),
        updated_at = statement_timestamp()
    where settings.user_id = p_user_id
      and settings.active_context ->> 'external_league_id' = v_existing_league.id::text;

    update public.user_provider_preferences as preference
    set connected_account_id = null,
        default_external_league_id = null,
        default_external_team_id = null,
        active_context = '{}'::jsonb,
        updated_at = statement_timestamp()
    where preference.user_id = p_user_id
      and preference.provider = 'fantrax'
      and preference.default_external_league_id = v_existing_league.id;

    if coalesce(v_existing_league.league_metadata -> 'source_modes', '[]'::jsonb) ? 'manual_import' then
      v_manual_snapshot := coalesce(v_existing_league.league_metadata -> 'manual_snapshot', '{}'::jsonb);
      update public.external_leagues as league
      set
        league_name = coalesce(v_manual_snapshot ->> 'league_name', league.league_name),
        season_key = coalesce(v_manual_snapshot ->> 'season_key', league.season_key),
        scoring_settings = coalesce(v_manual_snapshot -> 'scoring_settings', league.scoring_settings),
        roster_settings = coalesce(v_manual_snapshot -> 'roster_settings', league.roster_settings),
        league_metadata = (league.league_metadata
          - 'normalized_settings'
          - 'raw_settings'
          - 'source_hash'
          - 'mapping_version'
          - 'manual_snapshot') || jsonb_build_object(
            'api_sync_enabled', false,
            'source_modes', '["manual_import"]'::jsonb
          ),
        updated_at = statement_timestamp()
      where league.id = v_existing_league.id;

      delete from public.external_teams as team
      where team.external_league_id = v_existing_league.id
        and team.user_id = p_user_id
        and not (
          coalesce(team.team_metadata -> 'source_modes', '[]'::jsonb)
          ? 'manual_import'
        );

      update public.external_teams as team
      set
        team_name = coalesce(
          team.team_metadata #>> '{manual_snapshot,team_name}',
          team.team_name
        ),
        roster_snapshot = coalesce(
          team.team_metadata #> '{manual_snapshot,roster_snapshot}',
          team.roster_snapshot
        ),
        team_metadata = coalesce(
          team.team_metadata #> '{manual_snapshot,team_metadata}',
          '{}'::jsonb
        ) || jsonb_build_object('source_modes', '["manual_import"]'::jsonb),
        updated_at = statement_timestamp()
      where team.external_league_id = v_existing_league.id
        and team.user_id = p_user_id
        and coalesce(team.team_metadata -> 'source_modes', '[]'::jsonb)
          ? 'manual_import';
    else
      delete from public.provider_sync_runs
      where external_league_id = v_existing_league.id
        and user_id = p_user_id;
      delete from public.external_leagues
      where id = v_existing_league.id
        and user_id = p_user_id;
    end if;
  end loop;

  update public.connected_accounts
  set status = 'connected',
      last_synced_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where id = v_account.id
    and user_id = p_user_id;

  return v_account.id;
end;
$$;

create or replace function public.apply_fantrax_settings_secure(
  p_user_id uuid,
  p_external_league_id uuid,
  p_external_team_id uuid,
  p_settings_hash text,
  p_acknowledge_warnings boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_league public.external_leagues%rowtype;
  v_team public.external_teams%rowtype;
  v_settings jsonb;
  v_status text;
  v_league_type text;
  v_team_count integer;
  v_draft_order_type text;
  v_roster_config jsonb;
  v_active_context jsonb;
  v_row public.user_settings%rowtype;
begin
  if p_user_id is null
    or p_external_league_id is null
    or nullif(btrim(p_settings_hash), '') is null
  then
    raise exception using message = 'FANTRAX_SETTINGS_UNSUPPORTED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('fantrax-apply:' || p_user_id::text, 0)
  );

  select league.*
  into v_league
  from public.external_leagues as league
  where league.id = p_external_league_id
    and league.user_id = p_user_id
    and league.provider = 'fantrax';

  if v_league.id is null then
    raise exception using message = 'FANTRAX_LEAGUE_NOT_FOUND';
  end if;

  v_settings := v_league.league_metadata -> 'normalized_settings';
  if jsonb_typeof(v_settings) <> 'object' then
    raise exception using message = 'FANTRAX_SETTINGS_UNSUPPORTED';
  end if;
  if coalesce(v_settings ->> 'sourceHash', '') <> p_settings_hash then
    raise exception using message = 'FANTRAX_SETTINGS_STALE';
  end if;

  v_status := v_settings #>> '{diagnostics,status}';
  if v_status = 'unsupported' or v_status is null then
    raise exception using message = 'FANTRAX_SETTINGS_UNSUPPORTED';
  end if;
  if v_status = 'partial' and not coalesce(p_acknowledge_warnings, false) then
    raise exception using message = 'FANTRAX_WARNINGS_UNACKNOWLEDGED';
  end if;

  if p_external_team_id is not null then
    select team.*
    into v_team
    from public.external_teams as team
    where team.id = p_external_team_id
      and team.external_league_id = v_league.id
      and team.user_id = p_user_id
      and team.provider = 'fantrax';
    if v_team.id is null then
      raise exception using message = 'FANTRAX_TEAM_NOT_FOUND';
    end if;
  else
    select team.*
    into v_team
    from public.external_teams as team
    where team.external_league_id = v_league.id
      and team.user_id = p_user_id
      and team.provider = 'fantrax'
      and coalesce((team.team_metadata ->> 'is_owned')::boolean, false)
    order by team.created_at
    limit 1;
  end if;

  v_league_type := case
    when v_settings ->> 'leagueType' = 'categories' then 'categories'
    else 'points'
  end;
  v_team_count := case
    when (v_settings ->> 'teamCount') ~ '^[0-9]+$'
      and (v_settings ->> 'teamCount')::integer between 2 and 40
    then (v_settings ->> 'teamCount')::integer
    else null
  end;
  v_draft_order_type := case
    when v_settings ->> 'draftOrderType' in ('snake', 'straight')
    then v_settings ->> 'draftOrderType'
    else null
  end;
  v_roster_config := case
    when jsonb_typeof(v_settings -> 'rosterConfig') = 'object'
      and v_settings -> 'rosterConfig' <> '{}'::jsonb
    then '{"C":0,"LW":0,"RW":0,"D":0,"G":0,"bench":0,"utility":0}'::jsonb
      || (v_settings -> 'rosterConfig')
    else null
  end;
  v_active_context := jsonb_build_object(
    'source_type', 'fantrax',
    'provider', 'fantrax',
    'connected_account_id', v_league.connected_account_id,
    'external_league_id', v_league.id,
    'external_team_id', v_team.id,
    'external_league_key', v_league.external_league_key,
    'external_team_key', v_team.external_team_key,
    'applied_settings_hash', p_settings_hash,
    'applied_at', statement_timestamp()
  );

  insert into public.user_settings (
    user_id,
    league_type,
    scoring_categories,
    goalie_scoring_categories,
    category_weights,
    roster_config,
    team_count,
    draft_order_type,
    active_context
  ) values (
    p_user_id,
    v_league_type,
    case when v_league_type = 'points'
      then coalesce(v_settings -> 'skaterScoringCategories', '{}'::jsonb)
      else '{"GOALS":3,"ASSISTS":2,"PP_POINTS":1,"SHOTS_ON_GOAL":0.2,"HITS":0.2,"BLOCKED_SHOTS":0.25}'::jsonb
    end,
    case when v_league_type = 'points'
      then coalesce(v_settings -> 'goalieScoringCategories', '{}'::jsonb)
      else '{"GOALS_AGAINST_GOALIE":-1,"SAVES_GOALIE":0.2,"SHUTOUTS_GOALIE":3,"WINS_GOALIE":4}'::jsonb
    end,
    case when v_league_type = 'categories'
      then coalesce(v_settings -> 'categoryWeights', '{}'::jsonb)
      else '{"GOALS":1,"ASSISTS":1,"PP_POINTS":1,"SHOTS_ON_GOAL":1,"HITS":1,"BLOCKED_SHOTS":1,"WINS_GOALIE":1,"SAVES_GOALIE":1,"SAVE_PERCENTAGE":1}'::jsonb
    end,
    coalesce(
      v_roster_config,
      '{"C":2,"LW":2,"RW":2,"D":4,"G":2,"bench":4,"utility":1}'::jsonb
    ),
    coalesce(v_team_count, 12),
    coalesce(v_draft_order_type, 'snake'),
    v_active_context
  )
  on conflict (user_id)
  do update set
    league_type = excluded.league_type,
    scoring_categories = case when v_league_type = 'points'
      then excluded.scoring_categories
      else public.user_settings.scoring_categories
    end,
    goalie_scoring_categories = case when v_league_type = 'points'
      then excluded.goalie_scoring_categories
      else public.user_settings.goalie_scoring_categories
    end,
    category_weights = case when v_league_type = 'categories'
      then excluded.category_weights
      else public.user_settings.category_weights
    end,
    roster_config = coalesce(v_roster_config, public.user_settings.roster_config),
    team_count = coalesce(v_team_count, public.user_settings.team_count),
    draft_order_type = coalesce(v_draft_order_type, public.user_settings.draft_order_type),
    active_context = excluded.active_context,
    updated_at = statement_timestamp()
  returning * into v_row;

  insert into public.user_provider_preferences (
    user_id,
    provider,
    connected_account_id,
    default_external_league_id,
    default_external_team_id,
    active_context
  ) values (
    p_user_id,
    'fantrax',
    v_league.connected_account_id,
    v_league.id,
    v_team.id,
    v_active_context
  )
  on conflict (user_id, provider)
  do update set
    connected_account_id = excluded.connected_account_id,
    default_external_league_id = excluded.default_external_league_id,
    default_external_team_id = excluded.default_external_team_id,
    active_context = excluded.active_context,
    updated_at = statement_timestamp();

  return to_jsonb(v_row);
end;
$$;

create or replace function public.disconnect_fantrax_account_secure(
  p_user_id uuid,
  p_connected_account_id uuid
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_count integer := 0;
begin
  if p_user_id is null or p_connected_account_id is null then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('fantrax-disconnect:' || p_user_id::text, 0)
  );

  if exists (
    select 1
    from public.user_settings as settings
    where settings.user_id = p_user_id
      and settings.active_context ->> 'provider' = 'fantrax'
      and exists (
        select 1
        from public.external_leagues as league
        where league.id::text = settings.active_context ->> 'external_league_id'
          and league.connected_account_id = p_connected_account_id
          and league.user_id = p_user_id
      )
  ) then
    update public.user_settings
    set active_context = jsonb_build_object(
          'source_type', 'manual',
          'provider', null,
          'connected_account_id', null,
          'external_league_id', null,
          'external_team_id', null,
          'external_league_key', null,
          'external_team_key', null,
          'applied_settings_hash', null,
          'applied_at', null
        ),
        updated_at = statement_timestamp()
    where user_id = p_user_id;
  end if;

  delete from public.connected_accounts
  where id = p_connected_account_id
    and user_id = p_user_id
    and provider = 'fantrax';
  get diagnostics v_deleted_count = row_count;
  return v_deleted_count > 0;
end;
$$;

revoke all on function public.commit_fantrax_connection_secure(uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.commit_fantrax_connection_secure(uuid, uuid, text, text, text, jsonb) to service_role;

revoke all on function public.apply_fantrax_settings_secure(uuid, uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.apply_fantrax_settings_secure(uuid, uuid, uuid, text, boolean) to service_role;

revoke all on function public.disconnect_fantrax_account_secure(uuid, uuid) from public, anon, authenticated;
grant execute on function public.disconnect_fantrax_account_secure(uuid, uuid) to service_role;
