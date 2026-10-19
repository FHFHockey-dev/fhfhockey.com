begin;
set local lock_timeout='2s';
set local statement_timeout='5s';

-- Task-local proposal only. Reuses the committed receipt log and existing jobs;
-- no trigger, webhook/model call, scheduler, publication or status-update path.
-- Replacement of the unapplied SQL9 proposal; never apply both alternatives.
create function public.list_ifttt_review_receipts(p_policy_id text,p_limit integer default 0)
returns setof jsonb language plpgsql stable security invoker set search_path='' set statement_timeout='1s' as $$
declare cursor_job public.tweet_pipeline_jobs; after_id uuid; after_time timestamptz;
begin
  if p_limit is null or p_limit<1 or p_limit>25 then raise exception 'Explicit review preparation bound required'; end if;
  select * into cursor_job from public.tweet_pipeline_jobs where job_key='ifttt-review-scan-v1:'||p_policy_id;
  if found then
    if cursor_job.status is distinct from 'complete' or cursor_job.owner is not null or cursor_job.lease_expires_at is not null
      or cursor_job.attempts is distinct from 0 or cursor_job.failure_stage is not null
      or cursor_job.payload->>'protocol' is distinct from 'ifttt-review-scan-v1'
      or cursor_job.payload->>'policyId' is distinct from p_policy_id then raise exception 'Invalid review scan cursor'; end if;
    after_id:=(cursor_job.payload->>'afterReceiptId')::uuid;
    after_time:=(cursor_job.payload->>'afterRetainedAt')::timestamptz;
    if after_id is null or after_time is null or not exists(select 1 from public.ifttt_raw_receipt_variants r
      join public.ifttt_intake_receipts a using(receipt_id) where a.policy_id=p_policy_id and r.receipt_id=after_id
        and r.retained_at=after_time) then raise exception 'Review scan cursor lost retained identity'; end if;
  end if;
  return query select jsonb_build_object('id',r.receipt_id,'eventTable',r.event_table,'eventId',r.event_id,
    'inputRow',r.input_row,'receivedAt',r.received_at)
    from public.ifttt_intake_receipts a join public.ifttt_raw_receipt_variants r using(receipt_id)
    join public.ifttt_intake_policies p on p.policy_id=a.policy_id
    where a.policy_id=p_policy_id
      and (select count(*) from public.ifttt_intake_receipts n where n.policy_id=p_policy_id)<=(p.contract->>'maxReceipts')::bigint
      and not exists(select 1 from public.tweet_pipeline_jobs j
        where j.job_key='ifttt-review-v1:'||p_policy_id||':'||r.receipt_id::text
          and j.payload->>'receiptId'=r.receipt_id::text and j.payload->>'policyId'=p_policy_id
          and ((j.payload->>'protocol'='ifttt-review-sidecar-job-v1' and j.payload->'input'->>'version'='ifttt-review-sidecar-v1')
            or (j.payload->>'protocol'='ifttt-review-sidecar-hold-v1' and j.status='failed'
              and j.failure_stage='review_preparation_packet_bytes' and j.payload->>'inputVersion'='ifttt-review-sidecar-v1'
              and j.payload->>'reason'='packet_byte_limit')))
    order by case when after_id is null or (r.retained_at,r.receipt_id)>(after_time,after_id) then 0 else 1 end,
      r.retained_at,r.receipt_id limit p_limit;
end $$;
revoke all on function public.list_ifttt_review_receipts(text,integer) from public,anon,authenticated,service_role;
grant execute on function public.list_ifttt_review_receipts(text,integer) to service_role;

-- One bounded write allocates the next cyclic page and commits its cursor
-- before any application mapping. Failed mapping/writes remain eligible on
-- wrap, while later receipts stay reachable across fresh process invocations.
create function public.advance_ifttt_review_receipts(p_policy_id text,p_limit integer default 0)
returns setof jsonb language plpgsql security invoker set search_path='' set lock_timeout='2s' set statement_timeout='5s' as $$
declare
  key text:='ifttt-review-scan-v1:'||p_policy_id; batch jsonb; item jsonb; selected_id uuid;
  prior_job public.tweet_pipeline_jobs; expected public.tweet_pipeline_jobs; actual public.tweet_pipeline_jobs;
  retained public.ifttt_raw_receipt_variants; raw_row jsonb; last_time timestamptz;
  before_entries jsonb:='[]'; after_entries jsonb:='[]'; before_policy jsonb; after_policy jsonb;
  before_map jsonb; after_map jsonb; inserted integer; existed boolean;
