begin;
set lock_timeout='5s';
set statement_timeout='60s';

alter table public.forge_board_visibility_observations add column rendered_at timestamptz;
comment on column public.forge_board_visibility_observations.rendered_at is
  'Authenticated probe clock, not independently synchronized. observed_at is the server receipt upper bound.';

create function fhfh_internal.capture_starter_board_revision_timing() returns trigger
language plpgsql security invoker set search_path='' as $$
declare metrics jsonb;
begin
  select f.metrics into metrics from public.forge_runs f where f.run_id=new.run_id;
  new.payload:=new.payload||jsonb_build_object('queueLease',metrics->'board_lease',
    'calculationStartedAt',metrics->>'started_at','calculationCompletedAt',metrics->>'finished_at');
  return new;
end $$;
create trigger starter_board_revision_timing before insert on public.forge_game_revisions
  for each row execute function fhfh_internal.capture_starter_board_revision_timing();
revoke all on function fhfh_internal.capture_starter_board_revision_timing() from public,anon,authenticated;

-- Keep the two-argument receipt function for existing consumers. New probes
-- supply render time separately; a missing time is never reconstructed.
create function public.record_starter_board_visibility_timed(p_probe_id uuid,p_revision_ids uuid[],p_rendered_at timestamptz)
returns integer language plpgsql security invoker set search_path='' as $$
declare inserted_count integer;
begin
  if p_probe_id is null or coalesce(cardinality(p_revision_ids),0) not between 1 and 16
    or p_rendered_at is null or p_rendered_at>clock_timestamp()+interval '5 seconds'
    or p_rendered_at<clock_timestamp()-interval '10 minutes' then raise exception 'Invalid timed board probe'; end if;
  insert into public.forge_board_visibility_observations(revision_id,probe_id,rendered_at)
    select id,p_probe_id,p_rendered_at from public.forge_game_revisions
      where id=any(p_revision_ids) and published_at<=p_rendered_at+interval '5 seconds'
    on conflict(revision_id,probe_id) do nothing;
  get diagnostics inserted_count=row_count;
  return inserted_count;
end $$;

