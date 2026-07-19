-- DR-040: explicit contribution consent, idempotent prompt issuance, immutable
-- pairwise responses, latest personal pair preference, and atomic order alignment.

create table public.draft_ranker_contribution_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    operation_id uuid not null,
    operation_payload_hash text not null,
    contribution_enabled boolean not null,
    privacy_policy_version text null,
    update_source text not null,
    before_state jsonb not null default '{}'::jsonb,
    after_state jsonb not null default '{}'::jsonb,
    result jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint draft_contribution_events_operation_unique
        unique (user_id, operation_id),
    constraint draft_contribution_events_hash_valid check (
        operation_payload_hash ~ '^[0-9a-f]{64}$'
    ),
    constraint draft_contribution_events_policy_nonblank check (
        privacy_policy_version is null
        or btrim(privacy_policy_version) <> ''
    ),
    constraint draft_contribution_events_source_nonblank check (
        btrim(update_source) <> ''
    ),
    constraint draft_contribution_events_state_objects check (
        jsonb_typeof(before_state) = 'object'
        and jsonb_typeof(after_state) = 'object'
        and jsonb_typeof(result) = 'object'
    )
);

create index draft_contribution_events_owner_created
on public.draft_ranker_contribution_events (user_id, created_at desc);

alter table public.draft_ranker_contribution_events enable row level security;
revoke all on public.draft_ranker_contribution_events from anon, authenticated;
grant all on public.draft_ranker_contribution_events to service_role;
grant select on public.draft_ranker_contribution_events to authenticated;

create policy draft_contribution_events_owner_select
on public.draft_ranker_contribution_events
for select to authenticated
using ((select auth.uid()) = user_id);

alter table public.draft_ranker_pair_prompts
    add column issue_operation_id uuid null,
    add column issue_payload_hash text null,
    add column ranking_version bigint null,
    add constraint draft_pair_prompts_issue_operation_unique
        unique (user_id, issue_operation_id),
    add constraint draft_pair_prompts_issue_context_valid check (
        (issue_operation_id is null and issue_payload_hash is null and ranking_version is null)
        or (
            issue_operation_id is not null
            and issue_payload_hash ~ '^[0-9a-f]{64}$'
            and ranking_version >= 0
        )
    );

