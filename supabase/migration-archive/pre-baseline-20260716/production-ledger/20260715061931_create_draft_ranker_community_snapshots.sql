-- DR-061: immutable, aggregate-only Community Ranking snapshots.
-- Raw comparisons, consent, account IDs, and moderation evidence stay private.
-- The public product reads only completed snapshots through a flag-protected API.

create table public.draft_ranker_community_refresh_runs (
    id uuid primary key default gen_random_uuid(),
    target_season_id bigint not null references public.seasons(id) on delete restrict,
    operation_id uuid not null unique,
    operation_payload_hash text not null,
    source_fingerprint text not null,
    model_version text not null,
    status text not null default 'completed',
    requested_by uuid null references auth.users(id) on delete set null,
    source_summary jsonb not null default '{}'::jsonb,
    exclusion_summary jsonb not null default '{}'::jsonb,
    accepted_comparison_count integer not null default 0,
    excluded_comparison_count integer not null default 0,
    deduplicated_comparison_count integer not null default 0,
    started_at timestamptz not null default now(),
    completed_at timestamptz not null default now(),
    constraint draft_community_run_hash_valid check (
        operation_payload_hash ~ '^[0-9a-f]{64}$'
        and source_fingerprint ~ '^[0-9a-f]{64}$'
    ),
    constraint draft_community_run_model_nonblank check (
        nullif(btrim(model_version), '') is not null
        and char_length(model_version) <= 80
    ),
    constraint draft_community_run_status_valid check (status = 'completed'),
    constraint draft_community_run_counts_valid check (
        accepted_comparison_count >= 0
        and excluded_comparison_count >= 0
        and deduplicated_comparison_count >= 0
    ),
    constraint draft_community_run_json_valid check (
        jsonb_typeof(source_summary) = 'object'
        and jsonb_typeof(exclusion_summary) = 'object'
    ),
    constraint draft_community_run_completion_valid check (
        completed_at >= started_at
    )
);

create table public.draft_ranker_community_snapshots (
    id uuid primary key default gen_random_uuid(),
    run_id uuid not null unique
        references public.draft_ranker_community_refresh_runs(id) on delete restrict,
    target_season_id bigint not null references public.seasons(id) on delete restrict,
    previous_snapshot_id uuid null
        references public.draft_ranker_community_snapshots(id) on delete set null,
    snapshot_as_of timestamptz not null,
    cadence text not null,
    model_version text not null,
    source_fingerprint text not null,
    player_count integer not null,
    public_display_count integer not null,
    public_top250_count integer not null,
    published_at timestamptz not null default now(),
    metadata jsonb not null default '{}'::jsonb,
    constraint draft_community_snapshot_identity_unique unique (
        id, target_season_id
    ),
    constraint draft_community_snapshot_source_unique unique (
        target_season_id, snapshot_as_of, model_version, source_fingerprint
    ),
    constraint draft_community_snapshot_cadence_valid check (
        cadence in ('daily', 'weekly', 'manual')
    ),
    constraint draft_community_snapshot_model_nonblank check (
        nullif(btrim(model_version), '') is not null
        and char_length(model_version) <= 80
    ),
    constraint draft_community_snapshot_hash_valid check (
        source_fingerprint ~ '^[0-9a-f]{64}$'
    ),
    constraint draft_community_snapshot_counts_valid check (
        player_count >= 0
        and public_display_count between 0 and player_count
        and public_top250_count between 0 and least(250, public_display_count)
    ),
    constraint draft_community_snapshot_metadata_object check (
        jsonb_typeof(metadata) = 'object'
    )
);

