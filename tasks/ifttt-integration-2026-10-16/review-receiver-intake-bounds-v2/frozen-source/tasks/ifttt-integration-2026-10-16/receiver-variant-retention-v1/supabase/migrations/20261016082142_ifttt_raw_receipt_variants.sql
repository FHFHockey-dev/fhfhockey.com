begin;
set local lock_timeout = '2s';
set local statement_timeout = '5s';

-- Task-local, default-off receiver proposal. Evidence only: no additional raw
-- processing job, claim, independent occurrence, effect or dispatch is created.
create table public.ifttt_raw_receipt_variants (
  receipt_id uuid primary key,
  event_table text not null check(event_table in ('line_source_ifttt_events','lines_ccc_ifttt_events')),
  event_id uuid not null,
  baseline_id uuid references public.ifttt_raw_receipt_variants(receipt_id),
  classification text not null check(classification in ('canonical','same_post_variant')),
  input_row jsonb not null check(jsonb_typeof(input_row)='object' and octet_length(input_row::text)<=81920),
  input_hash text not null check(input_hash=encode(sha256(convert_to(input_row::text,'UTF8')),'hex')),
  received_at timestamptz not null,
  retained_at timestamptz not null,
  check((classification='canonical' and baseline_id is null) or (classification='same_post_variant' and baseline_id is not null)),
  unique(event_table,event_id,input_hash)
);
create unique index ifttt_raw_receipt_one_baseline on public.ifttt_raw_receipt_variants(event_table,event_id) where baseline_id is null;
alter table public.ifttt_raw_receipt_variants enable row level security;
revoke all on public.ifttt_raw_receipt_variants from public,anon,authenticated,service_role;
grant select,insert on public.ifttt_raw_receipt_variants to service_role;

create function public.guard_ifttt_raw_receipt_variant() returns trigger
language plpgsql security invoker set search_path='' as $$
declare raw_row jsonb; baseline public.ifttt_raw_receipt_variants;
begin
  if tg_op<>'INSERT' then raise exception 'Retained IFTTT receipts are immutable'; end if;
  if new.event_table not in ('line_source_ifttt_events','lines_ccc_ifttt_events') then raise exception 'Invalid raw receipt table'; end if;
  execute format('select to_jsonb(r) from public.%I r where id=$1',new.event_table) into raw_row using new.event_id;
  if raw_row is null or new.received_at>clock_timestamp() or new.retained_at>clock_timestamp()
    or new.retained_at<new.received_at or new.input_row->>'source' is distinct from 'ifttt'
    or new.input_row->>'tweet_id' is distinct from raw_row->>'tweet_id'
    or (new.event_table='line_source_ifttt_events' and
      (new.input_row->>'source_key' is distinct from raw_row->>'source_key'
       or new.input_row->>'source_group' is distinct from raw_row->>'source_group')) then
    raise exception 'Raw receipt identity or clock mismatch';
  end if;
  if new.baseline_id is null then
    if new.input_row is distinct from raw_row-'id'-'received_at'-'updated_at'-'processing_status'
      or new.received_at is distinct from (raw_row->>'received_at')::timestamptz then
      raise exception 'Canonical receipt must preserve the retained raw row';
    end if;
  else
    select * into baseline from public.ifttt_raw_receipt_variants where receipt_id=new.baseline_id;
    if not found or baseline.baseline_id is not null or baseline.event_table<>new.event_table
      or baseline.event_id<>new.event_id or baseline.input_row=new.input_row
      or baseline.received_at>new.received_at then raise exception 'Variant baseline mismatch'; end if;
  end if;
  return new;
end $$;
create trigger ifttt_raw_receipt_immutable before insert or update or delete on public.ifttt_raw_receipt_variants
  for each row execute function public.guard_ifttt_raw_receipt_variant();
revoke all on function public.guard_ifttt_raw_receipt_variant() from public,anon,authenticated;

