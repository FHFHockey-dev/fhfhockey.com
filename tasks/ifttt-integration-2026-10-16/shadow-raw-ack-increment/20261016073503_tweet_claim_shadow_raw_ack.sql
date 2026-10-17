begin;
set local lock_timeout = '2s';
set local statement_timeout = '5s';

-- UNREVIEWED TASK-LOCAL CANDIDATE. Explicit shadow-only caller; no deployment activation.
-- Reuses existing jobs/raw rows; raw processing completion means retained
-- observations only. This function never requests or confirms delivery.
create function public.settle_tweet_claim_shadow_raw_event(
  p_table text, p_id uuid, p_owner uuid, p_expected jsonb, p_observation_ids text[]
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  job public.tweet_pipeline_jobs;
  raw record;
  expected_job_key text;
  ids jsonb;
  receipt jsonb;
  marker jsonb;
  acknowledged_at timestamptz;
  matched integer;
begin
  if p_table is null or p_table not in ('line_source_ifttt_events','lines_ccc_ifttt_events')
    or p_id is null or p_owner is null or p_expected is null
    or jsonb_typeof(p_expected) <> 'object' or octet_length(p_expected::text) > 65536
    or p_expected ? 'tweetClaimShadow' or p_observation_ids is null
    or cardinality(p_observation_ids) not between 1 and 256
    or array_position(p_observation_ids,null) is not null then
    raise exception 'Invalid bounded shadow acknowledgment input';
  end if;
  select jsonb_agg(id order by id) into ids from (select distinct unnest(p_observation_ids) id) distinct_ids;
  if jsonb_array_length(ids) <> cardinality(p_observation_ids) then
    raise exception 'Duplicate shadow observation identity';
  end if;
  expected_job_key := 'ingest:' || p_table || ':' || p_id::text;
  select * into job from public.tweet_pipeline_jobs where tweet_pipeline_jobs.job_key = expected_job_key for update;
  if not found or job.owner is distinct from p_owner then raise exception 'Shadow job ownership lost'; end if;
  if jsonb_typeof(job.payload) is distinct from 'object' then raise exception 'Shadow job payload must retain an acknowledgment object'; end if;
  execute format('select id,tweet_id,received_at,processing_status,raw_payload from public.%I where id=$1 for update',p_table) into raw using p_id;
  if raw.id is null then raise exception 'Retained raw event missing'; end if;
  receipt := job.payload->'tweetClaimShadowAck';
  if job.status = 'complete' then
    if receipt is null or receipt->>'version' is distinct from 'shadow-raw-ack-v1'
      or receipt->>'owner' is distinct from p_owner::text
      or receipt->>'jobKey' is distinct from expected_job_key
      or receipt->>'table' is distinct from p_table
      or receipt->>'eventId' is distinct from p_id::text
      or receipt->'beforePayload' is distinct from p_expected
      or receipt->'observationIds' is distinct from ids
      or raw.tweet_id is distinct from receipt->>'tweetId'
      or raw.received_at is distinct from (receipt->>'receivedAt')::timestamptz then
      raise exception 'Conflicting retained shadow acknowledgment';
    end if;
    marker := receipt->'marker';
    if marker is null or raw.processing_status <> 'processed'
      or raw.raw_payload is distinct from p_expected || jsonb_build_object('tweetClaimShadow',marker) then
      raise exception 'Raw event disagrees with retained acknowledgment';
    end if;
    return receipt;
  end if;
  if job.status <> 'running' or job.lease_expires_at is null or job.lease_expires_at <= clock_timestamp()
    or receipt is not null then raise exception 'Shadow job lease or state is not current'; end if;
  if raw.processing_status <> 'pending' or raw.raw_payload is distinct from p_expected
    or raw.tweet_id is null or btrim(raw.tweet_id) = '' or raw.received_at > clock_timestamp() then
    raise exception 'Raw event changed or is not pending';
  end if;
  select count(*) into matched from public.tweet_claim_observations observation
    join public.tweet_claim_scopes scope on scope.scope_key = observation.scope_key
    where observation.observation_id = any(p_observation_ids)
      and observation.lineage_key = 'tweet-receipt-v2:' || raw.tweet_id
      and scope.version > 0
      and observation.payload->'source'->>'tweetId' = raw.tweet_id
      and observation.payload->'source'->'rawPayload' = p_expected
      and observation.payload#>>'{source,metadata,iftttEventId}' = p_id::text
      and observation.payload->'semantic'->>'reportId' = 'tweet-receipt-v2:' || raw.tweet_id
      and (observation.payload->'semantic'->>'receivedAt')::timestamptz = raw.received_at
      and (observation.payload->'semantic'->>'interpretedAt')::timestamptz <= clock_timestamp();
  if matched <> cardinality(p_observation_ids) then raise exception 'Shadow observation evidence incomplete or conflicting'; end if;
  if exists(select 1 from public.tweet_claim_observations observation
      where observation.lineage_key = 'tweet-receipt-v2:' || raw.tweet_id
        and observation.payload->'source'->>'tweetId' = raw.tweet_id
        and observation.payload->'source'->'rawPayload' = p_expected
        and observation.payload#>>'{source,metadata,iftttEventId}' = p_id::text
        and not (observation.observation_id = any(p_observation_ids))) then
    raise exception 'Shadow receipt observations omitted';
  end if;
  acknowledged_at := clock_timestamp();
  marker := jsonb_build_object('capturedAt',acknowledged_at,'lane','shadow','delivery','not_requested','acknowledgmentKey',expected_job_key);
  receipt := jsonb_build_object('version','shadow-raw-ack-v1','jobKey',expected_job_key,'owner',p_owner,
    'table',p_table,'eventId',p_id,'tweetId',raw.tweet_id,'receivedAt',raw.received_at,'beforePayload',p_expected,
    'observationIds',ids,'marker',marker,'acknowledgedAt',acknowledged_at,'delivery','not_requested');
  execute format('update public.%I set processing_status=''processed'',raw_payload=$2,updated_at=$3 where id=$1',p_table)
    using p_id,p_expected || jsonb_build_object('tweetClaimShadow',marker),acknowledged_at;
  update public.tweet_pipeline_jobs set status='complete',failure_stage=null,lease_expires_at=null,
    payload=jsonb_set(payload,'{tweetClaimShadowAck}',receipt),updated_at=acknowledged_at
    where tweet_pipeline_jobs.job_key=expected_job_key and owner=p_owner and status='running' and lease_expires_at>clock_timestamp();
  if not found then raise exception 'Shadow job lease expired during settlement'; end if;
  return receipt;
end $$;
revoke all on function public.settle_tweet_claim_shadow_raw_event(text,uuid,uuid,jsonb,text[]) from public,anon,authenticated;
grant execute on function public.settle_tweet_claim_shadow_raw_event(text,uuid,uuid,jsonb,text[]) to service_role;
commit;