create table public.draft_ranker_community_player_results (
    snapshot_id uuid not null
        references public.draft_ranker_community_snapshots(id) on delete restrict,
    target_season_id bigint not null references public.seasons(id) on delete restrict,
    fhfh_player_id bigint not null
        references public.fhfh_player_identities(id) on delete restrict,
    model_rank integer not null,
    public_rank integer null,
    model_score numeric not null,
    market_rank numeric null,
    prior_state text not null,
    market_prior_weight numeric not null,
    evidence_state text not null,
    confidence_label text not null,
    independent_users integer not null,
    comparison_count integer not null,
    distinct_opponents integer not null,
    cutoff_opponents_inside integer not null,
    cutoff_opponents_outside integer not null,
    stability_buffer_ranks integer not null,
    conservative_rank integer not null,
    public_display_eligible boolean not null,
    public_top250_eligible boolean not null,
    admission_basis text null,
    previous_public_rank integer null,
    rank_delta integer null,
    last_evidence_at timestamptz null,
    metadata jsonb not null default '{}'::jsonb,
    primary key (snapshot_id, fhfh_player_id),
    constraint draft_community_result_snapshot_season_fk
        foreign key (snapshot_id, target_season_id)
        references public.draft_ranker_community_snapshots(id, target_season_id)
        on delete restrict,
    constraint draft_community_result_model_rank_unique unique (snapshot_id, model_rank),
    constraint draft_community_result_ranks_valid check (
        model_rank > 0
        and (public_rank is null or public_rank between 1 and 250)
        and (market_rank is null or market_rank > 0)
        and (previous_public_rank is null or previous_public_rank between 1 and 250)
    ),
    constraint draft_community_result_score_finite check (
        model_score not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
    ),
    constraint draft_community_result_prior_state_valid check (
        prior_state in ('market_ranked', 'previously_undrafted')
    ),
    constraint draft_community_result_prior_weight_valid check (
        market_prior_weight >= 0
    ),
    constraint draft_community_result_evidence_state_valid check (
        evidence_state in ('market_seeded', 'building', 'emerging', 'established')
    ),
    constraint draft_community_result_confidence_valid check (
        confidence_label in ('market prior', 'building', 'limited', 'established')
    ),
    constraint draft_community_result_counts_valid check (
        independent_users >= 0
        and comparison_count >= 0
        and distinct_opponents >= 0
        and cutoff_opponents_inside >= 0
        and cutoff_opponents_outside >= 0
        and cutoff_opponents_inside + cutoff_opponents_outside <= distinct_opponents
        and stability_buffer_ranks >= 0
        and conservative_rank >= model_rank
    ),
    constraint draft_community_result_display_valid check (
        public_rank is null
        or (public_display_eligible and public_top250_eligible)
    ),
    constraint draft_community_result_admission_valid check (
        (public_top250_eligible and admission_basis in ('market_prior', 'community_evidence'))
        or (not public_top250_eligible and admission_basis is null)
    ),
    constraint draft_community_result_metadata_object check (
        jsonb_typeof(metadata) = 'object'
    )
);

create table public.draft_ranker_community_moderation_exclusions (
    id uuid primary key default gen_random_uuid(),
    target_season_id bigint not null references public.seasons(id) on delete restrict,
    exclusion_scope text not null,
    user_id uuid null references auth.users(id) on delete cascade,
    comparison_id uuid null
        references public.draft_ranker_pair_comparisons(id) on delete cascade,
    low_player_id bigint null references public.fhfh_player_identities(id) on delete cascade,
    high_player_id bigint null references public.fhfh_player_identities(id) on delete cascade,
    reason_code text not null,
    active boolean not null default true,
    expires_at timestamptz null,
    created_by uuid null references auth.users(id) on delete set null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint draft_community_exclusion_scope_valid check (
        exclusion_scope in ('user', 'comparison', 'pair')
    ),
    constraint draft_community_exclusion_target_valid check (
        (exclusion_scope = 'user' and user_id is not null and comparison_id is null
            and low_player_id is null and high_player_id is null)
        or (exclusion_scope = 'comparison' and user_id is null and comparison_id is not null
            and low_player_id is null and high_player_id is null)
        or (exclusion_scope = 'pair' and user_id is null and comparison_id is null
            and low_player_id is not null and high_player_id is not null
            and low_player_id < high_player_id)
    ),
    constraint draft_community_exclusion_reason_valid check (
        nullif(btrim(reason_code), '') is not null
        and char_length(reason_code) <= 120
    ),
    constraint draft_community_exclusion_expiry_valid check (
        expires_at is null or expires_at > created_at
    ),
    constraint draft_community_exclusion_metadata_object check (
        jsonb_typeof(metadata) = 'object'
    )
);

create index draft_community_runs_latest
on public.draft_ranker_community_refresh_runs (
    target_season_id, completed_at desc, id
);

create index draft_community_runs_requested_by
on public.draft_ranker_community_refresh_runs (requested_by)
where requested_by is not null;

create index draft_community_snapshots_latest
on public.draft_ranker_community_snapshots (
    target_season_id, published_at desc, id
);

create index draft_community_snapshots_previous
on public.draft_ranker_community_snapshots (previous_snapshot_id)
where previous_snapshot_id is not null;

