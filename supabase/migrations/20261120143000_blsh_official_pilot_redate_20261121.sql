-- Re-date the single hosted official pilot (TJ approval 2026-11-20, BLSH packet 6.1): source date 2026-11-20 -> 2026-11-21,
-- claim slot 2026-11-21 12:45Z -> 2026-11-22 12:45Z. The 2026-11-20 slate had no games.
-- Changes only the three date literals of 20261118155445: the source-date check and blsh_official_claim_v1.
-- The function body is otherwise byte-identical; CREATE OR REPLACE keeps its owner and grants.
-- Refuses if any official run exists or if either replaced definition is not the reviewed 20261118155445 one.
begin;
set local lock_timeout = '5s';
lock table public.blsh_official_runs in access exclusive mode;

do $guard$
begin
  if exists (select 1 from public.blsh_official_runs) then
    raise exception 'official_redate_runs_exist';
  end if;
  if (select count(*) from pg_catalog.pg_constraint where conrelid = 'public.blsh_official_runs'::regclass
        and conname = 'blsh_official_runs_source_date_check'
        and pg_catalog.pg_get_constraintdef(oid) = 'CHECK ((source_date = ''2026-11-20''::date))') <> 1
     or pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.pg_get_functiondef(
        'public.blsh_official_claim_v1(date,uuid,text,text,text,text,integer[])'::regprocedure), 'UTF8')), 'hex')
        <> '5893416fdcb334659cefb8e6873da4b88426f91bfda92bcf1b81cfbb86fba2c1' then
    raise exception 'official_redate_definition_mismatch';
  end if;
end $guard$;

alter table public.blsh_official_runs drop constraint blsh_official_runs_source_date_check,
  add constraint blsh_official_runs_source_date_check check (source_date = date '2026-11-21');

create or replace function public.blsh_official_claim_v1(p_source_date date,p_native_run_id uuid,p_native_manifest_sha256 text,
  p_deployment_id text,p_git_commit_sha text,p_schedule_sha256 text,p_game_ids integer[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare native_deployment jsonb; src jsonb; id uuid; at_utc timestamptz; after_write timestamptz;
begin
  if p_source_date is distinct from date '2026-11-21'
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
  if at_utc < timestamptz '2026-11-22 12:45:00+00' or at_utc >= timestamptz '2026-11-22 12:46:00+00'
    or at_utc < (src->>'closedAtUTC')::timestamptz then raise exception 'official_claim_outside_slot'; end if;
  insert into public.blsh_official_runs(claimed_at,source_date,native_run_id,native_manifest_sha256,deployment_id,git_commit_sha,schedule_sha256,game_ids)
    values(at_utc,p_source_date,p_native_run_id,p_native_manifest_sha256,p_deployment_id,p_git_commit_sha,p_schedule_sha256,p_game_ids)
    on conflict do nothing returning run_id into id;
  after_write := public.blsh_official_clock_v1();
  if after_write < at_utc or after_write >= timestamptz '2026-11-22 12:46:00+00' then raise exception 'official_claim_outside_slot'; end if;
  if id is null then
    if exists (select 1 from public.blsh_official_runs where source_date=p_source_date) then return jsonb_build_object('claimed',false); end if;
    raise exception 'official_claim_conflict';
  end if;
  return jsonb_build_object('claimed',true,'runId',id);
end $$;
commit;
