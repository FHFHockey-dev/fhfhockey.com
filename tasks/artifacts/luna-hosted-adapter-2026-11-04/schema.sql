-- UNAPPLIED SCHEMA CANDIDATE. Not a production migration or an activation script.
-- Requires owner review of the deployed retention schema, ACLs and RPC exposure.
-- Owner stages receipts only from verified immutable retention with provenance_ref;
-- there is deliberately no HTTP/service-role enqueue, source import or policy reset.
-- Hash-bearing input, receipt and result JSON is stored as TEXT: jsonb would
-- reorder object keys and invalidate the existing order-sensitive digests.
-- No policy, job, credential, schedule or enabled flag is seeded here.
begin;
create schema luna_hosted;
revoke all on schema luna_hosted from public, anon, authenticated, service_role;
create table luna_hosted.policy (
  singleton boolean primary key default true check (singleton),
  approval_id text not null check (length(approval_id) between 1 and 200),
  enabled boolean not null default false,
  stopped boolean not null default false,
  starts_at timestamptz not null,
  expires_at timestamptz not null check (expires_at > starts_at),
  max_calls integer not null check (max_calls between 1 and 20),
  cap_nano_usd bigint not null check (cap_nano_usd between 1 and 9007199254740991),
  prior_exposure_nano_usd bigint not null check (prior_exposure_nano_usd between 0 and cap_nano_usd)
);
create table luna_hosted.sources (
  receipt_id text primary key,
  receipt_json text not null check (jsonb_typeof(receipt_json::jsonb) = 'object' and octet_length(receipt_json) <= 512000),
  receipt_hash text not null check (receipt_hash ~ '^[a-f0-9]{64}$'),
  provenance_ref text not null check (length(provenance_ref) between 1 and 500),
  check ((receipt_json::jsonb->>'id') is not distinct from receipt_id)
);
create table luna_hosted.jobs (
  id uuid primary key,
  approval_id text not null,
  receipt_id text not null references luna_hosted.sources,
  input_json text not null check (octet_length(input_json) <= 512000),
  input_hash text not null unique check (input_hash ~ '^[a-f0-9]{64}$'),
  reference_hash text not null check (reference_hash ~ '^[a-f0-9]{64}$'),
  state text not null default 'pending' check (state in ('pending','running','completed','held')),
  result_json text,
  check (result_json is null or octet_length(result_json) <= 1500000)
);
create table luna_hosted.attempts (
  job_id uuid primary key references luna_hosted.jobs,
  request_key text not null unique check (request_key ~ '^[a-f0-9]{64}$'),
  reserved_nano_usd bigint not null check (reserved_nano_usd = 233000000),
  state text not null check (state in ('reserved','settled','uncertain')),
  receipt_json text,
  request_id text,
  -- Caller-reported usage charge is advisory; it never reduces admission exposure.
  charge_nano_usd bigint check (charge_nano_usd between 0 and reserved_nano_usd),
  check ((state = 'settled') = (receipt_json is not null and charge_nano_usd is not null))
);
alter table luna_hosted.policy enable row level security;
alter table luna_hosted.sources enable row level security;
alter table luna_hosted.jobs enable row level security;
alter table luna_hosted.attempts enable row level security;
revoke all on all tables in schema luna_hosted from public, anon, authenticated, service_role;

-- Definer is private; the exposed wrapper remains SECURITY INVOKER. Only the
-- backend role can call either function. Owner privileges must be audited before
-- deployment. No auth.uid user session exists for this machine-only worker.
create function luna_hosted.review_rpc(p_action text, p_job_id uuid, p_payload jsonb)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, luna_hosted
set lock_timeout = '2s'
as $$
declare
  p luna_hosted.policy%rowtype; j luna_hosted.jobs%rowtype;
  s luna_hosted.sources%rowtype; a luna_hosted.attempts%rowtype;
  base jsonb := jsonb_build_object('version','luna-hosted-review-v1','jobId',p_job_id);
  exposure numeric; calls integer; target text; r jsonb; charge bigint;