begin
  if p_limit is null or p_limit<1 or p_limit>25 then raise exception 'Explicit review preparation bound required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(key,0));
  select * into prior_job from public.tweet_pipeline_jobs where job_key=key for update;
  existed:=found;
  select coalesce(jsonb_agg(t.item order by t.ordinality),'[]'::jsonb) into batch
    from public.list_ifttt_review_receipts(p_policy_id,p_limit) with ordinality as t(item,ordinality);
  if jsonb_array_length(batch)=0 then return; end if;
  select to_jsonb(p) into before_policy from public.ifttt_intake_policies p where policy_id=p_policy_id;
  select coalesce(jsonb_agg(to_jsonb(a) order by receipt_id),'[]'::jsonb) into before_map
    from public.ifttt_intake_receipts a where policy_id=p_policy_id;
  if before_policy is null or jsonb_array_length(before_map)>(before_policy->'contract'->>'maxReceipts')::bigint then
    raise exception 'Invalid intake admission state'; end if;
  for item in select value from jsonb_array_elements(batch) loop
    selected_id:=(item->>'id')::uuid;
    select * into retained from public.ifttt_raw_receipt_variants where receipt_id=selected_id;
    if not found then raise exception 'Review scan lost retained receipt'; end if;
    execute format('select to_jsonb(r) from public.%I r where id=$1 for share',retained.event_table) into raw_row using retained.event_id;
    if raw_row is null then raise exception 'Review scan raw carrier missing'; end if;
    before_entries:=before_entries||jsonb_build_array(jsonb_build_object('receipt',to_jsonb(retained),'raw',raw_row));
    last_time:=retained.retained_at;
  end loop;
  if existed then expected:=prior_job;
  else expected:=jsonb_populate_record(null::public.tweet_pipeline_jobs,jsonb_build_object(
    'job_key',key,'status','complete','owner',null,'lease_expires_at',null,'attempts',0,
    'next_attempt_at',clock_timestamp(),'failure_stage',null,'updated_at',clock_timestamp())); end if;
  expected.payload:=jsonb_build_object('protocol','ifttt-review-scan-v1','policyId',p_policy_id,
    'afterReceiptId',batch->-1->>'id','afterRetainedAt',last_time);
  expected.updated_at:=clock_timestamp();
  if existed then
    update public.tweet_pipeline_jobs set payload=expected.payload,updated_at=expected.updated_at where job_key=key;
  else
    insert into public.tweet_pipeline_jobs select expected.* on conflict(job_key) do nothing;
    get diagnostics inserted=row_count;
    if inserted<>1 then raise exception 'Review scan raced; no automatic write retry'; end if;
  end if;
  select * into actual from public.tweet_pipeline_jobs where job_key=key;
  for item in select value from jsonb_array_elements(batch) loop
    select * into retained from public.ifttt_raw_receipt_variants where receipt_id=(item->>'id')::uuid;
    execute format('select to_jsonb(r) from public.%I r where id=$1',item->>'eventTable') into raw_row using (item->>'eventId')::uuid;
    after_entries:=after_entries||jsonb_build_array(jsonb_build_object('receipt',to_jsonb(retained),'raw',raw_row));
  end loop;
  select to_jsonb(p) into after_policy from public.ifttt_intake_policies p where policy_id=p_policy_id;
  select coalesce(jsonb_agg(to_jsonb(a) order by receipt_id),'[]'::jsonb) into after_map
    from public.ifttt_intake_receipts a where policy_id=p_policy_id;
  if actual.job_key is null or to_jsonb(actual) is distinct from to_jsonb(expected)
    or after_entries is distinct from before_entries or after_policy is distinct from before_policy
    or after_map is distinct from before_map then raise exception 'Review scan changed retained protocol state'; end if;
  return query select value from jsonb_array_elements(batch);
end $$;
revoke all on function public.advance_ifttt_review_receipts(text,integer) from public,anon,authenticated,service_role;
grant execute on function public.advance_ifttt_review_receipts(text,integer) to service_role;

create function public.prepare_ifttt_review_sidecar(p_policy_id text,p_receipt_id uuid,p_input jsonb)
returns jsonb language plpgsql security invoker set search_path='' set lock_timeout='2s' set statement_timeout='5s' as $$
declare
  receipt public.ifttt_raw_receipt_variants; after_receipt public.ifttt_raw_receipt_variants;
  prior_job public.tweet_pipeline_jobs; expected public.tweet_pipeline_jobs; actual public.tweet_pipeline_jobs;
  key text:='ifttt-review-v1:'||p_policy_id||':'||p_receipt_id::text;
  payload jsonb; before_raw jsonb; after_raw jsonb;
  before_policy jsonb; after_policy jsonb; before_map jsonb; after_map jsonb;
  inserted integer; packet_bytes integer; outcome text:='prepared';
