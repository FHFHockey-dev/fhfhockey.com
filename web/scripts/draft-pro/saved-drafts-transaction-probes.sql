begin;

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000021', 'authenticated', 'authenticated', 'draft-owner@example.invalid', '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000022', 'authenticated', 'authenticated', 'draft-other@example.invalid', '{}'::jsonb, '{}'::jsonb);

do $$
declare
  save_id uuid;
  upload_id uuid;
  prefix text;
  saved_draft_id uuid;
  version integer;
begin
  select save_session_id into save_id from public.begin_draft_pro_save_session('00000000-0000-4000-8000-000000000021'::uuid, null, null, 'probe-attempt-1');
  select upload_id, storage_prefix into upload_id, prefix from public.begin_draft_pro_private_import_upload('00000000-0000-4000-8000-000000000021', save_id, null, 1024, 'Normalized import', 'application/json', '{}'::jsonb);
  perform public.stage_draft_pro_private_import_upload('00000000-0000-4000-8000-000000000021', upload_id, array[prefix || '/0'], 512, 2, repeat('a', 64));
  select draft_id, lock_version into saved_draft_id, version from public.commit_draft_pro_save_session('00000000-0000-4000-8000-000000000021', save_id, 'Atomic draft', '{}'::jsonb, 2, '{}'::uuid[]);
  if version <> 0 or not exists (select 1 from public.draft_pro_private_imports i where i.draft_id = saved_draft_id and deleted_at is null) then
    raise exception 'saved draft commit did not atomically create the import link';
  end if;
  if not exists (select 1 from public.duplicate_draft_pro_saved_draft('00000000-0000-4000-8000-000000000021', saved_draft_id, version, 'Copy') where status = 'saved') then
    raise exception 'duplicate did not preserve a linked draft';
  end if;
  if not exists (select 1 from public.begin_draft_pro_save_session('00000000-0000-4000-8000-000000000021', saved_draft_id, version + 1, 'probe-attempt-2') where status = 'conflict') then
    raise exception 'expected-version conflict was not returned';
  end if;
  if exists (select 1 from public.list_draft_pro_saved_drafts('00000000-0000-4000-8000-000000000022')) then
    raise exception 'owner isolation failed';
  end if;
end $$;

rollback;
