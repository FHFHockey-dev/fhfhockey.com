-- DR-051: rebuildable, service-only Draft Ranker discovery snapshots.
-- Upstream projection, Yahoo, roster, contract, and deployment sources are
-- deliberately read-only. A completed run is the atomic serving boundary.

create table public.draft_ranker_discovery_refresh_runs (
    id uuid primary key default gen_random_uuid(),
    target_season_id bigint not null references public.seasons(id) on delete restrict,
    operation_id uuid not null unique,
    operation_payload_hash text not null,
    source_fingerprint text not null,
    algorithm_version text not null,
    status text not null default 'pending',
    requested_by uuid null references auth.users(id) on delete set null,
    source_summary jsonb not null default '{}'::jsonb,
    group_counts jsonb not null default '{}'::jsonb,
    warning_codes jsonb not null default '[]'::jsonb,
    error_summary jsonb not null default '{}'::jsonb,
    started_at timestamptz not null default now(),
    completed_at timestamptz null,
    constraint draft_discovery_run_hash_valid check (
        operation_payload_hash ~ '^[0-9a-f]{64}$'
        and source_fingerprint ~ '^[0-9a-f]{64}$'
    ),
    constraint draft_discovery_run_algorithm_nonblank check (
        nullif(btrim(algorithm_version), '') is not null
        and char_length(algorithm_version) <= 80
    ),
    constraint draft_discovery_run_status_valid check (
        status in ('pending', 'completed', 'failed')
    ),
    constraint draft_discovery_run_summary_objects check (
        jsonb_typeof(source_summary) = 'object'
        and jsonb_typeof(group_counts) = 'object'
        and jsonb_typeof(warning_codes) = 'array'
        and jsonb_typeof(error_summary) = 'object'
    ),
    constraint draft_discovery_run_completion_valid check (
        (status = 'pending' and completed_at is null)
        or (status in ('completed', 'failed') and completed_at is not null)
    )
);

create table public.draft_ranker_discovery_source_health (
    run_id uuid not null references public.draft_ranker_discovery_refresh_runs(id) on delete cascade,
    source_key text not null,
    health_state text not null,
    source_season_id bigint null,
    source_date date null,
    source_observed_at timestamptz null,
    expires_at timestamptz null,
    row_count integer not null default 0,
    mapped_player_count integer not null default 0,
    eligible_player_count integer not null default 0,
    warning_codes jsonb not null default '[]'::jsonb,
    metadata jsonb not null default '{}'::jsonb,
    primary key (run_id, source_key),
    constraint draft_discovery_health_key_nonblank check (
        nullif(btrim(source_key), '') is not null
        and char_length(source_key) <= 120
    ),
    constraint draft_discovery_health_state_valid check (
        health_state in (
            'available',
            'stale',
            'season_mismatch',
            'insufficient_sources',
            'unmapped',
            'unavailable'
        )
    ),
    constraint draft_discovery_health_counts_valid check (
        row_count >= 0
        and mapped_player_count >= 0
        and eligible_player_count >= 0
        and mapped_player_count <= row_count
        and eligible_player_count <= mapped_player_count
    ),
    constraint draft_discovery_health_json_valid check (
        jsonb_typeof(warning_codes) = 'array'
        and jsonb_typeof(metadata) = 'object'
    ),
    constraint draft_discovery_health_expiry_valid check (
        expires_at is null
        or source_observed_at is null
        or expires_at > source_observed_at
    )
);

create table public.draft_ranker_discovery_signals (
    id uuid primary key default gen_random_uuid(),
    run_id uuid not null references public.draft_ranker_discovery_refresh_runs(id) on delete cascade,
    target_season_id bigint not null references public.seasons(id) on delete restrict,
    fhfh_player_id bigint not null references public.fhfh_player_identities(id) on delete restrict,
    signal_type text not null,
    score numeric not null,
    reason_code text not null,
    reason_text text not null,
    source_keys text[] not null,
    source_date date null,
    source_observed_at timestamptz not null,
    expires_at timestamptz not null,
    algorithm_version text not null,
    evidence jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint draft_discovery_signal_run_player_type_unique
        unique (run_id, fhfh_player_id, signal_type),
    constraint draft_discovery_signal_type_valid check (
        signal_type in (
            'projection_gap',
            'previously_undrafted',
            'ownership_riser',
            'opportunity_change'
        )
    ),
    constraint draft_discovery_signal_score_finite check (
        score not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
    ),
    constraint draft_discovery_signal_reason_valid check (
        nullif(btrim(reason_code), '') is not null
        and char_length(reason_code) <= 120
        and nullif(btrim(reason_text), '') is not null
        and char_length(reason_text) <= 500
    ),
    constraint draft_discovery_signal_sources_valid check (
        cardinality(source_keys) > 0
        and array_position(source_keys, null) is null
    ),
    constraint draft_discovery_signal_algorithm_nonblank check (
        nullif(btrim(algorithm_version), '') is not null
        and char_length(algorithm_version) <= 80
    ),
    constraint draft_discovery_signal_expiry_valid check (
        expires_at > source_observed_at
    ),
    constraint draft_discovery_signal_evidence_object check (
        jsonb_typeof(evidence) = 'object'
    )
);

