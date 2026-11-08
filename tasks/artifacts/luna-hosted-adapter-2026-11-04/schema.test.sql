-- UNEXECUTED assertions for an explicitly approved disposable PostgreSQL database.
-- Requires schema.sql already installed and roles anon/authenticated/service_role.
-- Never point at a hosted or shared database. Every synthetic row rolls back.
-- These tests do not establish the deployed retention schema or source authenticity.
begin;
insert into luna_hosted.policy values
  (true,'synthetic-only',true,false,clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour',2,466000000,0);
insert into luna_hosted.sources values
  ('synthetic-1','{"id":"synthetic-1"}',repeat('a',64),'fictional test receipt'),
  ('synthetic-2','{"id":"synthetic-2"}',repeat('b',64),'fictional test receipt');
insert into luna_hosted.jobs(id,approval_id,receipt_id,input_json,input_hash,reference_hash) values
  ('00000000-0000-4000-8000-000000000001','synthetic-only','synthetic-1','{}',repeat('1',64),repeat('a',64)),
  ('00000000-0000-4000-8000-000000000002','synthetic-only','synthetic-2','{}',repeat('2',64),repeat('a',64));
do $$
declare r jsonb; id uuid := '00000000-0000-4000-8000-000000000001';
  id2 uuid := '00000000-0000-4000-8000-000000000002';
  payload jsonb := jsonb_build_object('key',repeat('c',64),'amountNanoUsd',233000000);
  review jsonb := '{"review":{"status":"held","canPublish":false,"canChangeStatus":false,"canWriteAliases":false,"canExecuteReplacement":false},"candidate":null}';
begin
  if has_table_privilege('service_role','luna_hosted.jobs','INSERT') is distinct from false
    or has_table_privilege('anon','luna_hosted.jobs','SELECT') is distinct from false
    or has_function_privilege('authenticated','public.luna_hosted_review_rpc(text,uuid,jsonb)','EXECUTE') is distinct from false
    or has_function_privilege('anon','luna_hosted.review_rpc(text,uuid,jsonb)','EXECUTE') is distinct from false then
    raise exception 'Unexpected public/client privilege';
  end if;
  if (select prosecdef from pg_proc where oid = 'public.luna_hosted_review_rpc(text,uuid,jsonb)'::regprocedure) is distinct from false then
    raise exception 'Public wrapper must be invoker';
  end if;
  if (select count(*) from pg_class where relnamespace='luna_hosted'::regnamespace and relkind='r') is distinct from 4
    or exists(select 1 from pg_class where relnamespace='luna_hosted'::regnamespace and relkind='r' and not relrowsecurity) then
    raise exception 'RLS missing';
  end if;
  update luna_hosted.policy set enabled=false;
  r := public.luna_hosted_review_rpc('claim',id,'{}');
  if r->>'status' is distinct from 'refused' then raise exception 'disabled policy admitted'; end if;
  update luna_hosted.policy set enabled=true,expires_at=clock_timestamp()-interval '1 second';
  r := public.luna_hosted_review_rpc('claim',id,'{}');
  if r->>'status' is distinct from 'refused' then raise exception 'expired policy admitted'; end if;
  update luna_hosted.policy set expires_at=clock_timestamp()+interval '1 hour';
  r := public.luna_hosted_review_rpc('claim',id,'{}');
  if r->>'status' is distinct from 'claimed' then raise exception 'eligible claim refused'; end if;
  r := public.luna_hosted_review_rpc('claim',id,'{}');
  if r->>'status' is distinct from 'refused' then raise exception 'duplicate running claim admitted'; end if;
  r := public.luna_hosted_review_rpc('claim',id2,'{}');
  if r->>'status' is distinct from 'refused' then raise exception 'second job admitted while running'; end if;
  update luna_hosted.policy set cap_nano_usd=233000000,prior_exposure_nano_usd=1;
  r := public.luna_hosted_review_rpc('reserve',id,payload);
  if r->>'status' is distinct from 'refused' or exists(select 1 from luna_hosted.attempts) then raise exception 'prior exposure omitted'; end if;
  update luna_hosted.policy set prior_exposure_nano_usd=0;
  r := public.luna_hosted_review_rpc('reserve',id,payload);
  if r->>'status' is distinct from 'reserved' then raise exception 'reservation failed'; end if;
  r := public.luna_hosted_review_rpc('reserve',id,payload);
  if r->>'status' is distinct from 'refused' or (select count(*) from luna_hosted.attempts) is distinct from 1 then raise exception 'duplicate charged'; end if;
  r := public.luna_hosted_review_rpc('uncertain',id,payload || '{"requestId":"synthetic-request"}');
  if r->>'status' is distinct from 'held' or (select stopped from luna_hosted.policy) is distinct from true
    or (select state from luna_hosted.attempts where job_id=id) is distinct from 'uncertain'
    or (select reserved_nano_usd from luna_hosted.attempts where job_id=id) is distinct from 233000000 then
    raise exception 'uncertainty did not retain reservation and stop';
  end if;
  r := public.luna_hosted_review_rpc('finish',id,jsonb_build_object('resultJson',review::text));
  if r->>'status' is distinct from 'held' then raise exception 'held result not saved'; end if;
  r := public.luna_hosted_review_rpc('claim',id,'{}');
  if r->>'status' is distinct from 'held' or r ? 'job' then raise exception 'terminal replay leaked content'; end if;
  r := public.luna_hosted_review_rpc('claim',id2,'{}');
  if r->>'status' is distinct from 'refused' then raise exception 'stopped policy admitted'; end if;
end $$;
rollback;

-- Separate rollback-only settlement/replay fixture.
begin;
insert into luna_hosted.policy values
  (true,'synthetic-only',true,false,clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour',1,233000000,0);
insert into luna_hosted.sources values ('synthetic','{"id":"synthetic"}',repeat('a',64),'fictional test receipt');
insert into luna_hosted.jobs(id,approval_id,receipt_id,input_json,input_hash,reference_hash) values
  ('00000000-0000-4000-8000-000000000001','synthetic-only','synthetic','{}',repeat('1',64),repeat('a',64)),
  ('00000000-0000-4000-8000-000000000002','synthetic-only','synthetic','{}',repeat('2',64),repeat('a',64));
do $$
declare id uuid := '00000000-0000-4000-8000-000000000001';
  id2 uuid := '00000000-0000-4000-8000-000000000002'; r jsonb;
  payload jsonb := jsonb_build_object('key',repeat('c',64),'amountNanoUsd',233000000);
  receipt jsonb := '{"endpoint":"responses","requestId":"synthetic","chargeNanoUsd":38500,"body":{"model":"gpt-6-luna","usage":{"input_tokens":100,"output_tokens":50}}}';
  review jsonb := '{"review":{"status":"review_only","canPublish":false,"canChangeStatus":false,"canWriteAliases":false,"canExecuteReplacement":false},"candidate":null}';
begin
  r := public.luna_hosted_review_rpc('claim',id,'{}');
  if r->>'status' is distinct from 'claimed' then raise exception 'fixture claim failed'; end if;
  r := public.luna_hosted_review_rpc('reserve',id,payload);
  if r->>'status' is distinct from 'reserved' then raise exception 'fixture reservation failed'; end if;
  r := public.luna_hosted_review_rpc('settle',id,jsonb_build_object('key',repeat('c',64),'receiptJson',receipt::text));
  if r->>'status' is distinct from 'settled' then raise exception 'settlement failed'; end if;
  r := public.luna_hosted_review_rpc('reserve',id,payload);
  if r->>'status' is distinct from 'replay' or r->>'receiptJson' is distinct from receipt::text then raise exception 'settled receipt replay failed'; end if;
  r := public.luna_hosted_review_rpc('finish',id,jsonb_build_object('resultJson',review::text));
  if r->>'status' is distinct from 'completed' then raise exception 'completion failed'; end if;
  r := public.luna_hosted_review_rpc('claim',id,'{}');
  if r->>'status' is distinct from 'completed' or r ? 'job' then raise exception 'completion duplicate failed'; end if;
  r := public.luna_hosted_review_rpc('claim',id2,'{}');
  if r->>'status' is distinct from 'claimed' then raise exception 'second fixture claim failed'; end if;
  r := public.luna_hosted_review_rpc('reserve',id2,jsonb_build_object('key',repeat('d',64),'amountNanoUsd',233000000));
  if r->>'status' is distinct from 'refused' then raise exception 'call cap not enforced'; end if;
  r := public.luna_hosted_review_rpc('uncertain',id,jsonb_build_object('key',repeat('c',64)));
  if r->>'status' is distinct from 'held' then raise exception 'uncertainty fixture failed'; end if;
  if (select receipt_json from luna_hosted.attempts where job_id=id) is distinct from receipt::text
    or (select state from luna_hosted.attempts where job_id=id) is distinct from 'settled' then raise exception 'settled receipt erased'; end if;
end $$;
rollback;

-- Direct RPC accounting attacks bypass the TypeScript usage validator. Reported
-- charges remain advisory: even accepted malformed usage must not free budget.
-- UNEXECUTED, disposable database only. All owner fixture resets roll back.
begin;
do $$
declare
  id uuid := 'f40f38e5-03dd-4f70-a0a2-7934a49fc5c6';
  id2 uuid := '00000000-0000-4000-8000-000000000002';
  body jsonb; receipt jsonb; r jsonb;
  payload jsonb := jsonb_build_object('key',repeat('c',64),'amountNanoUsd',233000000);
  review jsonb := '{"review":{"status":"review_only","canPublish":false,"canChangeStatus":false,"canWriteAliases":false,"canExecuteReplacement":false},"candidate":null}';
begin
  for body in select value from jsonb_array_elements('[
    {"model":"gpt-6-luna","usage":{"input_tokens":100,"output_tokens":50}},
    {"model":"gpt-6-luna"},
    {"model":"gpt-6-luna","usage":null},
    {"model":"gpt-6-luna","usage":{"input_tokens":"bogus","output_tokens":-1}},
    {"model":"gpt-6-luna","usage":{"input_tokens":9007199254740991,"output_tokens":2048}}
  ]'::jsonb) loop
    delete from luna_hosted.attempts;
    delete from luna_hosted.jobs;
    delete from luna_hosted.sources;
    delete from luna_hosted.policy;
    -- Two calls allowed by count, but exactly one full reservation by money.
    insert into luna_hosted.policy values
      (true,'synthetic-only',true,false,clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour',2,233000000,0);
    insert into luna_hosted.sources values ('synthetic','{"id":"synthetic"}',repeat('a',64),'fictional test receipt');
    insert into luna_hosted.jobs(id,approval_id,receipt_id,input_json,input_hash,reference_hash) values
      (id,'synthetic-only','synthetic','{}',repeat('1',64),repeat('a',64)),
      (id2,'synthetic-only','synthetic','{}',repeat('2',64),repeat('a',64));
    r := public.luna_hosted_review_rpc('claim',upper(id::text)::uuid,'{}');
    if r->>'status' is distinct from 'claimed' or r->>'jobId' is distinct from id::text then
      raise exception 'canonical claim failed';
    end if;
    r := public.luna_hosted_review_rpc('reserve',id,payload);
    if r->>'status' is distinct from 'reserved' then raise exception 'first reserve failed'; end if;
    receipt := jsonb_build_object('endpoint','responses','requestId','synthetic','chargeNanoUsd',0,'body',body);
    r := public.luna_hosted_review_rpc('settle',id,jsonb_build_object('key',repeat('c',64),'receiptJson',receipt::text));
    if r->>'status' is distinct from 'settled' then raise exception 'advisory settlement failed'; end if;
    if (select sum(reserved_nano_usd) from luna_hosted.attempts) is distinct from 233000000
      or (select charge_nano_usd from luna_hosted.attempts where job_id=id) is distinct from 0 then
      raise exception 'settlement changed full reservation';
    end if;
    r := public.luna_hosted_review_rpc('finish',id,jsonb_build_object('resultJson',review::text));
    if r->>'status' is distinct from 'completed' then raise exception 'fixture completion failed'; end if;
    r := public.luna_hosted_review_rpc('claim',id2,'{}');
    if r->>'status' is distinct from 'claimed' then raise exception 'second claim failed'; end if;
    r := public.luna_hosted_review_rpc('reserve',id2,jsonb_build_object('key',repeat('d',64),'amountNanoUsd',233000000));
    if r->>'status' is distinct from 'refused'
      or (select count(*) from luna_hosted.attempts) is distinct from 1 then
      raise exception 'understated/malformed usage created spending room';
    end if;
  end loop;
end $$;
rollback;
