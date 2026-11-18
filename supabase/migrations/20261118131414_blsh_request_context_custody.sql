-- Independent one-shot ledger for the human-gated request/context reader.
-- Storage bodies are hashed by the caller. SQL verifies upload sizes and the exact UTF-8 manifest.
begin;
set local lock_timeout = '5s';

create table public.blsh_context_runs (
  run_id uuid primary key default gen_random_uuid(),
  source_date date not null unique,
  native_run_id uuid not null unique references public.blsh_capture_runs(run_id),
  native_manifest_sha256 text not null check (native_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  claimed_at timestamptz not null default clock_timestamp(),
  state text not null default 'claimed' check (state in ('claimed','packet_complete_pending_review','failed')),
  closed_at timestamptz,
  reason text check (reason ~ '^[a-z][a-z0-9_:]{2,100}$'),
  manifest_sha256 text check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  check ((state = 'claimed') = (closed_at is null)),
  check ((state = 'failed') = (reason is not null)),
  check ((state = 'packet_complete_pending_review') = (manifest_sha256 is not null))
);
create table public.blsh_context_objects (
  run_id uuid not null references public.blsh_context_runs(run_id),
  ordinal integer not null check (ordinal between 1 and 8),
  path text not null unique,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  bytes integer not null check (bytes between 1 and 33554432),
  written_at timestamptz not null default clock_timestamp(),
  primary key (run_id, ordinal)
);
alter table public.blsh_context_runs enable row level security;
alter table public.blsh_context_objects enable row level security;
revoke all on public.blsh_context_runs, public.blsh_context_objects from public, anon, authenticated, service_role;
grant select on public.blsh_context_runs, public.blsh_context_objects to service_role;

create function public.blsh_context_guard_v1() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op <> 'UPDATE' or tg_table_name <> 'blsh_context_runs' then raise exception 'context_ledger_immutable'; end if;
  if old.state <> 'claimed' or new.state = 'claimed' or
     (new.run_id, new.source_date, new.native_run_id, new.native_manifest_sha256, new.claimed_at) is distinct from
     (old.run_id, old.source_date, old.native_run_id, old.native_manifest_sha256, old.claimed_at) then
    raise exception 'context_run_immutable';
  end if;
  return new;
end $$;
create trigger blsh_context_runs_guard before update or delete on public.blsh_context_runs
  for each row execute function public.blsh_context_guard_v1();
create trigger blsh_context_objects_guard before update or delete on public.blsh_context_objects
  for each row execute function public.blsh_context_guard_v1();
create trigger blsh_context_runs_no_truncate before truncate on public.blsh_context_runs
  for each statement execute function public.blsh_context_guard_v1();
create trigger blsh_context_objects_no_truncate before truncate on public.blsh_context_objects
  for each statement execute function public.blsh_context_guard_v1();

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('blsh-request-context','blsh-request-context',false,33554432,array['application/json']);
-- Restrict existing permissive Storage policies for client roles to other buckets.
create policy blsh_context_private_objects on storage.objects as restrictive for all to anon, authenticated
  using (bucket_id <> 'blsh-request-context') with check (bucket_id <> 'blsh-request-context');

-- Read exactly the indexed full native packet for the independently selected tuple.
create function public.blsh_context_source_v1(p_source_date date, p_native_run_id uuid, p_native_manifest_sha256 text)
returns jsonb language plpgsql stable security definer set search_path = '' set timezone = 'UTC' as $$
declare
  r public.blsh_capture_runs%rowtype; n integer; objects jsonb;
  names constant text[] := array['STARTED.json','PLAN.json','RUNTIME.json','operation-1-STARTED.json','operation-1-SETTLED.json',
    'schedule.raw.json','schedule.TRANSPORT-OBSERVATION.json','operation-2-STARTED.json','operation-2-SETTLED.json',
    'operation-3-STARTED.json','operation-3-SETTLED.json','individual.parser-input.html','individual.TRANSPORT-OBSERVATION.json',
    'operation-4-STARTED.json','operation-4-SETTLED.json','operation-5-STARTED.json','operation-5-SETTLED.json',
    'onIce.parser-input.html','onIce.TRANSPORT-OBSERVATION.json','MANIFEST.json'];
begin
  select * into strict r from public.blsh_capture_runs
    where run_id = p_native_run_id and pipeline = 'native-v6' and source_date = p_source_date
      and manifest_sha256 = p_native_manifest_sha256 and state = 'packet_complete_pending_review'
      and closed_at is not null and reason is null and pruned_at is null;
  select count(*), jsonb_agg(jsonb_build_object('ordinal',o.ordinal,'path',o.path,'sha256',o.sha256,'bytes',o.bytes,'writtenAtUTC',o.written_at) order by o.ordinal)
    into n, objects from public.blsh_capture_objects o where o.run_id = r.run_id;
  if n <> 20 or exists (
    select 1 from public.blsh_capture_objects o left join storage.objects s
      on s.bucket_id = 'blsh-native-packets' and s.name = o.path
    where o.run_id = r.run_id and (o.ordinal not between 1 and 20
      or o.path is distinct from 'native-v6/' || r.source_date::text || '/' || r.run_id::text || '/' || names[o.ordinal]
      or (s.metadata->>'size')::bigint is distinct from o.bytes::bigint
      or (o.ordinal = 20 and o.sha256 <> r.manifest_sha256))
  ) then raise exception 'context_native_index_or_storage_invalid'; end if;
  return jsonb_build_object('sourceDate',r.source_date,'nativeRunId',r.run_id,'nativeManifestSHA256',r.manifest_sha256,
    'claimedAtUTC',r.claimed_at,'closedAtUTC',r.closed_at,'objects',objects);
end $$;

create function public.blsh_context_claim_v1(p_source_date date, p_native_run_id uuid, p_native_manifest_sha256 text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare claimed_id uuid;
begin
  -- Serialize against native pruning while validating and committing this claim.
  perform 1 from public.blsh_capture_runs where run_id = p_native_run_id for share;
  perform public.blsh_context_source_v1(p_source_date,p_native_run_id,p_native_manifest_sha256);
  insert into public.blsh_context_runs (source_date,native_run_id,native_manifest_sha256)
    values (p_source_date,p_native_run_id,p_native_manifest_sha256) on conflict do nothing returning run_id into claimed_id;
  if claimed_id is null then
    -- A simultaneous insert may hit either unique index first. A consumed date
    -- is the only conflict we can acknowledge as a skip.
    if exists (select 1 from public.blsh_context_runs where source_date = p_source_date) then
      return jsonb_build_object('claimed',false);
    end if;
    raise exception 'context_unexpected_claim_conflict';
  end if;
  return jsonb_build_object('claimed',true,'runId',claimed_id);
end $$;

create function public.blsh_context_object_v1(p_run_id uuid,p_ordinal integer,p_path text,p_sha256 text,p_bytes integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  r public.blsh_context_runs%rowtype; next_ordinal integer; total bigint;
  names constant text[] := array['DB-CONTEXT.json','RAW-wgo.json','RAW-individual.json','RAW-onIce.json','RAW-calendar.json',
    'CURRENT-REQUEST.json','RESULT.json','MANIFEST.json'];
  limits constant integer[] := array[8388608,16777216,16777216,16777216,16777216,33554432,65536,65536];
begin
  select * into strict r from public.blsh_context_runs where run_id = p_run_id and state = 'claimed' for update;
  select count(*) + 1, coalesce(sum(bytes),0) into next_ordinal,total from public.blsh_context_objects where run_id = p_run_id;
  if p_ordinal is distinct from next_ordinal or p_ordinal not between 1 and 8 or p_bytes is null or p_bytes not between 1 and limits[p_ordinal]
    or total + p_bytes > 67108864 or p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$'
    or p_path is distinct from 'request-context-v1/' || r.source_date::text || '/' || r.run_id::text || '/' || names[p_ordinal] then
    raise exception 'context_object_scope_or_bounds';
  end if;
  if not exists (select 1 from storage.objects s where s.bucket_id = 'blsh-request-context' and s.name = p_path
    and (s.metadata->>'size')::bigint = p_bytes) then raise exception 'context_storage_size_mismatch'; end if;
  insert into public.blsh_context_objects (run_id,ordinal,path,sha256,bytes) values (p_run_id,p_ordinal,p_path,p_sha256,p_bytes);
  return true;
end $$;

create function public.blsh_context_close_v1(p_run_id uuid,p_state text,p_reason text,p_manifest_sha256 text,p_manifest_text text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare r public.blsh_context_runs%rowtype; files jsonb; manifest jsonb; final public.blsh_context_objects%rowtype;
begin
  select * into strict r from public.blsh_context_runs where run_id = p_run_id and state = 'claimed' for update;
  if p_state = 'packet_complete_pending_review' then
    if p_reason is not null or p_manifest_text is null or octet_length(p_manifest_text) not between 1 and 65536
      or encode(sha256(convert_to(p_manifest_text,'UTF8')),'hex') is distinct from p_manifest_sha256 then raise exception 'context_manifest_digest'; end if;
    perform 1 from public.blsh_capture_runs where run_id = r.native_run_id for share;
    perform public.blsh_context_source_v1(r.source_date,r.native_run_id,r.native_manifest_sha256);
    select * into strict final from public.blsh_context_objects where run_id = p_run_id and ordinal = 8;
    if final.sha256 <> p_manifest_sha256 or final.bytes <> octet_length(convert_to(p_manifest_text,'UTF8'))
      or exists (select 1 from public.blsh_context_objects o left join storage.objects s on s.bucket_id = 'blsh-request-context' and s.name = o.path
        where o.run_id = p_run_id and (s.metadata->>'size')::bigint is distinct from o.bytes::bigint) then raise exception 'context_index_or_storage_changed'; end if;
    select jsonb_agg(jsonb_build_object('file',split_part(path,'/',4),'bytes',bytes,'sha256',sha256) order by ordinal)
      into files from public.blsh_context_objects where run_id = p_run_id and ordinal < 8;
    manifest := jsonb_build_object('version','fhfh.blsh.request-context-manifest.v1','runId',r.run_id,'sourceDate',r.source_date,'nativeRunId',r.native_run_id,
      'nativeManifestSHA256',r.native_manifest_sha256,'files',files);
    if jsonb_array_length(files) is distinct from 7 or p_manifest_text::jsonb is distinct from manifest
      or (select count(*) from json_each(p_manifest_text::json)) <> 6
      or exists (select 1 from json_array_elements(p_manifest_text::json->'files') item
                 where (select count(*) from json_each(item)) <> 3) then raise exception 'context_manifest_index_mismatch'; end if;
  elsif p_state = 'failed' then
    if p_reason is null or p_reason !~ '^[a-z][a-z0-9_:]{2,100}$' or p_manifest_sha256 is not null or p_manifest_text is not null
      then raise exception 'context_failure_close_invalid'; end if;
  else raise exception 'context_terminal_state_invalid';
  end if;
  update public.blsh_context_runs set state = p_state, closed_at = clock_timestamp(), reason = p_reason, manifest_sha256 = p_manifest_sha256 where run_id = p_run_id;
  return true;
end $$;

revoke all on function public.blsh_context_guard_v1(), public.blsh_context_source_v1(date,uuid,text), public.blsh_context_claim_v1(date,uuid,text),
  public.blsh_context_object_v1(uuid,integer,text,text,integer), public.blsh_context_close_v1(uuid,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.blsh_context_source_v1(date,uuid,text), public.blsh_context_claim_v1(date,uuid,text),
  public.blsh_context_object_v1(uuid,integer,text,text,integer), public.blsh_context_close_v1(uuid,text,text,text,text) to service_role;
commit;
