-- The harness must have created a fresh, local socket-only cluster.
do $$ begin
 if current_user<>'fx_owner' or current_database()<>'postgres' or inet_server_addr() is not null
  or current_setting('data_directory') !~ '^/private/tmp/lunafx\.|^/tmp/lunafx\.' then raise exception 'private test cluster required'; end if;
end $$;
create function pg_temp.check_it(ok boolean, label text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'FAILED %',label; end if; end $$;
select pg_temp.check_it(not has_function_privilege('anon','public.luna_store_fxtwitter_rows_v1(jsonb,jsonb)','execute')
 and not has_function_privilege('authenticated','public.luna_fxtwitter_purge_rpc(uuid)','execute')
 and has_function_privilege('service_role','public.luna_store_fxtwitter_rows_v1(jsonb,jsonb)','execute')
 and not has_function_privilege('service_role','luna_fxtwitter.load_for_owner(uuid)','execute')
 and not has_function_privilege('service_role','luna_fxtwitter.stage_for_owner(uuid)','execute')
 and not has_function_privilege('service_role','luna_hosted.review_enrolled_job(text,uuid,jsonb)','execute')
 and not has_table_privilege('service_role','luna_fxtwitter.approvals','insert')
 and not has_table_privilege('service_role','luna_fxtwitter.receipts','select'),'capture and enrollment ACLs');

create function pg_temp.status_for(post text,author text,body text) returns jsonb language sql as $$
 select jsonb_build_object('id',post,'author',jsonb_build_object('screen_name',author),'url','https://x.com/'||author||'/status/'||post,
  'text',body,'created_timestamp',1730000000)
$$;
create function pg_temp.make_row(account text,status jsonb) returns jsonb language sql as $$
 select jsonb_build_object('source_group','test','source_key',lower(account),'source_account',account,'tweet_id',status->>'id','post_kind',
  case when status ? 'reposted_by' then 'repost' when status ? 'quote' then 'quote' else 'post' end,
  'original_author_handle',case when status ? 'reposted_by' then status#>>'{author,screen_name}' end,
  'author_handle',status#>>'{author,screen_name}','full_text',status->>'text','text',status->>'text','link_to_tweet',status->>'url',
  'tweet_created_at','2024-10-27T03:33:20Z','has_media',false,'media_alt_texts','[]'::jsonb,'raw_payload',status)
$$;
create function pg_temp.evidence(status jsonb) returns jsonb language sql as $$
 select jsonb_build_object('tweetId',status->>'id','responseSha256',repeat('a',64),'payloadJson',status::text,
 'payloadSha256',encode(sha256(convert_to(status::text,'UTF8')),'hex'),'via','mirror')
$$;
create function pg_temp.send(account text,row_status jsonb,evidence_status jsonb) returns integer language sql as $$
 select count(*)::integer from public.luna_store_fxtwitter_rows_v1(jsonb_build_array(pg_temp.make_row(account,row_status)),
   case when evidence_status is null then '[]'::jsonb else jsonb_build_array(pg_temp.evidence(evidence_status)) end)
$$;
create function pg_temp.add_policy(purge_at timestamptz) returns uuid language sql as $$
 insert into luna_fxtwitter.policy(id,worker_approval_id,accounts,starts_at,expires_at,purge_after,max_receipts,cap_nano_usd)
 values('10000000-0000-4000-8000-000000000001','fx-worker','{"reporter":"Reporter","desk":"Desk"}',
 clock_timestamp()-interval '50 min',least(clock_timestamp()+interval '9 min',purge_at),purge_at,5,1000000000) returning id
$$;
create function pg_temp.successor(parent_id uuid default '10000000-0000-4000-8000-000000000001', cap bigint default 1000000000) returns uuid language sql as $$
 insert into luna_fxtwitter.policy(id,worker_approval_id,accounts,starts_at,expires_at,purge_after,max_receipts,cap_nano_usd,previous_policy_id)
 values(gen_random_uuid(),'successor-'||gen_random_uuid(),'{"reporter":"Reporter"}',now(),now()+interval '30 min',now()+interval '2 hours',2,cap,parent_id)
 returning id
$$;
create function pg_temp.expect_closed_slot() returns void language plpgsql as $$
begin
 begin perform pg_temp.successor();
 exception when raise_exception then
  if sqlerrm='previous FX capture requires an empty retirement' then return; end if;
  raise;
 end;
 raise exception 'another FX pilot was admitted';
end $$;
begin;
insert into public.tweet_intake_providers(source_key,provider) values('reporter','fxtwitter'),('desk','ifttt');
select pg_temp.add_policy(clock_timestamp()+interval '3 seconds');
set local role service_role;
select pg_temp.check_it(pg_temp.send('Reporter',s,s)=1,'service-only disabled capture stores normal row') from (select pg_temp.status_for('1','Reporter','history') s) t;
reset role;
update luna_fxtwitter.policy set enabled=true;
select pg_temp.check_it(pg_temp.send('Reporter',s,s)=0,'old row replay') from (select pg_temp.status_for('1','Reporter','history') s) t;
select pg_temp.check_it(pg_temp.send('Desk',s,s)=1,'unselected provider stores normal row') from (select pg_temp.status_for('2','Desk','other provider') s) t;
select pg_temp.check_it(pg_temp.send('Reporter',s,null)=1,'missing evidence stores normal row') from (select pg_temp.status_for('3','Reporter','unsealed') s) t;
select pg_temp.check_it(pg_temp.send('Reporter',s,s||'{"text":"different body"}')=1,'evidence mismatch stores normal row') from (select pg_temp.status_for('4','Reporter','unchanged') s) t;
select pg_temp.check_it(not exists(select 1 from luna_fxtwitter.receipts),'no retrospective, wrong provider or unbound capture');
update public.tweet_intake_providers set provider='fxtwitter' where source_key='desk';
-- Original reporter comments on a practice quote. Its own text remains the
-- sole selected text; quoted material is context and cannot be substituted.
create temp table sample as select pg_temp.status_for('5','Reporter','Original report')||
 jsonb_build_object('quote',pg_temp.status_for('55','PracticeDesk','Nested practice context')) s;
select pg_temp.check_it(pg_temp.send('Reporter',s,s)=1,'atomic baseline') from sample;
select pg_temp.check_it(pg_temp.send('Reporter',s,s)=0,'duplicate delivery') from sample;
select pg_temp.check_it(pg_temp.send('Reporter',s||'{"likes":200}',s||'{"likes":200}')=0,'variant leaves shadow intact') from sample;
select pg_temp.check_it((select count(*) from luna_fxtwitter.receipts)=2 and (select raw_payload from public.x_timeline_shadow_posts where tweet_id='5')=s,'distinct variants with immutable first shadow') from sample;
select pg_temp.check_it(pg_temp.send('Desk',s,s)=1,'independent quote') from (select pg_temp.status_for('6','Desk','Quoted')||jsonb_build_object('quote',s) s from sample) x;
select pg_temp.check_it(pg_temp.send('Desk',s||'{"repost_wrapper_id":"90"}',s)=1,'hydrated wrapper attachment') from
 (select pg_temp.status_for('7','Reporter','Reposted')||'{"reposted_by":{"screen_name":"Desk"}}'::jsonb s) x;
select pg_temp.check_it(pg_temp.send('Reporter',s||'{"repost_wrapper_id":"90"}',s)=1,'forged wrapper attachment still stores regular shadow') from
 (select pg_temp.status_for('8','Reporter','Unrelated') s) x;
select pg_temp.check_it((select count(*) from luna_fxtwitter.receipts)=4,'only genuine wrapper may differ from original bytes');
-- Retained capture row is bound to the DB clock, not a caller timestamp.
select pg_temp.check_it((select count(*)=1 from luna_fxtwitter.receipts r join public.x_timeline_shadow_posts s on s.id=r.shadow_id and s.first_seen_at=r.first_seen_at where r.post_id='5' and classification='baseline'),'first seen clock');
select luna_fxtwitter.prepare_worker_for_owner(id) from luna_fxtwitter.policy;
select pg_temp.check_it(not enabled and max_calls=1,'prepared worker disabled') from luna_hosted.policy;
select pg_temp.check_it(public.luna_fxtwitter_purge_rpc(id)->>'status'='not_due','early purge refuses') from luna_fxtwitter.policy;

create function pg_temp.approve(snap jsonb) returns uuid language plpgsql as $$
declare approval uuid:=gen_random_uuid(); input jsonb; rid uuid:=(snap->>'id')::uuid;
begin
 input:=jsonb_build_object('packet',jsonb_build_object('receiptSnapshot',snap,'source',jsonb_build_object('retainedSourceId','luna_fxtwitter.receipts:'||rid::text),
  'canPublish',false,'canChangeStatus',false,'providerDispatchEnabled',false),'decisions',false,'referenceMode','rules-and-synthetic-only',
  'identity',jsonb_build_object('evaluation',jsonb_build_object('mode','causal_as_of')));
 insert into luna_fxtwitter.approvals(id,policy_id,receipt_id,job_id,input_json,input_hash,receipt_json,receipt_hash,reference_hash,provenance_ref)
 select approval,id,rid,gen_random_uuid(),input::text,encode(sha256(convert_to(input::text,'UTF8')),'hex'),snap::text,encode(sha256(convert_to(snap::text,'UTF8')),'hex'),repeat('b',64),'owner-fixture' from luna_fxtwitter.policy;
 return luna_fxtwitter.stage_for_owner(approval);
end $$;
create temp table snapshot as
with seals as (select luna_fxtwitter.load_for_owner(r.id) archive,luna_fxtwitter.load_for_owner(o.id) original
 from luna_fxtwitter.receipts r join luna_fxtwitter.receipts o on o.policy_id=r.policy_id where r.post_id='6' and o.post_id='5' and o.classification='baseline')
select jsonb_build_object('kind','luna-fxtwitter-review-receipt-v1','id',archive->>'id','eventId',archive->>'id','eventTable','luna_fxtwitter.receipts',
 'receivedAt',greatest(archive->>'firstSeenAt',original->>'firstSeenAt'),'archive',archive,'originalArchive',original,
 'inputRow',jsonb_build_object('tweet_id','5','text','Original report','link_to_tweet','https://x.com/reporter/status/5','raw_payload',(original->>'payloadJson')::jsonb,'tweet_created_at',original->>'publishedAt'),
 'sourceReview',jsonb_build_object('basis','owner-reviewed-direct-source','receiptId',original->>'id','payloadSha256',original->>'payloadSha256',
 'textSha256',encode(sha256(convert_to('Original report','UTF8')),'hex'),'postId','5','author','Reporter','url','https://x.com/reporter/status/5','publishedAt',original->>'publishedAt',
 'reviewedAt',luna_fxtwitter.utc(clock_timestamp()),'reviewerRef','owner','permissionRef','permission-fixture','evidenceRef','evidence-fixture')) snap from seals;
do $$ declare s jsonb; accepted boolean; mutation jsonb; begin
 select snap into strict s from snapshot;
 for mutation in select v from (values
 (jsonb_set(s,'{archive,payloadJson}','"{}"')), (jsonb_set(s,'{originalArchive,payloadSha256}',to_jsonb(repeat('0',64)))),
 (jsonb_set(s,'{sourceReview,evidenceRef}','""')), (jsonb_set(s,'{sourceReview,receiptId}',s#>'{archive,id}')),
 (jsonb_set(s,'{inputRow,text}','"Nested practice context"')), (jsonb_set(s,'{receivedAt}','"2024-01-01T00:00:00Z"')),
 (jsonb_set(s,'{originalArchive}','null'))) bad(v) loop
  begin accepted:=false; perform pg_temp.approve(mutation); accepted:=true;
  exception when others then if sqlerrm not in ('unbound FX seal','unbound FX quote','unbound FX owner review','independent quoted original required') then raise; end if; end;
  if accepted then raise exception 'unbound approval accepted'; end if;
 end loop;
end $$;
select pg_temp.approve(snap) from snapshot;
select pg_temp.check_it(luna_fxtwitter.stage_for_owner(id)=job_id,'exact staging replay') from luna_fxtwitter.approvals;
update luna_hosted.policy set enabled=true;
-- Fill the receipt budget using a changed engagement counter. Further genuine
-- corrections of the primary or independent original still prohibit admission.
select pg_temp.check_it(pg_temp.send('Reporter',s||'{"views":12}',s||'{"views":12}')=0,'counter variant at cap') from sample;
select pg_temp.check_it((select count(*)=5 from luna_fxtwitter.receipts) and not exists(select 1 from luna_fxtwitter.conflicts),'counters leave original eligible');
savepoint before_conflict;
select pg_temp.send('Desk',s,s) from (select pg_temp.status_for('6','Desk','Changed primary wording')||jsonb_build_object('quote',s) s from sample) x;
select pg_temp.check_it((select count(*)=5 from luna_fxtwitter.receipts) and (select count(*)=1 from luna_fxtwitter.conflicts),'at-cap conflict without extra body');
do $$ begin
 begin perform luna_fxtwitter.stage_for_owner(id) from luna_fxtwitter.approvals; raise exception 'missed changed primary';
 exception when others then if sqlerrm<>'FX corrected source requires new review' then raise; end if; end;
end $$;
select pg_temp.check_it(public.luna_hosted_review_rpc('claim',id,'{}')->>'status'='held','changed primary cannot claim') from luna_hosted.jobs;
rollback to before_conflict;
savepoint before_provider_switch;
update public.tweet_intake_providers set provider='ifttt' where source_key='reporter';
select pg_temp.check_it(public.luna_hosted_review_rpc('claim',id,'{}')->>'status'='held','original provider switched since capture') from luna_hosted.jobs;
rollback to before_provider_switch;
select pg_temp.check_it(public.luna_hosted_review_rpc('claim',id,'{}')->>'status'='claimed','existing worker claims FX job') from luna_hosted.jobs;
savepoint before_original_conflict;
select pg_temp.send('Reporter',s||'{"replying_to_status":"89","media":{"all":[{"type":"photo","altText":"report context"}]}}',
  s||'{"replying_to_status":"89","media":{"all":[{"type":"photo","altText":"report context"}]}}') from sample;
select pg_temp.check_it(public.luna_hosted_review_rpc('reserve',id,jsonb_build_object('amountNanoUsd','234000000','key',repeat('1',64)))->>'status'='held'
 and not exists(select 1 from luna_hosted.attempts),'changed original blocks reservation after claim') from luna_hosted.jobs;
rollback to before_original_conflict;
select pg_temp.check_it(public.luna_hosted_review_rpc('reserve',id,jsonb_build_object('amountNanoUsd','234000000','key',repeat('1',64)))->>'status'='reserved','bounded single call') from luna_hosted.jobs;
select pg_temp.check_it(public.luna_hosted_review_rpc('settle',id,jsonb_build_object('key',repeat('1',64),'receiptJson',
 '{"endpoint":"responses","body":{"model":"gpt-6-luna"},"requestId":"fx-req-1","chargeNanoUsd":23}'))->>'status'='settled','existing settlement') from luna_hosted.jobs;
select pg_temp.check_it(public.luna_hosted_review_rpc('finish',id,jsonb_build_object('resultJson',
 '{"candidate":null,"review":{"status":"review_only","canPublish":false,"canChangeStatus":false,"canWriteAliases":false,"canExecuteReplacement":false}}'))->>'status'='completed','existing result persistence') from luna_hosted.jobs;
select pg_temp.send('Reporter',s||'{"text":"Correction"}',s||'{"text":"Correction"}') from sample;
select pg_temp.check_it(public.luna_hosted_review_rpc('claim',id,'{}')->>'status'='held','old completed result not exposed as current') from luna_hosted.jobs;
select pg_sleep(greatest(0,extract(epoch from purge_after-clock_timestamp())+0.015)) from luna_fxtwitter.policy;
select pg_temp.check_it(luna_fxtwitter.load_for_owner(receipt_id) is null,'expired export blocked') from luna_fxtwitter.enrollments;
select pg_temp.check_it(public.luna_fxtwitter_purge_rpc(id)='{"status":"purged","replay":false}'::jsonb,'due purge') from luna_fxtwitter.policy;
select pg_temp.check_it(public.luna_fxtwitter_purge_rpc(id)='{"status":"purged","replay":true}'::jsonb,'exact replay') from luna_fxtwitter.policy;
select pg_temp.check_it(not exists(select 1 from luna_hosted.jobs) and not exists(select 1 from luna_hosted.attempts) and not exists(select 1 from luna_hosted.sources)
 and not exists(select 1 from luna_fxtwitter.approvals) and not exists(select 1 from luna_fxtwitter.enrollments) and not exists(select 1 from luna_fxtwitter.receipts)
 and (select count(*)=8 from public.x_timeline_shadow_posts) and (select count(*)=5 from luna_fxtwitter.source_references) and (select count(*)=1 from luna_fxtwitter.source_references where conflict_at is not null and conflict_sha256 is not null)
 and (select canonical_url='https://x.com/reporter/status/7' from luna_fxtwitter.source_references where post_id='7')
 and (select stopped and not enabled and prior_exposure_nano_usd=234000000 from luna_hosted.policy)
 and (select request_id='fx-req-1' and state='settled' and charge_nano_usd=23 and total_exposure_nano_usd=234000000 from luna_fxtwitter.retirements),'scoped content deletion, URLs, exposure and provider request preserved');
select pg_temp.expect_closed_slot(); -- Retired after paid dispatch.
rollback;

-- A real empty previously approved legacy pilot can retire and rotate without
-- reopening its applet, resetting prior exposure or changing historical receipts.
begin;
insert into luna_capture.policy(id,applet_id,source_account,starts_at,expires_at,max_attempts,max_receipts,max_bytes)
values('20000000-0000-4000-8000-000000000001','legacy','Reporter',now()-interval '10 days',now()-interval '10 days'+interval '45 min',5,1,65536);
insert into luna_hosted.policy(approval_id,starts_at,expires_at,max_calls,cap_nano_usd,prior_exposure_nano_usd)
select 'legacy-worker',starts_at,expires_at,1,1000000000,322000000 from luna_capture.policy;
insert into luna_retention.plan(capture_policy_id,worker_approval_id,purge_after)
select id,'legacy-worker',starts_at+interval '7 days' from luna_capture.policy;
select pg_temp.add_policy(clock_timestamp()+interval '2 seconds');
do $$ begin
 begin perform luna_fxtwitter.prepare_worker_for_owner(id) from luna_fxtwitter.policy; raise exception 'missing rollover guard';
 exception when others then if sqlerrm<>'prior pilot reconciliation required' then raise; end if; end;
end $$;
select pg_temp.check_it(luna_retention.purge_due(id)->>'status'='purged','old owner-authorized retirement path') from luna_capture.policy;
select luna_fxtwitter.prepare_worker_for_owner(id) from luna_fxtwitter.policy;
select pg_temp.check_it((select stopped and not enabled from luna_capture.policy) and (select count(*)=1 from luna_retention.retirement)
 and (select approval_id='fx-worker' and not stopped and not enabled and prior_exposure_nano_usd=322000000 from luna_hosted.policy),'retired pilot rollover and prior exposure');
-- Exercise the expired, captured, never-enrolled FxTwitter path with actual
-- retirement and worker RPCs. Carry unspent historical exposure into the one caller.
insert into public.tweet_intake_providers(source_key,provider) values('reporter','fxtwitter');
update luna_fxtwitter.policy set enabled=true;
select pg_temp.send('Reporter',s,s) from (select pg_temp.status_for('11','Reporter','Retained source') s) t;
update luna_fxtwitter.policy set enabled=false,stopped=true;
select pg_temp.expect_closed_slot(); -- Stopped manually, private content still held.
select pg_sleep(greatest(0,extract(epoch from purge_after-clock_timestamp())+0.015)) from luna_fxtwitter.policy;
select pg_temp.check_it(public.luna_fxtwitter_purge_rpc(id)->>'status'='purged','empty dispatch retirement') from luna_fxtwitter.policy;
savepoint low_cap;
do $$ declare next_id uuid; begin
 next_id:=pg_temp.successor(cap=>234000000);
 begin perform luna_fxtwitter.prepare_worker_for_owner(next_id); raise exception 'low cap accepted';
 exception when others then if sqlerrm<>'prior pilot reconciliation required' then raise; end if; end;
end $$;
rollback to low_cap;
create temp table selected_successor as select pg_temp.successor() id;
do $$ declare key_name text; begin
 begin perform pg_temp.successor(); raise exception 'duplicate sibling accepted';
 exception when unique_violation then
  get stacked diagnostics key_name=constraint_name;
  if key_name<>'luna_fx_one_successor' then raise; end if;
 end;
 begin perform pg_temp.successor(null); raise exception 'duplicate root accepted';
 exception when unique_violation then
  get stacked diagnostics key_name=constraint_name;
  if key_name<>'luna_fx_one_successor' then raise; end if;
 end;
end $$;
select luna_fxtwitter.prepare_worker_for_owner(id) from selected_successor;
select pg_temp.check_it((select count(*)=2 from luna_fxtwitter.policy)
 and (select count(*)=1 from luna_fxtwitter.policy where not stopped)
 and exists(select 1 from selected_successor n join luna_fxtwitter.policy p using(id)
     join luna_hosted.policy w on w.approval_id=p.worker_approval_id
     where not w.enabled and not w.stopped and w.max_calls=1 and w.prior_exposure_nano_usd=322000000)
 and (select count(*)=1 and min(post_id)='11' from luna_fxtwitter.source_references)
 and (select count(*)=1 from luna_fxtwitter.empty_retired_workers)
 and not exists(select 1 from luna_hosted.jobs) and not exists(select 1 from luna_hosted.attempts)
 and not has_table_privilege('service_role','luna_fxtwitter.empty_retired_workers','select')
 and not has_function_privilege('service_role','luna_fxtwitter.prepare_worker_for_owner(uuid)','execute'),
 'successor starts disabled, retains funding and provenance, enrollment stays private');
do $$ begin
 begin perform pg_temp.successor((select id from selected_successor)); raise exception 'open successor gained a child';
 exception when others then if sqlerrm<>'previous FX capture requires an empty retirement' then raise; end if; end;
end $$;
rollback;

-- Two real sessions race for the same first sighting. Observe the waiter before
-- committing the winner, then verify a single shadow, baseline and correction.
create extension dblink;
select pg_temp.add_policy(clock_timestamp()+interval '1 day');
update luna_fxtwitter.policy set enabled=true;
insert into public.tweet_intake_providers(source_key,provider) values('reporter','fxtwitter');
select dblink_connect('fx_race',format('host=%s port=%s dbname=%s user=%s application_name=fx_race',
 current_setting('unix_socket_directories'),current_setting('port'),current_database(),current_user));
begin;
select pg_temp.check_it(pg_temp.send('Reporter',s,s)=1,'first transaction inserts') from (select pg_temp.status_for('80','Reporter','First') s) x;
select dblink_send_query('fx_race',format('select count(*) from public.luna_store_fxtwitter_rows_v1(%L::jsonb,%L::jsonb)',
 jsonb_build_array(pg_temp.make_row('Reporter',s))::text,jsonb_build_array(pg_temp.evidence(s))::text))
 from (select pg_temp.status_for('80','Reporter','Correction') s) x;
do $$ declare deadline timestamptz:=clock_timestamp()+interval '2 seconds'; begin
 loop
  perform pg_stat_clear_snapshot();
  exit when exists(select 1 from pg_stat_activity where application_name='fx_race' and wait_event_type='Lock');
  if clock_timestamp()>deadline then raise exception 'expected competing writer to block'; end if;
  perform pg_sleep(0.02);
 end loop;
end $$;
commit;
select pg_temp.check_it(n=0,'second transaction saw first commit') from dblink_get_result('fx_race') as result(n bigint);
select dblink_disconnect('fx_race');
select pg_temp.check_it((select count(*)=1 from public.x_timeline_shadow_posts where tweet_id='80' and raw_payload->>'text'='First')
 and (select count(*)=1 from luna_fxtwitter.receipts where post_id='80' and classification='baseline')
 and (select count(*)=1 from luna_fxtwitter.receipts where post_id='80' and classification='variant')
 and (select count(*)=1 from luna_fxtwitter.conflicts),'concurrent baseline and variant serialized');
