-- DR-071: deterministic, service-only ordering normalization.
-- The repair reuses the immutable ranking event log and never edits identity
-- records or community snapshots in place.

create or replace function public.repair_draft_ranking_ordering(
    p_ranking_id uuid,
    p_expected_version bigint,
    p_operation_id uuid,
    p_operation_payload_hash text,
    p_reason text,
    p_confirmation text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
    v_user_id uuid;
    v_current_version bigint;
    v_existing_hash text;
    v_existing_version bigint;
    v_entry_count integer := 0;
    v_mismatch_count integer := 0;
    v_before_min bigint;
    v_before_max bigint;
    v_after_min bigint;
    v_after_max bigint;
    v_resulting_version bigint;
    v_result jsonb;
begin
    if p_ranking_id is null or p_operation_id is null then
        raise exception using errcode = '22023', message = 'ranking and operation IDs are required';
    end if;
    if p_expected_version is null or p_expected_version < 0 then
        raise exception using errcode = '22023', message = 'expected version must be nonnegative';
    end if;
    if p_operation_payload_hash is null
       or p_operation_payload_hash !~ '^[0-9a-f]{64}$' then
        raise exception using errcode = '22023', message = 'operation payload hash must be lowercase SHA-256';
    end if;
    if nullif(btrim(p_reason), '') is null or char_length(p_reason) > 500 then
        raise exception using errcode = '22023', message = 'a bounded repair reason is required';
    end if;
    if p_confirmation <> 'NORMALIZE_ORDERING' then
        return jsonb_build_object(
            'status', 'failed',
            'code', 'confirmation_required',
            'message', 'Exact normalization confirmation is required.'
        );
    end if;

    perform pg_advisory_xact_lock(
        hashtextextended('draft-ranking-repair:' || p_ranking_id::text, 0)
    );

    select ranking.user_id, ranking.lock_version
    into v_user_id, v_current_version
    from public.draft_rankings ranking
    where ranking.id = p_ranking_id
    for update;

    if not found then
        return jsonb_build_object(
            'status', 'not_found',
            'code', 'ranking_not_found',
            'message', 'The ranking was not found.'
        );
    end if;

    select
        event.metadata->>'operationPayloadHash',
        event.resulting_version
    into v_existing_hash, v_existing_version
    from public.draft_ranking_events event
    where event.ranking_id = p_ranking_id
      and event.operation_id = p_operation_id;

    if found then
        if v_existing_hash <> p_operation_payload_hash then
            return jsonb_build_object(
                'status', 'conflict',
                'code', 'idempotency_conflict',
                'message', 'The operation ID was already used with a different repair payload.'
            );
        end if;
        return jsonb_build_object(
            'status', 'completed',
            'rankingId', p_ranking_id,
            'resultingVersion', v_existing_version,
            'idempotentReplay', true
        );
    end if;

    if v_current_version <> p_expected_version then
        return jsonb_build_object(
            'status', 'conflict',
            'code', 'stale_ranking_version',
            'message', 'The ranking changed before the repair could run.',
            'expectedVersion', p_expected_version,
            'currentVersion', v_current_version
        );
    end if;

    with ordered as (
        select
            entry.order_key,
            row_number() over (
                order by entry.order_key, entry.fhfh_player_id
            )::bigint * 1024 as normalized_key
        from public.draft_ranking_entries entry
        where entry.ranking_id = p_ranking_id
    )
    select
        count(*)::integer,
        count(*) filter (where order_key <> normalized_key)::integer,
        min(order_key),
        max(order_key)
    into v_entry_count, v_mismatch_count, v_before_min, v_before_max
    from ordered;

    if v_mismatch_count > 0 then
        with ordered as (
            select
                entry.fhfh_player_id,
                row_number() over (
                    order by entry.order_key, entry.fhfh_player_id
                )::bigint * 1024 as normalized_key
            from public.draft_ranking_entries entry
            where entry.ranking_id = p_ranking_id
        )
        update public.draft_ranking_entries entry
        set order_key = ordered.normalized_key,
            updated_at = statement_timestamp()
        from ordered
        where entry.ranking_id = p_ranking_id
          and entry.fhfh_player_id = ordered.fhfh_player_id;

        v_resulting_version := v_current_version + 1;
        update public.draft_rankings
        set lock_version = v_resulting_version,
            updated_at = statement_timestamp()
        where id = p_ranking_id;
        v_after_min := case when v_entry_count > 0 then 1024 else null end;
        v_after_max := case when v_entry_count > 0 then v_entry_count::bigint * 1024 else null end;
    else
        v_resulting_version := v_current_version;
        v_after_min := v_before_min;
        v_after_max := v_before_max;
    end if;

    v_result := jsonb_build_object(
        'status', 'completed',
        'rankingId', p_ranking_id,
        'entryCount', v_entry_count,
        'changedEntryCount', v_mismatch_count,
        'previousVersion', v_current_version,
        'resultingVersion', v_resulting_version,
        'idempotentReplay', false
    );

    insert into public.draft_ranking_events (
        ranking_id, user_id, fhfh_player_id, event_type, event_source,
        operation_id, expected_version, resulting_version,
        before_state, after_state, metadata
    ) values (
        p_ranking_id,
        v_user_id,
        null,
        case when v_mismatch_count > 0 then 'normalize_ordering' else 'normalize_ordering_noop' end,
        'admin_repair',
        p_operation_id,
        case when v_mismatch_count > 0 then v_current_version else null end,
        v_resulting_version,
        jsonb_build_object(
            'entryCount', v_entry_count,
            'minimumOrderKey', v_before_min,
            'maximumOrderKey', v_before_max
        ),
        jsonb_build_object(
            'entryCount', v_entry_count,
            'minimumOrderKey', v_after_min,
            'maximumOrderKey', v_after_max
        ),
        jsonb_build_object(
            'operationPayloadHash', p_operation_payload_hash,
            'reason', btrim(p_reason),
            'changedEntryCount', v_mismatch_count,
            'result', v_result
        )
    );

    return v_result;
end;
$$;

revoke all on function public.repair_draft_ranking_ordering(
    uuid, bigint, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.repair_draft_ranking_ordering(
    uuid, bigint, uuid, text, text, text
) to service_role;

comment on function public.repair_draft_ranking_ordering(
    uuid, bigint, uuid, text, text, text
) is 'DR-071 service-only deterministic sparse-order normalization with immutable audit evidence.';
