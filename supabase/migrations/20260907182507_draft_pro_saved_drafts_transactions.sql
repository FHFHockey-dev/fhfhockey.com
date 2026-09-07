-- Saved Drafts keep lightweight snapshots in Postgres and normalized imports in
-- the private bucket. Blob ownership is separate from draft links so replacing,
-- duplicating, and deleting drafts cannot orphan or double-charge imports.
alter table public.draft_pro_drafts drop constraint draft_pro_drafts_status_check;
alter table public.draft_pro_drafts add constraint draft_pro_drafts_status_check check (status in ('active', 'archived', 'deleted'));
alter table public.draft_pro_private_imports drop constraint draft_pro_private_imports_storage_path_key;
alter table public.draft_pro_private_imports add column blob_id uuid;
alter table public.draft_pro_private_imports add column deleted_at timestamptz;

create table public.draft_pro_private_import_blobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) between 1 and 500),
  byte_size integer not null check (byte_size between 1 and 10485760),
  row_count integer not null check (row_count between 0 and 100000),
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'active' check (status in ('active', 'cleanup_pending', 'deleted')),
  created_at timestamptz not null default now(),
  cleanup_requested_at timestamptz,
  cleanup_lease_id uuid,
  deleted_at timestamptz
);
alter table public.draft_pro_private_imports add constraint draft_pro_private_imports_blob_id_fkey foreign key (blob_id) references public.draft_pro_private_import_blobs(id) on delete restrict;
create index draft_pro_private_imports_blob_id_idx on public.draft_pro_private_imports(blob_id) where deleted_at is null;

create table public.draft_pro_save_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_id uuid references public.draft_pro_drafts(id) on delete cascade,
  requested_draft_id uuid references public.draft_pro_drafts(id) on delete set null,
  attempt_key text not null check (char_length(attempt_key) between 1 and 120),
  expected_version integer,
  status text not null default 'pending' check (status in ('pending', 'committed', 'expired')),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index draft_pro_one_pending_save_per_draft on public.draft_pro_save_sessions(user_id, draft_id) where draft_id is not null and status = 'pending';
create unique index draft_pro_save_sessions_attempt_key_unique on public.draft_pro_save_sessions(user_id, attempt_key) where status <> 'expired';

