-- UNAPPLIED, UNSCHEDULED local candidate for one fresh isolated pilot only.
-- Requires schema.sql + archive.sql. No policy, retention plan or job is seeded.
-- A callable purge is NOT a deployed schedule or a seven-day deletion promise.
begin;
do $$ begin
 if exists(select 1 from luna_capture.receipts) or exists(select 1 from luna_capture.approvals)
  or exists(select 1 from luna_capture.enrollments) or exists(select 1 from luna_hosted.sources)
  or exists(select 1 from luna_hosted.jobs) or exists(select 1 from luna_hosted.attempts)
 then raise exception 'retention candidate requires empty pilot content tables'; end if;
end $$;
create schema luna_retention;
revoke all on schema luna_retention from public,anon,authenticated,service_role;
create table luna_retention.plan (
 singleton boolean primary key default true check(singleton),
 capture_policy_id uuid not null unique references luna_capture.policy(id),
 worker_approval_id text not null,
 purge_after timestamptz not null check(isfinite(purge_after))
);
create table luna_retention.retirement (
 capture_policy_id uuid primary key, worker_approval_id text not null,
 purged_at timestamptz not null, deadline timestamptz not null,
 recorded_capture_attempts integer not null, retained_receipts integer not null,
 prior_exposure_nano_usd bigint not null, carried_reservations_nano_usd bigint not null,
 total_exposure_nano_usd bigint not null, call_count integer not null,
 unresolved_count integer not null, deleted_rows jsonb not null
);
create table luna_retention.attempt_tombstones (
 job_id uuid primary key, request_key text not null unique,
 reserved_nano_usd bigint not null check(reserved_nano_usd=233000000),
 state text not null check(state in ('reserved','settled','uncertain')),
 charge_nano_usd bigint, request_id text check(request_id is null or request_id ~ '^[A-Za-z0-9_-]{1,200}$')
);
-- Permanent private URL index, not a copy of report/model content. No FK to
-- payload rows: removing a receipt must never cascade into its usable URL.
create table luna_retention.source_references (
 receipt_id uuid primary key,
 capture_policy_id uuid not null references luna_capture.policy(id),
 source_account text not null check(source_account ~ '^[a-z0-9_]{1,15}$'),
 post_id text not null check(post_id ~ '^[0-9]{1,30}$'),
 tweet_url text not null check(tweet_url='https://x.com/'||source_account||'/status/'||post_id),
 first_received_at timestamptz not null check(isfinite(first_received_at)),
 payload_sha256 text not null check(payload_sha256 ~ '^[a-f0-9]{64}$'),
 attribution_basis text not null check(attribution_basis='submitted_capture_metadata')
);
-- A private transaction-scoped authorization, never settable by service_role.
-- Only the purge function inserts it; owner remains the trusted schema operator.
create table luna_retention.purge_context (transaction_id bigint primary key, capture_policy_id uuid not null);
create function luna_retention.no_change() returns trigger language plpgsql set search_path=pg_catalog as $$
begin raise exception 'immutable retention metadata' using errcode='42501'; end $$;
create trigger immutable_plan before update or delete on luna_retention.plan for each row execute function luna_retention.no_change();
create trigger immutable_retirement before update or delete on luna_retention.retirement for each row execute function luna_retention.no_change();
create trigger immutable_attempt_tombstone before update or delete on luna_retention.attempt_tombstones for each row execute function luna_retention.no_change();
create trigger immutable_source_reference before update or delete on luna_retention.source_references for each row execute function luna_retention.no_change();

