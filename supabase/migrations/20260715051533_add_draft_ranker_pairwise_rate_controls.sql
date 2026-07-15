-- DR-043: distributed pairwise rate controls and community-evidence suppression.
-- Personal ranking responses remain available when community collection is
-- disabled or a soft moderation threshold is crossed.

create table public.draft_ranker_pairwise_rate_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    action text not null,
    operation_id uuid not null,
    operation_payload_hash text not null,
    low_player_id bigint null references public.fhfh_player_identities(id) on delete restrict,
    high_player_id bigint null references public.fhfh_player_identities(id) on delete restrict,
    decision text not null,
    reason_code text null,
    window_counts jsonb not null default '{}'::jsonb,
    result jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint draft_pair_rate_operation_unique
        unique (user_id, action, operation_id),
    constraint draft_pair_rate_action_valid
        check (action in ('queue', 'respond')),
    constraint draft_pair_rate_hash_valid
        check (operation_payload_hash ~ '^[0-9a-f]{64}$'),
    constraint draft_pair_rate_pair_valid check (
        (low_player_id is null and high_player_id is null)
        or (
            low_player_id is not null
            and high_player_id is not null
            and low_player_id < high_player_id
        )
    ),
    constraint draft_pair_rate_decision_valid
        check (decision in ('allowed', 'community_suppressed', 'hard_limited')),
    constraint draft_pair_rate_reason_valid check (
        (decision = 'allowed' and reason_code is null)
        or (decision <> 'allowed' and nullif(btrim(reason_code), '') is not null)
    ),
    constraint draft_pair_rate_counts_object
        check (jsonb_typeof(window_counts) = 'object'),
    constraint draft_pair_rate_result_object
        check (jsonb_typeof(result) = 'object')
);

create index draft_pair_rate_owner_action_created
on public.draft_ranker_pairwise_rate_events (user_id, action, created_at desc);

create index draft_pair_rate_pair_created
on public.draft_ranker_pairwise_rate_events (
    low_player_id, high_player_id, created_at desc
)
where low_player_id is not null;

create index draft_pair_rate_high_player
on public.draft_ranker_pairwise_rate_events (high_player_id)
where high_player_id is not null;

alter table public.draft_ranker_pairwise_rate_events enable row level security;
revoke all on public.draft_ranker_pairwise_rate_events from public, anon, authenticated;
grant all on public.draft_ranker_pairwise_rate_events to service_role;

-- Rate events are operational moderation data, not account-facing history.
create policy draft_pair_rate_no_client_access
on public.draft_ranker_pairwise_rate_events
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

