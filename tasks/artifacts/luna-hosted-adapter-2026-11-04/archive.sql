-- DISABLED LOCAL CANDIDATE. Apply only to a new disposable test cluster here.
-- Depends on the unchanged Luna worker schema.sql. No policy/approval/job is seeded.
begin;
create schema luna_capture;
revoke all on schema luna_capture from public, anon, authenticated, service_role;
create table luna_capture.policy (
  singleton boolean primary key default true check(singleton),
  id uuid not null unique, applet_id text not null check(length(applet_id) between 1 and 128),
  source_account text not null check(source_account ~ '^[A-Za-z0-9_]{1,15}$'),
  enabled boolean not null default false, stopped boolean not null default false,
  starts_at timestamptz not null, expires_at timestamptz not null,
  max_attempts integer not null check(max_attempts between 1 and 1000),
  max_receipts integer not null check(max_receipts between 1 and 100),
  max_bytes bigint not null check(max_bytes between 1 and 6553600),
  attempts integer not null default 0 check(attempts between 0 and max_attempts),
  receipts integer not null default 0 check(receipts between 0 and max_receipts),
  retained_bytes bigint not null default 0 check(retained_bytes between 0 and max_bytes),
  check(expires_at > starts_at and expires_at <= starts_at + interval '24 hours')
);
create table luna_capture.receipts (
  id uuid primary key default gen_random_uuid(), policy_id uuid not null references luna_capture.policy(id),
  applet_id text not null, delivery_key text not null check(delivery_key ~ '^[a-f0-9]{64}$'),
  payload_sha256 text not null check(payload_sha256 ~ '^[a-f0-9]{64}$'),
  byte_length integer not null check(byte_length between 1 and 65536),
  first_received_at timestamptz not null, retained_at timestamptz not null default clock_timestamp(),
  classification text not null check(classification in ('baseline','variant')),
  baseline_id uuid references luna_capture.receipts,
  envelope_json text not null check(octet_length(envelope_json) <= 270000),
  unique(policy_id,delivery_key,payload_sha256),
  check((classification = 'baseline') = (baseline_id is null))
);
create unique index luna_capture_one_baseline on luna_capture.receipts(policy_id,delivery_key) where classification='baseline';
create function luna_capture.immutable_row() returns trigger language plpgsql set search_path=pg_catalog as $$
begin raise exception 'immutable capture evidence' using errcode='42501'; end $$;
create trigger immutable_capture before update or delete on luna_capture.receipts for each row execute function luna_capture.immutable_row();
create function luna_capture.policy_guard() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if tg_op='DELETE' or (to_jsonb(new)-array['enabled','stopped','attempts','receipts','retained_bytes']) is distinct from
   (to_jsonb(old)-array['enabled','stopped','attempts','receipts','retained_bytes'])
   or (old.stopped and not new.stopped) or new.attempts < old.attempts or new.receipts < old.receipts
   or new.retained_bytes < old.retained_bytes then raise exception 'capture policy cannot reset' using errcode='42501'; end if;
 return new;
end $$;
create trigger guard_capture_policy before update or delete on luna_capture.policy for each row execute function luna_capture.policy_guard();

create function luna_capture.receipt_ack(r luna_capture.receipts) returns jsonb language sql immutable set search_path=pg_catalog as $$
 select jsonb_build_object('id',r.id,'kind','luna-isolated-archive-v1','policyId',r.policy_id,'appletId',r.applet_id,
 'deliveryKey',r.delivery_key,'payloadSha256',r.payload_sha256,'byteLength',r.byte_length,
 'firstReceivedAt',r.envelope_json::jsonb->>'receivedAt','classification',r.classification)
$$;