create unique index draft_community_results_public_rank
on public.draft_ranker_community_player_results (snapshot_id, public_rank)
where public_rank is not null;

create index draft_community_results_public_serve
on public.draft_ranker_community_player_results (
    snapshot_id, public_rank, fhfh_player_id
)
where public_rank is not null;

create index draft_community_results_emerging
on public.draft_ranker_community_player_results (
    snapshot_id, evidence_state, model_rank, fhfh_player_id
)
where public_display_eligible;

create index draft_community_results_player_history
on public.draft_ranker_community_player_results (
    fhfh_player_id, target_season_id, snapshot_id
);

create index draft_community_results_season_snapshot
on public.draft_ranker_community_player_results (target_season_id, snapshot_id);

create index draft_community_exclusions_active_user
on public.draft_ranker_community_moderation_exclusions (
    target_season_id, user_id
)
where active and user_id is not null;

create index draft_community_exclusions_active_comparison
on public.draft_ranker_community_moderation_exclusions (
    target_season_id, comparison_id
)
where active and comparison_id is not null;

create index draft_community_exclusions_active_pair
on public.draft_ranker_community_moderation_exclusions (
    target_season_id, low_player_id, high_player_id
)
where active and low_player_id is not null;

create index draft_community_exclusions_created_by
on public.draft_ranker_community_moderation_exclusions (created_by)
where created_by is not null;

alter table public.draft_ranker_community_refresh_runs enable row level security;
alter table public.draft_ranker_community_snapshots enable row level security;
alter table public.draft_ranker_community_player_results enable row level security;
alter table public.draft_ranker_community_moderation_exclusions enable row level security;

revoke all on public.draft_ranker_community_refresh_runs from public, anon, authenticated;
revoke all on public.draft_ranker_community_snapshots from public, anon, authenticated;
revoke all on public.draft_ranker_community_player_results from public, anon, authenticated;
revoke all on public.draft_ranker_community_moderation_exclusions from public, anon, authenticated;
grant all on public.draft_ranker_community_refresh_runs to service_role;
grant all on public.draft_ranker_community_snapshots to service_role;
grant all on public.draft_ranker_community_player_results to service_role;
grant all on public.draft_ranker_community_moderation_exclusions to service_role;

create policy draft_community_runs_no_client_access
on public.draft_ranker_community_refresh_runs
as restrictive for all to anon, authenticated using (false) with check (false);

create policy draft_community_snapshots_no_client_access
on public.draft_ranker_community_snapshots
as restrictive for all to anon, authenticated using (false) with check (false);

create policy draft_community_results_no_client_access
on public.draft_ranker_community_player_results
as restrictive for all to anon, authenticated using (false) with check (false);

create policy draft_community_exclusions_no_client_access
on public.draft_ranker_community_moderation_exclusions
as restrictive for all to anon, authenticated using (false) with check (false);

