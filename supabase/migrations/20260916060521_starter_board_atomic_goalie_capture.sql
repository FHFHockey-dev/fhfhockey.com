begin;
set lock_timeout='5s';

-- Existing immutable observations, conflict versions, members and news triggers
-- participate in one transaction. A failed member insert rolls everything back.
create function public.capture_starter_board_goalies(p_observations jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  incoming public.player_forecast_goalie_start_observations;
  stored public.player_forecast_goalie_start_observations;
  first_row public.player_forecast_goalie_start_observations;
  inserted_id uuid; observation_ids uuid[]:='{}'; inserted_count integer:=0;
  primary_row public.player_forecast_goalie_start_observations;
  other_row public.player_forecast_goalie_start_observations;
  conflict_id uuid; next_conflict_version integer; capture_conflict_key text; member_ids uuid[];
  identity_fields text[]:=array['game_id','team_id','player_id','raw_player_name','observation_status','confidence',
    'raw_status','source_group','source_key','source_account','source_capture_key','source_url','observed_at',
    'available_at','expires_at','parser_version','accepted','metadata'];
begin
  if jsonb_typeof(p_observations) is distinct from 'array' or jsonb_array_length(p_observations) not between 1 and 2 then
    raise exception 'Invalid goalie capture'; end if;
  if jsonb_array_length(p_observations)>1 and exists(select 1 from jsonb_array_elements(p_observations) item
    where item->>'observation_status'='confirmed') then
    raise exception 'A report naming multiple goalies cannot confirm its starter'; end if;
  first_row:=jsonb_populate_record(null::public.player_forecast_goalie_start_observations,p_observations->0);
  if first_row.game_id is null or first_row.team_id is null or nullif(first_row.source_capture_key,'') is null then
    raise exception 'Missing goalie capture scope'; end if;
  -- Serialize only this game's team; independent games can capture concurrently.
  perform pg_advisory_xact_lock(hashtextextended('starter-board-goalie:'||first_row.game_id||':'||first_row.team_id,0));
  if exists(select 1 from public.player_forecast_goalie_start_observations prior
    where prior.source_capture_key=first_row.source_capture_key and prior.team_id=first_row.team_id
      and not exists(select 1 from jsonb_populate_recordset(null::public.player_forecast_goalie_start_observations,p_observations) item
        where item.player_id is not distinct from prior.player_id and item.raw_player_name is not distinct from prior.raw_player_name)) then
    raise exception 'Duplicate goalie capture changes immutable membership'; end if;
  for incoming in select * from jsonb_populate_recordset(null::public.player_forecast_goalie_start_observations,p_observations) loop
    if incoming.game_id is distinct from first_row.game_id or incoming.team_id is distinct from first_row.team_id
      or incoming.source_capture_key is distinct from first_row.source_capture_key
      or incoming.available_at is distinct from first_row.available_at or incoming.observed_at is distinct from first_row.observed_at
      or incoming.source_account is distinct from first_row.source_account or incoming.source_key is distinct from first_row.source_key
      or incoming.accepted is distinct from true or incoming.available_at is null or incoming.observed_at is null
      or incoming.available_at<incoming.observed_at or incoming.available_at>clock_timestamp()
      or incoming.observation_status is null or incoming.observation_status not in ('confirmed','likely','projected','unconfirmed','ruled_out')
      or (incoming.player_id is null and nullif(btrim(incoming.raw_player_name),'') is null) then
      raise exception 'Invalid or mixed goalie capture'; end if;
    insert into public.player_forecast_goalie_start_observations(game_id,team_id,player_id,raw_player_name,observation_status,
      confidence,raw_status,source_group,source_key,source_account,source_capture_key,source_url,observed_at,available_at,
      expires_at,parser_version,accepted,metadata)
    values(incoming.game_id,incoming.team_id,incoming.player_id,incoming.raw_player_name,incoming.observation_status,
      incoming.confidence,incoming.raw_status,incoming.source_group,incoming.source_key,incoming.source_account,
      incoming.source_capture_key,incoming.source_url,incoming.observed_at,incoming.available_at,incoming.expires_at,
      incoming.parser_version,incoming.accepted,incoming.metadata)
    on conflict do nothing returning id into inserted_id;
    if inserted_id is null then
      select * into strict stored from public.player_forecast_goalie_start_observations o
        where o.source_capture_key=incoming.source_capture_key and o.team_id=incoming.team_id
          and o.player_id is not distinct from incoming.player_id and o.raw_player_name is not distinct from incoming.raw_player_name;
      if exists(select 1 from unnest(identity_fields) k where to_jsonb(stored)->k is distinct from to_jsonb(incoming)->k) then
        raise exception 'Duplicate goalie capture changes immutable inputs'; end if;
      inserted_id:=stored.id;
    else inserted_count:=inserted_count+1; end if;
    if inserted_id=any(observation_ids) then raise exception 'Duplicate goalie within capture'; end if;
    observation_ids:=array_append(observation_ids,inserted_id);
  end loop;
  -- An exact retry never changes the queue or reopens an older review.
  if inserted_count=0 then
    return jsonb_build_object('observationIds',observation_ids,'insertedObservations',0,'insertedConflicts',0); end if;
  -- Mirror the board's reporter supersession and ten-minute material-conflict
  -- window. Later arrivals do not make an older publication more authoritative.
  with latest as (
    select distinct on (coalesce(nullif(o.source_account,''),o.source_key)) o.*
    from public.player_forecast_goalie_start_observations o
    where o.game_id=first_row.game_id and o.team_id=first_row.team_id and o.accepted
      and o.available_at<=first_row.available_at and (o.expires_at is null or o.expires_at>first_row.available_at)
    order by coalesce(nullif(o.source_account,''),o.source_key),o.observed_at desc,o.id desc
  ) select * into primary_row from latest where observation_status='confirmed' and player_id is not null
    order by observed_at desc,id desc limit 1;
  if primary_row.id is not null then
    with latest as (
      select distinct on (coalesce(nullif(o.source_account,''),o.source_key)) o.*
      from public.player_forecast_goalie_start_observations o
      where o.game_id=first_row.game_id and o.team_id=first_row.team_id and o.accepted
        and o.available_at<=first_row.available_at and (o.expires_at is null or o.expires_at>first_row.available_at)
      order by coalesce(nullif(o.source_account,''),o.source_key),o.observed_at desc,o.id desc
    ) select * into other_row from latest where observation_status='confirmed' and player_id<>primary_row.player_id
      and observed_at>=primary_row.observed_at-interval '10 minutes' order by observed_at desc,id desc limit 1;
  end if;
  if other_row.id is not null then
    select array_agg(id order by id) into member_ids from unnest(array[primary_row.id,other_row.id]) id;
    capture_conflict_key:='goalie:'||first_row.game_id||':'||first_row.team_id;
    if not exists(select 1 from public.player_forecast_observation_conflicts c
      where c.conflict_key=capture_conflict_key and c.metadata->'observationIds'=to_jsonb(member_ids)) then
      select coalesce(max(c.conflict_version),0)+1 into next_conflict_version from public.player_forecast_observation_conflicts c
        where c.conflict_key=capture_conflict_key;
      insert into public.player_forecast_observation_conflicts(conflict_key,conflict_version,conflict_type,game_id,team_id,
        player_id,detected_at,source_high_watermark,summary,metadata)
      values(capture_conflict_key,next_conflict_version,'goalie_start',first_row.game_id,first_row.team_id,primary_row.player_id,
        clock_timestamp(),first_row.available_at,'Conflicting confirmed goalie observations require review.',
        jsonb_build_object('needsReview',true,'observationIds',member_ids)) returning id into conflict_id;
      insert into public.player_forecast_conflict_members(conflict_id,observation_type,observation_id,position)
        values(conflict_id,'goalie_start',member_ids[1],1),(conflict_id,'goalie_start',member_ids[2],2);
    end if;
  end if;
  return jsonb_build_object('observationIds',observation_ids,'insertedObservations',inserted_count,
    'insertedConflicts',case when conflict_id is null then 0 else 1 end);
end $$;
revoke all on function public.capture_starter_board_goalies(jsonb) from public,anon,authenticated;
grant execute on function public.capture_starter_board_goalies(jsonb) to service_role;
commit;
