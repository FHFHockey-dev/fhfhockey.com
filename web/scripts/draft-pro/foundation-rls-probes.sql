begin;

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'draft-pro-owner@example.invalid', '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'draft-pro-other@example.invalid', '{}'::jsonb, '{}'::jsonb);

insert into public.user_entitlements (user_id, source_provider, entitlement_key, entitlement_status, effective_to)
values ('00000000-0000-4000-8000-000000000001', 'stripe', 'draft_pro_2026_27', 'inactive', now() - interval '1 hour');

insert into public.draft_pro_drafts (user_id, name, snapshot, snapshot_bytes)
values
  ('00000000-0000-4000-8000-000000000001', 'Owner payload', '{"private": true}'::jsonb, 17),
  ('00000000-0000-4000-8000-000000000002', 'Other payload', '{"private": true}'::jsonb, 17);

insert into storage.objects (bucket_id, name, owner)
values ('draft-pro-private-imports', 'owner/private.csv', '00000000-0000-4000-8000-000000000001');

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
    execute 'reset role';
  end loop;
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

select 'draft_pro_tables=' || count(*) || '; rls_enabled=' || count(*) filter (where relrowsecurity)
from pg_catalog.pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r' and relname like 'draft_pro_%';

select 'browser_table_privileges=' || count(*)
from information_schema.role_table_grants
where table_schema = 'public' and table_name like 'draft_pro_%'
  and grantee in ('anon', 'authenticated');

select 'service_role_table_privileges=' || count(*)
from information_schema.role_table_grants
where table_schema = 'public' and table_name like 'draft_pro_%'
  and grantee = 'service_role';

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
