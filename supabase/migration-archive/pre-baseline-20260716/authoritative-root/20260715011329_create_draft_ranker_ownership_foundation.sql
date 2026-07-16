-- DR-012: account-backed draft-ranker ownership and evidence foundation.
-- Additive only. Community aggregate/read-model tables are intentionally excluded.

create table public.draft_rankings (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    target_season_id bigint not null references public.seasons(id) on delete restrict,
    name text not null default 'My Draft Rankings',
    status text not null default 'active',
    is_default boolean not null default true,
    scoring_profile jsonb not null default '{}'::jsonb,
    external_context jsonb not null default '{}'::jsonb,
    schema_version integer not null default 1,
    seed_revision text null,
    lock_version bigint not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint draft_rankings_owner_key unique (id, user_id),
    constraint draft_rankings_owner_season_key unique (id, user_id, target_season_id),
    constraint draft_rankings_name_nonblank check (btrim(name) <> ''),
    constraint draft_rankings_status_valid check (status in ('active', 'archived')),
    constraint draft_rankings_scoring_object check (jsonb_typeof(scoring_profile) = 'object'),
    constraint draft_rankings_external_object check (jsonb_typeof(external_context) = 'object'),
    constraint draft_rankings_schema_positive check (schema_version > 0),
    constraint draft_rankings_lock_nonnegative check (lock_version >= 0),
    constraint draft_rankings_seed_nonblank check (seed_revision is null or btrim(seed_revision) <> '')
);

create unique index draft_rankings_one_active_default
    on public.draft_rankings (user_id, target_season_id)
    where status = 'active' and is_default;
create index draft_rankings_owner_season
    on public.draft_rankings (user_id, target_season_id, status);

create table public.draft_ranking_entries (
    ranking_id uuid not null,
    user_id uuid not null,
    fhfh_player_id bigint not null references public.fhfh_player_identities(id) on delete restrict,
    order_key bigint not null,
    seed_source text null,
    seed_adp numeric(10, 4) null,
    seed_rank integer null,
    tier text null,
    notes text null,
    first_interacted_at timestamptz null,
    last_interacted_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (ranking_id, fhfh_player_id),
    constraint draft_entries_ranking_owner_fk
        foreign key (ranking_id, user_id)
        references public.draft_rankings(id, user_id) on delete cascade,
    constraint draft_entries_order_unique unique (ranking_id, order_key),
    constraint draft_entries_seed_source_nonblank check (seed_source is null or btrim(seed_source) <> ''),
    constraint draft_entries_seed_adp_positive check (seed_adp is null or seed_adp > 0),
    constraint draft_entries_seed_rank_positive check (seed_rank is null or seed_rank > 0),
    constraint draft_entries_tier_nonblank check (tier is null or btrim(tier) <> ''),
    constraint draft_entries_interaction_order check (
        first_interacted_at is null
        or last_interacted_at is null
        or first_interacted_at <= last_interacted_at
    )
);

create index draft_entries_owner on public.draft_ranking_entries (user_id);
create index draft_entries_order on public.draft_ranking_entries (ranking_id, order_key, fhfh_player_id);
create index draft_entries_player on public.draft_ranking_entries (fhfh_player_id);

