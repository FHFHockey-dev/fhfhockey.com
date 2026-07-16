-- DR-031: owner-backed watchlist and discovery dispositions.
-- Live migration ledger version: 20260715025809.

create table public.draft_ranker_player_preferences (
    ranking_id uuid not null,
    user_id uuid not null,
    fhfh_player_id bigint not null
        references public.fhfh_player_identities(id) on delete restrict,
    disposition text null,
    comparison_requested_at timestamptz null,
    source text not null default 'manual',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (ranking_id, fhfh_player_id),
    constraint draft_player_preferences_ranking_owner_fk
        foreign key (ranking_id, user_id)
        references public.draft_rankings(id, user_id) on delete cascade,
    constraint draft_player_preferences_disposition_valid check (
        disposition is null or disposition in ('dismissed', 'not_relevant')
    ),
    constraint draft_player_preferences_has_state check (
        disposition is not null or comparison_requested_at is not null
    ),
    constraint draft_player_preferences_source_nonblank check (btrim(source) <> '')
);

create index draft_player_preferences_owner
    on public.draft_ranker_player_preferences (user_id);
create index draft_player_preferences_player
    on public.draft_ranker_player_preferences (fhfh_player_id);
create index draft_player_preferences_disposition
    on public.draft_ranker_player_preferences (ranking_id, disposition)
    where disposition is not null;

create trigger draft_player_preferences_touch_updated_at
before update on public.draft_ranker_player_preferences
for each row execute function public.set_draft_ranker_updated_at();

alter table public.draft_ranker_player_preferences enable row level security;
revoke all on public.draft_ranker_player_preferences from anon, authenticated;
grant all on public.draft_ranker_player_preferences to service_role;
grant select on public.draft_ranker_player_preferences to authenticated;

create policy draft_player_preferences_owner_select
on public.draft_ranker_player_preferences
for select to authenticated
using ((select auth.uid()) = user_id);

