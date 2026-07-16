-- FHFH Draft Ranker: additive canonical identity registry.
--
-- This migration intentionally does not replace public.players. The existing
-- players.id remains the NHL player identity used by analytics, rosters, and
-- projection sources. These tables add an FHFH-owned identity capable of
-- representing verified prospects and other real players without NHL or
-- Yahoo identifiers.

create table if not exists public.fhfh_player_identities (
    id bigint generated always as identity primary key,
    nhl_player_id bigint null
        references public.players(id)
        on update restrict
        on delete restrict,
    canonical_name text not null,
    first_name text null,
    last_name text null,
    birth_date date null,
    canonical_position public."NHL_Position_Code" null,
    current_nhl_team_id smallint null
        references public.teams(id)
        on update restrict
        on delete set null,
    current_organization_name text null,
    current_organization_type text not null default 'unknown',
    lifecycle_status text not null default 'review_required',
    verification_status text not null default 'review_required',
    headshot_url text null,
    merged_into_id bigint null
        references public.fhfh_player_identities(id)
        on update restrict
        on delete restrict,
    source_provenance jsonb not null default '{}'::jsonb,
    verified_at timestamptz null,
    verified_by uuid null
        references auth.users(id)
        on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint fhfh_player_identities_canonical_name_nonblank
        check (btrim(canonical_name) <> ''),
    constraint fhfh_player_identities_organization_type_valid
        check (
            current_organization_type in (
                'nhl',
                'ahl',
                'echl',
                'chl',
                'ncaa',
                'europe',
                'international',
                'unsigned',
                'other',
                'unknown'
            )
        ),
    constraint fhfh_player_identities_lifecycle_status_valid
        check (
            lifecycle_status in (
                'active_nhl',
                'active_prospect',
                'unsigned_relevant',
                'inactive',
                'retired',
                'overseas',
                'deceased',
                'review_required'
            )
        ),
    constraint fhfh_player_identities_verification_status_valid
        check (
            verification_status in (
                'verified',
                'provisional',
                'review_required',
                'rejected',
                'merged'
            )
        ),
    constraint fhfh_player_identities_merge_target_valid
        check (
            (
                verification_status = 'merged'
                and merged_into_id is not null
                and merged_into_id <> id
            )
            or (
                verification_status <> 'merged'
                and merged_into_id is null
            )
        ),
    constraint fhfh_player_identities_source_provenance_object
        check (jsonb_typeof(source_provenance) = 'object')
);

create unique index if not exists idx_fhfh_player_identities_nhl_player_id
    on public.fhfh_player_identities (nhl_player_id)
    where nhl_player_id is not null;

create index if not exists idx_fhfh_player_identities_name_lower
    on public.fhfh_player_identities (lower(canonical_name));

create index if not exists idx_fhfh_player_identities_status
    on public.fhfh_player_identities (
        verification_status,
        lifecycle_status,
        id
    );

create index if not exists idx_fhfh_player_identities_current_nhl_team
    on public.fhfh_player_identities (current_nhl_team_id)
    where current_nhl_team_id is not null;

create table if not exists public.fhfh_player_external_identities (
    id uuid primary key default gen_random_uuid(),
    fhfh_player_id bigint not null
        references public.fhfh_player_identities(id)
        on update restrict
        on delete cascade,
    provider text not null,
    external_player_id text not null,
    context_key text not null default 'global',
    season_id bigint null
        references public.seasons(id)
        on update restrict
        on delete restrict,
    is_primary boolean not null default false,
    match_method text not null,
    match_confidence numeric(5, 4) null,
    verification_status text not null default 'review_required',
    source_provenance jsonb not null default '{}'::jsonb,
    verified_at timestamptz null,
    verified_by uuid null
        references auth.users(id)
        on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint fhfh_player_external_provider_nonblank
        check (btrim(provider) <> ''),
    constraint fhfh_player_external_id_nonblank
        check (btrim(external_player_id) <> ''),
    constraint fhfh_player_external_context_nonblank
        check (btrim(context_key) <> ''),
    constraint fhfh_player_external_match_method_nonblank
        check (btrim(match_method) <> ''),
    constraint fhfh_player_external_match_confidence_valid
        check (
            match_confidence is null
            or (match_confidence >= 0 and match_confidence <= 1)
        ),
    constraint fhfh_player_external_verification_status_valid
        check (
            verification_status in (
                'verified',
                'review_required',
                'rejected',
                'superseded'
            )
        ),
    constraint fhfh_player_external_source_provenance_object
        check (jsonb_typeof(source_provenance) = 'object'),
    constraint fhfh_player_external_provider_context_id_unique
        unique (provider, context_key, external_player_id),
    constraint fhfh_player_external_player_provider_context_id_unique
        unique (
            fhfh_player_id,
            provider,
            context_key,
            external_player_id
        )
);

create index if not exists idx_fhfh_player_external_player
    on public.fhfh_player_external_identities (
        fhfh_player_id,
        provider,
        verification_status
    );

