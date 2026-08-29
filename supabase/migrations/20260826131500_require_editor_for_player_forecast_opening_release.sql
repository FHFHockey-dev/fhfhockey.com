create or replace function fhfh_internal.enforce_player_forecast_opening_release_editor()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.view_key = 'opening'
    and (new.actor_kind <> 'editor' or new.action = 'auto_publish')
  then
    raise exception using
      errcode = '23514',
      message = 'PLAYER_FORECAST_SEASON_OPENING_REQUIRES_EDITOR';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_player_forecast_opening_release_editor
  on public.player_forecast_season_release_events;

create trigger enforce_player_forecast_opening_release_editor
before insert or update on public.player_forecast_season_release_events
for each row
execute function fhfh_internal.enforce_player_forecast_opening_release_editor();

revoke all on function fhfh_internal.enforce_player_forecast_opening_release_editor()
  from public, anon, authenticated, service_role;