create or replace function public.replace_draft_ranker_community_snapshot(
    p_target_season_id bigint,
    p_snapshot_as_of timestamptz,
    p_cadence text,
    p_model_version text,
    p_operation_id uuid,
    p_operation_payload_hash text,
    p_source_fingerprint text,
    p_requested_by uuid,
    p_source_summary jsonb,
    p_exclusion_summary jsonb,
    p_accepted_comparison_count integer,
    p_excluded_comparison_count integer,
    p_deduplicated_comparison_count integer,
    p_results jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
    v_run_id uuid;
    v_snapshot_id uuid;
    v_previous_snapshot_id uuid;
    v_existing_hash text;
    v_existing_snapshot_id uuid;
    v_player_count integer;
    v_public_display_count integer;
    v_public_top250_count integer;
begin
    if p_target_season_id is null or p_snapshot_as_of is null
       or p_operation_id is null then
        raise exception using errcode = '22023',
            message = 'target season, snapshot time, and operation ID are required';
    end if;
    if p_cadence not in ('daily', 'weekly', 'manual') then
        raise exception using errcode = '22023', message = 'unsupported snapshot cadence';
    end if;
    if nullif(btrim(p_model_version), '') is null
       or char_length(p_model_version) > 80 then
        raise exception using errcode = '22023', message = 'model version is required';
    end if;
    if p_operation_payload_hash is null
       or p_operation_payload_hash !~ '^[0-9a-f]{64}$'
       or p_source_fingerprint is null
       or p_source_fingerprint !~ '^[0-9a-f]{64}$' then
        raise exception using errcode = '22023',
            message = 'payload and source hashes must be lowercase SHA-256';
    end if;
    if jsonb_typeof(coalesce(p_source_summary, '{}'::jsonb)) <> 'object'
       or jsonb_typeof(coalesce(p_exclusion_summary, '{}'::jsonb)) <> 'object'
       or jsonb_typeof(coalesce(p_results, '[]'::jsonb)) <> 'array' then
        raise exception using errcode = '22023', message = 'community snapshot JSON has an invalid shape';
    end if;
    if jsonb_array_length(coalesce(p_results, '[]'::jsonb)) > 10000 then
        raise exception using errcode = '22023', message = 'community snapshot exceeds supported bounds';
    end if;
    if p_accepted_comparison_count < 0 or p_excluded_comparison_count < 0
       or p_deduplicated_comparison_count < 0 then
        raise exception using errcode = '22023', message = 'community evidence counts must be nonnegative';
    end if;

    perform pg_advisory_xact_lock(
        hashtextextended('draft-ranker-community:' || p_target_season_id::text, 0)
    );

    select run.id, run.operation_payload_hash, snapshot.id
    into v_run_id, v_existing_hash, v_existing_snapshot_id
    from public.draft_ranker_community_refresh_runs run
    join public.draft_ranker_community_snapshots snapshot on snapshot.run_id = run.id
    where run.operation_id = p_operation_id;

    if found then
        if v_existing_hash <> p_operation_payload_hash then
            return jsonb_build_object(
                'status', 'conflict',
                'code', 'idempotency_conflict',
                'message', 'The operation ID was already used with a different community payload.'
            );
        end if;
        select snapshot.player_count, snapshot.public_display_count,
               snapshot.public_top250_count
        into v_player_count, v_public_display_count, v_public_top250_count
        from public.draft_ranker_community_snapshots snapshot
        where snapshot.id = v_existing_snapshot_id;
        return jsonb_build_object(
            'status', 'completed',
            'runId', v_run_id,
            'snapshotId', v_existing_snapshot_id,
            'playerCount', v_player_count,
            'publicDisplayCount', v_public_display_count,
            'publicTop250Count', v_public_top250_count,
            'idempotentReplay', true,
            'sourceReplay', false
        );
    end if;

    select snapshot.run_id, snapshot.id, snapshot.player_count,
           snapshot.public_display_count, snapshot.public_top250_count
    into v_run_id, v_existing_snapshot_id, v_player_count,
         v_public_display_count, v_public_top250_count
    from public.draft_ranker_community_snapshots snapshot
    where snapshot.target_season_id = p_target_season_id
      and snapshot.snapshot_as_of = p_snapshot_as_of
      and snapshot.model_version = p_model_version
      and snapshot.source_fingerprint = p_source_fingerprint;

    if found then
        return jsonb_build_object(
            'status', 'completed',
            'runId', v_run_id,
            'snapshotId', v_existing_snapshot_id,
            'playerCount', v_player_count,
            'publicDisplayCount', v_public_display_count,
            'publicTop250Count', v_public_top250_count,
            'idempotentReplay', false,
            'sourceReplay', true
        );
    end if;

    select snapshot.id into v_previous_snapshot_id
    from public.draft_ranker_community_snapshots snapshot
    where snapshot.target_season_id = p_target_season_id
    order by snapshot.published_at desc, snapshot.id desc
    limit 1;

    insert into public.draft_ranker_community_refresh_runs (
        target_season_id, operation_id, operation_payload_hash,
        source_fingerprint, model_version, requested_by,
        source_summary, exclusion_summary,
        accepted_comparison_count, excluded_comparison_count,
        deduplicated_comparison_count, status, completed_at
    ) values (
        p_target_season_id, p_operation_id, p_operation_payload_hash,
        p_source_fingerprint, btrim(p_model_version), p_requested_by,
        coalesce(p_source_summary, '{}'::jsonb),
        coalesce(p_exclusion_summary, '{}'::jsonb),
        p_accepted_comparison_count, p_excluded_comparison_count,
        p_deduplicated_comparison_count, 'completed', statement_timestamp()
    ) returning id into v_run_id;

    v_player_count := jsonb_array_length(coalesce(p_results, '[]'::jsonb));
    select count(*) filter (where coalesce((result->>'public_display_eligible')::boolean, false)),
           count(*) filter (where result->>'public_rank' is not null)
    into v_public_display_count, v_public_top250_count
    from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) result;

    insert into public.draft_ranker_community_snapshots (
        run_id, target_season_id, previous_snapshot_id, snapshot_as_of,
        cadence, model_version, source_fingerprint, player_count,
        public_display_count, public_top250_count, metadata
    ) values (
        v_run_id, p_target_season_id, v_previous_snapshot_id, p_snapshot_as_of,
        p_cadence, btrim(p_model_version), p_source_fingerprint, v_player_count,
        v_public_display_count, v_public_top250_count,
        jsonb_build_object(
            'acceptedComparisonCount', p_accepted_comparison_count,
            'excludedComparisonCount', p_excluded_comparison_count,
            'deduplicatedComparisonCount', p_deduplicated_comparison_count
        )
    ) returning id into v_snapshot_id;

    insert into public.draft_ranker_community_player_results (
        snapshot_id, target_season_id, fhfh_player_id,
        model_rank, public_rank, model_score, market_rank, prior_state,
        market_prior_weight, evidence_state, confidence_label,
        independent_users, comparison_count, distinct_opponents,
        cutoff_opponents_inside, cutoff_opponents_outside,
        stability_buffer_ranks, conservative_rank,
        public_display_eligible, public_top250_eligible, admission_basis,
        previous_public_rank, rank_delta, last_evidence_at, metadata
    )
    select
        v_snapshot_id, p_target_season_id, result.fhfh_player_id,
        result.model_rank, result.public_rank, result.model_score,
        result.market_rank, result.prior_state, result.market_prior_weight,
        result.evidence_state, result.confidence_label,
        result.independent_users, result.comparison_count,
        result.distinct_opponents, result.cutoff_opponents_inside,
        result.cutoff_opponents_outside, result.stability_buffer_ranks,
        result.conservative_rank, result.public_display_eligible,
        result.public_top250_eligible, result.admission_basis,
        result.previous_public_rank, result.rank_delta,
        result.last_evidence_at, coalesce(result.metadata, '{}'::jsonb)
    from jsonb_to_recordset(coalesce(p_results, '[]'::jsonb)) as result(
        fhfh_player_id bigint,
        model_rank integer,
        public_rank integer,
        model_score numeric,
        market_rank numeric,
        prior_state text,
        market_prior_weight numeric,
        evidence_state text,
        confidence_label text,
        independent_users integer,
        comparison_count integer,
        distinct_opponents integer,
        cutoff_opponents_inside integer,
        cutoff_opponents_outside integer,
        stability_buffer_ranks integer,
        conservative_rank integer,
        public_display_eligible boolean,
        public_top250_eligible boolean,
        admission_basis text,
        previous_public_rank integer,
        rank_delta integer,
        last_evidence_at timestamptz,
        metadata jsonb
    );

    return jsonb_build_object(
        'status', 'completed',
        'runId', v_run_id,
        'snapshotId', v_snapshot_id,
        'previousSnapshotId', v_previous_snapshot_id,
        'playerCount', v_player_count,
        'publicDisplayCount', v_public_display_count,
        'publicTop250Count', v_public_top250_count,
        'idempotentReplay', false,
        'sourceReplay', false
    );
