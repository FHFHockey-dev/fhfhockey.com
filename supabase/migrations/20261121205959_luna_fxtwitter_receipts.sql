-- Installs a private, unconfigured one-call pilot. No policy, schedule or job is created.
begin;
set local lock_timeout = '2s';
create schema luna_fxtwitter;
revoke all on schema luna_fxtwitter from public, anon, authenticated, service_role;

create table luna_fxtwitter.policy (
 id uuid primary key, singleton boolean not null unique default true check (singleton),
 worker_approval_id text not null unique check (length(worker_approval_id) between 1 and 200),
 -- Exact source_key -> tracked handle pairs approved by the owner.
 accounts jsonb not null check (jsonb_typeof(accounts)='object' and accounts<>'{}'::jsonb),
 starts_at timestamptz not null check (isfinite(starts_at)),
 expires_at timestamptz not null check (expires_at>starts_at and expires_at<=starts_at+interval '1 hour'),
 purge_after timestamptz not null check (purge_after>=expires_at and purge_after<=starts_at+interval '168 hours'),
 max_receipts integer not null check (max_receipts between 1 and 10),
 cap_nano_usd bigint not null check (cap_nano_usd between 234000000 and 1000000000),
 enabled boolean not null default false, stopped boolean not null default false
);
create table luna_fxtwitter.receipts (
 id uuid primary key default gen_random_uuid(), policy_id uuid not null references luna_fxtwitter.policy,
 source_key text not null, source_account text not null, shadow_id uuid not null,
 post_id text not null check(post_id ~ '^[0-9]{1,30}$'), first_seen_at timestamptz not null,
 published_at timestamptz not null, expires_at timestamptz not null,
 response_sha256 text not null check(response_sha256 ~ '^[a-f0-9]{64}$'),
 payload_json text not null check(octet_length(payload_json) between 2 and 65536),
 payload_sha256 text not null check(payload_sha256=encode(sha256(convert_to(payload_json,'UTF8')),'hex')),
 via text not null check(via in ('public','mirror')), classification text not null check(classification in ('baseline','variant')),
 unique(policy_id, source_key, post_id, payload_sha256)
);
create unique index luna_fx_first on luna_fxtwitter.receipts(policy_id,source_key,post_id) where classification='baseline';
-- At most one content-free correction marker per baseline, even when the body
-- cap has filled. Only the first conflicting observation is recorded.
create table luna_fxtwitter.conflicts (
 receipt_id uuid primary key references luna_fxtwitter.receipts, policy_id uuid not null references luna_fxtwitter.policy,
 observed_at timestamptz not null, semantic_sha256 text not null check(semantic_sha256 ~ '^[a-f0-9]{64}$')
);
-- The owner approves bytes and the reference package by digest. Each pilot has at most one job.
create table luna_fxtwitter.approvals (
 id uuid primary key, policy_id uuid not null unique references luna_fxtwitter.policy,
 receipt_id uuid not null references luna_fxtwitter.receipts, job_id uuid not null unique,
 input_json text not null check(octet_length(input_json)<=512000),
 input_hash text not null check(input_hash=encode(sha256(convert_to(input_json,'UTF8')),'hex')),
 receipt_json text not null check(octet_length(receipt_json)<=512000),
 receipt_hash text not null check(receipt_hash=encode(sha256(convert_to(receipt_json,'UTF8')),'hex')),
 reference_hash text not null check(reference_hash ~ '^[a-f0-9]{64}$'),
 provenance_ref text not null check(length(btrim(provenance_ref)) between 1 and 500),
 approved_at timestamptz not null default clock_timestamp()
);
create table luna_fxtwitter.enrollments (
 policy_id uuid primary key references luna_fxtwitter.policy, approval_id uuid not null unique references luna_fxtwitter.approvals,
 job_id uuid not null unique, receipt_id uuid not null unique
);
create table luna_fxtwitter.source_references (
 receipt_id uuid primary key, policy_id uuid not null references luna_fxtwitter.policy,
 source_key text not null, source_account text not null, shadow_id uuid not null, post_id text not null,
 author text not null, canonical_url text not null, first_seen_at timestamptz not null,
 response_sha256 text not null, payload_sha256 text not null, classification text not null, conflict_at timestamptz, conflict_sha256 text
);
create table luna_fxtwitter.retirements (
 policy_id uuid primary key references luna_fxtwitter.policy, purged_at timestamptz not null,
 receipt_count integer not null, job_id uuid, request_key text, state text,
 reserved_nano_usd bigint not null, charge_nano_usd bigint, request_id text,
 prior_exposure_nano_usd bigint, total_exposure_nano_usd bigint
);
create table luna_fxtwitter.operation (
 transaction_id bigint primary key, policy_id uuid not null references luna_fxtwitter.policy,
 action text not null check(action in ('prepare_worker','purge'))
);