create table public.draft_ranking_events (
    id uuid primary key default gen_random_uuid(),
    ranking_id uuid not null,
    user_id uuid not null,
    fhfh_player_id bigint null references public.fhfh_player_identities(id) on delete restrict,
    event_type text not null,
    event_source text not null,
    operation_id uuid not null,
    expected_version bigint null,
    resulting_version bigint not null,
    before_state jsonb not null default '{}'::jsonb,
    after_state jsonb not null default '{}'::jsonb,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint draft_events_ranking_owner_fk
        foreign key (ranking_id, user_id)
        references public.draft_rankings(id, user_id) on delete cascade,
    constraint draft_events_operation_unique unique (ranking_id, operation_id),
    constraint draft_events_type_nonblank check (btrim(event_type) <> ''),
    constraint draft_events_source_nonblank check (btrim(event_source) <> ''),
    constraint draft_events_expected_nonnegative check (expected_version is null or expected_version >= 0),
    constraint draft_events_result_nonnegative check (resulting_version >= 0),
    constraint draft_events_versions_order check (expected_version is null or resulting_version > expected_version),
    constraint draft_events_before_object check (jsonb_typeof(before_state) = 'object'),
    constraint draft_events_after_object check (jsonb_typeof(after_state) = 'object'),
    constraint draft_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index draft_events_owner_created on public.draft_ranking_events (user_id, created_at desc);
create index draft_events_ranking_created on public.draft_ranking_events (ranking_id, created_at desc);
create index draft_events_player on public.draft_ranking_events (fhfh_player_id) where fhfh_player_id is not null;

create table public.draft_ranking_seed_runs (
    id uuid primary key default gen_random_uuid(),
    ranking_id uuid not null,
    user_id uuid not null,
    seed_revision text not null,
    source_season_id bigint not null references public.seasons(id) on delete restrict,
    status text not null default 'pending',
    source_count integer not null default 0,
    seeded_count integer not null default 0,
    invalid_adp_count integer not null default 0,
    unmapped_count integer not null default 0,
    fallback_count integer not null default 0,
    result_summary jsonb not null default '{}'::jsonb,
    error_summary jsonb not null default '{}'::jsonb,
    started_at timestamptz not null default now(),
    completed_at timestamptz null,
    created_at timestamptz not null default now(),
    constraint draft_seed_runs_ranking_owner_fk
        foreign key (ranking_id, user_id)
        references public.draft_rankings(id, user_id) on delete cascade,
    constraint draft_seed_runs_revision_unique unique (ranking_id, seed_revision),
    constraint draft_seed_runs_revision_nonblank check (btrim(seed_revision) <> ''),
    constraint draft_seed_runs_status_valid check (status in ('pending', 'completed', 'failed')),
    constraint draft_seed_runs_counts_nonnegative check (
        source_count >= 0 and seeded_count >= 0 and invalid_adp_count >= 0
        and unmapped_count >= 0 and fallback_count >= 0
    ),
    constraint draft_seed_runs_result_object check (jsonb_typeof(result_summary) = 'object'),
    constraint draft_seed_runs_error_object check (jsonb_typeof(error_summary) = 'object'),
    constraint draft_seed_runs_completion_valid check (
        (status = 'pending' and completed_at is null)
        or (status in ('completed', 'failed') and completed_at is not null)
    )
);

create index draft_seed_runs_owner on public.draft_ranking_seed_runs (user_id);
create index draft_seed_runs_status on public.draft_ranking_seed_runs (status, started_at);

create table public.draft_ranking_watchlist (
    ranking_id uuid not null,
    user_id uuid not null,
    fhfh_player_id bigint not null references public.fhfh_player_identities(id) on delete restrict,
    priority smallint null,
    note text null,
    source text not null default 'manual',
    reason text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (ranking_id, fhfh_player_id),
    constraint draft_watchlist_ranking_owner_fk
        foreign key (ranking_id, user_id)
        references public.draft_rankings(id, user_id) on delete cascade,
    constraint draft_watchlist_priority_valid check (priority is null or priority between 1 and 5),
    constraint draft_watchlist_source_nonblank check (btrim(source) <> '')
);

create index draft_watchlist_owner on public.draft_ranking_watchlist (user_id);
create index draft_watchlist_player on public.draft_ranking_watchlist (fhfh_player_id);

create table public.draft_ranker_contribution_preferences (
    user_id uuid primary key references auth.users(id) on delete cascade,
    contribution_enabled boolean not null default false,
    privacy_policy_version text null,
    consented_at timestamptz null,
    revoked_at timestamptz null,
    update_source text not null default 'account_settings',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint draft_contrib_policy_nonblank check (
        privacy_policy_version is null or btrim(privacy_policy_version) <> ''
    ),
    constraint draft_contrib_source_nonblank check (btrim(update_source) <> ''),
    constraint draft_contrib_state_valid check (
        (not contribution_enabled)
        or (privacy_policy_version is not null and consented_at is not null and revoked_at is null)
    )
);

create table public.draft_ranker_pair_prompts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    ranking_id uuid not null,
    season_id bigint not null references public.seasons(id) on delete restrict,
    low_player_id bigint not null references public.fhfh_player_identities(id) on delete restrict,
    high_player_id bigint not null references public.fhfh_player_identities(id) on delete restrict,
    queue_mode text not null,
    queue_reason text not null,
    algorithm_version text not null,
    status text not null default 'issued',
    issued_at timestamptz not null default now(),
    expires_at timestamptz not null,
    completed_at timestamptz null,
    metadata jsonb not null default '{}'::jsonb,
    constraint draft_pair_prompts_ranking_owner_fk
        foreign key (ranking_id, user_id, season_id)
        references public.draft_rankings(id, user_id, target_season_id) on delete cascade,
    constraint draft_pair_prompts_identity_key unique (
        id, user_id, ranking_id, season_id, low_player_id, high_player_id
    ),
    constraint draft_pair_prompts_canonical_pair check (low_player_id < high_player_id),
    constraint draft_pair_prompts_mode_nonblank check (btrim(queue_mode) <> ''),
    constraint draft_pair_prompts_reason_nonblank check (btrim(queue_reason) <> ''),
    constraint draft_pair_prompts_algorithm_nonblank check (btrim(algorithm_version) <> ''),
    constraint draft_pair_prompts_status_valid check (status in ('issued', 'completed', 'expired', 'cancelled')),
    constraint draft_pair_prompts_expiry_valid check (expires_at > issued_at),
    constraint draft_pair_prompts_completion_valid check (
        (status = 'completed' and completed_at is not null)
        or (status <> 'completed')
    ),
    constraint draft_pair_prompts_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index draft_pair_prompts_owner_status on public.draft_ranker_pair_prompts (user_id, status, issued_at desc);
create index draft_pair_prompts_ranking_status on public.draft_ranker_pair_prompts (ranking_id, status, issued_at desc);
create index draft_pair_prompts_pair on public.draft_ranker_pair_prompts (season_id, low_player_id, high_player_id);

create table public.draft_ranker_pair_comparisons (
    id uuid primary key default gen_random_uuid(),
    prompt_id uuid not null,
    user_id uuid not null,
    ranking_id uuid not null,
    season_id bigint not null references public.seasons(id) on delete restrict,
    low_player_id bigint not null references public.fhfh_player_identities(id) on delete restrict,
    high_player_id bigint not null references public.fhfh_player_identities(id) on delete restrict,
    outcome text not null,
    client_operation_id uuid not null,
    consent_enabled boolean not null default false,
    consent_policy_version text null,
    community_eligible boolean not null default false,
    community_ineligible_reason text null,
    ranking_version bigint not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint draft_pair_comps_ranking_owner_fk
        foreign key (ranking_id, user_id, season_id)
        references public.draft_rankings(id, user_id, target_season_id) on delete cascade,
    constraint draft_pair_comps_prompt_fk
        foreign key (
            prompt_id, user_id, ranking_id, season_id, low_player_id, high_player_id
        ) references public.draft_ranker_pair_prompts (
            id, user_id, ranking_id, season_id, low_player_id, high_player_id
        ) on delete restrict,
    constraint draft_pair_comps_operation_unique unique (user_id, client_operation_id),
    constraint draft_pair_comps_prompt_unique unique (prompt_id),
    constraint draft_pair_comps_identity_key unique (
        id, user_id, ranking_id, season_id, low_player_id, high_player_id
    ),
    constraint draft_pair_comps_canonical_pair check (low_player_id < high_player_id),
    constraint draft_pair_comps_outcome_valid check (outcome in ('low', 'high', 'too_close', 'skip')),
    constraint draft_pair_comps_policy_nonblank check (
        consent_policy_version is null or btrim(consent_policy_version) <> ''
    ),
    constraint draft_pair_comps_community_valid check (
        not community_eligible
        or (
            consent_enabled and consent_policy_version is not null
            and outcome in ('low', 'high')
        )
    ),
    constraint draft_pair_comps_reason_valid check (
        community_eligible or nullif(btrim(community_ineligible_reason), '') is not null
    ),
    constraint draft_pair_comps_version_nonnegative check (ranking_version >= 0),
    constraint draft_pair_comps_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index draft_pair_comps_owner_created on public.draft_ranker_pair_comparisons (user_id, created_at desc);
create index draft_pair_comps_ranking_created on public.draft_ranker_pair_comparisons (ranking_id, created_at desc);
create index draft_pair_comps_community_pair on public.draft_ranker_pair_comparisons
    (season_id, low_player_id, high_player_id, created_at desc)
    where community_eligible;

create table public.draft_ranker_pair_preferences (
    user_id uuid not null,
    ranking_id uuid not null,
    season_id bigint not null references public.seasons(id) on delete restrict,
    low_player_id bigint not null references public.fhfh_player_identities(id) on delete restrict,
    high_player_id bigint not null references public.fhfh_player_identities(id) on delete restrict,
    preferred_player_id bigint not null references public.fhfh_player_identities(id) on delete restrict,
    comparison_id uuid not null,
    established_at timestamptz not null,
    updated_at timestamptz not null default now(),
    primary key (user_id, ranking_id, season_id, low_player_id, high_player_id),
    constraint draft_pair_prefs_ranking_owner_fk
        foreign key (ranking_id, user_id, season_id)
        references public.draft_rankings(id, user_id, target_season_id) on delete cascade,
    constraint draft_pair_prefs_comparison_fk
        foreign key (
            comparison_id, user_id, ranking_id, season_id, low_player_id, high_player_id
        ) references public.draft_ranker_pair_comparisons (
            id, user_id, ranking_id, season_id, low_player_id, high_player_id
        ) on delete restrict,
    constraint draft_pair_prefs_canonical_pair check (low_player_id < high_player_id),
    constraint draft_pair_prefs_winner_valid check (preferred_player_id in (low_player_id, high_player_id))
);

create index draft_pair_prefs_ranking on public.draft_ranker_pair_preferences (ranking_id, updated_at desc);
create index draft_pair_prefs_comparison on public.draft_ranker_pair_preferences (comparison_id);
create index draft_pair_prefs_community on public.draft_ranker_pair_preferences (season_id, low_player_id, high_player_id);

create table public.draft_ranker_placement_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    ranking_id uuid not null,
    fhfh_player_id bigint not null references public.fhfh_player_identities(id) on delete restrict,
    status text not null default 'active',
    rough_range text null,
    interval_low integer not null,
    interval_high integer not null,
    plausible_low integer null,
    plausible_high integer null,
    question_count smallint not null default 0,
    contradiction_count smallint not null default 0,
    ranking_version bigint not null,
    issued_anchors jsonb not null default '[]'::jsonb,
    answers jsonb not null default '[]'::jsonb,
    suggested_rank integer null,
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    completed_at timestamptz null,
    constraint draft_placement_ranking_owner_fk
        foreign key (ranking_id, user_id)
        references public.draft_rankings(id, user_id) on delete cascade,
    constraint draft_placement_status_valid check (status in ('active', 'confirmed', 'cancelled', 'expired')),
    constraint draft_placement_range_valid check (
        interval_low > 0 and interval_high >= interval_low
        and (
            (plausible_low is null and plausible_high is null)
            or (
                plausible_low is not null and plausible_low > 0
                and plausible_high is not null and plausible_high >= plausible_low
            )
        )
    ),
    constraint draft_placement_counts_valid check (
        question_count between 0 and 16 and contradiction_count between 0 and 16
    ),
    constraint draft_placement_version_nonnegative check (ranking_version >= 0),
    constraint draft_placement_anchors_array check (jsonb_typeof(issued_anchors) = 'array'),
    constraint draft_placement_answers_array check (jsonb_typeof(answers) = 'array'),
    constraint draft_placement_suggested_positive check (suggested_rank is null or suggested_rank > 0),
    constraint draft_placement_expiry_valid check (expires_at > created_at),
    constraint draft_placement_completion_valid check (
        (status = 'active' and completed_at is null)
        or (status <> 'active' and completed_at is not null)
    )
);

create unique index draft_placement_one_active
    on public.draft_ranker_placement_sessions (ranking_id, fhfh_player_id)
    where status = 'active';
create index draft_placement_owner_status on public.draft_ranker_placement_sessions (user_id, status, updated_at desc);

create or replace function public.set_draft_ranker_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
    new.updated_at = statement_timestamp();
    return new;
end;
$$;

revoke all on function public.set_draft_ranker_updated_at() from public, anon, authenticated;
grant execute on function public.set_draft_ranker_updated_at() to service_role;

create trigger draft_rankings_touch_updated_at before update on public.draft_rankings
for each row execute function public.set_draft_ranker_updated_at();
create trigger draft_entries_touch_updated_at before update on public.draft_ranking_entries
for each row execute function public.set_draft_ranker_updated_at();
create trigger draft_watchlist_touch_updated_at before update on public.draft_ranking_watchlist
for each row execute function public.set_draft_ranker_updated_at();
create trigger draft_contrib_touch_updated_at before update on public.draft_ranker_contribution_preferences
for each row execute function public.set_draft_ranker_updated_at();
create trigger draft_pair_prefs_touch_updated_at before update on public.draft_ranker_pair_preferences
for each row execute function public.set_draft_ranker_updated_at();
create trigger draft_placement_touch_updated_at before update on public.draft_ranker_placement_sessions
for each row execute function public.set_draft_ranker_updated_at();

alter table public.draft_rankings enable row level security;
alter table public.draft_ranking_entries enable row level security;
alter table public.draft_ranking_events enable row level security;
alter table public.draft_ranking_seed_runs enable row level security;
alter table public.draft_ranking_watchlist enable row level security;
alter table public.draft_ranker_contribution_preferences enable row level security;
alter table public.draft_ranker_pair_prompts enable row level security;
alter table public.draft_ranker_pair_comparisons enable row level security;
alter table public.draft_ranker_pair_preferences enable row level security;
alter table public.draft_ranker_placement_sessions enable row level security;

revoke all on public.draft_rankings from anon, authenticated;
revoke all on public.draft_ranking_entries from anon, authenticated;
revoke all on public.draft_ranking_events from anon, authenticated;
revoke all on public.draft_ranking_seed_runs from anon, authenticated;
revoke all on public.draft_ranking_watchlist from anon, authenticated;
revoke all on public.draft_ranker_contribution_preferences from anon, authenticated;
revoke all on public.draft_ranker_pair_prompts from anon, authenticated;
revoke all on public.draft_ranker_pair_comparisons from anon, authenticated;
revoke all on public.draft_ranker_pair_preferences from anon, authenticated;
revoke all on public.draft_ranker_placement_sessions from anon, authenticated;

grant all on public.draft_rankings to service_role;
grant all on public.draft_ranking_entries to service_role;
grant all on public.draft_ranking_events to service_role;
grant all on public.draft_ranking_seed_runs to service_role;
grant all on public.draft_ranking_watchlist to service_role;
grant all on public.draft_ranker_contribution_preferences to service_role;
grant all on public.draft_ranker_pair_prompts to service_role;
grant all on public.draft_ranker_pair_comparisons to service_role;
grant all on public.draft_ranker_pair_preferences to service_role;
grant all on public.draft_ranker_placement_sessions to service_role;

-- Browser clients are read-only at the table layer. Mutations must pass through
-- the authenticated ranker API or a separately reviewed, narrowly granted RPC.
grant select on public.draft_rankings to authenticated;
grant select on public.draft_ranking_entries to authenticated;
grant select on public.draft_ranking_events to authenticated;
grant select on public.draft_ranking_seed_runs to authenticated;
grant select on public.draft_ranking_watchlist to authenticated;
grant select on public.draft_ranker_contribution_preferences to authenticated;
grant select on public.draft_ranker_pair_prompts to authenticated;
grant select on public.draft_ranker_pair_comparisons to authenticated;
grant select on public.draft_ranker_pair_preferences to authenticated;
grant select on public.draft_ranker_placement_sessions to authenticated;

create policy draft_rankings_owner_select on public.draft_rankings
for select to authenticated using ((select auth.uid()) = user_id);
create policy draft_rankings_owner_insert on public.draft_rankings
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy draft_rankings_owner_update on public.draft_rankings
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy draft_rankings_owner_delete on public.draft_rankings
for delete to authenticated using ((select auth.uid()) = user_id);

create policy draft_entries_owner_select on public.draft_ranking_entries
for select to authenticated using ((select auth.uid()) = user_id);
create policy draft_entries_owner_insert on public.draft_ranking_entries
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy draft_entries_owner_update on public.draft_ranking_entries
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy draft_entries_owner_delete on public.draft_ranking_entries
for delete to authenticated using ((select auth.uid()) = user_id);

create policy draft_events_owner_select on public.draft_ranking_events
for select to authenticated using ((select auth.uid()) = user_id);
create policy draft_seed_runs_owner_select on public.draft_ranking_seed_runs
for select to authenticated using ((select auth.uid()) = user_id);

create policy draft_watchlist_owner_select on public.draft_ranking_watchlist
for select to authenticated using ((select auth.uid()) = user_id);
create policy draft_watchlist_owner_insert on public.draft_ranking_watchlist
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy draft_watchlist_owner_update on public.draft_ranking_watchlist
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy draft_watchlist_owner_delete on public.draft_ranking_watchlist
for delete to authenticated using ((select auth.uid()) = user_id);

create policy draft_contrib_owner_select on public.draft_ranker_contribution_preferences
for select to authenticated using ((select auth.uid()) = user_id);
create policy draft_contrib_owner_insert on public.draft_ranker_contribution_preferences
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy draft_contrib_owner_update on public.draft_ranker_contribution_preferences
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy draft_contrib_owner_delete on public.draft_ranker_contribution_preferences
for delete to authenticated using ((select auth.uid()) = user_id);

create policy draft_prompts_owner_select on public.draft_ranker_pair_prompts
for select to authenticated using ((select auth.uid()) = user_id);
create policy draft_comparisons_owner_select on public.draft_ranker_pair_comparisons
for select to authenticated using ((select auth.uid()) = user_id);
create policy draft_preferences_owner_select on public.draft_ranker_pair_preferences
for select to authenticated using ((select auth.uid()) = user_id);
create policy draft_placement_owner_select on public.draft_ranker_placement_sessions
for select to authenticated using ((select auth.uid()) = user_id);

comment on table public.draft_rankings is 'Versioned account-owned personal NHL draft ranking sets.';
comment on table public.draft_ranking_entries is 'Continuous sparse ordering; top-250 membership is derived, never stored.';
comment on table public.draft_ranking_events is 'Immutable audit history for personal-ranking mutations.';
comment on table public.draft_ranker_pair_comparisons is 'Immutable prompt-issued pairwise submissions; direct edits are not community votes.';
comment on table public.draft_ranker_pair_preferences is 'Latest explicit personal preference for one canonical player pair.';