-- Only operational identities and timing leave this function. Neither raw news,
-- account data nor projection input transcripts belong in an operational report.
create function public.read_starter_board_operational_events(p_from timestamptz,p_until timestamptz,p_as_of timestamptz)
returns setof jsonb language plpgsql stable security invoker set search_path='' as $$
begin
  if p_from is null or p_until is null or p_as_of is null or p_from>=p_until
    or p_until>p_as_of or p_as_of>clock_timestamp() or p_until-p_from>interval '31 days' then
    raise exception 'Invalid operational report window'; end if;
  if (select count(*) from public.forge_board_news_events where accepted_at>=p_from and accepted_at<p_until)>10000 then
    raise exception 'Operational report exceeds 10000 events; use smaller windows'; end if;
  return query
  select jsonb_build_object(
    'eventId',n.id,'gameId',n.game_id,'slateDate',g.date,'gameType',g.type,
    'newsKey',case when n.source_kind='review' then 'review:'||n.observation_id::text
      when coalesce(l.metadata,k.metadata)#>>'{sourceTiming,sourceReference}' is not null then
        md5(n.game_id::text||':'||(coalesce(l.metadata,k.metadata)#>>'{sourceTiming,sourceReference}')) end,
    'changeKey',case when n.source_kind='review' then 'review:'||n.observation_id::text
      when coalesce(l.metadata,k.metadata)#>>'{sourceTiming,sourceReference}' is not null then
        md5(n.game_id::text||':'||n.source_kind||':'||(coalesce(l.metadata,k.metadata)#>>'{sourceTiming,sourceReference}')
          ||':'||coalesce(categories.assertions::text,jsonb_build_array(k.player_id,k.observation_status)::text)) end,
    'queueVersion',n.queue_version,'categories',coalesce(categories.kinds,array[n.source_kind]),
    'sourcePublishedAt',case when n.source_kind='review' then n.source_published_at
      else (coalesce(l.metadata,k.metadata)#>>'{sourceTiming,sourcePublishedAt}')::timestamptz end,
    'receivedAt',case when n.source_kind='review' then n.received_at
      else (coalesce(l.metadata,k.metadata)#>>'{sourceTiming,receivedAt}')::timestamptz end,
    'acceptedAt',n.accepted_at,'firstDispatchedAt',first_dispatch.dispatched_at,
    'revisionId',delivery.id,'runId',delivery.run_id,'inputCutoff',delivery.input_cutoff,
    'successfulDispatchAt',delivery.dispatched_at,'calculationStartedAt',delivery.started_at,
    'calculationCompletedAt',delivery.finished_at,'publishedAt',delivery.published_at,
    'browserRenderedAt',delivery.rendered_at,'visibilityReceivedAt',delivery.visible_at)
  from public.forge_board_news_events n join public.games g on g.id=n.game_id
  left join public.player_forecast_lineup_snapshots l on n.source_kind='lineup' and l.id=n.observation_id
  left join public.player_forecast_goalie_start_observations k on n.source_kind='goalie' and k.id=n.observation_id
  left join lateral(
    select array_agg(distinct case when a.unit_type='power_play' then 'pp'
      when a.unit_type in ('scratch','injury') then 'availability'
      when a.unit_type in ('forward_line','defense_pair') then 'ev' else 'unknown' end order by
      case when a.unit_type='power_play' then 'pp' when a.unit_type in ('scratch','injury') then 'availability'
      when a.unit_type in ('forward_line','defense_pair') then 'ev' else 'unknown' end) kinds,
      jsonb_agg(jsonb_build_array(a.player_id,case when a.player_id is null then lower(a.raw_player_name) end,
        a.unit_type,a.unit_number,a.slot_number,a.assignment_status)
        order by a.unit_type,a.unit_number,a.slot_number,a.player_id,a.raw_player_name) assertions
    from public.player_forecast_lineup_assignments a where a.snapshot_id=l.id
  ) categories on true
  left join lateral(
    select d.dispatched_at from public.forge_board_dispatch_observations d
      where d.game_id=n.game_id and d.queue_version>=n.queue_version
        and d.dispatched_at>=n.accepted_at and d.dispatched_at<=p_as_of
      order by d.dispatched_at limit 1
  ) first_dispatch on true
  left join lateral(
    select r.id,r.run_id,r.published_at,r.payload->>'inputCutoff' input_cutoff,
      d.dispatched_at,r.payload->>'calculationStartedAt' started_at,r.payload->>'calculationCompletedAt' finished_at,
      v.observed_at visible_at,v.rendered_at
    from public.forge_game_revisions r
    join public.forge_board_dispatch_observations d on d.game_id=r.game_id
      and d.lease_owner::text=r.payload#>>'{queueLease,owner}'
      and d.queue_version::text=r.payload#>>'{queueLease,version}'
    left join lateral(select observed_at,rendered_at from public.forge_board_visibility_observations
      where revision_id=r.id and observed_at<=p_as_of order by observed_at,id limit 1) v on true
    where r.game_id=n.game_id and d.queue_version>=n.queue_version and d.dispatched_at>=n.accepted_at
      and (r.payload->>'inputCutoff')::timestamptz>=n.accepted_at and r.published_at<=p_as_of
    -- A superseded revision need not have been rendered; a later revision can
    -- deliver all coalesced news. Match the first actually observed delivery.
    order by v.observed_at nulls last,r.published_at,r.id limit 1
  ) delivery on true
  where n.accepted_at>=p_from and n.accepted_at<p_until
  order by n.accepted_at,n.id;
end $$;
revoke all on function public.record_starter_board_visibility_timed(uuid,uuid[],timestamptz) from public,anon,authenticated;
revoke all on function public.read_starter_board_operational_events(timestamptz,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.record_starter_board_visibility_timed(uuid,uuid[],timestamptz) to service_role;
grant execute on function public.read_starter_board_operational_events(timestamptz,timestamptz,timestamptz) to service_role;
commit;