create function luna_retention.check_plan() returns trigger language plpgsql set search_path=pg_catalog as $$
declare c luna_capture.policy%rowtype; w luna_hosted.policy%rowtype;
begin
 select * into w from luna_hosted.policy where singleton for update;
 select * into c from luna_capture.policy where id=new.capture_policy_id for update;
 if c.id is null or w.approval_id is distinct from new.worker_approval_id
  or not isfinite(c.starts_at) or not isfinite(c.expires_at) or not isfinite(w.starts_at) or not isfinite(w.expires_at)
  or c.max_attempts>10 or c.max_receipts<>1 or c.max_bytes>65536
  or c.expires_at>c.starts_at+interval '1 hour'
  or w.starts_at<c.starts_at or w.expires_at>c.expires_at or w.max_calls<>1 or w.cap_nano_usd>1000000000
  or new.purge_after<c.expires_at+interval '1 hour' or new.purge_after>c.starts_at+interval '7 days'
  or exists(select 1 from luna_retention.retirement)
 then raise exception 'invalid bounded retention plan' using errcode='22023'; end if;
 return new;
end $$;
create trigger validate_plan before insert on luna_retention.plan for each row execute function luna_retention.check_plan();

-- All report-bearing writes require prior owner enrollment, and cannot recreate
-- content once the fixed deadline or permanent retirement has been reached.
create function luna_retention.content_write_guard() returns trigger language plpgsql set search_path=pg_catalog as $$
declare deadline timestamptz;
begin
 select purge_after into deadline from luna_retention.plan where singleton;
 if deadline is null or clock_timestamp()>=deadline or exists(select 1 from luna_retention.retirement)
 then raise exception 'pilot content retention closed' using errcode='42501'; end if;
 return new;
end $$;
create trigger retention_write_guard before insert or update on luna_capture.receipts for each row execute function luna_retention.content_write_guard();
create trigger retention_write_guard before insert or update on luna_capture.approvals for each row execute function luna_retention.content_write_guard();
create trigger retention_write_guard before insert or update on luna_capture.enrollments for each row execute function luna_retention.content_write_guard();
create trigger retention_write_guard before insert or update on luna_hosted.sources for each row execute function luna_retention.content_write_guard();
create trigger retention_write_guard before insert or update on luna_hosted.jobs for each row execute function luna_retention.content_write_guard();
create trigger retention_write_guard before insert or update on luna_hosted.attempts for each row execute function luna_retention.content_write_guard();
create function luna_retention.worker_policy_guard() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if exists(select 1 from luna_retention.retirement) then raise exception 'retired worker policy cannot reset' using errcode='42501'; end if;
 if exists(select 1 from luna_retention.plan) then
  if tg_op='DELETE' or (to_jsonb(new)-array['enabled','stopped','prior_exposure_nano_usd']) is distinct from
    (to_jsonb(old)-array['enabled','stopped','prior_exposure_nano_usd']) or (old.stopped and not new.stopped)
   or (new.prior_exposure_nano_usd is distinct from old.prior_exposure_nano_usd and
     (new.prior_exposure_nano_usd<old.prior_exposure_nano_usd or new.enabled or not new.stopped
      or not exists(select 1 from luna_retention.purge_context where transaction_id=txid_current())))
  then raise exception 'enrolled worker policy cannot reset' using errcode='42501'; end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger retention_policy_guard before update or delete on luna_hosted.policy for each row execute function luna_retention.worker_policy_guard();

-- Replace only the private immutable trigger implementation. Ordinary UPDATE and
-- DELETE remain denied. The bounded cleanup transaction permits scoped DELETE;
-- there is no ALTER TABLE DISABLE TRIGGER or session flag that a backend can set.
create or replace function luna_capture.immutable_row() returns trigger language plpgsql set search_path=pg_catalog as $$
declare policy uuid; receipt uuid;
begin
 select capture_policy_id into policy from luna_retention.purge_context where transaction_id=txid_current();
 if tg_op='DELETE' and policy is not null and tg_table_schema='luna_capture' then
  if tg_table_name='receipts' and (to_jsonb(old)->>'policy_id')::uuid=policy then return old; end if;
  if tg_table_name in ('approvals','enrollments') then
   receipt:=(to_jsonb(old)->>'receipt_id')::uuid;
   if exists(select 1 from luna_capture.receipts where id=receipt and policy_id=policy) then return old; end if;
  end if;
 end if;
 raise exception 'immutable capture evidence' using errcode='42501';
end $$;