create table public.draft_pro_private_import_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  save_session_id uuid not null references public.draft_pro_save_sessions(id) on delete cascade,
  replacement_import_id uuid references public.draft_pro_private_imports(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  content_type text not null check (content_type in ('text/csv', 'application/json')),
  mapping jsonb not null default '{}'::jsonb,
  declared_max_bytes integer not null check (declared_max_bytes between 1 and 10485760),
  reserved_bytes integer not null check (reserved_bytes between 0 and 10485760),
  actual_bytes integer check (actual_bytes between 1 and 10485760),
  row_count integer check (row_count between 0 and 100000),
  content_sha256 text check (content_sha256 ~ '^[a-f0-9]{64}$'),
  storage_prefix text not null unique,
  final_storage_path text unique,
  chunk_paths jsonb not null default '[]'::jsonb,
  cleanup_requested_at timestamptz,
  cleaned_at timestamptz,
  status text not null default 'uploading' check (status in ('uploading', 'staged', 'committed', 'expired', 'cleaned')),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index draft_pro_private_import_uploads_owner_status_idx on public.draft_pro_private_import_uploads(user_id, status, expires_at);
create unique index draft_pro_one_replacement_claim_per_save on public.draft_pro_private_import_uploads(save_session_id, replacement_import_id) where replacement_import_id is not null and status in ('uploading', 'staged');

alter table public.draft_pro_private_import_blobs enable row level security;
alter table public.draft_pro_save_sessions enable row level security;
alter table public.draft_pro_private_import_uploads enable row level security;
revoke all on table public.draft_pro_private_import_blobs, public.draft_pro_save_sessions, public.draft_pro_private_import_uploads from anon, authenticated;
grant select, insert, update, delete on table public.draft_pro_private_import_blobs, public.draft_pro_save_sessions, public.draft_pro_private_import_uploads to service_role;
create trigger draft_pro_save_sessions_touch_updated_at before update on public.draft_pro_save_sessions for each row execute function public.update_updated_at_column();
create trigger draft_pro_private_import_uploads_touch_updated_at before update on public.draft_pro_private_import_uploads for each row execute function public.update_updated_at_column();

create or replace function public.begin_draft_pro_save_session(p_user_id uuid, p_draft_id uuid, p_expected_version integer, p_attempt_key text)
returns table(status text, save_session_id uuid, draft_id uuid, current_version integer, expires_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp as $$
declare draft public.draft_pro_drafts%rowtype; session_row public.draft_pro_save_sessions%rowtype; draft_count integer;
begin
  if p_user_id is null or p_attempt_key is null or char_length(p_attempt_key) not between 1 and 120 then raise exception 'Draft Pro save attempt is required'; end if;
  perform pg_advisory_xact_lock(hashtext('draft-pro-quota:' || p_user_id::text));
  update public.draft_pro_save_sessions as s set status = 'expired' where s.user_id = p_user_id and s.status = 'pending' and s.expires_at <= now();
  select s.* into session_row from public.draft_pro_save_sessions as s where s.user_id=p_user_id and s.attempt_key=p_attempt_key for update;
  if found then
    if session_row.requested_draft_id is distinct from p_draft_id or session_row.expected_version is distinct from p_expected_version then raise exception 'Draft Pro save attempt does not match its original request'; end if;
    if session_row.status='committed' then
      select d.* into draft from public.draft_pro_drafts as d where d.id=session_row.draft_id and d.user_id=p_user_id;
      return query select 'saved',session_row.id,session_row.draft_id,coalesce(draft.lock_version,0),session_row.expires_at; return;
    end if;
    if session_row.status='pending' and session_row.expires_at>now() then return query select 'ready',session_row.id,session_row.draft_id,coalesce(session_row.expected_version,0),session_row.expires_at; return; end if;
  end if;
  if p_draft_id is not null then
    select d.* into draft from public.draft_pro_drafts as d where d.id = p_draft_id and d.user_id = p_user_id and d.status <> 'deleted' for update;
    if not found then raise exception 'Draft was not found'; end if;
    if p_expected_version is null or p_expected_version <> draft.lock_version then return query select 'conflict', null::uuid, draft.id, draft.lock_version, null::timestamptz; return; end if;
    select s.* into session_row from public.draft_pro_save_sessions as s where s.user_id = p_user_id and s.draft_id = p_draft_id and s.status = 'pending' for update;
    if found then return query select 'busy', null::uuid, draft.id, draft.lock_version, session_row.expires_at; return; end if;
  else
    if p_expected_version is not null then raise exception 'New draft cannot have an expected version'; end if;
    select count(*) into draft_count from public.draft_pro_drafts as d where d.user_id = p_user_id and d.status <> 'deleted';
    if draft_count >= 10 then raise exception 'Draft Pro saved draft quota exceeded'; end if;
  end if;
  insert into public.draft_pro_save_sessions(user_id, draft_id, requested_draft_id, attempt_key, expected_version) values (p_user_id, p_draft_id, p_draft_id, p_attempt_key, p_expected_version) returning * into session_row;
  return query select 'ready', session_row.id, session_row.draft_id, coalesce(draft.lock_version, 0), session_row.expires_at;
end;
$$;

create or replace function public.begin_draft_pro_private_import_upload(
  p_user_id uuid, p_save_session_id uuid, p_replacement_import_id uuid, p_declared_max_bytes integer, p_name text, p_content_type text, p_mapping jsonb
) returns table(status text, upload_id uuid, storage_prefix text, reserved_bytes integer, expires_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp as $$
declare session_row public.draft_pro_save_sessions%rowtype; replacement public.draft_pro_private_imports%rowtype; reclaimable integer := 0; reservation integer; account_bytes bigint; pending_bytes bigint; cleanup_bytes bigint; upload public.draft_pro_private_import_uploads%rowtype;
begin
  if p_user_id is null or p_declared_max_bytes not between 1 and 10485760 or p_name is null or char_length(btrim(p_name)) not between 1 and 160 or p_content_type not in ('text/csv','application/json') then raise exception 'Invalid private import upload request'; end if;
  perform pg_advisory_xact_lock(hashtext('draft-pro-quota:' || p_user_id::text));
  update public.draft_pro_private_import_uploads as u set status = 'expired' where u.user_id = p_user_id and u.status in ('uploading', 'staged') and u.expires_at <= now();
  select s.* into session_row from public.draft_pro_save_sessions as s where s.id = p_save_session_id and s.user_id = p_user_id and s.status = 'pending' and s.expires_at > now() for update;
  if not found then raise exception 'Draft Pro save session is unavailable'; end if;
  if p_replacement_import_id is not null then
    select i.* into replacement from public.draft_pro_private_imports as i where i.id = p_replacement_import_id and i.user_id = p_user_id and i.draft_id = session_row.draft_id and i.deleted_at is null for update;
    if not found then raise exception 'Replacement import was not found'; end if;
    if not exists (select 1 from public.draft_pro_private_imports where blob_id = replacement.blob_id and deleted_at is null and id <> replacement.id) then reclaimable := replacement.byte_size; end if;
  end if;
  reservation := greatest(p_declared_max_bytes - reclaimable, 0);
  select coalesce(sum(b.byte_size),0) into account_bytes from public.draft_pro_private_import_blobs as b where b.user_id = p_user_id and b.status = 'active';
  select coalesce(sum(u.reserved_bytes),0) into pending_bytes from public.draft_pro_private_import_uploads as u where u.user_id = p_user_id and u.status in ('uploading','staged') and u.expires_at > now();
  if account_bytes + pending_bytes + reservation > 104857600 then raise exception 'Draft Pro account import quota exceeded'; end if;
  select coalesce(sum(b.byte_size),0) into cleanup_bytes from public.draft_pro_private_import_blobs as b where b.user_id=p_user_id and b.status='cleanup_pending';
  select coalesce(sum(u.declared_max_bytes),0) into pending_bytes from public.draft_pro_private_import_uploads as u where u.user_id = p_user_id and (u.status in ('uploading','staged','expired') or (u.status='committed' and u.cleaned_at is null));
  if cleanup_bytes + pending_bytes + p_declared_max_bytes > 20971520 then raise exception 'Draft Pro temporary import cleanup quota exceeded'; end if;
  insert into public.draft_pro_private_import_uploads(user_id, save_session_id, replacement_import_id, name, content_type, mapping, declared_max_bytes, reserved_bytes, storage_prefix)
  values (p_user_id, session_row.id, p_replacement_import_id, btrim(p_name), p_content_type, coalesce(p_mapping,'{}'::jsonb), p_declared_max_bytes, reservation, '') returning * into upload;
  update public.draft_pro_private_import_uploads set storage_prefix = 'draft-pro-import-staging/' || p_user_id::text || '/' || upload.id::text where id = upload.id returning * into upload;
  return query select 'ready', upload.id, upload.storage_prefix, upload.reserved_bytes, upload.expires_at;
end;
$$;

create or replace function public.stage_draft_pro_private_import_upload(
  p_user_id uuid, p_upload_id uuid, p_chunk_paths text[], p_actual_bytes integer, p_row_count integer, p_content_sha256 text
) returns table(status text, upload_id uuid, storage_path text, expires_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp as $$
declare upload public.draft_pro_private_import_uploads%rowtype; parent_status text; parent_expires_at timestamptz; ordinal integer;
begin
  if p_user_id is null or p_chunk_paths is null or cardinality(p_chunk_paths) not between 1 and 32 or p_actual_bytes not between 1 and 10485760 or p_row_count not between 0 and 100000 or p_content_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'Invalid private import staging request'; end if;
  perform pg_advisory_xact_lock(hashtext('draft-pro-quota:' || p_user_id::text));
  select u.* into upload
  from public.draft_pro_private_import_uploads as u join public.draft_pro_save_sessions as s on s.id=u.save_session_id
  where u.id = p_upload_id and u.user_id = p_user_id and s.user_id=p_user_id for update of u,s;
  if not found then raise exception 'Private import parent session is unavailable'; end if;
  select s.status,s.expires_at into parent_status,parent_expires_at from public.draft_pro_save_sessions as s where s.id=upload.save_session_id for update;
  if parent_status<>'pending' or parent_expires_at<=now() then raise exception 'Private import parent session is unavailable'; end if;
  if p_actual_bytes > upload.declared_max_bytes then raise exception 'Private import upload is unavailable'; end if;
  for ordinal in 1..cardinality(p_chunk_paths) loop if p_chunk_paths[ordinal] <> upload.storage_prefix || '/' || (ordinal - 1)::text then raise exception 'Private import chunk path is not server-owned'; end if; end loop;
  if upload.status='staged' then
    if upload.chunk_paths=to_jsonb(p_chunk_paths) and upload.actual_bytes=p_actual_bytes and upload.row_count=p_row_count and upload.content_sha256=p_content_sha256 then return query select 'staged',upload.id,upload.final_storage_path,upload.expires_at; return; end if;
    raise exception 'Private import staged retry does not match';
  end if;
  if upload.status<>'uploading' or upload.expires_at<=now() then raise exception 'Private import upload is unavailable'; end if;
  update public.draft_pro_private_import_uploads set chunk_paths = to_jsonb(p_chunk_paths), actual_bytes = p_actual_bytes, row_count = p_row_count, content_sha256 = p_content_sha256, final_storage_path = 'draft-pro-imports/' || upload.id::text || '/normalized.json', status = 'staged', expires_at = now() + interval '2 hours' where id = upload.id returning * into upload;
  return query select 'staged', upload.id, upload.final_storage_path, upload.expires_at;
end;
$$;

-- The server calls this immediately before Storage I/O.  It is deliberately
-- ownership-scoped and returns only the server-derived staging namespace.
create or replace function public.read_draft_pro_private_import_upload(p_user_id uuid,p_upload_id uuid)
returns table(upload_id uuid,save_session_id uuid,draft_id uuid,status text,save_session_status text,save_session_expires_at timestamptz,storage_prefix text,final_storage_path text,chunk_paths jsonb,declared_max_bytes integer,actual_bytes integer,row_count integer,content_sha256 text,expires_at timestamptz)
language sql security definer set search_path = public, pg_temp as $$
  select u.id,u.save_session_id,s.draft_id,u.status,s.status,s.expires_at,u.storage_prefix,
    coalesce(u.final_storage_path,'draft-pro-imports/' || u.id::text || '/normalized.json'),u.chunk_paths,u.declared_max_bytes,u.actual_bytes,u.row_count,u.content_sha256,u.expires_at
  from public.draft_pro_private_import_uploads as u
  join public.draft_pro_save_sessions as s on s.id=u.save_session_id
  where u.id=p_upload_id and u.user_id=p_user_id and s.user_id=p_user_id;
$$;

create or replace function public.commit_draft_pro_save_session(
  p_user_id uuid, p_save_session_id uuid, p_name text, p_snapshot jsonb, p_snapshot_bytes integer, p_import_ids uuid[]
) returns table(status text, draft_id uuid, lock_version integer, name text, updated_at timestamptz, import_count integer, conflict_lock_version integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare session_row public.draft_pro_save_sessions%rowtype; draft public.draft_pro_drafts%rowtype; upload public.draft_pro_private_import_uploads%rowtype; replacement public.draft_pro_private_imports%rowtype; blob public.draft_pro_private_import_blobs%rowtype; draft_bytes bigint; draft_count integer; added_bytes bigint; reclaimed_bytes bigint; account_bytes bigint; pending_bytes bigint;
begin
  if p_user_id is null or p_name is null or char_length(btrim(p_name)) not between 1 and 120 or p_snapshot is null or p_snapshot_bytes not between 0 and 10485760 then raise exception 'Invalid saved draft request'; end if;
  perform pg_advisory_xact_lock(hashtext('draft-pro-quota:' || p_user_id::text));
  select s.* into session_row from public.draft_pro_save_sessions as s where s.id = p_save_session_id and s.user_id = p_user_id for update;
  if not found then raise exception 'Draft Pro save session was not found'; end if;
  if session_row.status='committed' then
    select d.* into draft from public.draft_pro_drafts as d where d.id=session_row.draft_id and d.user_id=p_user_id;
    select count(*) into draft_count from public.draft_pro_private_imports as i where i.draft_id=draft.id and i.deleted_at is null;
    return query select 'saved',draft.id,draft.lock_version,draft.name,draft.updated_at,draft_count,null::integer; return;
  end if;
  if session_row.status<>'pending' or session_row.expires_at<=now() then raise exception 'Draft Pro save session is unavailable'; end if;
  if exists (select 1 from public.draft_pro_private_import_uploads as u where u.save_session_id=session_row.id and u.status='uploading') then raise exception 'Private import upload is incomplete'; end if;
  if session_row.draft_id is null then
    select count(*) into draft_count from public.draft_pro_drafts as d where d.user_id = p_user_id and d.status <> 'deleted'; if draft_count >= 10 then raise exception 'Draft Pro saved draft quota exceeded'; end if;
    insert into public.draft_pro_drafts(user_id,name,snapshot,snapshot_bytes) values(p_user_id,btrim(p_name),p_snapshot,p_snapshot_bytes) returning * into draft;
    update public.draft_pro_save_sessions set draft_id = draft.id where id = session_row.id;
  else
    select d.* into draft from public.draft_pro_drafts as d where d.id = session_row.draft_id and d.user_id = p_user_id and d.status <> 'deleted' for update;
    if not found then raise exception 'Draft was not found'; end if;
    if draft.lock_version <> session_row.expected_version then return query select 'conflict', draft.id, draft.lock_version, draft.name, draft.updated_at, 0, draft.lock_version; return; end if;
    update public.draft_pro_drafts as d set name=btrim(p_name),snapshot=p_snapshot,snapshot_bytes=p_snapshot_bytes,lock_version=d.lock_version+1 where d.id=draft.id returning * into draft;
  end if;
  if exists (select 1 from unnest(coalesce(p_import_ids,'{}'::uuid[])) as requested(requested_id) where requested.requested_id is null)
    or cardinality(coalesce(p_import_ids,'{}'::uuid[])) <> (select count(distinct requested.requested_id) from unnest(coalesce(p_import_ids,'{}'::uuid[])) as requested(requested_id)) then raise exception 'Duplicate retained import IDs are not allowed'; end if;
  if cardinality(coalesce(p_import_ids,'{}'::uuid[])) <> (select count(*) from public.draft_pro_private_imports as i where i.id=any(coalesce(p_import_ids,'{}'::uuid[])) and i.user_id=p_user_id and i.draft_id=draft.id and i.deleted_at is null) then raise exception 'Retained private import was not found'; end if;
  if exists (select 1 from public.draft_pro_private_import_uploads as u where u.save_session_id=session_row.id and u.status='staged' and u.replacement_import_id=any(coalesce(p_import_ids,'{}'::uuid[]))) then raise exception 'Replacement imports cannot also be retained'; end if;
  select coalesce(sum(i.byte_size),0) into draft_bytes from public.draft_pro_private_imports as i where i.id=any(coalesce(p_import_ids,'{}'::uuid[])) and i.deleted_at is null;
  select coalesce(sum(u.actual_bytes),0) into added_bytes from public.draft_pro_private_import_uploads as u where u.save_session_id = session_row.id and u.status = 'staged';
  if draft_bytes + added_bytes > 10485760 then raise exception 'Draft Pro draft import quota exceeded'; end if;
  for upload in select u.* from public.draft_pro_private_import_uploads as u where u.save_session_id = session_row.id and u.status = 'staged' for update loop
    if upload.replacement_import_id is not null then
      select i.* into replacement from public.draft_pro_private_imports as i where i.id=upload.replacement_import_id and i.user_id=p_user_id and i.draft_id=draft.id and i.deleted_at is null for update;
      if not found then raise exception 'Replacement import was not found'; end if;
      update public.draft_pro_private_imports as i set deleted_at=now() where i.id=replacement.id;
    end if;
  end loop;
  update public.draft_pro_private_imports as i set deleted_at=now()
  where i.draft_id=draft.id and i.deleted_at is null
    and not (i.id=any(coalesce(p_import_ids,'{}'::uuid[])))
    and not exists (select 1 from public.draft_pro_private_import_uploads as u where u.save_session_id=session_row.id and u.final_storage_path=i.storage_path);
  update public.draft_pro_private_import_blobs as b set status='cleanup_pending',cleanup_requested_at=now()
  where b.user_id=p_user_id and b.status='active'
    and not exists(select 1 from public.draft_pro_private_imports as i where i.blob_id=b.id and i.deleted_at is null);
  select coalesce(sum(b.byte_size),0) into account_bytes from public.draft_pro_private_import_blobs as b where b.user_id=p_user_id and b.status='active';
  select coalesce(sum(u.reserved_bytes),0) into pending_bytes from public.draft_pro_private_import_uploads as u where u.user_id=p_user_id and u.status in ('uploading','staged') and u.save_session_id<>session_row.id and u.expires_at>now();
  if account_bytes + pending_bytes + added_bytes > 104857600 then raise exception 'Draft Pro account import quota exceeded'; end if;
  for upload in select u.* from public.draft_pro_private_import_uploads as u where u.save_session_id=session_row.id and u.status='staged' for update loop
    insert into public.draft_pro_private_import_blobs(user_id,storage_path,byte_size,row_count,content_sha256) values(upload.user_id,upload.final_storage_path,upload.actual_bytes,upload.row_count,upload.content_sha256) returning * into blob;
    insert into public.draft_pro_private_imports(user_id,draft_id,name,content_type,storage_path,normalized_rows,mapping,byte_size,row_count,blob_id) values(upload.user_id,draft.id,upload.name,upload.content_type,upload.final_storage_path,'[]'::jsonb,upload.mapping,upload.actual_bytes,upload.row_count,blob.id);
  end loop;
  update public.draft_pro_private_import_uploads as u set status='committed' where u.save_session_id=session_row.id and u.status='staged';
  update public.draft_pro_save_sessions as s set status='committed' where s.id=session_row.id;
  update public.draft_pro_private_import_blobs as b set status='cleanup_pending',cleanup_requested_at=now() where b.user_id=p_user_id and b.status='active' and not exists(select 1 from public.draft_pro_private_imports as i where i.blob_id=b.id and i.deleted_at is null);
  select count(*) into draft_count from public.draft_pro_private_imports as i where i.draft_id=draft.id and i.deleted_at is null;
  return query select 'saved',draft.id,draft.lock_version,draft.name,draft.updated_at,draft_count,null::integer;
end;
$$;

-- List/read are service-only ownership checks. The application guard remains the
-- sole eligibility/capability authority before these are invoked.
create or replace function public.list_draft_pro_saved_drafts(p_user_id uuid)
returns table(id uuid,name text,status text,lock_version integer,updated_at timestamptz,import_count integer)
language sql security definer set search_path = public, pg_temp as $$
  select d.id,d.name,d.status,d.lock_version,d.updated_at,count(i.id)::integer from public.draft_pro_drafts d left join public.draft_pro_private_imports i on i.draft_id=d.id and i.deleted_at is null where d.user_id=p_user_id group by d.id order by d.updated_at desc;
$$;
create or replace function public.read_draft_pro_snapshot(p_user_id uuid,p_draft_id uuid)
returns table(id uuid,name text,lock_version integer,snapshot jsonb,updated_at timestamptz,imports jsonb)
language sql security definer set search_path = public, pg_temp as $$
  select d.id,d.name,d.lock_version,d.snapshot,d.updated_at,coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'content_type',i.content_type,'byte_size',i.byte_size,'row_count',i.row_count,'mapping',i.mapping) order by i.created_at) filter(where i.id is not null),'[]'::jsonb) from public.draft_pro_drafts d left join public.draft_pro_private_imports i on i.draft_id=d.id and i.deleted_at is null where d.id=p_draft_id and d.user_id=p_user_id and d.status='active' group by d.id;
$$;
create or replace function public.read_draft_pro_private_import_blob(p_user_id uuid,p_draft_id uuid,p_import_id uuid)
returns table(import_id uuid,storage_path text,content_sha256 text,byte_size integer,row_count integer)
language sql security definer set search_path = public, pg_temp as $$
  select i.id,b.storage_path,b.content_sha256,b.byte_size,b.row_count
  from public.draft_pro_private_imports as i
  join public.draft_pro_private_import_blobs as b on b.id=i.blob_id and b.status='active'
  join public.draft_pro_drafts as d on d.id=i.draft_id and d.status='active'
  where i.id=p_import_id and i.draft_id=p_draft_id and i.user_id=p_user_id and i.deleted_at is null and d.user_id=p_user_id;
$$;

create or replace function public.rename_draft_pro_saved_draft(p_user_id uuid,p_draft_id uuid,p_expected_version integer,p_name text)
returns table(status text,draft_id uuid,lock_version integer,name text,updated_at timestamptz,conflict_lock_version integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare draft public.draft_pro_drafts%rowtype;
begin
  select d.* into draft from public.draft_pro_drafts as d where d.id=p_draft_id and d.user_id=p_user_id and d.status<>'deleted' for update;
  if not found then raise exception 'Draft was not found'; end if;
  if p_expected_version is null or draft.lock_version<>p_expected_version then return query select 'conflict',draft.id,draft.lock_version,draft.name,draft.updated_at,draft.lock_version; return; end if;
  update public.draft_pro_drafts as d set name=btrim(p_name),lock_version=d.lock_version+1 where d.id=draft.id returning * into draft;
  return query select 'saved',draft.id,draft.lock_version,draft.name,draft.updated_at,null::integer;
end;
$$;

create or replace function public.delete_draft_pro_saved_draft(p_user_id uuid,p_draft_id uuid,p_expected_version integer)
returns table(status text,draft_id uuid,lock_version integer,cleanup_count integer,conflict_lock_version integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare draft public.draft_pro_drafts%rowtype; cleanup_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('draft-pro-quota:' || p_user_id::text));
  select d.* into draft from public.draft_pro_drafts as d where d.id=p_draft_id and d.user_id=p_user_id and d.status<>'deleted' for update;
  if not found then raise exception 'Draft was not found'; end if;
  if p_expected_version is null or draft.lock_version<>p_expected_version then return query select 'conflict',draft.id,draft.lock_version,0,draft.lock_version; return; end if;
  update public.draft_pro_drafts as d set status='deleted',lock_version=d.lock_version+1 where d.id=draft.id returning * into draft;
  update public.draft_pro_private_imports as i set deleted_at=now() where i.draft_id=draft.id and i.deleted_at is null;
  update public.draft_pro_private_import_blobs b set status='cleanup_pending',cleanup_requested_at=now() where b.user_id=p_user_id and b.status='active' and not exists(select 1 from public.draft_pro_private_imports i where i.blob_id=b.id and i.deleted_at is null);
  select count(*) into cleanup_count from public.draft_pro_private_import_blobs as b where b.user_id=p_user_id and b.status='cleanup_pending';
  return query select 'deleted',draft.id,draft.lock_version,cleanup_count,null::integer;
end;
$$;

create or replace function public.duplicate_draft_pro_saved_draft(p_user_id uuid,p_draft_id uuid,p_expected_version integer,p_name text)
returns table(status text,draft_id uuid,lock_version integer,name text,updated_at timestamptz,import_count integer,conflict_lock_version integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare source_draft public.draft_pro_drafts%rowtype; copy_draft public.draft_pro_drafts%rowtype; draft_count integer; import_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('draft-pro-quota:' || p_user_id::text));
  select d.* into source_draft from public.draft_pro_drafts as d where d.id=p_draft_id and d.user_id=p_user_id and d.status<>'deleted' for update;
  if not found then raise exception 'Draft was not found'; end if;
  if p_expected_version is null or source_draft.lock_version<>p_expected_version then return query select 'conflict',source_draft.id,source_draft.lock_version,source_draft.name,source_draft.updated_at,0,source_draft.lock_version; return; end if;
  select count(*) into draft_count from public.draft_pro_drafts as d where d.user_id=p_user_id and d.status<>'deleted'; if draft_count>=10 then raise exception 'Draft Pro saved draft quota exceeded'; end if;
  insert into public.draft_pro_drafts(user_id,name,snapshot,snapshot_bytes) values(p_user_id,btrim(p_name),source_draft.snapshot,source_draft.snapshot_bytes) returning * into copy_draft;
  insert into public.draft_pro_private_imports(user_id,draft_id,name,content_type,storage_path,normalized_rows,mapping,byte_size,row_count,blob_id)
  select i.user_id,copy_draft.id,i.name,i.content_type,i.storage_path,i.normalized_rows,i.mapping,i.byte_size,i.row_count,i.blob_id from public.draft_pro_private_imports as i where i.draft_id=source_draft.id and i.deleted_at is null;
  select count(*) into import_count from public.draft_pro_private_imports as i where i.draft_id=copy_draft.id and i.deleted_at is null;
  return query select 'saved',copy_draft.id,copy_draft.lock_version,copy_draft.name,copy_draft.updated_at,import_count,null::integer;
end;
$$;

create function public.claim_draft_pro_private_import_cleanup(p_user_id uuid,p_limit integer default 20)
returns table(blob_id uuid,storage_path text,cleanup_lease_id uuid)
language plpgsql security definer set search_path = public, pg_temp as $$
declare lease_id uuid := gen_random_uuid();
begin
  if p_limit not between 1 and 100 then raise exception 'Invalid cleanup limit'; end if;
  return query
  with claimed as (
    update public.draft_pro_private_import_blobs as b set cleanup_requested_at=now(),cleanup_lease_id=lease_id
    where b.id in (
      select c.id from public.draft_pro_private_import_blobs as c
      where c.user_id=p_user_id and c.status='cleanup_pending'
        and (c.cleanup_lease_id is null or c.cleanup_requested_at < now() - interval '15 minutes')
      order by c.cleanup_requested_at nulls first limit p_limit for update skip locked
    ) returning b.*
  ) select c.id,c.storage_path,c.cleanup_lease_id from claimed as c;
end;
$$;
create function public.confirm_draft_pro_private_import_cleanup(p_user_id uuid,p_blob_ids uuid[],p_cleanup_lease_id uuid)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare changed integer;
begin
  if p_cleanup_lease_id is null then raise exception 'Cleanup lease is required'; end if;
  update public.draft_pro_private_import_blobs as b set status='deleted',deleted_at=now() where b.user_id=p_user_id and b.id=any(p_blob_ids) and b.status='cleanup_pending' and b.cleanup_lease_id=p_cleanup_lease_id; get diagnostics changed = row_count; return changed;
end;
$$;

-- Storage deletion is intentionally performed by the server.  These leases
-- retain metadata until that deletion is acknowledged and let a later worker
-- recover an interrupted cleanup attempt.
create or replace function public.claim_draft_pro_private_import_upload_cleanup(p_user_id uuid,p_limit integer default 20)
returns table(upload_id uuid,chunk_paths jsonb,final_storage_path text,delete_final boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_limit not between 1 and 100 then raise exception 'Invalid cleanup limit'; end if;
  update public.draft_pro_private_import_uploads as u set status='expired'
  where u.user_id=p_user_id and u.status in ('uploading','staged') and u.expires_at<=now();
  return query
  with claimed as (
    update public.draft_pro_private_import_uploads as u
    set cleanup_requested_at=now()
    where u.id in (
      select c.id from public.draft_pro_private_import_uploads as c
      where c.user_id=p_user_id and c.status in ('expired','committed') and c.cleaned_at is null
        and (c.cleanup_requested_at is null or c.cleanup_requested_at < now() - interval '15 minutes')
      order by c.created_at limit p_limit for update skip locked
    )
    returning u.*
  ) select c.id,
      case when jsonb_array_length(c.chunk_paths)>0 then c.chunk_paths
        else (select coalesce(jsonb_agg(c.storage_prefix || '/' || ordinal::text),'[]'::jsonb) from generate_series(0,31) as paths(ordinal)) end,
      case when c.status='expired' then 'draft-pro-imports/' || c.id::text || '/normalized.json' else c.final_storage_path end,
      (c.status='expired')
    from claimed as c;
end;
$$;
create or replace function public.confirm_draft_pro_private_import_upload_cleanup(p_user_id uuid,p_upload_ids uuid[])
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare changed integer;
begin
  update public.draft_pro_private_import_uploads as u set
    status=case when u.status='expired' then 'cleaned' else u.status end,
    chunk_paths='[]'::jsonb,
    cleaned_at=now()
  where u.user_id=p_user_id and u.id=any(p_upload_ids) and u.status in ('expired','committed') and u.cleanup_requested_at is not null;
  get diagnostics changed = row_count; return changed;
end;
$$;

revoke all on function public.begin_draft_pro_save_session(uuid,uuid,integer,text), public.begin_draft_pro_private_import_upload(uuid,uuid,uuid,integer,text,text,jsonb), public.stage_draft_pro_private_import_upload(uuid,uuid,text[],integer,integer,text), public.read_draft_pro_private_import_upload(uuid,uuid), public.commit_draft_pro_save_session(uuid,uuid,text,jsonb,integer,uuid[]), public.list_draft_pro_saved_drafts(uuid), public.read_draft_pro_snapshot(uuid,uuid), public.read_draft_pro_private_import_blob(uuid,uuid,uuid), public.rename_draft_pro_saved_draft(uuid,uuid,integer,text), public.delete_draft_pro_saved_draft(uuid,uuid,integer), public.duplicate_draft_pro_saved_draft(uuid,uuid,integer,text), public.claim_draft_pro_private_import_cleanup(uuid,integer), public.confirm_draft_pro_private_import_cleanup(uuid,uuid[],uuid), public.claim_draft_pro_private_import_upload_cleanup(uuid,integer), public.confirm_draft_pro_private_import_upload_cleanup(uuid,uuid[]) from public, anon, authenticated;
grant execute on function public.begin_draft_pro_save_session(uuid,uuid,integer,text), public.begin_draft_pro_private_import_upload(uuid,uuid,uuid,integer,text,text,jsonb), public.stage_draft_pro_private_import_upload(uuid,uuid,text[],integer,integer,text), public.read_draft_pro_private_import_upload(uuid,uuid), public.commit_draft_pro_save_session(uuid,uuid,text,jsonb,integer,uuid[]), public.list_draft_pro_saved_drafts(uuid), public.read_draft_pro_snapshot(uuid,uuid), public.read_draft_pro_private_import_blob(uuid,uuid,uuid), public.rename_draft_pro_saved_draft(uuid,uuid,integer,text), public.delete_draft_pro_saved_draft(uuid,uuid,integer), public.duplicate_draft_pro_saved_draft(uuid,uuid,integer,text), public.claim_draft_pro_private_import_cleanup(uuid,integer), public.confirm_draft_pro_private_import_cleanup(uuid,uuid[],uuid), public.claim_draft_pro_private_import_upload_cleanup(uuid,integer), public.confirm_draft_pro_private_import_upload_cleanup(uuid,uuid[]) to service_role;
