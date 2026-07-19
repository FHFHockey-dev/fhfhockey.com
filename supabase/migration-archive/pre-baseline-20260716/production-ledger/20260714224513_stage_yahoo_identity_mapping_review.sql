-- DR-011: stage legacy Yahoo mappings for explicit identity review.
--
-- The legacy map was produced with fuzzy fallbacks and contains one-to-many
-- conflicts. It is evidence, not verification. One-candidate Yahoo identities
-- may be stored as review_required mappings; ambiguous Yahoo IDs remain only
-- in the review queue so one external key is never assigned to two players.

with raw_pairs as (
    select
        btrim(mapping.nhl_player_id)::bigint as nhl_player_id,
        btrim(mapping.yahoo_player_id) as yahoo_player_id,
        max(mapping.yahoo_player_name) as yahoo_player_name,
        bool_or(
            public.immutable_unaccent(lower(regexp_replace(
                player."fullName",
                '[^[:alnum:]]+',
                '',
                'g'
            ))) = public.immutable_unaccent(lower(regexp_replace(
                coalesce(mapping.yahoo_player_name, ''),
                '[^[:alnum:]]+',
                '',
                'g'
            )))
        ) as exact_normalized_name
    from public.yahoo_nhl_player_map mapping
    join public.players player
      on btrim(mapping.nhl_player_id) ~ '^[0-9]+$'
     and player.id = btrim(mapping.nhl_player_id)::bigint
    where nullif(btrim(mapping.yahoo_player_id), '') is not null
    group by
        btrim(mapping.nhl_player_id)::bigint,
        btrim(mapping.yahoo_player_id)
),
pair_quality as (
    select
        raw.*,
        count(*) over (
            partition by raw.yahoo_player_id
        ) as yahoo_candidate_count,
        count(*) over (
            partition by raw.nhl_player_id
        ) as nhl_candidate_count
    from raw_pairs raw
),
safe_candidates as (
    select quality.*, identity.id as fhfh_player_id
    from pair_quality quality
    join public.fhfh_player_identities identity
      on identity.nhl_player_id = quality.nhl_player_id
    where quality.yahoo_candidate_count = 1
)
insert into public.fhfh_player_external_identities (
    fhfh_player_id,
    provider,
    external_player_id,
    context_key,
    season_id,
    is_primary,
    match_method,
    match_confidence,
    verification_status,
    source_provenance
)
select
    candidate.fhfh_player_id,
    'yahoo',
    yahoo.player_key,
    'yahoo:game:' || coalesce(yahoo.game_id::text, 'unknown')
        || ':season:' || coalesce(yahoo.season::text, 'unknown'),
    season.id,
    false,
    case
        when candidate.exact_normalized_name
            then 'legacy_map_exact_name_review'
        else 'legacy_map_fuzzy_review'
    end,
    case when candidate.exact_normalized_name then 1.0000 else null end,
    'review_required',
    jsonb_strip_nulls(jsonb_build_object(
        'schema_version', 1,
        'source_table', 'public.yahoo_nhl_player_map',
        'yahoo_player_id', candidate.yahoo_player_id,
        'yahoo_player_key', yahoo.player_key,
        'yahoo_game_id', yahoo.game_id,
        'yahoo_season', yahoo.season,
        'exact_normalized_name', candidate.exact_normalized_name,
        'nhl_candidate_count', candidate.nhl_candidate_count,
        'yahoo_candidate_count', candidate.yahoo_candidate_count
    ))
from safe_candidates candidate
join public.yahoo_players yahoo
  on yahoo.player_id = candidate.yahoo_player_id
left join public.seasons season
  on season.id = (yahoo.season::bigint * 10000) + (yahoo.season + 1)
on conflict (provider, context_key, external_player_id)
do update set
    season_id = excluded.season_id,
    match_method = excluded.match_method,
    match_confidence = excluded.match_confidence,
    source_provenance = excluded.source_provenance
where public.fhfh_player_external_identities.fhfh_player_id
        = excluded.fhfh_player_id
  and public.fhfh_player_external_identities.verification_status
        = 'review_required';

with raw_pairs as (
    select
        btrim(mapping.nhl_player_id)::bigint as nhl_player_id,
        btrim(mapping.yahoo_player_id) as yahoo_player_id,
        max(mapping.yahoo_player_name) as yahoo_player_name,
        bool_or(
            public.immutable_unaccent(lower(regexp_replace(
                player."fullName",
                '[^[:alnum:]]+',
                '',
                'g'
            ))) = public.immutable_unaccent(lower(regexp_replace(
                coalesce(mapping.yahoo_player_name, ''),
                '[^[:alnum:]]+',
                '',
                'g'
            )))
        ) as exact_normalized_name
    from public.yahoo_nhl_player_map mapping
    join public.players player
      on btrim(mapping.nhl_player_id) ~ '^[0-9]+$'
     and player.id = btrim(mapping.nhl_player_id)::bigint
    where nullif(btrim(mapping.yahoo_player_id), '') is not null
    group by
        btrim(mapping.nhl_player_id)::bigint,
        btrim(mapping.yahoo_player_id)
),
pair_quality as (
    select
        raw.*,
        count(*) over (
            partition by raw.yahoo_player_id
        ) as yahoo_candidate_count,
        count(*) over (
            partition by raw.nhl_player_id
        ) as nhl_candidate_count
    from raw_pairs raw
),
review_items as (
    select
        quality.yahoo_player_id,
        max(quality.yahoo_player_name) as yahoo_player_name,
        array_agg(identity.id order by identity.id) as candidate_ids,
        bool_and(quality.exact_normalized_name) as all_names_exact,
        max(quality.yahoo_candidate_count) as yahoo_candidate_count,
        max(quality.nhl_candidate_count) as max_nhl_candidate_count
    from pair_quality quality
    join public.fhfh_player_identities identity
      on identity.nhl_player_id = quality.nhl_player_id
    group by quality.yahoo_player_id
)
insert into public.fhfh_player_identity_review_queue (
    review_type,
    raw_name,
    submitted_context,
    candidate_fhfh_player_ids,
    source_evidence,
    dedupe_key,
    status
)
select
    'external_mapping',
    review.yahoo_player_name,
    jsonb_build_object(
        'provider', 'yahoo',
        'external_player_id', review.yahoo_player_id
    ),
    review.candidate_ids,
    jsonb_build_object(
        'schema_version', 1,
        'source_table', 'public.yahoo_nhl_player_map',
        'all_names_exact', review.all_names_exact,
        'yahoo_candidate_count', review.yahoo_candidate_count,
        'max_nhl_candidate_count', review.max_nhl_candidate_count,
        'requires_explicit_review', true
    ),
    'yahoo-player-id:' || review.yahoo_player_id,
    'pending'
from review_items review
on conflict (dedupe_key)
where dedupe_key is not null
  and status in ('pending', 'in_review')
do update set
    raw_name = excluded.raw_name,
    submitted_context = excluded.submitted_context,
    candidate_fhfh_player_ids = excluded.candidate_fhfh_player_ids,
    source_evidence = excluded.source_evidence;
;