create table public.draft_ranker_discovery_projection_consensus (
    run_id uuid not null references public.draft_ranker_discovery_refresh_runs(id) on delete cascade,
    target_season_id bigint not null references public.seasons(id) on delete restrict,
    fhfh_player_id bigint not null references public.fhfh_player_identities(id) on delete restrict,
    consensus_rank numeric not null,
    source_count integer not null,
    source_keys text[] not null,
    source_observed_at timestamptz not null,
    expires_at timestamptz not null,
    evidence jsonb not null default '{}'::jsonb,
    primary key (run_id, fhfh_player_id),
    constraint draft_discovery_consensus_rank_valid check (
        consensus_rank > 0
        and consensus_rank not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
    ),
    constraint draft_discovery_consensus_sources_valid check (
        source_count >= 2
        and cardinality(source_keys) = source_count
        and array_position(source_keys, null) is null
    ),
    constraint draft_discovery_consensus_expiry_valid check (
        expires_at > source_observed_at
    ),
    constraint draft_discovery_consensus_evidence_object check (
        jsonb_typeof(evidence) = 'object'
    )
);

create index draft_discovery_runs_latest_completed
on public.draft_ranker_discovery_refresh_runs (
    target_season_id,
    completed_at desc,
    id
)
where status = 'completed';

create index draft_discovery_health_source_latest
on public.draft_ranker_discovery_source_health (source_key, run_id);

create index draft_discovery_signals_serve
on public.draft_ranker_discovery_signals (
    target_season_id,
    signal_type,
    score desc,
    fhfh_player_id
);

create index draft_discovery_signals_player
on public.draft_ranker_discovery_signals (fhfh_player_id, target_season_id);

create index draft_discovery_consensus_rank
on public.draft_ranker_discovery_projection_consensus (
    target_season_id,
    consensus_rank,
    fhfh_player_id
);

alter table public.draft_ranker_discovery_refresh_runs enable row level security;
alter table public.draft_ranker_discovery_source_health enable row level security;
alter table public.draft_ranker_discovery_signals enable row level security;
alter table public.draft_ranker_discovery_projection_consensus enable row level security;

revoke all on public.draft_ranker_discovery_refresh_runs from public, anon, authenticated;
revoke all on public.draft_ranker_discovery_source_health from public, anon, authenticated;
revoke all on public.draft_ranker_discovery_signals from public, anon, authenticated;
revoke all on public.draft_ranker_discovery_projection_consensus from public, anon, authenticated;
grant all on public.draft_ranker_discovery_refresh_runs to service_role;
grant all on public.draft_ranker_discovery_source_health to service_role;
grant all on public.draft_ranker_discovery_signals to service_role;
grant all on public.draft_ranker_discovery_projection_consensus to service_role;

create policy draft_discovery_runs_no_client_access
on public.draft_ranker_discovery_refresh_runs
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

create policy draft_discovery_health_no_client_access
on public.draft_ranker_discovery_source_health
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

create policy draft_discovery_signals_no_client_access
on public.draft_ranker_discovery_signals
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

create policy draft_discovery_consensus_no_client_access
on public.draft_ranker_discovery_projection_consensus
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

