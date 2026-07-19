-- DR-011: deterministically backfill the existing NHL-linked player universe.
--
-- The operation is rerunnable. It keys canonical identities and NHL external
-- mappings by the existing public.players primary key, preserves duplicate
-- names as distinct identities, and does not infer Yahoo mappings from names.

with latest_roster_season as (
    select max("seasonId") as season_id
    from public.rosters
),
current_roster as (
    select ranked."playerId", ranked."teamId", ranked."seasonId"
    from (
        select
            r."playerId",
            r."teamId",
            r."seasonId",
            row_number() over (
                partition by r."playerId"
                order by r.created_at desc, r."teamId"
            ) as row_number
        from public.rosters r
        join latest_roster_season latest
          on latest.season_id = r."seasonId"
        where r.is_current
    ) ranked
    where ranked.row_number = 1
)
insert into public.fhfh_player_identities (
    nhl_player_id,
    canonical_name,
    first_name,
    last_name,
    birth_date,
    canonical_position,
    current_nhl_team_id,
    current_organization_name,
    current_organization_type,
    lifecycle_status,
    verification_status,
    headshot_url,
    source_provenance,
    verified_at
)
select
    p.id,
    p."fullName",
    p."firstName",
    p."lastName",
    p."birthDate",
    p.position,
    roster."teamId",
    team.name,
    case when roster."teamId" is not null then 'nhl' else 'unknown' end,
    case when roster."teamId" is not null then 'active_nhl' else 'inactive' end,
    'verified',
    p.image_url,
    jsonb_strip_nulls(jsonb_build_object(
        'schema_version', 1,
        'canonical_source', 'public.players',
        'nhl_player_id', p.id,
        'organization_source', case
            when roster."teamId" is not null then 'public.rosters'
            else null
        end,
        'roster_season_id', roster."seasonId"
    )),
    statement_timestamp()
from public.players p
left join current_roster roster on roster."playerId" = p.id
left join public.teams team on team.id = roster."teamId"
on conflict (nhl_player_id) where nhl_player_id is not null
do update set
    canonical_name = excluded.canonical_name,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    birth_date = excluded.birth_date,
    canonical_position = excluded.canonical_position,
    current_nhl_team_id = excluded.current_nhl_team_id,
    current_organization_name = excluded.current_organization_name,
    current_organization_type = excluded.current_organization_type,
    lifecycle_status = excluded.lifecycle_status,
    verification_status = 'verified',
    headshot_url = excluded.headshot_url,
    source_provenance = excluded.source_provenance,
    verified_at = coalesce(
        public.fhfh_player_identities.verified_at,
        excluded.verified_at
    );

insert into public.fhfh_player_external_identities (
    fhfh_player_id,
    provider,
    external_player_id,
    context_key,
    is_primary,
    match_method,
    match_confidence,
    verification_status,
    source_provenance,
    verified_at
)
select
    identity.id,
    'nhl',
    identity.nhl_player_id::text,
    'global',
    true,
    'canonical_players_primary_key',
    1.0000,
    'verified',
    jsonb_build_object(
        'schema_version', 1,
        'source_table', 'public.players',
        'source_column', 'id'
    ),
    statement_timestamp()
from public.fhfh_player_identities identity
where identity.nhl_player_id is not null
on conflict (provider, context_key, external_player_id)
do update set
    is_primary = true,
    match_method = excluded.match_method,
    match_confidence = excluded.match_confidence,
    verification_status = 'verified',
    source_provenance = excluded.source_provenance,
    verified_at = coalesce(
        public.fhfh_player_external_identities.verified_at,
        excluded.verified_at
    )
where public.fhfh_player_external_identities.fhfh_player_id
    = excluded.fhfh_player_id;

insert into public.fhfh_player_identity_aliases (
    fhfh_player_id,
    alias,
    normalized_alias,
    language_code,
    source,
    verification_status,
    source_provenance
)
select
    identity.id,
    identity.canonical_name,
    public.immutable_unaccent(lower(btrim(identity.canonical_name))),
    'en',
    'nhl',
    'verified',
    jsonb_build_object(
        'schema_version', 1,
        'source_table', 'public.players',
        'source_column', 'fullName'
    )
from public.fhfh_player_identities identity
where identity.nhl_player_id is not null
on conflict (fhfh_player_id, normalized_alias, source)
do update set
    alias = excluded.alias,
    verification_status = 'verified',
    source_provenance = excluded.source_provenance;

with latest_roster_season as (
    select max("seasonId") as season_id
    from public.rosters
),
roster_history as (
    select
        identity.id as fhfh_player_id,
        r."teamId" as nhl_team_id,
        team.name as organization_name,
        season."startDate" as effective_from,
        season."endDate" as effective_to,
        r."seasonId" as season_id,
        r.is_current and r."seasonId" = latest.season_id as is_current
    from public.rosters r
    join public.fhfh_player_identities identity
      on identity.nhl_player_id = r."playerId"
    join public.teams team on team.id = r."teamId"
    join public.seasons season on season.id = r."seasonId"
    cross join latest_roster_season latest
)
insert into public.fhfh_player_organization_history (
    fhfh_player_id,
    nhl_team_id,
    organization_name,
    organization_type,
    effective_from,
    effective_to,
    is_current,
    source,
    source_confidence,
    source_provenance
)
select
    roster.fhfh_player_id,
    roster.nhl_team_id,
    roster.organization_name,
    'nhl',
    roster.effective_from,
    roster.effective_to,
    roster.is_current,
    'nhl_rosters:' || roster.season_id::text,
    1.0000,
    jsonb_build_object(
        'schema_version', 1,
        'source_table', 'public.rosters',
        'season_id', roster.season_id
    )
from roster_history roster
where not exists (
    select 1
    from public.fhfh_player_organization_history existing
    where existing.fhfh_player_id = roster.fhfh_player_id
      and existing.nhl_team_id = roster.nhl_team_id
      and existing.source = 'nhl_rosters:' || roster.season_id::text
);
;
