-- DR-033 hardening: the UI has one resumable placement flow per ranking.
-- Prevent direct or concurrent API calls from stranding additional active
-- sessions that the ranking-level resume query cannot surface.

update public.draft_ranker_placement_sessions
set status = 'expired', completed_at = statement_timestamp()
where status = 'active' and expires_at <= statement_timestamp();

do $$
begin
    if exists (
        select 1
        from public.draft_ranker_placement_sessions
        where status = 'active'
        group by ranking_id
        having count(*) > 1
    ) then
        raise exception using
            errcode = '23505',
            message = 'Multiple active placement sessions must be resolved before enforcing ranking uniqueness';
    end if;
end;
$$;

create unique index draft_placement_one_active_per_ranking
    on public.draft_ranker_placement_sessions (ranking_id)
    where status = 'active';

create or replace function public.begin_draft_ranker_placement(
    p_user_id uuid,
    p_ranking_id uuid,
    p_fhfh_player_id bigint,
    p_expected_version bigint,
    p_operation_id uuid,
    p_operation_payload_hash text,
    p_state jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
    v_version bigint;
    v_existing_hash text;
    v_existing_result jsonb;
    v_active_session uuid;
    v_active_player bigint;
    v_session public.draft_ranker_placement_sessions%rowtype;
    v_result jsonb;
begin
    if p_user_id is null or p_ranking_id is null or p_fhfh_player_id is null
       or p_operation_id is null or p_expected_version is null
       or p_expected_version < 0 then
        raise exception using errcode = '22023', message = 'Valid owner, ranking, player, version, and operation are required';
    end if;
    if p_operation_payload_hash !~ '^[0-9a-f]{64}$' then
        raise exception using errcode = '22023', message = 'Operation payload hash must be lowercase SHA-256';
    end if;
    if jsonb_typeof(p_state) <> 'object'
       or jsonb_typeof(p_state->'issuedAnchors') <> 'array'
       or jsonb_typeof(p_state->'answers') <> 'array'
       or coalesce((p_state->>'intervalLow')::integer, 0) < 1
       or coalesce((p_state->>'intervalHigh')::integer, 0)
          < coalesce((p_state->>'intervalLow')::integer, 1)
       or coalesce((p_state->>'questionCount')::integer, -1) <> 0
       or jsonb_array_length(p_state->'issuedAnchors') <> 1
       or jsonb_array_length(p_state->'answers') <> 0 then
        raise exception using errcode = '22023', message = 'Invalid initial placement state';
    end if;

    select ranking.lock_version into v_version
    from public.draft_rankings ranking
    where ranking.id = p_ranking_id
      and ranking.user_id = p_user_id
      and ranking.status = 'active'
    for update;

    if v_version is null then
        return jsonb_build_object('status', 'not_found', 'code', 'ranking_not_found');
    end if;

    select event.metadata->>'operation_payload_hash', event.metadata->'result'
    into v_existing_hash, v_existing_result
    from public.draft_ranking_events event
    where event.ranking_id = p_ranking_id and event.operation_id = p_operation_id;
    if v_existing_hash is not null then
        if v_existing_hash <> p_operation_payload_hash then
            return jsonb_build_object('status', 'conflict', 'code', 'idempotency_conflict');
        end if;
        return coalesce(v_existing_result, '{}'::jsonb)
            || jsonb_build_object('idempotentReplay', true);
    end if;

    if v_version <> p_expected_version then
        return jsonb_build_object(
            'status', 'conflict', 'code', 'stale_ranking_version',
            'expectedVersion', p_expected_version, 'currentVersion', v_version
        );
    end if;

    update public.draft_ranker_placement_sessions
    set status = 'expired', completed_at = statement_timestamp()
    where ranking_id = p_ranking_id
      and status = 'active'
      and expires_at <= statement_timestamp();

    select session.id, session.fhfh_player_id
    into v_active_session, v_active_player
    from public.draft_ranker_placement_sessions session
    where session.ranking_id = p_ranking_id
      and session.status = 'active'
    order by session.updated_at desc
    limit 1;
    if v_active_session is not null then
        return jsonb_build_object(
            'status', 'conflict', 'code', 'active_placement_exists',
            'sessionId', v_active_session, 'playerId', v_active_player
        );
    end if;

    if not exists (
        select 1 from public.fhfh_player_identities identity
        where identity.id = p_fhfh_player_id
          and identity.verification_status = 'verified'
          and identity.lifecycle_status in (
              'active_nhl', 'active_prospect', 'unsigned_relevant'
          )
    ) then
        return jsonb_build_object('status', 'failed', 'code', 'player_not_rankable');
    end if;

    insert into public.draft_ranker_placement_sessions (
        user_id, ranking_id, fhfh_player_id, status, rough_range,
        interval_low, interval_high, plausible_low, plausible_high,
        question_count, contradiction_count, ranking_version,
        issued_anchors, answers, suggested_rank, expires_at,
        engine_version, confidence, completion_reason
    ) values (
        p_user_id, p_ranking_id, p_fhfh_player_id, 'active',
        p_state->>'roughRange',
        (p_state->>'intervalLow')::integer,
        (p_state->>'intervalHigh')::integer,
        nullif(p_state->>'plausibleLow', '')::integer,
        nullif(p_state->>'plausibleHigh', '')::integer,
        0, 0, v_version,
        p_state->'issuedAnchors', p_state->'answers',
        nullif(p_state->>'suggestedRank', '')::integer,
        statement_timestamp() + interval '7 days',
        'deterministic_v1', coalesce(p_state->>'confidence', 'developing'),
        nullif(p_state->>'completionReason', '')
    ) returning * into v_session;

    v_result := jsonb_build_object(
        'status', 'completed', 'sessionId', v_session.id,
        'rankingId', p_ranking_id, 'playerId', p_fhfh_player_id,
        'rankingVersion', v_version, 'idempotentReplay', false
    );
    insert into public.draft_ranking_events (
        ranking_id, user_id, fhfh_player_id, event_type, event_source,
        operation_id, expected_version, resulting_version,
        before_state, after_state, metadata
    ) values (
        p_ranking_id, p_user_id, p_fhfh_player_id,
        'assisted_placement_started', 'assisted_placement', p_operation_id,
        null, v_version, '{}'::jsonb,
        jsonb_build_object('sessionId', v_session.id),
        jsonb_build_object(
            'operation_payload_hash', p_operation_payload_hash,
            'engineVersion', 'deterministic_v1', 'result', v_result
        )
    );
    return v_result;
end;
$$;

comment on index public.draft_placement_one_active_per_ranking
is 'Ensures the ranking-level assisted-placement resume flow has at most one active session.';
comment on function public.begin_draft_ranker_placement(uuid,uuid,bigint,bigint,uuid,text,jsonb)
is 'Service-only deterministic placement start with one resumable active session per ranking.';

revoke all on function public.begin_draft_ranker_placement(uuid,uuid,bigint,bigint,uuid,text,jsonb)
from public, anon, authenticated;
grant execute on function public.begin_draft_ranker_placement(uuid,uuid,bigint,bigint,uuid,text,jsonb)
to service_role;
;