create index if not exists idx_fhfh_player_external_season
    on public.fhfh_player_external_identities (season_id, provider)
    where season_id is not null;

create table if not exists public.fhfh_player_identity_aliases (
    id uuid primary key default gen_random_uuid(),
    fhfh_player_id bigint not null
        references public.fhfh_player_identities(id)
        on update restrict
        on delete cascade,
    alias text not null,
    normalized_alias text not null,
    language_code text null,
    source text not null,
    verification_status text not null default 'verified',
    source_provenance jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint fhfh_player_identity_aliases_alias_nonblank
        check (btrim(alias) <> ''),
    constraint fhfh_player_identity_aliases_normalized_nonblank
        check (btrim(normalized_alias) <> ''),
    constraint fhfh_player_identity_aliases_source_nonblank
        check (btrim(source) <> ''),
    constraint fhfh_player_identity_aliases_status_valid
        check (
            verification_status in (
                'verified',
                'review_required',
                'rejected',
                'superseded'
            )
        ),
    constraint fhfh_player_identity_aliases_provenance_object
        check (jsonb_typeof(source_provenance) = 'object'),
    constraint fhfh_player_identity_aliases_player_alias_source_unique
        unique (fhfh_player_id, normalized_alias, source)
);

create index if not exists idx_fhfh_player_identity_aliases_normalized
    on public.fhfh_player_identity_aliases (normalized_alias);

create index if not exists idx_fhfh_player_identity_aliases_player
    on public.fhfh_player_identity_aliases (fhfh_player_id);

create table if not exists public.fhfh_player_organization_history (
    id uuid primary key default gen_random_uuid(),
    fhfh_player_id bigint not null
        references public.fhfh_player_identities(id)
        on update restrict
        on delete cascade,
    nhl_team_id smallint null
        references public.teams(id)
        on update restrict
        on delete set null,
    organization_name text not null,
    organization_type text not null,
    effective_from date null,
    effective_to date null,
    is_current boolean not null default false,
    source text not null,
    source_confidence numeric(5, 4) null,
    source_provenance jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint fhfh_player_organization_name_nonblank
        check (btrim(organization_name) <> ''),
    constraint fhfh_player_organization_type_valid
        check (
            organization_type in (
                'nhl',
                'ahl',
                'echl',
                'chl',
                'ncaa',
                'europe',
                'international',
                'unsigned',
                'other',
                'unknown'
            )
        ),
    constraint fhfh_player_organization_source_nonblank
        check (btrim(source) <> ''),
    constraint fhfh_player_organization_dates_valid
        check (
            effective_to is null
            or effective_from is null
            or effective_to >= effective_from
        ),
    constraint fhfh_player_organization_confidence_valid
        check (
            source_confidence is null
            or (source_confidence >= 0 and source_confidence <= 1)
        ),
    constraint fhfh_player_organization_provenance_object
        check (jsonb_typeof(source_provenance) = 'object')
);

create unique index if not exists idx_fhfh_player_organization_current_source
    on public.fhfh_player_organization_history (fhfh_player_id, source)
    where is_current;

create index if not exists idx_fhfh_player_organization_player_dates
    on public.fhfh_player_organization_history (
        fhfh_player_id,
        effective_from desc,
        effective_to desc
    );

create table if not exists public.fhfh_player_identity_review_queue (
    id uuid primary key default gen_random_uuid(),
    review_type text not null,
    requested_by uuid null
        references auth.users(id)
        on delete set null,
    raw_name text null,
    submitted_context jsonb not null default '{}'::jsonb,
    candidate_fhfh_player_ids bigint[] not null default '{}'::bigint[],
    source_evidence jsonb not null default '{}'::jsonb,
    dedupe_key text null,
    status text not null default 'pending',
    resolution_action text null,
    resolved_fhfh_player_id bigint null
        references public.fhfh_player_identities(id)
        on update restrict
        on delete restrict,
    resolution_notes text null,
    reviewed_by uuid null
        references auth.users(id)
        on delete set null,
    reviewed_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint fhfh_player_identity_review_type_valid
        check (
            review_type in (
                'external_mapping',
                'player_addition',
                'identity_conflict',
                'identity_merge'
            )
        ),
    constraint fhfh_player_identity_review_status_valid
        check (
            status in (
                'pending',
                'in_review',
                'resolved',
                'rejected',
                'duplicate'
            )
        ),
    constraint fhfh_player_identity_review_context_object
        check (jsonb_typeof(submitted_context) = 'object'),
    constraint fhfh_player_identity_review_evidence_object
        check (jsonb_typeof(source_evidence) = 'object'),
    constraint fhfh_player_identity_review_resolution_valid
        check (
            status <> 'resolved'
            or (
                resolution_action is not null
                and reviewed_at is not null
                and reviewed_by is not null
            )
        )
);

create unique index if not exists idx_fhfh_player_identity_review_dedupe_open
    on public.fhfh_player_identity_review_queue (dedupe_key)
    where dedupe_key is not null
      and status in ('pending', 'in_review');

