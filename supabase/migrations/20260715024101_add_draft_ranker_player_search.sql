-- DR-030: canonical Draft Ranker player search and safe addition requests.
-- Live migration ledger version: 20260715024101.
--
-- Identity data remains service-only. The browser reaches these functions only
-- through authenticated Next.js API routes, and those routes derive the owner
-- UUID from the verified Supabase session.

-- The repository already carries this hardened definition, but the live
-- project predates that migration. Reassert it here because the expression
-- indexes and hardened service functions must work with an empty search path.
create or replace function public.immutable_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
security invoker
cost 100
set search_path = ''
as $function$
    select public.unaccent(
        'public.unaccent'::pg_catalog.regdictionary,
        $1
    )
$function$;

create index if not exists idx_fhfh_player_identities_name_trgm
    on public.fhfh_player_identities
    using gin (
        (public.immutable_unaccent(lower(canonical_name)))
        public.gin_trgm_ops
    );

create index if not exists idx_fhfh_player_aliases_name_trgm
    on public.fhfh_player_identity_aliases
    using gin (
        (public.immutable_unaccent(lower(normalized_alias)))
        public.gin_trgm_ops
    )
    where verification_status = 'verified';

create or replace function public.search_fhfh_draft_players(
    p_query text,
    p_include_archived boolean default false,
    p_limit integer default 20
)
returns table (
    player_id bigint,
    canonical_name text,
    birth_year smallint,
    canonical_position text,
    current_organization_name text,
    current_organization_type text,
    lifecycle_status text,
    headshot_url text,
    nhl_player_id bigint,
    yahoo_player_id text,
    external_providers text[],
    is_rankable boolean,
    match_kind text,
    similarity_score real
)
language sql
stable
security invoker
set search_path = pg_catalog
as $$
with input as (
    select
        public.immutable_unaccent(lower(btrim(p_query))) as normalized_query,
        least(greatest(coalesce(p_limit, 20), 1), 25) as result_limit
),
alias_matches as (
    select
        alias.fhfh_player_id,
        bool_or(
            public.immutable_unaccent(lower(alias.normalized_alias))
                = input.normalized_query
        ) as exact_match,
        bool_or(
            public.immutable_unaccent(lower(alias.normalized_alias))
                like input.normalized_query || '%'
        ) as prefix_match,
        max(
            public.similarity(
                public.immutable_unaccent(lower(alias.normalized_alias)),
                input.normalized_query
            )
        )::real as similarity_score
    from public.fhfh_player_identity_aliases alias
    cross join input
    where alias.verification_status = 'verified'
      and (
          public.immutable_unaccent(lower(alias.normalized_alias))
              = input.normalized_query
          or public.immutable_unaccent(lower(alias.normalized_alias))
              like input.normalized_query || '%'
          or public.similarity(
              public.immutable_unaccent(lower(alias.normalized_alias)),
              input.normalized_query
          ) >= 0.25
      )
    group by alias.fhfh_player_id
),
external_identity as (
    select
        external.fhfh_player_id,
        array_agg(distinct external.provider order by external.provider)
            filter (where external.verification_status = 'verified')
            as providers,
        max(external.external_player_id)
            filter (
                where external.provider = 'yahoo'
                  and external.verification_status = 'verified'
            ) as yahoo_player_id,
        bool_or(
            external.verification_status = 'verified'
            and lower(external.external_player_id) = input.normalized_query
        ) as external_id_match
    from public.fhfh_player_external_identities external
    cross join input
    group by external.fhfh_player_id
),
matched as (
    select
        identity.id as player_id,
        identity.canonical_name,
        extract(year from identity.birth_date)::smallint as birth_year,
        identity.canonical_position::text as canonical_position,
        identity.current_organization_name,
        identity.current_organization_type,
        identity.lifecycle_status,
        identity.headshot_url,
        identity.nhl_player_id,
        external.yahoo_player_id,
        coalesce(external.providers, '{}'::text[]) as external_providers,
        identity.lifecycle_status in (
            'active_nhl',
            'active_prospect',
            'unsigned_relevant'
        ) as is_rankable,
        public.immutable_unaccent(lower(identity.canonical_name))
            = input.normalized_query as canonical_exact,
        public.immutable_unaccent(lower(identity.canonical_name))
            like input.normalized_query || '%' as canonical_prefix,
        coalesce(alias_match.exact_match, false) as alias_exact,
        coalesce(alias_match.prefix_match, false) as alias_prefix,
        coalesce(external.external_id_match, false)
            or identity.nhl_player_id::text = input.normalized_query
            as external_id_exact,
        greatest(
            public.similarity(
                public.immutable_unaccent(lower(identity.canonical_name)),
                input.normalized_query
            ),
            coalesce(alias_match.similarity_score, 0)
        )::real as best_similarity,
        input.result_limit
    from public.fhfh_player_identities identity
    cross join input
    left join alias_matches alias_match
        on alias_match.fhfh_player_id = identity.id
    left join external_identity external
        on external.fhfh_player_id = identity.id
    where length(input.normalized_query) between 2 and 80
      and identity.verification_status = 'verified'
      and (
          identity.lifecycle_status in (
              'active_nhl',
              'active_prospect',
              'unsigned_relevant'
          )
          or (
              p_include_archived
              and identity.lifecycle_status in (
                  'inactive',
                  'retired',
                  'overseas',
                  'deceased'
              )
          )
      )
      and (
          public.immutable_unaccent(lower(identity.canonical_name))
              = input.normalized_query
          or public.immutable_unaccent(lower(identity.canonical_name))
              like input.normalized_query || '%'
          or public.similarity(
              public.immutable_unaccent(lower(identity.canonical_name)),
              input.normalized_query
          ) >= 0.25
          or alias_match.fhfh_player_id is not null
          or coalesce(external.external_id_match, false)
          or identity.nhl_player_id::text = input.normalized_query
      )
)
select
    matched.player_id,
    matched.canonical_name,
    matched.birth_year,
    matched.canonical_position,
    matched.current_organization_name,
    matched.current_organization_type,
    matched.lifecycle_status,
    matched.headshot_url,
    matched.nhl_player_id,
    matched.yahoo_player_id,
    matched.external_providers,
    matched.is_rankable,
    case
        when matched.external_id_exact then 'external_id_exact'
        when matched.canonical_exact then 'canonical_exact'
        when matched.alias_exact then 'alias_exact'
        when matched.canonical_prefix then 'canonical_prefix'
        when matched.alias_prefix then 'alias_prefix'
        else 'fuzzy'
    end as match_kind,
    matched.best_similarity as similarity_score
