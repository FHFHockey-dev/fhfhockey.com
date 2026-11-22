-- One durable owner across both HTTP writers and daily dispatch. No timer or automatic takeover.
create table public.ranking_publication_dispatches (
  id uuid primary key default gen_random_uuid(),
  season_id integer not null,
  target_date date not null,
  mode text not null check (mode in ('scheduled', 'manual_rankings', 'manual_composites')),
  status text not null check (status in ('running', 'blocked', 'failed', 'ambiguous', 'complete')),
  stage text not null,
  prior_cutoff date,
  reason text,
  evidence jsonb not null default '{}',
  events jsonb not null default '[]',
  started_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  check ((status = 'running') = (finished_at is null))
);
create unique index ranking_dispatch_scheduled_day on public.ranking_publication_dispatches (season_id, target_date)
  where mode = 'scheduled';
create unique index ranking_dispatch_single_writer on public.ranking_publication_dispatches ((true))
  where status in ('running', 'ambiguous');

-- Legacy unmarked rows have no trustworthy marker or methodology version. Existing
-- ranking indexes put entity_id, metric or methodology before the snapshot date.
create index ranking_dispatch_existing_5v5_rows on public.entity_metric_rankings (season_id, snapshot_date)
  where entity_type = 'skater' and strength_state = '5v5' and peer_group_type = 'all_skaters'
    and peer_group_key = 'all';

alter table public.ranking_publication_dispatches enable row level security;
revoke all on public.ranking_publication_dispatches from public, anon, authenticated, service_role;
grant select, insert, update on public.ranking_publication_dispatches to service_role;

create function public.latest_ranking_publication_cutoff(p_season integer, p_through date default null) returns date
language sql stable security invoker set search_path = '' as $$
  with eligible as (
    select * from public.ranking_publications
    where season_id = p_season and strength_state = '5v5'
      and snapshot_date <= coalesce(p_through, (statement_timestamp() at time zone 'UTC')::date)
      and peer_group_type = 'all_skaters' and peer_group_key = 'all'
      and status = 'complete' and min_gp = 1 and min_toi_seconds = 300
      and expected_entities > 0 and written_entities = expected_entities
      and expected_rows >= expected_entities and db_written_rows = expected_rows
      and completed_at is not null
  )
  select max(snapshot_date) from (
    select c.snapshot_date
    from eligible c join eligible r on r.snapshot_date = c.snapshot_date
      and r.expected_entities = c.expected_entities and r.completed_at <= c.started_at
    where c.surface = 'skater_composite_ratings' and (c.window_type,c.window_size) = ('season',0)
      and r.surface = 'entity_metric_rankings'
      and (r.window_type,r.window_size) in (('season',0),('last_5',5),('last_10',10),('last_20',20))
    group by c.snapshot_date having count(*) = 4
  ) as pairs;
$$;

create function public.claim_ranking_publication_dispatch(
  p_season integer, p_date date, p_mode text, p_protect boolean, p_write_dates date[]
) returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare
  owner_id uuid;
  prior_date date;
  has_writer boolean;
  result text := 'claimed';
  why text;
begin
  if p_season is null or p_date is null or p_protect is null or p_mode is null
    or p_mode not in ('scheduled','manual_rankings','manual_composites') then
    raise exception 'Invalid Rankings dispatch claim';
  end if;
  -- Serializes only the claim transaction. The partial unique index holds the durable
  -- lock after it commits, across HTTP requests and process exits.
  perform pg_catalog.pg_advisory_xact_lock(1481197138, 20261118);
  if p_mode = 'scheduled' then
    select prior_cutoff into prior_date from public.ranking_publication_dispatches
    where mode = 'scheduled' and season_id = p_season and target_date = p_date;
    if found then
      return jsonb_build_object('outcome','duplicate','id',null,'priorCutoff',prior_date);
    end if;
  end if;
  -- Observe ownership before looking up the served date. A writer can complete
  -- between these two reads; a claim that saw it must remain busy.
  select exists (select 1 from public.ranking_publication_dispatches where status in ('running','ambiguous'))
    into has_writer;
  prior_date := public.latest_ranking_publication_cutoff(p_season);
  if has_writer then
    result := 'busy'; why := 'Another writer is active or requires reconciliation.';
  elsif (p_protect or p_mode = 'scheduled') and prior_date is null then
    result := 'protected'; why := 'No eligible complete marked pair establishes the served cutoff.';
  elsif p_mode = 'scheduled' and p_date <= prior_date then
    result := 'protected'; why := 'Target is already served or older.';
  elsif p_mode = 'scheduled' and (
    exists (select 1 from public.ranking_publications
      where season_id=p_season and snapshot_date=p_date and strength_state='5v5'
        and peer_group_type='all_skaters' and peer_group_key in ('all','all_skaters')
        and ((surface='entity_metric_rankings'
          and (window_type,window_size) in (('season',0),('last_5',5),('last_10',10),('last_20',20)))
          or (surface='skater_composite_ratings' and (window_type,window_size)=('season',0))))
    or exists (select 1 from public.entity_metric_rankings
      where season_id=p_season and snapshot_date=p_date and entity_type='skater'
        and strength_state='5v5' and peer_group_type='all_skaters' and peer_group_key='all'
        and (window_type,window_size) in (('season',0),('last_5',5),('last_10',10),('last_20',20)))
    or exists (select 1 from public.skater_composite_ratings
      where season_id=p_season and snapshot_date=p_date and (window_type,window_size)=('season',0)
        and strength_state='5v5' and peer_group_type='all_skaters' and peer_group_key='all_skaters')
  ) then
    result := 'protected'; why := 'Target contains publication markers or physical rows; reconcile before recovery.';
  elsif p_protect and p_mode <> 'scheduled' and (
    coalesce(cardinality(p_write_dates),0) = 0 or array_position(p_write_dates,null) is not null
    or exists (select 1 from unnest(p_write_dates) d where d <= prior_date)
    or exists (select 1 from public.ranking_publication_dispatches
      where season_id = p_season and mode = 'scheduled' and target_date = any(p_write_dates))
  ) then
    result := 'protected'; why := 'A manual target is unknown, already served or has a scheduled attempt.';
  end if;
  if result = 'claimed' or p_mode = 'scheduled' then
    insert into public.ranking_publication_dispatches(season_id,target_date,mode,status,stage,prior_cutoff,reason,finished_at,evidence)
    values(p_season,p_date,p_mode,case when result='claimed' then 'running' else 'blocked' end,
      'claim',prior_date,why,case when result<>'claimed' then clock_timestamp() end,
      case when p_mode='scheduled' then '{}'::jsonb else jsonb_build_object('writeDates',p_write_dates) end)
    returning id into owner_id;
  end if;
  return jsonb_build_object('outcome',result,'id',case when result='claimed' then owner_id end,'priorCutoff',prior_date,'reason',why);