create index if not exists idx_fhfh_player_identity_review_status_created
    on public.fhfh_player_identity_review_queue (status, created_at);

create index if not exists idx_fhfh_player_identity_review_requester
    on public.fhfh_player_identity_review_queue (requested_by, created_at desc)
    where requested_by is not null;

create or replace function public.set_fhfh_player_identity_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
    new.updated_at = statement_timestamp();
    return new;
end;
$$;

revoke execute on function public.set_fhfh_player_identity_updated_at()
    from public, anon, authenticated;
grant execute on function public.set_fhfh_player_identity_updated_at()
    to service_role;

drop trigger if exists set_fhfh_player_identities_updated_at
    on public.fhfh_player_identities;
create trigger set_fhfh_player_identities_updated_at
before update on public.fhfh_player_identities
for each row
execute function public.set_fhfh_player_identity_updated_at();

drop trigger if exists set_fhfh_player_external_identities_updated_at
    on public.fhfh_player_external_identities;
create trigger set_fhfh_player_external_identities_updated_at
before update on public.fhfh_player_external_identities
for each row
execute function public.set_fhfh_player_identity_updated_at();

drop trigger if exists set_fhfh_player_identity_aliases_updated_at
    on public.fhfh_player_identity_aliases;
create trigger set_fhfh_player_identity_aliases_updated_at
before update on public.fhfh_player_identity_aliases
for each row
execute function public.set_fhfh_player_identity_updated_at();

drop trigger if exists set_fhfh_player_organization_history_updated_at
    on public.fhfh_player_organization_history;
create trigger set_fhfh_player_organization_history_updated_at
before update on public.fhfh_player_organization_history
for each row
execute function public.set_fhfh_player_identity_updated_at();

drop trigger if exists set_fhfh_player_identity_review_queue_updated_at
    on public.fhfh_player_identity_review_queue;
create trigger set_fhfh_player_identity_review_queue_updated_at
before update on public.fhfh_player_identity_review_queue
for each row
execute function public.set_fhfh_player_identity_updated_at();

alter table public.fhfh_player_identities enable row level security;
alter table public.fhfh_player_external_identities enable row level security;
alter table public.fhfh_player_identity_aliases enable row level security;
alter table public.fhfh_player_organization_history enable row level security;
alter table public.fhfh_player_identity_review_queue enable row level security;

revoke all on table public.fhfh_player_identities
    from public, anon, authenticated;
revoke all on table public.fhfh_player_external_identities
    from public, anon, authenticated;
revoke all on table public.fhfh_player_identity_aliases
    from public, anon, authenticated;
revoke all on table public.fhfh_player_organization_history
    from public, anon, authenticated;
revoke all on table public.fhfh_player_identity_review_queue
    from public, anon, authenticated;

grant select, insert, update, delete
    on table public.fhfh_player_identities
    to service_role;
grant select, insert, update, delete
    on table public.fhfh_player_external_identities
    to service_role;
grant select, insert, update, delete
    on table public.fhfh_player_identity_aliases
    to service_role;
grant select, insert, update, delete
    on table public.fhfh_player_organization_history
    to service_role;
grant select, insert, update, delete
    on table public.fhfh_player_identity_review_queue
    to service_role;

grant usage, select
    on sequence public.fhfh_player_identities_id_seq
    to service_role;

drop policy if exists fhfh_player_identities_deny_client_access
    on public.fhfh_player_identities;
create policy fhfh_player_identities_deny_client_access
on public.fhfh_player_identities
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists fhfh_player_external_deny_client_access
    on public.fhfh_player_external_identities;
create policy fhfh_player_external_deny_client_access
on public.fhfh_player_external_identities
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists fhfh_player_aliases_deny_client_access
    on public.fhfh_player_identity_aliases;
create policy fhfh_player_aliases_deny_client_access
on public.fhfh_player_identity_aliases
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists fhfh_player_organization_deny_client_access
    on public.fhfh_player_organization_history;
create policy fhfh_player_organization_deny_client_access
on public.fhfh_player_organization_history
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists fhfh_player_review_deny_client_access
    on public.fhfh_player_identity_review_queue;
create policy fhfh_player_review_deny_client_access
on public.fhfh_player_identity_review_queue
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

comment on table public.fhfh_player_identities is
    'Stable FHFH player identities. public.players remains the NHL-linked analytics record.';
comment on table public.fhfh_player_external_identities is
    'Provider- and context-aware mappings from FHFH identities to external player identifiers.';
comment on table public.fhfh_player_identity_aliases is
    'Verified and reviewable alternate names for FHFH player identities; aliases never define uniqueness.';
comment on table public.fhfh_player_organization_history is
    'Mutable team and development-organization history for stable FHFH player identities.';
comment on table public.fhfh_player_identity_review_queue is
    'Admin/service-only review queue for unresolved mappings, additions, conflicts, and merges.';
