-- Resolve a season player-pool review without weakening the stable identity
-- boundary. Official NHL player details are fetched and validated by the
-- owner-only server route before this short transaction begins.

create or replace function public.resolve_player_forecast_season_identity(
  p_review_id uuid,
  p_editor_user_id uuid,
  p_resolution_action text,
  p_resolution_reason text,
  p_fhfh_player_id bigint default null,
  p_lifecycle_status text default null,
  p_official_player jsonb default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  pending_review public.player_forecast_season_player_pool_review%rowtype;
  existing_identity public.fhfh_player_identities%rowtype;
  resolution public.player_forecast_season_player_pool_review%rowtype;
  resolved_identity_id bigint;
  official_nhl_player_id bigint;
  official_first_name text;
  official_last_name text;
  official_full_name text;
  official_position text;
  official_birth_date date;
  official_birth_country text;
  official_height smallint;
  official_weight smallint;
  official_team_id smallint;
  official_team_name text;
  created_identity boolean := false;
  resolution_status text;
  resolution_key text;
  source_observed_at timestamptz;
begin
  if p_review_id is null
    or p_editor_user_id is null
    or p_resolution_action is null
    or p_resolution_action not in ('map_existing', 'create_new', 'exclude')
    or nullif(pg_catalog.btrim(p_resolution_reason), '') is null
  then
    raise exception using
      errcode = '22023',
      message = 'PLAYER_FORECAST_SEASON_IDENTITY_RESOLUTION_INVALID_ARGUMENT';
  end if;

  -- Auth has already validated the bearer token in the owner-only server
  -- middleware. API roles cannot read auth.users directly, so repeat only the
  -- application-level admin check here; foreign keys retain user integrity.
  if not exists (
    select 1
    from public.users editor_profile
    where editor_profile.user_id = p_editor_user_id
      and editor_profile.role = 'admin'
  ) then
    raise exception using
      errcode = '42501',
      message = 'PLAYER_FORECAST_SEASON_IDENTITY_EDITOR_NOT_AUTHORIZED';
  end if;

  -- Serialize competing resolutions without granting UPDATE on the immutable
  -- review ledger solely to support a row-locking query.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'player-forecast-season-identity:' || p_review_id::text,
      0
    )
  );

  select review.*
  into pending_review
  from public.player_forecast_season_player_pool_review review
  where review.id = p_review_id
    and review.resolution_status = 'pending'
    and not exists (
      select 1
      from public.player_forecast_season_player_pool_review superseding
      where superseding.supersedes_id = review.id
    );

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'PLAYER_FORECAST_SEASON_IDENTITY_REVIEW_NOT_PENDING';
  end if;

  if p_resolution_action = 'exclude' then
    resolution_status := 'excluded';
  else
    if pending_review.nhl_player_id is null
      or p_official_player is null
      or pg_catalog.jsonb_typeof(p_official_player) <> 'object'
      or coalesce(p_official_player ->> 'nhlPlayerId', '') !~ '^[0-9]+$'
      or coalesce(p_official_player ->> 'heightInCentimeters', '') !~ '^[0-9]+$'
      or coalesce(p_official_player ->> 'weightInKilograms', '') !~ '^[0-9]+$'
      or coalesce(p_official_player ->> 'currentTeamId', '') !~ '^[0-9]+$'
      or nullif(pg_catalog.btrim(p_official_player ->> 'firstName'), '') is null
      or nullif(pg_catalog.btrim(p_official_player ->> 'lastName'), '') is null
      or nullif(pg_catalog.btrim(p_official_player ->> 'birthDate'), '') is null
      or nullif(pg_catalog.btrim(p_official_player ->> 'birthCountry'), '') is null
      or nullif(pg_catalog.btrim(p_official_player ->> 'observedAt'), '') is null
      or p_official_player ->> 'position' not in ('C', 'L', 'R', 'D', 'G')
    then
      raise exception using
        errcode = '22023',
        message = 'PLAYER_FORECAST_SEASON_OFFICIAL_PLAYER_INVALID';
    end if;

    begin
      official_nhl_player_id := (p_official_player ->> 'nhlPlayerId')::bigint;
      official_first_name := pg_catalog.btrim(p_official_player ->> 'firstName');
      official_last_name := pg_catalog.btrim(p_official_player ->> 'lastName');
      official_full_name := official_first_name || ' ' || official_last_name;
      official_position := p_official_player ->> 'position';
      official_birth_date := (p_official_player ->> 'birthDate')::date;
      official_birth_country := pg_catalog.btrim(p_official_player ->> 'birthCountry');
      official_height := (p_official_player ->> 'heightInCentimeters')::smallint;
      official_weight := (p_official_player ->> 'weightInKilograms')::smallint;
      official_team_id := (p_official_player ->> 'currentTeamId')::smallint;
      official_team_name := nullif(pg_catalog.btrim(p_official_player ->> 'teamName'), '');
      source_observed_at := (p_official_player ->> 'observedAt')::timestamptz;
    exception when others then
      raise exception using
        errcode = '22023',
        message = 'PLAYER_FORECAST_SEASON_OFFICIAL_PLAYER_INVALID';
    end;

    if official_nhl_player_id <> pending_review.nhl_player_id
      or official_height <= 0
      or official_weight <= 0
      or source_observed_at > pg_catalog.statement_timestamp() + interval '5 minutes'
      or not exists (select 1 from public.teams where id = official_team_id)
    then
      raise exception using
        errcode = '22023',
        message = 'PLAYER_FORECAST_SEASON_OFFICIAL_PLAYER_MISMATCH';
    end if;

    insert into public.players as player (
      id, "firstName", "lastName", "fullName", position, "birthDate",
      "birthCity", "birthCountry", "heightInCentimeters", "weightInKilograms",
      image_url, team_id, sweater_number
    ) values (
      official_nhl_player_id,
      official_first_name,
      official_last_name,
      official_full_name,
      official_position::public."NHL_Position_Code",
      official_birth_date,
      nullif(pg_catalog.btrim(p_official_player ->> 'birthCity'), ''),
      official_birth_country,
      official_height,
      official_weight,
      nullif(pg_catalog.btrim(p_official_player ->> 'headshotUrl'), ''),
      official_team_id,
      case
        when coalesce(p_official_player ->> 'sweaterNumber', '') ~ '^[0-9]+$'
          then (p_official_player ->> 'sweaterNumber')::smallint
        else null
      end
    )
    on conflict (id) do update
    set "firstName" = excluded."firstName",
        "lastName" = excluded."lastName",
        "fullName" = excluded."fullName",
        position = excluded.position,
        "birthDate" = excluded."birthDate",
        "birthCity" = excluded."birthCity",
        "birthCountry" = excluded."birthCountry",
        "heightInCentimeters" = excluded."heightInCentimeters",
        "weightInKilograms" = excluded."weightInKilograms",
        image_url = excluded.image_url,
        team_id = excluded.team_id,
        sweater_number = excluded.sweater_number;

    select identity.*
    into existing_identity
    from public.fhfh_player_identities identity
    where identity.nhl_player_id = official_nhl_player_id
    for update;

    if p_resolution_action = 'create_new' then
      if existing_identity.id is not null then
        raise exception using
          errcode = '23505',
          message = 'PLAYER_FORECAST_SEASON_NHL_IDENTITY_ALREADY_EXISTS';
      end if;
      if p_lifecycle_status not in ('active_nhl', 'active_prospect', 'unsigned_relevant') then
        raise exception using
          errcode = '22023',
          message = 'PLAYER_FORECAST_SEASON_IDENTITY_LIFECYCLE_INVALID';
      end if;

      insert into public.fhfh_player_identities (
        nhl_player_id, canonical_name, first_name, last_name, birth_date,
        canonical_position, current_nhl_team_id, current_organization_name,
        current_organization_type, lifecycle_status, verification_status,
        headshot_url, source_provenance, verified_at, verified_by
      ) values (
        official_nhl_player_id,
        official_full_name,
        official_first_name,
        official_last_name,
        official_birth_date,
        official_position::public."NHL_Position_Code",
        official_team_id,
        official_team_name,
        'nhl',
        p_lifecycle_status,
        'verified',
        nullif(pg_catalog.btrim(p_official_player ->> 'headshotUrl'), ''),
        pg_catalog.jsonb_build_object(
          'seasonEditorIdentityResolution', pg_catalog.jsonb_build_object(
            'reviewId', pending_review.id,
            'nhlPlayerId', official_nhl_player_id,
            'sourceUrl', p_official_player ->> 'sourceUrl',
            'sourceObservedAt', source_observed_at,
            'sourcePayloadHash', p_official_player ->> 'sourcePayloadHash'
          )
        ),
        pg_catalog.statement_timestamp(),
        p_editor_user_id
      )
      returning id into resolved_identity_id;
      created_identity := true;
    else
      if p_fhfh_player_id is null then
        raise exception using
          errcode = '22023',
          message = 'PLAYER_FORECAST_SEASON_FHFH_IDENTITY_REQUIRED';
      end if;

      select identity.*
      into existing_identity
      from public.fhfh_player_identities identity
      where identity.id = p_fhfh_player_id
      for update;

      if not found
        or existing_identity.verification_status in ('rejected', 'merged')
        or existing_identity.merged_into_id is not null
        or (
          existing_identity.nhl_player_id is not null
          and existing_identity.nhl_player_id <> official_nhl_player_id
        )
      then
        raise exception using
          errcode = '22023',
          message = 'PLAYER_FORECAST_SEASON_FHFH_IDENTITY_CONFLICT';
      end if;

      if exists (
        select 1
        from public.fhfh_player_identities identity
        where identity.nhl_player_id = official_nhl_player_id
          and identity.id <> existing_identity.id
      ) then
        raise exception using
          errcode = '23505',
          message = 'PLAYER_FORECAST_SEASON_NHL_IDENTITY_ALREADY_EXISTS';
      end if;

      update public.fhfh_player_identities identity
      set nhl_player_id = official_nhl_player_id,
          birth_date = coalesce(identity.birth_date, official_birth_date),
          canonical_position = official_position::public."NHL_Position_Code",
          current_nhl_team_id = official_team_id,
          current_organization_name = official_team_name,
          current_organization_type = 'nhl',
          lifecycle_status = case
            when identity.lifecycle_status in ('active_nhl', 'active_prospect', 'unsigned_relevant')
              then identity.lifecycle_status
            else coalesce(p_lifecycle_status, 'active_nhl')
          end,
          verification_status = 'verified',
          headshot_url = coalesce(
            nullif(pg_catalog.btrim(p_official_player ->> 'headshotUrl'), ''),
            identity.headshot_url
          ),
          source_provenance = identity.source_provenance || pg_catalog.jsonb_build_object(
            'seasonEditorIdentityResolution', pg_catalog.jsonb_build_object(
              'reviewId', pending_review.id,
              'nhlPlayerId', official_nhl_player_id,
              'reviewedName', pending_review.raw_player_name,
              'sourceUrl', p_official_player ->> 'sourceUrl',
              'sourceObservedAt', source_observed_at,
              'sourcePayloadHash', p_official_player ->> 'sourcePayloadHash'
            )
          ),
          verified_at = pg_catalog.statement_timestamp(),
          verified_by = p_editor_user_id
      where identity.id = existing_identity.id
      returning identity.id into resolved_identity_id;
    end if;

    if exists (
      select 1
      from public.fhfh_player_external_identities external
      where external.provider = 'nhl'
        and external.context_key = 'global'
        and external.external_player_id = official_nhl_player_id::text
        and external.fhfh_player_id <> resolved_identity_id
    ) then
      raise exception using
        errcode = '23505',
        message = 'PLAYER_FORECAST_SEASON_NHL_EXTERNAL_IDENTITY_CONFLICT';
    end if;

    insert into public.fhfh_player_external_identities (
      fhfh_player_id, provider, external_player_id, context_key, season_id,
      is_primary, match_method, match_confidence, verification_status,
      source_provenance, verified_at, verified_by
    ) values (
      resolved_identity_id,
      'nhl',
      official_nhl_player_id::text,
      'global',
      pending_review.season_id,
      true,
      'season_editor_official_nhl_id',
      1,
      'verified',
      pg_catalog.jsonb_build_object(
        'reviewId', pending_review.id,
        'sourceUrl', p_official_player ->> 'sourceUrl',
        'sourceObservedAt', source_observed_at,
        'sourcePayloadHash', p_official_player ->> 'sourcePayloadHash'
      ),
      pg_catalog.statement_timestamp(),
      p_editor_user_id
    )
    on conflict (provider, context_key, external_player_id) do update
    set fhfh_player_id = excluded.fhfh_player_id,
        season_id = excluded.season_id,
        is_primary = true,
        match_method = excluded.match_method,
        match_confidence = excluded.match_confidence,
        verification_status = 'verified',
        source_provenance = excluded.source_provenance,
        verified_at = excluded.verified_at,
        verified_by = excluded.verified_by;

    insert into public.fhfh_player_identity_review_queue (
      review_type, requested_by, raw_name, submitted_context,
      candidate_fhfh_player_ids, source_evidence, dedupe_key, status,
      resolution_action, resolved_fhfh_player_id, resolution_notes,
      reviewed_by, reviewed_at
    ) values (
      case when created_identity then 'player_addition' else 'external_mapping' end,
      p_editor_user_id,
      pending_review.raw_player_name,
      pg_catalog.jsonb_build_object(
        'seasonId', pending_review.season_id,
        'seasonPlayerPoolReviewId', pending_review.id,
        'teamId', pending_review.team_id,
        'position', pending_review.position
      ),
      array[resolved_identity_id],
      p_official_player,
      'season-player-pool:' || pending_review.id::text,
      'resolved',
      case when created_identity then 'created_verified_identity' else 'mapped_existing_identity' end,
      resolved_identity_id,
      pg_catalog.btrim(p_resolution_reason),
      p_editor_user_id,
      pg_catalog.statement_timestamp()
    );

    resolution_status := 'mapped';
  end if;

  resolution_key := pg_catalog.encode(
    extensions.digest(
      pending_review.id::text || ':' || p_resolution_action || ':' ||
      coalesce(resolved_identity_id::text, 'excluded') || ':' ||
      pg_catalog.gen_random_uuid()::text,
      'sha256'
    ),
    'hex'
  );

  insert into public.player_forecast_season_player_pool_review (
    review_key, season_id, nhl_player_id, raw_player_name, team_id, position,
    issue_code, resolution_status, mapped_fhfh_player_id, resolution_reason,
    supersedes_id, created_by, source_provenance
  ) values (
    resolution_key,
    pending_review.season_id,
    pending_review.nhl_player_id,
    pending_review.raw_player_name,
    pending_review.team_id,
    pending_review.position,
    pending_review.issue_code,
    resolution_status,
    resolved_identity_id,
    pg_catalog.btrim(p_resolution_reason),
    pending_review.id,
    p_editor_user_id,
    pending_review.source_provenance || pg_catalog.jsonb_build_object(
      'resolutionSource', 'season_editor',
      'resolutionAction', p_resolution_action,
      'createdIdentity', created_identity
    )
  )
  returning * into resolution;

  perform public.enqueue_player_forecast_season_job(
    'season:' || pending_review.season_id::text || ':view:current' ||
      case when pending_review.team_id is not null then ':team:' || pending_review.team_id::text else '' end ||
      case when resolved_identity_id is not null then ':player:' || resolved_identity_id::text else '' end ||
      ':manual',
    pending_review.season_id,
    'current',
    pending_review.team_id,
    null,
    resolved_identity_id,
    'player_pool_resolution',
    pg_catalog.statement_timestamp(),
    pg_catalog.statement_timestamp(),
    pg_catalog.jsonb_build_object('requestedBy', 'season_editor')
  );

  perform public.enqueue_player_forecast_season_job(
    'season:' || pending_review.season_id::text || ':view:ros' ||
      case when pending_review.team_id is not null then ':team:' || pending_review.team_id::text else '' end ||
      case when resolved_identity_id is not null then ':player:' || resolved_identity_id::text else '' end ||
      ':manual',
    pending_review.season_id,
    'ros',
    pending_review.team_id,
    null,
    resolved_identity_id,
    'player_pool_resolution',
    pg_catalog.statement_timestamp(),
    pg_catalog.statement_timestamp(),
    pg_catalog.jsonb_build_object('requestedBy', 'season_editor')
  );

  return pg_catalog.jsonb_build_object(
    'reviewId', resolution.id,
    'resolutionStatus', resolution.resolution_status,
    'fhfhPlayerId', resolved_identity_id,
    'createdIdentity', created_identity,
    'nhlPlayerId', pending_review.nhl_player_id,
    'rawPlayerName', pending_review.raw_player_name
  );
end;
$$;

revoke all on function public.resolve_player_forecast_season_identity(
  uuid, uuid, text, text, bigint, text, jsonb
) from public, anon, authenticated;
grant execute on function public.resolve_player_forecast_season_identity(
  uuid, uuid, text, text, bigint, text, jsonb
) to service_role;
