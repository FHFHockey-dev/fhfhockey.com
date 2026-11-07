-- DESTRUCTIVE SYNTHETIC FIXTURES: only the runner's disposable private cluster.
do $$ begin
 if current_user<>'luna_retention_fixture' or inet_server_addr() is not null
  or current_setting('data_directory') !~ '^/private/tmp/fhfh-luna-retention-pg-[A-Za-z0-9_-]+/data$'
  or current_setting('listen_addresses')<>''
 then raise exception 'not the disposable retention fixture'; end if;
end $$;
create schema luna_retention_test;
create table luna_retention_test.checks(label text);
create function luna_retention_test.check_true(value boolean,label text) returns void language plpgsql as $$
begin
 if value is distinct from true then raise exception 'assertion failed: %',label; end if;
 insert into luna_retention_test.checks values(label);
end $$;
create function luna_retention_test.raw_fixture(link text default 'https://www.twitter.com/Reporter/status/123456789?tracking=SYNTHETIC_QUERY_SECRET')
returns text language sql immutable as $$ select jsonb_build_object('text','SYNTHETIC_PRIVATE_REPORT',
 'username','Reporter','link_to_tweet',link,'created_at','synthetic publication label')::text $$;
create function luna_retention_test.seed_fixture(delay interval default interval '1 hour',attempt_state text default 'settled',with_worker boolean default true,
 source_link text default 'https://www.twitter.com/Reporter/status/123456789?tracking=SYNTHETIC_QUERY_SECRET')
returns void language plpgsql as $$
declare start_at timestamptz:=date_trunc('milliseconds',clock_timestamp()-interval '1 day');
 pid uuid:='00000000-0000-4000-8000-000000000001'; rid uuid:='00000000-0000-4000-8000-000000000002';
 jid uuid:='00000000-0000-4000-8000-000000000003'; aid uuid:='00000000-0000-4000-8000-000000000004';
 receipt text:=jsonb_build_object('id',rid,'text','SYNTHETIC_PRIVATE_REPORT')::text;
 input text:='{"text":"SYNTHETIC_PRIVATE_REPORT"}'; raw text:=luna_retention_test.raw_fixture(source_link); envelope text;
