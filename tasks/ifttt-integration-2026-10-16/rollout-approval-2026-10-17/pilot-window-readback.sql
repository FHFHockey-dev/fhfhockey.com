-- PROPOSAL ONLY. Read-only readback for ONE registered intake policy (psql -v policy_id='<exact id>').
-- Run as: BEGIN READ ONLY; SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='2s'; SET LOCAL TimeZone='UTC';
-- <this statement>; ROLLBACK. Rows returned are bounded by the policy's maxReceipts. Post text and payloads are not returned.
with p as (select * from public.ifttt_intake_policies where policy_id=:'policy_id'),
a as (select r.policy_id,r.receipt_id,r.admitted_at,v.event_table,v.event_id,v.classification,v.baseline_id,v.received_at,v.retained_at
  from public.ifttt_intake_receipts r join public.ifttt_raw_receipt_variants v using(receipt_id) where r.policy_id=(select policy_id from p)),
raw as (
  select 'line_source_ifttt_events' t,id,tweet_id,source_key,processing_status,received_at,tweet_created_at from public.line_source_ifttt_events
   where id in (select event_id from a where event_table='line_source_ifttt_events')
  union all
  select 'lines_ccc_ifttt_events',id,tweet_id,null,processing_status,received_at,tweet_created_at from public.lines_ccc_ifttt_events
   where id in (select event_id from a where event_table='lines_ccc_ifttt_events'))
select jsonb_build_object(
 'policy',(select jsonb_build_object('id',policy_id,'attempts',attempts,'maxAttempts',contract->'maxAttempts','maxReceipts',contract->'maxReceipts',
   'startsAt',contract->'startsAt','endsAt',contract->'endsAt','stoppedAt',stopped_at,'stopReason',stop_reason,'scopes',contract->'scopes') from p),
 'admitted',(select count(*) from a),
 'byClassification',(select coalesce(jsonb_object_agg(classification,n),'{}') from (select classification,count(*) n from a group by 1) x),
 'admittedOutsideWindow',(select count(*) from a,p where a.admitted_at<(p.contract->>'startsAt')::timestamptz or a.admitted_at>=(p.contract->>'endsAt')::timestamptz),
 'receiptsWithoutCarrier',(select count(*) from a where not exists(select 1 from raw where raw.id=a.event_id)),
 'nonPendingCarriers',(select count(*) from raw where processing_status is distinct from 'pending'),
 'carriers',(select coalesce(jsonb_agg(jsonb_build_object('table',t,'tweetId',tweet_id,'sourceKey',source_key,'status',processing_status,
   'receivedAt',received_at,'postedAt',tweet_created_at,
   'receipts',(select jsonb_agg(jsonb_build_object('receiptId',receipt_id,'classification',classification,'admittedAt',admitted_at) order by admitted_at) from a where a.event_id=raw.id))
   order by received_at),'[]') from raw)
) readback;