-- The successful settlement RPC persists requestId in receipt_json, whereas
-- uncertain outcomes may use the column. Preserve either validated identity,
-- refuse disagreement/malformed values, and never guess an ID from body.id.
create function luna_retention.reconciliation_request_id(column_id text,receipt_text text)
returns text language plpgsql immutable set search_path=pg_catalog as $$
declare receipt jsonb; receipt_id text;
begin
 if column_id is not null and column_id !~ '^[A-Za-z0-9_-]{1,200}$'
 then raise exception 'invalid retention request identity' using errcode='22023'; end if;
 if receipt_text is not null then
  if octet_length(receipt_text)>280000 then raise exception 'invalid retention receipt' using errcode='22023'; end if;
  begin receipt:=receipt_text::jsonb;
  exception when invalid_text_representation then raise exception 'invalid retention receipt' using errcode='22023'; end;
  if jsonb_typeof(receipt) is distinct from 'object'
   or (receipt ? 'requestId' and jsonb_typeof(receipt->'requestId') not in ('string','null'))
  then raise exception 'invalid retention request identity' using errcode='22023'; end if;
  receipt_id:=receipt->>'requestId';
  if receipt_id is not null and receipt_id !~ '^[A-Za-z0-9_-]{1,200}$'
  then raise exception 'invalid retention request identity' using errcode='22023'; end if;
 end if;
 if column_id is not null and receipt_id is not null and column_id<>receipt_id
 then raise exception 'conflicting retention request identities' using errcode='22023'; end if;
 return coalesce(receipt_id,column_id);
end $$;

