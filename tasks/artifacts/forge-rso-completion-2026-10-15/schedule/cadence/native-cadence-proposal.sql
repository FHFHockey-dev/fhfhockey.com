-- REVIEW CANDIDATE ONLY. No schema execution, endpoint wiring or activation authority.
BEGIN;
SET LOCAL lock_timeout='1s';
ALTER TABLE public.forge_game_update_queue ADD COLUMN cadence_slots jsonb NOT NULL DEFAULT '{}'::jsonb
  CHECK(pg_catalog.jsonb_typeof(cadence_slots)='object');

CREATE FUNCTION fhfh_internal.advance_forge_cadence_slots(p_slots jsonb,p_version bigint,p_state text,p_revision jsonb,p_start_time timestamptz)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT coalesce(pg_catalog.jsonb_object_agg(key,
    CASE WHEN value->>'status' IN ('succeeded','superseded') OR (value->>'requestedVersion')::bigint>p_version THEN value
      WHEN value->>'status'='failed' AND (value->>'attempts')::int>=3 THEN value
      WHEN (value->>'requestedVersion')::bigint<p_version
        THEN value || pg_catalog.jsonb_build_object('status','superseded','reason','newer_queue_version')
      WHEN (value->>'scheduledStartAt')::timestamptz IS DISTINCT FROM p_start_time
        THEN value || pg_catalog.jsonb_build_object('status','superseded','reason','schedule_changed')
      WHEN p_state='running' AND (value->>'attempts')::int>=3 THEN value
      ELSE value || pg_catalog.jsonb_build_object('status',p_state,
        'attempts',(value->>'attempts')::int + CASE WHEN p_state='running' THEN 1 ELSE 0 END)
        || CASE WHEN p_state='succeeded' THEN pg_catalog.jsonb_build_object('publishedRevision',p_revision) ELSE '{}'::jsonb END
    END),'{}'::jsonb) FROM pg_catalog.jsonb_each(p_slots);
