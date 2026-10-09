begin;
set local lock_timeout = '5s';

create table public.line_source_captures (
  capture_id text primary key,
  team_id bigint not null references public.teams(id),
  original_identity text,
  captured_at timestamptz not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object')
);
create table public.line_claim_revisions (
  claim_id text primary key,
  capture_id text not null references public.line_source_captures(capture_id),
  team_id bigint not null references public.teams(id),
  game_id bigint references public.games(id),
  interpretation_version text not null,
  interpreted_at timestamptz not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object')
);
create index line_claim_revisions_scope on public.line_claim_revisions(team_id, game_id, interpreted_at, claim_id);
create table public.line_claim_relations (
  claim_id text not null references public.line_claim_revisions(claim_id),
  target_claim_id text not null references public.line_claim_revisions(claim_id),
  kind text not null check (kind in ('supersedes','retracts')),
  authority text not null check (authority in ('original_author','reviewed','none')),
  primary key(claim_id,target_claim_id,kind)
);
create table public.line_game_state_observations (
  state_id text primary key,
  game_id bigint not null references public.games(id),
  observed_at timestamptz not null,
  schedule_identity text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object')
);
create index line_game_state_history on public.line_game_state_observations(game_id, observed_at desc);
create table public.line_entry_revisions (
  entry_id text primary key,
  game_id bigint not null references public.games(id),
  team_id bigint not null references public.teams(id),
  revision integer not null check (revision > 0),
  previous_id text references public.line_entry_revisions(entry_id),
  created_at timestamptz not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  unique(game_id,team_id,revision)
);
create table public.line_pp_decisions (
  decision_id text primary key,
  game_id bigint not null references public.games(id),
  team_id bigint not null references public.teams(id),
  unit_number integer not null check (unit_number in (1,2)),
  revision integer not null check (revision > 0),
  replaces_id text references public.line_pp_decisions(decision_id),
  decided_at timestamptz not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  unique(game_id,team_id,unit_number,revision)
);
create index line_pp_decisions_scope on public.line_pp_decisions(game_id,team_id,unit_number,revision desc);

create function public.reject_line_evidence_mutation() returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception 'Line evidence is append-only; record a new revision' using errcode='55000'; end $$;
revoke all on function public.reject_line_evidence_mutation() from public,anon,authenticated;

do $$ declare t text; begin
  foreach t in array array['line_source_captures','line_claim_revisions','line_claim_relations','line_game_state_observations','line_entry_revisions','line_pp_decisions'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
    execute format('grant select,insert on public.%I to service_role',t);
    execute format('create trigger immutable_evidence before update or delete on public.%I for each row execute function public.reject_line_evidence_mutation()',t);
  end loop;
end $$;

-- One game/team lock and compare-and-append protect freeze and unit decisions from racing workers.
create function public.append_line_decisions(p_game_id bigint,p_team_id bigint,p_expected_entry_id text,p_entry jsonb,p_pp jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare current_entry public.line_entry_revisions; decision jsonb; current_pp text; expected_pp text; current_pp_revision integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('line-entry:'||p_game_id||':'||p_team_id,0));
  select * into current_entry from public.line_entry_revisions where game_id=p_game_id and team_id=p_team_id order by revision desc limit 1;
  if current_entry.entry_id is distinct from p_expected_entry_id then return false; end if;
  if (p_entry->>'gameId')::bigint is distinct from p_game_id or (p_entry->>'teamId')::bigint is distinct from p_team_id then raise exception 'Entry scope mismatch'; end if;
  if jsonb_typeof(p_pp) is distinct from 'array' then raise exception 'PP decisions must be an array'; end if;
  for decision in select value from jsonb_array_elements(p_pp) loop
    if (decision->>'gameId')::bigint is distinct from p_game_id or (decision->>'teamId')::bigint is distinct from p_team_id then raise exception 'PP scope mismatch'; end if;
    select decision_id,revision into current_pp,current_pp_revision from public.line_pp_decisions where game_id=p_game_id and team_id=p_team_id and unit_number=(decision->>'unitNumber')::int order by revision desc limit 1;
    expected_pp := decision->>'replacesId';
    if current_pp is distinct from decision->>'id' and current_pp is distinct from expected_pp then return false; end if;
    if current_pp is distinct from decision->>'id' and (decision->>'revision')::int is distinct from coalesce(current_pp_revision,0)+1 then raise exception 'Invalid PP revision chain'; end if;
  end loop;
  if current_entry.entry_id is distinct from p_entry->>'id' then
    if (p_entry->>'revision')::int is distinct from coalesce(current_entry.revision,0)+1 or (p_entry->>'previousId') is distinct from current_entry.entry_id then raise exception 'Invalid entry revision chain'; end if;
    if current_entry.payload->>'status' in ('frozen','corrected') and p_entry->>'status' <> 'corrected' then raise exception 'Frozen entry requires explicit correction'; end if;
    insert into public.line_entry_revisions values(p_entry->>'id',p_game_id,p_team_id,(p_entry->>'revision')::int,p_entry->>'previousId',(p_entry->>'createdAt')::timestamptz,p_entry);
  end if;
  for decision in select value from jsonb_array_elements(p_pp) loop
    insert into public.line_pp_decisions values(decision->>'id',p_game_id,p_team_id,(decision->>'unitNumber')::int,(decision->>'revision')::int,decision->>'replacesId',(decision->>'decidedAt')::timestamptz,decision) on conflict(decision_id) do nothing;
  end loop;
  return true;
end $$;
revoke all on function public.append_line_decisions(bigint,bigint,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.append_line_decisions(bigint,bigint,text,jsonb,jsonb) to service_role;
commit;
