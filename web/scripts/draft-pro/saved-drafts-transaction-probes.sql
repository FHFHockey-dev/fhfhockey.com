begin;

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000021', 'authenticated', 'authenticated', 'draft-owner@example.invalid', '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000022', 'authenticated', 'authenticated', 'draft-other@example.invalid', '{}'::jsonb, '{}'::jsonb);

do $$
declare
  save_id uuid;
  saved_upload_id uuid;
  prefix text;
  saved_draft_id uuid;
  copy_draft_id uuid;
  version integer;
  copy_version integer;
  replacement_save_id uuid;
  replacement_upload_id uuid;
  replacement_prefix text;
  filler_draft_id uuid;
  filler_blob_id uuid;
  expired_save_id uuid;
  expired_upload_id uuid;
  expired_prefix text;
  expired_cleanup_paths jsonb;
  expired_cleanup_final text;
  expired_cleanup_delete boolean;
  expired_status text;
  active_import_id uuid;
  ordinal integer;
begin
  select save_session_id into save_id from public.begin_draft_pro_save_session('00000000-0000-4000-8000-000000000021'::uuid, null, null, 'probe-attempt-1');
  select u.upload_id, u.storage_prefix into saved_upload_id, prefix from public.begin_draft_pro_private_import_upload('00000000-0000-4000-8000-000000000021', save_id, null, 1024, 'Normalized import', 'application/json', '{}'::jsonb) as u;
  perform public.stage_draft_pro_private_import_upload('00000000-0000-4000-8000-000000000021', saved_upload_id, array[prefix || '/0'], 512, 2, repeat('a', 64));
  select draft_id, lock_version into saved_draft_id, version from public.commit_draft_pro_save_session('00000000-0000-4000-8000-000000000021', save_id, 'Atomic draft', '{}'::jsonb, 2, '{}'::uuid[]);
  if version <> 0 or not exists (select 1 from public.draft_pro_private_imports i where i.draft_id = saved_draft_id and deleted_at is null) then
    raise exception 'saved draft commit did not atomically create the import link';
  end if;
  select draft_id, lock_version into copy_draft_id, copy_version from public.duplicate_draft_pro_saved_draft('00000000-0000-4000-8000-000000000021', saved_draft_id, version, 'Copy');
  if copy_draft_id is null then
    raise exception 'duplicate did not preserve a linked draft';
  end if;
  select lock_version into version from public.rename_draft_pro_saved_draft('00000000-0000-4000-8000-000000000021', saved_draft_id, version, 'Renamed atomic draft') where status='saved';
  if version <> 1 then raise exception 'rename update path did not increment lock version'; end if;
  if not exists (select 1 from public.delete_draft_pro_saved_draft('00000000-0000-4000-8000-000000000021', copy_draft_id, copy_version) where status='deleted') then raise exception 'delete update path did not execute'; end if;
  if not exists (select 1 from public.begin_draft_pro_save_session('00000000-0000-4000-8000-000000000021', null, null, 'probe-attempt-1') where status='saved' and current_version=version) then raise exception 'committed attempt retry did not return its actual version'; end if;
  begin
    perform public.begin_draft_pro_save_session('00000000-0000-4000-8000-000000000021', saved_draft_id, version, 'probe-attempt-1');
    raise exception 'mismatched committed attempt was accepted';
  exception when others then
    if sqlerrm <> 'Draft Pro save attempt does not match its original request' then raise; end if;
  end;
  select save_session_id into replacement_save_id from public.begin_draft_pro_save_session('00000000-0000-4000-8000-000000000021', saved_draft_id, version, 'probe-attempt-replacement');
  begin
    perform public.commit_draft_pro_save_session('00000000-0000-4000-8000-000000000021', replacement_save_id, 'bad retained ID', '{}'::jsonb, 2, array['00000000-0000-4000-8000-000000000099'::uuid]);
    raise exception 'unknown retained import ID was accepted';
  exception when others then
    if sqlerrm <> 'Retained private import was not found' then raise; end if;
  end;
  insert into public.draft_pro_drafts(user_id,name,snapshot,snapshot_bytes) values('00000000-0000-4000-8000-000000000021','Quota filler','{}'::jsonb,2) returning id into filler_draft_id;
  for ordinal in 1..10 loop
    insert into public.draft_pro_private_import_blobs(user_id,storage_path,byte_size,row_count,content_sha256)
    values ('00000000-0000-4000-8000-000000000021','probe-filler/' || ordinal::text,case when ordinal=10 then 10485248 else 10485760 end,0,repeat('b',64)) returning id into filler_blob_id;
    insert into public.draft_pro_private_imports(user_id,draft_id,name,content_type,storage_path,normalized_rows,mapping,byte_size,row_count,blob_id)
    select '00000000-0000-4000-8000-000000000021',filler_draft_id,'filler','application/json','probe-filler/' || ordinal::text,'[]'::jsonb,'{}'::jsonb,b.byte_size,0,b.id from public.draft_pro_private_import_blobs as b where b.id=filler_blob_id;
  end loop;
  select u.upload_id,u.storage_prefix into replacement_upload_id,replacement_prefix from public.begin_draft_pro_private_import_upload('00000000-0000-4000-8000-000000000021', replacement_save_id, (select i.id from public.draft_pro_private_imports as i where i.draft_id=saved_draft_id and i.deleted_at is null limit 1), 512, 'Replacement', 'application/json', '{}'::jsonb) as u;
  perform public.stage_draft_pro_private_import_upload('00000000-0000-4000-8000-000000000021', replacement_upload_id, array[replacement_prefix || '/0'], 512, 2, repeat('c',64));
  if not exists (select 1 from public.commit_draft_pro_save_session('00000000-0000-4000-8000-000000000021', replacement_save_id, 'Replacement at cap', '{}'::jsonb, 2, '{}'::uuid[]) where status='saved') then raise exception 'same-size replacement at account cap did not commit'; end if;
  select save_session_id into expired_save_id from public.begin_draft_pro_save_session('00000000-0000-4000-8000-000000000021', saved_draft_id, version + 1, 'probe-attempt-expired-upload');
  select u.upload_id,u.storage_prefix into expired_upload_id,expired_prefix from public.begin_draft_pro_private_import_upload('00000000-0000-4000-8000-000000000021', expired_save_id, (select i.id from public.draft_pro_private_imports as i where i.draft_id=saved_draft_id and i.deleted_at is null limit 1), 512, 'Expired pre-stage', 'application/json', '{}'::jsonb) as u;
  update public.draft_pro_private_import_uploads as u set expires_at=now()-interval '1 second' where u.id=expired_upload_id;
  select u.status into expired_status from public.draft_pro_private_import_uploads as u where u.id=expired_upload_id;
  select c.chunk_paths,c.final_storage_path,c.delete_final into expired_cleanup_paths,expired_cleanup_final,expired_cleanup_delete from public.claim_draft_pro_private_import_upload_cleanup('00000000-0000-4000-8000-000000000021',100) as c where c.upload_id=expired_upload_id;
  if expired_cleanup_delete is not true or jsonb_array_length(expired_cleanup_paths)<>32 or expired_cleanup_final<>'draft-pro-imports/' || expired_upload_id::text || '/normalized.json' then raise exception 'expired pre-stage upload cleanup did not return derived paths (% % %; before=%)',expired_cleanup_delete,expired_cleanup_paths,expired_cleanup_final,expired_status; end if;
  if not exists (select 1 from public.begin_draft_pro_save_session('00000000-0000-4000-8000-000000000021', saved_draft_id, version + 2, 'probe-attempt-2') where status = 'conflict') then
    raise exception 'expected-version conflict was not returned';
  end if;
  if exists (select 1 from public.list_draft_pro_saved_drafts('00000000-0000-4000-8000-000000000022')) then
    raise exception 'owner isolation failed';
  end if;
  select i.id into active_import_id from public.draft_pro_private_imports as i where i.draft_id=saved_draft_id and i.deleted_at is null limit 1;
  if not exists (select 1 from public.read_draft_pro_private_import_blob('00000000-0000-4000-8000-000000000021',saved_draft_id,active_import_id))
    or exists (select 1 from public.read_draft_pro_private_import_blob('00000000-0000-4000-8000-000000000022',saved_draft_id,active_import_id)) then raise exception 'private import blob ownership failed'; end if;
end $$;

rollback;