-- Recheck the URL projection against immutable receipt bytes. This proves only
-- submitted metadata consistency; it neither authenticates nor republishes it.
create function luna_retention.source_reference(r luna_capture.receipts,c luna_capture.policy)
returns luna_retention.source_references language plpgsql immutable set search_path=pg_catalog as $$
declare e jsonb; raw json; link text; matched text[]; received timestamptz;
begin
 begin
  e:=r.envelope_json::jsonb;
  if jsonb_typeof(e) is distinct from 'object' or e->>'version' is distinct from 'luna-isolated-capture-v1'
   or r.policy_id is distinct from c.id or r.applet_id is distinct from c.applet_id
   or e->'scope' is distinct from jsonb_build_object('policyId',c.id::text,'appletId',c.applet_id,'sourceAccount',c.source_account)
   or e->'sourceAuthenticated' is distinct from 'false'::jsonb
   or jsonb_typeof(e->'rawBody') is distinct from 'string'
   or e->>'payloadSha256' is distinct from r.payload_sha256
   or encode(sha256(convert_to(e->>'rawBody','UTF8')),'hex') is distinct from r.payload_sha256
   or octet_length(e->>'rawBody') is distinct from r.byte_length
   or e->'byteLength' is distinct from to_jsonb(r.byte_length)
   or jsonb_typeof(e#>'{submitted,link}') is distinct from 'string'
   or jsonb_typeof(e#>'{submitted,postId}') is distinct from 'string'
   or jsonb_typeof(e->'receivedAt') is distinct from 'string'
   or not coalesce(e->>'receivedAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9](\.[0-9]+)?)?Z$',false)
  then raise exception 'invalid source reference'; end if;
  raw:=(e->>'rawBody')::json;
  if json_typeof(raw) is distinct from 'object'
   or (select count(*)<>count(distinct key) from json_each(raw))
   or (select count(*) from json_object_keys(raw) k where k in ('link_to_tweet','linkToTweet','LinkToTweet'))<>1
  then raise exception 'invalid source reference'; end if;
  link:=coalesce(raw->>'link_to_tweet',raw->>'linkToTweet',raw->>'LinkToTweet');
  if link is distinct from e#>>'{submitted,link}' then raise exception 'invalid source reference'; end if;
  matched:=regexp_match(luna_capture.trim_wire(link),'^https://(www\.)?(x\.com|twitter\.com)(:443)?/([A-Za-z0-9_]{1,15})/status/([0-9]{1,30})(\?[^#]*)?$','i');
  received:=(e->>'receivedAt')::timestamptz;
  if matched is null or lower(matched[4]) is distinct from lower(c.source_account)
   or matched[5] is distinct from e#>>'{submitted,postId}'
   or luna_capture.trim_wire(link) !~ '^[^:]+://[^/]+/[A-Za-z0-9_]{1,15}/status/[0-9]{1,30}(\?[^#]*)?$'
   or received is distinct from r.first_received_at or not isfinite(received)
  then raise exception 'invalid source reference'; end if;
 exception when others then
  raise exception 'invalid retention source reference' using errcode='22023';
 end;
 return row(r.id,c.id,lower(c.source_account),matched[5],
  'https://x.com/'||lower(c.source_account)||'/status/'||matched[5],received,r.payload_sha256,
  'submitted_capture_metadata')::luna_retention.source_references;
end $$;

create function luna_retention.purge_due(p_capture_policy_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog set lock_timeout='2s' as $$
declare p luna_retention.plan%rowtype; c luna_capture.policy%rowtype; w luna_hosted.policy%rowtype;
 reservation_total bigint; calls integer; unresolved integer; counts jsonb; prior bigint;
 source_row luna_capture.receipts%rowtype; expected_ref luna_retention.source_references%rowtype; existing_ref luna_retention.source_references%rowtype;
begin
 -- Each statement after table-lock acquisition must obtain a fresh snapshot.
 -- REPEATABLE READ/SERIALIZABLE can hide inserts committed after their snapshot.
 if current_setting('transaction_isolation') is distinct from 'read committed'
 then raise exception 'retention cleanup requires READ COMMITTED' using errcode='25001'; end if;
 -- Same worker-before-capture order as owner staging, serialized with admission.
 select * into w from luna_hosted.policy where singleton for update;
 select * into c from luna_capture.policy where id=p_capture_policy_id for update;
 select * into p from luna_retention.plan where capture_policy_id=p_capture_policy_id;
 if c.id is null or p.capture_policy_id is null or w.approval_id is distinct from p.worker_approval_id
 then return jsonb_build_object('status','refused'); end if;
 if exists(select 1 from luna_retention.retirement where capture_policy_id=p_capture_policy_id)
 then
  if (select count(*) from luna_retention.source_references where capture_policy_id=p_capture_policy_id)
   is distinct from (select retained_receipts::bigint from luna_retention.retirement where capture_policy_id=p_capture_policy_id)
  then raise exception 'retained URL reconciliation required' using errcode='22023'; end if;
  return jsonb_build_object('status','purged','replay',true);
 end if;
 if clock_timestamp()<p.purge_after then return jsonb_build_object('status','not_due'); end if;
 -- Wait for any content transaction that began before the deadline; no success
 -- can race an invisible uncommitted row. Late writes fail their time guard.
 lock table luna_capture.receipts,luna_capture.approvals,luna_capture.enrollments,
  luna_hosted.sources,luna_hosted.jobs,luna_hosted.attempts in access exclusive mode;
 -- This cleanup is intentionally one pilot, not a multi-feed or historical purge.
 if exists(select 1 from luna_capture.receipts where policy_id<>p_capture_policy_id)
  or exists(select 1 from luna_capture.approvals a where a.worker_approval_id<>p.worker_approval_id
    or not exists(select 1 from luna_capture.receipts r where r.id=a.receipt_id and r.policy_id=p_capture_policy_id))
  or exists(select 1 from luna_capture.enrollments e where e.worker_approval_id<>p.worker_approval_id
    or not exists(select 1 from luna_capture.receipts r where r.id=e.receipt_id and r.policy_id=p_capture_policy_id))
  or exists(select 1 from luna_hosted.sources s where not exists(select 1 from luna_capture.receipts r where r.id::text=s.receipt_id and r.policy_id=p_capture_policy_id))
  or exists(select 1 from luna_hosted.jobs j where j.approval_id<>p.worker_approval_id
    or not exists(select 1 from luna_capture.receipts r where r.id::text=j.receipt_id and r.policy_id=p_capture_policy_id))
  or c.receipts<>(select count(*) from luna_capture.receipts)
  or (select count(*) from luna_capture.receipts)>1 or (select count(*) from luna_hosted.jobs)>1
  or (select count(*) from luna_capture.approvals)>100
 then raise exception 'retention scope requires owner reconciliation' using errcode='22023'; end if;
 select coalesce(sum(reserved_nano_usd),0),count(*),count(*) filter(where state<>'settled')
 into reservation_total,calls,unresolved from luna_hosted.attempts;
 prior:=w.prior_exposure_nano_usd;
 if prior+reservation_total>w.cap_nano_usd then raise exception 'retention exposure conflict' using errcode='22023'; end if;
 counts:=jsonb_build_object('receipts',(select count(*) from luna_capture.receipts),
  'approvals',(select count(*) from luna_capture.approvals),'enrollments',(select count(*) from luna_capture.enrollments),
  'sources',(select count(*) from luna_hosted.sources),'jobs',(select count(*) from luna_hosted.jobs),'attempts',calls);
 -- URL insertion and all payload/accounting changes commit or roll back together.
 for source_row in select * from luna_capture.receipts where policy_id=p_capture_policy_id loop
  expected_ref:=luna_retention.source_reference(source_row,c);
  insert into luna_retention.source_references select (expected_ref).* on conflict(receipt_id) do nothing;
  select * into existing_ref from luna_retention.source_references where receipt_id=source_row.id;
  if existing_ref is distinct from expected_ref then
   raise exception 'conflicting retained source reference' using errcode='22023';
  end if;
 end loop;
 if (select count(*) from luna_retention.source_references)<>(select count(*) from luna_capture.receipts) then
  raise exception 'retained source reference scope conflict' using errcode='22023';
 end if;
 insert into luna_retention.purge_context values(txid_current(),p_capture_policy_id);
 update luna_hosted.policy set enabled=false,stopped=true,prior_exposure_nano_usd=prior+reservation_total where singleton;
 update luna_capture.policy set enabled=false,stopped=true where id=p_capture_policy_id;
 insert into luna_retention.attempt_tombstones select job_id,request_key,reserved_nano_usd,state,charge_nano_usd,
  luna_retention.reconciliation_request_id(request_id,receipt_json) from luna_hosted.attempts;
 insert into luna_retention.retirement values(p_capture_policy_id,p.worker_approval_id,clock_timestamp(),p.purge_after,
  c.attempts,c.receipts,prior,reservation_total,prior+reservation_total,calls,unresolved,counts);
 delete from luna_capture.enrollments where worker_approval_id=p.worker_approval_id;
 delete from luna_capture.approvals where worker_approval_id=p.worker_approval_id;
 delete from luna_hosted.attempts where job_id in(select id from luna_hosted.jobs where approval_id=p.worker_approval_id);
 delete from luna_hosted.jobs where approval_id=p.worker_approval_id;
 delete from luna_hosted.sources where receipt_id in(select id::text from luna_capture.receipts where policy_id=p_capture_policy_id);
 delete from luna_capture.receipts where policy_id=p_capture_policy_id;
 delete from luna_retention.purge_context where transaction_id=txid_current();
 return jsonb_build_object('status','purged','replay',false);
end $$;

alter table luna_retention.source_references enable row level security;
alter table luna_retention.plan enable row level security;
alter table luna_retention.retirement enable row level security;
alter table luna_retention.attempt_tombstones enable row level security;
alter table luna_retention.purge_context enable row level security;
revoke all on all tables in schema luna_retention from public,anon,authenticated,service_role;
revoke all on all functions in schema luna_retention from public,anon,authenticated,service_role;
grant usage on schema luna_retention to service_role;
grant execute on function luna_retention.purge_due(uuid) to service_role;
create function public.luna_retention_purge_rpc(p_capture_policy_id uuid) returns jsonb language sql security invoker
set search_path=pg_catalog as $$ select luna_retention.purge_due(p_capture_policy_id) $$;
revoke all on function public.luna_retention_purge_rpc(uuid) from public,anon,authenticated;
grant execute on function public.luna_retention_purge_rpc(uuid) to service_role;
commit;
