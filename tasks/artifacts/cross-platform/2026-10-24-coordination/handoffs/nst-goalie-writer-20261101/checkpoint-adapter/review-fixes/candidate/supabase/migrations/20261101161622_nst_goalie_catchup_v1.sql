-- Local candidate only: prerequisite shared NST admission v1 must already exist.
-- No schedule or activation. Final-game attestations and exclusive-job clearance
-- require independently verified lifecycle evidence before enabling this lane.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $$ begin
  if to_regprocedure('public.nst_admit_attempt_v1(boolean,integer)') is null then
    raise exception 'Install and verify shared NST admission v1 first';
  end if;
end $$;

create table public.nst_goalie_cohorts (
  scope text primary key check (scope ~ '^[a-f0-9]{64}$'),
  season integer not null,
  source_version text not null check (length(source_version) between 1 and 128),
  start_date date not null,
  end_date date not null,
  planned_request_count integer not null check (planned_request_count between 0 and 140),
  original_manifest jsonb not null check (jsonb_typeof(original_manifest) = 'object'),
  source_observation jsonb not null check (jsonb_typeof(source_observation) = 'object'),
  runner_job_id uuid unique references public.route_runner_jobs(id),
  created_at timestamptz not null default now(),
  check (end_date <= start_date + 13)
);

-- Global unit identity outlives a cohort/day/source version. A new cohort must
-- not erase an existing held state or create an overlapping in-flight unit.
create table public.nst_goalie_units (
  unit_key text primary key,
  season integer not null,
  game_date date not null,
  dataset text not null check (dataset in ('5v5Counts','5v5Rates','evCounts','evRates',
    'allCounts','allRates','ppCounts','ppRates','pkCounts','pkRates')),
  state text not null check (state in ('pending','in_flight','complete','empty_valid','no_games','held')),
  source_version text not null,
  hold_reason text,
  updated_at timestamptz not null default now(),
  unique (season, game_date, dataset),
  check (unit_key = season::text || '/' || to_char(game_date, 'YYYY-MM-DD') || '/' || dataset),
  check (state <> 'held' or coalesce(length(trim(hold_reason)), 0) > 0)
);
create table public.nst_goalie_cohort_units (
  scope text not null references public.nst_goalie_cohorts(scope),
  unit_key text not null references public.nst_goalie_units(unit_key),
  ordinal integer not null check (ordinal between 1 and 140),
  primary key (scope, unit_key),
  unique (scope, ordinal)
);

-- attempts_charged includes outstanding reservations until positively settled.
-- Reserving is conservative; only an acknowledged finish may refund unused work.
create table public.nst_goalie_daily_budget (
  utc_day date primary key,
  steps integer not null default 0 check (steps between 0 and 7),
  attempts_charged integer not null default 0 check (attempts_charged between 0 and 60)
);
create table public.nst_goalie_claims (
  claim_id uuid primary key default gen_random_uuid(),
  scope text not null references public.nst_goalie_cohorts(scope),
  utc_day date not null references public.nst_goalie_daily_budget(utc_day),
  state text not null check (state in ('claimed','finished','held')),
  unit_keys text[] not null check (cardinality(unit_keys) between 1 and 20),
  attempts_reserved integer not null check (attempts_reserved between 1 and 60),
  attempts_used integer check (attempts_used between 0 and attempts_reserved),
  deadline_at timestamptz not null,
  claimed_at timestamptz not null default now(),
  finished_at timestamptz,
  hold_reason text,
  check (state <> 'held' or coalesce(length(trim(hold_reason)), 0) > 0),
  check (state <> 'finished' or (attempts_used is not null and finished_at is not null))
);
-- Conservative recovery fence: unresolved execution also blocks a new cohort.
-- Manual reconciliation is required before transitioning held -> finished.
create unique index nst_goalie_one_unreconciled_claim
  on public.nst_goalie_claims ((true)) where state in ('claimed','held');

create table public.nst_goalie_unit_receipts (
  receipt_id uuid primary key default gen_random_uuid(),
  scope text not null,
  unit_key text not null,
  claim_id uuid not null references public.nst_goalie_claims(claim_id),
  source_version text not null,
  status text not null check (status in ('complete','empty_valid')),
  source_fingerprint text not null check (source_fingerprint ~ '^[a-f0-9]{64}$'),
  output_fingerprint text not null check (output_fingerprint ~ '^[a-f0-9]{64}$'),
  parsed_rows integer not null check (parsed_rows between 0 and 100),
  mapped_rows integer not null,
  written_rows integer not null,
  observed_at timestamptz not null,
  committed_at timestamptz not null default now(),
  foreign key (scope, unit_key) references public.nst_goalie_cohort_units(scope, unit_key),
  unique (scope, unit_key, source_version),
  unique (claim_id, unit_key),
  check (parsed_rows = mapped_rows and mapped_rows = written_rows),
  check ((status = 'complete' and written_rows > 0) or (status = 'empty_valid' and written_rows = 0))
);

alter table public.nst_goalie_cohorts enable row level security;
alter table public.nst_goalie_units enable row level security;
alter table public.nst_goalie_cohort_units enable row level security;
alter table public.nst_goalie_daily_budget enable row level security;
alter table public.nst_goalie_claims enable row level security;
alter table public.nst_goalie_unit_receipts enable row level security;
revoke all on public.nst_goalie_cohorts, public.nst_goalie_units, public.nst_goalie_cohort_units,
  public.nst_goalie_daily_budget, public.nst_goalie_claims, public.nst_goalie_unit_receipts
  from public, anon, authenticated;
grant select, insert, update on public.nst_goalie_cohorts, public.nst_goalie_units,
  public.nst_goalie_cohort_units, public.nst_goalie_daily_budget, public.nst_goalie_claims,
  public.nst_goalie_unit_receipts to service_role;


