-- DR-020: atomically initialize one account-owned ranking from verified 2025
-- Yahoo ADP. The function is service-role-only; the API derives p_user_id from
-- requireApiUser and never accepts a client owner identifier.

create or replace function public.initialize_draft_ranking_from_yahoo(
    p_user_id uuid,
    p_operation_id uuid,
    p_operation_payload_hash text,
    p_scoring_profile jsonb default '{}'::jsonb,
    p_target_season_id bigint default 20262027,
    p_source_yahoo_season integer default 2025,
    p_seed_revision text default 'yahoo-2025-v1'
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
    v_ranking_id uuid;
    v_seed_run_id uuid;
    v_existing_status text;
    v_existing_result jsonb;
    v_existing_error jsonb;
    v_existing_operation_hash text;
    v_existing_entry_count bigint;
    v_source_count integer := 0;
    v_seeded_count integer := 0;
    v_invalid_adp_count integer := 0;
    v_unmapped_count integer := 0;
    v_fallback_count integer := 0;
    v_result jsonb;
begin
    if p_user_id is null or p_operation_id is null then
        raise exception using errcode = '22023', message = 'user and operation IDs are required';
    end if;
    if nullif(btrim(p_operation_payload_hash), '') is null
       or p_operation_payload_hash !~ '^[0-9a-f]{64}$' then
        raise exception using errcode = '22023', message = 'operation payload hash must be lowercase SHA-256';
    end if;
    if jsonb_typeof(p_scoring_profile) <> 'object' then
        raise exception using errcode = '22023', message = 'scoring profile must be a JSON object';
    end if;
    if p_target_season_id <> 20262027 or p_source_yahoo_season <> 2025 then
        raise exception using errcode = '22023', message = 'unsupported draft-ranker seed season';
    end if;
    if nullif(btrim(p_seed_revision), '') is null then
        raise exception using errcode = '22023', message = 'seed revision is required';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
            p_user_id::text || ':' || p_target_season_id::text,
            0
        )
    );

    select ranking.id
    into v_ranking_id
    from public.draft_rankings ranking
    where ranking.user_id = p_user_id
      and ranking.target_season_id = p_target_season_id
      and ranking.status = 'active'
      and ranking.is_default
    for update;

    if v_ranking_id is null then
        insert into public.draft_rankings (
            user_id,
            target_season_id,
            name,
            status,
            is_default,
            scoring_profile,
            schema_version,
            lock_version
        ) values (
            p_user_id,
            p_target_season_id,
            'My 2026-27 Draft Rankings',
            'active',
            true,
            p_scoring_profile,
            1,
            0
        )
        returning id into v_ranking_id;
    end if;

    select event.metadata->>'operation_payload_hash'
    into v_existing_operation_hash
    from public.draft_ranking_events event
    where event.ranking_id = v_ranking_id
      and event.operation_id = p_operation_id;

    if v_existing_operation_hash is not null then
        if v_existing_operation_hash <> p_operation_payload_hash then
            return jsonb_build_object(
                'status', 'conflict',
                'code', 'idempotency_conflict',
                'rankingId', v_ranking_id,
                'message', 'The operation ID was already used with a different payload.'
            );
        end if;
        select event.metadata->'result'
        into v_existing_result
        from public.draft_ranking_events event
        where event.ranking_id = v_ranking_id
          and event.operation_id = p_operation_id;
        return coalesce(v_existing_result, '{}'::jsonb)
            || jsonb_build_object('idempotentReplay', true);
    end if;

    select seed.status, seed.result_summary, seed.error_summary, seed.id
    into v_existing_status, v_existing_result, v_existing_error, v_seed_run_id
    from public.draft_ranking_seed_runs seed
    where seed.ranking_id = v_ranking_id
      and seed.seed_revision = p_seed_revision
    for update;

    if v_existing_status = 'completed' then
        select count(*) into v_existing_entry_count
        from public.draft_ranking_entries entry
        where entry.ranking_id = v_ranking_id;

        if v_existing_entry_count <> coalesce((v_existing_result->>'seededCount')::bigint, -1) then
            return jsonb_build_object(
                'status', 'failed',
                'code', 'seed_integrity_mismatch',
                'rankingId', v_ranking_id,
                'message', 'The completed seed record does not match the persisted ranking.'
            );
        end if;
        return coalesce(v_existing_result, '{}'::jsonb)
            || jsonb_build_object('idempotentReplay', true);
    end if;

    if v_existing_status = 'failed'
       and v_existing_error->>'operationId' = p_operation_id::text
       and v_existing_error->>'operationPayloadHash' <> p_operation_payload_hash then
        return jsonb_build_object(
            'status', 'conflict',
            'code', 'idempotency_conflict',
            'rankingId', v_ranking_id,
            'message', 'The operation ID was already used with a different payload.'
        );
    end if;

    if v_seed_run_id is null then
        insert into public.draft_ranking_seed_runs (
            ranking_id,
            user_id,
            seed_revision,
            source_season_id,
            status
        ) values (
            v_ranking_id,
            p_user_id,
            p_seed_revision,
            (p_source_yahoo_season::bigint * 10000) + p_source_yahoo_season + 1,
            'pending'
        )
        returning id into v_seed_run_id;
    else
        update public.draft_ranking_seed_runs
        set
            status = 'pending',
            source_count = 0,
            seeded_count = 0,
            invalid_adp_count = 0,
            unmapped_count = 0,
            fallback_count = 0,
            result_summary = '{}'::jsonb,
            error_summary = '{}'::jsonb,
            started_at = statement_timestamp(),
            completed_at = null
        where id = v_seed_run_id;
    end if;

    begin
        select count(*) into v_existing_entry_count
        from public.draft_ranking_entries entry
        where entry.ranking_id = v_ranking_id;

        if v_existing_entry_count <> 0 then
            update public.draft_ranking_seed_runs
            set
                status = 'failed',
                error_summary = jsonb_build_object(
                    'code', 'ranking_not_empty',
                    'operationId', p_operation_id,
                    'operationPayloadHash', p_operation_payload_hash,
                    'existingEntryCount', v_existing_entry_count
                ),
                completed_at = statement_timestamp()
            where id = v_seed_run_id;

            return jsonb_build_object(
                'status', 'failed',
                'code', 'ranking_not_empty',
                'rankingId', v_ranking_id,
                'message', 'The ranking already contains players and cannot be initialized.'
            );
        end if;

        with source as materialized (
            select
                yahoo.player_key,
                yahoo.average_draft_pick,
                case
                    when jsonb_typeof(yahoo.draft_analysis->'preseason_average_pick') = 'number'
                        then (yahoo.draft_analysis->>'preseason_average_pick')::numeric
                    when jsonb_typeof(yahoo.draft_analysis->'preseason_average_pick') = 'string'
                         and yahoo.draft_analysis->>'preseason_average_pick'
                            ~ '^\s*[0-9]+(?:\.[0-9]+)?\s*$'
                        then (yahoo.draft_analysis->>'preseason_average_pick')::numeric
                    else null
                end as preseason_adp
            from public.yahoo_players yahoo
            where yahoo.season = p_source_yahoo_season
        ),
        mapped as materialized (
            select
                source.*,
                mapping.fhfh_player_id,
                identity.lifecycle_status,
                identity.verification_status,
                identity.merged_into_id,
                case
                    when source.preseason_adp > 0 then source.preseason_adp
                    when source.average_draft_pick > 0 then source.average_draft_pick::numeric
                    else null
                end as seed_value,
                case
                    when source.preseason_adp > 0 then 'yahoo_prior_preseason_adp'
                    when source.average_draft_pick > 0 then 'yahoo_prior_average_pick_fallback'
                    else null
                end as seed_source
            from source
            join public.fhfh_player_external_identities mapping
              on mapping.provider = 'yahoo'
             and mapping.external_player_id = source.player_key
             and mapping.verification_status = 'verified'
            join public.fhfh_player_identities identity
              on identity.id = mapping.fhfh_player_id
        ),
        rankable as materialized (
            select mapped.*
            from mapped
            where mapped.verification_status = 'verified'
              and mapped.merged_into_id is null
              and mapped.lifecycle_status in (
                  'active_nhl', 'active_prospect', 'unsigned_relevant'
              )
        ),
        choices as materialized (
            select
                rankable.*,
                row_number() over (
                    partition by rankable.fhfh_player_id
                    order by
                        (rankable.seed_source = 'yahoo_prior_preseason_adp') desc,
                        rankable.seed_value,
                        rankable.player_key
                ) as identity_choice
            from rankable
            where rankable.seed_value > 0
        ),
        ranked as materialized (
            select
                choices.*,
                row_number() over (
                    order by
                        choices.seed_value,
                        (choices.seed_source = 'yahoo_prior_preseason_adp') desc,
                        choices.fhfh_player_id
                ) as seed_rank
            from choices
            where choices.identity_choice = 1
        ),
        inserted as (
            insert into public.draft_ranking_entries (
                ranking_id,
                user_id,
                fhfh_player_id,
                order_key,
                seed_source,
                seed_adp,
                seed_rank
            )
            select
                v_ranking_id,
                p_user_id,
                ranked.fhfh_player_id,
                ranked.seed_rank * 1048576,
                ranked.seed_source,
                ranked.seed_value,
                ranked.seed_rank
            from ranked
            returning fhfh_player_id
        )
        select
            (select count(*) from source),
            (select count(*) from inserted),
            (
                select count(distinct rankable.fhfh_player_id)
                from rankable
                where rankable.seed_value is null
            ),
            (
                select count(*)
                from source
                where not exists (
                    select 1
                    from public.fhfh_player_external_identities mapping
                    where mapping.provider = 'yahoo'
                      and mapping.external_player_id = source.player_key
                      and mapping.verification_status = 'verified'
                )
            ),
            (
                select count(*)
                from ranked
                where ranked.seed_source = 'yahoo_prior_average_pick_fallback'
            )
        into
            v_source_count,
            v_seeded_count,
            v_invalid_adp_count,
            v_unmapped_count,
            v_fallback_count;

        if v_seeded_count < 250 then
            delete from public.draft_ranking_entries
            where ranking_id = v_ranking_id;

            update public.draft_ranking_seed_runs
            set
                status = 'failed',
                source_count = v_source_count,
                seeded_count = v_seeded_count,
                invalid_adp_count = v_invalid_adp_count,
                unmapped_count = v_unmapped_count,
                fallback_count = v_fallback_count,
                error_summary = jsonb_build_object(
                    'code', 'insufficient_seed_candidates',
                    'operationId', p_operation_id,
                    'operationPayloadHash', p_operation_payload_hash,
                    'requiredCount', 250,
                    'availableCount', v_seeded_count
                ),
                completed_at = statement_timestamp()
            where id = v_seed_run_id;

            return jsonb_build_object(
                'status', 'failed',
                'code', 'insufficient_seed_candidates',
                'rankingId', v_ranking_id,
                'requiredCount', 250,
                'availableCount', v_seeded_count,
                'message', 'Fewer than 250 verified players have valid prior Yahoo ADP.'
            );
        end if;

        v_result := jsonb_build_object(
            'status', 'completed',
            'rankingId', v_ranking_id,
            'targetSeasonId', p_target_season_id,
            'sourceYahooSeason', p_source_yahoo_season,
            'seedRevision', p_seed_revision,
            'seededCount', v_seeded_count,
            'top250Count', least(v_seeded_count, 250),
            'candidateCount', greatest(v_seeded_count - 250, 0),
            'sourceCount', v_source_count,
            'invalidAdpCount', v_invalid_adp_count,
            'unmappedCount', v_unmapped_count,
            'fallbackCount', v_fallback_count,
            'idempotentReplay', false
        );

        update public.draft_ranking_seed_runs
        set
            status = 'completed',
            source_count = v_source_count,
            seeded_count = v_seeded_count,
            invalid_adp_count = v_invalid_adp_count,
            unmapped_count = v_unmapped_count,
            fallback_count = v_fallback_count,
            result_summary = v_result,
            error_summary = '{}'::jsonb,
            completed_at = statement_timestamp()
        where id = v_seed_run_id;

        update public.draft_rankings
        set
            scoring_profile = p_scoring_profile,
            seed_revision = p_seed_revision
        where id = v_ranking_id;

        insert into public.draft_ranking_events (
            ranking_id,
            user_id,
            event_type,
            event_source,
            operation_id,
            expected_version,
            resulting_version,
            before_state,
            after_state,
            metadata
        ) values (
            v_ranking_id,
            p_user_id,
            'ranking_initialized',
            'yahoo_prior_adp',
            p_operation_id,
            null,
            0,
            '{}'::jsonb,
            jsonb_build_object(
                'seededCount', v_seeded_count,
                'top250Count', least(v_seeded_count, 250),
                'candidateCount', greatest(v_seeded_count - 250, 0)
            ),
            jsonb_build_object(
                'operation_payload_hash', p_operation_payload_hash,
                'result', v_result
            )
        );

        return v_result;
    exception when others then
        update public.draft_ranking_seed_runs
        set
            status = 'failed',
            error_summary = jsonb_build_object(
                'code', 'seed_transaction_failed',
                'operationId', p_operation_id,
                'operationPayloadHash', p_operation_payload_hash,
                'sqlstate', sqlstate
            ),
            completed_at = statement_timestamp()
        where id = v_seed_run_id;

        return jsonb_build_object(
            'status', 'failed',
            'code', 'seed_transaction_failed',
            'rankingId', v_ranking_id,
            'message', 'The Yahoo seed transaction failed.'
        );
    end;
end;
$$;

revoke all on function public.initialize_draft_ranking_from_yahoo(
    uuid, uuid, text, jsonb, bigint, integer, text
) from public, anon, authenticated;

grant execute on function public.initialize_draft_ranking_from_yahoo(
    uuid, uuid, text, jsonb, bigint, integer, text
) to service_role;

comment on function public.initialize_draft_ranking_from_yahoo(
    uuid, uuid, text, jsonb, bigint, integer, text
) is 'Service-only, atomic, idempotent 2026-27 initialization from verified 2025 Yahoo ADP.';