begin
  if p_input is null or jsonb_typeof(p_input)<>'object'
    or p_input->>'version' is distinct from 'ifttt-review-sidecar-v1'
    or p_input->>'mode' is distinct from 'review_only' or p_input->'canPublish' is distinct from 'false'::jsonb
    or p_input->'canChangeStatus' is distinct from 'false'::jsonb or p_input->'providerDispatchEnabled' is distinct from 'false'::jsonb
    or jsonb_typeof(p_input->'candidates') is distinct from 'array' or jsonb_array_length(p_input->'candidates')>99 then
    raise exception 'Invalid review-only preparation input';
  end if;
  select * into receipt from public.ifttt_raw_receipt_variants where receipt_id=p_receipt_id;
  if not found or not exists(select 1 from public.ifttt_intake_receipts where policy_id=p_policy_id and receipt_id=p_receipt_id) then
    raise exception 'Committed controlled receipt required';
  end if;
  if p_input->'receiptSnapshot'->>'id' is distinct from p_receipt_id::text
    or p_input->'receiptSnapshot'->>'eventTable' is distinct from receipt.event_table
    or p_input->'receiptSnapshot'->>'eventId' is distinct from receipt.event_id::text
    or p_input->'receiptSnapshot'->'inputRow' is distinct from receipt.input_row
    or (p_input->'receiptSnapshot'->>'receivedAt')::timestamptz is distinct from receipt.received_at
    or p_input->'source'->>'retainedSourceId' is distinct from receipt.event_table||':'||receipt.event_id::text then
    raise exception 'Review receipt snapshot mismatch';
  end if;
  select to_jsonb(p) into before_policy from public.ifttt_intake_policies p where policy_id=p_policy_id;
  select coalesce(jsonb_agg(to_jsonb(a) order by receipt_id),'[]'::jsonb) into before_map from public.ifttt_intake_receipts a where policy_id=p_policy_id;
  if jsonb_array_length(before_map)>(before_policy->'contract'->>'maxReceipts')::bigint then raise exception 'Invalid intake admission state'; end if;
  execute format('select to_jsonb(r) from public.%I r where id=$1 for share',receipt.event_table) into before_raw using receipt.event_id;
  if before_raw is null then raise exception 'Retained raw carrier missing'; end if;
  packet_bytes:=octet_length(p_input::text);
  if packet_bytes>81920 then
    outcome:='held';
    -- The complete immutable source stays in the receipt log. This compact
    -- failure record is not a truncated or successfully prepared input.
    payload:=jsonb_build_object('protocol','ifttt-review-sidecar-hold-v1','policyId',p_policy_id,'receiptId',p_receipt_id,
      'inputVersion','ifttt-review-sidecar-v1','reason','packet_byte_limit','packetBytes',packet_bytes,
      'packetSha256',encode(sha256(convert_to(p_input::text,'UTF8')),'hex'),
      'receiptRef',jsonb_build_object('eventTable',receipt.event_table,'eventId',receipt.event_id),
      'canPublish',false,'canChangeStatus',false,'providerDispatchEnabled',false);
  else payload:=jsonb_build_object('protocol','ifttt-review-sidecar-job-v1','policyId',p_policy_id,'receiptId',p_receipt_id,'input',p_input); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(key,0));
  select * into prior_job from public.tweet_pipeline_jobs where job_key=key for update;
  if found then
    if prior_job.payload is distinct from payload then raise exception 'Immutable review input conflict'; end if;
    return jsonb_build_object('status',outcome,'receiptId',p_receipt_id,'jobKey',key,'duplicate',true,
      'reason',case when outcome='held' then 'packet_byte_limit' else null end,'packetBytes',packet_bytes);
  end if;
  expected:=jsonb_populate_record(null::public.tweet_pipeline_jobs,jsonb_build_object(
    'job_key',key,'status',case when outcome='held' then 'failed' else 'pending' end,'owner',null,'lease_expires_at',null,'attempts',0,
    'next_attempt_at',clock_timestamp(),'payload',payload,
    'failure_stage',case when outcome='held' then 'review_preparation_packet_bytes' else null end,'updated_at',clock_timestamp()));
  insert into public.tweet_pipeline_jobs select expected.* on conflict(job_key) do nothing;
  get diagnostics inserted=row_count;
  if inserted<>1 then raise exception 'Review job raced; reconcile on the next bounded read'; end if;
  select * into actual from public.tweet_pipeline_jobs where job_key=key;
  select * into after_receipt from public.ifttt_raw_receipt_variants where receipt_id=p_receipt_id;
  execute format('select to_jsonb(r) from public.%I r where id=$1',receipt.event_table) into after_raw using receipt.event_id;
  select to_jsonb(p) into after_policy from public.ifttt_intake_policies p where policy_id=p_policy_id;
  select coalesce(jsonb_agg(to_jsonb(a) order by receipt_id),'[]'::jsonb) into after_map from public.ifttt_intake_receipts a where policy_id=p_policy_id;
  if actual.job_key is null or to_jsonb(actual) is distinct from to_jsonb(expected)
    or to_jsonb(after_receipt) is distinct from to_jsonb(receipt) or after_raw is distinct from before_raw
    or after_policy is distinct from before_policy or after_map is distinct from before_map then
    raise exception 'Review preparation changed retained protocol state';
  end if;
  return jsonb_build_object('status',outcome,'receiptId',p_receipt_id,'jobKey',key,'duplicate',false,
    'reason',case when outcome='held' then 'packet_byte_limit' else null end,'packetBytes',packet_bytes);
end $$;
revoke all on function public.prepare_ifttt_review_sidecar(text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.prepare_ifttt_review_sidecar(text,uuid,jsonb) to service_role;
commit;