create or replace function public.set_draft_ranker_contribution_preference(
    p_user_id uuid,
    p_contribution_enabled boolean,
    p_privacy_policy_version text,
    p_update_source text,
    p_operation_id uuid,
    p_operation_payload_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
    v_existing_hash text;
    v_existing_result jsonb;
    v_before jsonb;
    v_after jsonb;
    v_result jsonb;
begin
    if p_user_id is null or p_operation_id is null then
        raise exception using errcode = '22023', message = 'owner and operation IDs are required';
    end if;
    if p_contribution_enabled is null then
        raise exception using errcode = '22023', message = 'contribution state is required';
    end if;
    if nullif(btrim(p_update_source), '') is null then
        raise exception using errcode = '22023', message = 'update source is required';
    end if;
    if p_operation_payload_hash is null
       or p_operation_payload_hash !~ '^[0-9a-f]{64}$' then
        raise exception using errcode = '22023', message = 'operation payload hash must be lowercase SHA-256';
    end if;
    if p_contribution_enabled
       and nullif(btrim(p_privacy_policy_version), '') is null then
        raise exception using errcode = '22023', message = 'privacy policy version is required when opting in';
    end if;

    select event.operation_payload_hash, event.result
    into v_existing_hash, v_existing_result
    from public.draft_ranker_contribution_events event
    where event.user_id = p_user_id
      and event.operation_id = p_operation_id;

    if v_existing_hash is not null then
        if v_existing_hash <> p_operation_payload_hash then
            return jsonb_build_object(
                'status', 'conflict',
                'code', 'idempotency_conflict',
                'message', 'The operation ID was already used with a different payload.'
            );
        end if;
        return coalesce(v_existing_result, '{}'::jsonb)
            || jsonb_build_object('idempotentReplay', true);
    end if;

    insert into public.draft_ranker_contribution_preferences (
        user_id, contribution_enabled, privacy_policy_version,
        consented_at, revoked_at, update_source
    ) values (
        p_user_id, false, null, null, null, p_update_source
    ) on conflict (user_id) do nothing;

    select jsonb_build_object(
        'contributionEnabled', preference.contribution_enabled,
        'privacyPolicyVersion', preference.privacy_policy_version,
        'consentedAt', preference.consented_at,
        'revokedAt', preference.revoked_at,
        'updateSource', preference.update_source
    )
    into v_before
    from public.draft_ranker_contribution_preferences preference
    where preference.user_id = p_user_id
    for update;

    update public.draft_ranker_contribution_preferences preference
    set
        contribution_enabled = p_contribution_enabled,
        privacy_policy_version = case
            when p_contribution_enabled then btrim(p_privacy_policy_version)
            else preference.privacy_policy_version
        end,
        consented_at = case
            when p_contribution_enabled
             and (
                not preference.contribution_enabled
                or preference.privacy_policy_version is distinct from btrim(p_privacy_policy_version)
             ) then statement_timestamp()
            else preference.consented_at
        end,
        revoked_at = case
            when p_contribution_enabled then null
            else statement_timestamp()
        end,
        update_source = btrim(p_update_source)
    where preference.user_id = p_user_id;

    select jsonb_build_object(
        'contributionEnabled', preference.contribution_enabled,
        'privacyPolicyVersion', preference.privacy_policy_version,
        'consentedAt', preference.consented_at,
        'revokedAt', preference.revoked_at,
        'updateSource', preference.update_source,
        'updatedAt', preference.updated_at
    )
    into v_after
    from public.draft_ranker_contribution_preferences preference
    where preference.user_id = p_user_id;

    v_result := jsonb_build_object(
        'status', 'completed',
        'preference', v_after,
        'idempotentReplay', false
    );

    insert into public.draft_ranker_contribution_events (
        user_id, operation_id, operation_payload_hash,
        contribution_enabled, privacy_policy_version, update_source,
        before_state, after_state, result
    ) values (
        p_user_id, p_operation_id, p_operation_payload_hash,
        p_contribution_enabled,
        case when p_contribution_enabled then btrim(p_privacy_policy_version) else null end,
        btrim(p_update_source), v_before, v_after, v_result
    );

    return v_result;
end;
$$;

create or replace function public.issue_draft_ranker_pair_prompt(
    p_user_id uuid,
    p_ranking_id uuid,
    p_player_a_id bigint,
    p_player_b_id bigint,
    p_queue_mode text,
    p_queue_reason text,
    p_algorithm_version text,
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
    v_low_player_id bigint;
    v_high_player_id bigint;
    v_season_id bigint;
    v_current_version bigint;
    v_entry_count integer;
    v_existing public.draft_ranker_pair_prompts%rowtype;
    v_prompt public.draft_ranker_pair_prompts%rowtype;
begin
    if p_user_id is null or p_ranking_id is null
       or p_player_a_id is null or p_player_b_id is null
       or p_operation_id is null then
        raise exception using errcode = '22023', message = 'owner, ranking, players, and operation IDs are required';
    end if;
    if p_player_a_id = p_player_b_id then
        raise exception using errcode = '22023', message = 'a pair requires two different players';
    end if;
    if p_expected_version is null or p_expected_version < 0 then
        raise exception using errcode = '22023', message = 'expected version must be nonnegative';
    end if;
    if nullif(btrim(p_queue_mode), '') is null
       or nullif(btrim(p_queue_reason), '') is null
       or nullif(btrim(p_algorithm_version), '') is null then
        raise exception using errcode = '22023', message = 'queue mode, reason, and algorithm version are required';
    end if;
    if p_operation_payload_hash is null
       or p_operation_payload_hash !~ '^[0-9a-f]{64}$' then
        raise exception using errcode = '22023', message = 'operation payload hash must be lowercase SHA-256';
    end if;

    v_low_player_id := least(p_player_a_id, p_player_b_id);
    v_high_player_id := greatest(p_player_a_id, p_player_b_id);

    select prompt.* into v_existing
    from public.draft_ranker_pair_prompts prompt
    where prompt.user_id = p_user_id
      and prompt.issue_operation_id = p_operation_id;

    if v_existing.id is not null then
        if v_existing.issue_payload_hash <> p_operation_payload_hash then
            return jsonb_build_object(
                'status', 'conflict',
                'code', 'idempotency_conflict',
                'message', 'The operation ID was already used with a different payload.'
            );
        end if;
        return jsonb_build_object(
            'status', 'completed',
            'promptId', v_existing.id,
            'rankingId', v_existing.ranking_id,
            'seasonId', v_existing.season_id,
            'lowPlayerId', v_existing.low_player_id,
            'highPlayerId', v_existing.high_player_id,
            'rankingVersion', v_existing.ranking_version,
            'expiresAt', v_existing.expires_at,
            'idempotentReplay', true
        );
    end if;

    select ranking.target_season_id, ranking.lock_version
    into v_season_id, v_current_version
    from public.draft_rankings ranking
    where ranking.id = p_ranking_id
      and ranking.user_id = p_user_id
      and ranking.status = 'active'
    for update;

    if v_season_id is null then
        return jsonb_build_object(
            'status', 'not_found', 'code', 'not_found',
            'message', 'The requested ranking was not found.'
        );
    end if;
    if v_current_version <> p_expected_version then
        return jsonb_build_object(
            'status', 'conflict', 'code', 'stale_ranking_version',
            'expectedVersion', p_expected_version,
            'currentVersion', v_current_version,
            'message', 'The ranking changed. Reload before requesting comparisons.'
        );
    end if;

    select count(*) into v_entry_count
    from public.draft_ranking_entries entry
    where entry.ranking_id = p_ranking_id
      and entry.user_id = p_user_id
      and entry.fhfh_player_id in (v_low_player_id, v_high_player_id);

    if v_entry_count <> 2 then
        return jsonb_build_object(
            'status', 'failed', 'code', 'players_not_placed',
            'message', 'Both comparison players must be placed in this ranking.'
        );
    end if;

    update public.draft_ranker_pair_prompts prompt
    set status = 'expired'
    where prompt.user_id = p_user_id
      and prompt.ranking_id = p_ranking_id
      and prompt.status = 'issued'
      and prompt.expires_at <= statement_timestamp();

    insert into public.draft_ranker_pair_prompts (
        user_id, ranking_id, season_id, low_player_id, high_player_id,
        queue_mode, queue_reason, algorithm_version,
        issue_operation_id, issue_payload_hash, ranking_version,
        expires_at, metadata
    ) values (
        p_user_id, p_ranking_id, v_season_id, v_low_player_id, v_high_player_id,
        btrim(p_queue_mode), btrim(p_queue_reason), btrim(p_algorithm_version),
        p_operation_id, p_operation_payload_hash, v_current_version,
        statement_timestamp() + interval '15 minutes',
        jsonb_build_object('operation_payload_hash', p_operation_payload_hash)
    ) returning * into v_prompt;

    return jsonb_build_object(
        'status', 'completed',
        'promptId', v_prompt.id,
        'rankingId', v_prompt.ranking_id,
        'seasonId', v_prompt.season_id,
        'lowPlayerId', v_prompt.low_player_id,
        'highPlayerId', v_prompt.high_player_id,
        'rankingVersion', v_prompt.ranking_version,
        'expiresAt', v_prompt.expires_at,
        'idempotentReplay', false
    );
end;
$$;

create or replace function public.submit_draft_ranker_pair_comparison(
    p_user_id uuid,
    p_prompt_id uuid,
    p_outcome text,
    p_expected_version bigint,
    p_client_operation_id uuid,
    p_operation_payload_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
    v_prompt public.draft_ranker_pair_prompts%rowtype;
    v_existing public.draft_ranker_pair_comparisons%rowtype;
    v_existing_prompt_comparison uuid;
    v_ranking_version bigint;
    v_consent_enabled boolean := false;
    v_consent_policy_version text;
    v_community_eligible boolean := false;
    v_ineligible_reason text;
    v_preferred_player_id bigint;
    v_loser_player_id bigint;
    v_previous_preference public.draft_ranker_pair_preferences%rowtype;
    v_winner_order_key bigint;
    v_loser_order_key bigint;
    v_comparison_id uuid;
    v_reorder_result jsonb;
    v_resulting_version bigint;
    v_result jsonb;
    v_reordered boolean := false;
    v_reversal boolean := false;
begin
    if p_user_id is null or p_prompt_id is null or p_client_operation_id is null then
        raise exception using errcode = '22023', message = 'owner, prompt, and operation IDs are required';
    end if;
    if p_outcome not in ('low', 'high', 'too_close', 'skip') then
        raise exception using errcode = '22023', message = 'unsupported comparison outcome';
    end if;
    if p_expected_version is null or p_expected_version < 0 then
        raise exception using errcode = '22023', message = 'expected version must be nonnegative';
    end if;
    if p_operation_payload_hash is null
       or p_operation_payload_hash !~ '^[0-9a-f]{64}$' then
        raise exception using errcode = '22023', message = 'operation payload hash must be lowercase SHA-256';
    end if;

    select comparison.* into v_existing
    from public.draft_ranker_pair_comparisons comparison
    where comparison.user_id = p_user_id
      and comparison.client_operation_id = p_client_operation_id;

    if v_existing.id is not null then
        if v_existing.metadata->>'operation_payload_hash' <> p_operation_payload_hash then
            return jsonb_build_object(
                'status', 'conflict', 'code', 'idempotency_conflict',
                'message', 'The operation ID was already used with a different payload.'
            );
        end if;
        return coalesce(v_existing.metadata->'result', '{}'::jsonb)
            || jsonb_build_object('idempotentReplay', true);
    end if;

    select prompt.* into v_prompt
    from public.draft_ranker_pair_prompts prompt
    where prompt.id = p_prompt_id
      and prompt.user_id = p_user_id
    for update;

    if v_prompt.id is null then
        return jsonb_build_object(
            'status', 'not_found', 'code', 'not_found',
            'message', 'The comparison prompt was not found.'
        );
    end if;

    select comparison.id into v_existing_prompt_comparison
    from public.draft_ranker_pair_comparisons comparison
    where comparison.prompt_id = p_prompt_id;

    if v_existing_prompt_comparison is not null or v_prompt.status = 'completed' then
        return jsonb_build_object(
            'status', 'conflict', 'code', 'prompt_already_completed',
            'message', 'This comparison prompt has already been answered.'
        );
    end if;
    if v_prompt.status <> 'issued' then
        return jsonb_build_object(
            'status', 'failed', 'code', 'prompt_not_active',
            'message', 'This comparison prompt is no longer active.'
        );
    end if;
    if v_prompt.expires_at <= statement_timestamp() then
        update public.draft_ranker_pair_prompts
        set status = 'expired'
        where id = v_prompt.id;
        return jsonb_build_object(
            'status', 'failed', 'code', 'prompt_expired',
            'message', 'This comparison prompt has expired.'
        );
    end if;

    select ranking.lock_version into v_ranking_version
    from public.draft_rankings ranking
    where ranking.id = v_prompt.ranking_id
      and ranking.user_id = p_user_id
      and ranking.status = 'active'
    for update;

    if v_ranking_version is null then
        return jsonb_build_object(
            'status', 'not_found', 'code', 'not_found',
            'message', 'The requested ranking was not found.'
        );
    end if;
    if v_ranking_version <> p_expected_version then
        return jsonb_build_object(
            'status', 'conflict', 'code', 'stale_ranking_version',
            'expectedVersion', p_expected_version,
            'currentVersion', v_ranking_version,
            'message', 'The ranking changed. Request a fresh comparison.'
        );
    end if;

    select preference.contribution_enabled, preference.privacy_policy_version
    into v_consent_enabled, v_consent_policy_version
    from public.draft_ranker_contribution_preferences preference
    where preference.user_id = p_user_id;

    v_consent_enabled := coalesce(v_consent_enabled, false);
    v_community_eligible := v_consent_enabled and p_outcome in ('low', 'high');
    v_ineligible_reason := case
        when p_outcome = 'skip' then 'skip'
        when p_outcome = 'too_close' then 'too_close'
        when not v_consent_enabled then 'consent_not_enabled'
        else null
    end;
    v_preferred_player_id := case
        when p_outcome = 'low' then v_prompt.low_player_id
        when p_outcome = 'high' then v_prompt.high_player_id
        else null
    end;
    v_loser_player_id := case
        when p_outcome = 'low' then v_prompt.high_player_id
        when p_outcome = 'high' then v_prompt.low_player_id
        else null
    end;

    select preference.* into v_previous_preference
    from public.draft_ranker_pair_preferences preference
    where preference.user_id = p_user_id
      and preference.ranking_id = v_prompt.ranking_id
      and preference.season_id = v_prompt.season_id
      and preference.low_player_id = v_prompt.low_player_id
      and preference.high_player_id = v_prompt.high_player_id;

    v_reversal := v_previous_preference.comparison_id is not null
        and v_previous_preference.preferred_player_id <> v_preferred_player_id
        and v_preferred_player_id is not null;

    insert into public.draft_ranker_pair_comparisons (
        prompt_id, user_id, ranking_id, season_id,
        low_player_id, high_player_id, outcome, client_operation_id,
        consent_enabled, consent_policy_version,
        community_eligible, community_ineligible_reason,
        ranking_version, metadata
    ) values (
        v_prompt.id, p_user_id, v_prompt.ranking_id, v_prompt.season_id,
        v_prompt.low_player_id, v_prompt.high_player_id,
        p_outcome, p_client_operation_id,
        v_consent_enabled, v_consent_policy_version,
        v_community_eligible, v_ineligible_reason,
        v_ranking_version,
        jsonb_build_object(
            'operation_payload_hash', p_operation_payload_hash,
            'algorithm_version', v_prompt.algorithm_version,
            'queue_mode', v_prompt.queue_mode,
            'reversal', v_reversal,
            'supersedesComparisonId', v_previous_preference.comparison_id
        )
    ) returning id into v_comparison_id;

    update public.draft_ranker_pair_prompts
    set status = 'completed', completed_at = statement_timestamp()
    where id = v_prompt.id;

    if v_preferred_player_id is not null then
        insert into public.draft_ranker_pair_preferences (
            user_id, ranking_id, season_id,
            low_player_id, high_player_id, preferred_player_id,
            comparison_id, established_at
        ) values (
            p_user_id, v_prompt.ranking_id, v_prompt.season_id,
            v_prompt.low_player_id, v_prompt.high_player_id,
            v_preferred_player_id, v_comparison_id, statement_timestamp()
        ) on conflict (user_id, ranking_id, season_id, low_player_id, high_player_id)
        do update set
            preferred_player_id = excluded.preferred_player_id,
            comparison_id = excluded.comparison_id,
            established_at = excluded.established_at;

        select winner.order_key, loser.order_key
        into v_winner_order_key, v_loser_order_key
        from public.draft_ranking_entries winner
        join public.draft_ranking_entries loser
          on loser.ranking_id = winner.ranking_id
         and loser.user_id = winner.user_id
         and loser.fhfh_player_id = v_loser_player_id
        where winner.ranking_id = v_prompt.ranking_id
          and winner.user_id = p_user_id
          and winner.fhfh_player_id = v_preferred_player_id;

        if v_winner_order_key is null or v_loser_order_key is null then
            raise exception using errcode = '23503', message = 'comparison players must remain placed';
        end if;

        if v_winner_order_key > v_loser_order_key then
            v_reorder_result := public.reorder_draft_ranking(
                p_user_id,
                v_prompt.ranking_id,
                v_preferred_player_id,
                'insert_above',
                null,
                v_loser_player_id,
                v_ranking_version,
                p_client_operation_id,
                p_operation_payload_hash
            );
            if v_reorder_result->>'status' <> 'completed' then
                raise exception using errcode = 'P0001',
                    message = 'pairwise order alignment failed';
            end if;
            v_reordered := true;
            v_resulting_version := (v_reorder_result->>'resultingVersion')::bigint;

            update public.draft_ranking_events event
            set
                event_type = 'pairwise_order_aligned',
                event_source = 'pairwise',
                metadata = event.metadata || jsonb_build_object(
                    'comparisonId', v_comparison_id,
                    'promptId', v_prompt.id,
                    'outcome', p_outcome,
                    'reversal', v_reversal
                )
            where event.ranking_id = v_prompt.ranking_id
              and event.operation_id = p_client_operation_id;
        end if;
    end if;

    v_resulting_version := coalesce(v_resulting_version, v_ranking_version);
    v_result := jsonb_build_object(
        'status', 'completed',
        'comparisonId', v_comparison_id,
        'promptId', v_prompt.id,
        'rankingId', v_prompt.ranking_id,
        'outcome', p_outcome,
        'preferredPlayerId', v_preferred_player_id,
        'reversal', v_reversal,
        'reordered', v_reordered,
        'expectedVersion', p_expected_version,
        'resultingVersion', v_resulting_version,
        'communityEligible', v_community_eligible,
        'communityIneligibleReason', v_ineligible_reason,
        'consentPolicyVersion', v_consent_policy_version,
        'idempotentReplay', false
    );

    if not v_reordered then
        insert into public.draft_ranking_events (
            ranking_id, user_id, event_type, event_source, operation_id,
            expected_version, resulting_version, before_state, after_state, metadata
        ) values (
            v_prompt.ranking_id, p_user_id,
            'pairwise_response_recorded', 'pairwise', p_client_operation_id,
            null, v_resulting_version,
            jsonb_build_object(
                'previousPreferencePlayerId', v_previous_preference.preferred_player_id
            ),
            jsonb_build_object(
                'preferredPlayerId', v_preferred_player_id,
                'outcome', p_outcome
            ),
            jsonb_build_object(
                'operation_payload_hash', p_operation_payload_hash,
                'comparisonId', v_comparison_id,
                'promptId', v_prompt.id,
                'reversal', v_reversal,
                'submittedRankingVersion', v_ranking_version,
                'result', v_result
            )
        );
    else
        update public.draft_ranking_events event
        set metadata = event.metadata || jsonb_build_object('result', v_result)
        where event.ranking_id = v_prompt.ranking_id
          and event.operation_id = p_client_operation_id;
    end if;

    update public.draft_ranker_pair_comparisons comparison
    set metadata = comparison.metadata || jsonb_build_object('result', v_result)
    where comparison.id = v_comparison_id;

    return v_result;
end;
$$;

revoke all on function public.set_draft_ranker_contribution_preference(
    uuid, boolean, text, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.set_draft_ranker_contribution_preference(
    uuid, boolean, text, text, uuid, text
) to service_role;

revoke all on function public.issue_draft_ranker_pair_prompt(
    uuid, uuid, bigint, bigint, text, text, text, bigint, uuid, text
) from public, anon, authenticated;
grant execute on function public.issue_draft_ranker_pair_prompt(
    uuid, uuid, bigint, bigint, text, text, text, bigint, uuid, text
) to service_role;

revoke all on function public.submit_draft_ranker_pair_comparison(
    uuid, uuid, text, bigint, uuid, text
) from public, anon, authenticated;
grant execute on function public.submit_draft_ranker_pair_comparison(
    uuid, uuid, text, bigint, uuid, text
) to service_role;

comment on table public.draft_ranker_contribution_events is
    'Immutable audit history for explicit community-contribution consent changes.';
comment on function public.submit_draft_ranker_pair_comparison(
    uuid, uuid, text, bigint, uuid, text
) is 'Records one prompt-issued comparison and aligns contradictory personal order without creating synthetic wins.';

-- Rollback before rollout: drop the three functions, contribution event table,
-- and the three prompt issuance columns/constraints. Immutable comparisons and
-- personal rankings remain valid if this feature is disabled instead.
;
