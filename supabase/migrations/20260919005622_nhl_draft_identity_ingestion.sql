-- Draft history supplements the existing registry. Draft ownership never sets current membership.
create table public.nhl_draft_selections (
  draft_year integer not null,
  overall_pick integer not null,
  round integer not null check (round > 0),
  pick_in_round integer not null check (pick_in_round > 0),
  fhfh_player_id bigint not null references public.fhfh_player_identities(id),
  drafting_team_id smallint not null references public.teams(id),
  drafting_team_abbreviation text not null,
  amateur_club text,
  amateur_league text,
  source_url text not null,
  checked_at timestamptz not null,
  primary key(draft_year, overall_pick)
);
create index nhl_draft_selections_identity on public.nhl_draft_selections(fhfh_player_id);
alter table public.nhl_draft_selections enable row level security;
revoke all on public.nhl_draft_selections from public, anon, authenticated;
grant all on public.nhl_draft_selections to service_role;

-- One transaction per identity; resumable batches can safely retry completed records.
create function public.import_nhl_prospect_identity(payload jsonb, roster_season bigint)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  nhl_id bigint := (payload->>'nhlId')::bigint;
  identity_id bigint;
  linked_id bigint;
  prior_id bigint;
  draft jsonb := nullif(payload->'draft', 'null'::jsonb);
  checked timestamptz := (payload->>'checkedAt')::timestamptz;
  organization smallint := (payload->>'currentTeamId')::smallint;
  compatible boolean;
  candidate_count integer;
