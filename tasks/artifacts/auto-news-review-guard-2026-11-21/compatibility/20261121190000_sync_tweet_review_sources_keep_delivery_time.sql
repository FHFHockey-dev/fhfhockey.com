BEGIN;

CREATE FUNCTION public.sync_tweet_review_sources_v1(p_rows jsonb) RETURNS void
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = ''
AS $function$
  -- The candidate builders choose one source per dedupe_key before batching.
  INSERT INTO public.tweet_pattern_review_items AS stored (
    dedupe_key, source_table, source_row_key, source_group, source_key, source_account, source_label,
    source_handle, author_name, snapshot_date, source_created_at, tweet_id, tweet_url, source_url,
    quoted_tweet_id, quoted_tweet_url, team_id, team_abbreviation, parser_classification,
    parser_filter_status, parser_filter_reason, keyword_hits, review_text, raw_text, enriched_text,
    quoted_text, metadata
  )
  SELECT
    src.dedupe_key, src.source_table, src.source_row_key, src.source_group, src.source_key,
    src.source_account, src.source_label, src.source_handle, src.author_name, src.snapshot_date,
    src.source_created_at, src.tweet_id, src.tweet_url, src.source_url, src.quoted_tweet_id,
    src.quoted_tweet_url, src.team_id, src.team_abbreviation, src.parser_classification,
    src.parser_filter_status, src.parser_filter_reason, COALESCE(src.keyword_hits, '{}'::text[]),
    src.review_text, src.raw_text, src.enriched_text, src.quoted_text,
    -- Import only metadata owned by the four source builders.
    COALESCE((SELECT jsonb_object_agg(key, value) FROM jsonb_each(src.metadata)
      WHERE key = ANY (ARRAY[
        'primaryTextSource', 'originalPrimaryTextSource', 'preferredQuotedAttribution',
        'tweetPostedLabel', 'sourceRowStatus', 'wrapperAuthorName', 'wrapperAuthorHandle',
        'quotedAuthorName', 'quotedAuthorHandle', 'quotedTweetId', 'quotedTweetUrl',
        'retainedInterpretation', 'intakeRosterEvidence', 'retainedGameId', 'createdAtLabel',
        'sourceProcessingStatus'
      ])), '{}'::jsonb)
  FROM jsonb_populate_recordset(NULL::public.tweet_pattern_review_items, p_rows) AS src
  ON CONFLICT (dedupe_key) DO UPDATE SET
    (
      source_table, source_row_key, source_group, source_key, source_account, source_label,
      source_handle, author_name, snapshot_date, source_created_at, tweet_id, tweet_url, source_url,
      quoted_tweet_id, quoted_tweet_url, team_id, team_abbreviation, parser_classification,
      parser_filter_status, parser_filter_reason, keyword_hits, review_text, raw_text, enriched_text,
      quoted_text
    ) = (
      excluded.source_table, excluded.source_row_key, excluded.source_group, excluded.source_key,
      excluded.source_account, excluded.source_label, excluded.source_handle, excluded.author_name,
      excluded.snapshot_date, excluded.source_created_at, excluded.tweet_id, excluded.tweet_url,
      excluded.source_url, excluded.quoted_tweet_id, excluded.quoted_tweet_url, excluded.team_id,
      excluded.team_abbreviation, excluded.parser_classification, excluded.parser_filter_status,
      excluded.parser_filter_reason, excluded.keyword_hits, excluded.review_text, excluded.raw_text,
      excluded.enriched_text, excluded.quoted_text
    ),
    -- An absent roster-evidence key clears that source revision's evidence.
    metadata = (stored.metadata - 'intakeRosterEvidence') || excluded.metadata,
    -- Each accepted delivery advances the clock, even for an identical source row.
    -- Preserve millisecond progress for JS readers if the stored clock is ahead.
    updated_at = greatest(clock_timestamp(), stored.updated_at + interval '1 millisecond');
$function$;

REVOKE ALL ON FUNCTION public.sync_tweet_review_sources_v1(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_tweet_review_sources_v1(jsonb) TO service_role;

COMMIT;
