begin;
set local lock_timeout='2s';
set local statement_timeout='5s';

-- Task-local SQL7, after the selected replacement SQL6. No policy is installed
-- here. A separately approved operator registers exact future policy bytes.
create function public.valid_ifttt_intake_policy(p jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare s jsonb;
begin
  if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>8192
    or (select array_agg(k order by k) from jsonb_object_keys(p) k) is distinct from
      array['endsAt','id','maxAttempts','maxReceipts','scopes','startsAt','version']::text[]
    or p->>'version' is distinct from 'ifttt-intake-v1' or p->>'id' !~ '^[a-z0-9][a-z0-9_-]{0,63}$'
    or jsonb_typeof(p->'id') is distinct from 'string'
    or jsonb_typeof(p->'startsAt') is distinct from 'string' or jsonb_typeof(p->'endsAt') is distinct from 'string'
    or p->>'startsAt' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$'
    or p->>'endsAt' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$'
    or (p->>'startsAt')::timestamptz >= (p->>'endsAt')::timestamptz
    or jsonb_typeof(p->'maxAttempts') is distinct from 'number' or jsonb_typeof(p->'maxReceipts') is distinct from 'number'
    or p->>'maxAttempts' !~ '^[1-9][0-9]*$' or p->>'maxReceipts' !~ '^[1-9][0-9]*$'
    or (p->>'maxAttempts')::numeric>9007199254740991 or (p->>'maxReceipts')::numeric>9007199254740991
    or jsonb_typeof(p->'scopes') is distinct from 'array' or jsonb_array_length(p->'scopes')=0 then return false; end if;
  for s in select * from jsonb_array_elements(p->'scopes') loop
    if jsonb_typeof(s)<>'object' or (select array_agg(k order by k) from jsonb_object_keys(s) k) is distinct from
      array['sourceAccount','sourceGroup','sourceKey','table']::text[]
      or s->>'table' not in ('line_source_ifttt_events','lines_ccc_ifttt_events')
      or jsonb_typeof(s->'table') is distinct from 'string'
      or jsonb_typeof(s->'sourceGroup') is distinct from 'string' or s->>'sourceGroup' !~ '^[a-z0-9][a-z0-9_-]{0,63}$'
      or jsonb_typeof(s->'sourceKey') is distinct from 'string' or s->>'sourceKey' !~ '^[a-z0-9][a-z0-9_-]{0,63}$'
      or jsonb_typeof(s->'sourceAccount') is distinct from 'string' or s->>'sourceAccount' !~ '^[a-z0-9_]{1,15}$'
      then return false; end if;
  end loop;
  return (select count(*)=count(distinct v.value) from jsonb_array_elements(p->'scopes') as v(value));
exception when others then return false;
end $$;
revoke all on function public.valid_ifttt_intake_policy(jsonb) from public,anon,authenticated,service_role;

create table public.ifttt_intake_policies (
  policy_id text primary key,
  contract jsonb not null check(public.valid_ifttt_intake_policy(contract) and policy_id=contract->>'id'),
  attempts bigint not null default 0 check(attempts>=0 and attempts<=(contract->>'maxAttempts')::bigint),
  stopped_at timestamptz,
  stop_reason text,
  created_at timestamptz not null,
  check((stopped_at is null and stop_reason is null) or (stopped_at is not null and stop_reason is not null and length(stop_reason) between 1 and 256))
);
create table public.ifttt_intake_receipts (
  policy_id text not null references public.ifttt_intake_policies(policy_id),
  receipt_id uuid not null references public.ifttt_raw_receipt_variants(receipt_id),
  admitted_at timestamptz not null,
  primary key(policy_id,receipt_id)
);
alter table public.ifttt_intake_policies enable row level security;
alter table public.ifttt_intake_receipts enable row level security;
revoke all on public.ifttt_intake_policies,public.ifttt_intake_receipts from public,anon,authenticated,service_role;
grant select on public.ifttt_intake_policies,public.ifttt_intake_receipts to service_role;

create function public.guard_ifttt_intake_state() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_table_name='ifttt_intake_receipts' then
    if tg_op<>'INSERT' then raise exception 'Intake admission is immutable'; end if;
    return new;
  end if;
  if tg_op='DELETE' or new.policy_id is distinct from old.policy_id or new.contract is distinct from old.contract
    or new.created_at is distinct from old.created_at or new.attempts not between old.attempts and old.attempts+1
    or (old.stopped_at is not null and (new.stopped_at is distinct from old.stopped_at or new.stop_reason is distinct from old.stop_reason)) then
    raise exception 'Intake policy cannot be widened, resumed or reset';
  end if;
  return new;
end $$;
create trigger ifttt_intake_policy_immutable before update or delete on public.ifttt_intake_policies
for each row execute function public.guard_ifttt_intake_state();
create trigger ifttt_intake_receipt_immutable before update or delete on public.ifttt_intake_receipts
for each row execute function public.guard_ifttt_intake_state();
revoke all on function public.guard_ifttt_intake_state() from public,anon,authenticated,service_role;

-- Owner-only registration. The application cannot register, widen or reset.
create function public.register_ifttt_intake_policy(p_policy jsonb) returns jsonb
language plpgsql security invoker set search_path='' set lock_timeout='2s' as $$
declare existing public.ifttt_intake_policies; expected public.ifttt_intake_policies;
begin
  if not public.valid_ifttt_intake_policy(p_policy) then raise exception 'Invalid exact intake policy'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ifttt-intake-register:'||(p_policy->>'id'),0));
  select * into existing from public.ifttt_intake_policies where policy_id=p_policy->>'id' for update;
  if found then
    if existing.contract is distinct from p_policy then raise exception 'Intake policy already frozen'; end if;
    return to_jsonb(existing);
  end if;
  if (p_policy->>'startsAt')::timestamptz<=clock_timestamp() then raise exception 'Intake policy must start in the future'; end if;
  expected:=jsonb_populate_record(null::public.ifttt_intake_policies,jsonb_build_object(
    'policy_id',p_policy->>'id','contract',p_policy,'attempts',0,'created_at',clock_timestamp()));
  insert into public.ifttt_intake_policies select expected.*;
  select * into existing from public.ifttt_intake_policies where policy_id=expected.policy_id;
  if not found or to_jsonb(existing) is distinct from to_jsonb(expected) then raise exception 'Registered intake policy mismatch'; end if;
  return to_jsonb(existing);
end $$;
revoke all on function public.register_ifttt_intake_policy(jsonb) from public,anon,authenticated,service_role;

-- These two definer entrypoints deliberately restrict service_role to bounded
-- retention and monotonic stop. They use an empty search_path and fixed tables;
-- SQL6 remains invoker but is no longer directly service-callable.
create function public.stop_ifttt_intake_policy(p_id text,p_reason text) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare p public.ifttt_intake_policies; actual public.ifttt_intake_policies;
begin
  if p_reason is null or length(p_reason) not between 1 and 256 then raise exception 'Stop reason required'; end if;
  select * into p from public.ifttt_intake_policies where policy_id=p_id for update;
  if not found then raise exception 'Unknown intake policy'; end if;
  if p.stopped_at is not null then return to_jsonb(p); end if;
  p.stopped_at:=clock_timestamp(); p.stop_reason:=p_reason;
  update public.ifttt_intake_policies set stopped_at=p.stopped_at,stop_reason=p.stop_reason where policy_id=p_id;
  select * into actual from public.ifttt_intake_policies where policy_id=p_id;
  if not found or to_jsonb(actual) is distinct from to_jsonb(p) then raise exception 'Intake stop was rewritten'; end if;
  return to_jsonb(actual);
end $$;
revoke all on function public.stop_ifttt_intake_policy(text,text) from public,anon,authenticated,service_role;
grant execute on function public.stop_ifttt_intake_policy(text,text) to service_role;

create function public.retain_bounded_ifttt_raw_receipt(p_policy jsonb,p_scope jsonb,p_row jsonb) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare
  p public.ifttt_intake_policies; actual public.ifttt_intake_policies;
  envelope jsonb:=jsonb_build_object('version','ifttt-intake-v1','policyId',p_policy->>'id');
  receipt jsonb; ids uuid[]; rid uuid; expected_map public.ifttt_intake_receipts; actual_map public.ifttt_intake_receipts;
  before_raw jsonb; retained_raw jsonb; final_raw jsonb; retained_archive jsonb; final_archive jsonb;
  before_map jsonb; expected_maps jsonb; final_maps jsonb; n bigint; failure text;
  tab text:=p_scope->>'table';
begin
  if not public.valid_ifttt_intake_policy(p_policy) then return envelope||'{"status":"invalid_policy"}'::jsonb; end if;
  select * into p from public.ifttt_intake_policies where policy_id=p_policy->>'id' for update;
  if not found then return envelope||'{"status":"missing_policy"}'::jsonb; end if;
  if p.contract is distinct from p_policy then return envelope||'{"status":"policy_mismatch"}'::jsonb; end if;
  if p_scope is null or not (p.contract->'scopes' @> jsonb_build_array(p_scope))
    or (select count(*) from jsonb_object_keys(p_scope))<>4 then return envelope||'{"status":"scope_denied"}'::jsonb; end if;
  if p.stopped_at is not null then return envelope||'{"status":"stopped"}'::jsonb; end if;
  if clock_timestamp()<(p.contract->>'startsAt')::timestamptz then return envelope||'{"status":"not_started"}'::jsonb; end if;
  if clock_timestamp()>=(p.contract->>'endsAt')::timestamptz then return envelope||'{"status":"expired"}'::jsonb; end if;
  if p.attempts>=(p.contract->>'maxAttempts')::bigint then return envelope||'{"status":"attempt_cap"}'::jsonb; end if;
  if p_row->>'tweet_id' is null or p_row->>'tweet_id' !~ '^[0-9]{1,30}$'
    or (tab='line_source_ifttt_events' and (p_row->>'source_group' is distinct from p_scope->>'sourceGroup'
      or p_row->>'source_key' is distinct from p_scope->>'sourceKey')) then return envelope||'{"status":"scope_denied"}'::jsonb; end if;

  -- Snapshot BEFORE any quota UPDATE/INSERT trigger. Existing carriers never
  -- run a conflict INSERT (R19). The core uses this same reentrant key lock.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ifttt-raw-receipt-v1:'||tab||':'||
    case when tab='line_source_ifttt_events' then p_row->>'source_key' else '' end||':'||(p_row->>'tweet_id'),0));
  if tab='line_source_ifttt_events' then
    select to_jsonb(r) into before_raw from public.line_source_ifttt_events r where source_key=p_row->>'source_key' and tweet_id=p_row->>'tweet_id' for update;
  else
    select to_jsonb(r) into before_raw from public.lines_ccc_ifttt_events r where tweet_id=p_row->>'tweet_id' for update;
  end if;
  p.attempts:=p.attempts+1;
  update public.ifttt_intake_policies set attempts=p.attempts where policy_id=p.policy_id;
  select * into actual from public.ifttt_intake_policies where policy_id=p.policy_id;
  if not found or to_jsonb(actual) is distinct from to_jsonb(p) then raise exception 'Intake attempt counter was rewritten'; end if;
  if tab='line_source_ifttt_events' then
    select to_jsonb(r) into final_raw from public.line_source_ifttt_events r where source_key=p_row->>'source_key' and tweet_id=p_row->>'tweet_id';
  else
    select to_jsonb(r) into final_raw from public.lines_ccc_ifttt_events r where tweet_id=p_row->>'tweet_id';
  end if;
  if final_raw is distinct from before_raw then raise exception 'Intake attempt rewrote raw carrier'; end if;

  -- Ordinary retention failures and receipt-cap rollback still charge the
  -- attempt. Whole-statement cancellation/backend death can roll back both;
  -- this is an admitted-work budget, not a universal HTTP/CPU rate limiter.
  begin
    receipt:=public.retain_ifttt_raw_receipt(tab,p_row);
    ids:=array[(receipt->>'receiptId')::uuid];
    if receipt->>'baselineId' is not null then ids:=array_append(ids,(receipt->>'baselineId')::uuid); end if;
    execute format('select to_jsonb(r) from public.%I r where id=$1',tab) into retained_raw using (receipt->>'eventId')::uuid;
    if retained_raw is null or (before_raw is not null and retained_raw is distinct from before_raw) then raise exception 'Intake raw carrier mismatch'; end if;
    select jsonb_agg(to_jsonb(r) order by receipt_id) into retained_archive from public.ifttt_raw_receipt_variants r where receipt_id=any(ids);
    select coalesce(jsonb_agg(to_jsonb(r) order by receipt_id),'[]'::jsonb),count(*) into before_map,n from public.ifttt_intake_receipts r where policy_id=p.policy_id;
    expected_maps:=before_map;
    foreach rid in array ids loop
      if not exists(select 1 from public.ifttt_intake_receipts where policy_id=p.policy_id and receipt_id=rid) then
        if n>=(p.contract->>'maxReceipts')::bigint then raise exception using errcode='P0002',message='Intake receipt cap'; end if;
        expected_map:=jsonb_populate_record(null::public.ifttt_intake_receipts,jsonb_build_object('policy_id',p.policy_id,'receipt_id',rid,'admitted_at',clock_timestamp()));
        insert into public.ifttt_intake_receipts select expected_map.*;
        select * into actual_map from public.ifttt_intake_receipts where policy_id=p.policy_id and receipt_id=rid;
        if not found or to_jsonb(actual_map) is distinct from to_jsonb(expected_map) then raise exception 'Intake admission was rewritten'; end if;
        expected_maps:=expected_maps||jsonb_build_array(to_jsonb(expected_map)); n:=n+1;
      end if;
    end loop;
    select jsonb_agg(v order by v->>'receipt_id') into expected_maps from jsonb_array_elements(expected_maps) v;
    select jsonb_agg(to_jsonb(r) order by receipt_id) into final_maps from public.ifttt_intake_receipts r where policy_id=p.policy_id;
    execute format('select to_jsonb(r) from public.%I r where id=$1',tab) into final_raw using (receipt->>'eventId')::uuid;
    select jsonb_agg(to_jsonb(r) order by receipt_id) into final_archive from public.ifttt_raw_receipt_variants r where receipt_id=any(ids);
    select * into actual from public.ifttt_intake_policies where policy_id=p.policy_id;
    if not found or to_jsonb(actual) is distinct from to_jsonb(p) or final_maps is distinct from expected_maps
      or final_raw is distinct from retained_raw or final_archive is distinct from retained_archive then raise exception 'Intake retained postconditions changed'; end if;
    if clock_timestamp()>=(p.contract->>'endsAt')::timestamptz then raise exception using errcode='P0003',message='Intake expired during retention'; end if;
  exception when others then
    get stacked diagnostics failure=returned_sqlstate;
    return envelope||jsonb_build_object('status',case failure when 'P0002' then 'receipt_cap' when 'P0003' then 'expired' else 'storage_failed' end);
  end;
  return envelope||jsonb_build_object('status','retained','receipt',receipt);
end $$;
revoke all on function public.retain_bounded_ifttt_raw_receipt(jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.retain_bounded_ifttt_raw_receipt(jsonb,jsonb,jsonb) to service_role;
revoke execute on function public.retain_ifttt_raw_receipt(text,jsonb) from public,anon,authenticated,service_role;
revoke insert on public.ifttt_raw_receipt_variants from service_role;
commit;