begin
  if nullif(trim(payload->>'firstName'), '') is null or nullif(trim(payload->>'lastName'), '') is null
    or not ((payload->>'sourceUrl') like 'https://api-web.nhle.com/v1/player/%/landing'
      or (payload->>'sourceUrl') like 'https://records.nhl.com/site/api/draft?%') then
    raise exception 'Invalid official identity evidence';
  end if;
  -- Serialize imports across both draft and exact-ID entry points.
  perform pg_advisory_xact_lock(hashtextextended('nhl-identity-import', 0));
  if nhl_id is not null then
    select id into identity_id from public.fhfh_player_identities where nhl_player_id = nhl_id;
    select fhfh_player_id into linked_id from public.fhfh_player_external_identities
      where provider = 'nhl' and context_key = 'global' and external_player_id = nhl_id::text and verification_status = 'verified';
    if identity_id is not null and linked_id is not null and identity_id <> linked_id then raise exception 'Conflicting NHL identity mappings'; end if;
    identity_id := coalesce(identity_id, linked_id);
  end if;
  if draft is not null then
    select fhfh_player_id into prior_id from public.nhl_draft_selections
      where draft_year = (draft->>'year')::integer and overall_pick = (draft->>'overall')::integer;
    if identity_id is not null and prior_id is not null and identity_id <> prior_id then raise exception 'Conflicting draft identity'; end if;
    identity_id := coalesce(identity_id, prior_id);
  end if;
  if identity_id is null and payload->>'birthDate' is not null then
    select count(*), min(id) into candidate_count, identity_id from public.fhfh_player_identities
      where lower(canonical_name) = lower(payload->>'fullName') and birth_date = (payload->>'birthDate')::date
      and verification_status <> 'merged';
    if candidate_count > 1 then raise exception 'Ambiguous existing prospect identity'; end if;
  end if;
  if identity_id is not null and exists(select 1 from public.fhfh_player_identities where id = identity_id
    and (verification_status in ('rejected', 'merged') or (nhl_player_id is not null and nhl_player_id is distinct from nhl_id)
      or (birth_date is not null and birth_date is distinct from (payload->>'birthDate')::date))) then
    raise exception 'Existing identity requires manual review';
  end if;
  compatible := nhl_id is not null and payload->>'birthDate' is not null
    and payload->>'position' in ('L','C','R','D','G') and (payload->>'height')::integer > 0 and (payload->>'weight')::integer > 0;
  if nhl_id is not null and exists(select 1 from public.players where id = nhl_id and "birthDate" <> (payload->>'birthDate')::date) then
    raise exception 'Existing NHL player birth-date conflict';
  end if;
  if compatible then
    insert into public.players(id, "firstName", "lastName", "fullName", "birthDate", position, "heightInCentimeters", "weightInKilograms", "birthCountry")
    values(nhl_id, payload->>'firstName', payload->>'lastName', payload->>'fullName', (payload->>'birthDate')::date,
      (payload->>'position')::public."NHL_Position_Code", (payload->>'height')::smallint, (payload->>'weight')::smallint, payload->>'country')
    on conflict(id) do nothing; -- Never rewrite an established player's roster/team or statistics.
  end if;
  if identity_id is null then
    insert into public.fhfh_player_identities(nhl_player_id, canonical_name, first_name, last_name, birth_date, canonical_position,
      lifecycle_status, verification_status, source_provenance, verified_at)
    values(case when exists(select 1 from public.players where id = nhl_id) then nhl_id end,
      payload->>'fullName', payload->>'firstName', payload->>'lastName', (payload->>'birthDate')::date,
      (payload->>'position')::public."NHL_Position_Code", coalesce(payload->>'lifecycleStatus','review_required'), 'verified',
      jsonb_build_object('nhl_identity_source', payload->>'sourceUrl'), checked)
    returning id into identity_id;
  else
    update public.fhfh_player_identities set nhl_player_id = coalesce(nhl_player_id,
      case when exists(select 1 from public.players where id = nhl_id) then nhl_id end)
    where id = identity_id;
  end if;
  if nhl_id is not null then
    insert into public.fhfh_player_external_identities(fhfh_player_id, provider, external_player_id, context_key, is_primary,
      match_method, match_confidence, verification_status, source_provenance, verified_at)
    values(identity_id, 'nhl', nhl_id::text, 'global', true, 'official_nhl_id', 1, 'verified',
      jsonb_build_object('url', payload->>'sourceUrl'), checked)
    on conflict(provider, context_key, external_player_id) do nothing;
    if not exists(select 1 from public.fhfh_player_external_identities where provider = 'nhl' and context_key = 'global'
      and external_player_id = nhl_id::text and fhfh_player_id = identity_id and verification_status = 'verified') then
      raise exception 'NHL external identity needs review';
    end if;
  end if;
  if draft is not null then
    insert into public.nhl_draft_selections values((draft->>'year')::integer, (draft->>'overall')::integer,
      (draft->>'round')::integer, (draft->>'pick')::integer, identity_id, (draft->>'teamId')::smallint,
      draft->>'teamAbbreviation', draft->>'club', draft->>'league', draft->>'sourceUrl', checked)
    on conflict(draft_year, overall_pick) do update set checked_at = excluded.checked_at;
  end if;
  -- Only a fresh individual profile can provide current organization evidence. Never a draft pick.
  if (payload->>'sourceUrl') = 'https://api-web.nhle.com/v1/player/' || nhl_id || '/landing'
    and checked between now() - interval '1 hour' and now() + interval '5 minutes'
    and exists(select 1 from public.players where id = nhl_id) then
    update public.fhfh_player_organization_history set is_current = false, effective_to = current_date
      where fhfh_player_id = identity_id and source = 'nhl_player_profile' and is_current
        and nhl_team_id is distinct from organization;
    delete from public.tweet_player_memberships where player_id = nhl_id and membership_kind = 'organization'
      and source_url = payload->>'sourceUrl';
    if organization is not null then
      insert into public.fhfh_player_organization_history(fhfh_player_id, nhl_team_id, organization_name, organization_type,
        effective_from, is_current, source, source_confidence, source_provenance)
      values(identity_id, organization, 'NHL organization ' || organization, 'nhl', current_date, true, 'nhl_player_profile', 1,
        jsonb_build_object('url', payload->>'sourceUrl', 'checkedAt', checked))
      on conflict(fhfh_player_id, source) where is_current do update set
        source_provenance = excluded.source_provenance, updated_at = now();
      insert into public.tweet_player_memberships(player_id, team_id, season_id, membership_kind, source_url, verified_at, expires_at)
      values(nhl_id, organization, roster_season, 'organization', payload->>'sourceUrl', checked, checked + interval '7 days')
      on conflict(player_id,team_id,season_id,membership_kind) do update set source_url = excluded.source_url,
        verified_at = excluded.verified_at, expires_at = excluded.expires_at;
    end if;
  end if;
  if organization is not null and exists(select 1 from public.players where id = nhl_id) then
    insert into public.tweet_pipeline_jobs(job_key, payload)
    select 'alias-replay:prospect:' || pending.id, jsonb_build_object(
      'normalizedName', pending.normalized_name, 'teamId', pending.team_id, 'playerId', nhl_id,
      'alias', pending.raw_name, 'afterId', null)
    from public.lineup_unresolved_player_names pending
    where pending.status = 'pending' and pending.team_id = organization
      and lower(pending.raw_name) in (lower(payload->>'fullName'), lower(payload->>'lastName'))
    on conflict(job_key) do nothing;
  end if;
  return jsonb_build_object('identityId', identity_id, 'nhlId', nhl_id,
    'availableToPipeline', exists(select 1 from public.players where id = nhl_id));
end;
$$;
revoke all on function public.import_nhl_prospect_identity(jsonb,bigint) from public, anon, authenticated;
grant execute on function public.import_nhl_prospect_identity(jsonb,bigint) to service_role;