create function luna_fxtwitter.guard_policy() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if tg_op='INSERT' then
  if (select count(*) from jsonb_each(new.accounts))>7 or exists(select 1 from jsonb_each(new.accounts) a
    where a.key !~ '^[a-z0-9_]{1,40}$' or jsonb_typeof(a.value)<>'string' or a.value#>>'{}' !~ '^[a-zA-Z0-9_]{1,15}$')
   or exists(select 1 from luna_retention.plan where worker_approval_id=new.worker_approval_id)
   or exists(select 1 from luna_hosted.policy where approval_id=new.worker_approval_id)
  then raise exception 'invalid FX scope'; end if;
 elsif tg_op='DELETE' or (to_jsonb(new)-array['enabled','stopped']) is distinct from (to_jsonb(old)-array['enabled','stopped'])
  or (old.stopped and (not new.stopped or new.enabled)) or (new.enabled and new.stopped) then
  raise exception 'immutable FX policy';
 end if;
 return new;
end $$;
create trigger guard_policy before insert or update or delete on luna_fxtwitter.policy for each row execute function luna_fxtwitter.guard_policy();

create function luna_fxtwitter.immutable_content() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if tg_op='DELETE' and exists(select 1 from luna_fxtwitter.operation where transaction_id=txid_current() and policy_id=old.policy_id and action='purge') then return old; end if;
 raise exception 'immutable FX content' using errcode='42501';
end $$;
create trigger immutable before update or delete on luna_fxtwitter.receipts for each row execute function luna_fxtwitter.immutable_content();
create trigger immutable before update or delete on luna_fxtwitter.conflicts for each row execute function luna_fxtwitter.immutable_content();
create trigger immutable before update or delete on luna_fxtwitter.approvals for each row execute function luna_fxtwitter.immutable_content();
create trigger immutable before update or delete on luna_fxtwitter.enrollments for each row execute function luna_fxtwitter.immutable_content();
create trigger immutable before update or delete on luna_fxtwitter.retirements for each row execute function luna_retention.no_change();
create trigger immutable before update or delete on luna_fxtwitter.source_references for each row execute function luna_retention.no_change();

create function luna_fxtwitter.utc(v timestamptz) returns text language sql immutable strict set search_path=pg_catalog as $$
 select to_char(v at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
$$;
create function luna_fxtwitter.posted(status jsonb) returns timestamptz language plpgsql stable set search_path=pg_catalog set timezone='UTC' as $$
begin
 if jsonb_typeof(status->'created_timestamp')='number' then return to_timestamp((status->>'created_timestamp')::double precision); end if;
 if jsonb_typeof(status->'created_at')='string' then return (status->>'created_at')::timestamptz; end if;
 return null;
exception when data_exception then return null;
end $$;
create function luna_fxtwitter.valid_status(status jsonb, post_id text, account text) returns boolean language sql immutable set search_path=pg_catalog as $$
 select coalesce(jsonb_typeof(status->'id')='string' and status->>'id'=post_id and post_id ~ '^[0-9]{1,30}$'
  and status#>>'{author,screen_name}' ~ '^[A-Za-z0-9_]{1,15}$'
  and lower(status->>'url') ~ ('^https://(www\.)?(x\.com|twitter\.com)/'||lower(status#>>'{author,screen_name}')||'/status/'||post_id||'/?$')
  and (lower(status#>>'{author,screen_name}')=lower(account) or lower(status#>>'{reposted_by,screen_name}')=lower(account)),false)
$$;
-- Fx embeds metrics and display metadata alongside the source. Compare reviewed
-- text, byline, clocks and supporting context independently of those counters.
create function luna_fxtwitter.semantic_status(s jsonb) returns jsonb language sql stable set search_path=pg_catalog as $$
 select jsonb_build_array(s->>'id',lower(s#>>'{author,screen_name}'),lower(s->>'url'),coalesce(s#>>'{raw_text,text}',s->>'text'),
  s->'created_timestamp',s->'created_at',lower(s#>>'{reposted_by,screen_name}'),s->'reposted_timestamp',
  s->'replying_to_status',s->'replying_to_status_id',s->'replying_to',s->'replying_to_id',
  s->'edit_history_tweet_ids',s->'edit_control',s->'edited',s->'deleted',s->'unavailable',s->'withheld',
  s->'note_tweet',s->'article',s->'community_note',s->'possibly_sensitive',
  (select jsonb_agg(jsonb_build_array(m->'type',m->'url',m->'thumbnail_url',m->'altText',m->'alt_text',m->'caption') order by ord)
   from jsonb_array_elements(case when jsonb_typeof(s#>'{media,all}')='array' then s#>'{media,all}' else '[]'::jsonb end) with ordinality a(m,ord)))
$$;
create function luna_fxtwitter.semantic_digest(s jsonb) returns text language sql stable set search_path=pg_catalog as $$
 select encode(sha256(convert_to(jsonb_build_array(luna_fxtwitter.semantic_status(s),luna_fxtwitter.semantic_status(s->'quote'))::text,'UTF8')),'hex')
$$;
create function luna_fxtwitter.store_rows(p_rows jsonb,p_evidence jsonb) returns table(tweet_id text)
language plpgsql security definer set search_path=pg_catalog as $$
declare p luna_fxtwitter.policy; item jsonb; candidate public.x_timeline_shadow_posts; stored public.x_timeline_shadow_posts;
 ev jsonb; status jsonb; comparable jsonb; fresh boolean; now_at timestamptz; semantic text; baseline luna_fxtwitter.receipts;
begin
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_typeof(p_evidence) is distinct from 'array' then raise exception 'invalid FX batch'; end if;
 select * into p from luna_fxtwitter.policy where enabled and not stopped and starts_at<=clock_timestamp() and clock_timestamp()<expires_at for update;
 for item in select value from jsonb_array_elements(p_rows) loop
  now_at:=clock_timestamp();
  candidate:=jsonb_populate_record(null::public.x_timeline_shadow_posts,item);
  -- Never accept caller-assigned row IDs or first-sighting clocks.
  candidate.id:=gen_random_uuid(); candidate.first_seen_at:=now_at;
  insert into public.x_timeline_shadow_posts select (candidate).* on conflict do nothing returning * into stored;
  fresh:=found;
  if fresh then tweet_id:=stored.tweet_id; return next; end if;
  if p.id is null or now_at>=p.expires_at or lower(p.accounts->>candidate.source_key) is distinct from lower(candidate.source_account)
   or not exists(select 1 from public.tweet_intake_providers v where v.source_key=candidate.source_key and v.provider='fxtwitter'
    and v.switched_at<=now_at for share) then continue; end if;
  select * into baseline from luna_fxtwitter.receipts r where r.policy_id=p.id and r.source_key=candidate.source_key
   and r.post_id=candidate.tweet_id and classification='baseline';
  if not fresh then
   -- A row inserted by another writer, missing evidence, or pre-policy history can never acquire a retrospective baseline.
   if baseline.id is null then continue; end if;
   select * into stored from public.x_timeline_shadow_posts s where s.id=baseline.shadow_id and s.source_key=candidate.source_key and s.tweet_id=candidate.tweet_id;
   if not found then continue; end if;
  elsif baseline.id is not null then continue;
  end if;
  if baseline.id is not null and candidate.raw_payload->>'id'=baseline.post_id then
   semantic:=luna_fxtwitter.semantic_digest(candidate.raw_payload);
   if semantic<>luna_fxtwitter.semantic_digest(baseline.payload_json::jsonb) then
    insert into luna_fxtwitter.conflicts values(baseline.id,p.id,now_at,semantic) on conflict do nothing;
   end if;
  end if;
  if (select count(*) from luna_fxtwitter.receipts where policy_id=p.id)>=p.max_receipts then continue; end if;
  select case when count(*)=1 then (jsonb_agg(value)->0) end into ev from jsonb_array_elements(p_evidence) where value->>'tweetId'=candidate.tweet_id;
  if ev is null or jsonb_typeof(ev->'payloadJson') is distinct from 'string' or octet_length(ev->>'payloadJson') not between 2 and 65536
   or not coalesce(ev->>'responseSha256' ~ '^[a-f0-9]{64}$',false) or not coalesce(ev->>'via' in ('public','mirror'),false)
   or ev->>'payloadSha256' is distinct from encode(sha256(convert_to(ev->>'payloadJson','UTF8')),'hex') then continue; end if;
  begin status:=(ev->>'payloadJson')::jsonb; exception when data_exception then continue; end;
  comparable:=candidate.raw_payload;
  if status is distinct from comparable and candidate.post_kind='repost' and not status ? 'repost_wrapper_id'
   and comparable->>'repost_wrapper_id' ~ '^[0-9]{1,30}$' and comparable->>'repost_wrapper_id'<>candidate.tweet_id
   and lower(status#>>'{reposted_by,screen_name}')=lower(candidate.source_account)
   and lower(status#>>'{author,screen_name}')<>lower(candidate.source_account)
   and lower(status#>>'{author,screen_name}')=lower(candidate.original_author_handle) then comparable:=comparable-'repost_wrapper_id'; end if;
  if status is distinct from comparable or not luna_fxtwitter.valid_status(status,candidate.tweet_id,candidate.source_account)
   or candidate.tweet_created_at is null or not isfinite(candidate.tweet_created_at) or candidate.tweet_created_at>now_at
   or candidate.tweet_created_at is distinct from luna_fxtwitter.posted(status) then continue; end if;
  insert into luna_fxtwitter.receipts(policy_id,source_key,source_account,shadow_id,post_id,first_seen_at,published_at,expires_at,
   response_sha256,payload_json,payload_sha256,via,classification)
   values(p.id,candidate.source_key,candidate.source_account,stored.id,candidate.tweet_id,now_at,candidate.tweet_created_at,p.purge_after,
    ev->>'responseSha256',ev->>'payloadJson',ev->>'payloadSha256',ev->>'via',case when fresh then 'baseline' else 'variant' end)
   on conflict do nothing;
 end loop;
end $$;
create function public.luna_store_fxtwitter_rows_v1(p_rows jsonb,p_evidence jsonb) returns table(tweet_id text)
language sql security invoker set search_path=pg_catalog as $$ select * from luna_fxtwitter.store_rows(p_rows,p_evidence) $$;
create function luna_fxtwitter.load_for_owner(p_receipt_id uuid) returns jsonb language sql stable security invoker set search_path=pg_catalog as $$
 select jsonb_build_object('id',r.id,'policyId',r.policy_id,'sourceKey',r.source_key,'sourceAccount',r.source_account,'shadowId',r.shadow_id,
 'postId',r.post_id,'firstSeenAt',luna_fxtwitter.utc(r.first_seen_at),'publishedAt',luna_fxtwitter.utc(r.published_at),'expiresAt',luna_fxtwitter.utc(r.expires_at),
 'responseSha256',r.response_sha256,'payloadJson',r.payload_json,'payloadSha256',r.payload_sha256,'via',r.via,'classification',r.classification)
 from luna_fxtwitter.receipts r where r.id=p_receipt_id and clock_timestamp()<r.expires_at
$$;

-- Every enrolled archive (including the separately observed quoted original)
-- must still belong to the same live provider interval.
create function luna_fxtwitter.current_source(p_receipt_id uuid) returns boolean language sql volatile set search_path=pg_catalog as $$
 select exists(select 1 from luna_fxtwitter.receipts r join public.tweet_intake_providers v on v.source_key=r.source_key
  where r.id=p_receipt_id and v.provider='fxtwitter' and v.switched_at<=r.first_seen_at for share of v)
$$;

-- The existing worker is a singleton. Preserve its legacy guard for every non-FX
-- update and every delete, including legacy reschedule and retirement.
create function luna_fxtwitter.worker_update(old_policy luna_hosted.policy,new_policy luna_hosted.policy)
returns boolean language plpgsql set search_path=pg_catalog as $$
declare p luna_fxtwitter.policy; action_name text;
begin
 select * into p from luna_fxtwitter.policy where worker_approval_id=new_policy.approval_id;
 if not found then return false; end if;
 select action into action_name from luna_fxtwitter.operation where transaction_id=txid_current() and policy_id=p.id;
 if old_policy.approval_id<>new_policy.approval_id then
  if action_name is distinct from 'prepare_worker' or new_policy.enabled or new_policy.stopped
   or new_policy.starts_at<>p.starts_at or new_policy.expires_at<>p.expires_at or new_policy.max_calls<>1
   or new_policy.cap_nano_usd<>p.cap_nano_usd or new_policy.prior_exposure_nano_usd<>old_policy.prior_exposure_nano_usd
   or old_policy.enabled or not old_policy.stopped or not exists(select 1 from luna_retention.retirement
    where worker_approval_id=old_policy.approval_id and total_exposure_nano_usd=old_policy.prior_exposure_nano_usd and unresolved_count=0)
  then raise exception 'FX rollover requires reconciled retired worker'; end if;
 elsif (to_jsonb(new_policy)-array['enabled','stopped','prior_exposure_nano_usd']) is distinct from
       (to_jsonb(old_policy)-array['enabled','stopped','prior_exposure_nano_usd'])
  or (old_policy.stopped and not new_policy.stopped)
  or (new_policy.enabled and not old_policy.enabled and (new_policy.stopped or not p.enabled or p.stopped or clock_timestamp()>=p.expires_at))
  or (new_policy.prior_exposure_nano_usd<>old_policy.prior_exposure_nano_usd and
   (action_name is distinct from 'purge' or new_policy.enabled or not new_policy.stopped or new_policy.prior_exposure_nano_usd<old_policy.prior_exposure_nano_usd))
 then raise exception 'FX worker policy reset denied'; end if;
 return true;
end $$;
drop trigger retention_policy_guard on luna_hosted.policy;
create trigger retention_policy_guard before update on luna_hosted.policy for each row
 when (not luna_fxtwitter.worker_update(old,new)) execute function luna_retention.worker_policy_guard();
create trigger retention_policy_delete_guard before delete on luna_hosted.policy for each row execute function luna_retention.worker_policy_guard();

create function luna_fxtwitter.prepare_worker_for_owner(p_policy_id uuid) returns void language plpgsql security invoker set search_path=pg_catalog as $$
declare w luna_hosted.policy; p luna_fxtwitter.policy;
begin
 -- Same order as worker admission, staging and cleanup.
 lock table luna_hosted.policy in share row exclusive mode;
 select * into w from luna_hosted.policy where singleton for update;
 select * into strict p from luna_fxtwitter.policy where id=p_policy_id for update;
 if p.stopped or clock_timestamp()>=p.expires_at or exists(select 1 from luna_fxtwitter.retirements where policy_id=p.id) then raise exception 'FX pilot closed'; end if;
 if w.approval_id=p.worker_approval_id then return; end if;
 if exists(select 1 from luna_hosted.jobs) or exists(select 1 from luna_hosted.sources) or exists(select 1 from luna_hosted.attempts)
  or exists(select 1 from luna_retention.plan l where not exists(select 1 from luna_retention.retirement r
    where r.capture_policy_id=l.capture_policy_id and r.worker_approval_id=l.worker_approval_id and r.unresolved_count=0))
  or coalesce(w.prior_exposure_nano_usd,0)+234000000>p.cap_nano_usd then raise exception 'prior pilot reconciliation required'; end if;
 if w.singleton is null then
  if exists(select 1 from luna_retention.retirement) or exists(select 1 from luna_capture.policy) then raise exception 'legacy worker missing'; end if;
  insert into luna_hosted.policy(approval_id,starts_at,expires_at,max_calls,cap_nano_usd,prior_exposure_nano_usd)
   values(p.worker_approval_id,p.starts_at,p.expires_at,1,p.cap_nano_usd,0);
 else
  insert into luna_fxtwitter.operation values(txid_current(),p.id,'prepare_worker');
  update luna_hosted.policy set approval_id=p.worker_approval_id,enabled=false,stopped=false,starts_at=p.starts_at,expires_at=p.expires_at,
   max_calls=1,cap_nano_usd=p.cap_nano_usd,schedule_revision=0 where singleton;
  delete from luna_fxtwitter.operation where transaction_id=txid_current();
 end if;
end $$;

-- Preauthorize only the exact owner-approved row. All unrelated writes continue
-- through the original retention guard, including all writes on luna_capture.
create function luna_fxtwitter.hosted_write(table_name text, candidate jsonb) returns boolean language plpgsql set search_path=pg_catalog as $$
declare p luna_fxtwitter.policy; a luna_fxtwitter.approvals; e luna_fxtwitter.enrollments;
begin
 select f.* into p from luna_fxtwitter.policy f join luna_hosted.policy w on w.approval_id=f.worker_approval_id for share of f;
 if not found then return false; end if;
 select * into e from luna_fxtwitter.enrollments where policy_id=p.id;
 select * into a from luna_fxtwitter.approvals where id=e.approval_id;
 if a.id is null or clock_timestamp()>=p.purge_after or exists(select 1 from luna_fxtwitter.retirements where policy_id=p.id) then raise exception 'FX content closed'; end if;
 if (table_name='jobs' and candidate->>'state' in ('running','completed') or table_name='attempts' and candidate->>'state'='reserved') then
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'FX admission requires READ COMMITTED'; end if;
  if not p.enabled or p.stopped or (clock_timestamp()>=p.expires_at and (table_name='attempts' or candidate->>'state'='running'))
   or not luna_fxtwitter.current_source(a.receipt_id)
   or not luna_fxtwitter.current_source(coalesce((a.receipt_json::jsonb#>>'{originalArchive,id}')::uuid,a.receipt_id))
   or exists(select 1 from luna_fxtwitter.conflicts c where c.receipt_id in (a.receipt_id,(a.receipt_json::jsonb#>>'{originalArchive,id}')::uuid))
   then raise exception 'FX worker admission closed'; end if;
 end if;
 if table_name='sources' and row(candidate->>'receipt_id',candidate->>'receipt_json',candidate->>'receipt_hash',candidate->>'provenance_ref')
   is not distinct from row(e.receipt_id::text,a.receipt_json,a.receipt_hash,a.provenance_ref) then return true;
 elsif table_name='jobs' and row(candidate->>'id',candidate->>'approval_id',candidate->>'receipt_id',candidate->>'input_json',candidate->>'input_hash',candidate->>'reference_hash')
   is not distinct from row(e.job_id::text,p.worker_approval_id,e.receipt_id::text,a.input_json,a.input_hash,a.reference_hash) then return true;
 elsif table_name='attempts' and candidate->>'job_id'=e.job_id::text then return true;
 end if;
 raise exception 'FX hosted write outside enrolled job';
end $$;
drop trigger retention_write_guard on luna_hosted.sources;
create trigger retention_write_guard before insert or update on luna_hosted.sources for each row
 when (not luna_fxtwitter.hosted_write('sources',to_jsonb(new))) execute function luna_retention.content_write_guard();
drop trigger retention_write_guard on luna_hosted.jobs;
create trigger retention_write_guard before insert or update on luna_hosted.jobs for each row
 when (not luna_fxtwitter.hosted_write('jobs',to_jsonb(new))) execute function luna_retention.content_write_guard();
drop trigger retention_write_guard on luna_hosted.attempts;
create trigger retention_write_guard before insert or update on luna_hosted.attempts for each row
 when (not luna_fxtwitter.hosted_write('attempts',to_jsonb(new))) execute function luna_retention.content_write_guard();

-- Claim/replay paths in the original RPC may return without a write. Apply the
-- FX custody gate there as well as in the insert/update guards. Only this entry
-- point remains callable by the backend. All other job behavior stays in the
-- deployed worker, including its reservation amount and settlement checks.
alter function luna_hosted.review_rpc(text,uuid,jsonb) rename to review_enrolled_job;
revoke all on function luna_hosted.review_enrolled_job(text,uuid,jsonb) from public,anon,authenticated,service_role;
create function luna_hosted.review_rpc(p_action text,p_job_id uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog set lock_timeout='2s' as $$
declare p luna_fxtwitter.policy; a luna_fxtwitter.approvals;
begin
 if p_action in ('claim','reserve') and exists(select 1 from luna_fxtwitter.enrollments where job_id=p_job_id) then
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'FX admission requires READ COMMITTED'; end if;
  perform 1 from luna_hosted.policy where singleton for update;
  select f.* into p from luna_fxtwitter.policy f join luna_fxtwitter.enrollments e on e.policy_id=f.id where e.job_id=p_job_id for share of f;
  select o.* into a from luna_fxtwitter.approvals o join luna_fxtwitter.enrollments e on e.approval_id=o.id where e.job_id=p_job_id;
  if p.id is null or a.id is null or not p.enabled or p.stopped or clock_timestamp()>=p.expires_at
   or not luna_fxtwitter.current_source(a.receipt_id)
   or not luna_fxtwitter.current_source(coalesce((a.receipt_json::jsonb#>>'{originalArchive,id}')::uuid,a.receipt_id))
   or exists(select 1 from luna_fxtwitter.conflicts c where c.receipt_id in (a.receipt_id,(a.receipt_json::jsonb#>>'{originalArchive,id}')::uuid))
   then return jsonb_build_object('version','luna-hosted-review-v1','jobId',p_job_id,'status','held'); end if;
 end if;
 return luna_hosted.review_enrolled_job(p_action,p_job_id,p_payload);
end $$;
revoke all on function luna_hosted.review_rpc(text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function luna_hosted.review_rpc(text,uuid,jsonb) to service_role;

-- Serialize even direct owner approval inserts with expiry/retirement. Content
-- cannot be recreated from a stale draft after its receipts have expired.
create function luna_fxtwitter.approval_guard() returns trigger language plpgsql set search_path=pg_catalog as $$
declare p luna_fxtwitter.policy;
begin
 select * into strict p from luna_fxtwitter.policy where id=new.policy_id for update;
 if not p.enabled or p.stopped or clock_timestamp()<p.starts_at or clock_timestamp()>=p.expires_at
  or not exists(select 1 from luna_fxtwitter.receipts where id=new.receipt_id and policy_id=p.id and classification='baseline') then raise exception 'FX approval closed'; end if;
 new.approved_at:=clock_timestamp();
 return new;
end $$;
create trigger approval_guard before insert on luna_fxtwitter.approvals for each row execute function luna_fxtwitter.approval_guard();

create function luna_fxtwitter.stage_for_owner(p_approval_id uuid) returns uuid language plpgsql security invoker set search_path=pg_catalog as $$
declare p luna_fxtwitter.policy; w luna_hosted.policy; a luna_fxtwitter.approvals; r luna_fxtwitter.receipts; o luna_fxtwitter.receipts;
 snap jsonb; input jsonb; status jsonb; original jsonb; quoted jsonb; review jsonb; body text; author text; url text; received timestamptz;
begin
 select * into strict w from luna_hosted.policy where singleton for update;
 select * into strict a from luna_fxtwitter.approvals where id=p_approval_id;
 select * into strict p from luna_fxtwitter.policy where id=a.policy_id for update;
 if w.approval_id<>p.worker_approval_id or not p.enabled or p.stopped or w.stopped or clock_timestamp()<p.starts_at or clock_timestamp()>=p.expires_at then raise exception 'FX staging closed'; end if;
 select * into strict r from luna_fxtwitter.receipts where id=a.receipt_id and policy_id=p.id and classification='baseline';
 snap:=a.receipt_json::jsonb; input:=a.input_json::jsonb; status:=r.payload_json::jsonb;
 if snap->>'kind' is distinct from 'luna-fxtwitter-review-receipt-v1' or snap->>'eventTable' is distinct from 'luna_fxtwitter.receipts'
  or snap->>'id' is distinct from r.id::text or snap->>'eventId' is distinct from r.id::text
  or snap->'archive' is distinct from luna_fxtwitter.load_for_owner(r.id) or not snap ? 'originalArchive' then raise exception 'unbound FX seal'; end if;
 if snap->'originalArchive'='null'::jsonb then
  o:=r;
  if coalesce(status->'quote','null'::jsonb)<>'null'::jsonb then raise exception 'independent quoted original required'; end if;
 else
  select * into strict o from luna_fxtwitter.receipts where id=(snap#>>'{originalArchive,id}')::uuid and policy_id=p.id and classification='baseline';
  original:=o.payload_json::jsonb; quoted:=status->'quote';
  if o.id=r.id or o.post_id=r.post_id or o.published_at>r.published_at or snap->'originalArchive' is distinct from luna_fxtwitter.load_for_owner(o.id)
   or not luna_fxtwitter.valid_status(quoted,o.post_id,original#>>'{author,screen_name}')
   or lower(quoted#>>'{author,screen_name}') is distinct from lower(original#>>'{author,screen_name}')
   or coalesce(quoted#>>'{raw_text,text}',quoted->>'text') is distinct from coalesce(original#>>'{raw_text,text}',original->>'text')
   or luna_fxtwitter.posted(quoted) is distinct from o.published_at then raise exception 'unbound FX quote'; end if;
 end if;
 if not luna_fxtwitter.current_source(r.id) or not luna_fxtwitter.current_source(o.id) then raise exception 'FX provider scope changed'; end if;
 if exists(select 1 from luna_fxtwitter.conflicts where receipt_id in (r.id,o.id)) then raise exception 'FX corrected source requires new review'; end if;
 original:=o.payload_json::jsonb; body:=coalesce(original#>>'{raw_text,text}',original->>'text'); author:=lower(original#>>'{author,screen_name}');
 url:='https://x.com/'||author||'/status/'||o.post_id; received:=greatest(r.first_seen_at,o.first_seen_at); review:=snap->'sourceReview';
 if body is null or btrim(body)='' or body ~* '^\s*RT\s+@'
  or review->>'basis' is distinct from 'owner-reviewed-direct-source' or review->>'receiptId' is distinct from o.id::text
  or review->>'payloadSha256' is distinct from o.payload_sha256 or review->>'textSha256' is distinct from encode(sha256(convert_to(body,'UTF8')),'hex')
  or review->>'postId' is distinct from o.post_id or lower(review->>'author') is distinct from author or review->>'url' is distinct from url
  or (review->>'publishedAt')::timestamptz is distinct from o.published_at
  or not coalesce((review->>'reviewedAt')::timestamptz between received and a.approved_at,false)
  or btrim(coalesce(review->>'evidenceRef',''))='' or btrim(coalesce(review->>'permissionRef',''))='' or btrim(coalesce(review->>'reviewerRef',''))=''
  or (snap->>'receivedAt')::timestamptz is distinct from received
  or snap->'inputRow' is distinct from jsonb_build_object('tweet_id',o.post_id,'text',body,'link_to_tweet',url,'raw_payload',original,'tweet_created_at',luna_fxtwitter.utc(o.published_at))
  or input#>'{packet,receiptSnapshot}' is distinct from snap or input->'decisions' is distinct from 'false'::jsonb
  or input->>'referenceMode' is distinct from 'rules-and-synthetic-only' or input#>>'{identity,evaluation,mode}' is distinct from 'causal_as_of'
  or input#>>'{packet,source,retainedSourceId}' is distinct from 'luna_fxtwitter.receipts:'||r.id::text
  or input#>'{packet,canPublish}' is distinct from 'false'::jsonb or input#>'{packet,canChangeStatus}' is distinct from 'false'::jsonb
  or input#>'{packet,providerDispatchEnabled}' is distinct from 'false'::jsonb then raise exception 'unbound FX owner review'; end if;
 if exists(select 1 from luna_fxtwitter.enrollments where policy_id=p.id) then
  if exists(select 1 from luna_fxtwitter.enrollments e join luna_hosted.jobs j on j.id=e.job_id join luna_hosted.sources s on s.receipt_id=j.receipt_id
   where e.approval_id=a.id and e.job_id=a.job_id and e.receipt_id=r.id and j.approval_id=w.approval_id and j.receipt_id=r.id::text
    and j.input_json=a.input_json and j.input_hash=a.input_hash and j.reference_hash=a.reference_hash and s.receipt_json=a.receipt_json and s.receipt_hash=a.receipt_hash
    and s.provenance_ref=a.provenance_ref) then return a.job_id; end if;
  raise exception 'FX enrollment conflict';
 end if;
 if exists(select 1 from luna_hosted.jobs) or exists(select 1 from luna_hosted.sources) or exists(select 1 from luna_hosted.attempts) then raise exception 'FX shared worker busy'; end if;
 insert into luna_fxtwitter.enrollments values(p.id,a.id,a.job_id,r.id);
 insert into luna_hosted.sources values(r.id::text,a.receipt_json,a.receipt_hash,a.provenance_ref);
 insert into luna_hosted.jobs(id,approval_id,receipt_id,input_json,input_hash,reference_hash) values(a.job_id,w.approval_id,r.id::text,a.input_json,a.input_hash,a.reference_hash);
 return a.job_id;
end $$;

create function luna_fxtwitter.purge_due(p_policy_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog set lock_timeout='2s' as $$
declare p luna_fxtwitter.policy; w luna_hosted.policy; e luna_fxtwitter.enrollments; a luna_hosted.attempts; ret luna_fxtwitter.retirements;
 prior bigint; reservation bigint; receipt_count integer;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'FX cleanup requires READ COMMITTED'; end if;
 select * into w from luna_hosted.policy where singleton for update;
 select * into p from luna_fxtwitter.policy where id=p_policy_id for update;
 if not found then return jsonb_build_object('status','refused'); end if;
 select * into ret from luna_fxtwitter.retirements where policy_id=p.id;
 if found then
  if ret.receipt_count<>(select count(*) from luna_fxtwitter.source_references where policy_id=p.id) then raise exception 'FX retention reference conflict'; end if;
  return jsonb_build_object('status','purged','replay',true);
 end if;
 if clock_timestamp()<p.purge_after then return jsonb_build_object('status','not_due'); end if;
 -- Wait for writes, including owner SQL, whose time guard may have passed before expiry.
 lock table luna_fxtwitter.receipts,luna_fxtwitter.approvals,luna_fxtwitter.enrollments in share row exclusive mode;
 select * into e from luna_fxtwitter.enrollments where policy_id=p.id;
 if w.approval_id=p.worker_approval_id then
  lock table luna_hosted.sources,luna_hosted.jobs,luna_hosted.attempts in share row exclusive mode;
  if exists(select 1 from luna_hosted.jobs where id is distinct from e.job_id or approval_id<>p.worker_approval_id or receipt_id is distinct from e.receipt_id::text)
   or exists(select 1 from luna_hosted.sources where receipt_id is distinct from e.receipt_id::text)
   or exists(select 1 from luna_hosted.attempts where job_id is distinct from e.job_id) then raise exception 'FX worker scope conflict'; end if;
  if e.job_id is not null and not exists(select 1 from luna_hosted.jobs j join luna_hosted.sources s on s.receipt_id=j.receipt_id where j.id=e.job_id)
   then raise exception 'FX enrolled content missing'; end if;
  select * into a from luna_hosted.attempts where job_id=e.job_id;
  prior:=w.prior_exposure_nano_usd;
 elsif e.job_id is not null then raise exception 'FX active worker mismatch'; end if;
 reservation:=coalesce(a.reserved_nano_usd,0);
 insert into luna_fxtwitter.source_references(receipt_id,policy_id,source_key,source_account,shadow_id,post_id,author,canonical_url,first_seen_at,response_sha256,payload_sha256,classification,conflict_at,conflict_sha256)
 select r.id,r.policy_id,r.source_key,source_account,shadow_id,post_id,lower(payload_json::jsonb#>>'{author,screen_name}'),
 'https://x.com/'||lower(payload_json::jsonb#>>'{author,screen_name}')||'/status/'||post_id,first_seen_at,response_sha256,payload_sha256,classification,c.observed_at,c.semantic_sha256
 from luna_fxtwitter.receipts r left join luna_fxtwitter.conflicts c on c.receipt_id=r.id where r.policy_id=p.id;
 get diagnostics receipt_count=row_count;
 insert into luna_fxtwitter.operation values(txid_current(),p.id,'purge');
 update luna_fxtwitter.policy set enabled=false,stopped=true where id=p.id;
 if w.approval_id=p.worker_approval_id then
  update luna_hosted.policy set enabled=false,stopped=true,prior_exposure_nano_usd=prior+reservation where singleton;
 end if;
 insert into luna_fxtwitter.retirements values(p.id,clock_timestamp(),receipt_count,e.job_id,a.request_key,a.state,reservation,a.charge_nano_usd,
  luna_retention.reconciliation_request_id(a.request_id,a.receipt_json),prior,prior+reservation);
 delete from luna_hosted.attempts where job_id=e.job_id;
 delete from luna_hosted.jobs where id=e.job_id and approval_id=p.worker_approval_id;
 delete from luna_hosted.sources where receipt_id=e.receipt_id::text;
 delete from luna_fxtwitter.enrollments where policy_id=p.id;
 delete from luna_fxtwitter.approvals where policy_id=p.id;
 delete from luna_fxtwitter.conflicts where policy_id=p.id;
 delete from luna_fxtwitter.receipts where policy_id=p.id;
 delete from luna_fxtwitter.operation where transaction_id=txid_current();
 return jsonb_build_object('status','purged','replay',false);
end $$;
create function public.luna_fxtwitter_purge_rpc(p_policy_id uuid) returns jsonb language sql security invoker set search_path=pg_catalog as $$
 select luna_fxtwitter.purge_due(p_policy_id)
$$;

alter table luna_fxtwitter.policy enable row level security;
alter table luna_fxtwitter.receipts enable row level security;
alter table luna_fxtwitter.conflicts enable row level security;
alter table luna_fxtwitter.approvals enable row level security;
alter table luna_fxtwitter.enrollments enable row level security;
alter table luna_fxtwitter.source_references enable row level security;
alter table luna_fxtwitter.retirements enable row level security;
alter table luna_fxtwitter.operation enable row level security;
revoke all on all tables in schema luna_fxtwitter from public,anon,authenticated,service_role;
revoke all on all functions in schema luna_fxtwitter from public,anon,authenticated,service_role;
revoke all on function public.luna_store_fxtwitter_rows_v1(jsonb,jsonb),public.luna_fxtwitter_purge_rpc(uuid) from public,anon,authenticated,service_role;
grant usage on schema luna_fxtwitter to service_role;
grant execute on function luna_fxtwitter.store_rows(jsonb,jsonb),luna_fxtwitter.purge_due(uuid),
 public.luna_store_fxtwitter_rows_v1(jsonb,jsonb),public.luna_fxtwitter_purge_rpc(uuid) to service_role;
commit;
