-- Durable custody for one hosted official slate. Dispatch requires a separate signed authorization.
begin;
set local lock_timeout = '5s';

-- Only the owner can replace the database clock; no caller controls slot or ledger timestamps.
create function public.blsh_official_clock_v1() returns timestamptz language sql volatile set search_path = '' as $$
  select pg_catalog.clock_timestamp()
$$;

create table public.blsh_official_runs (
  run_id uuid primary key default gen_random_uuid(),
  source_date date not null unique check (source_date = date '2026-11-20'),
  native_run_id uuid not null unique references public.blsh_capture_runs(run_id),
  native_manifest_sha256 text not null check (native_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  deployment_id text not null check (deployment_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  git_commit_sha text not null check (git_commit_sha ~ '^[0-9a-f]{40}$'),
  schedule_sha256 text not null check (schedule_sha256 ~ '^[0-9a-f]{64}$'),
  game_ids integer[] not null check (cardinality(game_ids) between 1 and 16),
  claimed_at timestamptz not null default public.blsh_official_clock_v1(),
  state text not null default 'claimed' check (state in ('claimed','failed','packet_complete_pending_review')),
  closed_at timestamptz,
  reason text check (reason ~ '^[a-z][a-z0-9_:]{2,100}$'),
  manifest_sha256 text check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  check ((state = 'claimed') = (closed_at is null)),
  check ((state = 'failed') = (reason is not null)),
  check ((state = 'packet_complete_pending_review') = (manifest_sha256 is not null))
);
create table public.blsh_official_objects (
  run_id uuid not null references public.blsh_official_runs(run_id),
  ordinal integer not null check (ordinal between 1 and 50),
  path text not null unique,
  bytes integer not null check (bytes between 1 and 4194304),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  written_at timestamptz not null default public.blsh_official_clock_v1(),
  game_ordinal integer,
  game_id integer,
  intent_url text,
  check ((game_ordinal is null) = (game_id is null) and (game_id is null) = (intent_url is null)),
  primary key (run_id,ordinal),
  unique (run_id,game_ordinal)
);
alter table public.blsh_official_runs enable row level security;
alter table public.blsh_official_objects enable row level security;
revoke all on public.blsh_official_runs,public.blsh_official_objects from public,anon,authenticated,service_role;
grant select on public.blsh_official_runs,public.blsh_official_objects to service_role;

-- Original bytes and metadata commit together. Normal metadata readback never loads bytea.
create table public.blsh_official_originals (
  run_id uuid not null, ordinal integer not null,
  body bytea not null check (octet_length(body) between 1 and 4194304),
  primary key(run_id,ordinal),
  foreign key(run_id) references public.blsh_official_runs(run_id)
);
-- The indexed write clock is sampled after its original bytes have been inserted.
alter table public.blsh_official_objects add foreign key(run_id,ordinal) references public.blsh_official_originals(run_id,ordinal);
alter table public.blsh_official_originals enable row level security;
revoke all on public.blsh_official_originals from public,anon,authenticated,service_role;
grant select on public.blsh_official_originals to service_role;

-- Prevent accidental future mutation even under broader table grants. Only the
-- run's single terminal transition is mutable; all binding fields stay fixed.
create function public.blsh_official_guard_v1() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op <> 'UPDATE' or tg_table_name <> 'blsh_official_runs' then raise exception 'official_ledger_immutable'; end if;
  if old.state <> 'claimed' or new.state='claimed' or
    (to_jsonb(old)-array['state','closed_at','reason','manifest_sha256']) is distinct from
    (to_jsonb(new)-array['state','closed_at','reason','manifest_sha256']) then raise exception 'official_run_immutable'; end if;
  return new;
end $$;
create trigger blsh_official_run_guard before update or delete on public.blsh_official_runs for each row execute function public.blsh_official_guard_v1();
create trigger blsh_official_index_guard before update or delete on public.blsh_official_objects for each row execute function public.blsh_official_guard_v1();
create trigger blsh_official_original_guard before update or delete on public.blsh_official_originals for each row execute function public.blsh_official_guard_v1();
create trigger blsh_official_run_keep before truncate on public.blsh_official_runs execute function public.blsh_official_guard_v1();
create trigger blsh_official_index_keep before truncate on public.blsh_official_objects execute function public.blsh_official_guard_v1();
create trigger blsh_official_original_keep before truncate on public.blsh_official_originals execute function public.blsh_official_guard_v1();

create function public.blsh_official_binding_v1(r public.blsh_official_runs) returns jsonb
language sql stable strict set search_path = '' as $$
  select jsonb_build_object('runId',r.run_id,'sourceDate',r.source_date,'nativeRunId',r.native_run_id,
    'nativeManifestSHA256',r.native_manifest_sha256,'deploymentId',r.deployment_id,'gitCommitSha',r.git_commit_sha,
    'scheduleSHA256',r.schedule_sha256,'gameIds',r.game_ids)
$$;

create function public.blsh_official_slot_v1(ids integer[], n integer, out filename text, out lim integer)
returns record language sql immutable strict set search_path = '' as $$
  select case when n=1 then 'RUNTIME.json' when n=cardinality(ids)*3+2 then 'MANIFEST.json'
    when n between 2 and cardinality(ids)*3+1 then case (n-2)%3
      when 0 then 'operation-' || ((n-2)/3+1) || '-STARTED.json'
      when 1 then 'boxscore-' || ids[(n-2)/3+1] || '.body.json'
      when 2 then 'boxscore-' || ids[(n-2)/3+1] || '.receipt.json' end end,
    case when n between 2 and cardinality(ids)*3+1 and (n-2)%3=1 then 4194304
      when n between 2 and cardinality(ids)*3+1 and (n-2)%3=2 then 393216 else 65536 end
$$;

create function public.blsh_official_claim_v1(p_source_date date,p_native_run_id uuid,p_native_manifest_sha256 text,
  p_deployment_id text,p_git_commit_sha text,p_schedule_sha256 text,p_game_ids integer[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare native_deployment jsonb; src jsonb; id uuid; at_utc timestamptz; after_write timestamptz;
begin
  if p_source_date is distinct from date '2026-11-20'
    or p_deployment_id is null or p_deployment_id !~ '^[A-Za-z0-9_-]{1,128}$'
    or p_git_commit_sha is null or p_git_commit_sha !~ '^[0-9a-f]{40}$'
    or p_game_ids is null or cardinality(p_game_ids) not between 1 and 16 or array_ndims(p_game_ids) <> 1
    or array_lower(p_game_ids,1) <> 1 or exists (select 1 from generate_subscripts(p_game_ids,1) i
      where p_game_ids[i] is null or p_game_ids[i] not between 2026020000 and 2026029999 or p_game_ids[i] <= p_game_ids[i-1])
    then raise exception 'official_binding_invalid'; end if;
  select deployment into strict native_deployment from public.blsh_capture_runs where run_id=p_native_run_id for share;
  src := public.blsh_context_source_v1(p_source_date,p_native_run_id,p_native_manifest_sha256);
  if native_deployment->>'deploymentId' is distinct from p_deployment_id
    or not (native_deployment ? 'gitCommitSha')
    or (native_deployment->'gitCommitSha' <> 'null'::jsonb and native_deployment->>'gitCommitSha' is distinct from p_git_commit_sha)
    or p_schedule_sha256 is null or src->'objects'->5->>'sha256' is distinct from p_schedule_sha256
    then raise exception 'official_native_binding_mismatch'; end if;
  -- Exactly one date is eligible. Serialize competing claims before evaluating
  -- the slot, including an uncommitted insert that later rolls back.
  lock table public.blsh_official_runs in share row exclusive mode;
  at_utc := public.blsh_official_clock_v1();
  if at_utc < timestamptz '2026-11-21 12:45:00+00' or at_utc >= timestamptz '2026-11-21 12:46:00+00'
    or at_utc < (src->>'closedAtUTC')::timestamptz then raise exception 'official_claim_outside_slot'; end if;
  insert into public.blsh_official_runs(claimed_at,source_date,native_run_id,native_manifest_sha256,deployment_id,git_commit_sha,schedule_sha256,game_ids)
    values(at_utc,p_source_date,p_native_run_id,p_native_manifest_sha256,p_deployment_id,p_git_commit_sha,p_schedule_sha256,p_game_ids)
    on conflict do nothing returning run_id into id;
  after_write := public.blsh_official_clock_v1();
  if after_write < at_utc or after_write >= timestamptz '2026-11-21 12:46:00+00' then raise exception 'official_claim_outside_slot'; end if;
  if id is null then
    if exists (select 1 from public.blsh_official_runs where source_date=p_source_date) then return jsonb_build_object('claimed',false); end if;
    raise exception 'official_claim_conflict';
  end if;
  return jsonb_build_object('claimed',true,'runId',id);
end $$;

create function public.blsh_official_object_v1(p_run_id uuid,p_ordinal integer,p_path text,p_bytes integer,p_sha256 text,p_body_base64 text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare r public.blsh_official_runs%rowtype; n integer; g integer; gid integer; url text;
  filename text; lim integer := 65536; journal jsonb; raw bytea; journal_text text; runtime jsonb; at_utc timestamptz; after_write timestamptz; deadline timestamptz;
begin
  select * into strict r from public.blsh_official_runs where run_id=p_run_id and state='claimed' for update;
  select count(*)+1 into n from public.blsh_official_objects where run_id=p_run_id;
  if p_ordinal is distinct from n or n > cardinality(r.game_ids)*3+2 then raise exception 'official_object_order'; end if;
  select s.filename,s.lim into filename,lim from public.blsh_official_slot_v1(r.game_ids,n) s;
  if p_bytes is null or p_bytes not between 1 and lim or p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$'
    or p_body_base64 is null or octet_length(p_body_base64) <> 4*((p_bytes+2)/3) then raise exception 'official_object_scope_or_bounds'; end if;
  raw := decode(p_body_base64,'base64');
  if octet_length(raw) <> p_bytes or encode(sha256(raw),'hex') is distinct from p_sha256 then raise exception 'official_object_digest'; end if;
  if n=1 then
    runtime := convert_from(raw,'UTF8')::jsonb;
    if not (runtime @> public.blsh_official_binding_v1(r)) or runtime->'gameIds' is distinct from to_jsonb(r.game_ids) or runtime->>'version' is distinct from 'fhfh.blsh.official-pilot-runtime.v1'
      or runtime->>'region' is distinct from 'iad1' or runtime->>'acquisitionClass' is distinct from 'vercel_direct_https'
      or (runtime->>'startedAtUTC' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$') is not true
      or (length(runtime->>'grantBase64') between 1 and 4096) is not true
      or runtime->>'acquisitionPinsSHA256' is distinct from encode(sha256(decode(runtime->>'grantBase64','base64')),'hex')
      then raise exception 'official_runtime_binding'; end if;
  else
    select convert_from(body,'UTF8')::jsonb into strict runtime from public.blsh_official_originals where run_id=p_run_id and ordinal=1;
  end if;
  if n between 2 and cardinality(r.game_ids)*3+1 and (n-2)%3=0 then
    g := (n-2)/3+1; gid := r.game_ids[g];
    url := 'https://api-web.nhle.com/v1/gamecenter/' || gid || '/boxscore';
    journal_text := convert_from(raw,'UTF8'); journal := journal_text::jsonb;
    if not (journal ?& array['operation','method','url','acquisitionPinsSHA256','startedAtUTC'])
      or (select count(*) from json_each(journal_text::json)) <> 5
      or journal->'operation' is distinct from to_jsonb(g) or journal->>'method' is distinct from 'GET'
      or journal->>'url' is distinct from url or journal->>'acquisitionPinsSHA256' is distinct from runtime->>'acquisitionPinsSHA256'
      or (journal->>'startedAtUTC' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$') is not true
      then raise exception 'official_intent_scope'; end if;
  end if;
  if p_path is distinct from 'official-v1/' || r.source_date::text || '/' || r.run_id::text || '/' || filename
    then raise exception 'official_object_scope_or_bounds'; end if;
  lock table public.blsh_official_originals,public.blsh_official_objects in row exclusive mode;
  insert into public.blsh_official_originals(run_id,ordinal,body) values(p_run_id,n,raw);
  at_utc := public.blsh_official_clock_v1();
  deadline := least((runtime->>'startedAtUTC')::timestamptz + interval '120 seconds',r.claimed_at + interval '225 seconds');
  if at_utc > deadline then raise exception 'official_acquisition_deadline'; end if;
  if (runtime->>'startedAtUTC')::timestamptz not between r.claimed_at and at_utc
    or exists(select 1 from public.blsh_official_objects where run_id=p_run_id and ordinal=n-1 and written_at>at_utc)
    then raise exception 'official_object_clock'; end if;
  if journal is not null and (journal->>'startedAtUTC')::timestamptz not between (runtime->>'startedAtUTC')::timestamptz and at_utc
    then raise exception 'official_intent_scope'; end if;
  insert into public.blsh_official_objects(run_id,ordinal,path,bytes,sha256,written_at,game_ordinal,game_id,intent_url)
    values(p_run_id,n,p_path,p_bytes,p_sha256,at_utc,case when url is not null then g end,case when url is not null then gid end,url);
  after_write := public.blsh_official_clock_v1();
  if after_write not between at_utc and deadline then raise exception 'official_acquisition_deadline'; end if;
  if journal is not null and (after_write >= (journal->>'startedAtUTC')::timestamptz + interval '15 seconds'
    or after_write + interval '15 seconds' > deadline) then raise exception 'official_intent_deadline'; end if;
  return true;
end $$;

create function public.blsh_official_close_v1(p_run_id uuid,p_state text,p_reason text,p_manifest_sha256 text,p_manifest_text text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare r public.blsh_official_runs%rowtype; final public.blsh_official_objects%rowtype; files jsonb; manifest jsonb; runtime jsonb; at_utc timestamptz; after_write timestamptz; deadline timestamptz;
begin
  lock table public.blsh_official_runs in row exclusive mode;
  select * into strict r from public.blsh_official_runs where run_id=p_run_id and state='claimed' for update;
  if p_state='packet_complete_pending_review' then
    if p_reason is not null or p_manifest_text is null or octet_length(p_manifest_text) not between 1 and 65536
      or encode(sha256(convert_to(p_manifest_text,'UTF8')),'hex') is distinct from p_manifest_sha256 then raise exception 'official_manifest_digest'; end if;
    perform 1 from public.blsh_capture_runs where run_id=r.native_run_id for share;
    perform public.blsh_context_source_v1(r.source_date,r.native_run_id,r.native_manifest_sha256);
    select * into strict final from public.blsh_official_objects where run_id=p_run_id and ordinal=cardinality(r.game_ids)*3+2;
    select jsonb_agg(jsonb_build_object('file',split_part(path,'/',4),'sha256',sha256,'bytes',bytes) order by ordinal)
      into files from public.blsh_official_objects where run_id=p_run_id and ordinal < final.ordinal;
    manifest := p_manifest_text::jsonb;
    select convert_from(body,'UTF8')::jsonb into strict runtime from public.blsh_official_originals where run_id=p_run_id and ordinal=1;
    deadline := least((runtime->>'startedAtUTC')::timestamptz + interval '120 seconds',r.claimed_at + interval '225 seconds');
    if not (manifest @> public.blsh_official_binding_v1(r)) or manifest->'gameIds' is distinct from to_jsonb(r.game_ids)
      or (select count(*) from jsonb_object_keys(manifest))<>15 or manifest->>'version' is distinct from 'fhfh.blsh.official-pilot-manifest.v1'
      or manifest->>'status' is distinct from 'acquisition_complete_pending_review'
      or manifest->'requests' is distinct from to_jsonb(cardinality(r.game_ids)) or manifest->'retries' is distinct from to_jsonb(0)
      or manifest->>'acquisitionPinsSHA256' is distinct from runtime->>'acquisitionPinsSHA256'
      or (manifest->>'completedAtUTC' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$') is not true
      or (manifest->>'completedAtUTC')::timestamptz not between (runtime->>'startedAtUTC')::timestamptz and final.written_at
      then raise exception 'official_terminal_binding'; end if;
    if final.sha256 is distinct from p_manifest_sha256 or final.bytes <> octet_length(p_manifest_text)
      or manifest->>'runId' is distinct from r.run_id::text or manifest->>'sourceDate' is distinct from r.source_date::text
      or manifest->'files' is distinct from files or (select count(*) from json_each(p_manifest_text::json)) <>
        (select count(*) from jsonb_object_keys(manifest))
      or exists(select 1 from json_array_elements(p_manifest_text::json->'files') row where (select count(*) from json_each(row))<>3)
      then raise exception 'official_manifest_index_mismatch'; end if;
  elsif p_state='failed' then
    if p_reason is null or p_reason !~ '^[a-z][a-z0-9_:]{2,100}$' or p_manifest_sha256 is not null or p_manifest_text is not null
      then raise exception 'official_failure_invalid'; end if;
  else raise exception 'official_state_invalid';
  end if;
  update public.blsh_official_runs set state=p_state,reason=p_reason,manifest_sha256=p_manifest_sha256,
    closed_at=public.blsh_official_clock_v1() where run_id=p_run_id returning closed_at into at_utc;
  after_write := public.blsh_official_clock_v1();
  if after_write < at_utc or at_utc < r.claimed_at or (p_state='packet_complete_pending_review'
    and (at_utc < final.written_at or after_write > deadline)) then raise exception 'official_terminal_binding'; end if;
  return true;
end $$;

revoke all on function public.blsh_official_guard_v1(),public.blsh_official_clock_v1(),public.blsh_official_binding_v1(public.blsh_official_runs),public.blsh_official_slot_v1(integer[],integer),public.blsh_official_claim_v1(date,uuid,text,text,text,text,integer[]),
  public.blsh_official_object_v1(uuid,integer,text,integer,text,text),public.blsh_official_close_v1(uuid,text,text,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.blsh_official_claim_v1(date,uuid,text,text,text,text,integer[]),
  public.blsh_official_object_v1(uuid,integer,text,integer,text,text),public.blsh_official_close_v1(uuid,text,text,text,text) to service_role;
commit;