$$;
REVOKE ALL ON FUNCTION fhfh_internal.advance_forge_cadence_slots(jsonb,bigint,text,jsonb,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION fhfh_internal.advance_forge_cadence_slots(jsonb,bigint,text,jsonb,timestamptz) TO service_role;

CREATE FUNCTION public.enqueue_forge_cadence_slot(p_game_id bigint,p_date date,p_kind text,
  p_start_time timestamptz,p_required_sources text[],p_sources jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET lock_timeout='1s' AS $$
DECLARE actual_start timestamptz; due_at timestamptz; slot_key text;
  issued_at timestamptz:=pg_catalog.clock_timestamp(); queued public.forge_game_update_queue;
BEGIN
  IF p_game_id IS NULL OR p_date IS NULL OR p_kind IS NULL OR p_kind NOT IN ('morning','news_revision')
    OR p_start_time IS NULL OR NOT pg_catalog.isfinite(p_start_time)
    OR p_required_sources IS NULL OR cardinality(p_required_sources) NOT BETWEEN 1 AND 32
    OR EXISTS(SELECT 1 FROM unnest(p_required_sources) k WHERE k IS NULL OR btrim(k)='')
    OR (SELECT count(DISTINCT k) FROM unnest(p_required_sources) k)<>cardinality(p_required_sources)
    OR p_sources IS NULL OR pg_catalog.jsonb_typeof(p_sources)<>'array'
    OR pg_catalog.octet_length(p_sources::text)>65536 THEN RAISE EXCEPTION 'FORGE_CADENCE_INPUT_INVALID'; END IF;
  SELECT "startTime" INTO actual_start FROM public.games WHERE id=p_game_id FOR SHARE;
  IF NOT FOUND OR actual_start IS DISTINCT FROM p_start_time
    OR (actual_start AT TIME ZONE 'America/New_York')::date<>p_date
    OR actual_start<=issued_at OR (issued_at AT TIME ZONE 'America/New_York')::date<>p_date THEN
    RETURN pg_catalog.jsonb_build_object('outcome','held','reason','game_schedule_changed_or_started'); END IF;
  due_at:=CASE WHEN p_kind='morning' THEN (p_date+time '08:00') AT TIME ZONE 'America/New_York'
    ELSE actual_start-interval '15 minutes' END;
  IF issued_at<due_at THEN RETURN pg_catalog.jsonb_build_object('outcome','held','reason','not_due'); END IF;
  IF EXISTS(SELECT 1 FROM unnest(p_required_sources) required_key
    WHERE (SELECT count(*) FROM pg_catalog.jsonb_array_elements(p_sources) s
      WHERE s->>'key'=required_key AND s->>'date'=p_date::text)<>1
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(p_sources) s
      WHERE s->>'key'=required_key AND s->>'date'=p_date::text AND s->>'status'='complete'
        AND nullif(btrim(s->>'revision'),'') IS NOT NULL AND s->>'expectedItems' ~ '^[0-9]+$'
        AND (s->>'expectedItems')::numeric<=9007199254740991 AND s->>'completedItems'=s->>'expectedItems'
        AND s->>'completedAt' IS NOT NULL AND (s->>'completedAt')::timestamptz<=issued_at)) THEN
    RETURN pg_catalog.jsonb_build_object('outcome','held','reason','upstream_sources_incomplete'); END IF;
  slot_key:=CASE WHEN p_kind='morning' THEN 'morning:'||p_date::text
    ELSE 'news:'||p_game_id::text||':'||pg_catalog.to_char(actual_start AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END;
  -- Serialize same-game coordinators before enqueue. Existing news writers also
  -- serialize on the queue row; no source acquisition happens while locked.
  IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('forge-cadence:'||p_game_id::text,0)) THEN
    RETURN pg_catalog.jsonb_build_object('outcome','held','reason','coordinator_busy'); END IF;
  SELECT * INTO queued FROM public.forge_game_update_queue WHERE game_id=p_game_id FOR UPDATE;
  IF FOUND AND queued.cadence_slots ? slot_key THEN
    RETURN pg_catalog.jsonb_build_object('outcome','deduplicated','slotKey',slot_key,
      'receipt',queued.cadence_slots->slot_key,'readbackRequired',queued.cadence_slots->slot_key->>'status'='running'); END IF;
  IF FOUND AND (SELECT count(*) FROM pg_catalog.jsonb_object_keys(queued.cadence_slots))>=8 THEN
    RETURN pg_catalog.jsonb_build_object('outcome','held','reason','slot_history_limit'); END IF;
  PERFORM fhfh_internal.enqueue_starter_board_game(p_game_id,NULL::bigint,issued_at,issued_at);
  SELECT * INTO queued FROM public.forge_game_update_queue WHERE game_id=p_game_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('outcome','held','reason','game_started'); END IF;
  UPDATE public.forge_game_update_queue SET cadence_slots=pg_catalog.jsonb_set(cadence_slots,ARRAY[slot_key],
    pg_catalog.jsonb_build_object('kind',p_kind,'scheduledStartAt',actual_start,'dueAt',due_at,'decisionAsOf',issued_at,'late',issued_at>due_at,
      'requestedVersion',queued.version,'status','pending','attempts',0,'requiredSources',p_required_sources,'sources',p_sources)),
    not_before=least(not_before,issued_at) WHERE game_id=p_game_id;
  RETURN pg_catalog.jsonb_build_object('outcome','enqueued','slotKey',slot_key,'queueVersion',queued.version);
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_forge_cadence_slot(bigint,date,text,timestamptz,text[],jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_forge_cadence_slot(bigint,date,text,timestamptz,text[],jsonb) TO service_role;

create or replace function public.claim_starter_board_jobs(p_owner uuid, p_limit integer default 4, p_game_ids bigint[] default null)
returns setof public.forge_game_update_queue language plpgsql security invoker set search_path='' as $$
begin
  if p_owner is null or p_limit is null or p_limit not between 1 and 16 then raise exception 'Invalid board claim'; end if;
  if p_game_ids is not null and (cardinality(p_game_ids) not between 1 and 16
      or exists(select 1 from unnest(p_game_ids) id where id is null or id<=0)
      or (select count(distinct id) from unnest(p_game_ids) id)<>cardinality(p_game_ids)) then
    raise exception 'Invalid board canary scope'; end if;
  -- Reconcile a publication whose separate finish acknowledgement was lost.
  -- Existing immutable revisions supply the readback; do not recompute success.
  with recoverable as (
    select q.game_id from public.forge_game_update_queue q where q.cadence_slots<>'{}'::jsonb and q.status='running' and q.lease_expires_at<=clock_timestamp()
      and (p_game_ids is null or q.game_id=any(p_game_ids))
      and exists(select 1 from public.forge_game_revisions r where r.game_id=q.game_id and r.run_id=q.active_run_id)
    order by q.first_accepted_at limit p_limit for update skip locked
  )
  update public.forge_game_update_queue q set
    cadence_slots=fhfh_internal.advance_forge_cadence_slots(q.cadence_slots,q.claimed_version,'succeeded',
      (select pg_catalog.jsonb_build_object('revisionId',r.id,'runId',r.run_id,
        'decisionAsOf',r.decision_as_of,'publishedAt',r.published_at)
       from public.forge_game_revisions r where r.game_id=q.game_id and r.run_id=q.active_run_id limit 1),
      (select g."startTime" from public.games g where g.id=q.game_id)),
    status=case when q.version>q.claimed_version then 'pending' else 'succeeded' end,
    published_run_id=q.active_run_id,completed_at=clock_timestamp(),
    lease_owner=null,lease_expires_at=null,active_run_id=null from recoverable recovery where q.game_id=recovery.game_id;
  -- Only retire runs belonging to an expired queue lease, never unrelated work.
  update public.forge_runs r set status='failed',updated_at=clock_timestamp(),
    metrics=coalesce(r.metrics,'{}'::jsonb)||'{"board_lease_expired":true}'::jsonb
    from public.forge_game_update_queue q where q.active_run_id=r.run_id
      and q.status='running' and q.lease_expires_at<=clock_timestamp() and r.status='running';
  update public.forge_game_update_queue q set status='cancelled',lease_owner=null,lease_expires_at=null
    from public.games g where g.id=q.game_id and g."startTime" <= clock_timestamp()
      and q.status in ('pending','failed','running');
  return query with candidates as (
    select q.game_id from public.forge_game_update_queue q
    where q.not_before <= clock_timestamp()
      and (p_game_ids is null or q.game_id=any(p_game_ids))
      and not exists(select 1 from pg_catalog.jsonb_each(q.cadence_slots) slot
        where (slot.value->>'requestedVersion')::bigint=q.version
          and slot.value->>'status' NOT IN ('succeeded','superseded') and (slot.value->>'attempts')::int>=3)
      and (q.status in ('pending','failed') or (q.status='running' and q.lease_expires_at <= clock_timestamp()))
    order by q.first_accepted_at for update skip locked limit p_limit
  ) update public.forge_game_update_queue q set status='running',claimed_version=q.version,
      lease_owner=p_owner,lease_expires_at=clock_timestamp()+interval '210 seconds',
      active_run_id=null,
      dispatched_at=clock_timestamp(),attempt_count=q.attempt_count+1,last_error=null,
      cadence_slots=fhfh_internal.advance_forge_cadence_slots(q.cadence_slots,q.version,'running',null,
        (select g."startTime" from public.games g where g.id=q.game_id))
    from candidates c where q.game_id=c.game_id returning q.*;
end; $$;

create or replace function public.finish_starter_board_job(p_game_id bigint,p_owner uuid,p_run_id uuid,p_error text default null)
returns void language plpgsql security invoker set search_path='' as $$
begin
  update public.forge_game_update_queue q set
    status=case when q.version>q.claimed_version then 'pending' when p_error is null then 'succeeded' else 'failed' end,
    not_before=case when q.version>q.claimed_version then clock_timestamp() else clock_timestamp()+interval '30 seconds' end,
    published_run_id=case when p_error is null then p_run_id else q.published_run_id end,
    cadence_slots=fhfh_internal.advance_forge_cadence_slots(q.cadence_slots,q.claimed_version,
      case when p_error is null then 'succeeded' else 'failed' end,
      (select pg_catalog.jsonb_build_object('revisionId',r.id,'runId',r.run_id,
        'decisionAsOf',r.decision_as_of,'publishedAt',r.published_at)
       from public.forge_game_revisions r where r.game_id=p_game_id and r.run_id=p_run_id limit 1),
      (select g."startTime" from public.games g where g.id=q.game_id)),
    completed_at=clock_timestamp(),lease_owner=null,lease_expires_at=null,active_run_id=null,last_error=left(p_error,2000)
    where q.game_id=p_game_id and q.lease_owner=p_owner and q.lease_expires_at>clock_timestamp()
      and (p_error is not null or exists(select 1 from public.forge_game_revisions r where r.game_id=p_game_id and r.run_id=p_run_id));
  if not found then raise exception 'Board job lease lost or publication missing'; end if;
end; $$;

COMMIT;