end;
$$;

create function public.record_ranking_publication_dispatch(
  p_id uuid, p_stage text, p_status text, p_reason text, p_evidence jsonb
) returns void language plpgsql volatile security invoker set search_path = '' as $$
declare
  recorded timestamptz := clock_timestamp();
begin
  if p_status is null or p_status not in ('running','blocked','failed','ambiguous','complete')
     or nullif(trim(p_stage),'') is null or jsonb_typeof(p_evidence) is distinct from 'object' then
    raise exception 'Invalid Rankings dispatch update';
  end if;
  update public.ranking_publication_dispatches
    set status=p_status, stage=p_stage, reason=p_reason, updated_at=recorded,
      finished_at=case when p_status <> 'running' then recorded end,
      evidence=evidence || p_evidence,
      events=events || jsonb_build_array(jsonb_build_object('at',recorded,'stage',p_stage,'status',p_status,'reason',p_reason,'evidence',p_evidence))
    where id=p_id and status='running';
  if not found then raise exception 'Rankings dispatch no longer has an active claim'; end if;
end;
$$;

-- Explicit operator action only. The caller must separately establish writer and
-- database quiescence; elapsed time is never evidence that a write has settled.
create function public.reconcile_ranking_publication_dispatch(
  p_id uuid, p_expected_status text, p_expected_updated_at timestamptz, p_resolution text, p_evidence jsonb
) returns void language plpgsql volatile security invoker set search_path = '' as $$
declare
  recorded timestamptz := clock_timestamp();
begin
  if p_expected_status is null or p_expected_status not in ('running','ambiguous')
    or p_resolution is null or p_resolution not in ('complete','failed')
    or jsonb_typeof(p_evidence) is distinct from 'object'
    or nullif(trim(p_evidence->>'operator'),'') is null
    or nullif(trim(p_evidence->>'receipt'),'') is null
    or p_evidence->'writerQuiescent' is distinct from 'true'::jsonb
    or p_evidence->'databaseQuiescent' is distinct from 'true'::jsonb then
    raise exception 'Resolution requires explicit operator, evidence and quiescence attestations';
  end if;
  update public.ranking_publication_dispatches
    set status=p_resolution, stage='operator_reconciliation', reason=p_evidence->>'receipt',
      updated_at=recorded, finished_at=recorded, evidence=evidence || jsonb_build_object('reconciliation',p_evidence),
      events=events || jsonb_build_array(jsonb_build_object('at',recorded,'stage','operator_reconciliation',
        'status',p_resolution,'from',p_expected_status,'evidence',p_evidence))
    where id=p_id and status=p_expected_status and updated_at=p_expected_updated_at;
  if not found then raise exception 'Claim changed or is already settled; operator release refused'; end if;
end;
$$;

revoke execute on function public.latest_ranking_publication_cutoff(integer,date),
  public.claim_ranking_publication_dispatch(integer,date,text,boolean,date[]),
  public.record_ranking_publication_dispatch(uuid,text,text,text,jsonb),
  public.reconcile_ranking_publication_dispatch(uuid,text,timestamptz,text,jsonb) from public, anon, authenticated;
grant execute on function public.latest_ranking_publication_cutoff(integer,date),
  public.claim_ranking_publication_dispatch(integer,date,text,boolean,date[]),
  public.record_ranking_publication_dispatch(uuid,text,text,text,jsonb),
  public.reconcile_ranking_publication_dispatch(uuid,text,timestamptz,text,jsonb) to service_role;

comment on table public.ranking_publication_dispatches is
  'Scheduled dates are single-use. Running and ambiguous claims never expire. Reconciliation requires operator verification of worker termination, settled remote writes, all five markers, physical counts/IDs and prior served cutoff. Record evidence and release the specific claim explicitly; preserve history and never delete or replay that scheduled day.';