from matched
order by
    matched.external_id_exact desc,
    matched.canonical_exact desc,
    matched.alias_exact desc,
    matched.canonical_prefix desc,
    matched.alias_prefix desc,
    matched.is_rankable desc,
    (matched.lifecycle_status = 'active_nhl') desc,
    (matched.current_organization_type = 'nhl') desc,
    (matched.yahoo_player_id is not null) desc,
    matched.best_similarity desc,
    matched.canonical_name,
    matched.player_id
limit (select result_limit from input);
$$;

comment on function public.search_fhfh_draft_players(text, boolean, integer) is
    'Service-only canonical player search for Draft Ranker autocomplete.';

revoke all on function public.search_fhfh_draft_players(text, boolean, integer)
    from public, anon, authenticated;
grant execute on function public.search_fhfh_draft_players(text, boolean, integer)
    to service_role;

create or replace function public.request_fhfh_player_addition(
    p_user_id uuid,
    p_raw_name text,
    p_submitted_context jsonb default '{}'::jsonb,
    p_candidate_fhfh_player_ids bigint[] default '{}'::bigint[]
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
    v_normalized_name text;
    v_dedupe_key text;
    v_existing public.fhfh_player_identity_review_queue%rowtype;
    v_recent_count integer;
    v_retry_after_seconds integer;
    v_request public.fhfh_player_identity_review_queue%rowtype;
begin
    if p_user_id is null then
        return jsonb_build_object(
            'status', 'failed',
            'code', 'invalid_user',
            'message', 'An authenticated account is required.'
        );
    end if;

    if p_raw_name is null or length(btrim(p_raw_name)) not between 2 and 120 then
        return jsonb_build_object(
            'status', 'failed',
            'code', 'invalid_name',
            'message', 'Player name must be between 2 and 120 characters.'
        );
    end if;

    if p_submitted_context is null
       or jsonb_typeof(p_submitted_context) <> 'object'
       or octet_length(p_submitted_context::text) > 8192 then
        return jsonb_build_object(
            'status', 'failed',
            'code', 'invalid_context',
            'message', 'Request context must be an object no larger than 8 KB.'
        );
    end if;

    if coalesce(cardinality(p_candidate_fhfh_player_ids), 0) > 10 then
        return jsonb_build_object(
            'status', 'failed',
            'code', 'too_many_candidates',
            'message', 'No more than 10 candidate identities may be supplied.'
        );
    end if;

    if exists (
        select 1
        from unnest(coalesce(p_candidate_fhfh_player_ids, '{}'::bigint[])) id
        where not exists (
            select 1
            from public.fhfh_player_identities identity
            where identity.id = id
        )
    ) then
        return jsonb_build_object(
            'status', 'failed',
            'code', 'invalid_candidate',
            'message', 'One or more candidate identities do not exist.'
        );
    end if;

    v_normalized_name := regexp_replace(
        public.immutable_unaccent(lower(btrim(p_raw_name))),
        '[^[:alnum:]]+',
        ' ',
        'g'
    );
    v_normalized_name := regexp_replace(btrim(v_normalized_name), '\s+', ' ', 'g');
    v_dedupe_key := 'player_addition:' || p_user_id::text || ':' || md5(v_normalized_name);

    perform pg_advisory_xact_lock(
        hashtextextended('fhfh-player-addition:' || p_user_id::text, 0)
    );

    select review.*
    into v_existing
    from public.fhfh_player_identity_review_queue review
    where review.dedupe_key = v_dedupe_key
      and review.status in ('pending', 'in_review')
    order by review.created_at desc
    limit 1;

    if found then
        return jsonb_build_object(
            'status', 'duplicate',
            'requestId', v_existing.id,
            'requestStatus', v_existing.status,
            'created', false
        );
    end if;

    select count(*)::integer
    into v_recent_count
    from public.fhfh_player_identity_review_queue review
    where review.requested_by = p_user_id
      and review.review_type = 'player_addition'
      and review.created_at >= statement_timestamp() - interval '24 hours';

    if v_recent_count >= 5 then
        select greatest(
            1,
            ceil(extract(epoch from (
                min(review.created_at) + interval '24 hours'
                - statement_timestamp()
            )))::integer
        )
        into v_retry_after_seconds
        from public.fhfh_player_identity_review_queue review
        where review.requested_by = p_user_id
          and review.review_type = 'player_addition'
          and review.created_at >= statement_timestamp() - interval '24 hours';

        return jsonb_build_object(
            'status', 'rate_limited',
            'code', 'player_addition_rate_limit',
            'message', 'You can submit up to five player requests per day.',
            'retryAfterSeconds', coalesce(v_retry_after_seconds, 86400)
        );
    end if;

    insert into public.fhfh_player_identity_review_queue (
        review_type,
        requested_by,
        raw_name,
        submitted_context,
        candidate_fhfh_player_ids,
        source_evidence,
        dedupe_key,
        status
    ) values (
        'player_addition',
        p_user_id,
        btrim(p_raw_name),
        p_submitted_context,
        coalesce(p_candidate_fhfh_player_ids, '{}'::bigint[]),
        jsonb_build_object(
            'source', 'draft_ranker_search',
            'submittedAt', statement_timestamp()
        ),
        v_dedupe_key,
        'pending'
    )
    returning * into v_request;

    return jsonb_build_object(
        'status', 'completed',
        'requestId', v_request.id,
        'requestStatus', v_request.status,
        'created', true
    );
end;
$$;

comment on function public.request_fhfh_player_addition(uuid, text, jsonb, bigint[]) is
    'Service-only, deduplicated and rate-limited player-addition request intake.';

revoke all on function public.request_fhfh_player_addition(uuid, text, jsonb, bigint[])
    from public, anon, authenticated;
grant execute on function public.request_fhfh_player_addition(uuid, text, jsonb, bigint[])
    to service_role;
