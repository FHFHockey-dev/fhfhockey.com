-- DR-021: atomic sparse ordering, optimistic conflict handling, automatic
-- normalization, immutable events, and service-only validation.

alter table public.draft_ranking_entries
    drop constraint draft_entries_order_unique;
alter table public.draft_ranking_entries
    add constraint draft_entries_order_unique
    unique (ranking_id, order_key)
    deferrable initially immediate;

create or replace function public.reorder_draft_ranking(
    p_user_id uuid,
    p_ranking_id uuid,
    p_player_id bigint,
    p_action text,
    p_target_rank integer,
    p_anchor_player_id bigint,
    p_expected_version bigint,
    p_operation_id uuid,
    p_operation_payload_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
    v_original_version bigint;
    v_current_version bigint;
    v_existing_hash text;
    v_existing_result jsonb;
    v_entry_count integer;
    v_current_rank integer;
    v_destination_rank integer;
    v_anchor_rank integer;
    v_old_key bigint;
    v_new_key bigint;
    v_new_key_numeric numeric;
    v_prev_key bigint;
    v_next_key bigint;
    v_normalized boolean := false;
    v_before_250 bigint;
    v_before_251 bigint;
    v_after_250 bigint;
    v_after_251 bigint;
    v_conflict_count integer := 0;
    v_result jsonb;
begin
    if p_user_id is null or p_ranking_id is null or p_player_id is null
       or p_operation_id is null then
        raise exception using errcode = '22023', message = 'owner, ranking, player, and operation IDs are required';
    end if;
    if p_expected_version is null or p_expected_version < 0 then
        raise exception using errcode = '22023', message = 'expected version must be nonnegative';
    end if;
    if nullif(btrim(p_operation_payload_hash), '') is null
       or p_operation_payload_hash !~ '^[0-9a-f]{64}$' then
        raise exception using errcode = '22023', message = 'operation payload hash must be lowercase SHA-256';
    end if;
    if p_action not in (
        'move_to_rank', 'insert_above', 'insert_below', 'remove_to_bench'
    ) then
        raise exception using errcode = '22023', message = 'unsupported reorder action';
    end if;

    select ranking.lock_version
    into v_original_version
    from public.draft_rankings ranking
    where ranking.id = p_ranking_id
      and ranking.user_id = p_user_id
      and ranking.status = 'active'
    for update;

    if v_original_version is null then
        return jsonb_build_object(
            'status', 'not_found',
            'code', 'not_found',
            'message', 'The requested ranking was not found.'
        );
    end if;

    select
        event.metadata->>'operation_payload_hash',
        event.metadata->'result'
    into v_existing_hash, v_existing_result
    from public.draft_ranking_events event
    where event.ranking_id = p_ranking_id
      and event.operation_id = p_operation_id;

    if v_existing_hash is not null then
        if v_existing_hash <> p_operation_payload_hash then
            return jsonb_build_object(
                'status', 'conflict',
                'code', 'idempotency_conflict',
                'rankingId', p_ranking_id,
                'message', 'The operation ID was already used with a different payload.'
            );
        end if;
        return coalesce(v_existing_result, '{}'::jsonb)
            || jsonb_build_object('idempotentReplay', true);
    end if;

    if v_original_version <> p_expected_version then
        return jsonb_build_object(
            'status', 'conflict',
            'code', 'stale_ranking_version',
            'rankingId', p_ranking_id,
            'expectedVersion', p_expected_version,
            'currentVersion', v_original_version,
            'message', 'The ranking changed. Reload before retrying.'
        );
    end if;

    select count(*) into v_entry_count
    from public.draft_ranking_entries entry
    where entry.ranking_id = p_ranking_id
      and entry.user_id = p_user_id;

    select ranked.visible_rank, ranked.order_key
    into v_current_rank, v_old_key
    from (
        select
            entry.fhfh_player_id,
            entry.order_key,
            row_number() over (
                order by entry.order_key, entry.fhfh_player_id
            )::integer as visible_rank
        from public.draft_ranking_entries entry
        where entry.ranking_id = p_ranking_id
          and entry.user_id = p_user_id
    ) ranked
    where ranked.fhfh_player_id = p_player_id;

    if v_current_rank is null then
        return jsonb_build_object(
            'status', 'not_found',
            'code', 'not_found',
            'rankingId', p_ranking_id,
            'message', 'The requested player is not placed in this ranking.'
        );
    end if;

    if p_action = 'move_to_rank' then
        if p_target_rank is null
           or p_target_rank < 1
           or p_target_rank > v_entry_count then
            return jsonb_build_object(
                'status', 'failed',
                'code', 'invalid_target_rank',
                'rankingId', p_ranking_id,
                'entryCount', v_entry_count,
                'message', 'The requested global rank is outside this ranking.'
            );
        end if;
        v_destination_rank := p_target_rank;
    elsif p_action in ('insert_above', 'insert_below') then
        if p_anchor_player_id is null or p_anchor_player_id = p_player_id then
            return jsonb_build_object(
                'status', 'failed',
                'code', 'invalid_anchor',
                'rankingId', p_ranking_id,
                'message', 'A different placed anchor player is required.'
            );
        end if;

        select ordered.position
        into v_anchor_rank
        from (
            select
                entry.fhfh_player_id,
                row_number() over (
                    order by entry.order_key, entry.fhfh_player_id
                )::integer as position
            from public.draft_ranking_entries entry
            where entry.ranking_id = p_ranking_id
              and entry.user_id = p_user_id
              and entry.fhfh_player_id <> p_player_id
        ) ordered
        where ordered.fhfh_player_id = p_anchor_player_id;

        if v_anchor_rank is null then
            return jsonb_build_object(
                'status', 'not_found',
                'code', 'not_found',
                'rankingId', p_ranking_id,
                'message', 'The anchor player is not placed in this ranking.'
            );
        end if;
        v_destination_rank := v_anchor_rank
            + case when p_action = 'insert_below' then 1 else 0 end;
    else
        v_destination_rank := least(251, v_entry_count);
    end if;

    select
        max(entry.fhfh_player_id) filter (where entry.visible_rank = 250),
        max(entry.fhfh_player_id) filter (where entry.visible_rank = 251)
    into v_before_250, v_before_251
    from (
        select
            placed.fhfh_player_id,
            row_number() over (
                order by placed.order_key, placed.fhfh_player_id
            )::integer as visible_rank
        from public.draft_ranking_entries placed
        where placed.ranking_id = p_ranking_id
    ) entry;

    select
        max(ordered.order_key) filter (
            where ordered.position = v_destination_rank - 1
        ),
        max(ordered.order_key) filter (
            where ordered.position = v_destination_rank
        )
    into v_prev_key, v_next_key
    from (
        select
            entry.order_key,
            row_number() over (
                order by entry.order_key, entry.fhfh_player_id
            )::integer as position
        from public.draft_ranking_entries entry
        where entry.ranking_id = p_ranking_id
          and entry.user_id = p_user_id
          and entry.fhfh_player_id <> p_player_id
    ) ordered;

    if v_prev_key is not null and v_next_key is not null
       and v_next_key::numeric - v_prev_key::numeric <= 1 then
        set constraints draft_entries_order_unique deferred;

        with ordered as (
            select
                entry.fhfh_player_id,
                row_number() over (
                    order by entry.order_key, entry.fhfh_player_id
                )::bigint as position
            from public.draft_ranking_entries entry
            where entry.ranking_id = p_ranking_id
              and entry.user_id = p_user_id
        )
        update public.draft_ranking_entries entry
        set order_key = ordered.position * 1048576
        from ordered
        where entry.ranking_id = p_ranking_id
          and entry.fhfh_player_id = ordered.fhfh_player_id;

        v_current_version := v_original_version + 1;
        update public.draft_rankings
        set lock_version = v_current_version
        where id = p_ranking_id;

        insert into public.draft_ranking_events (
            ranking_id, user_id, event_type, event_source, operation_id,
            expected_version, resulting_version, before_state, after_state, metadata
        ) values (
            p_ranking_id, p_user_id, 'order_normalized', 'system', gen_random_uuid(),
            v_original_version, v_current_version,
            jsonb_build_object('reason', 'midpoint_exhausted'),
            jsonb_build_object('stride', 1048576, 'entryCount', v_entry_count),
            jsonb_build_object('triggeringOperationId', p_operation_id)
        );
        v_normalized := true;

        select
            max(ordered.order_key) filter (
                where ordered.position = v_destination_rank - 1
            ),
            max(ordered.order_key) filter (
                where ordered.position = v_destination_rank
            )
        into v_prev_key, v_next_key
        from (
            select
                entry.order_key,
                row_number() over (
                    order by entry.order_key, entry.fhfh_player_id
                )::integer as position
            from public.draft_ranking_entries entry
            where entry.ranking_id = p_ranking_id
              and entry.user_id = p_user_id
              and entry.fhfh_player_id <> p_player_id
        ) ordered;
    else
        v_current_version := v_original_version;
    end if;

    if v_prev_key is null and v_next_key is null then
        v_new_key_numeric := v_old_key;
    elsif v_prev_key is null then
        v_new_key_numeric := v_next_key::numeric - 1048576;
    elsif v_next_key is null then
        v_new_key_numeric := v_prev_key::numeric + 1048576;
    else
        v_new_key_numeric := v_prev_key::numeric
            + floor((v_next_key::numeric - v_prev_key::numeric) / 2);
    end if;

    if v_new_key_numeric < -9223372036854775808::numeric
       or v_new_key_numeric > 9223372036854775807::numeric then
        return jsonb_build_object(
            'status', 'failed',
            'code', 'order_key_overflow',
            'rankingId', p_ranking_id,
            'message', 'The ranking order requires operator repair.'
        );
    end if;
    v_new_key := v_new_key_numeric::bigint;

    update public.draft_ranking_entries
    set
        order_key = v_new_key,
        first_interacted_at = coalesce(first_interacted_at, statement_timestamp()),
        last_interacted_at = statement_timestamp()
    where ranking_id = p_ranking_id
      and user_id = p_user_id
      and fhfh_player_id = p_player_id;

    v_current_version := v_current_version + 1;
    update public.draft_rankings
    set lock_version = v_current_version
    where id = p_ranking_id;

    select ranked.visible_rank
    into v_destination_rank
    from (
        select
            entry.fhfh_player_id,
            row_number() over (
                order by entry.order_key, entry.fhfh_player_id
            )::integer as visible_rank
        from public.draft_ranking_entries entry
        where entry.ranking_id = p_ranking_id
    ) ranked
    where ranked.fhfh_player_id = p_player_id;

    select
        max(entry.fhfh_player_id) filter (where entry.visible_rank = 250),
        max(entry.fhfh_player_id) filter (where entry.visible_rank = 251)
    into v_after_250, v_after_251
    from (
        select
            placed.fhfh_player_id,
            row_number() over (
                order by placed.order_key, placed.fhfh_player_id
            )::integer as visible_rank
        from public.draft_ranking_entries placed
        where placed.ranking_id = p_ranking_id
    ) entry;

    select count(*) into v_conflict_count
    from public.draft_ranker_pair_preferences preference
    join public.draft_ranking_entries low_entry
      on low_entry.ranking_id = preference.ranking_id
     and low_entry.fhfh_player_id = preference.low_player_id
    join public.draft_ranking_entries high_entry
      on high_entry.ranking_id = preference.ranking_id
     and high_entry.fhfh_player_id = preference.high_player_id
    where preference.ranking_id = p_ranking_id
      and preference.user_id = p_user_id
      and p_player_id in (preference.low_player_id, preference.high_player_id)
      and (
          (preference.preferred_player_id = preference.low_player_id
           and low_entry.order_key > high_entry.order_key)
          or
          (preference.preferred_player_id = preference.high_player_id
           and high_entry.order_key > low_entry.order_key)
      );

    v_result := jsonb_build_object(
        'status', 'completed',
        'rankingId', p_ranking_id,
        'playerId', p_player_id,
        'action', p_action,
        'previousRank', v_current_rank,
        'resultingRank', v_destination_rank,
        'previousOrderKey', v_old_key,
        'resultingOrderKey', v_new_key,
        'expectedVersion', p_expected_version,
        'resultingVersion', v_current_version,
        'normalized', v_normalized,
        'comparisonConflictCount', v_conflict_count,
        'beforeCutoff', jsonb_build_object(
            'rank250PlayerId', v_before_250,
            'rank251PlayerId', v_before_251
        ),
        'afterCutoff', jsonb_build_object(
            'rank250PlayerId', v_after_250,
            'rank251PlayerId', v_after_251
        ),
        'idempotentReplay', false
    );

    insert into public.draft_ranking_events (
        ranking_id, user_id, fhfh_player_id, event_type, event_source,
        operation_id, expected_version, resulting_version,
        before_state, after_state, metadata
    ) values (
        p_ranking_id, p_user_id, p_player_id, 'player_reordered', 'direct_edit',
        p_operation_id, p_expected_version, v_current_version,
        jsonb_build_object(
            'rank', v_current_rank,
            'orderKey', v_old_key,
            'rank250PlayerId', v_before_250,
            'rank251PlayerId', v_before_251
        ),
        jsonb_build_object(
            'rank', v_destination_rank,
            'orderKey', v_new_key,
            'rank250PlayerId', v_after_250,
            'rank251PlayerId', v_after_251
        ),
        jsonb_build_object(
            'operation_payload_hash', p_operation_payload_hash,
            'normalized', v_normalized,
            'comparisonConflictCount', v_conflict_count,
            'result', v_result
        )
    );

    return v_result;
end;
$$;

create or replace function public.validate_draft_ranking_order(
    p_user_id uuid,
    p_ranking_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
    with owned as (
        select ranking.id, ranking.lock_version
        from public.draft_rankings ranking
        where ranking.id = p_ranking_id
          and ranking.user_id = p_user_id
    ),
    ordered as (
        select
            entry.order_key,
            lag(entry.order_key) over (
                order by entry.order_key, entry.fhfh_player_id
            ) as previous_key
        from public.draft_ranking_entries entry
        join owned on owned.id = entry.ranking_id
    )
    select case
        when not exists (select 1 from owned) then jsonb_build_object(
            'status', 'not_found',
            'code', 'not_found'
        )
        else jsonb_build_object(
            'status', 'completed',
            'rankingId', p_ranking_id,
            'lockVersion', (select lock_version from owned),
            'entryCount', (select count(*) from ordered),
            'minimumGap', (
                select min(order_key - previous_key)
                from ordered
                where previous_key is not null
            ),
            'isValid', not exists (
                select 1 from ordered
                where previous_key is not null
                  and order_key <= previous_key
            )
        )
    end;
$$;

revoke all on function public.reorder_draft_ranking(
    uuid, uuid, bigint, text, integer, bigint, bigint, uuid, text
) from public, anon, authenticated;
grant execute on function public.reorder_draft_ranking(
    uuid, uuid, bigint, text, integer, bigint, bigint, uuid, text
) to service_role;

revoke all on function public.validate_draft_ranking_order(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.validate_draft_ranking_order(uuid, uuid)
to service_role;
;