-- Control is deliberately disabled. A missing lease is unknown occupancy.
create table public.nst_goalie_control (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  enabled_at timestamptz,
  bootstrap_date date
);
insert into public.nst_goalie_control(singleton) values(true);
-- Only the reviewed official-score producer may attest finality.
-- Schedule dates or a partial WGO response cannot establish finality.
create table public.nst_goalie_day_evidence (
  season integer not null,
  game_date date not null,
  game_ids bigint[] not null,
  goalie_ids bigint[] not null,
  source_fingerprint text not null check(source_fingerprint ~ '^[a-f0-9]{64}$'),
  observed_at timestamptz not null,
  source_url text not null,
  source_payload jsonb not null check(jsonb_typeof(source_payload)='object'),
  primary key(season,game_date),
  check(cardinality(game_ids) <= 32 and cardinality(goalie_ids) <= 100)
);
alter table public.nst_goalie_control enable row level security;
alter table public.nst_goalie_day_evidence enable row level security;
revoke all on public.nst_goalie_control,public.nst_goalie_day_evidence from public,anon,authenticated;
-- Activation remains operator-only; the producer receives INSERT below.
grant select on public.nst_goalie_control,public.nst_goalie_day_evidence to service_role;
grant update(singleton) on public.nst_goalie_control to service_role;

create function public.nst_goalie_verify_day_v1(p_season integer,p_date date)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare e public.nst_goalie_day_evidence; games bigint[]; goalies bigint[];
begin
  select * into strict e from public.nst_goalie_day_evidence where season=p_season and game_date=p_date;
  select coalesce(array_agg(id order by id),'{}') into games from public.games
    where "seasonId"=p_season and date=p_date and type=2;
  select coalesce(array_agg(goalie_id::bigint order by goalie_id),'{}') into goalies from public.wgo_goalie_stats
    where season_id=p_season and date=p_date and games_played>0;
  if games is distinct from e.game_ids or goalies is distinct from e.goalie_ids
    or e.observed_at > clock_timestamp() or p_date >= (clock_timestamp() at time zone 'America/New_York')::date
    or exists(select 1 from public.wgo_goalie_stats where season_id=p_season and date=p_date and games_played>0
      and (games_played<>1 or game_id is null or not(game_id=any(games))))
    or exists(select 1 from unnest(games) g where (select count(distinct goalie_id) from public.wgo_goalie_stats
      where season_id=p_season and date=p_date and games_played>0 and game_id=g)<2)
    or cardinality(goalies)<>(select count(distinct x) from unnest(goalies)x)
  then raise exception 'Final-game/appearance evidence changed or incomplete'; end if;
  return to_jsonb(e);
end $$;