-- Match ECMAScript String.trim exactly, independent of database locale.
-- Preserve original submitted bytes; use this helper only for validation.
create function luna_capture.trim_wire(value text) returns text language sql immutable strict
set search_path=pg_catalog as $$
 select btrim(value, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
$$;

-- Private privileged implementation; only bounded retain/exact-ack lookup are
-- exposed to the backend. No raw-body loader or staging through service_role.
create function luna_capture.archive_rpc(p_action text,p_policy_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,luna_capture set lock_timeout='1s' as $$
declare p luna_capture.policy%rowtype; r luna_capture.receipts%rowtype; baseline uuid;
 e jsonb; raw json; raw_text text; fields jsonb; k text; v json; count_keys integer; distinct_keys integer;
 txt text; username text; link text; label text; embed text; account text; matched text[]; key_hash text; bytes integer;
 refusal jsonb := jsonb_build_object('status','refused');
begin
 if p_action='lookup' then
   if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'invalid lookup'; end if;
   select * into r from luna_capture.receipts where policy_id=p_policy_id and applet_id=p_payload->>'appletId'
    and delivery_key=p_payload->>'deliveryKey' and payload_sha256=p_payload->>'payloadSha256';
   if not found then return null; end if;
   return jsonb_build_object('status','duplicate','receipt',luna_capture.receipt_ack(r));
 end if;
 if p_action is distinct from 'retain' or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'invalid action'; end if;
 select * into p from luna_capture.policy where id=p_policy_id for update;
 if not found or not p.enabled or p.stopped then return refusal||jsonb_build_object('reason','stopped'); end if;
 if clock_timestamp()<p.starts_at or clock_timestamp()>=p.expires_at then return refusal||jsonb_build_object('reason','window_closed'); end if;
 if p.attempts>=p.max_attempts then return refusal||jsonb_build_object('reason','attempt_cap'); end if;
 -- Attempt admission is committed even for invalid envelopes/cap refusals. A
 -- database-level timeout/rollback cannot count as a committed attempt.
 update luna_capture.policy set attempts=attempts+1 where singleton;
 begin
   if octet_length(p_payload->>'envelopeJson')>270000 then raise exception 'oversized envelope'; end if;
   e := (p_payload->>'envelopeJson')::jsonb;
   if jsonb_typeof(e) is distinct from 'object' or e->>'version' is distinct from 'luna-isolated-capture-v1'
     or e->'sourceAuthenticated' is distinct from 'false'::jsonb
     or e->'scope' is distinct from jsonb_build_object('policyId',p.id::text,'appletId',p.applet_id,'sourceAccount',p.source_account)
     or jsonb_typeof(e->'rawBody') is distinct from 'string' then raise exception 'invalid envelope'; end if;
   raw_text := e->>'rawBody'; bytes:=octet_length(raw_text);
   if bytes<1 or bytes>65536 or e->'byteLength' is distinct from to_jsonb(bytes)
     or e->>'payloadSha256' is distinct from encode(sha256(convert_to(raw_text,'UTF8')),'hex') then raise exception 'invalid exact payload'; end if;
   raw:=raw_text::json;
   if json_typeof(raw) is distinct from 'object' then raise exception 'invalid body'; end if;
   select count(*),count(distinct key) into count_keys,distinct_keys from json_each(raw);
   if count_keys<>distinct_keys then raise exception 'repeated decoded keys'; end if;
   for k,v in select * from json_each(raw) loop
     if json_typeof(v) is distinct from 'string' or k not in ('text','Text','username','UserName','link_to_tweet','linkToTweet','LinkToTweet',
       'created_at','createdAt','CreatedAt','tweet_embed_code','tweetEmbedCode','TweetEmbedCode','source_account','sourceAccount') then raise exception 'invalid fields'; end if;
   end loop;
   fields:=raw::jsonb;
   if (select count(*) from jsonb_object_keys(fields) x where x in ('text','Text'))<>1
     or (select count(*) from jsonb_object_keys(fields) x where x in ('username','UserName'))<>1
     or (select count(*) from jsonb_object_keys(fields) x where x in ('link_to_tweet','linkToTweet','LinkToTweet'))<>1
     or (select count(*) from jsonb_object_keys(fields) x where x in ('created_at','createdAt','CreatedAt'))<>1
     or (select count(*) from jsonb_object_keys(fields) x where x in ('tweet_embed_code','tweetEmbedCode','TweetEmbedCode'))>1
     or (select count(*) from jsonb_object_keys(fields) x where x in ('source_account','sourceAccount'))>1 then raise exception 'ambiguous aliases'; end if;
   txt:=coalesce(fields->>'text',fields->>'Text'); username:=coalesce(fields->>'username',fields->>'UserName');
   link:=coalesce(fields->>'link_to_tweet',fields->>'linkToTweet',fields->>'LinkToTweet');
   label:=coalesce(fields->>'created_at',fields->>'createdAt',fields->>'CreatedAt');
   embed:=coalesce(fields->>'tweet_embed_code',fields->>'tweetEmbedCode',fields->>'TweetEmbedCode');
   account:=coalesce(fields->>'source_account',fields->>'sourceAccount');
   matched:=regexp_match(luna_capture.trim_wire(link),'^https://(www\.)?(x\.com|twitter\.com)(:443)?/([A-Za-z0-9_]{1,15})/status/([0-9]{1,30})(\?[^#]*)?$','i');
   if length(luna_capture.trim_wire(txt))=0 or length(luna_capture.trim_wire(label))=0 or lower(luna_capture.trim_wire(username))<>lower(p.source_account)
     or (account is not null and lower(luna_capture.trim_wire(account))<>lower(p.source_account))
     or matched is null or lower(matched[4])<>lower(p.source_account)
     or luna_capture.trim_wire(link) !~ '^[^:]+://[^/]+/[A-Za-z0-9_]{1,15}/status/[0-9]{1,30}(\?[^#]*)?$' then raise exception 'scope mismatch'; end if;
   key_hash:=encode(sha256(convert_to('['||to_json(p.id::text)::text||','||to_json(p.applet_id)::text||','||
     to_json(lower(p.source_account))::text||','||to_json(matched[5])::text||']','UTF8')),'hex');
   if e->>'deliveryKey' is distinct from key_hash or e->'submitted' is distinct from jsonb_build_object('text',txt,'username',username,
     'link',link,'postId',matched[5],'createdAtLabel',label,'embed',embed)
     or jsonb_typeof(e->'receivedAt') is distinct from 'string'
     or not coalesce(e->>'receivedAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9](\.[0-9]+)?)?Z$',false)
     or (e->>'receivedAt')::timestamptz is null or not isfinite((e->>'receivedAt')::timestamptz) then raise exception 'projection mismatch'; end if;
 exception when others then
   return jsonb_build_object('status','invalid');
 end;
 select * into r from luna_capture.receipts where policy_id=p.id and delivery_key=key_hash and payload_sha256=e->>'payloadSha256';
 if found then return jsonb_build_object('status','duplicate','receipt',luna_capture.receipt_ack(r)); end if;
 if p.receipts>=p.max_receipts then return refusal||jsonb_build_object('reason','receipt_cap'); end if;
 if p.retained_bytes+bytes>p.max_bytes then return refusal||jsonb_build_object('reason','byte_cap'); end if;
 select id into baseline from luna_capture.receipts where policy_id=p.id and delivery_key=key_hash and classification='baseline';
 insert into luna_capture.receipts(policy_id,applet_id,delivery_key,payload_sha256,byte_length,first_received_at,classification,baseline_id,envelope_json)
 values(p.id,p.applet_id,key_hash,e->>'payloadSha256',bytes,(e->>'receivedAt')::timestamptz,
  case when baseline is null then 'baseline' else 'variant' end,baseline,p_payload->>'envelopeJson') returning * into r;
 update luna_capture.policy set receipts=receipts+1,retained_bytes=retained_bytes+bytes where singleton;
 return jsonb_build_object('status',case when baseline is null then 'retained' else 'variant' end,'receipt',luna_capture.receipt_ack(r));
end $$;

-- Owner reviews the exact complete draft and provenance before inserting an
-- approval. Backend cannot read or write this table, call loader, or stage jobs.
create table luna_capture.approvals (
 id uuid primary key, receipt_id uuid not null references luna_capture.receipts,
 job_id uuid not null unique, worker_approval_id text not null,
 input_json text not null check(octet_length(input_json)<=512000), input_hash text not null,
 receipt_json text not null check(octet_length(receipt_json)<=512000), receipt_hash text not null,
 reference_hash text not null, provenance_ref text not null check(length(provenance_ref) between 1 and 500),
 approved_at timestamptz not null default clock_timestamp(),
 check(input_hash=encode(sha256(convert_to(input_json,'UTF8')),'hex')),
 check(receipt_hash=encode(sha256(convert_to(receipt_json,'UTF8')),'hex')),
 check(reference_hash ~ '^[a-f0-9]{64}$')
);
create trigger immutable_approval before update or delete on luna_capture.approvals for each row execute function luna_capture.immutable_row();
create function luna_capture.load_for_owner(p_receipt_id uuid) returns jsonb language sql security invoker set search_path=pg_catalog as $$
 select jsonb_build_object('receipt',luna_capture.receipt_ack(r),'envelope',r.envelope_json::jsonb)
 from luna_capture.receipts r where r.id=p_receipt_id
$$;
-- Receipt UUID is the immutable revision (each changed payload has its own UUID).
-- A semantic enrollment cannot be rewritten/deleted to regain pilot capacity.
create table luna_capture.enrollments (
 worker_approval_id text not null, receipt_id uuid not null references luna_capture.receipts,
 reference_hash text not null, approval_id uuid not null references luna_capture.approvals,
 job_id uuid not null unique references luna_hosted.jobs,
 primary key(worker_approval_id,receipt_id,reference_hash)
);
create trigger immutable_enrollment before update or delete on luna_capture.enrollments for each row execute function luna_capture.immutable_row();
create function luna_capture.stage_for_owner(p_approval_id uuid) returns uuid language plpgsql security invoker
set search_path=pg_catalog,luna_capture set lock_timeout='1s' as $$
declare a luna_capture.approvals%rowtype; r luna_capture.receipts%rowtype; p luna_hosted.policy%rowtype; snapshot jsonb; input jsonb; existing luna_hosted.jobs%rowtype;
 enrolled luna_capture.enrollments%rowtype; original luna_capture.approvals%rowtype; source luna_hosted.sources%rowtype;
begin
 select * into a from luna_capture.approvals where id=p_approval_id;
 if not found then raise exception 'approval missing'; end if;
 select * into p from luna_hosted.policy where singleton for update;
 if not found or p.approval_id is distinct from a.worker_approval_id then raise exception 'worker approval mismatch'; end if;
 select * into r from luna_capture.receipts where id=a.receipt_id;
 snapshot:=a.receipt_json::jsonb; input:=a.input_json::jsonb;
 if r.classification is distinct from 'baseline' or snapshot->>'kind' is distinct from 'luna-isolated-review-receipt-v1'
   or snapshot->>'eventTable' is distinct from 'luna_capture.receipts' or snapshot->>'id' is distinct from r.id::text
   or snapshot->>'eventId' is distinct from r.id::text
   or snapshot->'archive' is distinct from luna_capture.load_for_owner(r.id)
   or snapshot->'sourceReview' is null or jsonb_typeof(snapshot->'sourceReview') is distinct from 'object'
   or snapshot#>>'{sourceReview,receiptId}' is distinct from r.id::text
   or snapshot#>>'{sourceReview,payloadSha256}' is distinct from r.payload_sha256
   or length(coalesce(snapshot#>>'{sourceReview,evidenceRef}',''))=0 or length(coalesce(snapshot#>>'{sourceReview,permissionRef}',''))=0
   or a.approved_at < r.retained_at
   or input#>'{packet,receiptSnapshot}' is distinct from snapshot
   or input->'decisions' is distinct from 'false'::jsonb or input->>'referenceMode' is distinct from 'rules-and-synthetic-only'
   or input#>>'{identity,evaluation,mode}' is distinct from 'causal_as_of'
   or input#>>'{packet,source,retainedSourceId}' is distinct from 'luna_capture.receipts:'||r.id::text
   or input#>'{packet,canPublish}' is distinct from 'false'::jsonb
   or input#>'{packet,canChangeStatus}' is distinct from 'false'::jsonb
   or input#>'{packet,providerDispatchEnabled}' is distinct from 'false'::jsonb then raise exception 'unbound archive approval'; end if;
 -- Full source/identity/mention validation remains in the worker before provider
 -- admission. Owner approval is not permission to skip any deterministic holds.
 select * into enrolled from luna_capture.enrollments where worker_approval_id=a.worker_approval_id
   and receipt_id=a.receipt_id and reference_hash=a.reference_hash;
 if found then
   select * into original from luna_capture.approvals where id=enrolled.approval_id;
   if row(original.worker_approval_id,original.receipt_id,original.input_json,original.input_hash,
       original.reference_hash,original.receipt_json,original.receipt_hash,original.provenance_ref)
     is distinct from row(a.worker_approval_id,a.receipt_id,a.input_json,a.input_hash,
       a.reference_hash,a.receipt_json,a.receipt_hash,a.provenance_ref) then raise exception 'semantic enrollment conflict'; end if;
   select * into existing from luna_hosted.jobs where id=enrolled.job_id for update;
   if not found or row(existing.id,existing.approval_id,existing.receipt_id,existing.input_json,existing.input_hash,existing.reference_hash)
     is distinct from row(enrolled.job_id,a.worker_approval_id,r.id::text,a.input_json,a.input_hash,a.reference_hash)
     then raise exception 'job reconciliation conflict'; end if;
   select * into source from luna_hosted.sources where receipt_id=existing.receipt_id for share;
   if not found or row(source.receipt_id,source.receipt_json,source.receipt_hash,source.provenance_ref)
     is distinct from row(r.id::text,a.receipt_json,a.receipt_hash,a.provenance_ref)
     then raise exception 'source reconciliation conflict'; end if;
   return existing.id;
 end if;
 -- Never adopt an unrelated/un-enrolled job solely because an ID happens to match.
 if exists(select 1 from luna_hosted.jobs where id=a.job_id) then raise exception 'job conflict'; end if;
 -- Worker policy's row lock serializes enrollment with admission/stop. Exact
 -- already-enrolled retries above remain readable after window/cap/stop closure.
 if p.stopped or clock_timestamp()<p.starts_at or clock_timestamp()>=p.expires_at then raise exception 'staging enrollment closed'; end if;
 if (select count(*) from luna_capture.enrollments where worker_approval_id=a.worker_approval_id)>=p.max_calls
   or (select count(*) from luna_hosted.jobs where approval_id=a.worker_approval_id)>=p.max_calls
   then raise exception 'staging enrollment cap'; end if;
 insert into luna_hosted.sources values(r.id::text,a.receipt_json,a.receipt_hash,a.provenance_ref)
 on conflict(receipt_id) do nothing;
 if not exists(select 1 from luna_hosted.sources where receipt_id=r.id::text and receipt_json=a.receipt_json
   and receipt_hash=a.receipt_hash and provenance_ref=a.provenance_ref) then raise exception 'source conflict'; end if;
 insert into luna_hosted.jobs(id,approval_id,receipt_id,input_json,input_hash,reference_hash)
 values(a.job_id,a.worker_approval_id,r.id::text,a.input_json,a.input_hash,a.reference_hash);
 insert into luna_capture.enrollments values(a.worker_approval_id,a.receipt_id,a.reference_hash,a.id,a.job_id);
 return a.job_id;
end $$;

alter table luna_capture.policy enable row level security;
alter table luna_capture.receipts enable row level security;
alter table luna_capture.approvals enable row level security;
alter table luna_capture.enrollments enable row level security;
revoke all on all tables in schema luna_capture from public,anon,authenticated,service_role;
revoke all on all functions in schema luna_capture from public,anon,authenticated,service_role;
grant usage on schema luna_capture to service_role;
grant execute on function luna_capture.archive_rpc(text,uuid,jsonb) to service_role;
create function public.luna_capture_archive_rpc(p_action text,p_policy_id uuid,p_payload jsonb)
returns jsonb language sql security invoker set search_path=pg_catalog as $$ select luna_capture.archive_rpc(p_action,p_policy_id,p_payload) $$;
revoke all on function public.luna_capture_archive_rpc(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.luna_capture_archive_rpc(text,uuid,jsonb) to service_role;
commit;