create or replace function public.replace_draft_ranker_discovery_snapshot(
    p_target_season_id bigint,
    p_operation_id uuid,
    p_operation_payload_hash text,
    p_source_fingerprint text,
    p_algorithm_version text,
    p_requested_by uuid,
    p_source_summary jsonb,
    p_group_counts jsonb,
    p_warning_codes jsonb,
    p_source_health jsonb,
    p_projection_consensus jsonb,
    p_signals jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
    v_run_id uuid;
    v_existing_payload_hash text;
    v_existing_status text;
    v_existing_group_counts jsonb;
    v_health_count integer;
    v_consensus_count integer;
    v_signal_count integer;
begin
    if p_target_season_id is null or p_operation_id is null then
        raise exception using errcode = '22023', message = 'target season and operation ID are required';
    end if;
    if p_operation_payload_hash is null
       or p_operation_payload_hash !~ '^[0-9a-f]{64}$'
       or p_source_fingerprint is null
       or p_source_fingerprint !~ '^[0-9a-f]{64}$' then
        raise exception using errcode = '22023', message = 'payload and source hashes must be lowercase SHA-256';
    end if;
    if nullif(btrim(p_algorithm_version), '') is null
       or char_length(p_algorithm_version) > 80 then
        raise exception using errcode = '22023', message = 'algorithm version is required';
    end if;
    if jsonb_typeof(coalesce(p_source_summary, '{}'::jsonb)) <> 'object'
       or jsonb_typeof(coalesce(p_group_counts, '{}'::jsonb)) <> 'object'
       or jsonb_typeof(coalesce(p_warning_codes, '[]'::jsonb)) <> 'array'
       or jsonb_typeof(coalesce(p_source_health, '[]'::jsonb)) <> 'array'
       or jsonb_typeof(coalesce(p_projection_consensus, '[]'::jsonb)) <> 'array'
       or jsonb_typeof(coalesce(p_signals, '[]'::jsonb)) <> 'array' then
        raise exception using errcode = '22023', message = 'discovery snapshot JSON has an invalid shape';
    end if;
    if jsonb_array_length(coalesce(p_source_health, '[]'::jsonb)) > 100
       or jsonb_array_length(coalesce(p_projection_consensus, '[]'::jsonb)) > 5000
       or jsonb_array_length(coalesce(p_signals, '[]'::jsonb)) > 10000 then
        raise exception using errcode = '22023', message = 'discovery snapshot exceeds supported bounds';
    end if;

    perform pg_advisory_xact_lock(
        hashtextextended('draft-ranker-discovery:' || p_target_season_id::text, 0)
    );

    select run.id, run.operation_payload_hash, run.status, run.group_counts
    into v_run_id, v_existing_payload_hash, v_existing_status, v_existing_group_counts
    from public.draft_ranker_discovery_refresh_runs run
    where run.operation_id = p_operation_id;

    if found then
        if v_existing_payload_hash <> p_operation_payload_hash then
            return jsonb_build_object(
                'status', 'conflict',
                'code', 'idempotency_conflict',
                'message', 'The operation ID was already used with a different discovery payload.'
            );
        end if;

        select count(*) into v_health_count
        from public.draft_ranker_discovery_source_health health
        where health.run_id = v_run_id;
        select count(*) into v_signal_count
        from public.draft_ranker_discovery_signals signal
        where signal.run_id = v_run_id;
        select count(*) into v_consensus_count
        from public.draft_ranker_discovery_projection_consensus consensus
        where consensus.run_id = v_run_id;

        return jsonb_build_object(
            'status', v_existing_status,
            'runId', v_run_id,
            'sourceHealthCount', v_health_count,
            'projectionConsensusCount', v_consensus_count,
            'signalCount', v_signal_count,
            'groupCounts', v_existing_group_counts,
            'idempotentReplay', true
        );
    end if;

    insert into public.draft_ranker_discovery_refresh_runs (
        target_season_id,
        operation_id,
        operation_payload_hash,
        source_fingerprint,
        algorithm_version,
        requested_by,
        source_summary,
        group_counts,
        warning_codes,
        status
    ) values (
        p_target_season_id,
        p_operation_id,
        p_operation_payload_hash,
        p_source_fingerprint,
        p_algorithm_version,
        p_requested_by,
        coalesce(p_source_summary, '{}'::jsonb),
        coalesce(p_group_counts, '{}'::jsonb),
        coalesce(p_warning_codes, '[]'::jsonb),
        'pending'
    ) returning id into v_run_id;

    insert into public.draft_ranker_discovery_source_health (
        run_id,
        source_key,
        health_state,
        source_season_id,
        source_date,
        source_observed_at,
        expires_at,
        row_count,
        mapped_player_count,
        eligible_player_count,
        warning_codes,
        metadata
    )
    select
        v_run_id,
        source.source_key,
        source.health_state,
        source.source_season_id,
        source.source_date,
        source.source_observed_at,
        source.expires_at,
        coalesce(source.row_count, 0),
        coalesce(source.mapped_player_count, 0),
        coalesce(source.eligible_player_count, 0),
        coalesce(source.warning_codes, '[]'::jsonb),
        coalesce(source.metadata, '{}'::jsonb)
    from jsonb_to_recordset(coalesce(p_source_health, '[]'::jsonb)) as source(
        source_key text,
        health_state text,
        source_season_id bigint,
        source_date date,
        source_observed_at timestamptz,
        expires_at timestamptz,
        row_count integer,
        mapped_player_count integer,
        eligible_player_count integer,
        warning_codes jsonb,
        metadata jsonb
    );
    get diagnostics v_health_count = row_count;

    insert into public.draft_ranker_discovery_projection_consensus (
        run_id,
        target_season_id,
        fhfh_player_id,
        consensus_rank,
        source_count,
        source_keys,
        source_observed_at,
        expires_at,
        evidence
    )
    select
        v_run_id,
        p_target_season_id,
        consensus.fhfh_player_id,
        consensus.consensus_rank,
        consensus.source_count,
        array(
            select jsonb_array_elements_text(consensus.source_keys)
        ),
        consensus.source_observed_at,
        consensus.expires_at,
        coalesce(consensus.evidence, '{}'::jsonb)
    from jsonb_to_recordset(coalesce(p_projection_consensus, '[]'::jsonb)) as consensus(
        fhfh_player_id bigint,
        consensus_rank numeric,
        source_count integer,
        source_keys jsonb,
        source_observed_at timestamptz,
        expires_at timestamptz,
        evidence jsonb
    );
    get diagnostics v_consensus_count = row_count;

    insert into public.draft_ranker_discovery_signals (
        run_id,
        target_season_id,
        fhfh_player_id,
        signal_type,
        score,
        reason_code,
        reason_text,
        source_keys,
        source_date,
        source_observed_at,
        expires_at,
        algorithm_version,
        evidence
    )
    select
        v_run_id,
        p_target_season_id,
        signal.fhfh_player_id,
        signal.signal_type,
        signal.score,
        signal.reason_code,
        signal.reason_text,
        array(
            select jsonb_array_elements_text(signal.source_keys)
        ),
        signal.source_date,
        signal.source_observed_at,
        signal.expires_at,
        p_algorithm_version,
        coalesce(signal.evidence, '{}'::jsonb)
    from jsonb_to_recordset(coalesce(p_signals, '[]'::jsonb)) as signal(
        fhfh_player_id bigint,
        signal_type text,
        score numeric,
        reason_code text,
        reason_text text,
        source_keys jsonb,
        source_date date,
        source_observed_at timestamptz,
        expires_at timestamptz,
        evidence jsonb
    );
    get diagnostics v_signal_count = row_count;

    update public.draft_ranker_discovery_refresh_runs
    set status = 'completed', completed_at = statement_timestamp()
    where id = v_run_id;

    return jsonb_build_object(
        'status', 'completed',
        'runId', v_run_id,
        'sourceHealthCount', v_health_count,
        'projectionConsensusCount', v_consensus_count,
        'signalCount', v_signal_count,
        'groupCounts', coalesce(p_group_counts, '{}'::jsonb),
        'idempotentReplay', false
    );
end;
$$;

revoke all on function public.replace_draft_ranker_discovery_snapshot(
    bigint, uuid, text, text, text, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.replace_draft_ranker_discovery_snapshot(
    bigint, uuid, text, text, text, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) to service_role;

comment on table public.draft_ranker_discovery_refresh_runs is
    'Service-only immutable refresh boundaries for rebuildable Draft Ranker discovery materializations.';
comment on table public.draft_ranker_discovery_source_health is
    'Per-refresh source season, freshness, coverage, and warning evidence; no owner context.';
comment on table public.draft_ranker_discovery_signals is
    'Rebuildable, explainable player discovery signals. Personal cutoff context is joined only in the owner API.';
comment on table public.draft_ranker_discovery_projection_consensus is
    'Per-refresh multi-source projection ranks used to derive private owner-relative cutoff and projection-gap signals at read time.';
comment on function public.replace_draft_ranker_discovery_snapshot(
    bigint, uuid, text, text, text, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) is 'Atomically persists one idempotent completed discovery snapshot from service-validated source evidence.';

-- Rollback before rollout: disable DRAFT_RANKER_DISCOVERY_ENABLED, stop the
-- refresh schedule, drop replace_draft_ranker_discovery_snapshot, then drop
-- the four rebuildable discovery tables. No upstream source is changed.
;
