-- REVIEW CANDIDATE ONLY: not an authorized/applied migration or activation.
-- Existing season queue only; cannot publish native FORGE revisions.
-- Namespaced cadence scopes opt in. Legacy watermark scopes are unchanged.
BEGIN;
CREATE FUNCTION public.enqueue_player_forecast_morning_cadence(
  p_date date, p_view_key text, p_required_sources text[], p_sources jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  due_at timestamptz;
  issued_at timestamptz := pg_catalog.clock_timestamp();
  scope text;
  existing public.player_forecast_season_queue;
BEGIN
  IF p_date IS NULL OR p_view_key IS NULL OR p_view_key NOT IN ('current','ros')
    OR p_required_sources IS NULL OR cardinality(p_required_sources) NOT BETWEEN 1 AND 32
    OR EXISTS (SELECT 1 FROM unnest(p_required_sources) k WHERE k IS NULL OR btrim(k)='')
    OR (SELECT count(DISTINCT k) FROM unnest(p_required_sources) k) <> cardinality(p_required_sources)
    OR p_sources IS NULL OR pg_catalog.jsonb_typeof(p_sources) <> 'array'
    OR pg_catalog.octet_length(p_sources::text)>65536 THEN
    RAISE EXCEPTION 'FORECAST_CADENCE_INPUT_INVALID';
  END IF;
  due_at := (p_date + time '08:00') AT TIME ZONE 'America/New_York';
  IF (issued_at AT TIME ZONE 'America/New_York')::date <> p_date OR issued_at < due_at THEN
    RETURN pg_catalog.jsonb_build_object('outcome','held','reason','not_due_or_date_expired');
  END IF;
  -- Explicit source receipts and exact completed-item counts; timestamps alone
  -- are insufficient. The upstream owner must enumerate the required sources.
  IF EXISTS (
    SELECT 1 FROM unnest(p_required_sources) required_key
    WHERE (SELECT count(*) FROM pg_catalog.jsonb_array_elements(p_sources) s WHERE s->>'key'=required_key AND s->>'date'=p_date::text)<>1
      OR NOT EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_sources) s
        WHERE s->>'key'=required_key AND s->>'date'=p_date::text AND s->>'status'='complete'
          AND nullif(btrim(s->>'revision'),'') IS NOT NULL
          AND s->>'expectedItems' ~ '^[0-9]+$'
          AND (s->>'expectedItems')::numeric<=9007199254740991
          AND s->>'completedItems'=s->>'expectedItems'
          AND s->>'completedAt' IS NOT NULL AND (s->>'completedAt')::timestamptz<=issued_at)
  ) THEN RETURN pg_catalog.jsonb_build_object('outcome','held','reason','overnight_sources_incomplete'); END IF;
  scope := 'cadence:season:20262027:view:' || p_view_key || ':morning:' || p_date::text;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(scope,0));
  SELECT * INTO existing FROM public.player_forecast_season_queue WHERE scope_key=scope FOR UPDATE;
  IF FOUND THEN
    RETURN pg_catalog.jsonb_build_object('outcome','deduplicated','id',existing.id,
      'status',existing.status,'attempts',existing.attempt_count,
      'recoveryEligible',existing.status='failed' AND existing.attempt_count<3,
      'readbackRequired',existing.status='running');
  END IF;
  SELECT * INTO existing FROM public.enqueue_player_forecast_season_job(
    scope,20262027,p_view_key,NULL::smallint,NULL::smallint,NULL::bigint,
    'daily_refresh',issued_at,due_at,pg_catalog.jsonb_build_object(
      'allLeague',true,'source','approved_morning_cadence_preparation',
      'cadence',pg_catalog.jsonb_build_object('version','morning-new-york-v1','dueAt',due_at,
        'decisionAsOf',issued_at,'late',issued_at>due_at,'requiredSources',p_required_sources,
        'sources',p_sources,'maxAttempts',3)));
  RETURN pg_catalog.jsonb_build_object('outcome','enqueued','id',existing.id,'late',issued_at>due_at);
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_player_forecast_morning_cadence(date,text,text[],jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_player_forecast_morning_cadence(date,text,text[],jsonb) TO service_role;

-- Preserve the existing claim behavior for all legacy scopes. Only the new
-- cadence namespace has a finite three-attempt cap (including lease expiry).
create or replace function public.claim_player_forecast_season_jobs(
  p_owner_token uuid,
  p_limit integer default 8,
  p_lease_seconds integer default 240
) returns setof public.player_forecast_season_queue
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_owner_token is null or p_limit not between 1 and 50 or p_lease_seconds not between 30 and 800 then
    raise exception using errcode = '22023', message = 'PLAYER_FORECAST_SEASON_CLAIM_INVALID_ARGUMENT';
  end if;

  return query
  with claimable as (
    select queue.id
    from public.player_forecast_season_queue as queue
    where queue.not_before <= now()
      and (queue.scope_key not like 'cadence:season:%' or queue.attempt_count < 3)
      and (
        queue.status in ('pending', 'failed')
        or (queue.status = 'running' and queue.lease_expires_at <= now())
      )
    order by queue.not_before, queue.first_enqueued_at
    for update skip locked
    limit p_limit
  )
  update public.player_forecast_season_queue as queue
  set status = 'running',
      lease_owner = p_owner_token,
      lease_expires_at = now() + pg_catalog.make_interval(secs => p_lease_seconds),
      claimed_watermark = queue.source_high_watermark,
      attempt_count = queue.attempt_count + 1,
      last_error_code = null,
      last_error_summary = null,
      updated_at = now()
  from claimable
  where queue.id = claimable.id
  returning queue.*;
end;
$$;
COMMIT;