create or replace function public.enforce_draft_ranker_pairwise_rate_limit(
    p_user_id uuid,
    p_action text,
    p_operation_id uuid,
    p_operation_payload_hash text,
    p_low_player_id bigint,
    p_high_player_id bigint,
    p_community_collection_enabled boolean,
    p_config jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
    v_existing_hash text;
    v_existing_result jsonb;
    v_now timestamptz := statement_timestamp();
    v_queue_hour_limit integer;
    v_queue_day_limit integer;
    v_response_minute_limit integer;
    v_response_hour_limit integer;
    v_soft_response_ten_minute_limit integer;
    v_same_pair_week_limit integer;
    v_hour_count integer := 0;
    v_day_count integer := 0;
    v_minute_count integer := 0;
    v_ten_minute_count integer := 0;
    v_same_pair_week_count integer := 0;
    v_allowed boolean := true;
    v_decision text := 'allowed';
    v_reason_code text;
    v_retry_after_seconds integer;
    v_counts jsonb;
    v_result jsonb;
begin
    if p_user_id is null or p_operation_id is null then
        raise exception using errcode = '22023', message = 'owner and operation IDs are required';
    end if;
    if p_action not in ('queue', 'respond') then
        raise exception using errcode = '22023', message = 'unsupported rate-limit action';
    end if;
    if p_operation_payload_hash is null
       or p_operation_payload_hash !~ '^[0-9a-f]{64}$' then
        raise exception using errcode = '22023', message = 'operation payload hash must be lowercase SHA-256';
    end if;
    if (p_low_player_id is null) <> (p_high_player_id is null)
       or (
           p_low_player_id is not null
           and p_low_player_id >= p_high_player_id
       ) then
        raise exception using errcode = '22023', message = 'rate-limit pair must be canonical or omitted';
    end if;
    if p_action = 'queue' and p_low_player_id is not null then
        raise exception using errcode = '22023', message = 'queue limits do not accept a player pair';
    end if;
    if p_config is null or jsonb_typeof(p_config) <> 'object' then
        raise exception using errcode = '22023', message = 'rate-limit config must be a JSON object';
    end if;

    v_queue_hour_limit := coalesce((p_config->>'queueHourlyLimit')::integer, 120);
    v_queue_day_limit := coalesce((p_config->>'queueDailyLimit')::integer, 500);
    v_response_minute_limit := coalesce((p_config->>'responseMinuteLimit')::integer, 60);
    v_response_hour_limit := coalesce((p_config->>'responseHourlyLimit')::integer, 300);
    v_soft_response_ten_minute_limit := coalesce(
        (p_config->>'communityResponseTenMinuteLimit')::integer,
        30
    );
    v_same_pair_week_limit := coalesce((p_config->>'samePairWeeklyLimit')::integer, 3);

    if v_queue_hour_limit not between 1 and 10000
       or v_queue_day_limit not between 1 and 50000
       or v_response_minute_limit not between 1 and 10000
       or v_response_hour_limit not between 1 and 50000
       or v_soft_response_ten_minute_limit not between 1 and 10000
       or v_same_pair_week_limit not between 1 and 1000 then
        raise exception using errcode = '22023', message = 'rate-limit config is outside supported bounds';
    end if;

    -- Serialize each account/action quota across every application instance.
    perform pg_advisory_xact_lock(
        hashtextextended(
            'draft-ranker-pairwise-rate:' || p_user_id::text || ':' || p_action,
            0
        )
    );

    select event.operation_payload_hash, event.result
    into v_existing_hash, v_existing_result
    from public.draft_ranker_pairwise_rate_events event
    where event.user_id = p_user_id
      and event.action = p_action
      and event.operation_id = p_operation_id;

    if found then
        if v_existing_hash <> p_operation_payload_hash then
            return jsonb_build_object(
                'status', 'conflict',
                'code', 'idempotency_conflict',
                'message', 'The operation ID was already used with a different rate-limit payload.'
            );
        end if;
        return coalesce(v_existing_result, '{}'::jsonb)
            || jsonb_build_object('idempotentReplay', true);
    end if;

    if p_action = 'queue' then
        select
            count(*) filter (where event.created_at >= v_now - interval '1 hour'),
            count(*)
        into v_hour_count, v_day_count
        from public.draft_ranker_pairwise_rate_events event
        where event.user_id = p_user_id
          and event.action = 'queue'
          and event.decision <> 'hard_limited'
          and event.created_at >= v_now - interval '1 day';

        if v_hour_count >= v_queue_hour_limit then
            v_allowed := false;
            v_decision := 'hard_limited';
            v_reason_code := 'queue_hour_limit';
            v_retry_after_seconds := 3600;
        elsif v_day_count >= v_queue_day_limit then
            v_allowed := false;
            v_decision := 'hard_limited';
            v_reason_code := 'queue_day_limit';
            v_retry_after_seconds := 86400;
        end if;
    else
        select
            count(*) filter (where event.created_at >= v_now - interval '1 minute'),
            count(*) filter (where event.created_at >= v_now - interval '10 minutes'),
            count(*)
        into v_minute_count, v_ten_minute_count, v_hour_count
        from public.draft_ranker_pairwise_rate_events event
        where event.user_id = p_user_id
          and event.action = 'respond'
          and event.decision <> 'hard_limited'
          and event.created_at >= v_now - interval '1 hour';

        if p_low_player_id is not null then
            select count(*) into v_same_pair_week_count
            from public.draft_ranker_pairwise_rate_events event
            where event.user_id = p_user_id
              and event.action = 'respond'
              and event.low_player_id = p_low_player_id
              and event.high_player_id = p_high_player_id
              and event.decision <> 'hard_limited'
              and event.created_at >= v_now - interval '7 days';
        end if;

        if v_minute_count >= v_response_minute_limit then
            v_allowed := false;
            v_decision := 'hard_limited';
            v_reason_code := 'response_minute_limit';
            v_retry_after_seconds := 60;
        elsif v_hour_count >= v_response_hour_limit then
            v_allowed := false;
            v_decision := 'hard_limited';
            v_reason_code := 'response_hour_limit';
            v_retry_after_seconds := 3600;
        elsif not coalesce(p_community_collection_enabled, false) then
            v_decision := 'community_suppressed';
            v_reason_code := 'community_collection_disabled';
        elsif v_ten_minute_count >= v_soft_response_ten_minute_limit then
            v_decision := 'community_suppressed';
            v_reason_code := 'automated_burst';
        elsif p_low_player_id is not null
          and v_same_pair_week_count >= v_same_pair_week_limit then
            v_decision := 'community_suppressed';
            v_reason_code := 'repeated_pair_targeting';
        end if;
    end if;

    v_counts := jsonb_build_object(
        'hour', v_hour_count,
        'day', v_day_count,
        'minute', v_minute_count,
        'tenMinutes', v_ten_minute_count,
        'samePairWeek', v_same_pair_week_count
    );
    v_result := jsonb_build_object(
        'status', case when v_allowed then 'completed' else 'rate_limited' end,
        'code', v_reason_code,
        'allowed', v_allowed,
        'decision', v_decision,
        'moderationReasonCode', v_reason_code,
        'communitySuppressionReason', case
            when v_decision = 'community_suppressed' then v_reason_code
            else null
        end,
        'retryAfterSeconds', v_retry_after_seconds,
        'windowCounts', v_counts,
        'idempotentReplay', false
    );

    insert into public.draft_ranker_pairwise_rate_events (
        user_id, action, operation_id, operation_payload_hash,
        low_player_id, high_player_id, decision, reason_code,
        window_counts, result
    ) values (
        p_user_id, p_action, p_operation_id, p_operation_payload_hash,
        p_low_player_id, p_high_player_id, v_decision, v_reason_code,
        v_counts, v_result
    );

    return v_result;
end;
$$;

create or replace function public.issue_draft_ranker_pair_prompt_guarded(
    p_user_id uuid,
    p_ranking_id uuid,
    p_player_a_id bigint,
    p_player_b_id bigint,
    p_queue_mode text,
    p_queue_reason text,
    p_algorithm_version text,
    p_expected_version bigint,
    p_operation_id uuid,
    p_operation_payload_hash text,
    p_rate_operation_payload_hash text,
    p_rate_config jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
    v_rate_result jsonb;
    v_result jsonb;
begin
    v_rate_result := public.enforce_draft_ranker_pairwise_rate_limit(
        p_user_id,
        'queue',
        p_operation_id,
        p_rate_operation_payload_hash,
        null,
        null,
        true,
        p_rate_config
    );

    if v_rate_result->>'status' in ('conflict', 'rate_limited') then
        return v_rate_result;
    end if;

    v_result := public.issue_draft_ranker_pair_prompt(
        p_user_id,
        p_ranking_id,
        p_player_a_id,
        p_player_b_id,
        p_queue_mode,
        p_queue_reason,
        p_algorithm_version,
        p_expected_version,
        p_operation_id,
        p_operation_payload_hash
    );

    return v_result || jsonb_build_object('rateLimit', v_rate_result);
end;
$$;

create or replace function public.submit_draft_ranker_pair_comparison_guarded(
    p_user_id uuid,
    p_prompt_id uuid,
    p_outcome text,
    p_expected_version bigint,
    p_client_operation_id uuid,
    p_operation_payload_hash text,
    p_rate_operation_payload_hash text,
    p_community_collection_enabled boolean,
    p_rate_config jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
    v_low_player_id bigint;
    v_high_player_id bigint;
    v_rate_result jsonb;
    v_result jsonb;
    v_comparison_id uuid;
    v_suppression_reason text;
begin
    select prompt.low_player_id, prompt.high_player_id
    into v_low_player_id, v_high_player_id
    from public.draft_ranker_pair_prompts prompt
    where prompt.id = p_prompt_id
      and prompt.user_id = p_user_id;

    v_rate_result := public.enforce_draft_ranker_pairwise_rate_limit(
        p_user_id,
        'respond',
        p_client_operation_id,
        p_rate_operation_payload_hash,
        v_low_player_id,
        v_high_player_id,
        p_community_collection_enabled,
        p_rate_config
    );

    if v_rate_result->>'status' in ('conflict', 'rate_limited') then
        return v_rate_result;
    end if;

    v_result := public.submit_draft_ranker_pair_comparison(
        p_user_id,
        p_prompt_id,
        p_outcome,
        p_expected_version,
        p_client_operation_id,
        p_operation_payload_hash
    );
    v_suppression_reason := v_rate_result->>'communitySuppressionReason';

    if v_result->>'status' = 'completed' then
        if v_suppression_reason is not null
           and (
               coalesce((v_result->>'communityEligible')::boolean, false)
               or coalesce((v_result->>'communitySuppressed')::boolean, false)
           ) then
            v_result := v_result || jsonb_build_object(
                'communityEligible', false,
                'communityIneligibleReason', v_suppression_reason,
                'communitySuppressed', true
            );
        else
            v_result := v_result || jsonb_build_object(
                'communitySuppressed', false
            );
        end if;

        v_result := v_result || jsonb_build_object('rateLimit', v_rate_result);
        v_comparison_id := nullif(v_result->>'comparisonId', '')::uuid;

        if v_comparison_id is not null then
            update public.draft_ranker_pair_comparisons comparison
            set
                community_eligible = coalesce(
                    (v_result->>'communityEligible')::boolean,
                    comparison.community_eligible
                ),
                community_ineligible_reason = coalesce(
                    v_result->>'communityIneligibleReason',
                    comparison.community_ineligible_reason
                ),
                metadata = comparison.metadata || jsonb_build_object('result', v_result)
            where comparison.id = v_comparison_id
              and comparison.user_id = p_user_id;

            update public.draft_ranking_events event
            set metadata = event.metadata || jsonb_build_object('result', v_result)
            where event.user_id = p_user_id
              and event.operation_id = p_client_operation_id;
        end if;
    else
        v_result := v_result || jsonb_build_object('rateLimit', v_rate_result);
    end if;

    return v_result;
end;
$$;

revoke all on function public.enforce_draft_ranker_pairwise_rate_limit(
    uuid, text, uuid, text, bigint, bigint, boolean, jsonb
) from public, anon, authenticated;
grant execute on function public.enforce_draft_ranker_pairwise_rate_limit(
    uuid, text, uuid, text, bigint, bigint, boolean, jsonb
) to service_role;

revoke all on function public.issue_draft_ranker_pair_prompt_guarded(
    uuid, uuid, bigint, bigint, text, text, text, bigint, uuid, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.issue_draft_ranker_pair_prompt_guarded(
    uuid, uuid, bigint, bigint, text, text, text, bigint, uuid, text, text, jsonb
) to service_role;

revoke all on function public.submit_draft_ranker_pair_comparison_guarded(
    uuid, uuid, text, bigint, uuid, text, text, boolean, jsonb
) from public, anon, authenticated;
grant execute on function public.submit_draft_ranker_pair_comparison_guarded(
    uuid, uuid, text, bigint, uuid, text, text, boolean, jsonb
) to service_role;

comment on table public.draft_ranker_pairwise_rate_events is
    'Service-only distributed rate decisions and community-evidence moderation reason codes; contains no IP address or request secret.';
comment on function public.enforce_draft_ranker_pairwise_rate_limit(
    uuid, text, uuid, text, bigint, bigint, boolean, jsonb
) is 'Serializes per-account pairwise quotas and provides payload-safe operation replay across application instances.';
comment on function public.submit_draft_ranker_pair_comparison_guarded(
    uuid, uuid, text, bigint, uuid, text, text, boolean, jsonb
) is 'Preserves personal comparison effects while suppressing community eligibility for disabled collection, bursts, or repeated-pair targeting.';

-- Rollback before rollout: disable the homepage pairwise flag, drop the two
-- guarded wrapper functions and limiter function, then drop this service-only
-- event table. Existing prompts, comparisons, preferences, and personal order
-- remain intact.