end;
$$;

revoke all on function public.replace_draft_ranker_community_snapshot(
    bigint, timestamptz, text, text, uuid, text, text, uuid,
    jsonb, jsonb, integer, integer, integer, jsonb
) from public, anon, authenticated;
grant execute on function public.replace_draft_ranker_community_snapshot(
    bigint, timestamptz, text, text, uuid, text, text, uuid,
    jsonb, jsonb, integer, integer, integer, jsonb
) to service_role;

comment on table public.draft_ranker_community_player_results is
    'Immutable aggregate-only Community Ranking results; contains no account identifiers or user histories.';
comment on table public.draft_ranker_community_moderation_exclusions is
    'Service-only operational exclusions; never exposed through public Community Ranking APIs.';
comment on function public.replace_draft_ranker_community_snapshot(
    bigint, timestamptz, text, text, uuid, text, text, uuid,
    jsonb, jsonb, integer, integer, integer, jsonb
) is 'Atomically publishes an idempotent versioned Community Ranking snapshot under a per-season advisory lock.';

-- Rollback before public rollout: disable COMMUNITY_DRAFT_RANKINGS_ENABLED,
-- stop the refresh schedule, drop the service-only function, then drop the four
-- additive Community Ranking tables. Raw personal rankings and comparisons are
-- unchanged. After rollout, retain immutable snapshots and publish a corrected
-- newer snapshot instead of rewriting history.
;
