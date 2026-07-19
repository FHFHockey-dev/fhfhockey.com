-- DR-032: persisted deterministic assisted placement and atomic confirmation.
-- Live migration ledger version: 20260715032036.

alter table public.draft_ranker_placement_sessions
    add column engine_version text not null default 'deterministic_v1',
    add column confidence text not null default 'developing',
    add column completion_reason text null,
    add constraint draft_placement_rough_range_valid check (
        rough_range is null or rough_range in (
            'top_50', '51_100', '101_150', '151_200',
            '201_250', 'outside_250', 'unsure'
        )
    ),
    add constraint draft_placement_engine_version_nonblank check (
        btrim(engine_version) <> ''
    ),
    add constraint draft_placement_confidence_valid check (
        confidence in ('developing', 'moderate', 'strong')
    ),
    add constraint draft_placement_ready_state_valid check (
        (suggested_rank is null and completion_reason is null)
        or (suggested_rank is not null and nullif(btrim(completion_reason), '') is not null)
    );

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

    select session.id into v_active_session
    from public.draft_ranker_placement_sessions session
    where session.ranking_id = p_ranking_id
      and session.fhfh_player_id = p_fhfh_player_id
      and session.status = 'active';
    if v_active_session is not null then
        return jsonb_build_object(
            'status', 'conflict', 'code', 'active_placement_exists',
            'sessionId', v_active_session
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

create or replace function public.advance_draft_ranker_placement(
    p_user_id uuid,
    p_session_id uuid,
    p_expected_question_count integer,
    p_expected_anchor_player_id bigint,
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
    v_session public.draft_ranker_placement_sessions%rowtype;
    v_current_version bigint;
    v_existing_hash text;
    v_existing_result jsonb;
    v_result jsonb;
begin
    if p_user_id is null or p_session_id is null or p_operation_id is null
       or p_expected_question_count < 0 or p_expected_anchor_player_id is null
       or p_operation_payload_hash !~ '^[0-9a-f]{64}$' then
        raise exception using errcode = '22023', message = 'Invalid placement advance request';
    end if;
    if jsonb_typeof(p_state) <> 'object'
       or jsonb_typeof(p_state->'issuedAnchors') <> 'array'
       or jsonb_typeof(p_state->'answers') <> 'array'
       or (p_state->>'questionCount')::integer <> p_expected_question_count + 1
       or jsonb_array_length(p_state->'answers') <> p_expected_question_count + 1
       or (p_state->>'intervalLow')::integer < 1
       or (p_state->>'intervalHigh')::integer < (p_state->>'intervalLow')::integer then
        raise exception using errcode = '22023', message = 'Invalid next placement state';
    end if;

    select session.* into v_session
    from public.draft_ranker_placement_sessions session
    where session.id = p_session_id and session.user_id = p_user_id
    for update;
    if not found then
        return jsonb_build_object('status', 'not_found', 'code', 'placement_not_found');
    end if;

    select event.metadata->>'operation_payload_hash', event.metadata->'result'
    into v_existing_hash, v_existing_result
    from public.draft_ranking_events event
    where event.ranking_id = v_session.ranking_id
      and event.operation_id = p_operation_id;
    if v_existing_hash is not null then
        if v_existing_hash <> p_operation_payload_hash then
            return jsonb_build_object('status', 'conflict', 'code', 'idempotency_conflict');
        end if;
        return coalesce(v_existing_result, '{}'::jsonb)
            || jsonb_build_object('idempotentReplay', true);
    end if;

    if v_session.status <> 'active' then
        return jsonb_build_object('status', 'conflict', 'code', 'placement_not_active');
    end if;
    if v_session.expires_at <= statement_timestamp() then
        update public.draft_ranker_placement_sessions
        set status = 'expired', completed_at = statement_timestamp()
        where id = p_session_id;
        return jsonb_build_object('status', 'failed', 'code', 'placement_expired');
    end if;

    select ranking.lock_version into v_current_version
    from public.draft_rankings ranking
    where ranking.id = v_session.ranking_id and ranking.user_id = p_user_id
    for update;
    if v_current_version is distinct from v_session.ranking_version then
        return jsonb_build_object(
            'status', 'conflict', 'code', 'stale_ranking_version',
            'expectedVersion', v_session.ranking_version,
            'currentVersion', v_current_version
        );
    end if;
    if v_session.question_count <> p_expected_question_count
       or (v_session.issued_anchors->-1->>'playerId')::bigint
          <> p_expected_anchor_player_id then
        return jsonb_build_object('status', 'conflict', 'code', 'stale_placement_state');
    end if;

    update public.draft_ranker_placement_sessions
    set interval_low = (p_state->>'intervalLow')::integer,
        interval_high = (p_state->>'intervalHigh')::integer,
        plausible_low = nullif(p_state->>'plausibleLow', '')::integer,
        plausible_high = nullif(p_state->>'plausibleHigh', '')::integer,
        question_count = (p_state->>'questionCount')::smallint,
        contradiction_count = (p_state->>'contradictionCount')::smallint,
        issued_anchors = p_state->'issuedAnchors',
        answers = p_state->'answers',
        suggested_rank = nullif(p_state->>'suggestedRank', '')::integer,
        confidence = p_state->>'confidence',
        completion_reason = nullif(p_state->>'completionReason', '')
    where id = p_session_id;

    v_result := jsonb_build_object(
        'status', 'completed', 'sessionId', p_session_id,
        'rankingId', v_session.ranking_id,
        'playerId', v_session.fhfh_player_id,
        'questionCount', (p_state->>'questionCount')::integer,
        'ready', (p_state->>'ready')::boolean,
        'suggestedRank', nullif(p_state->>'suggestedRank', '')::integer,
        'idempotentReplay', false
    );
    insert into public.draft_ranking_events (
        ranking_id, user_id, fhfh_player_id, event_type, event_source,
        operation_id, expected_version, resulting_version,
        before_state, after_state, metadata
    ) values (
        v_session.ranking_id, p_user_id, v_session.fhfh_player_id,
        'assisted_placement_answered', 'assisted_placement', p_operation_id,
        null, v_current_version,
        jsonb_build_object('questionCount', v_session.question_count),
        jsonb_build_object(
            'questionCount', (p_state->>'questionCount')::integer,
            'intervalLow', (p_state->>'intervalLow')::integer,
            'intervalHigh', (p_state->>'intervalHigh')::integer
        ),
        jsonb_build_object(
            'operation_payload_hash', p_operation_payload_hash,
            'sessionId', p_session_id, 'result', v_result
        )
    );
    return v_result;
end;
$$;

create or replace function public.cancel_draft_ranker_placement(
    p_user_id uuid,
    p_session_id uuid,
    p_operation_id uuid,
    p_operation_payload_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
    v_session public.draft_ranker_placement_sessions%rowtype;
    v_version bigint;
    v_existing_hash text;
    v_existing_result jsonb;
    v_result jsonb;
begin
    select session.* into v_session
    from public.draft_ranker_placement_sessions session
    where session.id = p_session_id and session.user_id = p_user_id
    for update;
    if not found then
        return jsonb_build_object('status', 'not_found', 'code', 'placement_not_found');
    end if;
    select event.metadata->>'operation_payload_hash', event.metadata->'result'
    into v_existing_hash, v_existing_result
    from public.draft_ranking_events event
    where event.ranking_id = v_session.ranking_id
      and event.operation_id = p_operation_id;
    if v_existing_hash is not null then
        if v_existing_hash <> p_operation_payload_hash then
            return jsonb_build_object('status', 'conflict', 'code', 'idempotency_conflict');
        end if;
        return coalesce(v_existing_result, '{}'::jsonb)
            || jsonb_build_object('idempotentReplay', true);
    end if;
    if v_session.status <> 'active' then
        return jsonb_build_object('status', 'conflict', 'code', 'placement_not_active');
    end if;
    select lock_version into v_version from public.draft_rankings
    where id = v_session.ranking_id and user_id = p_user_id for update;
    update public.draft_ranker_placement_sessions
    set status = 'cancelled', completed_at = statement_timestamp()
    where id = p_session_id;
    v_result := jsonb_build_object(
        'status', 'completed', 'sessionId', p_session_id,
        'rankingId', v_session.ranking_id, 'cancelled', true,
        'idempotentReplay', false
    );
    insert into public.draft_ranking_events (
        ranking_id, user_id, fhfh_player_id, event_type, event_source,
        operation_id, expected_version, resulting_version,
        before_state, after_state, metadata
    ) values (
        v_session.ranking_id, p_user_id, v_session.fhfh_player_id,
        'assisted_placement_cancelled', 'assisted_placement', p_operation_id,
        null, v_version, jsonb_build_object('status', 'active'),
        jsonb_build_object('status', 'cancelled'),
        jsonb_build_object(
            'operation_payload_hash', p_operation_payload_hash,
            'sessionId', p_session_id, 'result', v_result
        )
    );
    return v_result;
end;
$$;

create or replace function public.confirm_draft_ranker_placement(
    p_user_id uuid,
    p_session_id uuid,
    p_operation_id uuid,
    p_operation_payload_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
    v_session public.draft_ranker_placement_sessions%rowtype;
    v_version bigint;
    v_existing_hash text;
    v_existing_result jsonb;
    v_was_unplaced boolean;
    v_tail_key bigint;
    v_result jsonb;
begin
    select session.* into v_session
    from public.draft_ranker_placement_sessions session
    where session.id = p_session_id and session.user_id = p_user_id
    for update;
    if not found then
        return jsonb_build_object('status', 'not_found', 'code', 'placement_not_found');
    end if;
    select event.metadata->>'operation_payload_hash', event.metadata->'result'
    into v_existing_hash, v_existing_result
    from public.draft_ranking_events event
    where event.ranking_id = v_session.ranking_id
      and event.operation_id = p_operation_id;
    if v_existing_hash is not null then
        if v_existing_hash <> p_operation_payload_hash then
            return jsonb_build_object('status', 'conflict', 'code', 'idempotency_conflict');
        end if;
        return coalesce(v_existing_result, '{}'::jsonb)
            || jsonb_build_object('idempotentReplay', true);
    end if;
    if v_session.status <> 'active' or v_session.suggested_rank is null
       or v_session.completion_reason is null then
        return jsonb_build_object('status', 'conflict', 'code', 'placement_not_ready');
    end if;
    select ranking.lock_version into v_version
    from public.draft_rankings ranking
    where ranking.id = v_session.ranking_id and ranking.user_id = p_user_id
    for update;
    if v_version is distinct from v_session.ranking_version then
        return jsonb_build_object(
            'status', 'conflict', 'code', 'stale_ranking_version',
            'expectedVersion', v_session.ranking_version,
            'currentVersion', v_version
        );
    end if;

    v_was_unplaced := not exists (
        select 1 from public.draft_ranking_entries entry
        where entry.ranking_id = v_session.ranking_id
          and entry.user_id = p_user_id
          and entry.fhfh_player_id = v_session.fhfh_player_id
    );
    if v_was_unplaced then
        select coalesce(max(order_key), 0) + 1048576 into v_tail_key
        from public.draft_ranking_entries
        where ranking_id = v_session.ranking_id and user_id = p_user_id;
        insert into public.draft_ranking_entries (
            ranking_id, user_id, fhfh_player_id, order_key, seed_source,
            first_interacted_at, last_interacted_at
        ) values (
            v_session.ranking_id, p_user_id, v_session.fhfh_player_id,
            v_tail_key, 'assisted_placement', statement_timestamp(), statement_timestamp()
        );
    end if;

    v_result := public.reorder_draft_ranking(
        p_user_id, v_session.ranking_id, v_session.fhfh_player_id,
        'move_to_rank', v_session.suggested_rank, null, v_version,
        p_operation_id, p_operation_payload_hash
    );
    if v_result->>'status' <> 'completed' then
        if v_was_unplaced then
            delete from public.draft_ranking_entries
            where ranking_id = v_session.ranking_id
              and fhfh_player_id = v_session.fhfh_player_id;
        end if;
        return v_result;
    end if;

    update public.draft_ranker_placement_sessions
    set status = 'confirmed', completed_at = statement_timestamp()
    where id = p_session_id;
    delete from public.draft_ranker_player_preferences
    where ranking_id = v_session.ranking_id
      and fhfh_player_id = v_session.fhfh_player_id
      and disposition is null;

    v_result := v_result || jsonb_build_object(
        'sessionId', p_session_id,
        'wasUnplaced', v_was_unplaced,
        'plausibleLow', v_session.plausible_low,
        'plausibleHigh', v_session.plausible_high,
        'confidence', v_session.confidence
    );
    update public.draft_ranking_events
    set event_type = 'assisted_placement_confirmed',
        event_source = 'assisted_placement',
        metadata = jsonb_set(
            metadata || jsonb_build_object(
                'sessionId', p_session_id,
                'wasUnplaced', v_was_unplaced,
                'engineVersion', v_session.engine_version
            ),
            '{result}', v_result, true
        )
    where ranking_id = v_session.ranking_id and operation_id = p_operation_id;
    return v_result;
end;
$$;

comment on function public.begin_draft_ranker_placement(uuid,uuid,bigint,bigint,uuid,text,jsonb)
is 'Service-only deterministic assisted-placement session start.';
comment on function public.advance_draft_ranker_placement(uuid,uuid,integer,bigint,uuid,text,jsonb)
is 'Service-only compare-and-set assisted-placement answer persistence.';
comment on function public.cancel_draft_ranker_placement(uuid,uuid,uuid,text)
is 'Service-only assisted-placement cancellation.';
comment on function public.confirm_draft_ranker_placement(uuid,uuid,uuid,text)
is 'Service-only atomic assisted placement into the continuous ranking.';

revoke all on function public.begin_draft_ranker_placement(uuid,uuid,bigint,bigint,uuid,text,jsonb)
from public, anon, authenticated;
revoke all on function public.advance_draft_ranker_placement(uuid,uuid,integer,bigint,uuid,text,jsonb)
from public, anon, authenticated;
revoke all on function public.cancel_draft_ranker_placement(uuid,uuid,uuid,text)
from public, anon, authenticated;
revoke all on function public.confirm_draft_ranker_placement(uuid,uuid,uuid,text)
from public, anon, authenticated;

grant execute on function public.begin_draft_ranker_placement(uuid,uuid,bigint,bigint,uuid,text,jsonb)
to service_role;
grant execute on function public.advance_draft_ranker_placement(uuid,uuid,integer,bigint,uuid,text,jsonb)
to service_role;
grant execute on function public.cancel_draft_ranker_placement(uuid,uuid,uuid,text)
to service_role;
grant execute on function public.confirm_draft_ranker_placement(uuid,uuid,uuid,text)
to service_role;