create function public.nst_goalie_ensure_cohort_v1(p_manifest jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare c public.nst_goalie_cohorts; u jsonb; prior public.nst_goalie_units; evidence jsonb='{}';
  s text=p_manifest->>'scope'; season integer=(p_manifest->>'season')::integer;
  first_day date=(p_manifest->>'startDate')::date; last_day date=(p_manifest->>'endDate')::date;
  d date; n integer=0; job uuid; ds text; expected text[]='{}'; actual text[];
begin
  -- Serialize ensure/claim across cohorts, including same scope enqueues.
  perform 1 from public.nst_goalie_control where singleton for update;
  select * into c from public.nst_goalie_cohorts where scope=s;
  if found then
    if c.original_manifest is distinct from p_manifest then raise exception 'Cohort scope collision'; end if;
    return jsonb_build_object('status','ensured','scope',s,'plannedRequestCount',c.planned_request_count,'jobId',c.runner_job_id);
  end if;
  if jsonb_typeof(p_manifest) is distinct from 'object' or s is null or s !~ '^[a-f0-9]{64}$'
    or p_manifest->>'version' is distinct from '1' or p_manifest->>'season' !~ '^[0-9]{8}$'
    or coalesce(length(p_manifest->>'sourceVersion'),0) not between 1 and 128
    or first_day is null or last_day is null or last_day<first_day or last_day>first_day+13
    or jsonb_typeof(p_manifest->'units') is distinct from 'array'
  then raise exception 'Invalid cohort manifest'; end if;
  for d in select generate_series(first_day,last_day,interval '1 day')::date loop
    evidence=evidence||jsonb_build_object(d::text,public.nst_goalie_verify_day_v1(season,d));
    foreach ds in array array['5v5Counts','5v5Rates','evCounts','evRates','allCounts','allRates','ppCounts','ppRates','pkCounts','pkRates'] loop
      expected=array_append(expected,season::text||'/'||d::text||'/'||ds);
    end loop;
  end loop;
  select array_agg(x->>'key' order by ord) into actual from jsonb_array_elements(p_manifest->'units') with ordinality a(x,ord);
  if actual is distinct from expected or (p_manifest->>'plannedRequestCount')::integer is distinct from
    (select count(*)::integer from jsonb_array_elements(p_manifest->'units') x where x->>'state'='pending')
  then raise exception 'Manifest is not the complete ordered aperture'; end if;
  insert into public.nst_goalie_cohorts(scope,season,source_version,start_date,end_date,planned_request_count,original_manifest,source_observation)
    values(s,season,p_manifest->>'sourceVersion',first_day,last_day,(p_manifest->>'plannedRequestCount')::integer,p_manifest,evidence);
  for u in select value from jsonb_array_elements(p_manifest->'units') loop
    n=n+1;
    if u->>'key' is distinct from season::text||'/'||(u->>'date')||'/'||(u->>'dataset')
      or u->>'state' is null or u->>'state' not in ('pending','complete','empty_valid','no_games','held')
    then raise exception 'Invalid unit'; end if;
    select * into prior from public.nst_goalie_units where unit_key=u->>'key';
    if found then
      if prior.source_version<>p_manifest->>'sourceVersion' then raise exception 'Source-version change requires reconciliation'; end if;
      if u->>'state'<>'pending' and u->>'state'<>prior.state then raise exception 'Proposal contradicts durable state'; end if;
      -- Existing holds, active claims and receipts always win over a proposal.
    else
      if u->>'state' in ('complete','empty_valid') then raise exception 'No durable completion receipt'; end if;
      if u->>'state'='no_games' and jsonb_array_length(evidence->(u->>'date')->'game_ids')<>0 then
        raise exception 'No-games state conflicts with evidence'; end if;
      insert into public.nst_goalie_units(unit_key,season,game_date,dataset,state,source_version,hold_reason)
        values(u->>'key',season,(u->>'date')::date,u->>'dataset',u->>'state',p_manifest->>'sourceVersion',u->>'reason');
    end if;
    insert into public.nst_goalie_cohort_units(scope,unit_key,ordinal) values(s,u->>'key',n);
  end loop;
  if (p_manifest->>'plannedRequestCount')::integer>0 then
    -- Enqueue is in the same transaction. Disabled-by-default state prevents NST dispatch.
    insert into public.route_runner_jobs(route_path,initial_query,next_query,contract,expires_at)
      values('/api/v1/db/update-nst-goalies',jsonb_build_object('catchupScope',s),jsonb_build_object('catchupScope',s),null,
        clock_timestamp()+interval '14 days') returning id into job;
    update public.nst_goalie_cohorts set runner_job_id=job where scope=s;
  end if;
  return jsonb_build_object('status','ensured','scope',s,'plannedRequestCount',(p_manifest->>'plannedRequestCount')::integer,'jobId',job);
end $$;

create function public.nst_goalie_read_state_v1(p_scope text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare c public.nst_goalie_cohorts; ctl public.nst_goalie_control; units jsonb; budget public.nst_goalie_daily_budget;
  t timestamptz=clock_timestamp(); day date=(t at time zone 'UTC')::date;
begin
  select * into strict c from public.nst_goalie_cohorts where scope=p_scope;
  select * into strict ctl from public.nst_goalie_control where singleton;
  select * into budget from public.nst_goalie_daily_budget where utc_day=day;
  select jsonb_agg(jsonb_build_object('key',u.unit_key,'date',u.game_date,'dataset',u.dataset,
    'state',case when u.state='in_flight' then 'held' else u.state end,'reason',u.hold_reason) order by cu.ordinal)
    into units from public.nst_goalie_cohort_units cu join public.nst_goalie_units u using(unit_key) where cu.scope=p_scope;
  return jsonb_build_object('manifest',c.original_manifest||jsonb_build_object('units',units),
    'budget',jsonb_build_object('utcDate',day,'steps',coalesce(budget.steps,0),'attempts',coalesce(budget.attempts_charged,0)),
    'sharedJobActive',not ctl.enabled or (public.nst_job_state_v1()->>'qualified') is distinct from 'true'
      or (public.nst_job_state_v1()->>'active')::boolean
      or exists(select 1 from public.nst_goalie_claims where state='claimed'),
    'lastDirectJobFinishedAt',public.nst_job_state_v1()->'lastDirectFinishedAt',
    'reviewRequired',(public.nst_job_state_v1()->>'reviewRequired')::boolean or exists(select 1 from public.nst_goalie_claims where state='held' or (state='claimed' and deadline_at<=t))
      or exists(select 1 from public.nst_goalie_units where state='held'));
end $$;

create function public.nst_goalie_claim_step_v1(p_scope text,p_unit_keys text[],p_max_attempts integer,p_deadline_at timestamptz)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare c public.nst_goalie_cohorts; ctl public.nst_goalie_control; b public.nst_goalie_daily_budget;
  t timestamptz; day date; tm time; expected text[]; cap integer; id uuid; deadline timestamptz;
  deferred jsonb=jsonb_build_object('status','deferred','scope',p_scope);
begin
  perform 1 from public.nst_job_control where singleton for update;
  perform 1 from public.nst_goalie_control where singleton for update;
  t=clock_timestamp(); day=(t at time zone 'UTC')::date; tm=(t at time zone 'UTC')::time;
  select * into strict ctl from public.nst_goalie_control where singleton;
  select * into strict c from public.nst_goalie_cohorts where scope=p_scope;
  if not ctl.enabled or (public.nst_job_state_v1()->>'qualified') is distinct from 'true'
    or (public.nst_job_state_v1()->>'active')::boolean
    or (public.nst_job_state_v1()->>'lastDirectFinishedAt')::timestamptz>t-interval '10 minutes'
    or not ((tm>=time '08:30' and tm<=time '08:31:20') or (tm>=time '11:10' and tm<=time '12:46:20'))
    or exists(select 1 from public.nst_goalie_claims where state in ('claimed','held'))
    or exists(select 1 from public.nst_goalie_units where state='held') then return deferred; end if;
  insert into public.nst_goalie_daily_budget(utc_day) values(day) on conflict do nothing;
  select * into strict b from public.nst_goalie_daily_budget where utc_day=day for update;
  if b.steps>=7 or b.attempts_charged>=60 then return deferred; end if;
  cap=least(case when c.planned_request_count between 1 and 39 then 20 else 6 end,60-b.attempts_charged);
  select array_agg(unit_key order by ordinal) into expected from (
    select u.unit_key,cu.ordinal from public.nst_goalie_cohort_units cu join public.nst_goalie_units u using(unit_key)
      where cu.scope=p_scope and u.state='pending' order by cu.ordinal limit cap) q;
  if expected is null then return deferred; end if;
  if p_unit_keys is distinct from expected or p_max_attempts is distinct from least(cardinality(expected)*3,60-b.attempts_charged)
    or p_deadline_at is null or p_deadline_at<t+interval '35 seconds' then raise exception 'Invalid claim proposal'; end if;
  deadline=least(p_deadline_at,t+interval '220 seconds');
  insert into public.nst_goalie_claims(scope,utc_day,state,unit_keys,attempts_reserved,deadline_at,claimed_at)
    values(p_scope,day,'claimed',expected,p_max_attempts,deadline,t) returning claim_id into id;
  update public.nst_goalie_daily_budget set steps=steps+1,attempts_charged=attempts_charged+p_max_attempts where utc_day=day;
  update public.nst_goalie_units set state='in_flight',updated_at=t where unit_key=any(expected);
  return jsonb_build_object('status','claimed','scope',p_scope,'claimId',id,'utcDate',day,'unitKeys',expected,
    'plannedRequestCount',c.planned_request_count,'attemptsReserved',p_max_attempts,'deadlineAt',deadline);
end $$;

create function public.nst_goalie_commit_unit_v1(p_scope text,p_claim_id uuid,p_unit_key text,p_rows jsonb,
  p_source_fingerprint text,p_validated_empty boolean,p_parsed_rows integer,p_mapped_rows integer)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare cl public.nst_goalie_claims; u public.nst_goalie_units; receipt public.nst_goalie_unit_receipts;
  evidence jsonb; row jsonb; field text; cols text; updates text; table_name text; fields text[];
  count_rows integer; written integer; ids bigint[]; stored_ids jsonb; output_hash text; t timestamptz=clock_timestamp();
begin
  select * into strict cl from public.nst_goalie_claims where claim_id=p_claim_id and scope=p_scope for update;
  select * into strict u from public.nst_goalie_units where unit_key=p_unit_key;
  if p_unit_key is null or not(p_unit_key=any(cl.unit_keys)) or jsonb_typeof(p_rows) is distinct from 'array'
    or p_source_fingerprint is null or p_source_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'Invalid unit payload'; end if;
  count_rows=jsonb_array_length(p_rows);
  if count_rows>100 or p_parsed_rows is distinct from count_rows or p_mapped_rows is distinct from count_rows
    or (count_rows=0 and p_validated_empty is distinct from true) then raise exception 'Incomplete parse/map evidence'; end if;
  output_hash=encode(sha256(convert_to(p_rows::text,'UTF8')),'hex');
  select * into receipt from public.nst_goalie_unit_receipts where claim_id=p_claim_id and unit_key=p_unit_key;
  if found then
    if receipt.output_fingerprint<>output_hash or receipt.source_fingerprint<>p_source_fingerprint then
      raise exception 'Inconsistent duplicate commit'; end if;
  else
    if cl.state<>'claimed' or cl.deadline_at<=t or u.state<>'in_flight' then raise exception 'Claim is not live'; end if;
    evidence=public.nst_goalie_verify_day_v1(u.season,u.game_date);
    table_name=case u.dataset
      when '5v5Counts' then 'nst_gamelog_goalie_5v5_counts' when '5v5Rates' then 'nst_gamelog_goalie_5v5_rates'
      when 'evCounts' then 'nst_gamelog_goalie_ev_counts' when 'evRates' then 'nst_gamelog_goalie_ev_rates'
      when 'allCounts' then 'nst_gamelog_goalie_all_counts' when 'allRates' then 'nst_gamelog_goalie_all_rates'
      when 'ppCounts' then 'nst_gamelog_goalie_pp_counts' when 'ppRates' then 'nst_gamelog_goalie_pp_rates'
      when 'pkCounts' then 'nst_gamelog_goalie_pk_counts' when 'pkRates' then 'nst_gamelog_goalie_pk_rates' end;
    if table_name is null then raise exception 'Unknown dataset'; end if;
    for row in select value from jsonb_array_elements(p_rows) loop
      if jsonb_typeof(row) is distinct from 'object' or row->>'date_scraped' is distinct from u.game_date::text
        or row->>'season' is distinct from u.season::text or coalesce(row->>'player_id','') !~ '^[1-9][0-9]*$'
        or row->>'gp' is distinct from '1' or coalesce(length(trim(row->>'player_name')),0)=0
        or coalesce(length(trim(row->>'team')),0)=0 then raise exception 'Invalid row identity'; end if;
      fields=array['toi'];
      if right(u.dataset,6)='Counts' then fields=fields||array['shots_against','saves','goals_against','xg_against','hd_shots_against','hd_saves'];
      elsif (row->>'toi')::numeric>0 then fields=fields||array['toi_per_gp','shots_against_per_60','saves_per_60','gaa','xg_against_per_60','hd_shots_against_per_60','hd_saves_per_60']; end if;
      foreach field in array fields loop
        if jsonb_typeof(row->field) is distinct from 'number' or (row->>field)::numeric<0 then raise exception 'Missing core field %',field; end if;
      end loop;
      for field in select jsonb_object_keys(row) loop
        if not exists(select 1 from pg_attribute where attrelid=format('public.%I',table_name)::regclass
          and attname=field and attnum>0 and not attisdropped)
          or jsonb_typeof(row->field) not in ('number','string','null') then raise exception 'Unexpected output field'; end if;
      end loop;
    end loop;
    select coalesce(array_agg((r->>'player_id')::bigint order by (r->>'player_id')::bigint),'{}') into ids from jsonb_array_elements(p_rows) r;
    if cardinality(ids)<>(select count(distinct x) from unnest(ids)x)
      or exists(select 1 from unnest(ids)x where not(evidence->'goalie_ids' @> to_jsonb(array[x])))
      or (u.dataset in ('allCounts','allRates') and to_jsonb(ids) is distinct from evidence->'goalie_ids')
    then raise exception 'Output identity/appearance coverage incomplete'; end if;
    if count_rows>0 then
      select string_agg(format('%I',key),',' order by key),
        string_agg(format('%I=excluded.%I',key,key),',' order by key) filter(where key not in ('player_id','date_scraped'))
        into cols,updates from (select distinct jsonb_object_keys(value) key from jsonb_array_elements(p_rows)) k;
      -- Identifier originates only from the fixed dataset map; every column is
      -- checked against that table. Bound JSONB never becomes SQL source.
      execute format('insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I,$1) '
        ||'on conflict(player_id,date_scraped) do update set %s',table_name,cols,cols,table_name,updates) using p_rows;
      get diagnostics written=row_count;
    else written=0; end if;
    if written<>count_rows then raise exception 'Output count differs'; end if;
    execute format('select coalesce(jsonb_agg(player_id order by player_id),''[]''::jsonb) from public.%I where date_scraped=$1',table_name)
      into stored_ids using u.game_date;
    if stored_ids is distinct from to_jsonb(ids) then raise exception 'Stored output has unexplained extra or missing identities'; end if;
    insert into public.nst_goalie_unit_receipts(scope,unit_key,claim_id,source_version,status,source_fingerprint,output_fingerprint,
      parsed_rows,mapped_rows,written_rows,observed_at)
      values(p_scope,p_unit_key,p_claim_id,u.source_version,case when count_rows=0 then 'empty_valid' else 'complete' end,
        p_source_fingerprint,output_hash,count_rows,count_rows,written,t) returning * into receipt;
    update public.nst_goalie_units set state=receipt.status,updated_at=t where unit_key=p_unit_key;
  end if;
  return jsonb_build_object('status','committed','scope',p_scope,'claimId',p_claim_id,'unitKey',p_unit_key,
    'receiptId',receipt.receipt_id,'sourceFingerprint',receipt.source_fingerprint,'completionStatus',receipt.status,
    'parsedRows',receipt.parsed_rows,'mappedRows',receipt.mapped_rows,'writtenRows',receipt.written_rows,
    'allCountsCoverage',case when u.dataset='allCounts' then 'complete' else null end);
end $$;

create function public.nst_goalie_finish_step_v1(p_scope text,p_claim_id uuid,p_attempts_used integer,p_committed_unit_keys text[])
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare cl public.nst_goalie_claims; committed text[]; t timestamptz=clock_timestamp();
begin
  select * into strict cl from public.nst_goalie_claims where claim_id=p_claim_id and scope=p_scope for update;
  select coalesce(array_agg(k order by ord),'{}') into committed from unnest(cl.unit_keys) with ordinality q(k,ord)
    where exists(select 1 from public.nst_goalie_unit_receipts where claim_id=p_claim_id and unit_key=k);
  if committed is distinct from p_committed_unit_keys or p_attempts_used is null
    or p_attempts_used<cardinality(committed) or p_attempts_used>cl.attempts_reserved then raise exception 'Settlement evidence inconsistent'; end if;
  if cl.state='finished' then
    if cl.attempts_used<>p_attempts_used then raise exception 'Inconsistent duplicate settlement'; end if;
  else
    if cl.state<>'claimed' or cl.deadline_at<=t then raise exception 'Claim requires reconciliation'; end if;
    -- The current shared ledger has no claim IDs. Never refund from a caller
    -- assertion: retain the full reservation, even when fewer attempts report.
    update public.nst_goalie_claims set state='finished',attempts_used=p_attempts_used,finished_at=t where claim_id=p_claim_id;
    update public.nst_goalie_units set state='pending',updated_at=t where unit_key=any(cl.unit_keys) and state='in_flight';
  end if;
  return jsonb_build_object('status','finished','scope',p_scope,'claimId',p_claim_id,'attemptsUsed',p_attempts_used,
    'attemptsCharged',cl.attempts_reserved,'unusedReleased',0,'committedUnitKeys',committed);
end $$;

create function public.nst_goalie_hold_step_v1(p_scope text,p_claim_id uuid,p_reason text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare cl public.nst_goalie_claims;
begin
  select * into strict cl from public.nst_goalie_claims where claim_id=p_claim_id and scope=p_scope for update;
  if coalesce(length(trim(p_reason)),0) not between 1 and 1000 then raise exception 'Invalid hold reason'; end if;
  -- A lost finish acknowledgement must not reopen an already settled claim.
  -- Still persist a review hold globally because the caller cannot prove it.
  if cl.state='finished' then
    update public.nst_goalie_units set state='held',hold_reason=p_reason where unit_key=any(cl.unit_keys);
  else
    update public.nst_goalie_claims set state='held',hold_reason=p_reason where claim_id=p_claim_id;
    update public.nst_goalie_units set state='held',hold_reason=p_reason where unit_key=any(cl.unit_keys) and state='in_flight';
  end if;
  return jsonb_build_object('status','held','scope',p_scope,'claimId',p_claim_id);
end $$;

-- Whole-job occupancy is separate from rolling rate admission. Activation needs
-- an operator-reviewed caller inventory and positively reconciled legacy jobs.
create table public.nst_job_control (
  singleton boolean primary key default true check(singleton),
  enforced boolean not null default false,
  qualified_at timestamptz,
  qualification_fingerprint text check(qualification_fingerprint ~ '^[a-f0-9]{64}$'),
  last_untracked_at timestamptz
);
insert into public.nst_job_control(singleton) values(true);
create table public.nst_jobs (
  token uuid primary key,
  owner text not null check(length(trim(owner)) between 1 and 128),
  state text not null check(state in ('active','finished','held')),
  started_at timestamptz not null,
  deadline_at timestamptz not null,
  finished_at timestamptz,
  hold_reason text,
  check(deadline_at>started_at and deadline_at<=started_at+interval '1 hour'),
  check(state<>'finished' or finished_at is not null),
  check(state<>'held' or length(hold_reason)>0)
);
alter table public.nst_job_control enable row level security;
alter table public.nst_jobs enable row level security;
revoke all on public.nst_job_control,public.nst_jobs from public,anon,authenticated;
grant select on public.nst_job_control to service_role;
grant update(singleton,last_untracked_at) on public.nst_job_control to service_role;
grant select,insert,update on public.nst_jobs to service_role;

create function public.nst_job_state_v1()
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare ctl public.nst_job_control; t timestamptz=clock_timestamp(); last_finished timestamptz; review boolean;
begin
  select * into strict ctl from public.nst_job_control where singleton;
  select greatest(ctl.qualified_at,max(finished_at)) into last_finished from public.nst_jobs where state='finished';
  review=exists(select 1 from public.nst_jobs where state='held' or(state='active' and deadline_at<=t));
  return jsonb_build_object('version',1,'qualified',ctl.enforced and ctl.qualified_at is not null and ctl.qualified_at<=t
    and ctl.qualification_fingerprint is not null and (ctl.last_untracked_at is null or ctl.last_untracked_at<ctl.qualified_at),
    'active',exists(select 1 from public.nst_jobs where state in ('active','held')),
    'reviewRequired',review,'lastDirectFinishedAt',last_finished);
end $$;

create function public.nst_job_begin_v1(p_token uuid,p_owner text,p_deadline_at timestamptz)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare t timestamptz=clock_timestamp(); old public.nst_jobs;
begin
  perform 1 from public.nst_job_control where singleton for update;
  if p_token is null or coalesce(length(trim(p_owner)),0) not between 1 and 128
    or p_deadline_at is null or p_deadline_at<=t or p_deadline_at>t+interval '1 hour' then raise exception 'Invalid NST job bounds'; end if;
  select * into old from public.nst_jobs where token=p_token;
  if found then
    if old.owner is distinct from p_owner or old.deadline_at is distinct from p_deadline_at or old.state<>'active'
      then raise exception 'NST job token collision or unresolved outcome'; end if;
    return jsonb_build_object('status','started','token',p_token);
  end if;
  if exists(select 1 from public.nst_jobs where state='held' or(state='active' and deadline_at<=t))
    or exists(select 1 from public.nst_goalie_claims where state in ('claimed','held'))
    or exists(select 1 from public.nst_goalie_units where state='held') then raise exception 'NST occupancy requires reconciliation'; end if;
  insert into public.nst_jobs(token,owner,state,started_at,deadline_at) values(p_token,p_owner,'active',t,p_deadline_at);
  return jsonb_build_object('status','started','token',p_token);
end $$;

create function public.nst_job_finish_v1(p_token uuid)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare job public.nst_jobs; t timestamptz=clock_timestamp();
begin
  perform 1 from public.nst_job_control where singleton for update;
  select * into strict job from public.nst_jobs where token=p_token for update;
  if job.state='finished' then return jsonb_build_object('status','finished','token',p_token); end if;
  if job.state<>'active' or job.deadline_at<=t then raise exception 'Expired or held job cannot establish completion'; end if;
  update public.nst_jobs set state='finished',finished_at=t where token=p_token;
  return jsonb_build_object('status','finished','token',p_token);
end $$;

create function public.nst_job_hold_v1(p_token uuid,p_reason text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  perform 1 from public.nst_job_control where singleton for update;
  if coalesce(length(trim(p_reason)),0) not between 1 and 1000 then raise exception 'Invalid NST hold'; end if;
  update public.nst_jobs set state='held',hold_reason=p_reason where token=p_token;
  if not found then raise exception 'Unknown NST job'; end if;
  return jsonb_build_object('status','held','token',p_token);
end $$;

-- Preserve the accepted rolling-budget algorithm verbatim. Its existing public
-- signature becomes the legacy fence; the job-aware entrypoint calls the same
-- budget function only after validating its enclosing job under one lock.
alter function public.nst_admit_attempt_v1(boolean,integer) rename to nst_admit_attempt_budget_v1;
create function public.nst_admit_attempt_v1(p_burst boolean default false,p_planned_requests integer default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  perform 1 from public.nst_job_control where singleton for update;
  if (select enforced from public.nst_job_control where singleton) then raise exception 'NST enclosing job token required'; end if;
  update public.nst_job_control set last_untracked_at=clock_timestamp() where singleton;
  return public.nst_admit_attempt_budget_v1(p_burst,p_planned_requests);
end $$;

create function public.nst_admit_job_attempt_v1(p_kind text,p_token uuid,p_burst boolean default false,p_planned_requests integer default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare t timestamptz=clock_timestamp();
begin
  perform 1 from public.nst_job_control where singleton for update;
  if p_kind='direct' then
    if not exists(select 1 from public.nst_jobs where token=p_token and state='active' and deadline_at>t+interval '1 second')
      or exists(select 1 from public.nst_goalie_claims where state in ('claimed','held'))
      or exists(select 1 from public.nst_goalie_units where state='held')
      or exists(select 1 from public.nst_jobs where state='held' or(state='active' and deadline_at<=t))
      then raise exception 'NST direct job is not active'; end if;
  elsif p_kind='goalie' then
    if (public.nst_job_state_v1()->>'qualified') is distinct from 'true'
      or exists(select 1 from public.nst_jobs where state in ('active','held'))
      or not exists(select 1 from public.nst_goalie_claims where claim_id=p_token and state='claimed' and deadline_at>t+interval '1 second')
      then raise exception 'NST goalie claim lacks exclusive occupancy'; end if;
  else raise exception 'Unknown NST job kind'; end if;
  return public.nst_admit_attempt_budget_v1(p_burst,p_planned_requests);
end $$;

revoke all on function public.nst_job_state_v1(),public.nst_job_begin_v1(uuid,text,timestamptz),public.nst_job_finish_v1(uuid),
  public.nst_job_hold_v1(uuid,text),public.nst_admit_attempt_v1(boolean,integer),public.nst_admit_job_attempt_v1(text,uuid,boolean,integer)
  from public,anon,authenticated;
grant execute on function public.nst_job_state_v1(),public.nst_job_begin_v1(uuid,text,timestamptz),public.nst_job_finish_v1(uuid),
  public.nst_job_hold_v1(uuid,text),public.nst_admit_attempt_v1(boolean,integer),public.nst_admit_job_attempt_v1(text,uuid,boolean,integer) to service_role;

-- Official finality capture, bounded daily preparation and read-only progress.
-- The runtime role may persist evidence through the reviewed producer; it still
-- cannot enable control, select a bootstrap date or grant itself clearance.
grant insert on public.nst_goalie_day_evidence to service_role;

create function public.nst_goalie_preparation_state_v1()
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare ctl public.nst_goalie_control; s public.seasons; t timestamptz=clock_timestamp();
  cutoff date=(t at time zone 'America/New_York')::date-1; first_day date; last_day date;
  active text; job uuid; review boolean; count_seasons integer;
begin
  select * into strict ctl from public.nst_goalie_control where singleton;
  if not ctl.enabled then return jsonb_build_object('version',1,'enabled',false,'reviewRequired',false); end if;
  select count(*) into count_seasons from public.seasons
    where "startDate"<=cutoff and "regularSeasonEndDate">=cutoff;
  if count_seasons=0 then return jsonb_build_object('version',1,'enabled',true,'reviewRequired',false,'activeScope',null,'startDate',null); end if;
  if count_seasons<>1 or ctl.bootstrap_date is null or ctl.enabled_at is null or ctl.enabled_at>t then
    return jsonb_build_object('version',1,'enabled',true,'reviewRequired',true); end if;
  select * into strict s from public.seasons where "startDate"<=cutoff and "regularSeasonEndDate">=cutoff;
  if ctl.bootstrap_date<s."startDate" or ctl.bootstrap_date>cutoff then
    return jsonb_build_object('version',1,'enabled',true,'reviewRequired',true); end if;
  review=(public.nst_job_state_v1()->>'reviewRequired')::boolean or exists(select 1 from public.nst_goalie_claims where state='held' or (state='claimed' and deadline_at<=t))
    or exists(select 1 from public.nst_goalie_units where state='held')
    or exists(select 1 from public.nst_goalie_cohorts c join public.route_runner_jobs j on j.id=c.runner_job_id
      where exists(select 1 from public.nst_goalie_cohort_units cu join public.nst_goalie_units u using(unit_key)
        where cu.scope=c.scope and u.state in ('pending','in_flight'))
      and (j.status in ('failed','cancelled','completed') or j.expires_at<=t));
  select c.scope,c.runner_job_id into active,job from public.nst_goalie_cohorts c join public.route_runner_jobs j on j.id=c.runner_job_id
    where c.season=s.id and j.status in ('queued','waiting','running') and j.expires_at>t
      and exists(select 1 from public.nst_goalie_cohort_units cu join public.nst_goalie_units u using(unit_key)
        where cu.scope=c.scope and u.state in ('pending','in_flight')) order by c.created_at,c.scope limit 1;
  select min(d::date) into first_day from generate_series(ctl.bootstrap_date,cutoff,interval '1 day') d
    where (select count(*) from public.nst_goalie_units u where u.season=s.id and u.game_date=d::date)<>10;
  last_day=least(first_day+13,cutoff,s."regularSeasonEndDate");
  return jsonb_build_object('version',1,'enabled',true,'reviewRequired',review,'activeScope',active,'jobId',job,
    'season',jsonb_build_object('id',s.id,'startDate',s."startDate",'regularSeasonEndDate',s."regularSeasonEndDate"),
    'sourceVersion','official-nhl-score-off-v1','startDate',first_day,'endDate',last_day);
end $$;

create function public.nst_goalie_prepare_cohort_v1(p_manifest jsonb,p_observations jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare context jsonb; observation jsonb; score jsonb; game jsonb; capture_day date; seen date[]='{}';
  season integer; ids bigint[]; all_ids bigint[]; goalies bigint[]; t timestamptz=clock_timestamp();
  observed timestamptz; fingerprint text; source text; payload text;
begin
  perform 1 from public.nst_goalie_control where singleton for update;
  context=public.nst_goalie_preparation_state_v1();
  if context->>'enabled' is distinct from 'true' or context->>'reviewRequired' is distinct from 'false' then
    raise exception 'Preparation is disabled or requires review'; end if;
  if context->>'activeScope' is not null then
    if context->>'activeScope'=p_manifest->>'scope' then return public.nst_goalie_ensure_cohort_v1(p_manifest); end if;
    raise exception 'An existing cohort must finish before new preparation';
  end if;
  if context->>'startDate' is null or p_manifest->>'startDate' is distinct from context->>'startDate'
    or p_manifest->>'endDate' is distinct from context->>'endDate'
    or p_manifest->>'season' is distinct from context->'season'->>'id'
    or p_manifest->>'sourceVersion' is distinct from 'official-nhl-score-off-v1'
    or jsonb_typeof(p_observations) is distinct from 'array'
    or jsonb_array_length(p_observations) is distinct from ((context->>'endDate')::date-(context->>'startDate')::date+1)
  then raise exception 'Preparation aperture changed or is incomplete'; end if;
  season=(p_manifest->>'season')::integer;
  for observation in select value from jsonb_array_elements(p_observations) loop
    capture_day=(observation->>'date')::date; payload=observation->>'payloadText'; source=observation->>'sourceUrl';
    observed=(observation->>'observedAt')::timestamptz; fingerprint=observation->>'fingerprint';
    if capture_day is null or capture_day=any(seen) or capture_day<(context->>'startDate')::date or capture_day>(context->>'endDate')::date
      or payload is null or octet_length(payload)>1048576 or source is distinct from 'https://api-web.nhle.com/v1/score/'||capture_day::text
      or fingerprint is distinct from encode(sha256(convert_to(payload,'UTF8')),'hex')
      or observed is null or observed>t+interval '30 seconds' or observed<t-interval '5 minutes'
    then raise exception 'Official finality capture is invalid or stale'; end if;
    seen=array_append(seen,capture_day); score=payload::jsonb;
    if score->>'currentDate' is distinct from capture_day::text or jsonb_typeof(score->'games') is distinct from 'array'
      or jsonb_array_length(score->'games')>32 then raise exception 'Official finality slate is incomplete'; end if;
    ids='{}'; all_ids='{}';
    for game in select value from jsonb_array_elements(score->'games') loop
      if coalesce(game->>'id','') !~ '^[1-9][0-9]{9}$' or (game->>'id')::bigint=any(all_ids)
        or coalesce(game->>'gameType','') not in ('1','2','3') or game->>'gameDate' is distinct from capture_day::text
        or coalesce(game->>'season','') !~ '^[0-9]{8}$' then raise exception 'Official game identity is invalid'; end if;
      all_ids=array_append(all_ids,(game->>'id')::bigint);
      if game->>'gameType'<>'2' then continue; end if;
      if game->>'season' is distinct from season::text or game->>'gameState' is distinct from 'OFF'
        or left(game->>'id',6) is distinct from (season/10000)::text||'02'
        or coalesce(game->'homeTeam'->>'id','') !~ '^[1-9][0-9]*$' or coalesce(game->'awayTeam'->>'id','') !~ '^[1-9][0-9]*$'
        or game->'homeTeam'->>'id'=game->'awayTeam'->>'id' then raise exception 'Official regular-season game is not verified final'; end if;
      ids=array_append(ids,(game->>'id')::bigint);
    end loop;
    select coalesce(array_agg(x order by x),'{}') into ids from unnest(ids)x;
    select coalesce(array_agg(goalie_id::bigint order by goalie_id),'{}') into goalies from public.wgo_goalie_stats
      where season_id=season and public.wgo_goalie_stats.date=capture_day and games_played>0;
    if cardinality(goalies)>100 then raise exception 'WGO capture exceeds bound'; end if;
    insert into public.nst_goalie_day_evidence(season,game_date,game_ids,goalie_ids,source_fingerprint,observed_at,source_url,source_payload)
      values(season,capture_day,ids,goalies,fingerprint,observed,source,score);
    -- Recheck database calendar and all WGO appearance IDs in this transaction.
    perform public.nst_goalie_verify_day_v1(season,capture_day);
    if exists(select 1 from jsonb_array_elements(p_manifest->'units') u where u->>'date'=capture_day::text
      and u->>'state' is distinct from case when cardinality(ids)=0 then 'no_games' else 'pending' end)
      then raise exception 'Manifest state differs from finality evidence'; end if;
  end loop;
  return public.nst_goalie_ensure_cohort_v1(p_manifest);
end $$;

create function public.nst_goalie_progress_v1(p_season integer)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare ctl public.nst_goalie_control; t timestamptz=clock_timestamp(); datasets jsonb; no_progress integer=0;
  pending integer; held integer; active integer; last_commit timestamptz; preparation jsonb; configuration_known boolean;
begin
  select * into strict ctl from public.nst_goalie_control where singleton;
  preparation=public.nst_goalie_preparation_state_v1();
  -- Preparation returns a season only after validating activation, a unique
  -- eligible season and the bootstrap aperture. An empty queue proves none of
  -- these. Off-season preparation stays not due; progress for a requested
  -- season cannot attest a configured active writer without that context.
  configuration_known=not ctl.enabled or coalesce((preparation->'season'->>'id')::integer=p_season,false);
  select count(*) filter(where state='pending'),count(*) filter(where state='held'),count(*) filter(where state='in_flight')
    into pending,held,active from public.nst_goalie_units where season=p_season;
  select max(r.committed_at) into last_commit from public.nst_goalie_unit_receipts r
    join public.nst_goalie_units u using(unit_key) where u.season=p_season;
  select jsonb_agg(jsonb_build_object('dataset',dataset,'pending',p,'held',h,'inFlight',f,'complete',c) order by dataset)
    into datasets from (select dataset,count(*) filter(where state='pending') p,count(*) filter(where state='held') h,
      count(*) filter(where state='in_flight') f,count(*) filter(where state in ('complete','empty_valid','no_games')) c
      from public.nst_goalie_units where season=p_season group by dataset) d;
  -- Count only the two latest closed windows, with durable unfinished work
  -- already queued when the window opened. Missing audits are not evidence.
  with windows as (
    select (day::date+start_time) at time zone 'UTC' opened,(day::date+end_time) at time zone 'UTC' closed
      from generate_series((t at time zone 'UTC')::date-1,(t at time zone 'UTC')::date,interval '1 day') day
      cross join (values(time '08:30',time '08:35'),(time '11:10',time '12:50')) v(start_time,end_time)
  ), latest as (select * from windows where closed<=t order by closed desc limit 2), stalled_windows as (
    select *,ctl.enabled and ctl.enabled_at<=opened
      and exists(select 1 from public.nst_goalie_cohorts c join public.nst_goalie_cohort_units cu using(scope)
        join public.nst_goalie_units u using(unit_key)
        where c.season=p_season and c.created_at<=opened and u.state in ('pending','in_flight','held')
          and not exists(select 1 from public.nst_goalie_unit_receipts prior
            where prior.unit_key=u.unit_key and prior.committed_at<=opened))
      and not exists(select 1 from public.nst_goalie_unit_receipts r join public.nst_goalie_units u using(unit_key)
        where u.season=p_season and r.committed_at>=opened and r.committed_at<closed) stalled from latest
  ) select case when bool_and(stalled) and count(*)=2 then 2
      when coalesce((array_agg(stalled order by closed desc))[1],false) then 1 else 0 end into no_progress from stalled_windows;
  return jsonb_build_object('version',1,'enabled',ctl.enabled,'configurationKnown',configuration_known,
    'pending',pending,'held',held,'inFlight',active,'datasets',coalesce(datasets,'[]'::jsonb),'lastCommitAt',last_commit,
    'noProgressWindows',no_progress,'reviewRequired',not configuration_known or (preparation->>'reviewRequired')::boolean or
      (public.nst_job_state_v1()->>'reviewRequired')::boolean or held>0 or exists(select 1 from public.nst_goalie_claims
      where state='held' or (state='claimed' and deadline_at<=t)));
end $$;

revoke all on function public.nst_goalie_preparation_state_v1(),public.nst_goalie_prepare_cohort_v1(jsonb,jsonb),public.nst_goalie_progress_v1(integer)
  from public,anon,authenticated;
grant execute on function public.nst_goalie_preparation_state_v1(),public.nst_goalie_prepare_cohort_v1(jsonb,jsonb),public.nst_goalie_progress_v1(integer) to service_role;

revoke all on function public.nst_goalie_verify_day_v1(integer,date),public.nst_goalie_ensure_cohort_v1(jsonb),
  public.nst_goalie_read_state_v1(text),public.nst_goalie_claim_step_v1(text,text[],integer,timestamptz),
  public.nst_goalie_commit_unit_v1(text,uuid,text,jsonb,text,boolean,integer,integer),
  public.nst_goalie_finish_step_v1(text,uuid,integer,text[]),public.nst_goalie_hold_step_v1(text,uuid,text)
  from public,anon,authenticated;
grant execute on function public.nst_goalie_verify_day_v1(integer,date),public.nst_goalie_ensure_cohort_v1(jsonb),
  public.nst_goalie_read_state_v1(text),public.nst_goalie_claim_step_v1(text,text[],integer,timestamptz),
  public.nst_goalie_commit_unit_v1(text,uuid,text,jsonb,text,boolean,integer,integer),
  public.nst_goalie_finish_step_v1(text,uuid,integer,text[]),public.nst_goalie_hold_step_v1(text,uuid,text) to service_role;
commit;