create function public.retain_ifttt_raw_receipt(p_table text,p_row jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  raw record;
  final_raw jsonb;
  incoming_row jsonb;
  raw_input jsonb;
  baseline public.ifttt_raw_receipt_variants;
  retained public.ifttt_raw_receipt_variants;
  expected public.ifttt_raw_receipt_variants;
  inserted integer;
  newly_retained boolean := false;
  now_at timestamptz;
begin
  if p_table is null or p_table not in ('line_source_ifttt_events','lines_ccc_ifttt_events')
    or p_row is null or jsonb_typeof(p_row)<>'object' or octet_length(p_row::text)>81920
    or jsonb_typeof(p_row->'raw_payload') is distinct from 'object' or octet_length((p_row->'raw_payload')::text)>65536
    or p_row->>'source' is distinct from 'ifttt' or p_row->>'processing_status' is distinct from 'pending'
    or p_row->>'tweet_id' is null or p_row->>'tweet_id' !~ '^[0-9]{1,30}$'
    or exists(select 1 from jsonb_object_keys(p_row) k where k not in
      ('source','source_group','source_key','source_account','username','text','link_to_tweet','tweet_id','tweet_embed_code','tweet_created_at','created_at_label','processing_status','raw_payload','updated_at'))
    or (p_table='lines_ccc_ifttt_events' and (p_row?'source_key' or p_row?'source_group')) then
    raise exception 'Invalid bounded IFTTT receipt input';
  end if;
  execute format('select to_jsonb(jsonb_populate_record(null::public.%I,$1)) - ''id'' - ''received_at'' - ''updated_at'' - ''processing_status''',p_table)
    into incoming_row using p_row;
  if p_table='line_source_ifttt_events' then
    execute 'insert into public.line_source_ifttt_events(source,source_group,source_key,source_account,username,text,link_to_tweet,tweet_id,tweet_embed_code,tweet_created_at,created_at_label,processing_status,raw_payload,updated_at)
      select source,source_group,source_key,source_account,username,text,link_to_tweet,tweet_id,tweet_embed_code,tweet_created_at,created_at_label,processing_status,raw_payload,updated_at
      from jsonb_populate_record(null::public.line_source_ifttt_events,$1) on conflict(source_key,tweet_id) do nothing' using p_row;
    get diagnostics inserted=row_count;
    select * into raw from public.line_source_ifttt_events where source_key=p_row->>'source_key' and tweet_id=p_row->>'tweet_id' for update;
  else
    execute 'insert into public.lines_ccc_ifttt_events(source,source_account,username,text,link_to_tweet,tweet_id,tweet_embed_code,tweet_created_at,created_at_label,processing_status,raw_payload,updated_at)
      select source,source_account,username,text,link_to_tweet,tweet_id,tweet_embed_code,tweet_created_at,created_at_label,processing_status,raw_payload,updated_at
      from jsonb_populate_record(null::public.lines_ccc_ifttt_events,$1) on conflict(tweet_id) do nothing' using p_row;
    get diagnostics inserted=row_count;
    select * into raw from public.lines_ccc_ifttt_events where tweet_id=p_row->>'tweet_id' for update;
  end if;
  if raw.id is null then raise exception 'Canonical raw receipt missing'; end if;
  raw_input:=to_jsonb(raw)-'id'-'received_at'-'updated_at'-'processing_status';
  if inserted=1 and incoming_row is distinct from raw_input then raise exception 'Inserted raw receipt was rewritten'; end if;
  select * into baseline from public.ifttt_raw_receipt_variants where event_table=p_table and event_id=raw.id and baseline_id is null;
  if not found then
    now_at:=clock_timestamp();
    expected:=row(gen_random_uuid(),p_table,raw.id,null,'canonical',raw_input,
      encode(sha256(convert_to(raw_input::text,'UTF8')),'hex'),raw.received_at,now_at)::public.ifttt_raw_receipt_variants;
    insert into public.ifttt_raw_receipt_variants select expected.*;
    select * into baseline from public.ifttt_raw_receipt_variants where receipt_id=expected.receipt_id;
    if not found or to_jsonb(baseline) is distinct from to_jsonb(expected) then raise exception 'Stored canonical receipt mismatch'; end if;
    newly_retained:=inserted=1;
  end if;
  if incoming_row=baseline.input_row then
    retained:=baseline;
  else
    select * into retained from public.ifttt_raw_receipt_variants where event_table=p_table and event_id=raw.id
      and input_hash=encode(sha256(convert_to(incoming_row::text,'UTF8')),'hex');
    if not found then
      now_at:=clock_timestamp();
      expected:=row(gen_random_uuid(),p_table,raw.id,baseline.receipt_id,'same_post_variant',incoming_row,
        encode(sha256(convert_to(incoming_row::text,'UTF8')),'hex'),now_at,now_at)::public.ifttt_raw_receipt_variants;
      insert into public.ifttt_raw_receipt_variants select expected.*;
      select * into retained from public.ifttt_raw_receipt_variants where receipt_id=expected.receipt_id;
      if not found or to_jsonb(retained) is distinct from to_jsonb(expected) then raise exception 'Stored variant receipt mismatch'; end if;
      newly_retained:=true;
    end if;
    if retained.input_row is distinct from incoming_row or retained.baseline_id is distinct from baseline.receipt_id
      or retained.classification<>'same_post_variant' then raise exception 'Conflicting retained variant receipt'; end if;
  end if;
  execute format('select to_jsonb(r) from public.%I r where id=$1',p_table) into final_raw using raw.id;
  if final_raw is distinct from to_jsonb(raw) then raise exception 'Raw row changed during receipt retention'; end if;
  return jsonb_build_object('version','ifttt-receipt-v1','table',p_table,'eventId',raw.id,'receiptId',retained.receipt_id,
    'classification',retained.classification,'outcome',case when newly_retained then 'retained' else 'duplicate' end,
    'requiresReview',retained.classification='same_post_variant','baselineId',retained.baseline_id,
    'receivedAt',retained.received_at,'inputRow',retained.input_row);
end $$;
revoke all on function public.retain_ifttt_raw_receipt(text,jsonb) from public,anon,authenticated;
grant execute on function public.retain_ifttt_raw_receipt(text,jsonb) to service_role;
commit;