begin
 -- Reset is test setup only; candidate exposes no truncate or reset function.
 truncate luna_retention.source_references,luna_retention.purge_context,luna_retention.attempt_tombstones,luna_retention.retirement,luna_retention.plan,
  luna_capture.enrollments,luna_capture.approvals,luna_capture.receipts,luna_capture.policy,
  luna_hosted.attempts,luna_hosted.jobs,luna_hosted.sources,luna_hosted.policy;
 insert into luna_capture.policy(id,applet_id,source_account,starts_at,expires_at,max_attempts,max_receipts,max_bytes,attempts,receipts,retained_bytes)
 values(pid,'synthetic-applet','Reporter',start_at,start_at+interval '1 hour',10,1,65536,3,1,octet_length(raw));
 insert into luna_hosted.policy values(true,'synthetic-approval',false,false,start_at,start_at+interval '1 hour',1,1000000000,269790750);
 insert into luna_retention.plan values(true,pid,'synthetic-approval',clock_timestamp()+delay);
 envelope:=jsonb_build_object('version','luna-isolated-capture-v1','scope',jsonb_build_object('policyId',pid,'appletId','synthetic-applet','sourceAccount','Reporter'),
  'sourceAuthenticated',false,'rawBody',raw,'payloadSha256',encode(sha256(convert_to(raw,'UTF8')),'hex'),
  'byteLength',octet_length(raw),'receivedAt',to_char(start_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'submitted',jsonb_build_object('link',source_link,'postId','123456789'))::text;
 insert into luna_capture.receipts(id,policy_id,applet_id,delivery_key,payload_sha256,byte_length,first_received_at,classification,envelope_json)
 values(rid,pid,'synthetic-applet',repeat('a',64),encode(sha256(convert_to(raw,'UTF8')),'hex'),octet_length(raw),start_at,'baseline',envelope);
 if with_worker then
  insert into luna_hosted.sources values(rid::text,receipt,encode(sha256(convert_to(receipt,'UTF8')),'hex'),'synthetic-only');
  insert into luna_hosted.jobs values(jid,'synthetic-approval',rid::text,input,encode(sha256(convert_to(input,'UTF8')),'hex'),repeat('c',64),'completed',input);
  insert into luna_hosted.attempts values(jid,repeat('d',64),233000000,attempt_state,
   case when attempt_state='settled' then input end,'synthetic-request-id',case when attempt_state='settled' then 1 end);
  insert into luna_capture.approvals(id,receipt_id,job_id,worker_approval_id,input_json,input_hash,receipt_json,receipt_hash,reference_hash,provenance_ref)
  values(aid,rid,jid,'synthetic-approval',input,encode(sha256(convert_to(input,'UTF8')),'hex'),receipt,
   encode(sha256(convert_to(receipt,'UTF8')),'hex'),repeat('c',64),'synthetic-only');
  insert into luna_capture.enrollments values('synthetic-approval',rid,repeat('c',64),aid,jid);
 end if;
end $$;

select luna_retention_test.seed_fixture();
select luna_retention_test.check_true(public.luna_retention_purge_rpc('00000000-0000-4000-8000-000000000001')->>'status'='not_due','early purge refused');
select luna_retention_test.check_true((select count(*)=1 from luna_capture.receipts),'early refusal preserves report');
select luna_retention_test.check_true(public.luna_retention_purge_rpc('00000000-0000-4000-8000-000000000099')->>'status'='refused','wrong policy refused');
do $$ begin
 begin delete from luna_capture.receipts; raise exception 'delete unexpectedly allowed'; exception when insufficient_privilege then null; end;
 perform luna_retention_test.check_true(true,'ordinary receipt delete still denied');
 begin update luna_retention.plan set purge_after=purge_after+interval '1 day'; raise exception 'extension unexpectedly allowed'; exception when insufficient_privilege then null; end;
 perform luna_retention_test.check_true(true,'deadline immutable');
 begin update luna_hosted.policy set expires_at=expires_at+interval '2 days'; raise exception 'extension unexpectedly allowed'; exception when insufficient_privilege then null; end;
 perform luna_retention_test.check_true(true,'worker window cannot extend after enrollment');
 begin update luna_hosted.policy set prior_exposure_nano_usd=0; raise exception 'reset unexpectedly allowed'; exception when insufficient_privilege then null; end;
 perform luna_retention_test.check_true(true,'prior exposure cannot reset');
 begin perform luna_retention_test.seed_fixture(interval '8 days'); raise exception 'long deadline unexpectedly allowed'; exception when invalid_parameter_value then null; end;
 perform luna_retention_test.check_true(true,'deadline over seven days rejected');
 begin perform luna_retention_test.seed_fixture(interval '-2 days'); raise exception 'early deadline unexpectedly allowed'; exception when invalid_parameter_value then null; end;
 perform luna_retention_test.check_true(true,'deadline before worker safety margin rejected');
end $$;

do $$ declare phase text; r jsonb; pid uuid:='00000000-0000-4000-8000-000000000001'; begin
 foreach phase in array array['settled','reserved','uncertain'] loop
  perform luna_retention_test.seed_fixture(interval '100 milliseconds',phase);
  perform pg_sleep(.12);
  r:=public.luna_retention_purge_rpc(pid);
  perform luna_retention_test.check_true(r->>'status'='purged',phase||': due purge succeeds');
  perform luna_retention_test.check_true((select count(*) from luna_capture.receipts)+(select count(*) from luna_capture.approvals)
   +(select count(*) from luna_capture.enrollments)+(select count(*) from luna_hosted.sources)
   +(select count(*) from luna_hosted.jobs)+(select count(*) from luna_hosted.attempts)=0,phase||': every content-bearing table empty');
  perform luna_retention_test.check_true((select not enabled and stopped and prior_exposure_nano_usd=502790750 from luna_hosted.policy),phase||': worker stopped and full exposure carried');
  perform luna_retention_test.check_true((select not enabled and stopped and attempts=3 and receipts=1 and retained_bytes=octet_length(luna_retention_test.raw_fixture()) from luna_capture.policy),phase||': capture stopped and counters preserved');
  perform luna_retention_test.check_true((select total_exposure_nano_usd=502790750 and call_count=1 and unresolved_count=case when phase='settled' then 0 else 1 end from luna_retention.retirement),phase||': no-content accounting retained');
  perform luna_retention_test.check_true((select t.state=phase and request_id='synthetic-request-id' from luna_retention.attempt_tombstones t),phase||': reconciliation identifier preserved');
  perform luna_retention_test.check_true((select tweet_url='https://x.com/reporter/status/123456789' and post_id='123456789'
   and source_account='reporter' and attribution_basis='submitted_capture_metadata' from luna_retention.source_references),phase||': usable URL retained without claiming authentication');
  perform luna_retention_test.check_true((select position('SYNTHETIC_PRIVATE_REPORT' in row_to_json(x)::text)=0
   and position('SYNTHETIC_QUERY_SECRET' in row_to_json(x)::text)=0 from luna_retention.source_references x),phase||': no report text or query copied');
  perform luna_retention_test.check_true(not exists(select 1 from luna_retention.purge_context),phase||': transaction authorization removed');
  perform luna_retention_test.check_true((public.luna_retention_purge_rpc(pid)->>'replay')::boolean,phase||': exact purge retry is idempotent');
  perform luna_retention_test.check_true((select prior_exposure_nano_usd=502790750 from luna_hosted.policy),phase||': retry never double-charges exposure');
  begin update luna_hosted.policy set enabled=true,stopped=false; raise exception 'reset unexpectedly allowed'; exception when insufficient_privilege then null; end;
  perform luna_retention_test.check_true(true,phase||': retired worker cannot reactivate');
  begin delete from luna_retention.attempt_tombstones; raise exception 'delete unexpectedly allowed'; exception when insufficient_privilege then null; end;
  perform luna_retention_test.check_true(true,phase||': accounting cannot be erased');
  begin delete from luna_retention.source_references; raise exception 'URL delete allowed'; exception when insufficient_privilege then null; end;
  perform luna_retention_test.check_true(true,phase||': retained URL immutable');
  begin insert into luna_hosted.sources values('new','{"id":"new"}',repeat('a',64),'new'); raise exception 'content recreated'; exception when insufficient_privilege then null; end;
  perform luna_retention_test.check_true(true,phase||': new content cannot recreate eligibility');
 end loop;
end $$;

select luna_retention_test.seed_fixture(interval '100 milliseconds','settled',false);
select pg_sleep(.12);
select luna_retention_test.check_true(public.luna_retention_purge_rpc('00000000-0000-4000-8000-000000000001')->>'status'='purged','capture-only pilot purges without inventing model spend');
select luna_retention_test.check_true((select total_exposure_nano_usd=269790750 and call_count=0 from luna_retention.retirement),'capture-only exposure unchanged');
select luna_retention_test.check_true((select tweet_url='https://x.com/reporter/status/123456789' from luna_retention.source_references),'capture-only URL preserved without approval');
select luna_retention_test.check_true(luna_retention.reconciliation_request_id(null,'{"requestId":"req_receipt-only","body":{"id":"response-id"}}')='req_receipt-only','receipt-level request identity retained');
select luna_retention_test.check_true(luna_retention.reconciliation_request_id('req_column',null)='req_column','column-only request identity retained');
select luna_retention_test.check_true(luna_retention.reconciliation_request_id('req_same','{"requestId":"req_same"}')='req_same','matching request identities accepted');
select luna_retention_test.check_true(luna_retention.reconciliation_request_id(null,'{"requestId":null,"body":{"id":"not-a-request-id"}}') is null,'missing request identity remains unknown');
do $$ declare bad text; begin
 foreach bad in array array['{"requestId":true}','{"requestId":42}','{"requestId":{}}','{"requestId":[]}',
  '{"requestId":""}','{"requestId":"bad id"}','{"requestId":"bad\\nline"}',jsonb_build_object('requestId',repeat('x',201))::text,'null','[]','invalid-json'] loop
  begin perform luna_retention.reconciliation_request_id(null,bad); raise exception 'malformed request ID accepted';
  exception when invalid_parameter_value then null; end;
  perform luna_retention_test.check_true(true,'malformed receipt request identity refused');
 end loop;
 begin perform luna_retention.reconciliation_request_id('bad id',null); raise exception 'malformed column ID accepted'; exception when invalid_parameter_value then null; end;
 perform luna_retention_test.check_true(true,'malformed column request identity refused');
 begin perform luna_retention.reconciliation_request_id('req_column','{"requestId":"req_different"}'); raise exception 'conflict accepted'; exception when invalid_parameter_value then null; end;
 perform luna_retention_test.check_true(true,'conflicting request identities require reconciliation');
end $$;

-- Each invalid URL reaches the real cleanup path and must preserve payloads.
do $$ declare bad text; pid uuid:='00000000-0000-4000-8000-000000000001'; begin
 foreach bad in array array['https://x.com/Other/status/123456789','https://x.com/Reporter/status/999',
  'https://x.com/Reporter/STATUS/123456789','https://evil.invalid/Reporter/status/123456789',
  'http://x.com/Reporter/status/123456789','https://x.com/Reporter/status/123456789#fragment'] loop
  perform luna_retention_test.seed_fixture(interval '100 milliseconds','settled',true,bad); perform pg_sleep(.12);
  begin perform public.luna_retention_purge_rpc(pid); raise exception 'bad source accepted'; exception when invalid_parameter_value then null; end;
  perform luna_retention_test.check_true((select count(*)=1 from luna_capture.receipts)
   and not exists(select 1 from luna_retention.retirement) and not exists(select 1 from luna_retention.source_references),
   'invalid source URL aborts purge transaction');
 end loop;
end $$;
select luna_retention_test.seed_fixture(interval '100 milliseconds');
insert into luna_retention.source_references select (luna_retention.source_reference(r,c)).*
 from luna_capture.receipts r join luna_capture.policy c on c.id=r.policy_id;
select pg_sleep(.12);
select luna_retention_test.check_true(public.luna_retention_purge_rpc('00000000-0000-4000-8000-000000000001')->>'status'='purged','identical existing URL reconciles');
select luna_retention_test.check_true((select count(*)=1 from luna_retention.source_references),'exact retry keeps one URL');
select luna_retention_test.seed_fixture(interval '100 milliseconds');
insert into luna_retention.source_references select r.id,c.id,'reporter','999','https://x.com/reporter/status/999',r.first_received_at,r.payload_sha256,'submitted_capture_metadata'
 from luna_capture.receipts r join luna_capture.policy c on c.id=r.policy_id;
select pg_sleep(.12);
do $$ begin
 begin perform public.luna_retention_purge_rpc('00000000-0000-4000-8000-000000000001'); raise exception 'conflicting URL accepted'; exception when invalid_parameter_value then null; end;
 perform luna_retention_test.check_true((select count(*)=1 from luna_capture.receipts) and not exists(select 1 from luna_retention.retirement)
  and (select not stopped and prior_exposure_nano_usd=269790750 from luna_hosted.policy),'conflicting URL rolls back purge and accounting');
end $$;


select luna_retention_test.seed_fixture(interval '1 hour');
do $$ declare r luna_capture.receipts%rowtype; c luna_capture.policy%rowtype; broken luna_capture.receipts%rowtype;
 e jsonb; variant text;
begin
 select * into r from luna_capture.receipts; select * into c from luna_capture.policy;
 foreach variant in array array['missing_url','nonstring_url','post_id','scope','raw_digest','received_time','receipt_time','repeat_raw_key'] loop
  broken:=r; e:=r.envelope_json::jsonb;
  case variant
   when 'missing_url' then e:=e#-'{submitted,link}';
   when 'nonstring_url' then e:=jsonb_set(e,'{submitted,link}','42');
   when 'post_id' then e:=jsonb_set(e,'{submitted,postId}','null');
   when 'scope' then e:=jsonb_set(e,'{scope,sourceAccount}','"Other"');
   when 'raw_digest' then e:=jsonb_set(e,'{payloadSha256}',to_jsonb(repeat('f',64)));
   when 'received_time' then e:=jsonb_set(e,'{receivedAt}','"now"');
   when 'receipt_time' then broken.first_received_at:=r.first_received_at+interval '1 second';
   when 'repeat_raw_key' then
    e:=jsonb_set(e,'{rawBody}',to_jsonb('{"text":"first","text":"second","link_to_tweet":"https://x.com/Reporter/status/123456789"}'::text));
    broken.payload_sha256:=encode(sha256(convert_to(e->>'rawBody','UTF8')),'hex');
    broken.byte_length:=octet_length(e->>'rawBody');
    e:=jsonb_set(jsonb_set(e,'{payloadSha256}',to_jsonb(broken.payload_sha256)),'{byteLength}',to_jsonb(broken.byte_length));
  end case;
  broken.envelope_json:=e::text;
  begin perform luna_retention.source_reference(broken,c); raise exception 'invalid projection accepted'; exception when invalid_parameter_value then null; end;
  perform luna_retention_test.check_true(true,'invalid source projection rejected: '||variant);
 end loop;
end $$;
select luna_retention_test.seed_fixture(interval '100 milliseconds','settled',false,'HTTPS://WWW.TWITTER.COM:443/Reporter/status/123456789?tracking=SYNTHETIC_QUERY_SECRET');
select pg_sleep(.12);
select luna_retention_test.check_true(public.luna_retention_purge_rpc('00000000-0000-4000-8000-000000000001')->>'status'='purged','allowed URL variants normalize');
select luna_retention_test.check_true((select tweet_url='https://x.com/reporter/status/123456789' from luna_retention.source_references),'normalized reference remains usable');

select jsonb_build_object('directSqlChecks',count(*),'labels',jsonb_agg(label)) from luna_retention_test.checks;