create policy draft_player_preferences_owner_insert
on public.draft_ranker_player_preferences
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy draft_player_preferences_owner_update
on public.draft_ranker_player_preferences
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy draft_player_preferences_owner_delete
on public.draft_ranker_player_preferences
for delete to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.apply_draft_ranker_player_action(
    p_user_id uuid,
    p_ranking_id uuid,
    p_fhfh_player_id bigint,
    p_action text,
    p_operation_id uuid,
    p_priority smallint default null,
    p_note text default null,
    p_source text default 'manual'
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
    v_ranking public.draft_rankings%rowtype;
    v_identity public.fhfh_player_identities%rowtype;
    v_existing_event public.draft_ranking_events%rowtype;
    v_before jsonb;
    v_after jsonb;
    v_event_type text;
begin
    if p_user_id is null or p_ranking_id is null or p_fhfh_player_id is null
       or p_operation_id is null then
        return jsonb_build_object(
            'status', 'failed', 'code', 'invalid_request',
            'message', 'Ranking, player, operation, and account are required.'
        );
    end if;

    if p_action not in (
        'watch', 'unwatch', 'dismiss', 'not_relevant', 'restore', 'compare_now'
    ) then
        return jsonb_build_object(
            'status', 'failed', 'code', 'invalid_action',
            'message', 'Unsupported player action.'
        );
    end if;

    if p_priority is not null and p_priority not between 1 and 5 then
        return jsonb_build_object(
            'status', 'failed', 'code', 'invalid_priority',
            'message', 'Priority must be between 1 and 5.'
        );
    end if;

    if p_note is not null and length(p_note) > 500 then
        return jsonb_build_object(
            'status', 'failed', 'code', 'invalid_note',
            'message', 'Watchlist notes cannot exceed 500 characters.'
        );
    end if;

    if p_source is null or length(btrim(p_source)) not between 1 and 80 then
        return jsonb_build_object(
            'status', 'failed', 'code', 'invalid_source',
            'message', 'A bounded action source is required.'
        );
    end if;

    select ranking.*
    into v_ranking
    from public.draft_rankings ranking
    where ranking.id = p_ranking_id
      and ranking.user_id = p_user_id
      and ranking.status = 'active'
    for update;

    if not found then
        return jsonb_build_object(
            'status', 'not_found', 'code', 'ranking_not_found',
            'message', 'Draft ranking was not found.'
        );
    end if;

    select event.*
    into v_existing_event
    from public.draft_ranking_events event
    where event.ranking_id = p_ranking_id
      and event.operation_id = p_operation_id;

    if found then
        if v_existing_event.fhfh_player_id is distinct from p_fhfh_player_id
           or v_existing_event.metadata ->> 'action' is distinct from p_action then
            return jsonb_build_object(
                'status', 'conflict', 'code', 'operation_payload_conflict',
                'message', 'This operation ID was already used for another action.'
            );
        end if;
        return v_existing_event.after_state || jsonb_build_object(
            'status', 'completed', 'idempotentReplay', true
        );
    end if;

    select identity.*
    into v_identity
    from public.fhfh_player_identities identity
    where identity.id = p_fhfh_player_id
      and identity.verification_status = 'verified'
      and identity.lifecycle_status in (
          'active_nhl', 'active_prospect', 'unsigned_relevant'
      );

    if not found then
        return jsonb_build_object(
            'status', 'failed', 'code', 'player_not_rankable',
            'message', 'Only verified launch-eligible players may be acted on.'
        );
    end if;

    select jsonb_build_object(
        'isWatched', exists (
            select 1 from public.draft_ranking_watchlist watch
            where watch.ranking_id = p_ranking_id
              and watch.fhfh_player_id = p_fhfh_player_id
        ),
        'disposition', (
            select preference.disposition
            from public.draft_ranker_player_preferences preference
            where preference.ranking_id = p_ranking_id
              and preference.fhfh_player_id = p_fhfh_player_id
        ),
        'comparisonRequestedAt', (
            select preference.comparison_requested_at
            from public.draft_ranker_player_preferences preference
            where preference.ranking_id = p_ranking_id
              and preference.fhfh_player_id = p_fhfh_player_id
        )
    ) into v_before;

    if p_action = 'watch' then
        insert into public.draft_ranking_watchlist (
            ranking_id, user_id, fhfh_player_id, priority, note, source, reason
        ) values (
            p_ranking_id, p_user_id, p_fhfh_player_id, p_priority,
            nullif(btrim(p_note), ''), btrim(p_source), 'user_watch'
        )
        on conflict (ranking_id, fhfh_player_id) do update
        set priority = excluded.priority,
            note = excluded.note,
            source = excluded.source,
            reason = excluded.reason;

        delete from public.draft_ranker_player_preferences
        where ranking_id = p_ranking_id
          and fhfh_player_id = p_fhfh_player_id
          and disposition is not null;
    elsif p_action = 'unwatch' then
        delete from public.draft_ranking_watchlist
        where ranking_id = p_ranking_id
          and fhfh_player_id = p_fhfh_player_id;
    elsif p_action in ('dismiss', 'not_relevant') then
        delete from public.draft_ranking_watchlist
        where ranking_id = p_ranking_id
          and fhfh_player_id = p_fhfh_player_id;

        insert into public.draft_ranker_player_preferences (
            ranking_id, user_id, fhfh_player_id, disposition,
            comparison_requested_at, source
        ) values (
            p_ranking_id, p_user_id, p_fhfh_player_id,
            case when p_action = 'dismiss' then 'dismissed' else 'not_relevant' end,
            null, btrim(p_source)
        )
        on conflict (ranking_id, fhfh_player_id) do update
        set disposition = excluded.disposition,
            comparison_requested_at = null,
            source = excluded.source;
    elsif p_action = 'restore' then
        delete from public.draft_ranker_player_preferences
        where ranking_id = p_ranking_id
          and fhfh_player_id = p_fhfh_player_id;
    elsif p_action = 'compare_now' then
        insert into public.draft_ranker_player_preferences (
            ranking_id, user_id, fhfh_player_id, disposition,
            comparison_requested_at, source
        ) values (
            p_ranking_id, p_user_id, p_fhfh_player_id, null,
            statement_timestamp(), btrim(p_source)
        )
        on conflict (ranking_id, fhfh_player_id) do update
        set disposition = null,
            comparison_requested_at = excluded.comparison_requested_at,
            source = excluded.source;
    end if;

    select jsonb_build_object(
        'rankingId', p_ranking_id,
        'playerId', p_fhfh_player_id,
        'action', p_action,
        'isWatched', exists (
            select 1 from public.draft_ranking_watchlist watch
            where watch.ranking_id = p_ranking_id
              and watch.fhfh_player_id = p_fhfh_player_id
        ),
        'priority', (
            select watch.priority from public.draft_ranking_watchlist watch
            where watch.ranking_id = p_ranking_id
              and watch.fhfh_player_id = p_fhfh_player_id
        ),
        'note', (
            select watch.note from public.draft_ranking_watchlist watch
            where watch.ranking_id = p_ranking_id
              and watch.fhfh_player_id = p_fhfh_player_id
        ),
        'disposition', (
            select preference.disposition
            from public.draft_ranker_player_preferences preference
            where preference.ranking_id = p_ranking_id
              and preference.fhfh_player_id = p_fhfh_player_id
        ),
        'comparisonRequestedAt', (
            select preference.comparison_requested_at
            from public.draft_ranker_player_preferences preference
            where preference.ranking_id = p_ranking_id
              and preference.fhfh_player_id = p_fhfh_player_id
        )
    ) into v_after;

    v_event_type := 'player_action_' || p_action;
    insert into public.draft_ranking_events (
        ranking_id, user_id, fhfh_player_id, event_type, event_source,
        operation_id, expected_version, resulting_version,
        before_state, after_state, metadata
    ) values (
        p_ranking_id, p_user_id, p_fhfh_player_id, v_event_type,
        btrim(p_source), p_operation_id, null, v_ranking.lock_version,
        v_before, v_after, jsonb_build_object('action', p_action)
    );

    return v_after || jsonb_build_object(
        'status', 'completed', 'idempotentReplay', false
    );
end;
$$;

comment on function public.apply_draft_ranker_player_action(
    uuid, uuid, bigint, text, uuid, smallint, text, text
) is 'Service-only transactional watchlist and discovery preference action.';

revoke all on function public.apply_draft_ranker_player_action(
    uuid, uuid, bigint, text, uuid, smallint, text, text
) from public, anon, authenticated;
grant execute on function public.apply_draft_ranker_player_action(
    uuid, uuid, bigint, text, uuid, smallint, text, text
) to service_role;
