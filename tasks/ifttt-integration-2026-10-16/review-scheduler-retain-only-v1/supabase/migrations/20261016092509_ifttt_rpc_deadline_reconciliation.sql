begin;
set local lock_timeout='2s';
set local statement_timeout='5s';

-- Additive SQL8 after selected SQL7. PostgREST must hoist this function setting
-- before the main query. A direct PG SET inside a running function is NOT a
-- caller-wide timer. Exact deployed PostgREST/version/config proof stays gated.
alter function public.retain_bounded_ifttt_raw_receipt(jsonb,jsonb,jsonb) set statement_timeout='5s';

-- STABLE makes PostgREST POST this RPC in a READ ONLY transaction (the request
-- envelope can be too large for GET). No quota charge/registration/locks/write.
create function public.reconcile_ifttt_raw_receipt(p_policy jsonb,p_scope jsonb,p_row jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' set statement_timeout='1s' as $$
declare
  envelope jsonb:=jsonb_build_object('version','ifttt-intake-reconciliation-v1','policyId',p_policy->>'id','status','unresolved');
  p public.ifttt_intake_policies;
  raw_row jsonb; expected_input jsonb;
  retained public.ifttt_raw_receipt_variants; baseline public.ifttt_raw_receipt_variants;
  ids uuid[]; admitted_count bigint; map_count bigint; tab text:=p_scope->>'table';
begin
  select * into p from public.ifttt_intake_policies where policy_id=p_policy->>'id';
  if not found or p.contract is distinct from p_policy
    or p_scope is null or not(p.contract->'scopes' @> jsonb_build_array(p_scope))
    or (select count(*) from jsonb_object_keys(p_scope))<>4
    or p.attempts<1 or p.attempts>(p.contract->>'maxAttempts')::bigint then return envelope; end if;
  if tab not in ('line_source_ifttt_events','lines_ccc_ifttt_events')
    or p_row is null or jsonb_typeof(p_row)<>'object' or octet_length(p_row::text)>81920
    or jsonb_typeof(p_row->'raw_payload') is distinct from 'object' or octet_length((p_row->'raw_payload')::text)>65536
    or p_row->>'source' is distinct from 'ifttt' or p_row->>'processing_status' is distinct from 'pending'
    or p_row->>'tweet_id' is null or p_row->>'tweet_id' !~ '^[0-9]{1,30}$'
    or exists(select 1 from jsonb_object_keys(p_row) k where k not in
      ('source','source_group','source_key','source_account','username','text','link_to_tweet','tweet_id','tweet_embed_code','tweet_created_at','created_at_label','processing_status','raw_payload','updated_at'))
    or (tab='lines_ccc_ifttt_events' and (p_row?'source_key' or p_row?'source_group'))
    or (tab='line_source_ifttt_events' and (p_row->>'source_group' is distinct from p_scope->>'sourceGroup'
      or p_row->>'source_key' is distinct from p_scope->>'sourceKey')) then return envelope; end if;
  if tab='line_source_ifttt_events' then
    select to_jsonb(r) into raw_row from public.line_source_ifttt_events r where source_key=p_row->>'source_key' and tweet_id=p_row->>'tweet_id';
  else
    select to_jsonb(r) into raw_row from public.lines_ccc_ifttt_events r where tweet_id=p_row->>'tweet_id';
  end if;
  if raw_row is null then return envelope; end if;
  execute format('select to_jsonb(jsonb_populate_record(null::public.%I,$1)) - ''id'' - ''received_at'' - ''updated_at'' - ''processing_status''',tab)
    into expected_input using p_row;
  select * into retained from public.ifttt_raw_receipt_variants where event_table=tab
    and event_id=(raw_row->>'id')::uuid and input_hash=encode(sha256(convert_to(expected_input::text,'UTF8')),'hex');
  if not found or retained.input_row is distinct from expected_input then return envelope; end if;
  select * into baseline from public.ifttt_raw_receipt_variants where receipt_id=coalesce(retained.baseline_id,retained.receipt_id);
  if not found or baseline.classification<>'canonical' or baseline.baseline_id is not null
    or baseline.event_table<>tab or baseline.event_id<>retained.event_id
    or baseline.input_row->>'source' is distinct from raw_row->>'source'
    or baseline.input_row->>'source_account' is distinct from raw_row->>'source_account'
    or baseline.input_row->>'tweet_id' is distinct from raw_row->>'tweet_id'
    or baseline.received_at is distinct from (raw_row->>'received_at')::timestamptz
    or (tab='line_source_ifttt_events' and (baseline.input_row->>'source_group' is distinct from raw_row->>'source_group'
      or baseline.input_row->>'source_key' is distinct from raw_row->>'source_key'))
    or (retained.baseline_id is null and retained.classification<>'canonical')
    or (retained.baseline_id is not null and (retained.classification<>'same_post_variant' or retained.input_row=baseline.input_row)) then return envelope; end if;
  ids:=array[retained.receipt_id];
  if retained.baseline_id is not null then ids:=array_append(ids,retained.baseline_id); end if;
  select count(*) into map_count from public.ifttt_intake_receipts where policy_id=p.policy_id;
  select count(*) into admitted_count from public.ifttt_intake_receipts a
    join public.ifttt_raw_receipt_variants r on r.receipt_id=a.receipt_id
    where a.policy_id=p.policy_id and a.receipt_id=any(ids)
      and a.admitted_at>=(p.contract->>'startsAt')::timestamptz and a.admitted_at<(p.contract->>'endsAt')::timestamptz
      and a.admitted_at>=r.retained_at and a.admitted_at<=clock_timestamp();
  if admitted_count<>cardinality(ids) or map_count>(p.contract->>'maxReceipts')::bigint then return envelope; end if;
  -- A committed admission remains readable after stop/expiry. Missing evidence
  -- is unresolved, never proof the original write rolled back or cannot commit.
  return envelope||jsonb_build_object('status','committed','receipt',jsonb_build_object(
    'version','ifttt-receipt-v1','table',tab,'eventId',retained.event_id,'receiptId',retained.receipt_id,
    'classification',retained.classification,'outcome','duplicate','requiresReview',retained.baseline_id is not null,
    'baselineId',retained.baseline_id,'receivedAt',retained.received_at,'inputRow',retained.input_row));
end $$;
revoke all on function public.reconcile_ifttt_raw_receipt(jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.reconcile_ifttt_raw_receipt(jsonb,jsonb,jsonb) to service_role;
commit;
