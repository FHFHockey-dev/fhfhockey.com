begin;

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'draft-pro-owner@example.invalid', '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'draft-pro-other@example.invalid', '{}'::jsonb, '{}'::jsonb);

insert into public.user_entitlements (user_id, source_provider, entitlement_key, entitlement_status, effective_to)
values ('00000000-0000-4000-8000-000000000001', 'stripe', 'draft_pro', 'inactive', now() - interval '1 hour');

insert into public.draft_pro_drafts (user_id, name, snapshot, snapshot_bytes)
values
  ('00000000-0000-4000-8000-000000000001', 'Owner payload', '{"private": true}'::jsonb, 17),
  ('00000000-0000-4000-8000-000000000002', 'Other payload', '{"private": true}'::jsonb, 17);

insert into storage.objects (bucket_id, name, owner)
values ('draft-pro-private-imports', 'owner/private.csv', '00000000-0000-4000-8000-000000000001');

insert into storage.buckets (id, name, public)
values ('draft-pro-probe-other', 'draft-pro-probe-other', false);

create policy draft_pro_probe_generic_authenticated on storage.objects
  for all to authenticated using (true) with check (true);
create policy draft_pro_probe_generic_anon on storage.objects
  for all to anon using (true) with check (true);

do $$
declare
  subject_id uuid;
  storage_rows integer;
begin
  foreach subject_id in array array[
    '00000000-0000-4000-8000-000000000001'::uuid,
    '00000000-0000-4000-8000-000000000002'::uuid
  ] loop
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', subject_id::text, true);

    begin
      perform 1 from public.draft_pro_drafts;
      raise exception 'authenticated subject % unexpectedly read Draft Pro payload', subject_id;
    exception when insufficient_privilege then
      null;
    end;

    select count(*) into storage_rows
    from storage.objects
    where bucket_id = 'draft-pro-private-imports';
    if storage_rows <> 0 then
      raise exception 'authenticated subject % unexpectedly read private storage', subject_id;
    end if;
    begin
      insert into storage.objects (bucket_id, name, owner)
      values ('draft-pro-private-imports', 'blocked/' || subject_id || '.csv', subject_id);
      raise exception 'authenticated subject % unexpectedly wrote private storage', subject_id;
    exception when insufficient_privilege then
      null;
    end;
    insert into storage.objects (bucket_id, name, owner)
    values ('draft-pro-probe-other', 'allowed/' || subject_id || '.csv', subject_id);
    delete from storage.objects
    where bucket_id = 'draft-pro-probe-other' and name = 'allowed/' || subject_id || '.csv';
    execute 'reset role';
  end loop;
end $$;

do $$
declare
  storage_rows integer;
begin
  execute 'set local role anon';
  select count(*) into storage_rows from storage.objects where bucket_id = 'draft-pro-private-imports';
  if storage_rows <> 0 then
    raise exception 'anon unexpectedly read private storage';
  end if;
  begin
    insert into storage.objects (bucket_id, name) values ('draft-pro-private-imports', 'blocked/anon.csv');
    raise exception 'anon unexpectedly wrote private storage';
  exception when insufficient_privilege then
    null;
  end;
  insert into storage.objects (bucket_id, name) values ('draft-pro-probe-other', 'allowed/anon.csv');
  delete from storage.objects where bucket_id = 'draft-pro-probe-other' and name = 'allowed/anon.csv';
  execute 'reset role';
end $$;

do $$
declare
  probe_draft_id uuid;
begin
  execute 'set local role service_role';
  insert into public.draft_pro_drafts (user_id, name, snapshot, snapshot_bytes)
  values ('00000000-0000-4000-8000-000000000001', 'Service probe', '{}'::jsonb, 2)
  returning id into probe_draft_id;
  update public.draft_pro_drafts set name = 'Service probe updated' where id = probe_draft_id;
  delete from public.draft_pro_drafts where id = probe_draft_id;
  insert into storage.objects (bucket_id, name, owner)
  values ('draft-pro-private-imports', 'service/probe.csv', '00000000-0000-4000-8000-000000000001');
  delete from storage.objects
  where bucket_id = 'draft-pro-private-imports' and name = 'service/probe.csv';
  execute 'reset role';
end $$;

do $$
declare
  draft_pro_tables integer;
  rls_enabled integer;
  browser_privileges integer;
  service_role_crud integer;
  private_policy_count integer;
  private_bucket_valid boolean;
begin
  select count(*), count(*) filter (where relrowsecurity)
  into draft_pro_tables, rls_enabled
  from pg_catalog.pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r' and relname like 'draft_pro_%';
  select count(*) into browser_privileges
  from information_schema.role_table_grants
  where table_schema = 'public' and table_name like 'draft_pro_%'
    and grantee in ('anon', 'authenticated');
  select count(*) into service_role_crud
  from pg_catalog.pg_class relation
  cross join unnest(array['select', 'insert', 'update', 'delete']) privilege
  where relation.relnamespace = 'public'::regnamespace and relation.relkind = 'r'
    and relation.relname like 'draft_pro_%'
    and has_table_privilege('service_role', relation.oid, privilege);
  select count(*) into private_policy_count
  from pg_policy
  where polrelid = 'storage.objects'::regclass
    and polname in (
      'draft_pro_private_imports_service_role',
      'draft_pro_private_imports_deny_authenticated',
      'draft_pro_private_imports_deny_anon'
    );
  select public = false and file_size_limit = 10485760
    and allowed_mime_types = array['text/csv', 'application/json']::text[]
  into private_bucket_valid
  from storage.buckets where id = 'draft-pro-private-imports';
  if draft_pro_tables <> 7 or rls_enabled <> 7 or browser_privileges <> 0
    or service_role_crud <> 28 or private_policy_count <> 3 or private_bucket_valid is not true then
    raise exception 'Draft Pro catalog boundary assertion failed: tables %, RLS %, browser grants %, service CRUD %, private policies %, bucket valid %',
      draft_pro_tables, rls_enabled, browser_privileges, service_role_crud, private_policy_count, private_bucket_valid;
  end if;
end $$;

select 'draft_pro_tables=' || count(*) || '; rls_enabled=' || count(*) filter (where relrowsecurity)
from pg_catalog.pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r' and relname like 'draft_pro_%';

select 'browser_table_privileges=' || count(*)
from information_schema.role_table_grants
where table_schema = 'public' and table_name like 'draft_pro_%'
  and grantee in ('anon', 'authenticated');

select 'service_role_crud=' || count(*)
from pg_catalog.pg_class relation
cross join unnest(array['select', 'insert', 'update', 'delete']) privilege
where relation.relnamespace = 'public'::regnamespace and relation.relkind = 'r'
  and relation.relname like 'draft_pro_%'
  and has_table_privilege('service_role', relation.oid, privilege);

select 'private_bucket=' || public || ':' || file_size_limit || ':' || array_to_string(allowed_mime_types, ',')
from storage.buckets where id = 'draft-pro-private-imports';

select 'private_storage_policies=' || count(*)
from pg_policy
where polrelid = 'storage.objects'::regclass
  and polname in (
    'draft_pro_private_imports_service_role',
    'draft_pro_private_imports_deny_authenticated',
    'draft_pro_private_imports_deny_anon'
  );

rollback;
