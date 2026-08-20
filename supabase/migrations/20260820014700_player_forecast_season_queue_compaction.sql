-- Collapse a large set of season-player jobs into one all-league job per view.
-- Cancelled source rows remain immutable audit evidence; the replacement job
-- carries the maximum source watermark, so no eligible change is lost.

create or replace function public.compact_player_forecast_season_queue(
  p_season_id bigint,
  p_view_key text,
  p_threshold integer default 32
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  dirty_count integer;
  source_watermark timestamptz;
  replacement public.player_forecast_season_queue;
  cancelled_count integer;
begin
  if p_season_id is null
    or p_view_key not in ('current', 'ros')
    or p_threshold not between 2 and 10000
  then
    raise exception using
      errcode = '22023',
      message = 'PLAYER_FORECAST_SEASON_QUEUE_COMPACTION_INVALID_ARGUMENT';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'player-forecast-season-queue-compaction:' || p_season_id::text || ':' || p_view_key,
      0
    )
  );

  select count(*), max(queue.source_high_watermark)
  into dirty_count, source_watermark
  from public.player_forecast_season_queue queue
  where queue.season_id = p_season_id
    and queue.view_key = p_view_key
    and queue.status in ('pending', 'failed');

  if dirty_count < p_threshold or source_watermark is null then
    return pg_catalog.jsonb_build_object(
      'compacted', false,
      'viewKey', p_view_key,
      'dirtyJobs', dirty_count,
      'threshold', p_threshold
    );
  end if;

  replacement := public.enqueue_player_forecast_season_job(
    'season:' || p_season_id || ':view:' || p_view_key || ':queue:all-league',
    p_season_id,
    p_view_key,
    null,
    null,
    null,
    'queue_compaction',
    source_watermark,
    source_watermark + interval '5 minutes',
    pg_catalog.jsonb_build_object(
      'allLeague', true,
      'compactedJobCount', dirty_count,
      'compactedThroughWatermark', source_watermark
    )
  );

  update public.player_forecast_season_queue queue
  set status = 'cancelled',
      lease_owner = null,
      lease_expires_at = null,
      claimed_watermark = null,
      last_error_code = 'compacted_into_all_league_job',
      last_error_summary = 'Superseded by queue job ' || replacement.id::text || '.',
      metadata = queue.metadata || pg_catalog.jsonb_build_object(
        'compactedIntoJobId', replacement.id,
        'compactedAt', now()
      ),
      updated_at = now()
  where queue.season_id = p_season_id
    and queue.view_key = p_view_key
    and queue.id <> replacement.id
    and queue.status in ('pending', 'failed')
    and queue.source_high_watermark <= source_watermark;
  get diagnostics cancelled_count = row_count;

  return pg_catalog.jsonb_build_object(
    'compacted', true,
    'viewKey', p_view_key,
    'replacementJobId', replacement.id,
    'sourceHighWatermark', source_watermark,
    'cancelledJobs', cancelled_count
  );
end;
$$;

revoke all on function public.compact_player_forecast_season_queue(bigint, text, integer)
  from public, anon, authenticated;
grant execute on function public.compact_player_forecast_season_queue(bigint, text, integer)
  to service_role;

