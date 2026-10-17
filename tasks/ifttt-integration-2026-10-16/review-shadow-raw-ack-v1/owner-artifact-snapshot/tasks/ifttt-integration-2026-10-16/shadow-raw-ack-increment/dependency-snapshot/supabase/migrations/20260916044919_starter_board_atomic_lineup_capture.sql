begin;
set lock_timeout='5s';

-- Snapshot, individual assertions, and their news queue trigger commit together.
-- This supplements the immutable research tables without changing their contract.
create function public.capture_starter_board_lineup(p_snapshot jsonb, p_assignments jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  incoming public.player_forecast_lineup_snapshots;
  stored public.player_forecast_lineup_snapshots;
  captured_id uuid;
  inserted_snapshot boolean;
  inserted_assignments integer;
  identity_fields text[] := array['game_id','team_id','source_group','source_key','source_account',
    'source_capture_key','source_url','classification','observed_at','available_at','expires_at',
    'completeness','accepted','parser_version','metadata'];
begin
  if jsonb_typeof(p_snapshot) is distinct from 'object'
    or jsonb_typeof(p_assignments) is distinct from 'array' then
    raise exception 'Invalid lineup capture';
  end if;
  incoming := jsonb_populate_record(null::public.player_forecast_lineup_snapshots,p_snapshot);
  insert into public.player_forecast_lineup_snapshots(game_id,team_id,source_group,source_key,source_account,
    source_capture_key,source_url,classification,observed_at,available_at,expires_at,completeness,accepted,parser_version,metadata)
  values(incoming.game_id,incoming.team_id,incoming.source_group,incoming.source_key,incoming.source_account,
    incoming.source_capture_key,incoming.source_url,incoming.classification,incoming.observed_at,incoming.available_at,
    incoming.expires_at,incoming.completeness,incoming.accepted,incoming.parser_version,incoming.metadata)
  on conflict(source_capture_key,team_id) do nothing returning id into captured_id;
  inserted_snapshot := captured_id is not null;
  if not inserted_snapshot then
    select * into strict stored from public.player_forecast_lineup_snapshots s
      where s.source_capture_key=incoming.source_capture_key and s.team_id=incoming.team_id;
    captured_id := stored.id;
    if exists(select 1 from unnest(identity_fields) k where to_jsonb(stored)->k is distinct from to_jsonb(incoming)->k) then
      raise exception 'Duplicate lineup capture changes immutable inputs';
    end if;
    -- An exact retry must neither append new assertions nor rewrite old ones.
    if exists(
      (select a.player_id,a.raw_player_name,a.unit_type,a.unit_number,a.slot_number,a.assignment_status
         from public.player_forecast_lineup_assignments a where a.snapshot_id=stored.id
       except select a.player_id,a.raw_player_name,a.unit_type,a.unit_number,a.slot_number,a.assignment_status
         from jsonb_populate_recordset(null::public.player_forecast_lineup_assignments,p_assignments) a)
      union all
      (select a.player_id,a.raw_player_name,a.unit_type,a.unit_number,a.slot_number,a.assignment_status
         from jsonb_populate_recordset(null::public.player_forecast_lineup_assignments,p_assignments) a
       except select a.player_id,a.raw_player_name,a.unit_type,a.unit_number,a.slot_number,a.assignment_status
         from public.player_forecast_lineup_assignments a where a.snapshot_id=stored.id)
    ) then raise exception 'Duplicate lineup capture changes immutable assignments'; end if;
    return jsonb_build_object('snapshotId',captured_id,'insertedSnapshot',false,'insertedAssignments',0);
  end if;
  insert into public.player_forecast_lineup_assignments(snapshot_id,player_id,raw_player_name,
    unit_type,unit_number,slot_number,assignment_status)
  select captured_id,a.player_id,a.raw_player_name,a.unit_type,a.unit_number,a.slot_number,a.assignment_status
    from jsonb_populate_recordset(null::public.player_forecast_lineup_assignments,p_assignments) a;
  get diagnostics inserted_assignments = row_count;
  return jsonb_build_object('snapshotId',captured_id,'insertedSnapshot',true,'insertedAssignments',inserted_assignments);
end $$;
revoke all on function public.capture_starter_board_lineup(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.capture_starter_board_lineup(jsonb,jsonb) to service_role;
commit;