begin
  if p_action is null or p_action not in ('claim','reserve','settle','uncertain','finish','hold')
    or jsonb_typeof(p_payload) is distinct from 'object' then
    return base || '{"status":"refused"}'::jsonb;
  end if;
  -- Shared row lock serializes admission and stop across every invocation/job.
  select * into p from luna_hosted.policy where singleton for update;
  if not found then return base || '{"status":"refused"}'::jsonb; end if;
  select * into j from luna_hosted.jobs where id = p_job_id for update;
  if not found or j.approval_id <> p.approval_id then return base || '{"status":"refused"}'::jsonb; end if;
  select * into a from luna_hosted.attempts where job_id = p_job_id;

  if p_action = 'hold' then
    update luna_hosted.policy set stopped = true where singleton;
    if j.state <> 'completed' then update luna_hosted.jobs set state = 'held' where id = j.id; end if;
    return base || '{"status":"held"}'::jsonb;
  elsif p_action = 'uncertain' then
    update luna_hosted.policy set stopped = true where singleton;
    update luna_hosted.attempts set state = 'uncertain', request_id = left(p_payload->>'requestId',200)
      where job_id = j.id and request_key = p_payload->>'key' and state = 'reserved';
    -- A lost settlement reply may already have committed. Never erase that receipt.
    return base || '{"status":"held"}'::jsonb;
  elsif p_action = 'settle' then
    r := (p_payload->>'receiptJson')::jsonb;
    if a.job_id is null or a.request_key is distinct from p_payload->>'key' or a.state not in ('reserved','settled')
      or r->>'endpoint' is distinct from 'responses' or jsonb_typeof(r->'body') is distinct from 'object'
      or r#>>'{body,model}' is distinct from 'gpt-6-luna'
      or octet_length(r::text) > 280000
      or jsonb_typeof(r->'chargeNanoUsd') is distinct from 'number' then
      return base || '{"status":"refused"}'::jsonb;
    end if;
    if (r->>'chargeNanoUsd')::numeric <> trunc((r->>'chargeNanoUsd')::numeric) then return base || '{"status":"refused"}'::jsonb; end if;
    charge := (r->>'chargeNanoUsd')::bigint;
    if charge < 0 or charge > a.reserved_nano_usd or (a.state = 'settled' and a.receipt_json is distinct from p_payload->>'receiptJson') then
      return base || '{"status":"refused"}'::jsonb;
    end if;
    update luna_hosted.attempts set state = 'settled', receipt_json = p_payload->>'receiptJson', charge_nano_usd = charge where job_id = j.id;
    return base || '{"status":"settled"}'::jsonb;
  elsif p_action = 'finish' then
    r := (p_payload->>'resultJson')::jsonb;
    if jsonb_typeof(r) is distinct from 'object' or octet_length(r::text) > 1500000
      or coalesce(r#>>'{review,status}' not in ('review_only','held'),true)
      or r#>'{review,canPublish}' is distinct from 'false'::jsonb
      or r#>'{review,canChangeStatus}' is distinct from 'false'::jsonb
      or r#>'{review,canWriteAliases}' is distinct from 'false'::jsonb
      or r#>'{review,canExecuteReplacement}' is distinct from 'false'::jsonb
      or (r->'candidate' <> 'null'::jsonb and r#>'{candidate,content,canApply}' is distinct from 'false'::jsonb) then
      return base || '{"status":"refused"}'::jsonb;
    end if;
    target := case when r#>>'{review,status}' = 'held' then 'held' else 'completed' end;
    if j.state in ('completed','held') then
      if j.result_json = p_payload->>'resultJson' then return base || jsonb_build_object('status',j.state); end if;
      return base || '{"status":"refused"}'::jsonb;
    end if;
    if j.state <> 'running' or (target = 'completed' and a.state is distinct from 'settled') then
      return base || '{"status":"refused"}'::jsonb;
    end if;
    update luna_hosted.jobs set state = target, result_json = p_payload->>'resultJson' where id = j.id;
    if target = 'held' then update luna_hosted.policy set stopped = true where singleton; end if;
    return base || jsonb_build_object('status',target);
  elsif p_action not in ('claim','reserve') then
    return base || '{"status":"refused"}'::jsonb;
  end if;

  if p_action = 'claim' and j.state in ('completed','held') then
    return base || jsonb_build_object('status',j.state);
  end if;
  if not p.enabled or p.stopped or clock_timestamp() < p.starts_at or clock_timestamp() >= p.expires_at then
    return base || '{"status":"refused"}'::jsonb;
  end if;
  if p_action = 'claim' then
    if j.state <> 'pending' or exists (select 1 from luna_hosted.jobs where state = 'running')
      or exists (select 1 from luna_hosted.attempts where state <> 'settled') then
      return base || '{"status":"refused"}'::jsonb;
    end if;
    select * into s from luna_hosted.sources where receipt_id = j.receipt_id;
    if not found then return base || '{"status":"refused"}'::jsonb; end if;
    update luna_hosted.jobs set state = 'running' where id = j.id;
    return base || jsonb_build_object('status','claimed','job',jsonb_build_object(
      'id',j.id,'inputJson',j.input_json,'inputHash',j.input_hash,'referenceHash',j.reference_hash,
      'receiptJson',s.receipt_json,'receiptHash',s.receipt_hash,'provenanceRef',s.provenance_ref));
  end if;
  if j.state <> 'running' or (p_payload->>'amountNanoUsd') is distinct from '233000000'
    or not coalesce(p_payload->>'key' ~ '^[a-f0-9]{64}$', false) then return base || '{"status":"refused"}'::jsonb; end if;
  if a.state = 'settled' and a.request_key = p_payload->>'key' then
    return base || jsonb_build_object('status','replay','receiptJson',a.receipt_json);
  end if;
  if a.job_id is not null or exists (select 1 from luna_hosted.attempts where state <> 'settled') then
    return base || '{"status":"refused"}'::jsonb;
  end if;
  -- Every attempt consumes its full reservation for the entire pilot, including
  -- settled attempts. Malformed/understated usage cannot create new spending room.
  select count(*), coalesce(sum(reserved_nano_usd),0)
    into calls, exposure from luna_hosted.attempts;
  if calls >= p.max_calls or exposure + p.prior_exposure_nano_usd + 233000000 > p.cap_nano_usd then
    return base || '{"status":"refused"}'::jsonb;
  end if;
  insert into luna_hosted.attempts values (j.id,p_payload->>'key',233000000,'reserved',null,null,null);
  return base || '{"status":"reserved"}'::jsonb;
end $$;
revoke all on function luna_hosted.review_rpc(text,uuid,jsonb) from public, anon, authenticated;
grant usage on schema luna_hosted to service_role;
grant execute on function luna_hosted.review_rpc(text,uuid,jsonb) to service_role;
create function public.luna_hosted_review_rpc(p_action text, p_job_id uuid, p_payload jsonb)
returns jsonb language sql security invoker set search_path = pg_catalog
as $$ select luna_hosted.review_rpc(p_action,p_job_id,p_payload) $$;
revoke all on function public.luna_hosted_review_rpc(text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.luna_hosted_review_rpc(text,uuid,jsonb) to service_role;
commit;
